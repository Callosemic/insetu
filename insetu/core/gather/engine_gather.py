from pathlib import Path
import os
import json
import datetime
import subprocess
from flask import jsonify
from insetu.kernel.utils import get_workspace_physics, generate_ascii_tree
from insetu.core.utils_core import get_valid_workspace_files, evaluate_circuit_breaker
from insetu.kernel.extension import InSetuExtension
from insetu.kernel.hooks import hooks
SCRIPT_DIR = Path(__file__).resolve().parent.as_posix()

GATHER_SETTINGS_SCHEMA = [
    {
        "id": "max_context_size_kb",
        "label": "Max Context Size (KB)",
        "type": "number",
        "default": 0,
        "description": "Set to 0 to disable chunking. Context files exceeding this limit will be cleanly split into numbered parts."
    }
]
gather_bp = InSetuExtension('gather', __name__, core=True, settings_schema=GATHER_SETTINGS_SCHEMA)
__depends__ = []

@hooks.on('vfs_resolve_file')
def resolve_gather_artifacts(filename=None, workspace_id=None, **kwargs):
    """Resolves system://contexts and system://gather URIs and fallback searches."""
    if not filename: return None
    from insetu.core.sdk import ExtensionContext
    from pathlib import Path
    import os
    ctx = ExtensionContext('gather', workspace_id)

    safe_basename = Path(filename).name
    search_dirs = [ctx.paths["contexts_dir"], ctx.paths["gather_dir"]]

    for d in search_dirs:
        cand = Path(d).joinpath(safe_basename).as_posix()
        if os.path.exists(cand):
            return cand, True
    return None
from insetu.kernel.hooks import hooks
from insetu.core.utils_core import resolve_file_bucket

def compile_context_payload(workspace_id, output_dir, base_filename, header_block, text_blocks, files, meta, max_kb=None):
    """Universal compiler for all system contexts (Gather, Git, Flow)."""
    from insetu.kernel.vfs import VFSTransaction
    from insetu.kernel.extension import ExtensionContext

    if max_kb is None:
        ctx = ExtensionContext('gather', workspace_id)
        max_kb = ctx.settings.get("max_context_size_kb", 0)

    vfs = VFSTransaction(workspace_id)
    max_bytes = (max_kb * 1024) if max_kb and max_kb > 0 else float('inf')
    current_chunk = 1
    chunks = []

    def get_chunk_name(chunk_num):
        if chunk_num == 1: return base_filename
        base, ext = os.path.splitext(base_filename)
        return f"{base}_part{chunk_num}{ext}"
    header_bytes = len(header_block.encode('utf-8'))
    bins = [{"size": header_bytes, "content": header_block}]

    for block in text_blocks:
        block_bytes = len(block.encode('utf-8'))
        placed = False

        # First Fit: Try to slot into any existing open chunk
        for b in bins:
            if b["size"] + block_bytes <= max_bytes:
                b["content"] += block
                b["size"] += block_bytes
                placed = True
                break

        # If it overflows all current chunks, open a new one
        if not placed:
            new_idx = len(bins) + 1
            new_header = header_block + f"=== (CONTINUED - PART {new_idx}) ===\n\n"
            bins.append({
                "size": len(new_header.encode('utf-8')) + block_bytes,
                "content": new_header + block
            })
    chunk_sizes = []
    for i, b in enumerate(bins):
        chunk_name = get_chunk_name(i + 1)
        chunk_path = Path(output_dir).joinpath(chunk_name).as_posix()
        vfs.save(chunk_path, b["content"], data={"is_absolute_artifact": True})
        chunks.append(chunk_name)
        chunk_sizes.append(b["size"])
    meta_copy = meta.copy()
    if "type" not in meta_copy:
        meta_copy["type"] = "gather"

    manifest_entry = {
        "files": files,
        "chunks": chunks,
        "meta": meta_copy
    }
    manifest_entry["meta"]["size_bytes"] = sum(chunk_sizes)
    manifest_entry["meta"]["chunk_sizes"] = chunk_sizes
    manifest_entry["meta"]["file"] = base_filename
    manifest_entry["meta"]["filename"] = base_filename
    manifest_entry["meta"]["filepath"] = base_filename
    manifest_entry["meta"]["out_file"] = base_filename
    return manifest_entry
def write_bucket(output_path, filepaths, title, domain_str, repo_path, repo_dir, workspace_id=None, max_kb=None):
    if not filepaths: return []
    from insetu.kernel.vfs import VFSTransaction
    vfs = VFSTransaction(workspace_id)

    header_str = "="*60 + f"\nINSETU TOPOLOGY ({title})\n" + "="*60 + "\n" + generate_ascii_tree(filepaths) + "\n\n"
    text_blocks = []

    for filepath in filepaths:
        try:
            content = vfs.read(f"{repo_dir}/{filepath}")
            if content is not None:
                text_blocks.append(f"\n\n{'='*60}\n>>>NEW FILE :: {repo_dir}/{filepath} | {domain_str}\n{'='*60}\n\n{content}")
        except Exception as e:
            print(f"Skipping {filepath}: {e}")


    output_dir = Path(output_path).parent.as_posix()
    base_filename = Path(output_path).name
    manifest_entry = compile_context_payload(
        workspace_id, output_dir, base_filename, header_str, text_blocks, 
        [f"{repo_dir}/{f}" for f in filepaths], 
        {"title": title, "domain": domain_str, "desc": f"Context payload for {title}.", "repo": repo_dir}, 
        max_kb=max_kb
    )
    return manifest_entry
