from pathlib import Path
import os
import json
from flask import jsonify
from insetu.core.sdk import InSetuExtension
from insetu.kernel.hooks import hooks
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

@hooks.on('vfs_mutated')
def on_vfs_mutated_flow(mutations=None, workspace_id=None, **kwargs):
    """Native event listener to intercept filesystem changes completely agnostic of Gather."""
    if not mutations: return
    from insetu.core.sdk import ExtensionContext
    ctx = ExtensionContext('flow', workspace_id)
    if "flow" not in ctx.config.get("extensions", []): return

    relevant_mutations = [m["filepath"] for m in mutations if m.get("filepath")]
    if not relevant_mutations: return
    ctx.jobs.submit("compile_flow_batches", coalesce=True, mutations=relevant_mutations)

@hooks.on('compile_contexts')
def on_compile_contexts_flow(manifest, workspace_id=None, **kwargs):
    """Delegates workflow batch generation to a background worker on Gather context updates."""
    from insetu.core.sdk import ExtensionContext
    ctx = ExtensionContext('flow', workspace_id)
    if "flow" not in ctx.config.get("extensions", []): return

    context_batches = ctx.store.get("workflows.json", "context_batches", [])
    if not context_batches: return

    is_full_sweep = kwargs.get('is_full_sweep')
    touched = kwargs.get('touched_buckets') or []
    target_repos = kwargs.get('target_repos') or []

    mutations = ["__FORCE_FULL_RECOMPILE__"] if is_full_sweep else list(touched)
    ctx.jobs.submit("compile_flow_batches", coalesce=True, mutations=mutations, target_repos=target_repos)

@hooks.on('git_evaluation_complete')
def on_git_eval_complete_flow(manifest=None, workspace_id=None, **kwargs):
    """Listens for Git diff generation updates and recompiles dependent workflow batches."""
    from insetu.core.sdk import ExtensionContext
    ctx = ExtensionContext('flow', workspace_id)
    if "flow" not in ctx.config.get("extensions", []): return

    context_batches = ctx.store.get("workflows.json", "context_batches", [])
    if not context_batches: return

    is_full_sweep = kwargs.get('is_full_sweep')
    touched = kwargs.get('touched_buckets') or []
    target_repos = kwargs.get('target_repos') or []

    touched_files = []
    for item in touched:
        if isinstance(item, dict):
            if item.get("filename"): touched_files.append(item["filename"])
        elif isinstance(item, str):
            touched_files.append(item)

    mutations = ["__FORCE_FULL_RECOMPILE__"] if is_full_sweep else touched_files
    ctx.jobs.submit("compile_flow_batches", coalesce=True, mutations=mutations, target_repos=target_repos)

@flow_bp.worker("compile_flow_batches")
def _background_compile_flow(ctx, mutations=None, target_repos=None, job_id=None):
    """Independent background worker for Flow that surgically recompiles only affected batches."""
    if not mutations and not target_repos: return
    context_batches = ctx.store.get("workflows.json", "context_batches", [])
    if not context_batches: return

    mutations = mutations or []
    target_repos = target_repos or []
    force_all = "__FORCE_FULL_RECOMPILE__" in mutations

    def normalize_item(item_str):
        clean = item_str.replace("system://", "").replace("\\", "/")
        return clean, Path(clean).name

    mutated_items = [normalize_item(m) for m in mutations if m != "__FORCE_FULL_RECOMPILE__"]
    mutated_repos = {clean.split('/')[0] for clean, _ in mutated_items if '/' in clean}
    for tr in target_repos:
        if isinstance(tr, str):
            mutated_repos.add(tr)

    compiled_count = 0
    for batch in context_batches:
        includes = batch.get("includes", [])
        needs_compile = force_all

        if not needs_compile:
            for inc in includes:
                inc_clean, inc_basename = normalize_item(inc)

                # 1. Direct or basename match against mutated items
                if any(m_clean == inc_clean or m_base == inc_basename for m_clean, m_base in mutated_items):
                    needs_compile = True
                    break

                # 2. Folder include match: e.g. if inc is a directory like "myrepo/src"
                inc_dir = inc_clean.rstrip('/') + '/'
                if any(m_clean.startswith(inc_dir) for m_clean, _ in mutated_items):
                    needs_compile = True
                    break

                # 3. Repo match: if inc is associated with a mutated repo
                inc_repo = inc_clean.split('/')[0] if '/' in inc_clean else None
                if inc_repo and inc_repo in mutated_repos:
                    needs_compile = True
                    break

                for r in mutated_repos:
                    from insetu.core.utils_core import get_safe_repo_id
                    safe_r = get_safe_repo_id(r)
                    if (inc_basename.startswith(f"{r}_") or inc_basename.startswith(f"{safe_r}_")) and ("_context.txt" in inc_basename or "_diffs.txt" in inc_basename):
                        needs_compile = True
                        break
                if needs_compile:
                    break

        if needs_compile:
            ctx.jobs.update_progress(f"Recompiling workflow batch: {batch.get('title', batch.get('id'))}...")
            compile_batch(batch, ctx.workspace_id)
            compiled_count += 1

    if compiled_count > 0:
        ctx.jobs.update_progress(f"Successfully recompiled {compiled_count} workflow(s).")
        ctx.sync_vfs_barrier()
