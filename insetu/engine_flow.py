import os
import json
from flask import Blueprint, jsonify, request
from insetu.utils_core import load_config, load_workflows, get_gather_paths, save_json_file
from insetu.hooks import hooks

flow_bp = Blueprint('flow', __name__)
__depends__ = []

@hooks.on('compile_contexts')
def compile_flow_batches(manifest, workspace_id=None, **kwargs):
    """Event Bus Hook: Auto-generates workflow batch payloads whenever the OS compiles."""
    w_cfg = load_workflows(workspace_id)
    context_batches = w_cfg.get("context_batches", [])
    for batch in context_batches:
        compile_batch(batch, workspace_id)

def compile_batch(batch, workspace_id=None):
    paths = get_gather_paths(workspace_id)
    batch_id = batch.get("id")
    if not batch_id: return
    includes = batch.get("includes", [])
    out_path = os.path.join(paths["gather_dir"], f"{batch_id}_context.txt")

    content_lines = []
    content_lines.append(f"========== BATCH: {batch.get('title', batch_id)} ==========\n\n")
    for inc in includes:
        inc_path = os.path.join(paths["artifacts_base"], inc)
        if os.path.exists(inc_path):
            with open(inc_path, "r", encoding="utf-8") as in_f:
                content_lines.append(f"--- {inc} ---\n")
                content_lines.append(in_f.read())
                content_lines.append("\n\n")
        else:
            content_lines.append(f"--- {inc} (NOT FOUND) ---\n\n")

    from insetu.routes_fs import execute_vfs_save
    execute_vfs_save(workspace_id, out_path, "".join(content_lines), data={"is_absolute_artifact": True})

@flow_bp.route('/api/<workspace_id>/flow/batches', methods=['GET'])
def api_flow_batches(workspace_id):
    from insetu.utils_core import get_safe_repo_id
    cfg = load_config(workspace_id)
    w_cfg = load_workflows(workspace_id)
    paths = get_gather_paths(workspace_id)

    batches = w_cfg.get("context_batches", [])
    expected_contexts = set()
    expected_diffs = set()

    for c in cfg.get("target_repos", []):
        r_dir = c.get("repo_dir", "")
        safe_r_dir = get_safe_repo_id(r_dir)
        subs = c.get("sub_buckets", [])

        if subs:
            for b in subs:
                if not b.get("dynamic_split_prefix"):
                    out = b.get("out_file", f"{r_dir}_{b.get('id')}_context.txt")
                    expected_contexts.add(f"contexts/{out}")
                    expected_diffs.add(f"diffs/{out.replace('_context.txt', '_diffs.txt')}")
                else:
                    dyn_dir = os.path.join(paths["workspace_root"], r_dir, b["dynamic_split_prefix"])
                    if os.path.exists(dyn_dir):
                        for module in os.listdir(dyn_dir):
                            if os.path.isdir(os.path.join(dyn_dir, module)) and not module.startswith('.'):
                                expected_contexts.add(f"contexts/{module}_context.txt")
                                expected_diffs.add(f"diffs/{module}_diffs.txt")
        else:
            out = c.get("out_file", f"{safe_r_dir}_context.txt")
            expected_contexts.add(f"contexts/{out}")
            expected_diffs.add(f"diffs/{out.replace('_context.txt', '_diffs.txt')}")

    if os.path.exists(paths["contexts_dir"]):
        for f in os.listdir(paths["contexts_dir"]):
            if f.endswith('.txt'): expected_contexts.add(f"contexts/{f}")
    if os.path.exists(paths["diffs_dir"]):
        for f in os.listdir(paths["diffs_dir"]):
            if f.endswith('.txt'): expected_diffs.add(f"diffs/{f}")

    available_prompts = []
    try:
        results = hooks.emit('request_available_prompts', workspace_id=workspace_id)
        for res in results:
            if res: available_prompts.extend(res)
    except Exception:
        pass

    return jsonify({
        "batches": batches,
        "available_contexts": sorted(list(expected_contexts)),
        "available_diffs": sorted(list(expected_diffs)),
        "available_prompts": sorted(available_prompts),
        "artifacts_dir": paths["artifacts_base"].replace('\\', '/'),
        "profile_dir": os.path.dirname(paths["config_path"]).replace('\\', '/')
    })

@flow_bp.route('/api/<workspace_id>/flow/batches/save', methods=['POST'])
def api_flow_batches_save(workspace_id):
    paths = get_gather_paths(workspace_id)
    data = request.json
    w_cfg = load_workflows(workspace_id)
    batches = w_cfg.get("context_batches", [])
    batch_id = data.get("id")
    existing = next((b for b in batches if b["id"] == batch_id), None)

    if existing:
        for optional_key in ["include_prompt", "response_path", "prompt_text"]:
            if optional_key in existing and optional_key not in data:
                del existing[optional_key]
        existing.update(data)
    else:
        batches.append(data)

    w_cfg["context_batches"] = batches
    save_json_file(paths["workflows_path"], w_cfg)

    target_batch = existing if existing else data
    try:
        compile_batch(target_batch, workspace_id)
    except Exception as e:
        print(f"Warning: Failed to auto-compile batch {batch_id}: {str(e)}")

    return jsonify({"status": "success"})

@flow_bp.route('/api/<workspace_id>/flow/batches/delete', methods=['POST'])
def api_flow_batches_delete(workspace_id):
    paths = get_gather_paths(workspace_id)
    data = request.json
    batch_id = data.get("id")

    w_cfg = load_workflows(workspace_id)
    batches = w_cfg.get("context_batches", [])
    w_cfg["context_batches"] = [b for b in batches if b.get("id") != batch_id]
    save_json_file(paths["workflows_path"], w_cfg)

    try:
        out_path = os.path.join(paths["gather_dir"], f"{batch_id}_context.txt")
        if os.path.exists(out_path):
            os.remove(out_path)
    except Exception:
        pass

    return jsonify({"status": "success"})