def _compile_repo_buckets(config, paths, workspace_id, manifest_ref, touched_buckets=None):
    from insetu.kernel.extension import ExtensionContext
    from insetu.core.utils_core import get_valid_workspace_files, get_safe_repo_id

    ctx = ExtensionContext('gather', workspace_id)
    safe_r_dir = get_safe_repo_id(config.get("repo_dir"))
    max_kb = config.get("max_context_size_kb", ctx.settings.get("max_context_size_kb", 0))
    physical_path = config.get("physical_path")

    if physical_path:
        repo_path = os.path.abspath(os.path.expanduser(physical_path))
    else:
        repo_path = ctx.resolve_path(config["repo_dir"])

    if not os.path.exists(repo_path): return False

    final_list = get_valid_workspace_files(repo_path, config, workspace_id) or []
    archive_type = config.get("archive_type", "repo")
    if archive_type == "media-vault":
        if touched_buckets is None or f"{config['repo_dir']}_vault.json" in touched_buckets:
            if final_list:
                r_title = config.get("title", config["repo_dir"].replace('-', ' ').title())
                manifest_ref[f"{config['repo_dir']}_vault.json"] = {
                    "files": [f"{config['repo_dir']}/{f}" for f in final_list],
                    "meta": {"title": r_title, "domain": config.get("domain", "Media Vault"), "desc": config.get("description", "Media vault assets.")}
                }
            else:
                if f"{config['repo_dir']}_vault.json" in manifest_ref:
                    del manifest_ref[f"{config['repo_dir']}_vault.json"]
        return True
    dirty = False
    sub_buckets = config.get("sub_buckets", [])
    if sub_buckets:
        buckets = {b["id"]: {"files": [], "cfg": b} for b in sub_buckets if not b.get("dynamic_split_prefix")}
        dynamic_files = {}

        for filepath in final_list:
            b, module = resolve_file_bucket(filepath, sub_buckets)
            if b and module:
                if module not in dynamic_files: dynamic_files[module] = {"files": [], "cfg": b}
                dynamic_files[module]["files"].append(filepath)
            elif b:
                buckets[b["id"]]["files"].append(filepath)
            else:
                if "default_catch_all" not in buckets:
                    buckets["default_catch_all"] = {
                        "files": [], "cfg": {
                            "id": "catch_all", "title": config.get("title", config["repo_dir"]), 
                            "domain": config.get("domain", "Workspaces"), 
                            "out_file": config.get("out_file", f"{safe_r_dir}_context.txt")
                        }
                    }
                buckets["default_catch_all"]["files"].append(filepath)

        active_bucket_outputs = set()
        active_dynamic_outputs = set()

        for b_id, data in buckets.items():
            safe_out = data["cfg"].get("out_file", f"{safe_r_dir}_{b_id}_context.txt")
            if touched_buckets is None or safe_out in touched_buckets:
                if data["files"]:
                    active_bucket_outputs.add(safe_out)
                    b_title = data["cfg"].get("title", b_id.replace('_', ' ').title())
                    b_domain = data["cfg"].get("domain", config.get("domain", "Workspaces"))
                    b_desc = data["cfg"].get("description", f"Context payload for {b_title}.")
                    out_path = Path(paths["contexts_dir"]).joinpath(safe_out).as_posix()
                    manifest_entry = write_bucket(out_path, data["files"], b_title.upper(), b_domain, repo_path, config['repo_dir'], workspace_id, max_kb=max_kb)
                    manifest_ref[safe_out] = manifest_entry
                    dirty = True
                else:
                    if safe_out in manifest_ref:
                        del manifest_ref[safe_out]
                        dirty = True
                        out_path = Path(paths["contexts_dir"]).joinpath(safe_out).as_posix()
                        if os.path.exists(out_path):
                            try: os.remove(out_path)
                            except Exception: pass

        for module, data in dynamic_files.items():
            out_name = f"{module}_context.txt"
            if touched_buckets is None or out_name in touched_buckets:
                if data["files"]:
                    active_dynamic_outputs.add(out_name)
                    c = data["cfg"]
                    meta_map = c.get("meta_map", {})
                    meta = meta_map.get(module, {})
                    title = meta.get("title", module.replace('_', ' ').title())
                    domain = meta.get("domain", c.get("domain", "Dynamic Modules"))
                    desc = meta.get("description", c.get("description", f"Dynamically mapped logic and templates for {title}."))
                    out_path = Path(paths["contexts_dir"]).joinpath(out_name).as_posix()
                    manifest_entry = write_bucket(out_path, data["files"], title.upper(), domain, repo_path, config['repo_dir'], workspace_id, max_kb=max_kb)
                    manifest_ref[out_name] = manifest_entry
                    dirty = True
        if touched_buckets:
            for touched_b in touched_buckets:
                if touched_b.endswith('_context.txt') and touched_b not in active_bucket_outputs and touched_b not in active_dynamic_outputs:
                    if touched_b in manifest_ref:
                        del manifest_ref[touched_b]
                        dirty = True
                        out_path = Path(paths["contexts_dir"]).joinpath(touched_b).as_posix()
                        if os.path.exists(out_path):
                            try: os.remove(out_path)
                            except Exception: pass

        # Forcefully suppress the overall repo-level context if a catch-all is designated
        if any(b.get("is_catch_all") for b in sub_buckets):
            overall_out = config.get("out_file", f"{safe_r_dir}_context.txt")
            if overall_out in manifest_ref:
                del manifest_ref[overall_out]
                dirty = True
                out_path = Path(paths["contexts_dir"]).joinpath(overall_out).as_posix()
                if os.path.exists(out_path):
                    try: os.remove(out_path)
                    except Exception: pass
    else:
        safe_out = config.get("out_file", f"{safe_r_dir}_context.txt")
        if touched_buckets is None or safe_out in touched_buckets:
            r_title = config.get("title", config["repo_dir"].replace('-', ' ').title())
            r_domain = config.get("domain", "Workspaces")
            r_desc = config.get("description", f"Context payload for {r_title}.")
            out_path = Path(paths["contexts_dir"]).joinpath(safe_out).as_posix()

            if final_list:
                manifest_entry = write_bucket(out_path, final_list, r_title, r_domain, repo_path, config['repo_dir'], workspace_id, max_kb=max_kb)
                manifest_ref[safe_out] = manifest_entry
                dirty = True
            else:
                if safe_out in manifest_ref:
                    del manifest_ref[safe_out]
                    dirty = True
                    if os.path.exists(out_path):
                        try: os.remove(out_path)
                        except Exception: pass

    return dirty
