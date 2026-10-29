import os
import re
import time
import uuid
import json
import threading
import traceback
import queue
from pathlib import Path
from typing import TypedDict, Optional, List, Dict, Any, Union, Literal
from insetu.core.sdk import (
    InSetuExtension,
    ExtensionContext,
    SettingsManager,
    get_connection,
    sse_bus,
    hooks,
    set_workspace_router,
    thread_safe_cache,
)
from insetu.core.utils_core import (
    get_repo_path,
    execute_binary,
    InSetuURI,
    fold_vfs_events,
    parse_uri,
    get_all_workspace_ids,
    get_workspace_physics,
    load_config,
    mount_volume,
    execute_vfs_save,
    resolve_physical_path,
)
TOPOLOGY_SCHEMA = {
    "topology_ledger": {
        "filepath": "TEXT PRIMARY KEY",
        "repo": "TEXT",
        "bucket_id": "TEXT",
        "is_tracked": "INTEGER DEFAULT 1",
        "timestamp": "REAL",
        "git_status": "TEXT DEFAULT ''"
    },
    "topology_event_buffer": {
        "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
        "filepath": "TEXT",
        "mutation_type": "TEXT",
        "timestamp": "REAL"
    }
}
topology_bp = InSetuExtension(
    'topology',  
    __name__,  
    title="Topology Engine", 
    description="Single Source of Truth (SSOT) for workspace file mapping and structural bucket routing.",
    schema=TOPOLOGY_SCHEMA,
    core=True
)
__depends__ = []
@topology_bp.on('register_compilation_steps')
def _register_topology_compilation_step(workspace_id=None, **kwargs):
    return [{
        "id": "topology_scan",
        "anchor": "source",
        "order": 10,
        "ext_name": "topology",
        "worker_name": "scan_topology_task"
    }]
@topology_bp.worker("scan_topology_task")
def _background_scan_topology(
    ctx,
    ledger_events: Optional[List[Dict[str, Any]]] = None,
    force_full: Union[bool, Literal["compile_only"]] = False,
    compile_only: bool = False,
    target_repos: Optional[List[str]] = None,
):
    if force_full and force_full != "compile_only" and not compile_only:
        sweep_label = "Full Sweep" if not target_repos else f"Targeted Sweep: {target_repos}"
        ctx.jobs.update_progress(f"Scanning physical disk ({sweep_label})...")
        ctx.emit('force_topology_scan', target_repos=target_repos)
    else:
        ctx.jobs.update_progress("Resolving active topology boundaries...")

    # Barrier Sync: Await async VFS pipeline writes to settle before draining topology
    try:
        ctx.sync_vfs_barrier(timeout=10.0)
    except TimeoutError as e:
        print(f"⚠️ [Topology] {str(e)} Proceeding with partial disk state.")
    if ctx.jobs.is_in_flight(prefix="tpl_"):
        ctx.jobs.update_progress("Waiting for concurrent topology mappers to settle...")
        ctx.jobs.wait_for(prefix="tpl_", timeout=10.0)

    drained_events = resolve_topology_buffer(ctx.workspace_id)
    all_events = ledger_events or []
    event_dict = {e['filepath']: e for e in all_events}

    for de in drained_events:
        event_dict[de['filepath']] = de

    # EVENT TRAP HEALER: Steal trapped events from the 12-second delayed job and cancel it.
    delayed_job_id = f"cmp_del_{ctx.workspace_id}"
    delayed_args = ctx.jobs.get_scheduled_args(delayed_job_id)

    if delayed_args:
        for de in delayed_args.get('ledger_events', []):
            event_dict[de['filepath']] = de

    all_events = list(event_dict.values())

    ctx.jobs.cancel(delayed_job_id)

    return {
        "message": "Topology mapped successfully.",
        "next_kwargs": {"ledger_events": all_events}
    }
def _get_repo_git_status_map(repo_path):
    """Runs git status --porcelain on a repository path and returns a map of relative_filepath -> status_code."""
    status_map = {}
    if not repo_path or not os.path.exists(repo_path):
        return status_map
    try:
        res = execute_binary(['git', '-c', 'core.quotepath=false', 'status', '--porcelain'], capture_output=True, text=True, cwd=repo_path)
        if res.returncode == 0:
            for line in res.stdout.splitlines():
                if len(line) < 4:
                    continue
                xy = line[:2].strip()
                rel_p = line[3:].strip()
                if ' -> ' in rel_p:
                    rel_p = rel_p.split(' -> ')[-1].strip()
                rel_p = rel_p.strip('"').replace('\\', '/')
                if xy:
                    status_map[rel_p] = xy
    except Exception:
        pass
    return status_map

@topology_bp.on('register_manifest_signatures')
def hook_topology_manifest_signatures(workspace_id=None, since_ts=0.0, **kwargs):
    """Yields lightweight repository signatures for the vfs domain, incorporating git_status counts."""
    ctx = topology_bp.get_context(workspace_id)
    rows = ctx.db.execute(
        "SELECT repo, count(*) as cnt, max(timestamp) as max_ts, sum(CASE WHEN git_status != '' AND git_status IS NOT NULL THEN 1 ELSE 0 END) as mod_cnt FROM topology_ledger GROUP BY repo"
    ).fetchall()
    vfs_sigs = {}
    for r in rows:
        repo = r['repo']
        vfs_sigs[repo] = f"{r['cnt']}-{r['max_ts']}-{r['mod_cnt'] or 0}"
    return {"vfs": vfs_sigs}
@topology_bp.route('vfs', methods=['GET'])
def api_topology_vfs_repo(ctx):
    """Surgically fetches the VFS bucket structure and git modification state for a specific repository."""
    repo = str(ctx.payload.get('repo') or '').strip()
    conn = ctx.db
    if repo:
        rows = conn.execute("SELECT filepath, bucket_id, git_status, timestamp FROM topology_ledger WHERE repo=?", (repo,)).fetchall()
    else:
        rows = conn.execute("SELECT filepath, repo, bucket_id, git_status, timestamp FROM topology_ledger").fetchall()

    files_by_bucket = {}
    for r in rows:
        r_name = repo or r['repo']
        b_id = r['bucket_id']
        key = f"{r_name}::{b_id}"
        row_ts = float(r['timestamp'] or 0.0)
        if key not in files_by_bucket:
            files_by_bucket[key] = {
                "files": [],
                "git_modified": [],
                "source_ts": row_ts,
                "meta": {"type": "vfs_bucket", "repo": r_name, "bucket_id": b_id},
            }
        elif row_ts > files_by_bucket[key]["source_ts"]:
            files_by_bucket[key]["source_ts"] = row_ts
        files_by_bucket[key]["files"].append(r['filepath'])
        if r['git_status']:
            files_by_bucket[key]["git_modified"].append(r['filepath'])
    return {"repo": repo, "buckets": files_by_bucket}
