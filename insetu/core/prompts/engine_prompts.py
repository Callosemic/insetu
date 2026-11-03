from pathlib import Path
import os
import re
from typing import TypedDict, List, Optional, Dict, Any
from insetu.core.sdk import InSetuExtension, ExtensionContext, TemplateOverlayVFSDriver
from insetu.core.topology.engine_topology import build_sys_landmarks_context
from insetu.core.utils_core import (
    get_sister_repos,
    interpolate_mustache_chain,
    resolve_macro_includes,
    parse_frontmatter,
    InSetuURI,
)


class PromptsVFSDriver(TemplateOverlayVFSDriver):
    """VFS Driver routing ctx://prompts/.templates/user via ws://default and .templates/<mod> to active module prompt directories."""

    def __init__(self):
        super().__init__(module_subdir="prompts")


_PROMPTS_DRIVER = PromptsVFSDriver()


def _ensure_global_user_templates_dir(workspace_id: str = "default") -> Path:
    return _PROMPTS_DRIVER.ensure_global_user_templates_dir(workspace_id)


prompts_bp = InSetuExtension(
    'prompts',
    __name__,
    title="Prompt Library",
    description="Core prompt template management, module .templates projection, and macro embedding.",
    core=True,
    volumes={
        'prompts': {
            'tier': 'data',
            'scheme': 'ctx',
            'path_key': 'prompts_dir',
            'driver': PromptsVFSDriver(),
            'legacy_dirs': ['prompts', 'ext/prompts/data'],
        }
    },
)
__depends__ = ['topology']


@prompts_bp.on('mutate_workspace_config')
def inject_prompts_config(cfg, workspace_id=None, **kwargs):
    for repo_cfg in cfg.get("target_repos", []):
        if "sub_buckets" not in repo_cfg:
            repo_cfg["sub_buckets"] = []
        if not any(b.get("id") == "prompts_omitted" for b in repo_cfg["sub_buckets"]):
            repo_cfg["sub_buckets"].append({
                "id": "prompts_omitted",
                "title": f"REPO PROMPTS ({repo_cfg.get('repo_dir', '').upper()})",
                "domain": "Hidden Context",
                "match_prefixes": [".insetu-data/prompts/"],
                "exclude_from_diffs": True,
                "is_system": True
            })
@prompts_bp.on('topology_boot_complete')
def migrate_legacy_prompt_macros_on_boot(workspace_id=None, **kwargs):
    """One-time boot migration upgrading legacy scheme-less {{include_prompt: ...}} tags in prompt files to canonical ctx://prompts/ URIs."""
    try:
        ctx = prompts_bp.get_context(workspace_id)
        pattern = re.compile(r'(\{\{\s*include_prompt\s*:\s*)([^\s{};,\'"]+)')
        target_roots = ["ctx://prompts"] + [
            f"vfs://{r_dir}/.insetu-data/prompts"
            for r_dir in get_sister_repos(ctx.workspace_id)
        ]
        candidate_uris = [
            u for root in target_roots
            for u in ctx.vfs.walk(root, exts=['.md', '.txt'])
        ]
        for prompt_uri in candidate_uris:
            if "/.templates/" in prompt_uri and "/.templates/user/" not in prompt_uri:
                continue
            content = ctx.vfs.read(prompt_uri)
            if not content or "include_prompt" not in content:
                continue
            changed = False
            def _upgrade_match(m):
                nonlocal changed
                prefix, raw_target = m.group(1), m.group(2).strip().strip('\'"')
                if "://" in raw_target or raw_target.startswith(('./', '../')):
                    return m.group(0)
                clean = raw_target
                for p in ('.insetu/data/prompts/', '.insetu/prompts/', 'prompts/'):
                    if clean.startswith(p):
                        clean = clean[len(p):]
                clean = clean.lstrip('/')
                changed = True
                return f"{prefix}ctx://prompts/{clean}"
            new_content = pattern.sub(_upgrade_match, content)
            if changed and new_content != content:
                ctx.vfs.save(prompt_uri, new_content, data={"ignore_ledger": True})
    except Exception:
        pass