from insetu.kernel.hooks import hooks

def _process_vfs_ledger(workspace_id="default"):
    from insetu.kernel.db import get_connection
    import time
    db_conn = get_connection("workers", workspace_id=workspace_id)

    cursor = db_conn.execute("SELECT MAX(timestamp) as last_mut FROM vfs_event_log")
    row = cursor.fetchone()
    if not row or not row['last_mut']:
        return
    last_mut = row['last_mut']
    now = time.time()
    # Macro Slew Limiter: 15.0-second silence window to balance batching with UI responsiveness
    if now - last_mut < 15.0:
        return

    events = db_conn.execute("SELECT filepath, mutation_type FROM vfs_event_log").fetchall()
    if not events: return

    # Clear processed events
    db_conn.execute("DELETE FROM vfs_event_log WHERE timestamp <= ?", (last_mut,))
    db_conn.commit()
    # Decouple Cartographer: Run asynchronously so it doesn't block the background Context Gatherer
    touched_repos = list(set(e["filepath"].split('/')[0] for e in events if '/' in e["filepath"]))
    import uuid, json
    from insetu.kernel.workers import submit_immediate_job

    if touched_repos:
        cart_job_id = f"crt_{uuid.uuid4().hex[:8]}"
        submit_immediate_job(cart_job_id, "cartographer", "map_task", json.dumps({"target_repos": touched_repos}), workspace_id=workspace_id)

    job_id = f"cmp_{uuid.uuid4().hex[:8]}"
    args_json = json.dumps({
        "force_full": False, 
        "ledger_events": [{"filepath": e["filepath"], "mutation_type": e["mutation_type"]} for e in events]
    })
    # Dispatch to the UI-visible Job Queue for processing
    submit_immediate_job(job_id, "gather", "compile_contexts", args_json, workspace_id=workspace_id)
from insetu.kernel.workers import register_callback
register_callback("gather", "process_vfs_ledger", _process_vfs_ledger)
import time
SYSTEM_BOOT_TIME = time.time()
@hooks.on('system_boot', priority=90)
def init_gather_workers():
    from insetu.kernel.utils import get_all_workspace_ids
    for ws_id in get_all_workspace_ids():
        from insetu.kernel.extension import ExtensionContext
        import uuid, json
        from pathlib import Path
        from insetu.kernel.utils import load_json_file

        w_ctx = ExtensionContext('workers', ws_id)
        conn = w_ctx.db
        conn.execute("""
            INSERT OR REPLACE INTO jobs (id, ext_name, callback_name, interval_ms, jitter_ms, next_run_at, status, args_json)
            VALUES ('sys_vfs_ledger_daemon', 'gather', 'process_vfs_ledger', 1000, 0, 0, 'pending', '{}')
        """)
        conn.commit()

        # Boot-Time Heuristic: Offline Mutation Guard (Tier 2 Physics)
        ctx = ExtensionContext('gather', ws_id)
        contexts_dir = ctx.paths.get("contexts_dir")
        if contexts_dir:
            cache_path = Path(contexts_dir).joinpath("manifest_cache.json").as_posix()
            cache_data = load_json_file(cache_path, {})
            last_compile = cache_data.get("last_full_compile_time", 0)
            if SYSTEM_BOOT_TIME > last_compile:
                job_id = f"cmp_{uuid.uuid4().hex[:8]}"
                args_json = json.dumps({"force_full": True})
                from insetu.kernel.workers import submit_immediate_job, update_immediate_job_status
                submit_immediate_job(job_id, "gather", "compile_contexts", args_json, workspace_id=ws_id)
                update_immediate_job_status(job_id, 'processing', 'Healing offline mutations...', workspace_id=ws_id)
@hooks.on('gather_settings_updated')
def on_gather_settings_updated(workspace_id=None, **kwargs):
    from insetu.kernel.workers import submit_immediate_job
    import uuid, json
    job_id = f"cmp_{uuid.uuid4().hex[:8]}"
    submit_immediate_job(job_id, "gather", "compile_contexts", json.dumps({"force_full": True}), workspace_id=workspace_id)
    return {"job_id": job_id}
