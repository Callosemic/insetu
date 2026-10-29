from pathlib import Path
import os
import re
import json
import hashlib
import datetime
import time
import threading
import traceback
import uuid
from typing import TypedDict, List, Dict, Any, Literal, Optional, Union
from insetu.core.sdk import (
    InSetuExtension,
    ExtensionContext,
    hooks,
    thread_safe_cache,
    get_active_pipeline_modules,
)
from insetu.core.utils_core import (
    get_workspace_physics,
    generate_ascii_tree,
    slugify,
    resolve_system_artifact_path,
    evaluate_circuit_breaker,
    get_default_repo_template,
    resolve_logical_path,
    get_repo_path,
    get_safe_repo_id,
    vacuum_manifest_artifacts,
    extract_manifest_files,
    get_domain_artifact_path,
    heal_manifest_entry_domain,
    BucketAddress,
    InSetuURI,
)
from insetu.core.topology.engine_topology import resolve_file_bucket

VFS_INDEX_SCHEMA = {
    'manifest_ledger': {
        'filepath': 'TEXT PRIMARY KEY',
        'entry_json': 'TEXT',
        'timestamp': 'REAL'
    },
    'sync_metadata': {
        'key': 'TEXT PRIMARY KEY',
        'value': 'TEXT'
    }
}
SCRIPT_DIR = Path(__file__).resolve().parent.as_posix()
GATHER_SETTINGS_SCHEMA = [
    {
        "id": "max_context_size_kb",
        "label": "Max Context Size (KB)",
        "type": "number",
        "scope": "workspace",
        "default": 0,
        "description": "Set to 0 to use the default 400 KB chunk limit. Context files exceeding this limit will be cleanly split into numbered parts."
    },
    {
        "id": "domain_colors",
        "label": "Domain Intent Colors",
        "type": "intent_map",
        "scope": "workspace",
        "default": {
            "primary": ["sutram"],
            "success": [],
            "warning": ["quickpack"],
            "danger": [],
            "highlight": ["doc", "yenvui"],
            "neutral": []
        },
        "description": "Map semantic intent colors to arrays of title keywords.",
        "intent_legend": ["primary", "success", "warning", "danger", "highlight", "neutral"]
    }
]
gather_bp = InSetuExtension(
    'gather',
    __name__,
    core=True,
    settings_schema=GATHER_SETTINGS_SCHEMA,
    extra_schemas={'vfs_index': VFS_INDEX_SCHEMA},
    volumes={
        'contexts': {
            'tier': 'cache',
            'scheme': 'ctx',
            'path_key': 'contexts_dir',
            'legacy_dirs': ['ext/gather/data/contexts', 'cache/contexts'],
        }
    },
)
__depends__ = []
def compile_context_payload(workspace_id, output_dir, base_uri, header_block, text_blocks, files, meta, max_kb=None, is_ephemeral=False):
    """Universal compiler for all system contexts (Gather, Git, Flow)."""
    ctx = gather_bp.get_context(workspace_id)
    if max_kb is None:
        max_kb = ctx.settings.get("max_context_size_kb", 0)

    content_hash = ""
    if not is_ephemeral:
        # 1. Physical Idempotency: Incrementally hash payload structure without allocating a duplicate mega-string
        hasher = hashlib.sha256()
        hasher.update(header_block.encode('utf-8'))
        hasher.update(b"\n")
        for tb in text_blocks:
            hasher.update(tb.encode('utf-8'))
        hasher.update(json.dumps(files).encode('utf-8'))
        content_hash = hasher.hexdigest()
        existing_entry = ctx.manifest.get("ctx", {}).get(base_uri)
        if existing_entry and existing_entry.get("meta", {}).get("content_hash") == content_hash:
            if ctx.is_context_on_disk(base_uri, existing_entry):
                existing_meta = existing_entry.setdefault("meta", {})
                for k, v in (meta or {}).items():
                    if v is not None and existing_meta.get(k) != v:
                        existing_meta[k] = v
                return existing_entry  # Skip chunk disk I/O while keeping metadata (domain, title, desc) fresh.
    vfs = ctx.vfs
    effective_max_kb = max_kb if (max_kb and max_kb > 0) else 400
    max_bytes = effective_max_kb * 1024
    chunks = []

    def get_chunk_name(chunk_num, total_chunks):
        if total_chunks == 1 and chunk_num == 1:
            return base_uri
        ext = Path(base_uri).suffix
        base = base_uri[:-len(ext)] if ext else base_uri
        return f"{base}_part{chunk_num}{ext}"
    timestamp_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    stamp = f"Generated: {timestamp_str}\n\n"
    stamped_header = stamp + header_block

    header_bytes = len(stamped_header.encode('utf-8'))
    bins = [{"size": header_bytes, "parts": [stamped_header]}]

    for block in text_blocks:
        # Safe chunking: Only encode/split if max_bytes is finite
        if max_bytes != float('inf') and len(block.encode('utf-8')) > max_bytes:
            split_blocks = []
            chunk_size = int(max_bytes * 0.95)
            i = 0
            block_len = len(block)

            while i < block_len:
                if block_len - i <= chunk_size:
                    split_blocks.append(block[i:])
                    break

                window = block[i:i+chunk_size]
                split_index = window.rfind('\n')

                if split_index == -1:
                    # Failsafe: No newline found (e.g., minified JS). Fallback to hard slice.
                    split_index = chunk_size
                else:
                    split_index += 1

                split_blocks.append(block[i:i+split_index])
                i += split_index
        else:
            split_blocks = [block]

        for s_block in split_blocks:
            s_block_bytes = len(s_block.encode('utf-8'))
            placed = False

            for b in bins:
                if b["size"] + s_block_bytes <= max_bytes:
                    b["parts"].append(s_block)
                    b["size"] += s_block_bytes
                    placed = True
                    break
            if not placed:
                new_idx = len(bins) + 1
                new_header = stamped_header + f"=== (CONTINUED - PART {new_idx}) ===\n\n"
                bins.append({
                    "size": len(new_header.encode('utf-8')) + s_block_bytes,
                    "parts": [new_header, s_block]
                })
    chunk_sizes = []
    total_bins = len(bins)
    if total_bins > 1 and ctx.resolve_path(base_uri, must_exist=True, allow_heal=False):
        vfs.delete(base_uri, data={"ignore_ledger": True})
    for i, b in enumerate(bins):
        chunk_name = get_chunk_name(i + 1, total_bins)
        # Join parts once in O(N) time and queue via VFS
        vfs.save(chunk_name, "".join(b["parts"]), data={"ignore_ledger": True})
        chunks.append(chunk_name)
        chunk_sizes.append(b["size"])
    meta_copy = meta.copy()
    if "type" not in meta_copy:
        meta_copy["type"] = "gather"
    if "repo" in meta_copy and "repos" not in meta_copy:
        meta_copy["repos"] = [meta_copy["repo"]] if meta_copy["repo"] else []
    elif "repos" in meta_copy and "repo" not in meta_copy:
        repos_list = meta_copy.get("repos") or []
        meta_copy["repo"] = repos_list[0] if len(repos_list) == 1 else "global"
    if "bucket_id" not in meta_copy:
        meta_copy["bucket_id"] = meta_copy.get("type", "main")

    manifest_entry = {
        "files": files,
        "chunks": chunks,
        "meta": meta_copy
    }
    total_bytes = sum(chunk_sizes)
    manifest_entry["meta"]["size_bytes"] = total_bytes
    manifest_entry["meta"]["estimated_tokens"] = total_bytes // 4
    manifest_entry["meta"]["file_count"] = len(files)
    manifest_entry["meta"]["chunk_sizes"] = chunk_sizes
    manifest_entry["meta"]["content_hash"] = content_hash
    manifest_entry["meta"]["file"] = base_uri
    manifest_entry["meta"]["filename"] = base_uri
    manifest_entry["meta"]["filepath"] = base_uri
    manifest_entry["meta"]["out_file"] = base_uri
    return manifest_entry