@topology_bp.on('force_topology_scan', priority=10)
def force_topology_scan(workspace_id=None, target_repos=None, **kwargs):
    """Synchronously forces a full physical disk walk to rebuild the Topology Ledger."""
    hooks.emit('vfs_manifest_mutated', workspace_id=workspace_id)
    ctx = topology_bp.get_context(workspace_id)
    conn = ctx.db
    target_configs = ctx.config.get("target_repos", [])
    active_repo_dirs = [c.get("repo_dir") for c in target_configs if c.get("repo_dir")]

    if target_repos:
        target_configs = [c for c in target_configs if c.get("repo_dir") in target_repos]
    else:
        if active_repo_dirs:
            placeholders = ",".join(["?"] * len(active_repo_dirs))
            conn.execute(f"DELETE FROM topology_ledger WHERE repo NOT IN ({placeholders})", tuple(active_repo_dirs))
        else:
            conn.execute("DELETE FROM topology_ledger")
    now_ts = time.time()
    with conn:
        for repo_cfg in target_configs:
            repo_dir = repo_cfg.get("repo_dir")
            if not repo_dir: continue
            repo_path = get_repo_path(repo_dir, workspace_id)
            repo_base_obj = Path(repo_path) if repo_path else None
            valid_files = get_valid_workspace_files(repo_path, repo_cfg, workspace_id)
            git_status_map = _get_repo_git_status_map(repo_path)
            sub_buckets = repo_cfg.get("sub_buckets", [])
            conn.execute("DELETE FROM topology_ledger WHERE repo = ?", (repo_dir,))
            rows_to_insert = []
            for f in valid_files:
                b, module = resolve_file_bucket(f, sub_buckets, repo_dir=repo_dir)
                bucket_id = module if (b and module) else (b.get("id") if b else "main")
                filepath = f"vfs://{repo_dir}/{f}"
                g_status = git_status_map.get(f, "")
                file_ts = now_ts
                if repo_base_obj:
                    try:
                        file_ts = (repo_base_obj / f).stat().st_mtime
                    except Exception:
                        file_ts = now_ts
                rows_to_insert.append((filepath, repo_dir, bucket_id, file_ts, g_status))
            if rows_to_insert:
                conn.executemany(
                    "INSERT OR REPLACE INTO topology_ledger (filepath, repo, bucket_id, timestamp, git_status) VALUES (?, ?, ?, ?, ?)",
                    rows_to_insert
                )
    # Re-invalidate after the transaction commits so no reader keeps the pre-scan ledger cached.
    hook_request_vfs_manifest.invalidate(workspace_id=workspace_id)
    return True

@topology_bp.on('vfs_manifest_mutated')
def _invalidate_topology_manifest(workspace_id=None, **kwargs):
    hook_request_vfs_manifest.invalidate(workspace_id=workspace_id)
@topology_bp.on('request_vfs_manifest')
@thread_safe_cache(ttl=2.0, key_maker=lambda workspace_id=None, **kwargs: str(workspace_id))
def hook_request_vfs_manifest(workspace_id=None, **kwargs):
    """Returns the vfs manifest derived directly from the topology ledger via raw tuple queries, including per-bucket source_ts watermarks."""
    try:
        ctx = topology_bp.get_context(workspace_id)
        cursor = ctx.db.execute("SELECT repo, bucket_id, filepath, git_status, timestamp FROM topology_ledger")

        manifest = {}
        for repo, bucket_id, filepath, git_status, ts in cursor.fetchall():
            manifest_key = f"{repo}::{bucket_id}"
            row_ts = float(ts or 0.0)
            if manifest_key not in manifest:
                manifest[manifest_key] = {
                    "files": [],
                    "git_modified": [],
                    "source_ts": row_ts,
                    "meta": {"type": "vfs_bucket", "repo": repo, "bucket_id": bucket_id},
                }
            elif row_ts > manifest[manifest_key]["source_ts"]:
                manifest[manifest_key]["source_ts"] = row_ts
            manifest[manifest_key]["files"].append(filepath)
            if git_status:
                manifest[manifest_key]["git_modified"].append(filepath)

        return manifest
    except Exception:
        return {}
def get_omniscient_workspace_files(workspace_id, allowed_repos):
    """Fast SQL replacement for the old os.walk bridge optimization."""
    resolve_topology_buffer(workspace_id)
    ctx = topology_bp.get_context(workspace_id)
    if not allowed_repos: return []
    placeholders = ','.join(['?'] * len(allowed_repos))
    rows = ctx.db.execute(f"SELECT filepath FROM topology_ledger WHERE repo IN ({placeholders})", tuple(allowed_repos)).fetchall()
    return [(InSetuURI(r['filepath']).basename, str(InSetuURI(r['filepath']))) for r in rows]
def get_topology_files_for_repo(workspace_id, repo_dir):
    """SSOT accessor returning canonical vfs://<repo>/<path> URIs from topology_ledger."""
    resolve_topology_buffer(workspace_id)
    ctx = topology_bp.get_context(workspace_id)
    rows = ctx.db.execute("SELECT filepath FROM topology_ledger WHERE repo = ?", (repo_dir,)).fetchall()
    return [str(InSetuURI(r['filepath'])) for r in rows]
_TOPOLOGY_RAM_QUEUE = queue.Queue()
_TOPOLOGY_SLEW_THREAD = None
def _topology_slew_limiter_loop():
    while True:
        try:
            # Block until at least one event arrives
            first_item = _TOPOLOGY_RAM_QUEUE.get()
            pending = [first_item]

            # Micro-slew: wait 500ms to absorb I/O storms
            time.sleep(0.5)
            while not _TOPOLOGY_RAM_QUEUE.empty():
                pending.append(_TOPOLOGY_RAM_QUEUE.get_nowait())

            # Group by workspace
            ws_groups = {}
            for ws_id, ev in pending:
                if ws_id not in ws_groups:
                    ws_groups[ws_id] = []
                ws_groups[ws_id].append(ev)
            for ws_id, events in ws_groups.items():
                folded = fold_vfs_events(events)
                if not folded:
                    continue

                # Bulk commit to SQLite
                try:
                    conn = get_connection("topology", workspace_id=ws_id)
                    now = time.time()
                    conn.executemany(
                        "INSERT INTO topology_event_buffer (filepath, mutation_type, timestamp) VALUES (?, ?, ?)",
                        [(ev.get('filepath'), ev.get('operation', 'save'), now) for ev in folded]
                    )
                    conn.commit()
                except Exception as e:
                    print(f"⚠️ [Topology Slew] Bulk DB insert failed for {ws_id}: {e}")
                    try:
                        hooks.emit_background('system_error', source="Topology:Slew_Insert", error_type=type(e).__name__, message=str(e), traceback=traceback.format_exc(), payload=f"Workspace: {ws_id}, Events: {len(folded)}", workspace_id=ws_id)
                    except Exception: pass
                # Trigger macro-resolution worker FIRST (as a silent background task)
                job_id = f"tpl_res_{ws_id}"
                topology_bp.get_context(ws_id).jobs.submit("resolve_topology_task", coalesce=True, job_category="system_background", job_id=job_id)

                # Guardrail: Delay the SSE broadcast by 250ms to ensure the worker has finished updating 
                # the SQLite ledger. Otherwise, the UI fetches a stale manifest and flashes the cards.
                if sse_bus:
                    threading.Timer(0.25, lambda w=ws_id, f=folded: sse_bus.emit_sse('vfs_mutated', {"mutations": f, "workspace_id": w})).start()
        except Exception as e:
            print(f"⚠️ [Topology Slew] Worker loop error: {e}")
            try:
                hooks.emit_background('system_error', source="Topology:Slew_Loop", error_type=type(e).__name__, message=str(e), traceback=traceback.format_exc(), payload="", workspace_id="default")
            except Exception: pass