def get_available_contexts(workspace_id=None, exclusion_flags=None, exclude_types=None, include_types=None):
    from insetu.kernel.utils import load_config, load_json_file
    from insetu.kernel.extension import ExtensionContext
    from insetu.core.utils_core import get_safe_repo_id
    cfg = load_config(workspace_id)
    ctx = ExtensionContext('gather', workspace_id)
    paths = ctx.paths
    flags = [exclusion_flags] if isinstance(exclusion_flags, str) else (exclusion_flags or [])
    expected_contexts = set()

    for c in cfg.get("target_repos", []):
        repo_excluded = any(c.get(flag) for flag in flags)
        r_dir = c.get("repo_dir", "")
        safe_r_dir = get_safe_repo_id(r_dir)
        subs = c.get("sub_buckets", [])

        if not repo_excluded and not any(b.get("is_catch_all") for b in subs):
            out = c.get("out_file", f"{safe_r_dir}_context.txt")
            expected_contexts.add(f"contexts/{out}")

        if subs:
            for b in subs:
                if repo_excluded or any(b.get(flag) for flag in flags):
                    continue
                if not b.get("dynamic_split_prefix"):
                    sub_out = b.get("out_file", f"{r_dir}_{b.get('id')}_context.txt")
                    expected_contexts.add(f"contexts/{sub_out}")
                else:
                    dyn_dir = Path(paths["workspace_root"]).joinpath(r_dir, b["dynamic_split_prefix"]).as_posix()
                    if os.path.exists(dyn_dir):
                        for module in os.listdir(dyn_dir):
                            if os.path.isdir(Path(dyn_dir).joinpath(module).as_posix()) and not module.startswith('.'):
                                expected_contexts.add(f"contexts/{module}_context.txt")
    manifest_path = Path(paths["contexts_dir"]).joinpath("manifest.json").as_posix()
    manifest_data = load_json_file(manifest_path, {})

    for k, v in manifest_data.items():
        if isinstance(k, str) and k.endswith('.txt') and isinstance(v, dict):
            item_type = v.get("meta", {}).get("type", "unknown")
            if exclude_types and item_type in exclude_types:
                continue
            if include_types and item_type not in include_types:
                continue
            expected_contexts.add(f"contexts/{k}")

    return expected_contexts

@hooks.on('vfs_search')
def hook_vfs_search(workspace_id=None, query=None, **kwargs):
    if not query: return []
    terms = [t for t in query.split() if t]
    if not terms: return []

    import json
    from insetu.kernel.extension import ExtensionContext
    from insetu.core.utils_core import extract_manifest_files, resolve_logical_path
    ctx = ExtensionContext('gather', workspace_id)
    manifest_path = Path(ctx.paths["contexts_dir"]).joinpath("manifest.json").as_posix()
    md_files = set()
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r', encoding='utf-8') as f:
            try:
                manifest = json.load(f)
                for filepath in extract_manifest_files(manifest):
                    if filepath.lower().endswith('.md'):
                        md_files.add(filepath)
            except Exception:
                pass
    results = []
    for filepath in md_files:
        abs_path = resolve_logical_path(filepath, workspace_id)
        if not os.path.exists(abs_path): continue
        try:
            with open(abs_path, 'r', encoding='utf-8') as f:
                content = f.read()

            content_lower = content.lower()
            score = 0
            snippet = ""
            file_lower = filepath.lower()

            for term in terms:
                if term in file_lower: score += 2
                if term in content_lower: score += 1

            if score > 0:
                first_term = next((t for t in terms if t in content_lower), None)
                if first_term:
                    idx = content_lower.find(first_term)
                    start = max(0, idx - 30)
                    end = min(len(content), idx + 70)
                    snippet = content[start:end].replace('\n', ' ').strip()
                results.append({"path": filepath, "score": score, "snippet": snippet})
        except Exception:
            pass
    return results