SYSTEM_BOOT_TIME = time.time()
@gather_bp.on('topology_resolved')
def handle_topology_resolved(workspace_id=None, dirty_repos=None, dirty_buckets=None, events=None, **kwargs):
    """Stage 2 Slew Limiter: Catches resolved topology and schedules a delayed RAG compilation."""
    if not events: return

    ctx = gather_bp.get_context(workspace_id)
    # The delayed compilation job ID. We use a static ID per workspace to coalesce updates.
    job_id = f"cmp_del_{workspace_id}"

    # Prevent event starvation by coalescing new events with any pending unexecuted job payload
    old_args = ctx.jobs.get_scheduled_args(job_id)
    if old_args:
        try:
            old_events = old_args.get('ledger_events', [])
            def _get_fp(item):
                raw_fp = item['filepath'] if isinstance(item, dict) and 'filepath' in item else str(item)
                uri = InSetuURI(raw_fp)
                clean_fp = str(uri)
                if raw_fp.endswith('/') and not clean_fp.endswith('/'):
                    clean_fp += '/'
                return clean_fp

            event_dict = {_get_fp(e): e for e in events}
            for oe in old_events:
                oe_fp = _get_fp(oe)
                if oe_fp and oe_fp not in event_dict:
                    m_type = oe.get('mutation_type', 'save') if isinstance(oe, dict) else 'save'
                    event_dict[oe_fp] = {"filepath": oe_fp, "mutation_type": m_type}
            events = list(event_dict.values())
        except Exception:
            pass
    ctx.jobs.submit_one_shot("execute_delayed_compile", 2500, job_id=job_id, force_full=False, ledger_events=events)

def get_ordered_compilation_steps(ctx):
    """Delegates compilation sequence resolution to Akasa's generic DAG orchestrator."""
    return ctx.resolve_dag_chain('register_compilation_steps')
@gather_bp.worker("execute_delayed_compile")
def _execute_delayed_compile(
    ctx,
    job_id: Optional[str] = None,
    force_full: bool = False,
    ledger_events: Optional[List[Dict[str, Any]]] = None,
):
    ordered_steps = get_ordered_compilation_steps(ctx)
    if ordered_steps:
        ctx.jobs.submit_chain(
            ordered_steps, 
            on_complete_hook="compilation_sequence_complete", 
            job_category="system_background", 
            force_full=force_full, 
            ledger_events=ledger_events
        )


@gather_bp.on('topology_boot_complete', priority=90)
def init_gather_workers(workspace_id=None, **kwargs):
    ws_id = workspace_id
    # Boot-Time Mandate: Always perform a full compile safely after Topology settles
    try:
        ctx = gather_bp.get_context(ws_id)
        ordered_steps = get_ordered_compilation_steps(ctx)
        if ordered_steps:
            ctx.jobs.submit_chain(
                ordered_steps, 
                on_complete_hook="compilation_sequence_complete", 
                job_category="system_background", 
                force_full=True,
                compile_only=True,
            )
    except Exception as e:
        print(f"Warning: Boot scan failed: {e}")
@gather_bp.on('gather_settings_updated')
def on_gather_settings_updated(workspace_id=None, **kwargs):
    ctx = gather_bp.get_context(workspace_id)
    job_id = ctx.jobs.submit("compile_contexts", job_category="ui_blocking", force_full=True, is_pipeline=True)
    return {"job_id": job_id}