@topology_bp.on('vfs_mutated', priority=90)
def broadcast_cross_workspace_mutations(mutations=None, workspace_id=None, **kwargs):
    """
    Phase 4 Event Bus Synchronization: Propagates mutations on shared domains
    to subscriber workspaces as virtual 'ws://' mutations for reactive RAG invalidation.
    """
    if not mutations or not workspace_id:
        return
    # Guardrail: Never re-broadcast synthetic ws:// mutations to prevent infinite loops
    if any(m.get("filepath", "").startswith("ws://") for m in mutations):
        return

    pub_settings = SettingsManager('system', workspace_id)
    exports = pub_settings.get("export_shared_domains", {})
    if not exports:
        return

    all_workspaces = get_all_workspace_ids()
    for target_ws in all_workspaces:
        if target_ws == workspace_id:
            continue

        target_settings = SettingsManager('system', target_ws)
        mounts = target_settings.get("shared_mounts", [])
        if not mounts:
            continue

        matched_mounts = [m for m in mounts if m.get("workspace_id") == workspace_id]
        if not matched_mounts:
            continue
        translated = []
        for m in mutations:
            raw_fp = m.get("filepath", "")
            if not raw_fp or not str(raw_fp).startswith("ctx://"):
                continue
            uri = InSetuURI(raw_fp)
            domain = uri.volume
            if not domain:
                continue

            domain_export = exports.get(domain) or exports.get("*")
            if not domain_export:
                continue

            allowed = domain_export.get("allowed", [])
            if "*" not in allowed and target_ws not in allowed:
                continue

            rel_in_domain = f"{domain}/{uri.path}".rstrip('/') if uri.path else domain
            if any(mnt.get("domain") in (domain, "*") for mnt in matched_mounts):
                translated.append({
                    "filepath": f"ws://{workspace_id}/{rel_in_domain}",
                    "operation": m.get("operation", "save"),
                    "ignore_ledger": m.get("ignore_ledger", False)
                })
        if translated:
            hooks.emit_background('vfs_mutated', workspace_id=target_ws, mutations=translated)
            if sse_bus:
                sse_bus.emit_sse('vfs_mutated', {"mutations": translated, "workspace_id": target_ws})


@topology_bp.on('vfs_mutated', priority=10)
def buffer_topology_events(mutations=None, workspace_id=None, **kwargs):
    """
    Stage 1 Slew Limiter: Catches high-velocity disk/watchdog mutations 
    and buffers them in RAM to absorb the I/O storm before hitting SQLite.
    """
    global _TOPOLOGY_SLEW_THREAD
    if _TOPOLOGY_SLEW_THREAD is None or not _TOPOLOGY_SLEW_THREAD.is_alive():
        _TOPOLOGY_SLEW_THREAD = threading.Thread(target=_topology_slew_limiter_loop, daemon=True)
        _TOPOLOGY_SLEW_THREAD.start()

    if not mutations: return
    for m in mutations:
        if m.get("ignore_ledger"):
            continue
        filepath = m.get("filepath")
        if not filepath or str(filepath).startswith(("ws://", "ctx://")):
            continue

        is_dir = str(filepath).endswith(('/', '\\'))
        uri = InSetuURI(filepath)
        if uri.scheme and uri.scheme != "vfs":
            continue
        norm_path = str(uri)
        if is_dir and not norm_path.endswith('/'):
            norm_path += '/'

        op = m.get("operation", "save")
        _TOPOLOGY_RAM_QUEUE.put_nowait((workspace_id, {"filepath": norm_path, "operation": op}))
def _git_ignored_paths(repo_path, rel_paths, repo_cfg, live_cfg):
    """
    Returns the subset of repo-relative paths that git ignores (.gitignore, .git/info/exclude,
    core.excludesFile), so incremental events agree with the full scan, which lists files with
    `git ls-files --cached --others --exclude-standard`. Tracked files are never reported, and
    force_include and managed directories are exempt, matching get_valid_workspace_files.
    Fails open (returns nothing) outside a git work tree or when git is unavailable.
    """
    if not rel_paths or not repo_path or (repo_cfg or {}).get("archive_type", "repo") != "repo":
        return set()
    forced = set((repo_cfg or {}).get("force_include") or [])
    managed = (repo_cfg or {}).get("repo_managed_dirs")
    managed_dirs = set(managed if managed is not None else ((live_cfg or {}).get("managed_dirs") or [])) | {".insetu-data"}
    candidates = sorted({
        p for p in rel_paths
        if p and p not in forced and not any(p == m or p.startswith(m.rstrip("/") + "/") for m in managed_dirs)
    })
    if not candidates:
        return set()
    try:
        res = execute_binary(
            ["git", "-c", "core.quotepath=false", "check-ignore", "--stdin", "-z"],
            cwd=repo_path, capture_output=True, text=True, input="\0".join(candidates) + "\0",
        )
    except Exception:
        return set()
    # Exit 0: some paths ignored, 1: none ignored, anything else: not a git repo or an error.
    if res.returncode != 0:
        return set()
    return {p for p in (res.stdout or "").split("\0") if p}


