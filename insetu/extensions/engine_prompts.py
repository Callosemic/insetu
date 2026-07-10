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

    # Utilize the new SDK VFS Sweeper, guaranteeing boundaries and removing raw os.walk loops
    for f in ctx.vfs.walk(ctx.paths["prompts_dir"], exts=['.md', '.txt', '.gitkeep', '.keep']):
        prompts.append(f"prompts/{f}")

    return prompts
@prompts_bp.route('list', methods=['GET'])
def api_prompts_list(ctx):
    """Provides a list of available prompts for the UI."""
    prompts = provide_available_prompts(workspace_id=ctx.workspace_id)
    return jsonify({
        "prompts": prompts,
        "profile_dir": os.path.dirname(ctx.paths["config_path"])
    })
def resolve_prompt_includes(text, current_filepath, ctx, depth=0):
    if depth > 5:
        return text + "\n[!] INCLUSION DEPTH LIMIT EXCEEDED"

    def replacer(match):
        include_path = match.group(1).strip()

        if include_path.startswith('./') or include_path.startswith('../'):
            parts = current_filepath.split('/')[:-1]
            for p in include_path.split('/'):
                if p == '.': continue
                elif p == '..': 
                    if parts: parts.pop()
                else: parts.append(p)
            target_path = '/'.join(parts)
        else:
            target_path = include_path.lstrip('/')

        if target_path.startswith('prompts/'):
            target_path = f".insetu/{target_path}"

        inc_content = ctx.vfs.read(target_path)

        if inc_content is not None:
            return resolve_prompt_includes(inc_content, target_path, ctx, depth + 1)
        else:
            return f"[!] INCLUDE_PROMPT NOT FOUND: {include_path}"

    return re.sub(r'\{\{\s*include_prompt\s*:\s*(.+?)\s*\}\}', replacer, text)

@prompts_bp.route('resolve', methods=['GET'])
def api_prompts_resolve(ctx):
    """Fetches a prompt and recursively resolves {{include: ...}} macros."""
    filename = ctx.req.args.get('file', '')
    if not filename:
        return jsonify({"error": "File required"}), 400

    content = ctx.vfs.read(filename)
    if content is not None:
        resolved_content = resolve_prompt_includes(content, filename, ctx)
        return resolved_content, 200, {'Content-Type': 'text/plain; charset=utf-8'}

    return "Prompt not found.", 404