@gather_bp.on('vfs_search')
def hook_vfs_search(workspace_id=None, query=None, **kwargs):
    if not query: return []
    terms = [t for t in query.split() if t]
    if not terms: return []
    ctx = gather_bp.get_context(workspace_id)
    md_files = set()
    manifest = ctx.manifest.get("ctx", {})
    vfs_items = [k for k, v in manifest.items() if v.get('meta', {}).get('domain') == 'vfs']
    for filepath in ctx.expand_selection(vfs_items):
        if filepath.lower().endswith('.md'):
            md_files.add(filepath)
    results = []
    for filepath in md_files:
        try:
            content = ctx.vfs.read(filepath)
            if content is None: continue

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
@gather_bp.on('gather_declare_topology')
def provide_base_workspaces(target_repos=None, ledger_events=None, workspace_id=None, **kwargs):
    """Base Workspace Provider: Yields schemas for standard repo contexts and media vaults."""
    from insetu.core.topology.engine_topology import (
        topology_bp as _topology_bp,
        resolve_topology_buffer as _resolve_topology_buffer,
        get_topology_files_for_repo as _get_topology_files_for_repo
    )
    # Read-Consistency Guard: Drain pending events before querying topology_ledger
    drained = _resolve_topology_buffer(workspace_id)
    if drained and isinstance(ledger_events, list):
        event_dict = {e['filepath']: e for e in ledger_events}
        for de in drained:
            event_dict[de['filepath']] = de
        ledger_events.clear()
        ledger_events.extend(event_dict.values())

    ctx = gather_bp.get_context(workspace_id)
    cfg = ctx.config
    declarations = []

    # DEBUG LOGGING INIT
    log_dir = Path(ctx.paths.get("control_dir", ".insetu")).joinpath("cache", "logs")
    os.makedirs(log_dir.as_posix(), exist_ok=True)
    debug_log_path = log_dir.joinpath("manifest_debug.log").as_posix()
    debug_log_lines = [f"=== GATHER TOPOLOGY RUN {time.time()} ==="]
    target_configs = [c for c in cfg.get("target_repos", []) if not c.get("exclude_from_context") and (not target_repos or c.get("repo_dir") in target_repos)]

    top_ctx = _topology_bp.get_context(workspace_id)
    for config in target_configs:
        repo_dir = config.get("repo_dir")
        safe_r_dir = get_safe_repo_id(repo_dir)
        repo_path = get_repo_path(repo_dir, workspace_id)

        if not os.path.exists(repo_path):  
            debug_log_lines.append(f"\n[REPO SKIP] {repo_dir} (Path not found: {repo_path})")
            continue
        # Pull canonical vfs:// URIs strictly from the SSOT Topology Ledger, avoiding disk I/O
        final_list = _get_topology_files_for_repo(workspace_id, repo_dir)

        debug_log_lines.append(f"\n[REPO] {repo_dir} (Path: {repo_path})")
        debug_log_lines.append(f"  - Total files from Topology Ledger: {len(final_list)}")
        if final_list:
            debug_log_lines.append(f"  - Sample raw files: {final_list[:5]}")
        archive_type = config.get("archive_type", "repo")
        if archive_type == "media-vault":
            vault_name = f"ctx://contexts/{repo_dir}_vault.json"
            r_title = config.get("title", repo_dir.replace('-', ' ').title())
            def make_vault_gen(files):
                def _gen():
                    return {"header": "", "blocks": [], "files": list(files)}
                return _gen
            def make_vault_recall(files, current_repo_dir):
                def _recall(events):
                    vfs_prefix = f"vfs://{current_repo_dir.lower()}/"
                    if any(e['filepath'].lower().startswith(vfs_prefix) for e in events):
                        return make_vault_gen(files)()
                    return None
                return _recall
            if final_list:
                declarations.append({
                    "filename": vault_name,
                    "meta": {"title": r_title, "domain": config.get("domain", "Media Vault"), "desc": config.get("description", "Media vault assets."), "type": "gather", "repo": repo_dir, "bucket_id": "main"},
                    "generator_callback": make_vault_gen(final_list),
                    "recall_callback": make_vault_recall(final_list, repo_dir)
                })
            continue
        sub_buckets = config.get("sub_buckets", [])
        buckets = {}
        dynamic_files = {}
        if sub_buckets:
            buckets = {}
            for b in sub_buckets:
                if b.get("dynamic_split_prefix"):
                    for mod_name in b.get("meta_map", {}).keys():
                        if mod_name not in dynamic_files:
                            dynamic_files[mod_name] = {"files": [], "cfg": b}
                else:
                    b_id = b.get("id") or slugify(b.get("title", "untitled_bucket"))
                    b["id"] = b_id
                    buckets[b_id] = {"files": [], "cfg": b}
            for file_uri in final_list:
                rel_path = InSetuURI(file_uri).path
                b, module = resolve_file_bucket(rel_path, sub_buckets, repo_dir=repo_dir)
                if b and b.get("id") == "_dropped":
                    continue
                elif b and module:
                    if module not in dynamic_files: dynamic_files[module] = {"files": [], "cfg": b}
                    dynamic_files[module]["files"].append(file_uri)
                elif b:
                    b_id = b.get("id") or slugify(b.get("title", "untitled_bucket"))
                    if b_id in buckets:
                        buckets[b_id]["files"].append(file_uri)
                else:
                    if "main" not in buckets:
                        buckets["main"] = {
                            "files": [], "cfg": {
                                "id": "main", "title": config.get("title", repo_dir.replace('-', ' ').title()), 
                                "domain": config.get("domain", "Workspaces"),
                                "exclude_from_context": config.get("exclude_from_context", False)
                            }
                        }
                    buckets["main"]["files"].append(file_uri)
        else:
            out_filename = f"{safe_r_dir}_context.txt"
            buckets["main"] = {
                "files": final_list,
                "cfg": {
                    "id": "main", "title": config.get("title", repo_dir.replace('-', ' ').title()),
                    "domain": config.get("domain", "Workspaces"),
                    "exclude_from_context": config.get("exclude_from_context", False)
                }
            }
        def make_callbacks(b_id, data, b_title, b_domain, b_desc, out_filename, physical_repo_path, current_repo_dir, current_sub_buckets):
            def _gen():
                if not data["files"]:
                    return {"header": "", "blocks": [], "files": []}
                vfs = ctx.vfs
                file_uris = data["files"]
                display_paths = [InSetuURI(u).path for u in file_uris]
                header_str = "="*60 + f"\nINSETU TOPOLOGY ({b_title.upper()})\n" + "="*60 + "\n" + generate_ascii_tree(display_paths) + "\n\n"
                text_blocks = []
                for f_uri in file_uris:
                    try:
                        content = vfs.read(f_uri)
                        if content is not None:
                            text_blocks.append(f"\n\n{'='*60}\n>>>NEW FILE :: {f_uri} | {b_domain}\n{'='*60}\n\n{content}")
                    except Exception: pass
                return {"header": header_str, "blocks": text_blocks, "files": list(file_uris)}
            def _recall(events):
                is_dirty = False
                vfs_prefix = f"vfs://{current_repo_dir.lower()}/"
                for e in events:
                    fp_lower = e['filepath'].lower()
                    if fp_lower.startswith(vfs_prefix):
                        rel = e['filepath'][len(vfs_prefix):]
                        if current_sub_buckets:
                            tb, tm = resolve_file_bucket(rel, current_sub_buckets, repo_dir=current_repo_dir)
                            if tb and tm and tm == b_id: is_dirty = True; break
                            elif tb and tb.get('id') == b_id: is_dirty = True; break
                            elif not tb and b_id == "main": is_dirty = True; break

                            # Directory containment healer: If a parent directory is deleted/moved, mark child buckets dirty
                            if rel.endswith('/'):
                                for p in data["cfg"].get("match_prefixes", []):
                                    if p.lower().startswith(rel.lower()): is_dirty = True; break
                                prefix = data["cfg"].get("dynamic_split_prefix")
                                if prefix and prefix.lower().startswith(rel.lower()): is_dirty = True; break
                        else:
                            is_dirty = True; break
                if is_dirty:
                    return _gen()
                return None
            return _gen, _recall
        parent_domain = (config.get("domain") or "").strip() or "Workspaces"
        for b_id, data in buckets.items():
            if data["cfg"].get("exclude_from_context"): continue
            safe_out = f"ctx://contexts/{safe_r_dir}_context.txt" if b_id == "main" else f"ctx://contexts/{safe_r_dir}_{b_id}_context.txt"
            b_title = (data["cfg"].get("title") or "").strip() or b_id.replace('_', ' ').title()
            b_domain = (data["cfg"].get("domain") or "").strip() or parent_domain
            b_desc = (data["cfg"].get("description") or "").strip() or f"Context payload for {b_title}."
            gen_cb, rec_cb = make_callbacks(b_id, data, b_title, b_domain, b_desc, safe_out, repo_path, repo_dir, sub_buckets)
            declarations.append({
                "filename": safe_out,
                "meta": {"title": b_title, "domain": b_domain, "desc": b_desc, "type": "gather", "repo": repo_dir, "bucket_id": b_id},
                "generator_callback": gen_cb,
                "recall_callback": rec_cb
            })
        for module, data in dynamic_files.items():
            out_name = f"ctx://contexts/{safe_r_dir}_{module}_context.txt"
            c = data["cfg"]
            meta = c.get("meta_map", {}).get(module, {})
            title = (meta.get("title") or "").strip() or module.replace('_', ' ').title()
            domain = (meta.get("domain") or "").strip() or (c.get("domain") or "").strip() or parent_domain
            desc = (meta.get("description") or "").strip() or (c.get("description") or "").strip() or f"Dynamically mapped logic and templates for {title}."
            gen_cb, rec_cb = make_callbacks(module, data, title, domain, desc, out_name, repo_path, repo_dir, sub_buckets)
            declarations.append({
                "filename": out_name,
                "meta": {"title": title, "domain": domain, "desc": desc, "type": "gather", "repo": repo_dir, "bucket_id": module},
                "generator_callback": gen_cb,
                "recall_callback": rec_cb
            })
            debug_log_lines.append(f"    - Dynamic Bucket [{module}]: {len(data['files'])} files")

        for b_id, data in buckets.items():
            debug_log_lines.append(f"    - Bucket [{b_id}]: {len(data['files'])} files")
            if data['files']:
                debug_log_lines.append(f"        Sample: {data['files'][:5]}")
    # Flush the debug log to disk via VFS to maintain Event Ledger compliance
    try:
        ctx.vfs.save(debug_log_path, "\n".join(debug_log_lines), data={"is_absolute_artifact": True, "ignore_ledger": True})
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
    with get_compiler_lock(workspace_id or "default"):
        ctx = gather_bp.get_context(workspace_id)
        paths = ctx.paths

        from insetu.core.topology.engine_topology import resolve_topology_buffer as _resolve_topology_buffer
        drained = _resolve_topology_buffer(workspace_id)
        raw_ledger_events = kwargs.get("ledger_events") or []
        event_dict = {}
        def _to_canonical_event(item, default_op="save"):
            raw_fp = item['filepath'] if isinstance(item, dict) and 'filepath' in item else str(item)
            m_type = item.get('mutation_type', default_op) if isinstance(item, dict) else default_op

            uri = InSetuURI(raw_fp)
            clean_fp = str(uri)

            if raw_fp.endswith('/') and not clean_fp.endswith('/'):
                clean_fp += '/'

            return {"filepath": clean_fp, "mutation_type": m_type}

        for item in raw_ledger_events:
            ev = _to_canonical_event(item)
            if ev["filepath"]:
                event_dict[ev["filepath"]] = ev

        if files:
            for f in files:
                ev = _to_canonical_event(f)
                if ev["filepath"]:
                    event_dict[ev["filepath"]] = ev

        if filepath:
            ev = _to_canonical_event(filepath)
            if ev["filepath"]:
                event_dict[ev["filepath"]] = ev

        if drained:
            for de in drained:
                ev = _to_canonical_event(de)
                if ev["filepath"]:
                    event_dict[ev["filepath"]] = ev

        ledger_events = list(event_dict.values())
        if not ledger_events:
            return
        affected_repos = set()
        for e in ledger_events:
            fp = e.get('filepath', '') if isinstance(e, dict) else str(e)
            repo = InSetuURI(fp).repo
            if repo:
                affected_repos.add(repo)
        # Collect context declarations across the OS
        declarations = ctx.emit_merge_list('gather_declare_topology', ledger_events=ledger_events)

        # Circuit Breaker Evaluation
        total_known = len(declarations)
        total_dirty = sum(1 for d in declarations if d.get('recall_callback') and d['recall_callback'](ledger_events) is not None)
        if evaluate_circuit_breaker(total_dirty, total_known, threshold=0.5):
            print(f"⚠️ Circuit Breaker Tripped: {total_dirty}/{total_known} contexts touched. Promoting to Full Sweep.")
            return generate_context_file(workspace_id=workspace_id, target_repos=list(affected_repos))

        touched_manifest = {}
        dirty = False
        def process_differential(decl):
            recall_cb = decl.get('recall_callback')
            if not recall_cb: return None, None

            payload = recall_cb(ledger_events)
            if payload is None: return None, None # Clean, no changes needed
            if payload and payload.get('blocks'):
                entry = compile_context_payload(
                    workspace_id, None, decl['filename'],
                    payload.get('header', ''), payload['blocks'], payload.get('files', []), decl['meta']
                )
                return decl['filename'], entry
            else:
                return decl['filename'], "DELETE"
        for filename, entry in ctx.jobs.map_parallel(process_differential, declarations):
            if filename:
                dirty = True
                if entry == "DELETE":
                    touched_manifest[filename] = None # Marker for deletion
                    chunks = ctx.get_manifest_files(target_key=filename)
                    if not chunks: chunks = [filename]
                    for chunk in chunks:
                        ctx.vfs.delete(chunk, data={"ignore_ledger": True})
                else:
                    touched_manifest[filename] = entry

        declared_filenames = {d['filename'] for d in declarations}
        old_ctx_manifest = ctx.manifest.get("ctx", {})
        for old_key, old_entry in old_ctx_manifest.items():
            is_gather = isinstance(old_entry, dict) and old_entry.get("meta", {}).get("type") == "gather"
            if is_gather:
                old_repo = old_entry.get("meta", {}).get("repo")
                if old_repo in affected_repos and old_key not in declared_filenames and old_key not in touched_manifest:
                    touched_manifest[old_key] = None
                    dirty = True
                    chunks = ctx.get_manifest_files(target_key=old_key)
                    if not chunks: chunks = [old_key]
                    for chunk in chunks:
                        ctx.vfs.delete(chunk, data={"ignore_ledger": True})
        if dirty:
            # Flush all written chunks to disk BEFORE publishing updated timestamps in SQLite
            ctx.sync_vfs_barrier()
            ctx.save_manifest(touched_manifest, is_full_compile=False)
            return list(touched_manifest.keys())
        return []

