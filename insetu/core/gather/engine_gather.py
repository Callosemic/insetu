from pathlib import Path
import os
import json
import datetime
import time
import subprocess
import threading
import uuid
import concurrent.futures
from flask import jsonify

from insetu.kernel.utils import get_workspace_physics, generate_ascii_tree
from insetu.core.utils_core import get_valid_workspace_files, evaluate_circuit_breaker, resolve_file_bucket, get_default_repo_template, extract_manifest_files, resolve_logical_path
from insetu.kernel.extension import InSetuExtension, ExtensionContext
from insetu.kernel.hooks import hooks
from insetu.kernel.db import register_schema, get_connection
from insetu.kernel.workers import submit_immediate_job, update_immediate_job_status, register_callback, register_ephemeral_artifact
from insetu.kernel.vfs import VFSTransaction, execute_vfs_delete

register_schema('vfs_index', {
    'manifest_ledger': {
        'filepath': 'TEXT PRIMARY KEY',
        'entry_json': 'TEXT',
        'timestamp': 'REAL'
    },
    'sync_metadata': {
        'key': 'TEXT PRIMARY KEY',
        'value': 'TEXT'
    }
})
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
    """Resolves system://contexts URIs and fallback searches."""
    if not filename: return None
    ctx = ExtensionContext('gather', workspace_id)

    safe_basename = Path(filename).name
    if "diffs/" in filename:
        cand = Path(ctx.paths.get("diffs_dir", ctx.paths["artifacts_base"] + "/diffs")).joinpath(safe_basename).as_posix()
    elif "workflows/" in filename:
        cand = Path(ctx.paths.get("workflows_dir", ctx.paths["artifacts_base"] + "/workflows")).joinpath(safe_basename).as_posix()
    else:
        cand = Path(ctx.paths["contexts_dir"]).joinpath(safe_basename).as_posix()

    if os.path.exists(cand):
        return cand, True
    return None