def resolve_topology_buffer(workspace_id):
    """Processes any pending events in topology_event_buffer, updates topology_ledger, and emits topology_resolved."""
    ctx = topology_bp.get_context(workspace_id)
    conn = ctx.db
    events = conn.execute("SELECT id, filepath, mutation_type FROM topology_event_buffer ORDER BY timestamp ASC").fetchall()
    if not events:
        return []

    hooks.emit('vfs_manifest_mutated', workspace_id=workspace_id)
    event_ids = [e["id"] for e in events]
    placeholders = ",".join(["?"] * len(event_ids))
    conn.execute(f"DELETE FROM topology_event_buffer WHERE id IN ({placeholders})", tuple(event_ids))
    conn.commit()

    dirty_buckets = set()
    dirty_repos = set()
    target_repos = ctx.config.get("target_repos", [])
    target_repos_map = {r.get("repo_dir"): r for r in target_repos if r and r.get("repo_dir")}

    final_events = []
    # Safely expand directories without iterating over a mutating list
    for e in events:
        raw_fp = e["filepath"]
        op = e["mutation_type"]

        uri = InSetuURI(raw_fp)
        naive_repo, naive_rel = uri.repo, uri.path
        clean_fp = f"{naive_repo}/{naive_rel}".strip('/')

        repo_dir = "global"
        rel_path = clean_fp

        # Determine true repo_dir via longest prefix match
        best_repo_len = -1
        for r_dir in target_repos_map.keys():
            if clean_fp == r_dir or clean_fp.startswith(r_dir + '/'):
                if len(r_dir) > best_repo_len:
                    best_repo_len = len(r_dir)
                    repo_dir = r_dir
                    rel_path = clean_fp[len(r_dir):].lstrip('/')
        is_dir = raw_fp.endswith('/')
        if not is_dir and op == "save":
            repo_base = Path(get_repo_path(repo_dir, workspace_id)) if repo_dir != "global" else None
            if repo_base:
                target_dir = repo_base / rel_path.strip('/')
                if target_dir.exists() and target_dir.is_dir():
                    is_dir = True
        # Prevent root repository directories from expanding and causing an infinite loop
        if op == "save" and is_dir and rel_path.strip('/'):
            repo_cfg = target_repos_map.get(repo_dir)
            if repo_cfg:
                # Let the VFS walk the logical directory, natively handling all exclusions and slashes
                logical_target = f"vfs://{repo_dir}/{rel_path.strip('/')}"
                for vfs_fp in ctx.vfs.walk(logical_target):
                    final_events.append({"filepath": vfs_fp, "mutation_type": "save"})
        else:
            final_events.append({"filepath": raw_fp, "mutation_type": op})

    # Batch one `git check-ignore` per repo so a write storm (pip writing *.egg-info, a build
    # dropping dist/) cannot slip ignored files into the ledger that the full scan would skip.
    ignore_candidates = {}
    for e in final_events:
        if e["mutation_type"] in ("delete", "deleted", "remove", "removed"):
            continue
        c_uri = InSetuURI(e["filepath"])
        c_fp = f"{c_uri.repo}/{c_uri.path}".strip('/')
        c_repo, c_rel, c_len = None, None, -1
        for r_dir in target_repos_map.keys():
            if (c_fp == r_dir or c_fp.startswith(r_dir + '/')) and len(r_dir) > c_len:
                c_repo, c_rel, c_len = r_dir, c_fp[len(r_dir):].lstrip('/'), len(r_dir)
        if c_repo and c_rel:
            ignore_candidates.setdefault(c_repo, set()).add(c_rel)
    live_cfg = ctx.config
    git_ignored = {
        r_dir: _git_ignored_paths(get_repo_path(r_dir, workspace_id), rels, target_repos_map.get(r_dir), live_cfg)
        for r_dir, rels in ignore_candidates.items()
    }

    for e in final_events:
        raw_fp = e["filepath"]

        uri = InSetuURI(raw_fp)
        naive_repo, naive_rel = uri.repo, uri.path
        clean_fp = f"{naive_repo}/{naive_rel}".strip('/')

        repo_dir = "global"
        rel_path = clean_fp

        # Determine true repo_dir via longest prefix match
        best_repo_len = -1
        for r_dir in target_repos_map.keys():
            if clean_fp == r_dir or clean_fp.startswith(r_dir + '/'):
                if len(r_dir) > best_repo_len:
                    best_repo_len = len(r_dir)
                    repo_dir = r_dir
                    rel_path = clean_fp[len(r_dir):].lstrip('/')
        clean_filepath = f"{repo_dir}/{rel_path}" if repo_dir != "global" else rel_path
        vfs_fp = f"vfs://{clean_filepath}"

        e["filepath"] = vfs_fp
        filepath = vfs_fp
        op = e["mutation_type"]
        if op in ("delete", "deleted", "remove", "removed"):
            dirty_repos.add(repo_dir)

            # Query the ledger before deletion to perfectly identify all affected structural buckets
            if raw_fp.endswith('/'):
                affected = conn.execute("SELECT bucket_id FROM topology_ledger WHERE filepath = ? OR filepath LIKE ?", (filepath, filepath + "/%")).fetchall()
                conn.execute("DELETE FROM topology_ledger WHERE filepath = ? OR filepath LIKE ?", (filepath, filepath + "/%"))
            else:
                affected = conn.execute("SELECT bucket_id FROM topology_ledger WHERE filepath = ?", (filepath,)).fetchall()
                conn.execute("DELETE FROM topology_ledger WHERE filepath = ?", (filepath,))

            for row in affected:
                dirty_buckets.add(f"{repo_dir}::{row['bucket_id']}")
        else:
            repo_cfg = target_repos_map.get(repo_dir)
            rel_to_repo = rel_path
            if repo_cfg and not is_file_tracked_by_sieve(rel_to_repo, repo_cfg, ctx.config, repo_dir=repo_dir):
                continue
            if rel_to_repo in git_ignored.get(repo_dir, ()):
                # Ignored by git: never ledger it, and evict a row an older build may have added.
                affected = conn.execute("SELECT bucket_id FROM topology_ledger WHERE filepath = ?", (filepath,)).fetchall()
                if affected:
                    conn.execute("DELETE FROM topology_ledger WHERE filepath = ?", (filepath,))
                    dirty_repos.add(repo_dir)
                    for row in affected:
                        dirty_buckets.add(f"{repo_dir}::{row['bucket_id']}")
                continue

            sub_buckets = repo_cfg.get("sub_buckets", []) if repo_cfg else []
            b, module = resolve_file_bucket(rel_to_repo, sub_buckets, repo_dir=repo_dir)
            if b and module:
                bucket_id = module
            elif b:
                bucket_id = b.get("id") or "main"
            else:
                bucket_id = "main"

            # Physical Delta Gate: Compare physical disk mtime against existing ledger timestamp
            repo_base = Path(get_repo_path(repo_dir, workspace_id)) if repo_dir != "global" else None
            phys_mtime = None
            if repo_base:
                phys_file = repo_base / rel_to_repo
                if phys_file.exists() and phys_file.is_file():
                    try: phys_mtime = phys_file.stat().st_mtime
                    except Exception: pass
            if phys_mtime is not None:
                mutation_ts = max(float(phys_mtime), time.time())
                conn.execute(
                    "INSERT OR REPLACE INTO topology_ledger (filepath, repo, bucket_id, timestamp) VALUES (?, ?, ?, ?)",
                    (filepath, repo_dir, bucket_id, mutation_ts)
                )
                dirty_repos.add(repo_dir)
                dirty_buckets.add(f"{repo_dir}::{bucket_id}")
    # Refresh git_status across any touched repositories without overwriting file mtime timestamps
    status_updates = []
    for touched_repo in dirty_repos:
        if touched_repo == "global":
            continue
        r_path = get_repo_path(touched_repo, workspace_id)
        g_map = _get_repo_git_status_map(r_path)
        repo_rows = conn.execute("SELECT filepath, git_status FROM topology_ledger WHERE repo = ?", (touched_repo,)).fetchall()
        for r_row in repo_rows:
            fp = r_row["filepath"]
            rel_f = InSetuURI(fp).path
            new_st = g_map.get(rel_f, "")
            if (r_row["git_status"] or "") != new_st:
                status_updates.append((new_st, fp))

    if status_updates:
        conn.executemany("UPDATE topology_ledger SET git_status = ? WHERE filepath = ?", status_updates)
    conn.commit()
    # Re-invalidate after the commit: a reader between the invalidation at the top and this commit cached the old ledger.
    hook_request_vfs_manifest.invalidate(workspace_id=workspace_id)

    hooks.emit(
        'topology_resolved', 
        workspace_id=workspace_id, 
        dirty_repos=list(dirty_repos), 
        dirty_buckets=list(dirty_buckets), 
        events=final_events
    )

    return final_events
@topology_bp.on('mutate_workspace_config')
def mount_topology_volumes_dynamically(cfg, workspace_id=None, **kwargs):
    """Dynamically remounts VFS volumes whenever the configuration changes."""
    _, ws_root = get_workspace_physics(workspace_id)
    mount_volume(workspace_id, 'vfs', '', ws_root)
    for repo_cfg in cfg.get("target_repos", []):
        repo_dir = repo_cfg.get("repo_dir")
        if repo_dir:
            p_path = repo_cfg.get("physical_path")
            if p_path:
                repo_path = Path(p_path).expanduser().resolve().as_posix()
            else:
                repo_path = Path(ws_root).joinpath(repo_dir).resolve().as_posix()
            mount_volume(workspace_id, 'vfs', repo_dir, repo_path)