def generate_context_file(workspace_id=None, target_repos=None):
    """The Master Orchestrator Loop: Executes full sweeps based on declared topology and garbage collects."""
    ctx = gather_bp.get_context(workspace_id)
    paths = ctx.paths
    # Pre-flight purge: Preserve active ephemerals from garbage collection
    active_ephemerals = ctx.jobs.get_ephemerals()
    # 1. Collect all topology declarations
    declarations = ctx.emit_merge_list('gather_declare_topology', target_repos=target_repos)
    # Granular Delta Enforcement: Start with a clean dictionary. 
    # If target_repos is populated, we only want to save the deltas.
    manifest = {}
    expected_artifacts = set()

    # 2. Execute generators in parallel
    def process_declaration(decl):
        gen_cb = decl.get('generator_callback')
        if not gen_cb: return decl['filename'], None
        try:
            payload = gen_cb()
            if payload and payload.get('blocks'):
                entry = compile_context_payload(
                    workspace_id, None, decl['filename'], 
                    payload.get('header', ''), payload['blocks'], payload.get('files', []), decl['meta']
                )
                return decl['filename'], entry
        except Exception as e:
            print(f"Error compiling {decl['filename']}: {e}")
        return decl['filename'], None
    for filename, entry in ctx.jobs.map_parallel(process_declaration, declarations):
        if entry:
            manifest[filename] = entry
            # Track all constituent chunks for the global vacuum
            chunks = entry.get("chunks", [filename])
            expected_artifacts.update(InSetuURI(c).basename for c in chunks)
    # Flush all newly generated/updated context chunks to disk first (Make-Before-Break)
    ctx.sync_vfs_barrier()
    # Re-fetch active ephemerals after the barrier so concurrent clear_quickpacks calls are respected
    active_ephemerals = set(ctx.jobs.get_ephemerals())

    # Re-inject surviving Ephemeral Artifacts into the manifest
    old_manifest = ctx.manifest.get("ctx", {})
    restored_ephemerals = set()
    for k, v in old_manifest.items():
        if isinstance(v, dict) and v.get("meta", {}).get("domain") in ("Quickpacks", "Exported Contexts"):
            safe_k = InSetuURI(k).basename
            if re.search(r'_part\d+\.txt$', safe_k):
                continue
            base_path = Path(paths["contexts_dir"]).joinpath(safe_k).as_posix()
            if base_path in active_ephemerals and os.path.exists(base_path):
                manifest[k] = v
                chunks = v.get("chunks") or ctx.get_manifest_files(target_key=k) or [k]
                for chunk in chunks:
                    safe_chunk = InSetuURI(chunk).basename
                    chunk_path = Path(paths["contexts_dir"]).joinpath(safe_chunk).as_posix()
                    restored_ephemerals.add(chunk_path)
    for f_path in active_ephemerals:
        if f_path.startswith(paths["contexts_dir"]) and f_path not in restored_ephemerals:
            if not os.path.exists(f_path):
                continue
            f_name = Path(f_path).name
            # Never promote secondary multi-part chunk files into standalone manifest cards
            if re.search(r'_part\d+\.txt$', f_name):
                continue
            uri_key = f"ctx://contexts/{f_name}"
            if uri_key in old_manifest:
                manifest[uri_key] = old_manifest[uri_key]
            else:
                size_bytes = Path(f_path).stat().st_size
                is_quickpack = f_name.startswith(('quickpack_', 'selection_'))
                domain_name = "Quickpacks" if is_quickpack else "Exported Contexts"
                title_name = "Quickpack" if is_quickpack else f"{f_name.replace('.txt','')}"
                manifest[uri_key] = {
                    "files": [uri_key],
                    "meta": {"type": "gather", "title": title_name, "domain": domain_name, "desc": "Ephemeral context payload.", "size_bytes": size_bytes}
                }
    # Only tombstone obsolete gather entries if we actually evaluated declarations for that repo
    evaluated_repos = {d.get("meta", {}).get("repo") for d in declarations if d.get("meta", {}).get("repo")}
    for k, v in old_manifest.items():
        if not isinstance(v, dict):
            continue
        meta = v.get("meta", {})
        if meta.get("type") == "gather" and meta.get("domain") not in ("Quickpacks", "Exported Contexts"):
            if k not in manifest:
                repo = meta.get("repo")
                if (target_repos is None and repo in evaluated_repos) or (target_repos and repo in target_repos):
                    manifest[k] = None

    ctx.save_manifest(manifest, is_full_compile=False)
    return [k for k, v in manifest.items() if v is not None]