def compile_context_payload(workspace_id, output_dir, base_filename, header_block, text_blocks, files, meta, max_kb=None):
    """Universal compiler for all system contexts (Gather, Git, Flow)."""
    if max_kb is None:
        from insetu.kernel.extension import _REGISTERED_SETTINGS_SCHEMAS
        schema = _REGISTERED_SETTINGS_SCHEMAS.get('gather')
        ctx = ExtensionContext('gather', workspace_id, settings_schema=schema)
        max_kb = ctx.settings.get("max_context_size_kb", 0)

    vfs = VFSTransaction(workspace_id)
    max_bytes = (max_kb * 1024) if max_kb and max_kb > 0 else float('inf')
    chunks = []

    def get_chunk_name(chunk_num):
        if chunk_num == 1: return base_filename
        base, ext = os.path.splitext(base_filename)
        return f"{base}_part{chunk_num}{ext}"

    header_bytes = len(header_block.encode('utf-8'))
    bins = [{"size": header_bytes, "content": header_block}]

    for block in text_blocks:
        block_bytes = len(block.encode('utf-8'))
        # If a single monolithic block exceeds the max_bytes threshold, slice it cleanly into segments
        if block_bytes > max_bytes and max_bytes != float('inf'):
            split_blocks = []
            chunk_size = int(max_bytes * 0.95)
            for i in range(0, len(block), chunk_size):
                split_blocks.append(block[i:i+chunk_size])
        else:
            split_blocks = [block]

        for s_block in split_blocks:
            s_block_bytes = len(s_block.encode('utf-8'))
            placed = False

            for b in bins:
                if b["size"] + s_block_bytes <= max_bytes:
                    b["content"] += s_block
                    b["size"] += s_block_bytes
                    placed = True
                    break

            if not placed:
                new_idx = len(bins) + 1
                new_header = header_block + f"=== (CONTINUED - PART {new_idx}) ===\n\n"
                bins.append({
                    "size": len(new_header.encode('utf-8')) + s_block_bytes,
                    "content": new_header + s_block
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

def _process_vfs_ledger(workspace_id="default"):
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
    job_id = f"cmp_{uuid.uuid4().hex[:8]}"

    from insetu.kernel.extension import ExtensionContext
    ctx = ExtensionContext('gather', workspace_id)
    steps = []
    for res in ctx.emit('register_compilation_steps'):
        if res: steps.extend(res)

    ordered_steps = []
    visited = set()
    def visit(step_id):
        if step_id in visited: return
        step = next((s for s in steps if s['id'] == step_id), None)
        if step:
            for dep in step.get('depends_on', []): visit(dep)
            visited.add(step_id)
            ordered_steps.append(step)

    for s in steps: visit(s['id'])
    if ordered_steps:
        first_step = ordered_steps[0]
        args_json = json.dumps({
            "force_full": False, 
            "ledger_events": [{"filepath": e["filepath"], "mutation_type": e["mutation_type"]} for e in events],
            "_chain": {
                "steps": ordered_steps[1:],
                "on_complete_hook": "compilation_sequence_complete"
            }
        })
        submit_immediate_job(job_id, first_step["ext_name"], first_step["worker_name"], args_json, workspace_id=workspace_id)

register_callback("gather", "process_vfs_ledger", _process_vfs_ledger)

SYSTEM_BOOT_TIME = time.time()
@hooks.on('system_boot', priority=90)
def init_gather_workers():
    from insetu.kernel.utils import get_all_workspace_ids
    for ws_id in get_all_workspace_ids():
        w_ctx = ExtensionContext('workers', ws_id)
        conn = w_ctx.db
        conn.execute("""
            INSERT OR REPLACE INTO jobs (id, ext_name, callback_name, interval_ms, jitter_ms, next_run_at, status, args_json)
            VALUES ('sys_vfs_ledger_daemon', 'gather', 'process_vfs_ledger', 1000, 0, 0, 'pending', '{}')
        """)
        conn.commit()
        # Boot-Time Heuristic: Offline Mutation Guard (CQRS Index)
        try:
            vfs_conn = get_connection("vfs_index", workspace_id=ws_id)
            row = vfs_conn.execute("SELECT value FROM sync_metadata WHERE key = 'last_full_compile_time'").fetchone()
            last_compile = float(row['value']) if row and row['value'] else 0.0
            if SYSTEM_BOOT_TIME > last_compile:
                job_id = f"cmp_{uuid.uuid4().hex[:8]}"

                from insetu.kernel.extension import ExtensionContext
                ctx = ExtensionContext('gather', ws_id)
                steps = []
                for res in ctx.emit('register_compilation_steps'):
                    if res: steps.extend(res)

                ordered_steps = []
                visited = set()
                def visit(step_id):
                    if step_id in visited: return
                    step = next((s for s in steps if s['id'] == step_id), None)
                    if step:
                        for dep in step.get('depends_on', []): visit(dep)
                        visited.add(step_id)
                        ordered_steps.append(step)

                for s in steps: visit(s['id'])
                if ordered_steps:
                    first_step = ordered_steps[0]
                    args_json = json.dumps({
                        "force_full": True,
                        "_chain": {
                            "steps": ordered_steps[1:],
                            "on_complete_hook": "compilation_sequence_complete"
                        }
                    })
                    submit_immediate_job(job_id, first_step["ext_name"], first_step["worker_name"], args_json, workspace_id=ws_id)
                    update_immediate_job_status(job_id, 'processing', 'Healing offline mutations...', workspace_id=ws_id)
        except Exception as e:
            print(f"Warning: Offline mutation check failed: {e}")

@hooks.on('gather_settings_updated')
def on_gather_settings_updated(workspace_id=None, **kwargs):
    job_id = f"cmp_{uuid.uuid4().hex[:8]}"
    submit_immediate_job(job_id, "gather", "compile_contexts", json.dumps({"force_full": True}), workspace_id=workspace_id)
    return {"job_id": job_id}

@hooks.on('vfs_search')
def hook_vfs_search(workspace_id=None, query=None, **kwargs):
    if not query: return []
    terms = [t for t in query.split() if t]
    if not terms: return []

    ctx = ExtensionContext('gather', workspace_id)
    md_files = set()
    manifest = ctx.manifest
    for filepath in extract_manifest_files(manifest):
        if filepath.lower().endswith('.md'):
            md_files.add(filepath)
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
@hooks.on('gather_declare_topology')
def provide_base_workspaces(target_repos=None, ledger_events=None, workspace_id=None, **kwargs):
    """Base Workspace Provider: Yields schemas for standard repo contexts and media vaults."""
    from insetu.core.utils_core import get_safe_repo_id
    from insetu.kernel.extension import ExtensionContext

    ctx = ExtensionContext('gather', workspace_id)
    cfg = ctx.config
    declarations = []

    # DEBUG LOGGING INIT
    debug_log_path = Path(ctx.paths.get("artifacts_base", ".insetu/data")).joinpath("manifest_debug.log").as_posix()
    debug_log_lines = [f"=== GATHER TOPOLOGY RUN {time.time()} ==="]

    target_configs = [c for c in cfg.get("target_repos", []) if not c.get("exclude_from_context") and (not target_repos or c.get("repo_dir") in target_repos)]

    for config in target_configs:
        repo_dir = config.get("repo_dir")
        safe_r_dir = get_safe_repo_id(repo_dir)
        physical_path = config.get("physical_path")
        repo_path = os.path.abspath(os.path.expanduser(physical_path)) if physical_path else ctx.resolve_path(repo_dir)

        if not os.path.exists(repo_path): 
            debug_log_lines.append(f"\n[REPO SKIP] {repo_dir} (Path not found: {repo_path})")
            continue

        # This list is dynamically generated fresh on every event emission
        final_list = get_valid_workspace_files(repo_path, config, workspace_id) or []

        debug_log_lines.append(f"\n[REPO] {repo_dir} (Path: {repo_path})")
        debug_log_lines.append(f"  - Total files found by Git/os.walk: {len(final_list)}")
        if final_list:
            debug_log_lines.append(f"  - Sample raw files: {final_list[:5]}")

        archive_type = config.get("archive_type", "repo")
        if archive_type == "media-vault":
            vault_name = f"{repo_dir}_vault.json"
            r_title = config.get("title", repo_dir.replace('-', ' ').title())

            def make_vault_gen(files):
                def _gen():
                    return {"header": "", "blocks": [], "files": [f"{repo_dir}/{f}" for f in files]}
                return _gen
            def make_vault_recall(files):
                def _recall(events):
                    repo_prefix = (repo_dir + '/').lower()
                    if any(e['filepath'].lower().startswith(repo_prefix) for e in events):
                        return make_vault_gen(files)()
                    return None
                return _recall

            if final_list:
                declarations.append({
                    "filename": vault_name,
                    "meta": {"title": r_title, "domain": config.get("domain", "Media Vault"), "desc": config.get("description", "Media vault assets."), "type": "gather", "repo": repo_dir},
                    "generator_callback": make_vault_gen(final_list),
                    "recall_callback": make_vault_recall(final_list)
                })
            continue

        sub_buckets = config.get("sub_buckets", [])
        buckets = {}
        dynamic_files = {}
        from insetu.kernel.utils import slugify
        if sub_buckets:
            buckets = {}
            for b in sub_buckets:
                if not b.get("dynamic_split_prefix"):
                    b_id = b.get("id") or slugify(b.get("title", "untitled_bucket"))
                    b["id"] = b_id
                    buckets[b_id] = {"files": [], "cfg": b}
            for filepath in final_list:
                b, module = resolve_file_bucket(filepath, sub_buckets, repo_dir=repo_dir)
                if b and module:
                    if module not in dynamic_files: dynamic_files[module] = {"files": [], "cfg": b}
                    dynamic_files[module]["files"].append(filepath)
                elif b:
                    b_id = b.get("id") or slugify(b.get("title", "untitled_bucket"))
                    if b_id in buckets:
                        buckets[b_id]["files"].append(filepath)
                else:
                    if "default_catch_all" not in buckets:
                        buckets["default_catch_all"] = {
                            "files": [], "cfg": {
                                "id": "default_catch_all", "title": config.get("title", repo_dir), 
                                "domain": config.get("domain", "Workspaces"), 
                                "out_file": config.get("out_file", f"{safe_r_dir}_context.txt")
                            }
                        }
                    buckets["default_catch_all"]["files"].append(filepath)
        else:
            out_filename = config.get("out_file", f"{safe_r_dir}_context.txt")
            buckets[out_filename] = {
                "files": final_list,
                "cfg": {
                    "id": "main", "title": config.get("title", repo_dir.replace('-', ' ').title()),
                    "domain": config.get("domain", "Workspaces"), "out_file": out_filename
                }
            }
        def make_callbacks(b_id, data, b_title, b_domain, b_desc, out_filename, physical_repo_path):
            def _gen():
                if not data["files"]: return None
                vfs = VFSTransaction(workspace_id)
                filepaths = data["files"]
                header_str = "="*60 + f"\nINSETU TOPOLOGY ({b_title.upper()})\n" + "="*60 + "\n" + generate_ascii_tree(filepaths) + "\n\n"
                text_blocks = []
                for f in filepaths:
                    try:
                        content = vfs.read(f"{repo_dir}/{f}")
                        if content is None:
                            # Indestructible Physical Fallback: Bypass logical routing for nested structures
                            fallback_path = os.path.join(physical_repo_path, f)
                            if os.path.exists(fallback_path):
                                with open(fallback_path, 'r', encoding='utf-8') as f_in:
                                    content = f_in.read()
                        if content is not None:
                            text_blocks.append(f"\n\n{'='*60}\n>>>NEW FILE :: {repo_dir}/{f} | {b_domain}\n{'='*60}\n\n{content}")
                    except Exception: pass
                return {"header": header_str, "blocks": text_blocks, "files": [f"{repo_dir}/{f}" for f in filepaths]}
            def _recall(events):
                is_dirty = False
                repo_prefix = (repo_dir + '/').lower()
                for e in events:
                    if e['filepath'].lower().startswith(repo_prefix):
                        rel = e['filepath'][len(repo_dir)+1:]
                        if sub_buckets:
                            tb, tm = resolve_file_bucket(rel, sub_buckets, repo_dir=repo_dir)
                            if tb and tm and tm == b_id: is_dirty = True; break
                            elif tb and tb.get('id') == b_id: is_dirty = True; break
                            elif not tb and b_id == "default_catch_all": is_dirty = True; break
                        else:
                            is_dirty = True; break
                if is_dirty:
                    return _gen()
                return None
            return _gen, _recall

        for b_id, data in buckets.items():
            if not data["files"]: continue
            safe_out = data["cfg"].get("out_file", f"{safe_r_dir}_{b_id}_context.txt")
            b_title = data["cfg"].get("title", b_id.replace('_', ' ').title())
            b_domain = data["cfg"].get("domain", config.get("domain", "Workspaces"))
            b_desc = data["cfg"].get("description", f"Context payload for {b_title}.")
            gen_cb, rec_cb = make_callbacks(b_id, data, b_title, b_domain, b_desc, safe_out, repo_path)
            declarations.append({
                "filename": safe_out,
                "meta": {"title": b_title, "domain": b_domain, "desc": b_desc, "type": "gather", "repo": repo_dir},
                "generator_callback": gen_cb,
                "recall_callback": rec_cb
            })
        for module, data in dynamic_files.items():
            if not data["files"]: continue
            out_name = f"{safe_r_dir}_{module}_context.txt"
            c = data["cfg"]
            meta = c.get("meta_map", {}).get(module, {})
            title = meta.get("title", module.replace('_', ' ').title())
            domain = meta.get("domain", c.get("domain", "Dynamic Modules"))
            desc = meta.get("description", c.get("description", f"Dynamically mapped logic and templates for {title}."))
            gen_cb, rec_cb = make_callbacks(module, data, title, domain, desc, out_name, repo_path)
            declarations.append({
                "filename": out_name,
                "meta": {"title": title, "domain": domain, "desc": desc, "type": "gather", "repo": repo_dir},
                "generator_callback": gen_cb,
                "recall_callback": rec_cb
            })
            debug_log_lines.append(f"    - Dynamic Bucket [{module}]: {len(data['files'])} files")

        for b_id, data in buckets.items():
            debug_log_lines.append(f"    - Bucket [{b_id}]: {len(data['files'])} files")
            if data['files']:
                debug_log_lines.append(f"        Sample: {data['files'][:5]}")

    # Flush the debug log to disk
    try:
        with open(debug_log_path, "w", encoding="utf-8") as f:
            f.write("\n".join(debug_log_lines))
    except Exception as e:
        print(f"Failed to write manifest log: {e}")

    return declarations

_COMPILER_LOCKS = {}
_COMPILER_GLOBAL_LOCK = threading.Lock()

def get_compiler_lock(wid):
    with _COMPILER_GLOBAL_LOCK:
        if wid not in _COMPILER_LOCKS:
            _COMPILER_LOCKS[wid] = threading.RLock()
        return _COMPILER_LOCKS[wid]

def _surgically_update_manifest(workspace_id=None, files=None, filepath=None, **kwargs):
    """Differential Compiler: Iterates declared recall_callbacks to update dirty artifacts statelessly."""
    if not files and not filepath: return
    if filepath: files = [filepath]

    with get_compiler_lock(workspace_id or "default"):
        ctx = ExtensionContext('gather', workspace_id)
        paths = ctx.paths

        # Determine the affected scope
        affected_repos = set()
        for f in files:
            parts = f.split('/', 1)
            if len(parts) > 0: affected_repos.add(parts[0])

        ledger_events = [{"filepath": f, "mutation_type": "unknown"} for f in files]

        # Collect context declarations across the OS
        declarations = []
        for res in ctx.emit('gather_declare_topology', target_repos=list(affected_repos), ledger_events=ledger_events):
            if res: declarations.extend(res)

        # Circuit Breaker Evaluation
        total_known = len(declarations)
        total_dirty = sum(1 for d in declarations if d.get('recall_callback') and d['recall_callback'](ledger_events) is not None)

        if evaluate_circuit_breaker(total_dirty, total_known, threshold=0.5):
            print(f"⚠️ Circuit Breaker Tripped: {total_dirty}/{total_known} contexts touched. Promoting to Full Sweep.")
            generate_context_file(workspace_id=workspace_id, target_repos=list(affected_repos))
            return

        touched_manifest = {}
        dirty = False
        def process_differential(decl):
            recall_cb = decl.get('recall_callback')
            if not recall_cb: return None, None

            payload = recall_cb(ledger_events)
            if payload is None: return None, None # Clean, no changes needed

            if payload and payload.get('blocks'):
                out_dir = decl.get('out_dir', paths["contexts_dir"])

                entry = compile_context_payload(
                    workspace_id, out_dir, decl['filename'],
                    payload.get('header', ''), payload['blocks'], payload.get('files', []), decl['meta']
                )
                return decl['filename'], entry
            else:
                return decl['filename'], "DELETE"

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(process_differential, d) for d in declarations]
            for future in concurrent.futures.as_completed(futures):
                filename, entry = future.result()
                if filename:
                    dirty = True
                    if entry == "DELETE":
                        touched_manifest[filename] = None # Marker for deletion
                    else:
                        touched_manifest[filename] = entry

        if dirty:
            ctx.sync_vfs_barrier()
            ctx.save_manifest(touched_manifest, is_full_compile=False)

def generate_context_file(workspace_id=None, target_repos=None):
    """The Master Orchestrator Loop: Executes full sweeps based on declared topology and garbage collects."""
    ctx = ExtensionContext('gather', workspace_id)
    paths = ctx.paths

    # Pre-flight purge: Preserve active ephemerals from garbage collection
    w_conn = get_connection("workers", workspace_id=workspace_id)
    active_ephemerals = [row['filepath'] for row in w_conn.execute("SELECT filepath FROM ephemeral_artifacts").fetchall()]

    # 1. Collect all topology declarations
    declarations = []
    for res in ctx.emit('gather_declare_topology', target_repos=target_repos):
        if res: declarations.extend(res)

    manifest = {} if target_repos is None else ctx.manifest
    expected_artifacts = set()
    # 2. Execute generators in parallel
    def process_declaration(decl):
        gen_cb = decl.get('generator_callback')
        if not gen_cb: return decl['filename'], None
        try:
            payload = gen_cb()
            if payload and payload.get('blocks'):
                out_dir = decl.get('out_dir', paths["contexts_dir"])

                entry = compile_context_payload(
                    workspace_id, out_dir, decl['filename'], 
                    payload.get('header', ''), payload['blocks'], payload.get('files', []), decl['meta']
                )
                return decl['filename'], entry
        except Exception as e:
            print(f"Error compiling {decl['filename']}: {e}")
        return decl['filename'], None

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(process_declaration, d) for d in declarations]
        for future in concurrent.futures.as_completed(futures):
            filename, entry = future.result()
            if entry:
                manifest[filename] = entry
                # Track all constituent chunks for the global vacuum
                expected_artifacts.update(entry.get("chunks", [filename]))
    # 3. Global Vacuum: Purge physical files that aren't explicitly declared
    if target_repos is None:
        vfs = VFSTransaction(workspace_id)

        # Gather only vacuums its own directory. Extensions vacuum their own directories.
        target_sweeps = [paths["contexts_dir"]]
        for t_dir in target_sweeps:
            if not os.path.exists(t_dir): continue
            for ws_rel_path in vfs.walk(t_dir, exts=['.txt']):
                f_path = ctx.resolve_path(ws_rel_path)
                f_basename = Path(f_path).name

                if f_path not in active_ephemerals and f_basename not in expected_artifacts and f_basename != "manifest.json":
                    try:
                        execute_vfs_delete(workspace_id, ws_rel_path)
                    except Exception:
                        pass

    # Re-inject surviving Ephemeral Artifacts into the manifest
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

    ctx.save_manifest(manifest, is_full_compile=(target_repos is None))
    ctx.sync_vfs_barrier()

