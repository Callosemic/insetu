from pathlib import Path
import os
import json
from flask import jsonify
from insetu.sdk import InSetuExtension
from insetu.utils_core import load_workflows, save_json_file
from insetu.hooks import hooks
flow_bp = InSetuExtension('flow', __name__)
__depends__ = ['git', 'prompts']
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
    out_path = Path(ctx.paths["gather_dir"]).joinpath(f"workflow_{batch_id}_context.txt").as_posix()

    is_standalone_compile = manifest_data is None
    if is_standalone_compile:
        manifest_data = ctx.manifest

    from insetu.engine_gather import compile_context_payload

    header_str = f"========== BATCH: {batch.get('title', batch_id)} ==========\n\n"
    text_blocks = []
    resolved_files = []
    try:
        for inc in includes:
            basename = os.path.basename(inc)
            chunks = []

            if manifest_data and basename in manifest_data:
                meta = manifest_data[basename].get("meta", {})
                if "chunks" in meta and isinstance(meta["chunks"], list):
                    chunks = meta["chunks"]

            if not chunks:
                chunks = [inc]
            for chunk_identifier in chunks:
                if chunk_identifier != inc and chunk_identifier in manifest_data.get(basename, {}).get("meta", {}).get("chunks", []):
                    # Always look in contexts_dir first (V2 spec), fallback to diffs_dir (V1 spec)
                    inc_path = Path(ctx.paths["contexts_dir"]).joinpath(chunk_identifier).as_posix()
                    if not os.path.exists(inc_path):
                        inc_path = Path(ctx.paths["diffs_dir"]).joinpath(chunk_identifier).as_posix()
                    display_name = f"{os.path.dirname(inc)}/{chunk_identifier}" if "/" in inc else chunk_identifier
                else:
                    display_name = chunk_identifier
                    if chunk_identifier.startswith("prompts/"):
                        inc_path = Path(ctx.paths["prompts_dir"]).joinpath(chunk_identifier[8:]).as_posix()
                    elif chunk_identifier.startswith("diffs/"):
                        inc_path = Path(ctx.paths["diffs_dir"]).joinpath(chunk_identifier[6:]).as_posix()
                        if not os.path.exists(inc_path):
                            inc_path = Path(ctx.paths["contexts_dir"]).joinpath(chunk_identifier[6:]).as_posix()
                    elif chunk_identifier.startswith("contexts/"):
                        inc_path = Path(ctx.paths["contexts_dir"]).joinpath(chunk_identifier[9:]).as_posix()
                    elif chunk_identifier.endswith("_diffs.txt"):
                        inc_path = Path(ctx.paths["diffs_dir"]).joinpath(chunk_identifier).as_posix()
                        if not os.path.exists(inc_path):
                            inc_path = Path(ctx.paths["contexts_dir"]).joinpath(chunk_identifier).as_posix()
                    elif chunk_identifier.endswith("_context.txt"):
                        inc_path = Path(ctx.paths["contexts_dir"]).joinpath(chunk_identifier).as_posix()
                    else:
                        # Allow arbitrary workspace files natively if they don't match known artifact paths
                        inc_path = ctx.resolve_path(inc)
                        if not os.path.exists(inc_path):
                            inc_path = Path(ctx.paths["artifacts_base"]).joinpath(inc).as_posix()
                try:
                    content = ctx.vfs.read(inc_path, is_absolute_artifact=True)
                    if content is not None:
                        text_blocks.append(f"--- {display_name} ---\n{content}\n\n")
                        resolved_files.append(display_name)
                    else:
                        verbose_debug = f"--- {display_name} (NOT FOUND) ---\n"
                        verbose_debug += f"[DEBUG INFO]\n"
                        verbose_debug += f"- Tried physical path: {inc_path}\n"
                        verbose_debug += f"- os.path.exists() check: {os.path.exists(inc_path)}\n"
                        verbose_debug += f"- Original include str: {inc}\n"
                        verbose_debug += f"- Manifest basename: {basename}\n"
                        verbose_debug += f"- Present in manifest?: {basename in manifest_data if manifest_data else False}\n"
                        if not os.path.exists(inc_path):
                            parent = os.path.dirname(inc_path)
                            verbose_debug += f"- Parent exists?: {os.path.exists(parent)}\n"
                            if os.path.exists(parent):
                                verbose_debug += f"- Parent contents (first 10): {os.listdir(parent)[:10]}\n"
                        if manifest_data and basename in manifest_data:
                            verbose_debug += f"- Manifest chunks: {manifest_data[basename].get('meta', {}).get('chunks', 'None')}\n"
                        verbose_debug += "\n\n"
                        text_blocks.append(verbose_debug)
                except Exception as e:
                    import traceback
                    text_blocks.append(f"--- {display_name} (ERROR READING FILE: {str(e)})\n[Target Path: {inc_path}]\n[Traceback: {traceback.format_exc()}] ---\n\n")
        meta = {
            "type": "flow",
            "title": batch.get("title", batch_id),
            "domain": batch.get("domain", "Workflows"),
            "desc": f"Compiled workflow batch payload."
        }
    except Exception as e:
        import traceback
        text_blocks = [f"CRITICAL COMPILATION ERROR:\n{traceback.format_exc()}"]
        meta = {
            "type": "flow",
            "title": f"ERROR: {batch.get('title', batch_id)}",
            "domain": batch.get("domain", "Workflows"),
            "desc": "Compilation failed."
        }
    manifest_entry = compile_context_payload(
        workspace_id, 
        ctx.paths["gather_dir"], 
        f"workflow_{batch_id}_context.txt", 
        header_str, 
        text_blocks, 
        resolved_files, 
        meta
    )
    # Update central manifest so UI can read chunk metadata
    manifest_data[f"workflow_{batch_id}_context.txt"] = manifest_entry

    if is_standalone_compile:
        ctx.save_manifest(manifest_data)

    # Strip artifacts array from workflow config if it exists
    w_cfg = load_workflows(workspace_id)
    for b in w_cfg.get("context_batches", []):
        if b["id"] == batch_id and "artifacts" in b:
            del b["artifacts"]
            ctx.store.set("workflows.json", "context_batches", w_cfg["context_batches"])
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
        from insetu.routes_fs import execute_vfs_delete
        from insetu.utils_core import load_json_file, save_json_file
        manifest_path = Path(ctx.paths["contexts_dir"]).joinpath("manifest.json").as_posix()
        manifest_data = load_json_file(manifest_path, {})
        manifest_key = f"workflow_{batch_id}_context.txt"

        chunks = []
        if manifest_key in manifest_data:
            meta = manifest_data[manifest_key].get("meta", {})
            chunks = meta.get("chunks", [manifest_key])
            del manifest_data[manifest_key]
            save_json_file(manifest_path, manifest_data, ctx.workspace_id)

        if not chunks:
            chunks = [manifest_key]

        for chunk_file in chunks:
            out_path = Path(ctx.paths["gather_dir"]).joinpath(chunk_file).as_posix()
            execute_vfs_delete(ctx.workspace_id, out_path)
    except Exception:
        pass

    return jsonify({"status": "success"})