@gather_bp.on('compilation_sequence_complete')
def vacuum_unaccounted_cache_on_complete(workspace_id=None, **kwargs):
    """
    Terminal Mark-and-Sweep Garbage Collector:
    Runs strictly AFTER all compilation DAG steps (Topology, Cartographer, Gather, Git, Flow)
    have updated their contexts in-place and committed their manifests.
    Sweeps each isolated cache volume and deletes only physical files that have zero
    references in the settled manifest_ledger or ephemeral_artifacts table.
    """
    try:
        ctx = gather_bp.get_context(workspace_id)
        ctx.sync_vfs_barrier()
        active_ephemerals = set(ctx.jobs.get_ephemerals())
        conn = ctx.get_db("vfs_index")
        total_ledger_rows = conn.execute("SELECT COUNT(*) as cnt FROM manifest_ledger").fetchone()
        if not total_ledger_rows or total_ledger_rows["cnt"] == 0:
            return

        rows = conn.execute("SELECT filepath, entry_json FROM manifest_ledger WHERE entry_json IS NOT NULL").fetchall()
        expected_by_volume = {
            "contexts": set(),
            "diffs": set(),
            "workflows": set()
        }

        for r in rows:
            try:
                entry = json.loads(r["entry_json"])
            except Exception:
                continue
            if not isinstance(entry, dict):
                continue
            chunks = entry.get("chunks") or [r["filepath"]]
            for c in chunks:
                uri = InSetuURI(c)
                vol = uri.volume if uri.volume in expected_by_volume else "contexts"
                expected_by_volume[vol].add(uri.basename)
        vacuum_manifest_artifacts(ctx, "ctx://contexts", expected_by_volume["contexts"], exempt_abs_paths=active_ephemerals)
        vacuum_manifest_artifacts(ctx, "ctx://diffs", expected_by_volume["diffs"], exempt_abs_paths=active_ephemerals)
        vacuum_manifest_artifacts(ctx, "ctx://workflows", expected_by_volume["workflows"], exempt_abs_paths=active_ephemerals)
        ctx.sync_vfs_barrier()
        from insetu.core.sdk import sse_bus as _sse_bus
        if _sse_bus:
            _sse_bus.emit_sse("manifest_settled", {"workspace_id": workspace_id or "default", "timestamp": time.time()})
    except Exception as e:
        print(f"⚠️ [Gather Vacuum] Post-compilation cache sweep warning: {e}")
@gather_bp.worker("pack_selection_task")
def _pack_selection_worker(
    ctx,
    items: Optional[List[Union[str, Dict[str, Any]]]] = None,
    gather_only: bool = True,
    job_id: Optional[str] = None,
):
    if not items:
        return {"message": "No valid files selected for compilation."}
    ctx.jobs.update_progress("Compiling selected files into context payload...")
    files = ctx.expand_selection(items, gather_only=gather_only)
    if not files and gather_only:
        files = ctx.expand_selection(items, gather_only=False)
    files = [str(InSetuURI(f)) for f in files if isinstance(f, str) and not str(f).endswith('/')]
    clean_tree_files = []
    for f in files:
        f_uri = InSetuURI(f)
        clean_tree_files.append(f"{f_uri.volume}/{f_uri.path}".strip('/') if f_uri.volume else f_uri.path)

    header_str = "============================================================\n"
    header_str += "INSETU AD-HOC CONTEXT PAYLOAD (Selection)\n"
    header_str += "============================================================\n\n"
    header_str += generate_ascii_tree(clean_tree_files) + "\n\n"
    text_blocks = []
    with ctx.vfs as vfs:
        for filepath in files:
            try:
                content = vfs.read(filepath)

                if content is not None:
                    text_blocks.append(f"{'='*60}\n>>>NEW FILE :: {filepath} | Selection\n{'='*60}\n\n{content}\n\n")
                else:
                    text_blocks.append(f"{'='*60}\n>>>NEW FILE :: {filepath} | Selection\n{'='*60}\n\n[Error reading file: Not found]\n\n")
            except Exception as e:
                text_blocks.append(f"{'='*60}\n>>>NEW FILE :: {filepath} | Selection\n{'='*60}\n\n[Error reading file: {str(e)}]\n\n")
    base_uri = f"ctx://contexts/quickpack_{int(time.time())}_context.txt"
    manifest_entry = compile_context_payload(
        ctx.workspace_id,
        None,
        base_uri,
        header_str,
        text_blocks,
        files,
        {"type": "gather", "title": "Quickpack", "domain": "Quickpacks", "desc": "Ad-hoc context export."},
        is_ephemeral=True
    )
    # Write-First, Index-Second: Flush quickpack chunks to disk BEFORE publishing to manifest_ledger
    ctx.sync_vfs_barrier()
    ctx.save_manifest({base_uri: manifest_entry}, is_full_compile=False)
    chunks = manifest_entry.get("chunks", [base_uri])
    for chunk in chunks:
        out_path = ctx.resolve_path(chunk) or resolve_system_artifact_path(chunk, ctx.workspace_id)
        ctx.jobs.register_ephemeral(out_path, ttl_seconds=86400, owner="quick_pack")
    return {
        "message": "Compilation successful.",
        "artifact": {
            "base_filename": base_uri,
            "file": base_uri,
            "filename": base_uri,
            "filepath": base_uri,
            "out_file": base_uri,
            "url": f"/api/{ctx.workspace_id}/fs/fetch?file={base_uri}&download=1",
            "chunks": chunks,
            "files": chunks,
            "manifest_entry": manifest_entry
        }
    }

class ClearQuickpacksResponse(TypedDict):
    status: str
    message: str
@gather_bp.route('clear_quickpacks', methods=['POST'], response_schema=ClearQuickpacksResponse, docstring="[sync] Purges all temporary quickpack context exports and clears the ephemeral artifact ledger.")
def api_clear_quickpacks(ctx):
    # 1. Clear ephemeral ledger FIRST so any concurrent compile_contexts worker cannot resurrect them
    ctx.jobs.clear_ephemerals(owner="quick_pack")

    manifest_data = ctx.manifest.get("ctx", {})
    keys_to_delete = [k for k in manifest_data.keys() if 'quickpack_' in k or 'selection_' in k]
    tombstones = {}
    for k in keys_to_delete:
        entry = manifest_data.get(k)
        chunks = (entry.get("chunks") if isinstance(entry, dict) else None) or ctx.get_manifest_files(target_key=k) or [k]
        for chunk in chunks:
            ctx.vfs.delete(chunk, data={"ignore_ledger": True})
        tombstones[k] = None

    # 2. Sweep ctx://contexts for any orphaned quickpack_* or selection_* part files on disk
    for f_uri in ctx.vfs.walk("ctx://contexts", exts=['.txt']):
        fname = Path(f_uri).name
        if fname.startswith(('quickpack_', 'selection_')):
            ctx.vfs.delete(f_uri, data={"ignore_ledger": True})
            if f_uri in manifest_data:
                tombstones[f_uri] = None
    if not tombstones:
        return {"status": "success", "message": "No quickpacks to clear."}

    ctx.sync_vfs_barrier()
    ctx.save_manifest(tombstones, is_full_compile=False)
    return {"status": "success", "message": f"Cleared {len(tombstones)} quickpack(s)."}

class PackSelectionPayload(TypedDict, total=False):
    items: List[Dict[str, str]]
    gather_only: Optional[bool]

