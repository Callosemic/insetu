from pathlib import Path
import os
import json
from flask import jsonify
from insetu.sdk import InSetuExtension
from insetu.utils_core import load_workflows, save_json_file
from insetu.hooks import hooks

flow_bp = InSetuExtension('flow', __name__)
__depends__ = []
@hooks.on('compile_contexts')
def compile_flow_batches(manifest, workspace_id=None, **kwargs):
    """Event Bus Hook: Auto-generates workflow batch payloads whenever the OS compiles."""
    from insetu.sdk import ExtensionContext
    ctx = ExtensionContext('flow', workspace_id)
    cfg = ctx.config
    if "flow" not in cfg.get("extensions", []): return
    w_cfg = load_workflows(workspace_id)
    context_batches = w_cfg.get("context_batches", [])
    for batch in context_batches:
        compile_batch(batch, workspace_id, manifest_data=manifest)
def compile_batch(batch, workspace_id=None, manifest_data=None):
    from insetu.sdk import ExtensionContext
    ctx = ExtensionContext('flow', workspace_id)

    batch_id = batch.get("id")
    if not batch_id: return
    includes = batch.get("includes", [])
    out_path = Path(ctx.paths["gather_dir"]).joinpath(f"{batch_id}_context.txt").as_posix()

    if manifest_data is None:
        manifest_path = Path(ctx.paths["contexts_dir"]).joinpath("manifest.json").as_posix()
        from insetu.utils_core import load_json_file
        manifest_data = load_json_file(manifest_path, {})
    content_lines = []
    content_lines.append(f"========== BATCH: {batch.get('title', batch_id)} ==========\n\n")
    for inc in includes:
        if inc.startswith("prompts/"):
            inc_path = Path(ctx.paths["prompts_dir"]).joinpath(inc[8:]).as_posix()
        elif inc.startswith("diffs/"):
            inc_path = Path(ctx.paths["diffs_dir"]).joinpath(inc[6:]).as_posix()
        elif inc.endswith("_context.txt") and not inc.startswith("contexts/"):
            inc_path = Path(ctx.paths["contexts_dir"]).joinpath(inc).as_posix()
        else:
            inc_path = Path(ctx.paths["artifacts_base"]).joinpath(inc).as_posix()

        try:
            content = ctx.vfs.read(inc_path)
            if content is not None:
                content_lines.append(f"--- {inc} ---\n{content}\n\n")
            else:
                content_lines.append(f"--- {inc} (NOT FOUND) ---\n\n")
        except Exception:
            content_lines.append(f"--- {inc} (ERROR READING FILE) ---\n\n")

    ctx.vfs.save(out_path, "".join(content_lines), data={"is_absolute_artifact": True})
    # Strip artifacts array from workflow config if it exists
    w_cfg = load_workflows(workspace_id)
    for b in w_cfg.get("context_batches", []):
        if b["id"] == batch_id and "artifacts" in b:
            del b["artifacts"]
            import json
            ctx.vfs.save(paths["workflows_path"], json.dumps(w_cfg, indent=2), data={"is_absolute_artifact": True})
            break
@flow_bp.route('batches', methods=['GET'])
def api_flow_batches(ctx):
    batches = ctx.store.get("workflows.json", "context_batches", [])
    paths = ctx.paths

    from insetu.utils_core import get_available_contexts
    expected_contexts = get_available_contexts(ctx.workspace_id)

    available_diffs = []
    available_prompts = []

    try:
        diff_results = hooks.emit('request_available_diffs', workspace_id=ctx.workspace_id)
        for res in diff_results:
            if res: available_diffs.extend(res)

        prompt_results = hooks.emit('request_available_prompts', workspace_id=ctx.workspace_id)
        for res in prompt_results:
            if res: available_prompts.extend(res)
    except Exception:
        pass

    return jsonify({
        "batches": batches,
        "available_contexts": sorted(list(expected_contexts)),
        "available_diffs": sorted(list(set(available_diffs))),
        "available_prompts": sorted(available_prompts),
        "artifacts_dir": paths["artifacts_base"],
        "profile_dir": os.path.dirname(paths["config_path"])
    })
@flow_bp.route('batches/save', methods=['POST'])
def api_flow_batches_save(ctx):
    data = ctx.req.json
    batches = ctx.store.get("workflows.json", "context_batches", [])
    batch_id = data.get("id")
    existing = next((b for b in batches if b["id"] == batch_id), None)

    if existing:
        for optional_key in ["include_prompt", "response_path", "prompt_text"]:
            if optional_key in existing and optional_key not in data:
                del existing[optional_key]
        existing.update(data)
    else:
        batches.append(data)

    ctx.store.set("workflows.json", "context_batches", batches)

    target_batch = existing if existing else data
    try:
        compile_batch(target_batch, ctx.workspace_id)
    except Exception as e:
        print(f"Warning: Failed to auto-compile batch {batch_id}: {str(e)}")

    return jsonify({"status": "success"})
@flow_bp.route('batches/delete', methods=['POST'])
def api_flow_batches_delete(ctx):
    data = ctx.req.json
    batch_id = data.get("id")
    batches = ctx.store.get("workflows.json", "context_batches", [])
    ctx.store.set("workflows.json", "context_batches", [b for b in batches if b.get("id") != batch_id])

    try:
        out_path = Path(ctx.paths["gather_dir"]).joinpath(f"{batch_id}_context.txt").as_posix()
        from insetu.routes_fs import execute_vfs_delete
        execute_vfs_delete(ctx.workspace_id, out_path)
    except Exception:
        pass

    return jsonify({"status": "success"})