def _surgically_update_manifest(workspace_id=None, files=None, filepath=None, **kwargs):
    """Surgically regenerates context payloads and updates the manifest only for touched buckets."""
    if not files and not filepath: return
    if filepath: files = [filepath]

    with get_compiler_lock(workspace_id or "default"):
        from insetu.kernel.extension import ExtensionContext
        from insetu.kernel.utils import load_json_file, save_json_file
        from insetu.core.utils_core import get_safe_repo_id
        ctx = ExtensionContext('gather', workspace_id)
        paths = ctx.paths
        manifest = ctx.manifest
        cfg = ctx.config

        affected_repos = set()
        for f in files:
            parts = f.split('/', 1)
            if len(parts) > 0: affected_repos.add(parts[0])
        dirty = False
        all_touched_buckets = set()
        # --- Bucket Ratio Circuit Breaker ---
        total_known_buckets = len(get_available_contexts(workspace_id, exclusion_flags=["exclude_from_context"]))
        total_touched_count = 0

        for repo_dir in affected_repos:
            repo_cfg = next((r for r in cfg.get("target_repos", []) if r.get("repo_dir") == repo_dir), None)
            if not repo_cfg: continue

            # Ensure custom extension payloads (like prompts) still trigger compilation hooks
            if repo_cfg.get("exclude_from_context"):
                dirty = True
                continue

            safe_r_dir = get_safe_repo_id(repo_dir)
            sub_buckets = repo_cfg.get("sub_buckets", [])
            touched_buckets = set()

            # Identify exactly which buckets the incoming files affect
            for filepath in files:
                if not filepath.startswith(repo_dir + '/'): continue
                rel_path = filepath[len(repo_dir)+1:]

                if sub_buckets:
                    b, module = resolve_file_bucket(rel_path, sub_buckets)
                    if b and module:
                        touched_buckets.add(f"{module}_context.txt")
                    elif b:
                        touched_buckets.add(b.get("out_file", f"{safe_r_dir}_{b['id']}_context.txt"))
                    else:
                        touched_buckets.add(repo_cfg.get("out_file", f"{safe_r_dir}_context.txt"))
                else:
                    touched_buckets.add(repo_cfg.get("out_file", f"{safe_r_dir}_context.txt"))
            all_touched_buckets.update(touched_buckets)
            total_touched_count += len(touched_buckets)
            # Circuit Breaker Evaluation
            if evaluate_circuit_breaker(total_touched_count, total_known_buckets, threshold=0.5):
                print(f"⚠️ Circuit Breaker Tripped: {total_touched_count}/{total_known_buckets} buckets touched. Promoting to Full Sweep.")
                generate_context_file(workspace_id=workspace_id, target_repos=list(affected_repos))
                # Ledger wipe handled natively by the full sweep pipeline
                return

            # Compile ONLY the touched buckets for this repo using the DRY helper
            if _compile_repo_buckets(repo_cfg, paths, workspace_id, manifest, touched_buckets):
                dirty = True
        if dirty:
            # Note: Ledger wipe is handled in Phase 3 once Gather fully owns the event loop.
            ctx.sync_vfs_barrier()

            hooks.emit('compile_contexts', manifest=manifest, workspace_id=workspace_id, target_repos=list(affected_repos), touched_buckets=list(all_touched_buckets), is_full_sweep=False)
            ctx.save_manifest(manifest)
def generate_context_file(workspace_id=None, target_repos=None):
    from insetu.kernel.extension import ExtensionContext
    import concurrent.futures

    ctx = ExtensionContext('gather', workspace_id)
    paths = ctx.paths
    # Pre-flight purge: destroy all stale contexts to prevent ghost files (excluding active ephemerals)
    from insetu.kernel.db import get_connection
    w_conn = get_connection("workers", workspace_id=workspace_id)
    w_conn.execute("""
        CREATE TABLE IF NOT EXISTS ephemeral_artifacts (
            id TEXT PRIMARY KEY,
            filepath TEXT,
            module_owner TEXT,
            created_at REAL,
            expires_at REAL
        )
    """)
    w_conn.commit()
    active_ephemerals = [row['filepath'] for row in w_conn.execute("SELECT filepath FROM ephemeral_artifacts").fetchall()]
    from insetu.kernel.vfs import VFSTransaction
    vfs = VFSTransaction(workspace_id)
    live_cfg = ctx.config
    manifest = {} if target_repos is None else ctx.manifest

    target_configs = [
        config for config in live_cfg.get("target_repos", [])
        if not config.get("exclude_from_context") and (not target_repos or config.get("repo_dir") in target_repos)
    ]

    def process_single_repo(config):
        local_manifest = {}
        _compile_repo_buckets(config, paths, workspace_id, local_manifest)
        return local_manifest

    # ThreadPoolExecutor parallelizes file reads and text formatting across sister repositories
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(process_single_repo, config) for config in target_configs]
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res:
                manifest.update(res)
    # Save Gather contexts to disk first so manifest SSOT contains base contexts before hooks
    ctx.save_manifest(manifest, is_full_compile=(target_repos is None))

    # --- EXTENSION HOOKS ---
    from insetu.kernel.hooks import hooks
    ctx.sync_vfs_barrier()

    sweep_payload = True if target_repos is None else target_repos
    hooks.emit('compile_contexts', manifest=manifest, workspace_id=workspace_id, is_full_sweep=sweep_payload)
    # Set Analysis: Prune only orphaned context files that were not regenerated
    if target_repos is None:
        valid_basenames = set(manifest.keys())
        for chunk in ctx.get_manifest_files():
            valid_basenames.add(chunk)
        for ws_rel_path in vfs.walk(paths["contexts_dir"]):
            f_path = ctx.resolve_path(ws_rel_path)
            f_basename = Path(f_path).name
            if f_path not in active_ephemerals and f_basename not in valid_basenames and f_basename != "manifest.json":
                try:
                    from insetu.kernel.vfs import execute_vfs_delete
                    execute_vfs_delete(workspace_id, ws_rel_path)
                except Exception:
                    pass
    # Re-inject surviving Ephemeral Artifacts into the manifest so they persist through background compiles
    old_manifest = ctx.manifest
    restored_ephemerals = set()

    for k, v in old_manifest.items():
        if v.get("meta", {}).get("domain") in ("Quickpacks", "Exported Contexts"):
            base_path = Path(paths["contexts_dir"]).joinpath(k).as_posix()
            if base_path in active_ephemerals:
                manifest[k] = v
                for chunk in ctx.get_manifest_files(target_key=k):
                    chunk_path = Path(paths["contexts_dir"]).joinpath(chunk).as_posix()
                    restored_ephemerals.add(chunk_path)
    for f_path in active_ephemerals:
        if f_path.startswith(paths["contexts_dir"]) and f_path not in restored_ephemerals:
            f_name = Path(f_path).name
            size_bytes = os.path.getsize(f_path) if os.path.exists(f_path) else 0
            is_quickpack = f_name.startswith(('quickpack_', 'selection_'))
            domain_name = "Quickpacks" if is_quickpack else "Exported Contexts"
            title_name = "⚡ Quickpack" if is_quickpack else f"📦 {f_name.replace('.txt','')}"
            manifest[f_name] = {
                "files": [f"data/contexts/{f_name}"],
                "meta": {"type": "gather", "title": title_name, "domain": domain_name, "desc": "Ephemeral context payload.", "size_bytes": size_bytes}
            }

    # Save complete merged manifest to disk
    ctx.save_manifest(manifest, is_full_compile=(target_repos is None))
    ctx.sync_vfs_barrier()