@topology_bp.on('workspace_boot', priority=1)
def init_topology_on_boot(workspace_id=None, **kwargs):
    """Topology owns the boot sequence. Maps the drive immediately."""
    ctx = topology_bp.get_context(workspace_id)

    # Force a mount evaluation during boot using the current config
    mount_topology_volumes_dynamically(ctx.config, workspace_id)
    try:
        ctx.db.execute("CREATE INDEX IF NOT EXISTS idx_topology_repo ON topology_ledger(repo)")
        ctx.db.execute("CREATE INDEX IF NOT EXISTS idx_topology_bucket ON topology_ledger(bucket_id)")
        ctx.db.execute("UPDATE topology_ledger SET filepath = 'vfs://' || filepath WHERE filepath NOT LIKE '%://%'")
        ctx.db.commit()
    except Exception:
        pass
    job_id = f"tpl_boot_{uuid.uuid4().hex[:8]}"
    ctx.jobs.submit("boot_scan_task", job_category="ui_blocking", job_id=job_id, is_pipeline=True)
@topology_bp.worker("boot_scan_task")
def _background_boot_scan(ctx, is_pipeline: bool = False, job_id: Optional[str] = None):
    ctx.jobs.update_progress("Initializing workspace topology...")
    force_topology_scan(workspace_id=ctx.workspace_id)
    # Flush dirty tracking to ensure clean boot UI state
    hooks.emit('topology_resolved', workspace_id=ctx.workspace_id, dirty_repos=[], dirty_buckets=[], events=[], clear_all=True)
    hooks.emit('topology_boot_complete', workspace_id=ctx.workspace_id)


@topology_bp.worker("resolve_topology_task")
def _background_resolve_topology(ctx, job_id: Optional[str] = None):
    """
    Processes the event buffer after physical disk I/O settles, updates the tracking 
    ledger, and emits `topology_resolved` to awaken downstream compilers.
    """
    if os.environ.get("INSETU_DEBUG") == "1":
        print(f"🌍 [TOPOLOGY TELEMETRY] Worker starting. Sleeping for 2s debounce...")
    # Absolute Settlement Barrier: 2.0 second debounce to outlast watchdog bursts (e.g. git checkout)
    time.sleep(2.0)

    total_resolved = 0
    while True:
        ctx.jobs.update_progress("Resolving physical topology boundaries...")
        events = resolve_topology_buffer(ctx.workspace_id)
        if not events:
            break
        total_resolved += len(events)

    if os.environ.get("INSETU_DEBUG") == "1":
        print(f"🌍 [TOPOLOGY TELEMETRY] Worker resolved {total_resolved} events. Emitted topology_resolved.")
    if total_resolved == 0:
        return {"message": "No topology events to resolve."}

    return {"message": f"Topology settled. Resolved {total_resolved} events."}
_GITIGNORE_REGEX_CACHE = {}


def _compile_gitignore_regex(pattern: str):
    """Compiles a single .gitignore pattern into a (regex, is_dir_only) tuple."""
    cached = _GITIGNORE_REGEX_CACHE.get(pattern)
    if cached is not None:
        return cached

    p = pattern.strip()
    is_dir_only = p.endswith("/")
    if is_dir_only:
        p = p.rstrip("/")

    is_anchored = p.startswith("/")
    if is_anchored:
        p = p.lstrip("/")
    elif "/" in p:
        is_anchored = True

    if not p:
        return None

    # Convert .gitignore glob syntax (*, **, ?) into regex
    regex_parts = []
    i = 0
    n = len(p)
    while i < n:
        if p[i:i+3] == "**/":
            regex_parts.append("(?:.+/)?")
            i += 3
        elif p[i:i+3] == "/**":
            regex_parts.append("(?:/.*)?")
            i += 3
        elif p[i:i+2] == "**":
            regex_parts.append(".*")
            i += 2
        elif p[i] == "*":
            regex_parts.append("[^/]*")
            i += 1
        elif p[i] == "?":
            regex_parts.append("[^/]")
            i += 1
        else:
            regex_parts.append(re.escape(p[i]))
            i += 1

    body = "".join(regex_parts)
    if is_anchored:
        if is_dir_only:
            full_pat = f"^{body}(?:/.*)?$"
        else:
            full_pat = f"^{body}(?:/.*)?$"
    else:
        if is_dir_only:
            full_pat = f"^(?:.+/)?{body}/.*$"
        else:
            full_pat = f"^(?:.+/)?{body}(?:/.*)?$"

    compiled = (re.compile(full_pat, re.IGNORECASE), is_dir_only)
    if len(_GITIGNORE_REGEX_CACHE) < 2048:
        _GITIGNORE_REGEX_CACHE[pattern] = compiled
    return compiled


def matches_gitignore_patterns(rel_path: str, patterns: list) -> bool:
    """
    Evaluates a relative POSIX path against a list of .gitignore-style patterns.
    Supports trailing-slash directory matches ('archived/'), root-anchored paths ('/build/'),
    floating globs ('*.pyc', 'temp_*'), double-star ('**'), and sequential '!negation' rules.
    """
    if not rel_path or not patterns:
        return False

    clean_path = rel_path.replace("\\", "/").lstrip("./").strip("/")
    if not clean_path:
        return False

    matched = False
    for raw_pat in patterns:
        if not raw_pat or not isinstance(raw_pat, str):
            continue
        pat = raw_pat.strip()
        if not pat or pat.startswith("#"):
            continue

        is_negated = pat.startswith("!")
        if is_negated:
            pat = pat[1:].strip()
            if not pat:
                continue

        compiled = _compile_gitignore_regex(pat)
        if not compiled:
            continue
        regex, _ = compiled
        if regex.match(clean_path):
            matched = not is_negated

    return matched


def is_file_tracked_by_sieve(rel_path: str, config: dict, live_cfg: dict, repo_dir: str = "") -> bool:
    """
    Single Source of Truth (SSOT) Hierarchical VFS Sieve.
    Evaluates a repository-relative path against Nullable Override rules, .gitignore patterns,
    prefixes, ignore exceptions, and force-include overrides.
    """
    norm_path = rel_path[2:] if rel_path.startswith("./") else rel_path
    norm_path = norm_path.replace("\\", "/").strip("/")
    if not norm_path:
        return False

    forced_files = set(config.get("force_include") or [])
    if norm_path in forced_files:
        return True

    if config.get("prefix") and not norm_path.startswith(config.get("prefix")):
        return False

    if repo_dir == ".insetu" and (norm_path.startswith(("cache/", "ext/")) or "/cache/" in norm_path or "/ext/" in norm_path):
        return False

    p_obj = Path(norm_path)
    fname = p_obj.name.lower()

    if config.get("apply_ignore", True):
        ignore_exceptions = config.get("ignore_exceptions") or []
        is_excepted = any(
            norm_path.startswith(exc.lstrip("/")) for exc in ignore_exceptions if exc
        ) or matches_gitignore_patterns(norm_path, ignore_exceptions)

        if not is_excepted:
            raw_dirs = (
                config.get("repo_ignore_dirs")
                if config.get("repo_ignore_dirs") is not None
                else (live_cfg.get("ignore_dirs") or [])
            )
            raw_files = (
                config.get("repo_ignore_files")
                if config.get("repo_ignore_files") is not None
                else (live_cfg.get("ignore_files") or [])
            )
            raw_patterns = (
                config.get("repo_ignore_patterns")
                if config.get("repo_ignore_patterns") is not None
                else (live_cfg.get("ignore_patterns") or [])
            )

            # Synthesize unified .gitignore pattern list from dirs, files, and patterns
            combined_patterns = []
            for d in (raw_dirs or []):
                d_clean = str(d).strip()
                if d_clean:
                    combined_patterns.append(d_clean if d_clean.endswith("/") else f"{d_clean}/")
            for f in (raw_files or []):
                f_clean = str(f).strip()
                if f_clean:
                    combined_patterns.append(f_clean)
            for p in (raw_patterns or []):
                p_clean = str(p).strip()
                if p_clean:
                    combined_patterns.append(p_clean)

            if matches_gitignore_patterns(norm_path, combined_patterns):
                return False

    if fname in (".gitkeep", ".keep"):
        return True

    ext = p_obj.suffix.lower()
    allowed_exts = set(
        (e.lower() for e in config.get("exts"))
        if config.get("exts") is not None
        else (e.lower() for e in (live_cfg.get("include_extensions") or []))
    )
    return ext in allowed_exts or fname in allowed_exts


