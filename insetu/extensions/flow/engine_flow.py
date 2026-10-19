from pathlib import Path
import os
import json
import uuid
import re
import traceback
from typing import TypedDict, Optional
from flask import jsonify
from insetu.core.sdk import InSetuExtension, ExtensionContext
from insetu.core.system.legacy import move_tree_contents
from insetu.core.utils_core import (
    InSetuURI,
    get_domain_artifact_path,
    get_available_contexts
)
from akasa.hooks import hooks
from akasa.utils import slugify, generate_ascii_tree, get_all_workspace_ids
from akasa.vfs import mount_volume, register_driver, DefaultVFSDriver


def _discover_mounted_batches(ctx) -> list:
    """Reads workflows.json from peer workspaces mounted for the 'flow' domain."""
    mounted_batches = []
    for mount in ctx.get_shared_mounts(domain="flow"):
        target_ws = mount["workspace_id"]
        raw_json = ctx.vfs.read(f"{mount['uri']}/workflows.json")
        if not raw_json:
            continue
        try:
            parsed = json.loads(raw_json)
            remote_list = parsed.get("context_batches", []) if isinstance(parsed, dict) else []
            for rb in remote_list:
                if not isinstance(rb, dict) or not rb.get("id"):
                    continue
                b_copy = dict(rb)
                b_copy["id"] = f"{target_ws}__{rb['id']}"
                b_copy["title"] = f"[🌐 {target_ws}] {rb.get('title') or rb['id']}"
                b_copy["is_shared"] = True
                b_copy["source_workspace"] = target_ws
                if b_copy.get("include_prompt") and not str(b_copy["include_prompt"]).startswith("ws://"):
                    canon_prompt = InSetuURI.canonicalize(b_copy["include_prompt"], default_prefix="ctx://prompts/")
                    p_uri = InSetuURI(canon_prompt)
                    b_copy["include_prompt"] = f"ws://{target_ws}/prompts/{p_uri.path}"
                mounted_batches.append(b_copy)
        except Exception:
            pass
    return mounted_batches

flow_bp = InSetuExtension(
    'flow', 
    __name__,
    title="Workflows",
    description="Workflow batch automation and UI prompts."
)
__depends__ = ['gather']

@hooks.on('mutate_workspace_config')
def inject_flow_metadata(cfg, workspace_id=None, **kwargs):
    if "flow" not in cfg.get("extensions", []): return
    if "virtual_contexts" not in cfg:
        cfg["virtual_contexts"] = []
    vc = {
        "title": "Workflow Batches",
        "domain": "Workflows",
        "description": "Compiled workflow batch automation payloads.",
        "out_file": "ctx://workflows/workflows_context.txt"
    }
    if not any(v.get("out_file") == vc["out_file"] for v in cfg["virtual_contexts"]):
        cfg["virtual_contexts"].append(vc)
@hooks.on('request_paths')
def hook_flow_request_paths(workspace_id=None, **kwargs):
    return {
        "workflows_dir": get_domain_artifact_path(workspace_id, "flow/contexts", "flow")
    }
@hooks.on('workspace_boot', priority=10)
def mount_flow_volumes(workspace_id=None, **kwargs):
    register_driver('ctx', DefaultVFSDriver())
    ctx = flow_bp.get_context(workspace_id)
    control_dir = Path(ctx.paths.get("control_dir"))
    workflows_dir = Path(ctx.paths.get("workflows_dir"))
    move_tree_contents(control_dir.joinpath("cache", "workflows"), workflows_dir)
    move_tree_contents(control_dir.joinpath("ext", "flow", "data", "workflows"), workflows_dir)
    mount_volume(workspace_id, 'ctx', 'workflows', workflows_dir.as_posix())