@gather_bp.route('pack_selection', methods=['POST'], request_schema=PackSelectionPayload, docstring="Compiles a specific list of files into a downloadable Quickpack context. 'items' should be a list of dicts with a 'filepath' key.")
def api_gather_pack_selection(ctx):
    data = ctx.payload or {}
    items = data.get('items', [])
    gather_only = bool(data.get('gather_only', True))
    if not items:
        return {"error": "Items list required."}, 400
    job_id = ctx.jobs.submit("pack_selection_task", job_category="ui_blocking", items=items, gather_only=gather_only)
    return {"status": "accepted", "job_id": job_id}, 202
@gather_bp.worker("compile_contexts")
def _background_compile(
    ctx,
    force_full: Union[bool, Literal["compile_only"]] = False,
    compile_only: bool = False,
    ledger_events: Optional[List[Dict[str, Any]]] = None,
    target_repos: Optional[List[str]] = None,
    is_pipeline: bool = False,
    job_id: Optional[str] = None,
):
    ws_lock = get_compiler_lock(ctx.workspace_id)
    # Increased to 15s to survive heavy Boot-Time Heuristic Git sweeps
    acquired = ws_lock.acquire(timeout=15.0)
    if not acquired:
        raise RuntimeError("Compiler lock timeout. A previous compilation or hook is stalled and holding the lock.")
    try:
        # VFS Barrier: Wait for async physical disk moves/deletes in queue to complete
        ctx.sync_vfs_barrier(timeout=15.0)
        if ledger_events is None:
            ledger_events = []

        paths = ctx.paths
        manifest_data = ctx.manifest.get("ctx", {})
        forced_repos = target_repos or []
        needs_full_compile = force_full or not manifest_data

        ctx.jobs.update_progress("Running pre-compile hooks...")
        try:
            ctx.emit('pre_compile', is_full_sweep=needs_full_compile, forced_repos=forced_repos)
        except Exception as e:
            print(f"Warning: Pre-compile hooks failed: {str(e)}")
        touched_files = []
        # Self-Healing Cache Guardrail: If any declared gather context in the manifest is missing its physical chunk files on disk, promote to a full compile
        if not needs_full_compile and not forced_repos:
            if ctx.has_missing_domain_artifacts("gather"):
                needs_full_compile = True

        if not needs_full_compile and not forced_repos:
            try:
                if ledger_events:
                    # Phase 3: Pure Event Sourced Differential Routing
                    changed_files = [e["filepath"] for e in ledger_events]
                    ctx.jobs.update_progress(f"Surgically evaluating {len(changed_files)} mutated file(s)...")
                    res = _surgically_update_manifest(workspace_id=ctx.workspace_id, files=changed_files, filepath=None, ledger_events=ledger_events)
                    if res: touched_files.extend(res)
                else:
                    ctx.jobs.update_progress("No pending changes. Syncing extensions...")
                    res = _surgically_update_manifest(workspace_id=ctx.workspace_id, files=[], filepath=None)
                    if res: touched_files.extend(res)
            except Exception as e:
                print(f"Warning: Differential compile failed, falling back to full sweep: {e}\n{traceback.format_exc()}")
                needs_full_compile = True
        if needs_full_compile or forced_repos:
            sweep_label = "Full Sweep" if needs_full_compile else f"Targeted Sweep: {forced_repos}"

            ctx.jobs.update_progress(f"Compiling context payloads ({sweep_label})...")
            res = generate_context_file(ctx.workspace_id, target_repos=None if needs_full_compile else forced_repos)
            if res: touched_files.extend(res)

        # Allow simple extensions (Citations, Notes) to synchronously integrate their contexts
        ctx.jobs.update_progress("Integrating static ecosystems...")

        # Pure Granular Routing: Extensions must inject updates into a clean delta payload.
        # This eliminates the need to load, diff, or overwrite the global manifest.
        delta_manifest = {}
        ctx.emit('compile_contexts', manifest=delta_manifest, is_full_sweep=bool(needs_full_compile), forced_repos=forced_repos, ledger_events=ledger_events)
        if delta_manifest:
            ctx.sync_vfs_barrier()
            ctx.save_manifest(delta_manifest, is_full_compile=False)
            touched_files.extend(list(delta_manifest.keys()))
        # Map compiled output URIs and any evaluated ledger_events back to their abstract architectural bucket IDs
        logical_buckets = set()
        final_manifest = ctx.manifest.get("ctx", {})
        for filepath in touched_files:
            entry = final_manifest.get(filepath) or delta_manifest.get(filepath)
            if entry and isinstance(entry, dict):
                meta = entry.get("meta", {})
                addr = BucketAddress.from_uri(filepath, meta=meta)
                logical_buckets.add(addr.key)

        target_configs_map = {
            c.get("repo_dir"): c for c in (ctx.config.get("target_repos") or []) if isinstance(c, dict) and c.get("repo_dir")
        }
        for ev in (ledger_events or []):
            ev_fp = ev.get("filepath", "") if isinstance(ev, dict) else str(ev)
            if not ev_fp:
                continue
            ev_uri = InSetuURI(ev_fp)
            r_dir = ev_uri.repo
            rel_p = ev_uri.path
            if r_dir and r_dir in target_configs_map:
                r_cfg = target_configs_map[r_dir]
                b, mod = resolve_file_bucket(rel_p, r_cfg.get("sub_buckets", []), repo_dir=r_dir)
                b_id = mod if (b and mod) else (b.get("id") if b else "main")
                if b_id and b_id != "_dropped":
                    logical_buckets.add(f"{r_dir}::{b_id}")

        logical_buckets_list = list(logical_buckets)

        # Retrieve the final unified keys directly from the SSOT database
        manifest_keys = [r['filepath'] for r in ctx.get_db("vfs_index").execute("SELECT filepath FROM manifest_ledger").fetchall()]
        if not manifest_keys:
            # Fallback to logical VFS sweep instead of raw disk I/O
            manifest_keys = list(ctx.vfs.walk("ctx://contexts", exts=['.txt']))
        return {
            "message": "Base contexts generated successfully.",
            "artifact": {
                "files": sorted(manifest_keys),
                "touched_buckets": logical_buckets_list,
                "cleared_buckets": logical_buckets_list,
                "is_full_sweep": needs_full_compile,
                "state_deltas": {"touched_buckets": logical_buckets_list if not needs_full_compile else None}
            }
        }
    except Exception as e:
        err_trace = traceback.format_exc()
        print(f"CRITICAL COMPILER ERROR:\n{err_trace}")
        try:
            err_payload = json.dumps({"force_full": bool(force_full), "target_repos": target_repos})
            hooks.emit_background('system_error', source="Gather:Compile", error_type=type(e).__name__, message=str(e), traceback=err_trace, payload=err_payload, workspace_id=ctx.workspace_id)
        except Exception: pass
        raise e
    finally:
        if acquired:
            ws_lock.release()
class RepoTemplateResponse(TypedDict, total=False):
    repo_dir: str
    title: str
    domain: str
    description: str
    exts: Optional[List[str]]
    apply_ignore: bool
    sub_buckets: List[Any]
@gather_bp.route('repos/template', methods=['GET'], response_schema=RepoTemplateResponse, docstring="Returns the default configuration dictionary template required when appending a new target repository.")
def api_repo_template(ctx):
    return get_default_repo_template("")
@gather_bp.on('register_compilation_steps')
def _register_gather_step(workspace_id=None, **kwargs):
    return [{
        "id": "gather_base",
        "anchor": "body",
        "order": 20,
        "depends_on": ["topology_scan", "cartographer_map"],
        "ext_name": "gather",
        "worker_name": "compile_contexts"
    }]


def _canonicalize_uri_str(raw_str: str, default_scheme_prefix: str = "ctx://contexts/") -> str:
    return InSetuURI.canonicalize(raw_str, default_prefix=default_scheme_prefix)


