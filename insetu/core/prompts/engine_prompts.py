from pathlib import Path
import os
import re
from typing import TypedDict, List
from insetu.core.sdk import InSetuExtension, ExtensionContext, TemplateOverlayVFSDriver
from insetu.core.utils_core import (
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


def _resolve_module_prompts_dir(mod_name: str, workspace_id: str = None):
    return _PROMPTS_DRIVER.resolve_module_dir(mod_name, workspace_id)
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
__depends__ = []


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
        for prompt_uri in ctx.vfs.walk("ctx://prompts", exts=['.md', '.txt']):
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

    for repo_cfg in ctx.config.get("target_repos", []):
        r_dir = repo_cfg.get("repo_dir")
        if r_dir:
            repo_prompt_root = f"vfs://{r_dir}/.insetu-data/prompts"
            for r_rel_path in ctx.vfs.walk(repo_prompt_root, exts=['.md', '.txt', '.gitkeep', '.keep']):
                prompts.append(r_rel_path)
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
@prompts_bp.route('list', methods=['GET'], response_schema=PromptsListResponse, docstring="[sync] Lists all available workspace, repository, virtual module template, and mounted prompts.")
def api_prompts_list(ctx):
    """Provides a list of available prompts (including virtual .templates) for the UI."""
    prompts = provide_available_prompts(workspace_id=ctx.workspace_id)
    return {
        "prompts": prompts,
        "profile_dir": Path(ctx.paths["config_path"]).parent.as_posix()
    }
@prompts_bp.route('resolve', methods=['GET', 'POST'], request_schema=PromptResolveQuery, docstring="[sync] Fetches a canonical prompt URI (or evaluates an unsaved POST buffer) and recursively resolves {{include_prompt: ...}} macros.")
def api_prompts_resolve(ctx):
    """Fetches a canonical prompt URI or live POST buffer and recursively resolves {{include_prompt: ...}} macros."""
    data = ctx.payload or {}
    filename = str(data.get('file') or data.get('filepath') or '').strip()
    live_content = data.get('content')

    if not filename and live_content is None:
        return {"error": "File required"}, 400
    def _read_with_cascade(uri_str: str):
        u_obj = InSetuURI(uri_str)
        rel_p = (u_obj.path or "").lstrip("/")
        if u_obj.scheme == "ctx" and u_obj.volume == "prompts" and not rel_p.startswith(".templates/"):
            val = ctx.vfs.read(f"ctx://prompts/{rel_p}")
            if val is not None:
                return val
            val = ctx.vfs.read(f"ctx://prompts/.templates/user/{rel_p}")
            if val is not None:
                return val
            for mod_name in ctx.get_active_modules():
                val = ctx.vfs.read(f"ctx://prompts/.templates/{mod_name}/{rel_p}")
                if val is not None:
                    return val
            return None
        return ctx.vfs.read(str(u_obj))

    target_uri = str(InSetuURI(filename)) if filename else "ctx://prompts/preview.md"
    content = live_content if live_content is not None else _read_with_cascade(target_uri)
    if content is not None:
        _, main_body, _ = parse_frontmatter(content)

        def read_prompt(target_req):
            raw_inc = _read_with_cascade(str(InSetuURI(target_req)))
            if raw_inc is None:
                return None
            _, inc_body, _ = parse_frontmatter(raw_inc)
            return inc_body

        pattern = r'\{\{\s*include_prompt\s*:\s*([^\s{}]+)\s*(?:\{([\s\S]*?)\})?\s*\}\}'
        resolved_content = resolve_macro_includes(main_body, target_uri, pattern, read_prompt)
        return resolved_content, 200, {'Content-Type': 'text/plain; charset=utf-8'}

    return "Prompt not found.", 404