def get_valid_workspace_files(repo_path, config, workspace_id=None):
    live_cfg = load_config(workspace_id)
    archive_type = config.get("archive_type", "repo")

    def _fallback_rglob():
        fb_files = set()
        for p in Path(repo_path).rglob('*'):
            if p.is_file() and '.git' not in p.parts and 'node_modules' not in p.parts and '__pycache__' not in p.parts:
                try: fb_files.add(p.relative_to(repo_path).as_posix())
                except ValueError: pass
        return fb_files
    if archive_type == "repo":
        if os.path.exists(repo_path):
            try:
                check_tree = execute_binary(['git', 'rev-parse', '--is-inside-work-tree'], 
                                            capture_output=True, text=True, cwd=repo_path)
                if check_tree.returncode != 0 or 'true' not in check_tree.stdout.lower():
                    execute_binary(['git', 'init'], capture_output=True, cwd=repo_path)
                    if not os.listdir(repo_path) or (len(os.listdir(repo_path)) == 1 and '.git' in os.listdir(repo_path)):
                        execute_vfs_save(workspace_id, f"vfs://{config.get('repo_dir')}/.gitkeep", "", data={"ignore_ledger": True})
            except Exception:
                pass
        try:
            result = execute_binary(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], 
                                    capture_output=True, text=True, check=True, cwd=repo_path)
            git_files = set(result.stdout.splitlines())
        except Exception:
            git_files = _fallback_rglob()
    else:
        git_files = _fallback_rglob()

    repo_p = Path(repo_path)

    resolved_managed = config.get("repo_managed_dirs") if config.get("repo_managed_dirs") is not None else (live_cfg.get("managed_dirs") or [])
    managed_scan_dirs = set(resolved_managed) | {".insetu-data"}
    for m_dir in managed_scan_dirs:
        m_path = repo_p / m_dir
        if m_path.exists() and m_path.is_dir():
            for p in m_path.rglob('*'):
                if p.is_file():
                    try: git_files.add(p.relative_to(repo_p).as_posix())
                    except ValueError: pass

    valid_files = set()
    repo_dir_name = config.get("repo_dir") or repo_p.name

    for file in git_files:
        norm_path = file[2:] if file.startswith("./") else file
        target_f = repo_p / norm_path
        if not target_f.is_file():
            continue
        if is_file_tracked_by_sieve(norm_path, config, live_cfg, repo_dir=repo_dir_name):
            valid_files.add(norm_path)

    for forced_file in (config.get("force_include") or []):
        if (repo_p / forced_file).exists(): 
            valid_files.add(forced_file)

    return sorted(list(valid_files))
_DROPPED_BUCKET_SENTINEL = {
    "id": "_dropped",
    "title": "Dropped Files",
    "exclude_from_context": True,
    "exclude_from_diffs": True,
    "is_system": True
}


def resolve_file_bucket(filepath, sub_buckets, repo_dir=""):
    clean_filepath = re.sub(r'^(?:\[[A-Z?!\s]{1,2}\]\s+|[A-Z?!\s]{2}\s+)', '', filepath).strip()

    if ' -> ' in clean_filepath:
        clean_filepath = clean_filepath.split(' -> ')[-1].strip()

    clean_filepath_lower = clean_filepath.lower()
    safe_repo_prefix = (repo_dir.lower() + "/") if repo_dir else ""

    for b in (sub_buckets or []):
        if not b or not isinstance(b, dict):
            continue

        matched_prefix = None
        dynamic_module = None
        prefix = b.get("dynamic_split_prefix")

        if prefix:
            prefix_lower = prefix.lower()
            if prefix_lower == "." or clean_filepath_lower.startswith(prefix_lower):
                parts = clean_filepath.split("/")
                module_idx = len([p for p in prefix.split('/') if p and p != '.'])
                if len(parts) > module_idx + 1:
                    matched_prefix = "" if prefix_lower == "." else prefix
                    dynamic_module = parts[module_idx]
                else:
                    continue
        elif b.get("match_prefixes"):
            for p in b["match_prefixes"]:
                p_lower = p.lower()
                if clean_filepath_lower.startswith(p_lower):
                    matched_prefix = p
                    break
                if safe_repo_prefix and p_lower.startswith(safe_repo_prefix):
                    stripped_p = p_lower[len(safe_repo_prefix):]
                    if stripped_p and clean_filepath_lower.startswith(stripped_p):
                        matched_prefix = stripped_p
                        break

        if matched_prefix is not None:
            # Evaluate sub-bucket .gitignore patterns against both repo-relative and bucket-relative paths
            bucket_rel = clean_filepath[len(matched_prefix):].lstrip("/") if matched_prefix else clean_filepath

            drop_pats = b.get("drop_patterns") or []
            if drop_pats and (
                matches_gitignore_patterns(clean_filepath, drop_pats)
                or (bucket_rel and matches_gitignore_patterns(bucket_rel, drop_pats))
            ):
                return dict(_DROPPED_BUCKET_SENTINEL), None

            ignore_pats = b.get("ignore_patterns") or []
            if ignore_pats and (
                matches_gitignore_patterns(clean_filepath, ignore_pats)
                or (bucket_rel and matches_gitignore_patterns(bucket_rel, ignore_pats))
            ):
                continue

            return b, dynamic_module

    return None, None
def resolve_owning_workspaces(event_name, **kwargs):
    """Domain-aware spatial router for OS lifecycle events."""
    if event_name != 'vfs_mutated': return set()
    mutations = kwargs.get('mutations', [])
    origin_workspace_id = kwargs.get('workspace_id')
    owning_workspaces = set()

    all_ws_ids = get_all_workspace_ids()

    for m in mutations:
        filepath = m.get('filepath')
        if not filepath: continue

        # 1. Elevate the logical alias into an absolute physical identity
        abs_target = None
        if Path(filepath).is_absolute():
            abs_target = Path(filepath).resolve().as_posix()
        elif origin_workspace_id:
            resolved = resolve_physical_path(filepath, origin_workspace_id)
            if resolved:
                abs_target = Path(resolved).resolve().as_posix()

        # If we cannot establish physical identity, default to origin to prevent cross-tenant leaks
        if not abs_target:
            if origin_workspace_id: owning_workspaces.add(origin_workspace_id)
            continue

        # 2. Map Physical Identity to All Workspaces
        for ws_id in all_ws_ids:
            try:
                _, ws_root = get_workspace_physics(ws_id)
                abs_ws_root = Path(ws_root).resolve().as_posix()
                cfg = load_config(ws_id)
                target_repos = cfg.get("target_repos", [])

                if abs_target.startswith(abs_ws_root + '/') or abs_target == abs_ws_root:
                    owning_workspaces.add(ws_id)
                    continue

                for repo in target_repos:
                    p_path = repo.get("physical_path")
                    if p_path:
                        abs_p = Path(p_path).expanduser().resolve().as_posix()
                        if abs_target.startswith(abs_p + '/') or abs_target == abs_p:
                            owning_workspaces.add(ws_id)
                            break
            except Exception:
                continue

    return owning_workspaces