@gather_bp.worker("pack_selection_task")
def _pack_selection_worker(ctx, items, job_id=None):
    ctx.jobs.update_progress("Compiling selected files into context payload...")
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
                is_artifact = filepath.startswith("system://") or filepath.startswith(".insetu/") or filepath.startswith("data/")
                content = vfs.read(filepath, is_absolute_artifact=is_artifact)

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
    tombstones = {}
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
        tombstones[k] = None

    ctx.save_manifest(tombstones, is_full_compile=False)

    # Clean up the garbage collector ledger synchronously
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
@gather_bp.worker("compile_contexts")
def _background_compile(ctx, force_full=False, ledger_events=None, target_repos=None, job_id=None, **kwargs):
    ws_lock = get_compiler_lock(ctx.workspace_id)
    # Increased to 15s to survive heavy Boot-Time Heuristic Git sweeps
    acquired = ws_lock.acquire(timeout=15.0)
    if not acquired:
        raise RuntimeError("Compiler lock timeout. A previous compilation or hook is stalled and holding the lock.")
    try:
        paths = ctx.paths
        manifest_data = ctx.manifest

        forced_repos = target_repos or []
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
                # Proactive Ledger Flush: If manual UI refresh, grab any pending VFS mutations instantly
                if ledger_events is None:
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
                            cart_job_id = f"crt_{uuid.uuid4().hex[:8]}"
                            submit_immediate_job(cart_job_id, "cartographer", "map_task", json.dumps({"target_repos": touched_repos}), workspace_id=ctx.workspace_id)
                
                if ledger_events:
                    # Phase 3: Pure Event Sourced Differential Routing
                    changed_files = [e["filepath"] for e in ledger_events]
                    ctx.jobs.update_progress(f"Surgically evaluating {len(changed_files)} mutated file(s)...")
                    _surgically_update_manifest(workspace_id=ctx.workspace_id, files=changed_files, filepath=None)
                else:
                    ctx.jobs.update_progress("No pending changes. Syncing extensions...")
                    _surgically_update_manifest(workspace_id=ctx.workspace_id, files=[], filepath=None)
            except Exception as e:
                import traceback
                print(f"Warning: Differential compile failed, falling back to full sweep: {e}\n{traceback.format_exc()}")
                needs_full_compile = True
        if needs_full_compile or forced_repos:
            sweep_label = "Full Sweep" if needs_full_compile else f"Targeted Sweep: {forced_repos}"
            ctx.jobs.update_progress(f"Compiling context payloads ({sweep_label})...")
            generate_context_file(ctx.workspace_id, target_repos=None if needs_full_compile else forced_repos)

        # Allow simple extensions (Citations, Notes) to synchronously integrate their contexts
        ctx.jobs.update_progress("Integrating static ecosystems...")
        working_manifest = ctx.manifest
        ctx.emit('compile_contexts', manifest=working_manifest, is_full_sweep=needs_full_compile if not forced_repos else forced_repos)

        ctx.save_manifest(working_manifest, is_full_compile=False)

        manifest_keys = list(working_manifest.keys())
        if not manifest_keys and os.path.exists(paths["contexts_dir"]):
            manifest_keys = [f for f in os.listdir(paths["contexts_dir"]) if f.endswith('.txt')]

        return {
            "message": "Base contexts generated successfully.",
            "artifact": {"files": sorted(manifest_keys)}
        }
    except Exception as e:
        import traceback
        print(f"CRITICAL COMPILER ERROR:\n{traceback.format_exc()}")
        raise e
    finally:
        if acquired:
            ws_lock.release()