def _discover_module_template_prompts(workspace_id=None):
    """Scans global user templates (via ws://default/prompts/.templates/user) plus active Core and workspace-enabled extensions."""
    _ensure_global_user_templates_dir(workspace_id)
    ctx = prompts_bp.get_context(workspace_id)
    template_uris = []
    user_templates_found = False
    for ws_user_path in ctx.vfs.walk("ws://default/prompts/.templates/user"):
        if ws_user_path.lower().endswith(('.md', '.txt', '.gitkeep', '.keep')):
            uri_path = InSetuURI(ws_user_path).path
            rel_u = uri_path[len("prompts/.templates/user"):].lstrip('/') if uri_path.startswith("prompts/.templates/user") else uri_path
            if rel_u:
                template_uris.append(f"ctx://prompts/.templates/user/{rel_u}")
                user_templates_found = True
    if not user_templates_found:
        template_uris.append("ctx://prompts/.templates/user/.gitkeep")
    for mod_name in ctx.get_active_modules():
        for mod_tpl_path in sorted(ctx.vfs.walk(f"ctx://prompts/.templates/{mod_name}", exts=['.md', '.txt'])):
            template_uris.append(mod_tpl_path)
    return template_uris
@prompts_bp.on('request_available_prompts')
def provide_available_prompts(workspace_id=None, **kwargs):
    """Supplies global (ctx://prompts), virtual module templates (ctx://prompts/.templates), repo-scoped (<repo>/.insetu-data/prompts), and peer-mounted (ws://) prompts."""
    ctx = prompts_bp.get_context(workspace_id)
    prompts = []
    for ws_rel_path in ctx.vfs.walk("ctx://prompts", exts=['.md', '.txt', '.gitkeep', '.keep']):
        if "/.templates/" not in ws_rel_path:
            prompts.append(ws_rel_path)

    for tpl_uri in _discover_module_template_prompts(workspace_id):
        prompts.append(tpl_uri)

    for r_dir in get_sister_repos(ctx.workspace_id):
        if r_dir:
            repo_prompt_root = f"vfs://{r_dir}/.insetu-data/prompts"
            found_repo_prompts = list(ctx.vfs.walk(repo_prompt_root, exts=['.md', '.txt', '.gitkeep', '.keep']))
            if found_repo_prompts:
                prompts.extend(found_repo_prompts)
            else:
                prompts.append(f"{repo_prompt_root}/.gitkeep")
    for _, ws_prompt_uri in ctx.iter_shared_mount_files(domain="prompts", exts=['.md', '.txt', '.gitkeep', '.keep']):
        prompts.append(ws_prompt_uri)

    return prompts


class PromptsListResponse(TypedDict):
    prompts: List[str]
    profile_dir: str
class PromptResolveQuery(TypedDict, total=False):
    file: str
    filepath: str
    content: str
    repo: str


def read_prompt_with_cascade(ctx, uri_str: str) -> Optional[str]:
    """
    Single Source of Truth prompt reader evaluating the 3-Tier Override Cascade:
    1. Exact URI or Workspace Override (`ctx://prompts/<rel>`)
    2. Global User Template (`ctx://prompts/.templates/user/<rel>`)
    3. Active Core & Extension Module Templates (`ctx://prompts/.templates/<mod>/<rel>`)
    4. Case-insensitive disk fallback across tenant prompt directories.
    """
    if not uri_str:
        return None
    canon_str = InSetuURI.canonicalize(uri_str, default_prefix="ctx://prompts/")
    u_obj = InSetuURI(canon_str)
    rel_p = (u_obj.path or "").lstrip("/")

    if u_obj.scheme == "ctx" and u_obj.volume == "prompts" and not rel_p.startswith(".templates/"):
        first_seg, sep, rest_rel = rel_p.partition("/")
        known_repos = set(get_sister_repos(ctx.workspace_id))
        repo_cands: List[str] = []
        fallback_rel = rel_p
        if sep and rest_rel and first_seg in known_repos:
            repo_cands.append(f"vfs://{first_seg}/.insetu-data/prompts/{rest_rel}")
            fallback_rel = rest_rel
        for cand_uri in (
            *repo_cands,
            f"ctx://prompts/{rel_p}",
            *([f"ctx://prompts/{fallback_rel}"] if fallback_rel != rel_p else []),
            f"ctx://prompts/.templates/user/{rel_p}",
            *([f"ctx://prompts/.templates/user/{fallback_rel}"] if fallback_rel != rel_p else []),
            *(f"ctx://prompts/.templates/{mod_name}/{fallback_rel}" for mod_name in ctx.get_active_modules()),
        ):
            val = ctx.vfs.read(cand_uri)
            if val is not None:
                return val
    else:
        for cand_uri in (str(u_obj), str(u_obj).lower()):
            val = ctx.vfs.read(cand_uri)
            if val is not None:
                return val

    if rel_p:
        target_lower = rel_p.lower()
        target_name_lower = Path(rel_p).name.lower()
        for avail_uri in provide_available_prompts(workspace_id=ctx.workspace_id):
            avail_lower = avail_uri.lower()
            if avail_lower.endswith(f"/{target_lower}") or avail_lower.endswith(f"/{target_name_lower}"):
                val = ctx.vfs.read(avail_uri)
                if val is not None:
                    return val
    return None