def compile_batch(batch, workspace_id=None, manifest_data=None):
    from insetu.core.sdk import ExtensionContext
    ctx = ExtensionContext('flow', workspace_id)

    batch_id = batch.get("id")
    if not batch_id: return
    includes = batch.get("includes", [])
    out_path = Path(ctx.paths["gather_dir"]).joinpath(f"workflow_{batch_id}_context.txt").as_posix()

    is_standalone_compile = manifest_data is None
    if is_standalone_compile:
        manifest_data = ctx.manifest

    from insetu.core.gather.engine_gather import compile_context_payload
    header_str = f"========== BATCH: {batch.get('title', batch_id)} ==========\n\n"
    text_blocks = []
    resolved_files = []
    # Expand directories into explicit file paths before we enter the compilation matrix
    expanded_includes = []
    for inc in includes:
        if inc.startswith("system://"):
            expanded_includes.append(inc)
        else:
            inc_path = ctx.resolve_path(inc)
            if os.path.isdir(inc_path) and not inc.endswith('.txt'):
                for f in ctx.vfs.walk(inc):
                    expanded_includes.append(f)
            else:
                expanded_includes.append(inc)
    try:
        for inc in expanded_includes:
            basename = Path(inc).name
            chunks = []
            if manifest_data and basename in manifest_data:
                entry = manifest_data[basename]
                if isinstance(entry, dict) and "chunks" in entry and isinstance(entry["chunks"], list):
                    chunks = entry["chunks"]
            if not chunks:
                chunks = [inc]

            is_system_uri = inc.startswith("system://")
            is_diff_target = is_system_uri and "diffs/" in inc
            is_prompt_target = is_system_uri and "prompts/" in inc
            is_context_target = is_system_uri and "contexts/" in inc

            # Legacy fallback for older batches before the system:// protocol migration
            if not is_system_uri:
                is_diff_target = "diffs/" in inc or basename.endswith("_diffs.txt")
                is_prompt_target = "prompts/" in inc
                is_context_target = "contexts/" in inc or basename.endswith("_context.txt")

            for chunk_identifier in chunks:
                safe_chunk_base = Path(chunk_identifier).name
                display_name = f"{Path(inc).parent.as_posix()}/{safe_chunk_base}" if (chunk_identifier != inc and "/" in inc) else chunk_identifier

                if is_prompt_target or (chunk_identifier.startswith("system://prompts/") or "prompts/" in chunk_identifier):
                    inc_path = Path(ctx.paths["prompts_dir"]).joinpath(safe_chunk_base).as_posix()
                elif is_diff_target or (chunk_identifier.startswith("system://diffs/") or "diffs/" in chunk_identifier or safe_chunk_base.endswith("_diffs.txt") or "_diffs_part" in safe_chunk_base):
                    inc_path = Path(ctx.paths["diffs_dir"]).joinpath(safe_chunk_base).as_posix()
                elif is_context_target or (chunk_identifier.startswith("system://contexts/") or "contexts/" in chunk_identifier or safe_chunk_base.endswith("_context.txt") or "_context_part" in safe_chunk_base):
                    inc_path = Path(ctx.paths["contexts_dir"]).joinpath(safe_chunk_base).as_posix()
                else:
                    clean_inc = inc.replace("system://", "") if inc.startswith("system://") else inc
                    inc_path = ctx.resolve_path(clean_inc)
                    if not os.path.exists(inc_path):
                        inc_path = Path(ctx.paths["artifacts_base"]).joinpath(clean_inc).as_posix()

                try:
                    content = ctx.vfs.read(inc_path, is_absolute_artifact=True)
                    if content is not None:
                        text_blocks.append(f"--- {display_name} ---\n{content}\n\n")
                        resolved_files.append(display_name)
                    elif is_diff_target or "diffs/" in chunk_identifier or safe_chunk_base.endswith("_diffs.txt"):
                        text_blocks.append(f"--- {display_name} (NO PENDING DIFFS) ---\n[Working tree clean. No uncommitted changes detected.]\n\n")
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
                            parent = Path(inc_path).parent.as_posix()
                            verbose_debug += f"- Parent exists?: {os.path.exists(parent)}\n"
                            if os.path.exists(parent):
                                verbose_debug += f"- Parent contents (first 10): {os.listdir(parent)[:10]}\n"
                        if manifest_data and basename in manifest_data:
                            verbose_debug += f"- Manifest chunks: {manifest_data[basename].get('chunks', 'None')}\n"
                        verbose_debug += "\n\n"
                        text_blocks.append(verbose_debug)
                except Exception as e:
                    import traceback
                    text_blocks.append(f"--- {display_name} (ERROR READING FILE: {str(e)})\n[Target Path: {inc_path}]\n[Traceback: {traceback.format_exc()}] ---\n\n")
        repos = list(set([r.split('/')[0] for r in resolved_files if '/' in r]))
        meta = {
            "type": "flow",
            "title": batch.get("title", batch_id),
            "domain": batch.get("domain", "Workflows"),
            "desc": f"Compiled workflow batch payload.",
            "repos": repos
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
    context_batches = ctx.store.get("workflows.json", "context_batches", [])
    for b in context_batches:
        if b["id"] == batch_id and "artifacts" in b:
            del b["artifacts"]
            ctx.store.set("workflows.json", "context_batches", context_batches)
            break
@flow_bp.route('batches', methods=['GET'])
def api_flow_batches(ctx):
    batches = ctx.store.get("workflows.json", "context_batches", [])
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
    # Strip out chunk/part files so the UI only displays base topology roots
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
        print(f"⚠️ [Flow Error] api_flow_batches failed: {e}")
        return jsonify({"error": str(e)}), 500
@hooks.on('pre_file_save')
def handle_flow_pre_save(workspace_id=None, filepath=None, content=None, data=None, **kwargs):
    if data:
        archive_path = data.get("archive_path")
        original_response_path = data.get("original_response_path")
        if archive_path and original_response_path and "{date}" in original_response_path:
            import os
            from pathlib import Path
            from insetu.core.sdk import ExtensionContext
            ctx = ExtensionContext('flow', workspace_id)

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

                        # Route the move operation through the async VFS queue
                        content = ctx.vfs.read(src_path, is_absolute_artifact=True)
                        if content is not None:
                            ctx.vfs.save(dest_path, content, data={"is_absolute_artifact": True})
                            ctx.vfs.save(src_path, "", data={"action": "delete", "ignore_ledger": True, "is_absolute_artifact": True})

@flow_bp.route('batches/save', methods=['POST'])
def api_flow_batches_save(ctx):
    data = ctx.req.json
    batches = ctx.store.get("workflows.json", "context_batches", [])
    batch_id = data.get("id")
    existing = next((b for b in batches if b["id"] == batch_id), None)
    if existing:
        for optional_key in ["include_prompt", "response_path", "prompt_text", "show_if_exists", "show_if_missing"]:
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

    return jsonify({"status": "success", "manifest": ctx.manifest})
@flow_bp.route('batches/delete', methods=['POST'])
def api_flow_batches_delete(ctx):
    data = ctx.req.json
    batch_id = data.get("id")
    batches = ctx.store.get("workflows.json", "context_batches", [])
    ctx.store.set("workflows.json", "context_batches", [b for b in batches if b.get("id") != batch_id])
    try:
        manifest_data = ctx.manifest
        manifest_key = f"workflow_{batch_id}_context.txt"
        chunks = []
        if manifest_key in manifest_data:
            chunks = manifest_data[manifest_key].get("chunks", [manifest_key])
            del manifest_data[manifest_key]
            ctx.save_manifest(manifest_data)

        if not chunks:
            chunks = [manifest_key]

        for chunk_file in chunks:
            out_path = Path(ctx.paths["gather_dir"]).joinpath(chunk_file).as_posix()
            ctx.vfs.save(out_path, "", data={"action": "delete", "ignore_ledger": True})
    except Exception:
        pass

    return jsonify({"status": "success", "manifest": ctx.manifest})