def _canonicalize_manifest_entry(filepath: str, entry: Any) -> tuple:
    canon_fp = _canonicalize_uri_str(filepath, "ctx://contexts/")
    if not isinstance(entry, dict):
        return canon_fp, entry
    scheme_vol = "ctx://contexts/"
    if "://" in canon_fp:
        parsed_uri = InSetuURI(canon_fp)
        scheme_vol = f"{parsed_uri.scheme}://{parsed_uri.volume}/" if parsed_uri.volume else f"{parsed_uri.scheme}://"

    if isinstance(entry.get("chunks"), list):
        entry["chunks"] = [_canonicalize_uri_str(c, scheme_vol) for c in entry["chunks"] if c]
    if isinstance(entry.get("files"), list):
        entry["files"] = [_canonicalize_uri_str(f, "vfs://") for f in entry["files"] if f]
    if isinstance(entry.get("meta"), dict):
        for mk in ("file", "filename", "filepath", "out_file"):
            if entry["meta"].get(mk):
                entry["meta"][mk] = canon_fp
    return canon_fp, entry
def _heal_entry_domain(ctx, entry: Any) -> bool:
    """Ensures entry['meta']['domain'] is never blank, inheriting from the parent repository domain when empty."""
    return heal_manifest_entry_domain(entry, target_repos=ctx.config.get("target_repos"))
_MIGRATED_MANIFEST_WORKSPACES = set()


@gather_bp.on('workspace_shutdown')
def _evict_migrated_manifest_workspace(workspace_id=None, **kwargs):
    if workspace_id:
        _MIGRATED_MANIFEST_WORKSPACES.discard(workspace_id)
@gather_bp.on('workspace_boot', priority=12)
def mount_gather_volumes(workspace_id=None, **kwargs):
    wid = workspace_id or "default"
    ctx = gather_bp.get_context(wid)
    if wid in _MIGRATED_MANIFEST_WORKSPACES:
        return
    try:
        conn = ctx.get_db("vfs_index")
        rows = conn.execute("SELECT filepath, entry_json, timestamp FROM manifest_ledger").fetchall()
        updates = []
        deletes = []
        seen_canon = set()
        for r in rows:
            fp = r["filepath"]
            raw_json = r["entry_json"]
            ts = r["timestamp"]
            if not raw_json:
                if "://" not in str(fp):
                    deletes.append((fp,))
                continue
            try:
                parsed = json.loads(raw_json)
            except Exception:
                continue
            canon_fp, canon_entry = _canonicalize_manifest_entry(fp, parsed)
            _heal_entry_domain(ctx, canon_entry)
            new_json = json.dumps(canon_entry, sort_keys=True, separators=(',', ':'))
            if canon_fp != fp:
                deletes.append((fp,))
            if canon_fp not in seen_canon and (canon_fp != fp or new_json != raw_json):
                updates.append((canon_fp, new_json, ts))
                seen_canon.add(canon_fp)
        if deletes:
            conn.executemany("DELETE FROM manifest_ledger WHERE filepath = ?", deletes)
        if updates:
            conn.executemany("INSERT OR REPLACE INTO manifest_ledger (filepath, entry_json, timestamp) VALUES (?, ?, ?)", updates)
        if deletes or updates:
            conn.commit()
        _MIGRATED_MANIFEST_WORKSPACES.add(wid)
    except Exception:
        pass

@gather_bp.on('manifest_mutated')
def _invalidate_gather_manifest(workspace_id=None, **kwargs):
    hook_request_manifest.invalidate(workspace_id=workspace_id)
@gather_bp.on('request_manifest')
@thread_safe_cache(ttl=2.0, key_maker=lambda workspace_id=None, **kwargs: str(workspace_id))
def hook_request_manifest(workspace_id=None, **kwargs):
    try:
        ctx = gather_bp.get_context(workspace_id)
        conn = ctx.get_db("vfs_index")
        cursor = conn.execute("SELECT filepath, entry_json, timestamp FROM manifest_ledger")
        manifest = {}
        healed_updates = []
        for filepath, entry_json, timestamp in cursor.fetchall():
            if entry_json:
                entry = json.loads(entry_json)
                if isinstance(entry, dict):
                    canon_fp, entry = _canonicalize_manifest_entry(filepath, entry)
                    if _heal_entry_domain(ctx, entry) or canon_fp != filepath or json.dumps(entry, sort_keys=True, separators=(',', ':')) != entry_json:
                        healed_updates.append((json.dumps(entry, sort_keys=True, separators=(',', ':')), filepath))
                    if 'meta' not in entry: entry['meta'] = {}
                    entry['meta']['timestamp'] = timestamp
                    manifest[canon_fp] = entry
                else:
                    manifest[filepath] = entry
        if healed_updates:
            conn.executemany("UPDATE manifest_ledger SET entry_json = ? WHERE filepath = ?", healed_updates)
            conn.commit()

        return manifest
    except Exception: pass
    return {}
@gather_bp.on('request_manifest_chunks')
def hook_request_manifest_chunks(target_key=None, workspace_id=None, **kwargs):
    try:
        ctx = gather_bp.get_context(workspace_id)
        return extract_manifest_files(ctx.manifest, target_key=target_key, domain='ctx')
    except Exception: return []
@gather_bp.on('resolve_payload_chunks')
def hook_resolve_payload_chunks(uri=None, workspace_id=None, manifest=None, **kwargs):
    if not uri:
        return []
    try:
        uri_str = str(uri)
        parsed = InSetuURI(uri_str)
        if parsed.scheme != 'ctx' or not uri_str.endswith('.txt'):
            return [uri_str]

        ctx = gather_bp.get_context(workspace_id)
        if manifest:
            chunks = extract_manifest_files(manifest, target_key=uri_str, domain='ctx')
        else:
            chunks = ctx.get_manifest_files(target_key=uri_str)

        if chunks:
            return chunks
        base_uri = re.sub(r'_part\d+\.txt$', '.txt', uri_str)
        part1_uri = re.sub(r'\.txt$', '_part1.txt', base_uri)
        if part1_uri != base_uri and ctx.resolve_path(part1_uri, must_exist=True, allow_heal=False):
            parts = []
            idx = 1
            while True:
                if idx == 1 and ctx.resolve_path(base_uri, must_exist=True, allow_heal=False):
                    cand = base_uri
                else:
                    cand = re.sub(r'\.txt$', f'_part{idx}.txt', base_uri)
                    if cand == base_uri:
                        break
                if ctx.resolve_path(cand, must_exist=True, allow_heal=False):
                    parts.append(cand)
                    idx += 1
                else:
                    break
            if parts:
                return parts
        return [uri_str]
    except Exception:
        return [str(uri)]
_LOCAL_HEAL_GUARD = threading.local()


