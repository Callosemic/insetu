from pathlib import Path
import os
import re
from flask import jsonify
from insetu.core.sdk import InSetuExtension, ExtensionContext
from akasa.hooks import hooks
prompts_bp = InSetuExtension(
    'prompts', 
    __name__, 
    title="Prompt Library", 
    description="Prompt template management and embedding."
)
__depends__ = []
@hooks.on('request_paths')
def hook_prompts_request_paths(workspace_id=None, **kwargs):
    """Dynamically injects the prompts directory into the ecosystem path dictionary."""
    try:
        from pathlib import Path
        import os
        from akasa.utils import get_tenant_control_dir

        # Guardrail: Never call ctx.paths here, as it triggers an infinite recursion loop
        control_dir = get_tenant_control_dir(workspace_id)
        prompts_dir = Path(control_dir).joinpath("ext", "prompts", "data").as_posix()
        os.makedirs(prompts_dir, exist_ok=True)
        return {"prompts_dir": prompts_dir}
    except Exception:
        return {}

@hooks.on('workspace_boot')
def mount_prompts_volumes(workspace_id=None, **kwargs):
    from akasa.vfs import mount_volume
    ctx = prompts_bp.get_context(workspace_id)
    mount_volume(workspace_id, 'ctx', 'prompts', ctx.paths.get("prompts_dir"))
@hooks.on('request_available_prompts')
def provide_available_prompts(workspace_id=None, **kwargs):
    """Soft-dependency provider: Supplies available OS-managed prompts to the Gather extension's UI dropdowns."""
    from pathlib import Path
    import os

    ctx = prompts_bp.get_context(workspace_id)
    prompts = []
    prompts_dir_abs = Path(ctx.paths["control_dir"]).joinpath("prompts").as_posix()
    os.makedirs(prompts_dir_abs, exist_ok=True)

    # Walk the sandbox-relative logical path instead of the absolute physical OS path
    for ws_rel_path in ctx.vfs.walk(".insetu/prompts"):
        prompts.append(ws_rel_path)

    # Enforce extension filtering so UI code isn't treated as a prompt.
    # Include .gitkeep to ensure empty folders render structurally in the file tree.
    return [p for p in prompts if p.lower().endswith(('.md', '.txt', '.gitkeep', '.keep'))]

@prompts_bp.route('list', methods=['GET'])
def api_prompts_list(ctx):
    """Provides a list of available prompts for the UI."""
    prompts = provide_available_prompts(workspace_id=ctx.workspace_id)
    return jsonify({
        "prompts": prompts,
        "profile_dir": Path(ctx.paths["config_path"]).parent.as_posix()
    })
@prompts_bp.route('resolve', methods=['GET'])
def api_prompts_resolve(ctx):
    """Fetches a prompt and recursively resolves {{include: ...}} macros."""
    from insetu.core.utils_core import resolve_macro_includes

    filename = ctx.req.args.get('file', '')
    if not filename:
        return jsonify({"error": "File required"}), 400
    from insetu.core.utils_core import InSetuURI

    # If the UI passes a raw relative path, normalize it to the hidden directory.
    # Otherwise, pass fully qualified URIs directly to the VFS.
    if not InSetuURI(filename).scheme and not filename.startswith(".insetu/"):
        filename = f".insetu/{filename}" if filename.startswith("prompts/") else f".insetu/prompts/{filename}"

    content = ctx.vfs.read(filename)
    if content is not None:
        def read_prompt(target_path):
            if not InSetuURI(target_path).scheme and not target_path.startswith(".insetu/"):
                target_path = f".insetu/{target_path}" if target_path.startswith("prompts/") else f".insetu/prompts/{target_path}"
            return ctx.vfs.read(target_path)
        pattern = r'\{\{\s*include_prompt\s*:\s*([^\s{}]+)\s*(?:\{([\s\S]*?)\})?\s*\}\}'
        resolved_content = resolve_macro_includes(content, filename, pattern, read_prompt)
        return resolved_content, 200, {'Content-Type': 'text/plain; charset=utf-8'}

    return "Prompt not found.", 404