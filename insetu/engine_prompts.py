import os
import re
from flask import Blueprint, request, jsonify
from insetu.hooks import hooks
from insetu.utils_core import resolve_workspace_path, get_gather_paths

prompts_bp = Blueprint('prompts', __name__)
__depends__ = []

@hooks.on('mutate_workspace_config')
def inject_prompts_config(cfg, workspace_id=None, **kwargs):
    """Dynamically mounts the .insetu internal repository to the workspace matrix."""
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
    from insetu.utils_core import load_config, get_valid_workspace_files, get_workspace_physics
    cfg = load_config(workspace_id)
    _, ws_root, _ = get_workspace_physics(workspace_id)
    for config in cfg.get("target_repos", []):
        if config.get("archive_type") == "prompt-library":
            repo_path = os.path.abspath(os.path.join(ws_root, config["repo_dir"]))
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
    paths = get_gather_paths(workspace_id)
    prompts = []
    if os.path.exists(paths["prompts_dir"]):
        for root, _, files in os.walk(paths["prompts_dir"]):
            for f in files:
                if f.lower().endswith(('.md', '.txt')) or f.lower() in ('.gitkeep', '.keep'):
                    rel_path = os.path.relpath(os.path.join(root, f), paths["prompts_dir"]).replace('\\', '/')
                    prompts.append(f"prompts/{rel_path}")
    return prompts

def resolve_prompt_includes(text, current_filepath, workspace_id, depth=0):
    if depth > 5:
        return text + "\n[!] INCLUSION DEPTH LIMIT EXCEEDED"
    def replacer(match):
        include_path = match.group(1).strip()
        # By default, treat paths as workspace-relative unless they explicitly use dot-notation for relative traversal
        if include_path.startswith('./') or include_path.startswith('../'):
            base_dir = os.path.dirname(current_filepath)
            target_path = os.path.normpath(os.path.join(base_dir, include_path)).replace('\\', '/')
        else:
            # Absolute to workspace root
            target_path = include_path.lstrip('/')

        if target_path.startswith('prompts/'):
            paths = get_gather_paths(workspace_id)
            resolved_abs = os.path.normpath(os.path.join(paths["prompts_dir"], target_path[8:])).replace('\\', '/')
        else:
            resolved_abs = resolve_workspace_path(target_path, workspace_id)

        if os.path.exists(resolved_abs):
            with open(resolved_abs, 'r', encoding='utf-8') as f:
                inc_content = f.read()
            return resolve_prompt_includes(inc_content, target_path, workspace_id, depth + 1)
        else:
            return f"[!] INCLUDE_PROMPT NOT FOUND: {include_path}"

    return re.sub(r'\{\{\s*include_prompt\s*:\s*(.+?)\s*\}\}', replacer, text)
@prompts_bp.route('/api/<workspace_id>/prompts/list', methods=['GET'])
def api_prompts_list(workspace_id):
    """Provides a list of available prompts for the UI."""
    paths = get_gather_paths(workspace_id)
    prompts = provide_available_prompts(workspace_id=workspace_id)
    return jsonify({
        "prompts": prompts,
        "profile_dir": os.path.dirname(paths["config_path"]).replace('\\', '/')
    })

@prompts_bp.route('/api/<workspace_id>/prompts/resolve', methods=['GET'])
def api_prompts_resolve(workspace_id):
    """Fetches a prompt and recursively resolves {{include: ...}} macros."""
    filename = request.args.get('file', '')
    if not filename:
        return jsonify({"error": "File required"}), 400

    resolved_path = resolve_workspace_path(filename, workspace_id)

    if os.path.exists(resolved_path):
        with open(resolved_path, 'r', encoding='utf-8') as f:
            content = f.read()
        resolved_content = resolve_prompt_includes(content, filename, workspace_id)
        return resolved_content, 200, {'Content-Type': 'text/plain; charset=utf-8'}

    return "Prompt not found.", 404