@gather_bp.worker("pack_selection_task")
def _pack_selection_worker(ctx, items, job_id=None):
    ctx.jobs.update_progress("Compiling selected files into context payload...")
    from insetu.kernel.utils import generate_ascii_tree
    from insetu.kernel.vfs import VFSTransaction
    import time
    import os
    from pathlib import Path
    if not items:
        raise ValueError("No items provided.")
    files = ctx.expand_selection(items)

    header_str = "============================================================\n"
    header_str += "INSETU AD-HOC CONTEXT PAYLOAD (Selection)\n"
    header_str += "============================================================\n\n"
    header_str += generate_ascii_tree(files) + "\n\n"
    text_blocks = []
    with VFSTransaction(ctx.workspace_id) as vfs:
        for filepath in files:
            try:
                is_artifact = False
                read_path = filepath
                # Deterministic Virtual URI Routing
                if filepath.startswith("system://"):
                    parts = filepath.replace("system://", "").split("/")
                    bucket = parts[0]
                    filename = parts[-1]

                    # Programmatically resolve the bucket by matching the directory name against registered OS paths
                    target_dir = next((p for p in ctx.paths.values() if isinstance(p, str) and p.endswith(f"/{bucket}")), ctx.paths["artifacts_base"])
                    read_path = Path(target_dir).joinpath(filename).as_posix()
                    is_artifact = True
                elif filepath.startswith(".insetu/"):
                    is_artifact = True
                elif filepath.startswith("data/"):
                    read_path = Path(ctx.paths["control_dir"]).joinpath(filepath).as_posix()
                    is_artifact = True

                content = vfs.read(read_path, is_absolute_artifact=is_artifact)

                # Fallback for standard files
                if content is None and not is_artifact:
                    content = vfs.read(filepath, is_absolute_artifact=True)

                if content is not None:
                    text_blocks.append(f"{'='*60}\n>>>NEW FILE :: {filepath} | Selection\n{'='*60}\n\n{content}\n\n")
                else:
                    text_blocks.append(f"{'='*60}\n>>>NEW FILE :: {filepath} | Selection\n{'='*60}\n\n[Error reading file: Not found]\n\n")
            except Exception as e:
                text_blocks.append(f"{'='*60}\n>>>NEW FILE :: {filepath} | Selection\n{'='*60}\n\n[Error reading file: {str(e)}]\n\n")

    base_filename = f"quickpack_{int(time.time())}_context.txt"

    manifest_entry = compile_context_payload(
        ctx.workspace_id,
        ctx.paths["contexts_dir"],
        base_filename,
        header_str,
        text_blocks,
        files,
        {"type": "gather", "title": "⚡ Quickpack", "domain": "Quickpacks", "desc": "Ad-hoc context export."}
    )
    manifest_data = ctx.manifest
    manifest_data[base_filename] = manifest_entry
    ctx.save_manifest(manifest_data)
    ctx.sync_vfs_barrier()

    from insetu.kernel.workers import register_ephemeral_artifact
    chunks = manifest_entry.get("chunks", [base_filename])
    for chunk in chunks:
        out_path = Path(ctx.paths["contexts_dir"]).joinpath(chunk).as_posix()
        register_ephemeral_artifact(out_path, "quick_pack", 86400, workspace_id=ctx.workspace_id)

    return {
        "message": "Compilation successful.",
        "artifact": {
            "base_filename": base_filename,
            "file": base_filename,
            "filename": base_filename,
            "filepath": base_filename,
            "out_file": base_filename,
            "url": f"/download/{base_filename}",
            "chunks": chunks,
            "files": chunks
        }
    }
@gather_bp.route('clear_quickpacks', methods=['POST'])
def api_clear_quickpacks(ctx):
    manifest_data = ctx.manifest
    keys_to_delete = [k for k in manifest_data.keys() if k.startswith('quickpack_') or k.startswith('selection_')]
    if not keys_to_delete:
        return jsonify({"status": "success", "message": "No quickpacks to clear."})

    for k in keys_to_delete:
        chunks = ctx.get_manifest_files(target_key=k)
        if not chunks:
            chunks = [k]
        for chunk in chunks:
            chunk_path = Path(ctx.paths["contexts_dir"]).joinpath(chunk).as_posix()
            try:
                os.remove(chunk_path)
            except Exception:
                pass
        del manifest_data[k]

    ctx.save_manifest(manifest_data)

    # Clean up the garbage collector ledger synchronously
    from insetu.kernel.db import get_connection
    conn = get_connection("workers", workspace_id=ctx.workspace_id)
    conn.execute("DELETE FROM ephemeral_artifacts WHERE module_owner = 'quick_pack'")
    conn.commit()

    return jsonify({"status": "success", "message": f"Cleared {len(keys_to_delete)} quickpacks."})