@gather_bp.route('repos/template', methods=['GET'])
def api_repo_template(ctx):
    return jsonify(get_default_repo_template(""))
@gather_bp.route('submit', methods=['POST'])
def api_gather_submit(ctx):
    data = ctx.req.get_json(force=True, silent=True) or {}
    force_full = data.get("force_full", False)
    w_conn = get_connection("workers", workspace_id=ctx.workspace_id)
    # Reattach check: If ANY compilation job is currently running, attach to it.
    existing_job = w_conn.execute("SELECT id FROM immediate_jobs WHERE id LIKE 'cmp_%' AND status IN ('pending', 'processing')").fetchone()
    if existing_job:
        return jsonify({"status": "accepted", "job_id": existing_job['id'], "message": "Reattached to existing compilation."}), 202

    # 1. Ask ecosystem for compilation steps
    steps = []
    for res in ctx.emit('register_compilation_steps'):
        if res: steps.extend(res)

    # 2. Topological sort
    ordered_steps = []
    visited = set()
    def visit(step_id):
        if step_id in visited: return
        step = next((s for s in steps if s['id'] == step_id), None)
        if step:
            for dep in step.get('depends_on', []): visit(dep)
            visited.add(step_id)
            ordered_steps.append(step)
    for s in steps: visit(s['id'])

    start_step = data.get("start_step")
    if start_step:
        try:
            start_idx = next(i for i, s in enumerate(ordered_steps) if s['id'] == start_step)
            ordered_steps = ordered_steps[start_idx:]
        except StopIteration:
            pass

    if not ordered_steps:
        return jsonify({"error": "No compilation steps registered."}), 400

    first_step = ordered_steps[0]
    job_id = f"cmp_{uuid.uuid4().hex[:8]}"

    _chain = {
        "steps": ordered_steps[1:],
        "on_complete_hook": "compilation_sequence_complete"
    }

    payload = {"force_full": force_full, "_chain": _chain}
    if "target_repos" in data:
        payload["target_repos"] = data["target_repos"]

    from insetu.kernel.workers import submit_immediate_job
    submit_immediate_job(job_id, first_step["ext_name"], first_step["worker_name"], json.dumps(payload), workspace_id=ctx.workspace_id)

    return jsonify({"status": "accepted", "job_id": job_id}), 202