# Dependency Injection: Register the Tier 2 router with the Tier 1 kernel
set_workspace_router(resolve_owning_workspaces)
class VerifyPlanTargetsPayload(TypedDict, total=False):
    plan_text: str
    plan_file: Optional[str]


@topology_bp.route('overview', methods=['GET'], docstring="[sync] Compiles a lightweight structural overview of tracked repositories, sub-buckets, and CODE_INDEX.md headers.")
def api_topology_overview(ctx):
    """Compiles a lightweight structural overview of tracked repositories, sub-buckets, and CODE_INDEX.md headers."""
    cfg = ctx.config
    repos_summary = []
    overview_lines = ["=== WORKSPACE TOPOLOGY OVERVIEW ==="]
    for r_cfg in cfg.get("target_repos", []):
        r_dir = r_cfg.get("repo_dir")
        if not r_dir:
            continue
        buckets = [b.get("id") for b in r_cfg.get("sub_buckets", []) if b.get("id") and not b.get("is_system")]
        code_idx = ctx.vfs.read(f"vfs://{r_dir}/CODE_INDEX.md") or ""
        idx_preview = "\n".join(code_idx.splitlines()[:80]) if code_idx else "[No CODE_INDEX.md generated]"
        repos_summary.append({
            "repo": r_dir,
            "domain": r_cfg.get("domain", "Workspaces"),
            "buckets": buckets,
        })
        overview_lines.append(f"\n## Repository: {r_dir} (Buckets: {', '.join(buckets) if buckets else 'main'})\n{idx_preview}")

    return {
        "repos": repos_summary,
        "overview_text": "\n".join(overview_lines),
    }
@topology_bp.route('verify_plan_targets', methods=['POST'], request_schema=VerifyPlanTargetsPayload, docstring="[sync] Verifies that vfs:// file targets referenced in an architectural plan exist or are marked as new files.")
def api_topology_verify_plan_targets(ctx):
    """Verifies that vfs:// file targets referenced in an architectural plan exist or are marked as new files."""
    data = ctx.payload or {}
    plan_text = str(data.get("plan_text") or "")
    plan_file = str(data.get("plan_file") or "").strip()
    if not plan_text and plan_file:
        plan_text = ctx.vfs.read(plan_file) or ""

    found_uris = sorted(set(re.findall(r'(?:vfs|ctx)://[a-zA-Z0-9_./-]+', plan_text)))
    verified: List[str] = []
    missing: List[str] = []

    for raw_uri in found_uris:
        clean_uri = raw_uri.rstrip(".,;:)`'\"")
        uri_obj = InSetuURI(clean_uri)
        if uri_obj.scheme == "vfs":
            phys = ctx.resolve_path(str(uri_obj), must_exist=True, allow_heal=False)
            if phys:
                verified.append(str(uri_obj))
            else:
                missing.append(str(uri_obj))
        else:
            verified.append(str(uri_obj))
    return {
        "status": "success",
        "verified_targets": verified,
        "missing_or_new_targets": missing,
        "total_referenced": len(found_uris),
    }


class AuditUpkeepPayload(TypedDict, total=False):
    repo: Optional[str]
    scope: Optional[str]
    stage: Optional[str]
    god_object_min_lines: Optional[int]
    god_object_min_symbols: Optional[int]


