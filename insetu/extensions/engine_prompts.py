import os
import re
from flask import jsonify
from insetu.sdk import InSetuExtension, ExtensionContext
from insetu.hooks import hooks
prompts_bp = InSetuExtension('prompts', __name__, target_repos=[{
    "repo_dir": ".insetu",
    "title": "inSetu OS",
    "domain": "System Configuration",
    "exts": [".json", ".md", ".txt"],
    "apply_ignore": True,
    "repo_ignore_dirs": ["data"],
    "archive_type": "prompt-library",
    "exclude_from_context": True,
    "exclude_from_diffs": True
}])
__depends__ = []

@hooks.on('compile_contexts')
def compile_prompts_context(manifest, workspace_id=None, **kwargs):
    """Injects the prompt library into the UI manifest without dumping redundant RAG text payloads."""
    from insetu.utils_core import get_valid_workspace_files
    ctx = ExtensionContext('prompts', workspace_id)

    for config in ctx.config.get("target_repos", []):
        if config.get("archive_type") == "prompt-library":
            repo_path = ctx.resolve_path(config["repo_dir"])
            if os.path.exists(repo_path):
                final_list = get_valid_workspace_files(repo_path, config)
                if final_list:
                    manifest["prompts_context.txt"] = {
                        "files": [f"{config['repo_dir']}/{f}" for f in final_list],
                        "meta": {
                            "title": config.get("title", "Prompts"),
                            "domain": config.get("domain", "Prompts & State"),
                            "desc": config.get("description", "The Master Ingestion Prompt and CLI templates.")
                        }
                    }
@hooks.on('request_available_prompts')
def provide_available_prompts(workspace_id=None, **kwargs):
    """Soft-dependency provider: Supplies available prompts to the Gather extension's UI dropdowns."""
    ctx = ExtensionContext('prompts', workspace_id)
    prompts = []
    # VFS Walk natively yields paths relative to the workspace root.
    for ws_rel_path in ctx.vfs.walk(ctx.paths["prompts_dir"], exts=['.md', '.txt', '.gitkeep', '.keep']):
        prompts.append(ws_rel_path)

    return prompts
@prompts_bp.route('list', methods=['GET'])
def api_prompts_list(ctx):
    """Provides a list of available prompts for the UI."""
    prompts = provide_available_prompts(workspace_id=ctx.workspace_id)
    return jsonify({
        "prompts": prompts,
        "profile_dir": os.path.dirname(ctx.paths["config_path"])
    })
@prompts_bp.route('resolve', methods=['GET'])
def api_prompts_resolve(ctx):
    """Fetches a prompt and recursively resolves {{include: ...}} macros."""
    from insetu.utils_core import resolve_macro_includes

    filename = ctx.req.args.get('file', '')
    if not filename:
        return jsonify({"error": "File required"}), 400

    content = ctx.vfs.read(filename)
    if content is not None:
        def read_prompt(target_path):
            if target_path.startswith('prompts/'):
                target_path = f".insetu/{target_path}"
            return ctx.vfs.read(target_path)

        pattern = r'\{\{\s*include_prompt\s*:\s*(.+?)\s*\}\}'
        resolved_content = resolve_macro_includes(content, filename, pattern, read_prompt)
        return resolved_content, 200, {'Content-Type': 'text/plain; charset=utf-8'}

    return "Prompt not found.", 404