@hooks.on('register_compilation_steps')
def _register_gather_step(workspace_id=None, **kwargs):
    return [{
        "id": "gather_base",
        "depends_on": [],
        "ext_name": "gather",
        "worker_name": "compile_contexts"
    }]
@hooks.on('request_paths')
def hook_request_paths(workspace_id=None, **kwargs):
    try:
        cfg_path, _, _ = get_workspace_physics(workspace_id)
        artifacts_base = Path(cfg_path).parent.joinpath("data").as_posix()
        paths = {
            "contexts_dir": Path(artifacts_base).joinpath("contexts").as_posix()
        }
        os.makedirs(paths["contexts_dir"], exist_ok=True)
        return paths
    except Exception: return {}

@hooks.on('request_manifest')
def hook_request_manifest(workspace_id=None, **kwargs):
    try:
        conn = get_connection("vfs_index", workspace_id=workspace_id)
        rows = conn.execute("SELECT filepath, entry_json FROM manifest_ledger").fetchall()
        manifest = {}
        for r in rows:
            if r['entry_json']:
                manifest[r['filepath']] = json.loads(r['entry_json'])
        return manifest
    except Exception: pass
    return {}

@hooks.on('request_manifest_chunks')
def hook_request_manifest_chunks(target_key=None, workspace_id=None, **kwargs):
    try:
        manifest = hook_request_manifest(workspace_id=workspace_id)
        return extract_manifest_files(manifest, target_key)
    except Exception: return []

