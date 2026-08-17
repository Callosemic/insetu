from pathlib import Path
import os
import json
import uuid
from flask import jsonify
from insetu.core.sdk import InSetuExtension, ExtensionContext
from insetu.kernel.hooks import hooks
from insetu.kernel.utils import slugify

flow_bp = InSetuExtension(
    'flow', 
    __name__,
    title="Workflows",
    description="Workflow batch automation and UI prompts.",
    virtual_contexts=[{
        "title": "Workflow Batches",
        "domain": "Workflows",
        "description": "Compiled workflow batch automation payloads.",
        "out_file": "workflows_context.txt"
    }]
)
__depends__ = ['prompts', 'gather']
@hooks.on('vfs_resolve_file')
def resolve_flow_artifacts(filename=None, workspace_id=None, **kwargs):
    if not filename: return None
    from pathlib import Path
    import os
    ctx = flow_bp.get_context(workspace_id)
    safe_basename = Path(filename).name
    cand = Path(ctx.paths.get("gather_dir", "")).joinpath(safe_basename).as_posix()
    if os.path.exists(cand):
        return cand, True
    return None

@hooks.on('request_paths')
def hook_flow_request_paths(workspace_id=None, **kwargs):
    try:
        from pathlib import Path
        import os
        from insetu.kernel.utils import get_workspace_physics
        cfg_path, _, _ = get_workspace_physics(workspace_id)
        artifacts_base = Path(cfg_path).parent.joinpath("data").as_posix()
        paths = {
            "gather_dir": Path(artifacts_base).joinpath("workflows").as_posix()
        }
        os.makedirs(paths["gather_dir"], exist_ok=True)
        return paths
    except Exception: 
        return {}

@hooks.on('register_compilation_steps')
def _register_flow_compilation_step(workspace_id=None, **kwargs):
    return [{
        "id": "flow_workflows",
        "depends_on": ["gather_base", "git_diffs"],
        "ext_name": "flow",
        "worker_name": "compile_workflows_task"
    }]
@flow_bp.worker("compile_workflows_task")
def _background_compile_workflows(ctx, **kwargs):
    ctx.jobs.update_progress("Packing active workflows...")
    if "flow" not in ctx.config.get("extensions", []): return

    # Ensure all preceding VFS writes (such as newly generated gather context parts) settle on disk
    ctx.sync_vfs_barrier()

    context_batches = ctx.store.get("workflows.json", "context_batches", [])
    if not context_batches: return {"message": "No active workflows to pack."}

    from insetu.core.gather.engine_gather import compile_context_payload
    import concurrent.futures

    current_manifest = ctx.manifest
    manifest_deltas = {}
    def process_batch(batch):
        batch_id = batch.get("id")
        if not batch_id: return None
        includes = batch.get("includes", [])
        target_repos_set = set()
        for i in includes:
            clean_inc = i.replace("ctx://", "")
            if '/' in clean_inc:
                repo_cand = clean_inc.split('/')[0]
                if repo_cand not in ('contexts', 'diffs', 'prompts'):
                    target_repos_set.add(repo_cand)

        base_filename = f"workflow_{batch_id}_context.txt"

        header_str = f"========== BATCH: {batch.get('title', batch.get('id'))} ==========\n\n"
        text_blocks = []
        resolved_files = []
        expanded_includes = []
        for inc in includes:
            if inc.startswith("ctx://"):
                expanded_includes.append(inc)
            else:
                inc_path = ctx.resolve_path(inc)
                if os.path.exists(inc_path) and os.path.isdir(inc_path) and not inc.endswith('.txt'):
                    for f in ctx.vfs.walk(inc):
                        expanded_includes.append(f)
                else:
                    expanded_includes.append(inc)
        for inc in expanded_includes:
            responses = ctx.emit('resolve_payload_chunks', uri=inc)
            chunks = next((r for r in responses if r), [inc])

            for chunk_identifier in chunks:
                safe_chunk_base = Path(chunk_identifier).name
                display_name = f"{Path(inc).parent.as_posix()}/{safe_chunk_base}" if (chunk_identifier != inc and "/" in inc) else chunk_identifier
                try:
                    # Let the Kernel VFS handle artifact detection and path resolution natively
                    content = ctx.vfs.read(chunk_identifier, is_absolute_artifact=False)
                    if content is not None:
                        text_blocks.append(f"--- {display_name} ---\n{content}\n\n")
                        resolved_files.append(display_name)
                    elif "diffs/" in chunk_identifier or safe_chunk_base.endswith("_diffs.txt"):
                        text_blocks.append(f"--- {display_name} (NO PENDING DIFFS) ---\n[Working tree clean. No uncommitted changes detected.]\n\n")
                        resolved_files.append(display_name)
                    else:
                        text_blocks.append(f"--- {display_name} (NOT FOUND) ---\n[DEBUG INFO]\n- Original include str: {inc}\n- Resolved chunk identifier: {chunk_identifier}\n\n")
                except Exception as e:
                    import traceback
                    text_blocks.append(f"--- {display_name} (ERROR READING FILE: {str(e)})\n[Target URI: {chunk_identifier}]\n[Traceback: {traceback.format_exc()}] ---\n\n")
        meta = {
            "type": "flow",
            "title": batch.get("title", batch_id),
            "domain": batch.get("domain", "Workflows"),
            "desc": "Compiled workflow batch payload.",
            "repos": list(target_repos_set)
        }

        entry = compile_context_payload(
            ctx.workspace_id, ctx.paths["gather_dir"], base_filename,
            header_str, text_blocks, resolved_files, meta
        )
        return base_filename, entry

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(process_batch, b) for b in context_batches]
        for future in concurrent.futures.as_completed(futures):
            filename, entry = future.result()
            if entry:
                manifest_deltas[filename] = entry
    # Flow Vacuum & Manifest Cleanup
    expected_flow_artifacts = set()
    active_workflow_keys = set()
    for filename, entry in manifest_deltas.items():
        active_workflow_keys.add(filename)
        expected_flow_artifacts.update(entry.get("chunks", [filename]))

    for k, v in list(current_manifest.items()):
        if k.startswith('workflow_') and k.endswith('_context.txt'):
            if k not in active_workflow_keys:
                manifest_deltas[k] = None
    if manifest_deltas:
        for k, v in manifest_deltas.items():
            if v is None:
                current_manifest.pop(k, None)
            else:
                current_manifest[k] = v
        ctx.save_manifest(manifest_deltas, is_full_compile=False)
        ctx.sync_vfs_barrier()
    from insetu.core.utils_core import vacuum_manifest_artifacts
    vacuum_manifest_artifacts(ctx, ctx.paths["gather_dir"], expected_flow_artifacts)

    return {"message": "Workflows compiled successfully."}
