from pathlib import Path
import os
import re
from flask import jsonify
from insetu.core.sdk import InSetuExtension, ExtensionContext
from insetu.kernel.hooks import hooks
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
        from insetu.kernel.utils import get_tenant_control_dir

        # Guardrail: Never call ctx.paths here, as it triggers an infinite recursion loop
        control_dir = get_tenant_control_dir(workspace_id)
        prompts_dir = Path(control_dir).joinpath("prompts").as_posix()
        os.makedirs(prompts_dir, exist_ok=True)
        return {"prompts_dir": prompts_dir}
    except Exception:
        return {}
@hooks.on('vfs_resolve_file')
def resolve_prompt_artifacts(filename=None, workspace_id=None, **kwargs):
    """Resolves ctx://prompts URIs and prompt fallback searches."""
    if not filename: return None
    from pathlib import Path
    import os
    ctx = prompts_bp.get_context(workspace_id)
    safe_basename = Path(filename).name
    cand = Path(ctx.paths["prompts_dir"]).joinpath(safe_basename).as_posix()

    if filename.startswith("ctx://prompts/") or os.path.exists(cand):
        if os.path.exists(cand):  
            return cand, True
    return None
@hooks.on('request_available_prompts')
def provide_available_prompts(workspace_id=None, **kwargs):
    """Soft-dependency provider: Supplies available OS-managed prompts to the Gather extension's UI dropdowns."""
    from pathlib import Path
    import os

    ctx = prompts_bp.get_context(workspace_id)
    prompts = []

    prompts_dir = Path(ctx.paths["control_dir"]).joinpath("prompts").as_posix()
    os.makedirs(prompts_dir, exist_ok=True)
    for ws_rel_path in ctx.vfs.walk(prompts_dir):
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
    from insetu.kernel.utils import resolve_macro_includes

    filename = ctx.req.args.get('file', '')
    if not filename:
        return jsonify({"error": "File required"}), 400

    if filename.startswith('prompts/'):
        filename = f".insetu/{filename}"

    content = ctx.vfs.read(filename)
    if content is not None:
        def read_prompt(target_path):
            if target_path.startswith('prompts/'):
                target_path = f".insetu/{target_path}"
            return ctx.vfs.read(target_path)
        pattern = r'\{\{\s*include_prompt\s*:\s*([^\s{}]+)\s*(?:\{([\s\S]*?)\})?\s*\}\}'
        resolved_content = resolve_macro_includes(content, filename, pattern, read_prompt)
        return resolved_content, 200, {'Content-Type': 'text/plain; charset=utf-8'}

    return "Prompt not found.", 404