@hooks.on('resolve_payload_chunks')
def hook_resolve_payload_chunks(uri=None, workspace_id=None, **kwargs):
    if not uri: return []
    try:
        basename = Path(uri).name
        chunks = hook_request_manifest_chunks(target_key=basename, workspace_id=workspace_id)
        if not chunks: return [uri]

        base_dir = uri.rsplit('/', 1)[0] if '/' in uri else ""
        if base_dir:
            return [f"{base_dir}/{chunk}" for chunk in chunks]
        return chunks
    except Exception:
        return [uri]

@hooks.on('save_manifest')
def hook_save_manifest(manifest_data=None, is_full_compile=False, workspace_id=None, **kwargs):
    try:
        conn = get_connection("vfs_index", workspace_id=workspace_id)
        now_ts = time.time()

        if is_full_compile:
            conn.execute("DELETE FROM manifest_ledger")
            if manifest_data:
                for fp, entry in manifest_data.items():
                    conn.execute(
                        "INSERT OR REPLACE INTO manifest_ledger (filepath, entry_json, timestamp) VALUES (?, ?, ?)",
                        (fp, json.dumps(entry), now_ts)
                    )
            conn.execute(
                "INSERT OR REPLACE INTO sync_metadata (key, value) VALUES ('last_full_compile_time', ?)",
                (str(now_ts),)
            )
        else:
            if manifest_data:
                for fp, entry in manifest_data.items():
                    if entry is None:
                        conn.execute("DELETE FROM manifest_ledger WHERE filepath = ?", (fp,))
                    else:
                        conn.execute(
                            "INSERT OR REPLACE INTO manifest_ledger (filepath, entry_json, timestamp) VALUES (?, ?, ?)",
                            (fp, json.dumps(entry), now_ts)
                        )
        conn.commit()
    except Exception as e:
        print(f"Warning: hook_save_manifest failed: {e}")

@gather_bp.route('manifest/version', methods=['GET'])
def api_manifest_version(ctx):
    try:
        conn = get_connection("vfs_index", workspace_id=ctx.workspace_id)
        row = conn.execute("SELECT MAX(timestamp) as max_ts FROM manifest_ledger").fetchone()
        max_ts = row['max_ts'] if row and row['max_ts'] else 0.0
        return jsonify({"version": max_ts})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@gather_bp.route('manifest/deltas', methods=['GET'])
def api_manifest_deltas(ctx):
    try:
        since = float(ctx.req.args.get('since', 0.0))
        conn = get_connection("vfs_index", workspace_id=ctx.workspace_id)
        rows = conn.execute("SELECT filepath, entry_json, timestamp FROM manifest_ledger WHERE timestamp > ?", (since,)).fetchall()
        deltas = {}
        for r in rows:
            deltas[r['filepath']] = json.loads(r['entry_json']) if r['entry_json'] else None
        return jsonify({"deltas": deltas, "timestamp": time.time()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500