def _migrate_batch_uris(batch: dict) -> bool:
    """One-time migration helper to upgrade legacy scheme-less paths in workflows.json to canonical URIs."""
    changed = False
    for list_key in ("includes", "show_if_exists", "show_if_missing"):
        if isinstance(batch.get(list_key), list):
            new_list = []
            for item in batch[list_key]:
                if isinstance(item, str) and "://" not in item:
                    s = item.replace("\\", "/").strip()
                    if s.endswith("_diffs.txt") or "diffs/" in s:
                        canon = f"ctx://diffs/{Path(s).name}"
                    elif (s.startswith("workflow_") and s.endswith("_context.txt")) or "workflows/" in s:
                        canon = f"ctx://workflows/{Path(s).name}"
                    elif s.endswith("_context.txt") or "contexts/" in s:
                        canon = f"ctx://contexts/{Path(s).name}"
                    elif "prompts/" in s:
                        canon = f"ctx://prompts/{s.split('prompts/')[-1].lstrip('/')}"
                    else:
                        canon = f"vfs://{s.lstrip('/')}"
                    new_list.append(canon)
                    changed = True
                else:
                    new_list.append(item)
            batch[list_key] = new_list
    if batch.get("include_prompt") and isinstance(batch["include_prompt"], str) and "://" not in batch["include_prompt"]:
        clean_p = batch["include_prompt"].replace("\\", "/").split("prompts/")[-1].lstrip("/")
        batch["include_prompt"] = f"ctx://prompts/{clean_p}"
        changed = True
    return changed

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
    mount_flow_volumes(workspace_id=ctx.workspace_id)
    target_repos = kwargs.get("target_repos")
    ctx.jobs.update_progress("Packing active workflows...")
    if ctx.config.get("extensions") and "flow" not in ctx.config.get("extensions", []): return
    # Ensure all preceding VFS writes (such as newly generated gather context parts) settle on disk
    ctx.sync_vfs_barrier()
    stored_batches = list(ctx.store.get("workflows.json", "context_batches", []))
    if any(_migrate_batch_uris(b) for b in stored_batches if isinstance(b, dict)):
        ctx.store.set("workflows.json", "context_batches", stored_batches)
    context_batches = stored_batches + _discover_mounted_batches(ctx)
    full_manifest = ctx.manifest
    current_manifest = full_manifest.get("ctx", {})
    manifest_deltas = {}
    if not context_batches:
        ctx.reconcile_domain(
            domain_uri_prefix="ctx://workflows/workflow_",
            manifest_deltas={},
            domain_dir="ctx://workflows",
            target_repos=target_repos
        )
        return {"message": "No active workflows to pack. Cleared stale workflow entries."}
    def process_batch(batch):
        batch_id = batch.get("id")
        if not batch_id: return None, None
        includes = batch.get("includes", [])
        target_repos_set = set()
        for i in includes:
            repo_cand = InSetuURI(i).repo
            if repo_cand and repo_cand not in ('contexts', 'diffs', 'prompts', 'workflows'):
                target_repos_set.add(repo_cand)
        base_uri = f"ctx://workflows/workflow_{batch_id}_context.txt"

        header_str = f"========== BATCH: {batch.get('title', batch.get('id'))} ==========\n\n"
        text_blocks = []
        resolved_files = []
        # Validate canonical InSetuURIs natively
        healed_includes = []
        for inc in includes:
            uri = InSetuURI(inc)
            if uri.scheme == 'vfs' and not uri.is_dir and uri.is_dir_physical(ctx.workspace_id):
                healed_includes.append(f"{str(uri)}/")
            else:
                healed_includes.append(str(uri))
        if os.environ.get("INSETU_DEBUG") == "1":
            print(f"\n🌊 [FLOW TELEMETRY] --- Starting Batch: {batch_id} ---")

        # Centralized SSOT Expansion (handles raw strings, ctx:// chunks, and vfs:// folders natively)
        expanded_chunks = ctx.expand_selection(healed_includes)
        for chunk_identifier in expanded_chunks:
            safe_chunk_base = InSetuURI(chunk_identifier).basename
            display_name = chunk_identifier
            try:
                # Let the Kernel VFS handle artifact detection and path resolution natively
                content = ctx.vfs.read(chunk_identifier)
                if content is not None:
                    text_blocks.append(f"--- {display_name} ---\n{content}\n\n")
                    resolved_files.append(display_name)
                elif InSetuURI(chunk_identifier).is_diff:
                    text_blocks.append(f"--- {display_name} (NO PENDING DIFFS) ---\n[Working tree clean. No uncommitted changes detected.]\n\n")
                    resolved_files.append(display_name)
                else:
                    text_blocks.append(f"--- {display_name} (NOT FOUND) ---\n[DEBUG INFO]\n- Resolved chunk identifier: {chunk_identifier}\n\n")
            except Exception as e:
                text_blocks.append(f"--- {display_name} (ERROR READING FILE: {str(e)})\n[Target URI: {chunk_identifier}]\n[Traceback: {traceback.format_exc()}] ---\n\n")
        header_str += generate_ascii_tree(resolved_files) + "\n\n"
        batch_repos = set()
        expanded_base_uris = set()
        for chunk in expanded_chunks:
            expanded_base_uris.add(chunk)
            chunk_uri = InSetuURI(chunk)
            if chunk_uri.scheme == 'ctx':
                base_uri_cand = re.sub(r'_part\d+\.txt$', '.txt', chunk)
                expanded_base_uris.add(base_uri_cand)
                entry = current_manifest.get(base_uri_cand, {})
                meta_item = entry.get("meta", {}) if isinstance(entry, dict) else {}
                item_repos = meta_item.get("repos") or ([meta_item.get("repo")] if meta_item.get("repo") else [])
                batch_repos.update(r for r in item_repos if r)
            else:
                repo_cand = chunk_uri.repo
                if repo_cand and repo_cand not in ('contexts', 'diffs', 'prompts', 'workflows'):
                    batch_repos.add(repo_cand)
        existing_entry = current_manifest.get(base_uri)
        chunks_exist_on_disk = ctx.is_context_on_disk(base_uri, existing_entry)

        # Skip recompiling clean batches if target_repos is specified AND the compiled chunks physically exist on disk
        if target_repos and not (batch_repos & set(target_repos)) and chunks_exist_on_disk:
            return base_uri, existing_entry

        # Incremental Speed Boost: Skip workflows that don't depend on the specific context/diffs that just changed
        chain_state = kwargs.get("chain_state", {})
        touched_buckets = chain_state.get("touched_buckets")
        touched_diffs = chain_state.get("touched_diffs")
        ledger_events = kwargs.get("ledger_events", [])

        if touched_buckets is not None and touched_diffs is not None and chunks_exist_on_disk:
            changed_deps = set(touched_buckets + touched_diffs)

            # Derive active repos from the event ledger
            active_repos = set()
            if target_repos:
                active_repos.update(target_repos)
            for e in ledger_events:
                fp = e.get("filepath", "") if isinstance(e, dict) else str(e)
                r = InSetuURI(fp).repo
                if r: active_repos.add(r)
            # If the batch includes raw VFS files from repositories that just triggered an event, assume they changed and recompile.
            has_targeted_raw_files = False
            for chunk in expanded_chunks:
                chunk_uri = InSetuURI(chunk)
                if chunk_uri.scheme == 'vfs':
                    repo_cand = chunk_uri.repo
                    if not active_repos or repo_cand in active_repos:
                        has_targeted_raw_files = True
                        break
            if not has_targeted_raw_files and not (expanded_base_uris & changed_deps):
                if os.environ.get("INSETU_DEBUG") == "1":
                    print(f"🌊 [FLOW TELEMETRY] ⏭️ Incremental Skip: Batch {batch_id} untouched and verified on disk. Preserving manifest entry.")
                return base_uri, existing_entry

        meta = {
            "type": "flow",
            "title": batch.get("title", batch_id),
            "domain": batch.get("domain", "Workflows"),
            "desc": "Compiled workflow batch payload.",
            "repos": sorted(list(batch_repos))
        }
        entry = ctx.compile_context(
            base_uri, header_str, text_blocks, resolved_files, meta
        )
        return base_uri, entry

    for b in context_batches:
        filename, entry = process_batch(b)
        if entry:
            manifest_deltas[filename] = entry
    ctx.reconcile_domain(
        domain_uri_prefix="ctx://workflows/workflow_",
        manifest_deltas=manifest_deltas,
        domain_dir="ctx://workflows",
        target_repos=target_repos
    )
    return {
        "message": "Workflows compiled successfully.",
        "artifact": {
            "step_id": "flow_workflows",
            "files": list(manifest_deltas.keys()),
            "cleared_buckets": ["global::workflows"],
            "touched_buckets": ["global::workflows"],
            "is_full_sweep": False
        }
    }