@topology_bp.route('audit_upkeep', methods=['GET', 'POST'], request_schema=AuditUpkeepPayload, docstring="[sync] Deterministically audits workspace documentation/symbol drift, oversized God-object decomposition candidates, and test suite relevance.")
def api_topology_audit_upkeep(ctx):
    """Deterministically audits workspace documentation/symbol drift, God-object candidates, and test relevance."""
    from insetu.core.cartographer.cartographer import (
        extract_file_symbols as _extract_file_symbols,
        extract_symbol_source_slice as _extract_symbol_source_slice,
        map_repositories as _map_repositories,
    )
    data = ctx.payload or {}
    raw_scope = str(data.get("scope") or "all").strip().lower()
    if raw_scope in ("doc", "docs", "documentation", "index"):
        scope = "docs"
    elif raw_scope in ("mod", "modularize", "refactor", "god", "split"):
        scope = "modularize"
    elif raw_scope in ("test", "tests", "testing"):
        scope = "tests"
    else:
        scope = "all"

    min_lines = int(data.get("god_object_min_lines") or 550)
    min_symbols = int(data.get("god_object_min_symbols") or 15)
    target_configs = ctx.config.get("target_repos", [])
    requested_repo = str(data.get("repo") or "").strip()
    active_repos = [
        c.get("repo_dir")
        for c in target_configs
        if c.get("repo_dir") and (not requested_repo or c.get("repo_dir") == requested_repo)
    ]

    # Ensure Cartographer symbol_ledger is fresh before reading drift state
    try:
        _map_repositories(ctx.workspace_id, silent=True, target_repos=active_repos or None)
        ctx.sync_vfs_barrier()
    except Exception:
        pass

    missing_comments: List[Dict[str, Any]] = []
    stale_comments: List[Dict[str, Any]] = []
    broken_doc_targets: List[Dict[str, str]] = []
    god_objects: List[Dict[str, Any]] = []
    stale_test_imports: List[Dict[str, Any]] = []
    untested_capabilities: List[Dict[str, str]] = []
    target_files: List[str] = []

    def _add_target(uri_str: str):
        if uri_str and uri_str not in target_files and len(target_files) < 12:
            target_files.append(uri_str)

    # --- PILLAR 1: DOCUMENTATION & MUTATED SYMBOL DRIFT ---
    if scope in ("all", "docs"):
        for r_cfg in target_configs:
            r_dir = r_cfg.get("repo_dir")
            if not r_dir or (active_repos and r_dir not in active_repos):
                continue
            idx_uri = f"vfs://{r_dir}/docs/CODE_INDEX.md" if r_cfg.get("is_core_chassis") else f"vfs://{r_dir}/CODE_INDEX.md"
            idx_text = ctx.vfs.read(idx_uri) or ""
            if idx_text:
                for line_no, line in enumerate(idx_text.splitlines(), start=1):
                    if "[comment required]" in line:
                        clean_item = line.split("#", 1)[0].lstrip(" │├└─\t").strip()
                        missing_comments.append({
                            "index_uri": idx_uri,
                            "line": line_no,
                            "entry": clean_item,
                        })
                if any(m["index_uri"] == idx_uri for m in missing_comments):
                    _add_target(idx_uri)

        try:
            cart_db = ctx.get_db("cartographer")
            q = "SELECT filepath, symbol_name, signature, body_hash, verified_hash, comment, status FROM symbol_ledger WHERE status IN ('stale', 'missing')"
            params: tuple = ()
            if active_repos:
                placeholders = ",".join(["?"] * len(active_repos))
                q += f" AND repo IN ({placeholders})"
                params = tuple(active_repos)
            rows = cart_db.execute(q, params).fetchall()
            for r in rows:
                fp = r["filepath"]
                if r["status"] == "stale" and len(stale_comments) < 20:
                    f_content = ctx.vfs.read(fp) or ""
                    slice_info = _extract_symbol_source_slice(fp, f_content, r["symbol_name"]) if f_content else None
                    stale_comments.append({
                        "filepath": fp,
                        "symbol_name": r["symbol_name"],
                        "signature": r["signature"],
                        "current_comment": r["comment"],
                        "body_hash": r["body_hash"],
                        "verified_hash": r["verified_hash"],
                        "source_slice": (slice_info or {}).get("source", "")[:1500],
                    })
                    _add_target(fp)
        except Exception:
            pass

        # Scan README.md and docs/*.md for broken vfs:// file references
        for r_dir in active_repos:
            for f_uri in get_topology_files_for_repo(ctx.workspace_id, r_dir):
                if not f_uri.lower().endswith(".md") or f_uri.endswith("CODE_INDEX.md") or "/archived/" in f_uri or "/superseded/" in f_uri:
                    continue
                md_text = ctx.vfs.read(f_uri) or ""
                for raw_ref in set(re.findall(r'vfs://[a-zA-Z0-9_./-]+', md_text)):
                    clean_ref = raw_ref.rstrip(".,;:)`'\"")
                    ref_uri = InSetuURI(clean_ref)
                    # Skip placeholder template examples in documentation
                    if any(tok in clean_ref for tok in ("repo/", "path/to/", "<", "{", "example", "source.py", "target_file.py", "my_")):
                        continue
                    if ref_uri.repo in active_repos and not ctx.resolve_path(str(ref_uri), must_exist=True, allow_heal=False):
                        broken_doc_targets.append({"doc_file": f_uri, "broken_ref": str(ref_uri)})
                        _add_target(f_uri)

    # --- PILLAR 2: ZERO-LOGIC GOD-OBJECT DECOMPOSITION CANDIDATES ---
    all_defined_py_symbols = set()
    for r_dir in active_repos:
        for f_uri in get_topology_files_for_repo(ctx.workspace_id, r_dir):
            rel_p = InSetuURI(f_uri).path
            ext = Path(rel_p).suffix.lower()
            if ext not in (".py", ".js", ".mjs", ".ts", ".tsx"):
                continue
            content = ctx.vfs.read(f_uri)
            if not content:
                continue
            syms = _extract_file_symbols(rel_p, content) or []
            for s in syms:
                all_defined_py_symbols.add(s["name"])

            if scope in ("all", "modularize"):
                if "/tests/" in f_uri or rel_p.startswith("tests/") or "/vendor/" in f_uri:
                    continue
                line_count = len(content.splitlines())
                if line_count >= min_lines or len(syms) >= min_symbols:
                    god_objects.append({
                        "filepath": f_uri,
                        "line_count": line_count,
                        "symbol_count": len(syms),
                        "symbols": [
                            {
                                "name": s["name"],
                                "signature": s["signature"],
                                "lines": f"{s['start_line']}-{s['end_line']}",
                                "span_lines": max(1, int(s["end_line"]) - int(s["start_line"]) + 1),
                                "docstring": s.get("docstring") or "",
                            }
                            for s in syms
                        ],
                    })

    god_objects.sort(key=lambda x: (x["line_count"], x["symbol_count"]), reverse=True)
    god_objects = god_objects[:5]
    if scope in ("all", "modularize"):
        for go in god_objects[:2]:
            _add_target(go["filepath"])

    # --- PILLAR 3: TEST SUITE RELEVANCE ---
    if scope in ("all", "tests"):
        import ast as _ast
        test_files_content: List[Tuple[str, str]] = []
        for r_dir in active_repos:
            for f_uri in get_topology_files_for_repo(ctx.workspace_id, r_dir):
                rel_p = InSetuURI(f_uri).path
                if (rel_p.startswith("tests/") or "/tests/" in f_uri) and f_uri.endswith(".py"):
                    t_text = ctx.vfs.read(f_uri) or ""
                    if t_text:
                        test_files_content.append((f_uri, t_text))
                        try:
                            t_tree = _ast.parse(t_text)
                            for node in _ast.walk(t_tree):
                                if isinstance(node, _ast.ImportFrom) and node.module and node.module.startswith("insetu."):
                                    mod_rel = node.module.replace(".", "/")
                                    cand_py = f"vfs://{r_dir}/{mod_rel}.py"
                                    cand_init = f"vfs://{r_dir}/{mod_rel}/__init__.py"
                                    cand_nested = f"vfs://{r_dir}/insetu/{mod_rel}.py"
                                    cand_nested_init = f"vfs://{r_dir}/insetu/{mod_rel}/__init__.py"
                                    resolved_mod_uri = next(
                                        (
                                            c for c in (cand_py, cand_init, cand_nested, cand_nested_init)
                                            if ctx.resolve_path(c, must_exist=True, allow_heal=False)
                                        ),
                                        None,
                                    )
                                    if resolved_mod_uri and resolved_mod_uri.endswith(".py"):
                                        mod_src = ctx.vfs.read(resolved_mod_uri) or ""
                                        for alias in node.names:
                                            imp_name = alias.name
                                            if imp_name != "*" and not re.search(rf'\b{re.escape(imp_name)}\b', mod_src):
                                                stale_test_imports.append({
                                                    "test_file": f_uri,
                                                    "line": node.lineno,
                                                    "module": node.module,
                                                    "missing_symbol": imp_name,
                                                })
                                                _add_target(f_uri)
                        except Exception:
                            pass

        combined_tests = "\n".join(t_text for _, t_text in test_files_content)
        if combined_tests:
            for cap_id, spec in sorted(ctx.get_registered_capabilities().items()):
                action = spec.get("action") or ""
                if action in ("settings", "settings.schema"):
                    continue
                slash_form = cap_id.replace(".", "/")
                if cap_id not in combined_tests and slash_form not in combined_tests and action not in combined_tests:
                    untested_capabilities.append({
                        "capability": cap_id,
                        "ext_name": spec.get("ext_name", ""),
                        "rule": spec.get("rule", ""),
                    })

    summary_counts = {
        "missing_comments": len(missing_comments),
        "stale_comments": len(stale_comments),
        "broken_doc_targets": len(broken_doc_targets),
        "god_objects": len(god_objects),
        "stale_test_imports": len(stale_test_imports),
        "untested_capabilities": len(untested_capabilities),
    }

    return {
        "status": "success",
        "scope": scope,
        "summary": summary_counts,
        "docs_drift": {
            "missing_comments": missing_comments[:30],
            "stale_comments": stale_comments[:15],
            "broken_doc_targets": broken_doc_targets[:20],
        },
        "god_objects": god_objects,
        "test_relevance": {
            "stale_test_imports": stale_test_imports[:20],
            "untested_capabilities": untested_capabilities[:20],
        },
        "target_files": target_files,
    }