@gather_bp.route('pack_selection', methods=['POST'])
def api_gather_pack_selection(ctx):
    data = ctx.req.json or {}
    items = data.get('items', [])
    if not items:
        return jsonify({"error": "Items list required."}), 400
    job_id = ctx.jobs.submit("pack_selection_task", items=items)
    return jsonify({"status": "accepted", "job_id": job_id}), 202

import threading
_COMPILER_LOCKS = {}
_COMPILER_GLOBAL_LOCK = threading.Lock()

def get_compiler_lock(wid):
    with _COMPILER_GLOBAL_LOCK:
        if wid not in _COMPILER_LOCKS:
            _COMPILER_LOCKS[wid] = threading.RLock()
        return _COMPILER_LOCKS[wid]
@gather_bp.worker("compile_contexts")
def _background_compile(ctx, force_full=False, ledger_events=None, job_id=None):
    ws_lock = get_compiler_lock(ctx.workspace_id)
    # Increased to 15s to survive heavy Boot-Time Heuristic Git sweeps
    acquired = ws_lock.acquire(timeout=15.0)
    if not acquired:
        raise RuntimeError("Compiler lock timeout. A previous compilation or hook is stalled and holding the lock.")
    try:
        paths = ctx.paths
        manifest_data = ctx.manifest

        forced_repos = []
        if isinstance(force_full, list):
            forced_repos = force_full
            needs_full_compile = False
        else:
            needs_full_compile = force_full or not manifest_data

        ctx.jobs.update_progress("Running pre-compile hooks...")
        try:
            ctx.emit('pre_compile', is_full_sweep=needs_full_compile, forced_repos=forced_repos)
            ctx.sync_vfs_barrier()
        except Exception as e:
            print(f"Warning: Pre-compile hooks failed: {str(e)}")

        if not needs_full_compile and not forced_repos:
            try:
                live_cfg = ctx.config
                # Proactive Ledger Flush: If manual UI refresh, grab any pending VFS mutations instantly
                if ledger_events is None:
                    from insetu.kernel.db import get_connection
                    w_conn = get_connection("workers", workspace_id=ctx.workspace_id)
                    try:
                        events = w_conn.execute("SELECT filepath, mutation_type FROM vfs_event_log").fetchall()
                    except Exception:
                        events = []

                    if events:
                        ledger_events = [{"filepath": e["filepath"], "mutation_type": e["mutation_type"]} for e in events]
                        w_conn.execute("DELETE FROM vfs_event_log")
                        try:
                            w_conn._conn.commit()
                        except AttributeError:
                            w_conn.commit()
                        
                        # Decouple Cartographer: Dispatch asynchronously so it doesn't block Gather
                        touched_repos = list(set(e["filepath"].split('/')[0] for e in ledger_events if '/' in e["filepath"]))
                        if touched_repos:
                            import uuid, json
                            from insetu.kernel.workers import submit_immediate_job
                            cart_job_id = f"crt_{uuid.uuid4().hex[:8]}"
                            submit_immediate_job(cart_job_id, "cartographer", "map_task", json.dumps({"target_repos": touched_repos}), workspace_id=ctx.workspace_id)
                
                if ledger_events:
                    # Phase 3: Pure Event Sourced Differential Routing
                    changed_files = [e["filepath"] for e in ledger_events]
                    touched_buckets = set()

                    for repo_cfg in live_cfg.get("target_repos", []):
                        if repo_cfg.get("exclude_from_context"): continue
                        repo_dir = repo_cfg.get("repo_dir")
                        subs = repo_cfg.get("sub_buckets", [])
                        repo_files = [f for f in changed_files if f.startswith(f"{repo_dir}/")]
                        for f in repo_files:
                            rel_path = f[len(repo_dir)+1:]
                            if subs:
                                b, module = resolve_file_bucket(rel_path, subs)
                                if b and module: touched_buckets.add(f"{repo_dir}__{module}")
                                elif b: touched_buckets.add(f"{repo_dir}__{b.get('id')}")
                                else: touched_buckets.add(f"{repo_dir}__catch_all")
                            else:
                                touched_buckets.add(f"{repo_dir}__main")

                    if len(touched_buckets) == 0:
                        ctx.jobs.update_progress("Changes isolated to ignored files. Bypassing payload compilation.")
                    else:
                        ctx.jobs.update_progress(f"Surgically compiling {len(touched_buckets)} touched bucket(s)...")
                        _surgically_update_manifest(workspace_id=ctx.workspace_id, files=changed_files, filepath=None)
                else:
                    ctx.jobs.update_progress("No pending changes. Syncing extensions...")
                    all_repo_dirs = [r.get("repo_dir") for r in live_cfg.get("target_repos", []) if not r.get("exclude_from_context")]
                    ctx.emit('compile_contexts', manifest=manifest_data, target_repos=all_repo_dirs, touched_buckets=[], is_full_sweep=False)
                    ctx.save_manifest(manifest_data)
            except Exception as e:
                import traceback
                print(f"Warning: Differential compile failed, falling back to full sweep: {e}\\n{traceback.format_exc()}")
                needs_full_compile = True
        
        if needs_full_compile or forced_repos:
            # Fire Cartographer asynchronously
            import uuid, json
            from insetu.kernel.workers import submit_immediate_job
            cart_job_id = f"crt_{uuid.uuid4().hex[:8]}"
            submit_immediate_job(cart_job_id, "cartographer", "map_task", json.dumps({"target_repos": None if needs_full_compile else forced_repos}), workspace_id=ctx.workspace_id)

            sweep_label = "Full Sweep" if needs_full_compile else f"Targeted Sweep: {forced_repos}"
            ctx.jobs.update_progress(f"Compiling context payloads ({sweep_label})...")
            generate_context_file(ctx.workspace_id, target_repos=None if needs_full_compile else forced_repos)

        import os
        manifest_keys = list(ctx.manifest.keys())
        if not manifest_keys and os.path.exists(paths["contexts_dir"]):
            manifest_keys = [f for f in os.listdir(paths["contexts_dir"]) if f.endswith('.txt')]

        return {
            "message": "Context successfully synchronized!",
            "artifact": {"files": sorted(manifest_keys)}
        }
    except Exception as e:
        import traceback
        print(f"CRITICAL COMPILER ERROR:\\n{traceback.format_exc()}")
        raise e
    finally:
        if acquired:
            ws_lock.release()