def resolve_prompt_text(
    ctx,
    target_uri: str = "ctx://prompts/preview.md",
    raw_content: Optional[str] = None,
    repo: Optional[str] = None,
    extra_context: Optional[Dict[str, Any]] = None,
    interpolate_vars: bool = True,
) -> Optional[str]:
    """
    Expands `{{include_prompt: ...}}` macros and interpolates `{{ var | sys.* | default }}`
    against the target repository's `sys.*` landmarks and any caller-supplied `extra_context`.
    """
    canon_uri = InSetuURI.canonicalize(target_uri, default_prefix="ctx://prompts/") if target_uri else "ctx://prompts/preview.md"
    content = raw_content if raw_content is not None else read_prompt_with_cascade(ctx, canon_uri)
    if content is None:
        return None

    yaml_meta, main_body, _ = parse_frontmatter(content)

    def _read_included_body(target_req: str) -> Optional[str]:
        raw_inc = read_prompt_with_cascade(ctx, InSetuURI.canonicalize(target_req, default_prefix="ctx://prompts/"))
        if raw_inc is None:
            return None
        _, inc_body, _ = parse_frontmatter(raw_inc)
        return inc_body

    expanded = resolve_macro_includes(main_body, canon_uri, read_callback=_read_included_body, workspace_id=ctx.workspace_id)
    if not interpolate_vars:
        return expanded

    fm_meta = yaml_meta if isinstance(yaml_meta, dict) else {}
    fm_repo = str(fm_meta.get("repo") or "").strip() or None
    base_ctx = dict(extra_context or {})
    if "sys" not in base_ctx or not isinstance(base_ctx.get("sys"), dict):
        base_ctx["sys"] = build_sys_landmarks_context(
            ctx,
            repo_hint=repo or fm_repo,
            candidate_uris=[canon_uri],
            extra_inputs={**fm_meta, **(base_ctx.get("inputs") or {})},
        )
    return interpolate_mustache_chain(expanded, base_ctx, ctx=ctx)


@prompts_bp.route('list', methods=['GET'], response_schema=PromptsListResponse, docstring="[sync] Lists all available workspace, repository, virtual module template, and mounted prompts.")
def api_prompts_list(ctx):
    """Provides a list of available prompts (including virtual .templates) for the UI."""
    prompts = provide_available_prompts(workspace_id=ctx.workspace_id)
    return {
        "prompts": prompts,
        "profile_dir": Path(ctx.paths["config_path"]).parent.as_posix()
    }


@prompts_bp.route('resolve', methods=['GET', 'POST'], request_schema=PromptResolveQuery, docstring="[sync] Fetches a canonical prompt URI (or evaluates an unsaved POST buffer), recursively resolves {{include_prompt: ...}} macros, and interpolates {{ sys.* }} repository landmarks.")
def api_prompts_resolve(ctx):
    """Fetches a canonical prompt URI or live POST buffer and resolves {{include_prompt: ...}} and {{ sys.* }} macros."""
    data = ctx.payload or {}
    filename = str(data.get('file') or data.get('filepath') or '').strip()
    live_content = data.get('content')
    repo_hint = str(data.get('repo') or '').strip() or None

    if not filename and live_content is None:
        return {"error": "File required"}, 400

    target_uri = InSetuURI.canonicalize(filename, default_prefix="ctx://prompts/") if filename else "ctx://prompts/preview.md"
    resolved_content = resolve_prompt_text(
        ctx,
        target_uri=target_uri,
        raw_content=live_content,
        repo=repo_hint,
        interpolate_vars=True,
    )
    if resolved_content is not None:
        return resolved_content, 200, {'Content-Type': 'text/plain; charset=utf-8'}

    return "Prompt not found.", 404