@flow_bp.route('batches', methods=['GET'])
def api_flow_batches(ctx):
    batches = ctx.store.get("workflows.json", "context_batches", [])

    # Auto-migrate IDs to match titles to prevent legacy recursion
    from insetu.kernel.utils import slugify
    changed = False
    used_ids = set()
    for b in batches:
        title = b.get("title", b.get("id", ""))
        ideal_id = slugify(title)

        new_id = ideal_id
        counter = 1
        while new_id in used_ids:
            new_id = f"{ideal_id}_{counter}"
            counter += 1

        used_ids.add(new_id)
        if b.get("id") != new_id:
            b["id"] = new_id
            changed = True

    if changed:
        ctx.store.set("workflows.json", "context_batches", batches)

    paths = ctx.paths
    from insetu.core.utils_core import get_available_contexts
    expected_contexts = get_available_contexts(ctx.workspace_id, exclusion_flags=["exclude_from_context"], exclude_types=["diff", "flow"])

    available_diffs = []
    available_prompts = []
    try:
        diff_results = ctx.emit('request_available_diffs')
        for res in diff_results:
            if res: available_diffs.extend(res)

        prompt_results = ctx.emit('request_available_prompts')
        for res in prompt_results:
            if res: available_prompts.extend(res)
    except Exception:
        pass
        
    import re
    def _is_base(name):
        if not name or not isinstance(name, str): return False
        return not bool(re.search(r'_part\d+\.txt$', name))

    try:
        return jsonify({
            "batches": batches,
            "available_contexts": sorted([c for c in expected_contexts if _is_base(c)]),
            "available_diffs": sorted([d for d in set(available_diffs) if _is_base(d)]),
            "available_prompts": sorted([p for p in available_prompts if isinstance(p, str)]),
            "artifacts_dir": paths["artifacts_base"],
            "profile_dir": Path(paths["config_path"]).parent.as_posix()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@hooks.on('pre_file_save')
def handle_flow_pre_save(workspace_id=None, filepath=None, content=None, data=None, **kwargs):
    if data:
        archive_path = data.get("archive_path")
        original_response_path = data.get("original_response_path")
        if archive_path and original_response_path and "{date}" in original_response_path:
            ctx = flow_bp.get_context(workspace_id)
            resolved_archive = ctx.resolve_path(archive_path)
            os.makedirs(resolved_archive, exist_ok=True)

            basename = Path(original_response_path).name
            prefix = basename.split("{date}")[0]

            resolved_path = ctx.resolve_path(filepath)
            if data.get("is_absolute_artifact"):
                from insetu.kernel.utils import resolve_system_artifact_path
                resolved_path = resolve_system_artifact_path(filepath, workspace_id)

            resolved_target_dir = Path(resolved_path).parent.as_posix()
            if os.path.exists(resolved_target_dir):
                for f in os.listdir(resolved_target_dir):
                    if f.startswith(prefix) and os.path.isfile(Path(resolved_target_dir).joinpath(f).as_posix()):
                        src_path = Path(resolved_target_dir).joinpath(f).as_posix()
                        dest_path = Path(resolved_archive).joinpath(f).as_posix()

                        content = ctx.vfs.read(src_path, is_absolute_artifact=True)
                        if content is not None:
                            ctx.vfs.save(dest_path, content, data={"is_absolute_artifact": True})
                            ctx.vfs.save(src_path, "", data={"action": "delete", "ignore_ledger": True, "is_absolute_artifact": True})
@flow_bp.route('batches/save', methods=['POST'])
def api_flow_batches_save(ctx):
    data = ctx.req.json
    batches = ctx.store.get("workflows.json", "context_batches", [])
    original_id = data.get("original_id")
    batch_id = data.get("id")

    existing = next((b for b in batches if b["id"] == original_id), None)
    if not existing:
        existing = next((b for b in batches if b["id"] == batch_id), None)

    if "original_id" in data:
        del data["original_id"]

    if existing:
        for optional_key in ["include_prompt", "response_path", "prompt_text", "show_if_exists", "show_if_missing"]:
            if optional_key in existing and optional_key not in data:
                del existing[optional_key]
        existing.update(data)
    else:
        batches.append(data)
    ctx.store.set("workflows.json", "context_batches", batches)

    return jsonify({"status": "success", "manifest": ctx.manifest})

@flow_bp.route('batches/delete', methods=['POST'])
def api_flow_batches_delete(ctx):
    data = ctx.req.json
    batch_id = data.get("id")
    batches = ctx.store.get("workflows.json", "context_batches", [])
    ctx.store.set("workflows.json", "context_batches", [b for b in batches if b.get("id") != batch_id])

    return jsonify({"status": "success", "manifest": ctx.manifest})