@gather_bp.on('vfs_resolve_file')
def _resolve_or_heal_compiled_ctx_artifact(filename=None, workspace_id=None, **kwargs):
    """
    Universal Logical-to-Physical Resolver for compiled ctx:// artifacts (contexts, diffs, workflows):
    1. If a logical base_uri is requested and its multi-part chunks exist on disk, resolves to the first chunk.
    2. If the physical cache file is missing on disk, invokes the owning domain's compiler on demand
        to materialize the artifact before returning its physical path.
    """
    if not filename or not isinstance(filename, str):
        return None
    clean = filename.replace('\\', '/').strip()
    if not (clean.startswith("ctx://") or clean.endswith(("_context.txt", "_diffs.txt")) or "_part" in clean):
        return None
    try:
        canon_uri = InSetuURI.canonicalize(clean)
        parsed = InSetuURI(canon_uri)
    except Exception:
        return None
    if parsed.scheme != "ctx" or parsed.volume not in ("contexts", "diffs", "workflows"):
        return None

    wid = workspace_id or "default"
    ctx = gather_bp.get_context(wid)
    direct_phys = ctx.resolve_path(canon_uri, must_exist=True, allow_heal=False)
    if direct_phys:
        return direct_phys, True

    base_uri = re.sub(r'_part\d+\.txt$', '.txt', canon_uri)
    chunks = hook_resolve_payload_chunks(uri=base_uri, workspace_id=wid)
    if chunks:
        first_phys = ctx.resolve_path(chunks[0], must_exist=True, allow_heal=False)
        if first_phys:
            return first_phys, True

    part1_uri = re.sub(r'\.txt$', '_part1.txt', base_uri)
    part1_phys = ctx.resolve_path(part1_uri, must_exist=True, allow_heal=False)
    if part1_phys:
        return part1_phys, True
    # A missing diff file on disk means the repository working tree is clean; do not block reads with full git sweeps
    if parsed.volume == "diffs":
        return None
    if getattr(_LOCAL_HEAL_GUARD, "active", False):
        return None

    # Self-heal cold/wiped cache on demand for the requested domain
    try:
        _LOCAL_HEAL_GUARD.active = True
        if parsed.volume != "contexts":
            if ctx.has_missing_domain_artifacts("gather"):
                generate_context_file(wid)
            hooks.emit('heal_missing_domain_volume', volume=parsed.volume, workspace_id=wid)
        else:
            generate_context_file(wid)
        ctx.sync_vfs_barrier()
        hook_request_manifest.invalidate(workspace_id=wid)

        healed_phys = ctx.resolve_path(canon_uri, must_exist=True, allow_heal=False)
        if healed_phys:
            return healed_phys, True
        healed_chunks = hook_resolve_payload_chunks(uri=base_uri, workspace_id=wid)
        if healed_chunks:
            healed_first = ctx.resolve_path(healed_chunks[0], must_exist=True, allow_heal=False)
            if healed_first:
                return healed_first, True
        healed_part1 = ctx.resolve_path(part1_uri, must_exist=True, allow_heal=False)
        if healed_part1:
            return healed_part1, True
    except Exception as e:
        print(f"⚠️ [Gather] Self-healing artifact resolution failed for {canon_uri}: {e}")
    finally:
        _LOCAL_HEAL_GUARD.active = False
    return None
@gather_bp.on('save_manifest')
def hook_save_manifest(manifest_data=None, is_full_compile=False, workspace_id=None, **kwargs):
    hooks.emit('manifest_mutated', workspace_id=workspace_id)
    try:
        if manifest_data:
            normalized_data = {}
            for k, v in manifest_data.items():
                canon_k, canon_v = _canonicalize_manifest_entry(k, v)
                normalized_data[canon_k] = canon_v
            manifest_data = normalized_data
        ctx = gather_bp.get_context(workspace_id)
        conn = ctx.get_db("vfs_index")
        now_ts = time.time()
        if is_full_compile:
            existing_rows = conn.execute("SELECT filepath, entry_json FROM manifest_ledger").fetchall()
            existing_map = {r['filepath']: r['entry_json'] for r in existing_rows}
            seen_paths = set()
            if manifest_data:
                for fp, entry in manifest_data.items():
                    seen_paths.add(fp)
                    new_json = json.dumps(entry, sort_keys=True, separators=(',', ':'))
                    conn.execute(
                        "INSERT OR REPLACE INTO manifest_ledger (filepath, entry_json, timestamp) VALUES (?, ?, ?)",
                        (fp, new_json, now_ts)
                    )
            # Global vacuum: tombstone anything no longer present in the full sweep
            to_delete = [fp for fp in existing_map.keys() if fp not in seen_paths]
            for fp in to_delete:
                conn.execute("UPDATE manifest_ledger SET entry_json = NULL, timestamp = ? WHERE filepath = ?", (now_ts, fp))

            conn.execute(
                "INSERT OR REPLACE INTO sync_metadata (key, value) VALUES ('last_full_compile_time', ?)",
                (str(now_ts),)
            )
        else:
            if manifest_data:
                target_paths = list(manifest_data.keys())
                if len(target_paths) <= 500:
                    placeholders = ",".join(["?"] * len(target_paths))
                    existing_rows = conn.execute(
                        f"SELECT filepath, entry_json FROM manifest_ledger WHERE filepath IN ({placeholders})",
                        tuple(target_paths)
                    ).fetchall()
                else:
                    existing_rows = conn.execute("SELECT filepath, entry_json FROM manifest_ledger").fetchall()
                existing_map = {r['filepath']: r['entry_json'] for r in existing_rows}
                for fp, entry in manifest_data.items():
                    if entry is None:
                        conn.execute("UPDATE manifest_ledger SET entry_json = NULL, timestamp = ? WHERE filepath = ?", (now_ts, fp))
                    else:
                        new_json = json.dumps(entry, sort_keys=True, separators=(',', ':'))
                        conn.execute(
                            "INSERT OR REPLACE INTO manifest_ledger (filepath, entry_json, timestamp) VALUES (?, ?, ?)",
                            (fp, new_json, now_ts)
                        )
        conn.commit()
    except Exception as e:
        print(f"Warning: hook_save_manifest failed: {e}")
    finally:
        # Invalidate again once the write is committed: a reader that ran between the
        # 'manifest_mutated' invalidation above and the commit saw the old rows and cached them,
        # which left gather cards showing as dirty until the next unrelated change.
        hook_request_manifest.invalidate(workspace_id=workspace_id)
@gather_bp.route('manifest/version', methods=['GET'], docstring="[sync] Returns the latest modification timestamp across the context manifest ledger.")
def api_manifest_version(ctx):
    try:
        conn = ctx.get_db("vfs_index")
        row = conn.execute("SELECT MAX(timestamp) as max_ts FROM manifest_ledger").fetchone()
        max_ts = row['max_ts'] if row and row['max_ts'] else 0.0
        return {"version": max_ts}
    except Exception as e:
        return {"error": str(e)}, 500
@gather_bp.on('register_manifest_signatures')
def hook_gather_manifest_signatures(workspace_id=None, since_ts=0.0, **kwargs):
    """Yields lightweight context artifact signatures for the ctx domain."""
    ctx = gather_bp.get_context(workspace_id)
    conn = ctx.get_db("vfs_index")
    rows = conn.execute("SELECT filepath, timestamp, entry_json FROM manifest_ledger WHERE timestamp > ?", (since_ts,)).fetchall()
    ctx_sigs = {}
    for r in rows:
        ctx_sigs[r['filepath']] = r['timestamp'] if r['entry_json'] else None
    return {"ctx": ctx_sigs}
class ManifestEntryQuery(TypedDict):
    path: str

class ManifestEntryResponse(TypedDict, total=False):
    path: str
    entry: Dict[str, Any]
    status: str
@gather_bp.route('manifest/entry', methods=['GET'], request_schema=ManifestEntryQuery, response_schema=ManifestEntryResponse, docstring="Fetches a single context manifest entry by context URI.")
def api_gather_manifest_entry(ctx):
    """Surgically fetches a single manifest entry by context path."""
    path = str(ctx.payload.get('path') or '').strip()
    if not path:
        return {"error": "Path parameter required"}, 400
    target_uri = str(InSetuURI(path))
    conn = ctx.get_db("vfs_index")
    row = conn.execute("SELECT filepath, entry_json FROM manifest_ledger WHERE filepath=?", (target_uri,)).fetchone()
    if not row or not row['entry_json']:
        return {"path": target_uri, "entry": None, "status": "deleted"}, 200
    entry = json.loads(row['entry_json'])
    if _heal_entry_domain(ctx, entry):
        conn.execute(
            "UPDATE manifest_ledger SET entry_json = ? WHERE filepath = ?",
            (json.dumps(entry, sort_keys=True, separators=(',', ':')), target_uri)
        )
        conn.commit()
    return {"path": target_uri, "entry": entry}