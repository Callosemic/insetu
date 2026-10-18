from pathlib import Path
import os
import re
from typing import TypedDict, List
from flask import jsonify
from insetu.core.sdk import InSetuExtension, ExtensionContext
from insetu.core.system.legacy import move_tree_contents
from insetu.core.utils_core import resolve_macro_includes, InSetuURI, get_workspace_physics
from akasa.hooks import hooks
from akasa.utils import get_tenant_control_dir, is_extension_enabled, is_core_module, _CORE_MODULES, load_config, is_subpath
from akasa.vfs import mount_volume, register_driver, DefaultVFSDriver, _resolve_physical_path


def _ensure_global_user_templates_dir(workspace_id: str = "default") -> Path:
    """Resolves the global user templates directory via the ws://default/prompts/.templates/user VFS driver."""
    resolved = _resolve_physical_path("ws://default/prompts/.templates/user", workspace_id)
    user_dir = Path(resolved) if resolved else Path(get_tenant_control_dir("default")).joinpath("data", "prompts", ".templates", "user").resolve()
    os.makedirs(user_dir.as_posix(), exist_ok=True)
    return user_dir


def _resolve_module_prompts_dir(mod_name: str, workspace_id: str = None):
    """Resolves the physical prompts/ directory for 'user' (via ws://default) or an enabled Core/Domain module."""
    if mod_name == "user":
        return _ensure_global_user_templates_dir(workspace_id)
    if not mod_name or not is_extension_enabled(mod_name, workspace_id):
        return None
    insetu_root = Path(__file__).resolve().parent.parent.parent
    if is_core_module(mod_name):
        cand = insetu_root.joinpath("core", mod_name, "prompts")
        if cand.exists() and cand.is_dir():
            return cand.resolve()
    cand_ext = insetu_root.joinpath("extensions", mod_name, "prompts")
    if cand_ext.exists() and cand_ext.is_dir():
        return cand_ext.resolve()
    try:
        _, ws_root = get_workspace_physics(workspace_id)
        local_cand = Path(ws_root).joinpath(".insetu", "extensions", mod_name, "prompts")
        if local_cand.exists() and local_cand.is_dir():
            return local_cand.resolve()
    except Exception:
        pass
    return None
class PromptsVFSDriver(DefaultVFSDriver):
    """Custom VFS Driver routing ctx://prompts/.templates/user via ws://default and .templates/<mod> to active module prompt directories."""
    def resolve(self, uri_obj, workspace_id, physical_target):
        rel_path = (uri_obj.path or "").lstrip('/')
        if rel_path == ".templates" or rel_path.startswith(".templates/"):
            sub = rel_path[len(".templates"):].lstrip('/')
            if not sub:
                return None
            parts = sub.split('/', 1)
            mod_name = parts[0]
            mod_rel = parts[1] if len(parts) > 1 else ""
            if mod_name == "user":
                _ensure_global_user_templates_dir(workspace_id)
                ws_uri = f"ws://default/prompts/.templates/user/{mod_rel}".rstrip('/')
                return _resolve_physical_path(ws_uri, workspace_id)
            mod_prompts_dir = _resolve_module_prompts_dir(mod_name, workspace_id)
            if not mod_prompts_dir:
                return None
            if not mod_rel:
                return mod_prompts_dir.as_posix()
            resolved = mod_prompts_dir.joinpath(mod_rel).resolve()
            if not is_subpath(resolved, mod_prompts_dir):
                return None
            return resolved.as_posix()
        return super().resolve(uri_obj, workspace_id, physical_target)


prompts_bp = InSetuExtension(
    'prompts',
    __name__,
    title="Prompt Library",
    description="Core prompt template management, module .templates projection, and macro embedding.",
    core=True
)
__depends__ = []
@hooks.on('mutate_workspace_config')
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


@hooks.on('request_paths')
def hook_prompts_request_paths(workspace_id=None, **kwargs):
    """Dynamically injects the prompts directory into the ecosystem path dictionary."""
    try:
        control_dir = get_tenant_control_dir(workspace_id)
        prompts_dir = Path(control_dir).joinpath("data", "prompts").as_posix()
        os.makedirs(prompts_dir, exist_ok=True)
        return {"prompts_dir": prompts_dir}
    except Exception:
        return {}