@flow_bp.route('batches', methods=['GET'], docstring="Retrieves compiled workflow batches and available contexts.")
def api_flow_batches(ctx):
    """Retrieves compiled workflow batches and available contexts."""
    mount_flow_volumes(workspace_id=ctx.workspace_id)
    batches = ctx.store.get("workflows.json", "context_batches", [])

    # Auto-migrate IDs to match titles to prevent legacy recursion
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

        # ERROR SURFACING & HEALING
        if not isinstance(b.get("includes"), list):
            print(f"⚠️ [Flow] Schema Error: Batch '{title}' is missing the 'includes' array. Auto-healing.")
            b["includes"] = []
            changed = True
        for array_field in ["show_if_exists", "show_if_missing"]:
            if array_field in b and not isinstance(b[array_field], list):
                print(f"⚠️ [Flow] Schema Error: Batch '{title}' has a malformed '{array_field}'. Auto-healing.")
                val = b[array_field]
                b[array_field] = [val] if val and isinstance(val, str) else []
                changed = True
        if _migrate_batch_uris(b):
            changed = True
    if changed:
        ctx.store.set("workflows.json", "context_batches", batches)
    all_batches = list(batches) + _discover_mounted_batches(ctx)
    paths = ctx.paths
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

    def _is_base(name):
        if not name or not isinstance(name, str): return False
        return not bool(re.search(r'_part\d+\.txt$', name))

    try:
        return jsonify({
            "batches": all_batches,
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
            basename = Path(original_response_path).name
            prefix = basename.split("{date}")[0]
            logical_target_dir = str(InSetuURI(filepath).parent).rstrip('/')
            archive_uri = InSetuURI(InSetuURI.canonicalize(archive_path))
            for walk_path in ctx.vfs.walk(logical_target_dir):
                walk_uri = InSetuURI(walk_path)
                if str(walk_uri.parent).rstrip('/') == logical_target_dir:
                    f_name = walk_uri.basename
                    if f_name.startswith(prefix):
                        dest_path = str(archive_uri.join(f_name))

                        content = ctx.vfs.read(walk_path)
                        if content is not None:
                            ctx.vfs.save(dest_path, content)
                            ctx.vfs.delete(walk_path, data={"ignore_ledger": True})
class FlowBatchSavePayload(TypedDict, total=False):
    id: str
    title: str
    domain: str
    includes: list
    original_id: Optional[str]
    show_if_exists: Optional[list]
    show_if_missing: Optional[list]
    include_prompt: Optional[str]
    response_path: Optional[str]
    archive_path: Optional[str]
@flow_bp.route('batches/save', methods=['POST'], request_schema=FlowBatchSavePayload, docstring="Creates or updates a workflow batch configuration.")
def api_flow_batches_save(ctx):
    """Creates or updates a workflow batch configuration."""
    raw_data = ctx.req.json or {}
    data = dict(raw_data)
    batches = ctx.store.get("workflows.json", "context_batches", [])
    original_id = data.pop("original_id", None)
    batch_id = data.get("id") or slugify(data.get("title", ""))
    if not batch_id:
        return jsonify({"error": "Batch id or title is required."}), 400
    data["id"] = batch_id

    existing = None
    if original_id:
        existing = next((b for b in batches if isinstance(b, dict) and b.get("id") == original_id), None)
    if not existing:
        existing = next((b for b in batches if isinstance(b, dict) and b.get("id") == batch_id), None)

    if existing:
        for optional_key in ["include_prompt", "response_path", "archive_path", "prompt_text", "show_if_exists", "show_if_missing"]:
            if optional_key in existing and optional_key not in data:
                del existing[optional_key]
        existing.update(data)
    else:
        batches.append(data)
    ctx.store.set("workflows.json", "context_batches", batches)

    mount_flow_volumes(workspace_id=ctx.workspace_id)
    # Backend-Driven Orchestration: Automatically trigger workflow compilation
    job_id = ctx.jobs.submit("compile_workflows_task", coalesce=True, job_category="ui_blocking")

    return jsonify({"status": "success", "job_id": job_id, "batch": data, "batches": batches, "manifest": ctx.manifest})
class FlowBatchDeletePayload(TypedDict):
    id: str
@flow_bp.route('batches/delete', methods=['POST'], request_schema=FlowBatchDeletePayload, docstring="Deletes a workflow batch configuration.")
def api_flow_batches_delete(ctx):
    """Deletes a workflow batch configuration."""
    data = ctx.req.json or {}
    batch_id = data.get("id")
    batches = ctx.store.get("workflows.json", "context_batches", [])
    updated_batches = [b for b in batches if isinstance(b, dict) and b.get("id") != batch_id]
    ctx.store.set("workflows.json", "context_batches", updated_batches)

    mount_flow_volumes(workspace_id=ctx.workspace_id)
    # Backend-Driven Orchestration: Automatically trigger workflow compilation
    job_id = ctx.jobs.submit("compile_workflows_task", coalesce=True, job_category="ui_blocking")

    return jsonify({"status": "success", "job_id": job_id, "batches": updated_batches, "manifest": ctx.manifest})