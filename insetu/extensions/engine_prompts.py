from pathlib import Path
import os
import re
from flask import request, jsonify
from insetu.sdk import InSetuExtension, ExtensionContext
from insetu.hooks import hooks

prompts_bp = InSetuExtension('prompts', __name__)
__depends__ = []

@hooks.on('mutate_workspace_config')
def inject_prompts_config(cfg, workspace_id=None, **kwargs):
    """Dynamically mounts the .insetu internal repository to the workspace matrix."""
    if "prompts" not in cfg.get("extensions", []): return
    targets = cfg.get("target_repos", [])
    if not any(r.get("repo_dir") == ".insetu" for r in targets):
        targets.append({
            "repo_dir": ".insetu",
            "title": "inSetu OS",
            "domain": "System Configuration",
            "exts": [".json", ".md", ".txt"],
            "apply_ignore": True,
            "repo_ignore_dirs": ["data"],
            "archive_type": "prompt-library",
            "exclude_from_diffs": True
        })
        cfg["target_repos"] = targets
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
@prompts_bp.route('resolve', methods=['GET'])
def api_prompts_resolve(ctx):
    """Fetches a prompt and recursively resolves {{include: ...}} macros."""
    from insetu.utils_core import resolve_prompt_includes

    filename = ctx.req.args.get('file', '')
    if not filename:
        return jsonify({"error": "File required"}), 400

    content = ctx.vfs.read(filename)
    if content is not None:
        resolved_content = resolve_prompt_includes(content, filename, ctx.workspace_id)
        return resolved_content, 200, {'Content-Type': 'text/plain; charset=utf-8'}

    return "Prompt not found.", 404