@hooks.on('workspace_boot', priority=10)
def mount_prompts_volumes(workspace_id=None, **kwargs):
    register_driver('ctx', PromptsVFSDriver(), volume='prompts')
    ctx = prompts_bp.get_context(workspace_id)
    control_dir = Path(ctx.paths.get("control_dir"))
    prompts_dir = Path(ctx.paths.get("prompts_dir"))
    move_tree_contents(control_dir.joinpath("prompts"), prompts_dir)
    move_tree_contents(control_dir.joinpath("ext", "prompts", "data"), prompts_dir)
    mount_volume(workspace_id, 'ctx', 'prompts', prompts_dir.as_posix())


@hooks.on('topology_boot_complete')
def migrate_legacy_prompt_macros_on_boot(workspace_id=None, **kwargs):
    """One-time boot migration upgrading legacy scheme-less {{include_prompt: ...}} tags in prompt files to canonical ctx://prompts/ URIs."""
    try:
        ctx = prompts_bp.get_context(workspace_id)
        pattern = re.compile(r'(\{\{\s*include_prompt\s*:\s*)([^\s{}]+)(\s*(?:\{[\s\S]*?\})?\s*\}\})')
        for prompt_uri in ctx.vfs.walk("ctx://prompts", exts=['.md', '.txt']):
            if "/.templates/" in prompt_uri and "/.templates/user/" not in prompt_uri:
                continue
            content = ctx.vfs.read(prompt_uri)
            if not content or "include_prompt" not in content:
                continue
            changed = False
            def _upgrade_match(m):
                nonlocal changed
                prefix, raw_target, suffix = m.group(1), m.group(2).strip().strip('\'"'), m.group(3)
                if "://" in raw_target or raw_target.startswith(('./', '../')):
                    return m.group(0)
                clean = raw_target
                for p in ('.insetu/data/prompts/', '.insetu/prompts/', 'prompts/'):
                    if clean.startswith(p):
                        clean = clean[len(p):]
                clean = clean.lstrip('/')
                changed = True
                return f"{prefix}ctx://prompts/{clean}{suffix}"
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
    cfg = load_config(workspace_id)
    active_modules = sorted(set(_CORE_MODULES) | set(cfg.get("extensions", [])))
    for mod_name in active_modules:
        for mod_tpl_path in sorted(ctx.vfs.walk(f"ctx://prompts/.templates/{mod_name}", exts=['.md', '.txt'])):
            template_uris.append(mod_tpl_path)
    return template_uris


@hooks.on('request_available_prompts')
def provide_available_prompts(workspace_id=None, **kwargs):
    """Supplies global (ctx://prompts), virtual module templates (ctx://prompts/.templates), repo-scoped (<repo>/.insetu-data/prompts), and peer-mounted (ws://) prompts."""
    mount_prompts_volumes(workspace_id=workspace_id)
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


class PromptResolveQuery(TypedDict):
    file: str


@prompts_bp.route('list', methods=['GET'], response_schema=PromptsListResponse, docstring="[sync] Lists all available workspace, repository, virtual module template, and mounted prompts.")
def api_prompts_list(ctx):
    """Provides a list of available prompts (including virtual .templates) for the UI."""
    prompts = provide_available_prompts(workspace_id=ctx.workspace_id)
    return jsonify({
        "prompts": prompts,
        "profile_dir": Path(ctx.paths["config_path"]).parent.as_posix()
    })
@prompts_bp.route('resolve', methods=['GET'], request_schema=PromptResolveQuery, docstring="[sync] Fetches a canonical prompt URI and recursively resolves {{include_prompt: ...}} macros.")
def api_prompts_resolve(ctx):
    """Fetches a canonical prompt URI and recursively resolves {{include_prompt: ...}} macros."""
    mount_prompts_volumes(workspace_id=ctx.workspace_id)
    filename = ctx.req.args.get('file', '').strip()
    if not filename:
        return jsonify({"error": "File required"}), 400

    target_uri = str(InSetuURI(filename))
    content = ctx.vfs.read(target_uri)
    if content is not None:
        def read_prompt(target_req):
            return ctx.vfs.read(str(InSetuURI(target_req)))

        pattern = r'\{\{\s*include_prompt\s*:\s*([^\s{}]+)\s*(?:\{([\s\S]*?)\})?\s*\}\}'
        resolved_content = resolve_macro_includes(content, target_uri, pattern, read_prompt)
        return resolved_content, 200, {'Content-Type': 'text/plain; charset=utf-8'}

    return "Prompt not found.", 404