@gather_bp.route('repos/template', methods=['GET'])
def api_repo_template(ctx):
    from insetu.core.utils_core import get_default_repo_template
    from flask import jsonify
    return jsonify(get_default_repo_template(""))

@gather_bp.route('submit', methods=['POST'])
def api_gather_submit(ctx):
    data = ctx.req.get_json(force=True, silent=True) or {}
    force_full = data.get("force_full", False)
    from flask import jsonify
    from insetu.kernel.db import get_connection
    w_conn = get_connection("workers", workspace_id=ctx.workspace_id)
    existing_job = w_conn.execute("SELECT id FROM immediate_jobs WHERE ext_name='gather' AND callback_name='compile_contexts' AND status IN ('pending', 'processing')").fetchone()

    if existing_job:
        return jsonify({"status": "accepted", "job_id": existing_job['id'], "message": "Reattached to existing compilation."}), 202

    job_id = ctx.jobs.submit("compile_contexts", force_full=force_full)
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@hooks.on('request_paths')
def hook_request_paths(workspace_id=None, **kwargs):
    try:
        from pathlib import Path
        import os
        from insetu.kernel.utils import get_workspace_physics
        cfg_path, _, _ = get_workspace_physics(workspace_id)
        artifacts_base = Path(cfg_path).parent.joinpath("data").as_posix()
        paths = {
            "contexts_dir": Path(artifacts_base).joinpath("contexts").as_posix(),
            "gather_dir": Path(artifacts_base).joinpath("workflows").as_posix()
        }
        os.makedirs(paths["contexts_dir"], exist_ok=True)
        os.makedirs(paths["gather_dir"], exist_ok=True)
        return paths
    except Exception: return {}

@hooks.on('request_manifest')
def hook_request_manifest(workspace_id=None, **kwargs):
    try:
        from insetu.kernel.utils import load_json_file
        from insetu.kernel.extension import ExtensionContext
        import os
        from pathlib import Path
        ctx = ExtensionContext('gather', workspace_id)
        manifest_path = Path(ctx.paths["contexts_dir"]).joinpath("manifest.json").as_posix()
        if os.path.exists(manifest_path): return load_json_file(manifest_path, {})
    except Exception: pass
    return {}

@hooks.on('request_manifest_chunks')
def hook_request_manifest_chunks(target_key=None, workspace_id=None, **kwargs):
    try:
        from insetu.kernel.utils import load_json_file
        from insetu.kernel.extension import ExtensionContext
        from insetu.core.utils_core import extract_manifest_files
        import os
        from pathlib import Path
        ctx = ExtensionContext('gather', workspace_id)
        manifest_path = Path(ctx.paths["contexts_dir"]).joinpath("manifest.json").as_posix()
        manifest = load_json_file(manifest_path, {}) if os.path.exists(manifest_path) else {}
        return extract_manifest_files(manifest, target_key)
    except Exception: return []
@hooks.on('save_manifest')
def hook_save_manifest(manifest_data=None, is_full_compile=False, workspace_id=None, **kwargs):
    try:
        from insetu.kernel.utils import save_json_file, load_json_file
        from insetu.kernel.extension import ExtensionContext
        import time, os
        from pathlib import Path
        ctx = ExtensionContext('gather', workspace_id)
        manifest_path = Path(ctx.paths["contexts_dir"]).joinpath("manifest.json").as_posix()

        if is_full_compile or not os.path.exists(manifest_path):
            current_on_disk = manifest_data or {}
        else:
            current_on_disk = load_json_file(manifest_path, {})
            if manifest_data:
                current_on_disk.update(manifest_data)

        save_json_file(manifest_path, current_on_disk, workspace_id)
        cache_path = Path(ctx.paths["contexts_dir"]).joinpath("manifest_cache.json").as_posix()
        cache_data = {"manifest": current_on_disk, "last_full_compile_time": time.time() if is_full_compile else load_json_file(cache_path, {}).get("last_full_compile_time", 0)}
        save_json_file(cache_path, cache_data, workspace_id)
    except Exception: pass
