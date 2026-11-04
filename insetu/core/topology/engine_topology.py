import os
import re
import time
import uuid
import json
import fnmatch
import threading
import traceback
import queue
from pathlib import Path
from typing import TypedDict, Optional, List, Dict, Any, Union, Literal, Tuple
from insetu.core.sdk import (
    InSetuExtension,
    ExtensionContext,
    SettingsManager,
    get_connection,
    get_registered_settings_schemas,
    sse_bus,
    hooks,
    set_workspace_router,
    thread_safe_cache,
)
from insetu.core.directives import get_directives
from insetu.core.languages import (
    SUPPORTED_SYMBOL_EXTENSIONS,
    extract_file_symbols,
    extract_symbol_source_slice,
    get_language_provider,
)
from insetu.core.utils_core import (
    get_repo_path,
    execute_binary,
    InSetuURI,
    fold_vfs_events,
    parse_uri,
    parse_frontmatter,
    get_all_workspace_ids,
    get_workspace_physics,
    load_config,
    mount_volume,
    execute_vfs_save,
    resolve_physical_path,
)

_TARGET_REPOS_KEY = "target_repos"


def _target_repo_configs(cfg: Dict[str, Any]) -> List[Dict[str, Any]]:
    """The workspace's mounted repository configurations (the one place topology reads target_repos)."""
    return [r for r in (cfg.get(_TARGET_REPOS_KEY) or []) if isinstance(r, dict)]


TOPOLOGY_SETTINGS_SCHEMA = [
    {
        # Held in the repository's `.insetu-data/settings/topology.md`, never in workspace storage, so it stays
        # hidden from the Settings hub until the hub can show and edit repository tiers.
        "id": "landmarks",
        "type": "hidden",
        "scope": "repo",
        "about": "repo",
        "authority": "repo_content",
        "merge": "override",
        "default": {},
        "description": "Repository-relative paths or globs for each landmark kind (see get_landmark_kinds).",
    }
]

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
    settings_schema=TOPOLOGY_SETTINGS_SCHEMA,
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
    target_configs = _target_repo_configs(ctx.config)
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
    if not target_repos:
        # A full scan matches the current configuration, so later config_mutated events diff against it.
        with _SIEVE_FINGERPRINT_LOCK:
            _SIEVE_CONFIG_FINGERPRINTS[workspace_id or "default"] = _sieve_config_fingerprints(ctx.config, workspace_id)
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
def _ensure_sieve_reconciled(workspace_id: Optional[str] = None) -> None:
    wid = workspace_id or "default"
    with _SIEVE_FINGERPRINT_LOCK:
        is_cold = wid not in _SIEVE_CONFIG_FINGERPRINTS
    if is_cold:
        reconcile_topology_on_config_mutated(workspace_id=wid)


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


def clamp_uris_to_topology(
    workspace_id: Optional[str],
    candidate_uris,
    expand_dirs: bool = False,
    gather_only: bool = False,
) -> List[str]:
    """
    Clamps and optionally expands candidate URIs against topology_ledger:
    - Non-vfs:// URIs (ctx://, ws://) pass through unchanged.
    - vfs://<repo>/<path> file URIs are retained only if present in topology_ledger for <repo>.
    - vfs://<repo>/<dir>/ prefixes (when expand_dirs=True) expand to all tracked files in topology_ledger under that prefix.
    - When gather_only=True, files in '_dropped' or buckets with exclude_from_context=True are omitted.
    """
    if not candidate_uris:
        return []
    wid = workspace_id or "default"
    resolve_topology_buffer(wid)
    ctx = topology_bp.get_context(wid)
    live_cfg = ctx.config
    mounted_repos = {r.get("repo_dir"): r for r in _target_repo_configs(live_cfg) if r.get("repo_dir")}
    repo_files_cache: Dict[str, List[str]] = {}
    repo_set_cache: Dict[str, set] = {}

    def _excluded_buckets_for_repo(r_cfg: Optional[dict]) -> set:
        if not gather_only or not r_cfg:
            return {"_dropped"} if gather_only else set()
        if r_cfg.get("exclude_from_context"):
            return {"*"}
        excluded = {"_dropped"}
        for b in (r_cfg.get("sub_buckets") or []):
            if isinstance(b, dict) and b.get("exclude_from_context") and b.get("id"):
                excluded.add(b["id"])
        return excluded

    def _get_repo_tracked(r_dir: str) -> Tuple[List[str], set]:
        if r_dir not in repo_files_cache:
            r_cfg = mounted_repos.get(r_dir)
            excluded_b = _excluded_buckets_for_repo(r_cfg)
            if "*" in excluded_b:
                repo_files_cache[r_dir] = []
                repo_set_cache[r_dir] = set()
                return [], set()
            rows = ctx.db.execute("SELECT filepath, bucket_id FROM topology_ledger WHERE repo = ?", (r_dir,)).fetchall()
            tracked_list = [
                str(InSetuURI(r["filepath"]))
                for r in rows
                if not excluded_b or (r["bucket_id"] or "main") not in excluded_b
            ]
            if not rows and r_cfg:
                r_path = get_repo_path(r_dir, wid)
                if r_path and os.path.exists(r_path):
                    rel_valid = get_valid_workspace_files(r_path, r_cfg, wid)
                    sub_b = r_cfg.get("sub_buckets", [])
                    for f in rel_valid:
                        b, mod = resolve_file_bucket(f, sub_b, repo_dir=r_dir)
                        b_id = mod if (b and mod) else (b.get("id") if b else "main")
                        if not excluded_b or b_id not in excluded_b:
                            tracked_list.append(f"vfs://{r_dir}/{f}")
            repo_files_cache[r_dir] = tracked_list
            repo_set_cache[r_dir] = set(tracked_list)
        return repo_files_cache[r_dir], repo_set_cache[r_dir]

    out: List[str] = []
    seen = set()

    def _append(u_str: str):
        if u_str and u_str not in seen:
            seen.add(u_str)
            out.append(u_str)

    for raw in candidate_uris:
        if not raw:
            continue
        raw_str = str(raw).strip()
        if not raw_str:
            continue
        is_explicit_dir = raw_str.endswith("/") and not raw_str.endswith("://")
        uri = InSetuURI(raw_str)
        if uri.scheme and uri.scheme != "vfs":
            _append(str(uri))
            continue
        r_dir = uri.repo
        rel_p = (uri.path or "").strip("/")
        if not r_dir:
            if expand_dirs:
                for mr in mounted_repos:
                    t_list, _ = _get_repo_tracked(mr)
                    for tf in t_list:
                        if not tf.endswith(("/.gitkeep", "/.keep")):
                            _append(tf)
            continue
        t_list, t_set = _get_repo_tracked(r_dir)
        canon_u = str(uri).rstrip("/")
        if not is_explicit_dir and canon_u in t_set:
            _append(canon_u)
            continue
        if expand_dirs and (is_explicit_dir or not rel_p or any(tf.startswith(f"{canon_u}/") for tf in t_list)):
            prefix = f"vfs://{r_dir}/" if not rel_p else f"vfs://{r_dir}/{rel_p}/"
            for tf in t_list:
                if tf.endswith(("/.gitkeep", "/.keep")):
                    continue
                if tf == canon_u or tf.startswith(prefix):
                    _append(tf)
    return out
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
            active_ws_ids = set(get_all_workspace_ids())
            for ws_id, events in ws_groups.items():
                if (ws_id or "default") not in active_ws_ids:
                    continue
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
def _reconcile_repo_ledger_with_sieve(conn, workspace_id: Optional[str], repo_dir: str, repo_cfg: dict, live_cfg: dict) -> Tuple[int, List[str]]:
    """
    Reconciles a repository's topology_ledger rows against get_valid_workspace_files() when
    sieve rules (.gitignore or config_mutated) change. Evicts newly ignored/excluded rows and
    inserts newly tracked files so topology_ledger matches force_topology_scan() exactly.
    """
    repo_path = get_repo_path(repo_dir, workspace_id)
    if not repo_path or not os.path.exists(repo_path):
        return 0, []
    valid_rels = set(get_valid_workspace_files(repo_path, repo_cfg, workspace_id))
    valid_uris = {f"vfs://{repo_dir}/{rel}": rel for rel in valid_rels}
    existing_rows = conn.execute(
        "SELECT filepath, bucket_id FROM topology_ledger WHERE repo = ?",
        (repo_dir,),
    ).fetchall()
    existing_map = {r["filepath"]: r["bucket_id"] for r in existing_rows}

    to_delete = [fp for fp in existing_map if fp not in valid_uris]
    to_add = [rel for uri, rel in valid_uris.items() if uri not in existing_map]
    touched_buckets = set()

    if to_delete:
        for fp in to_delete:
            touched_buckets.add(f"{repo_dir}::{existing_map[fp]}")
        conn.executemany(
            "DELETE FROM topology_ledger WHERE filepath = ?",
            [(fp,) for fp in to_delete],
        )

    if to_add:
        repo_base_obj = Path(repo_path)
        git_status_map = _get_repo_git_status_map(repo_path)
        sub_buckets = repo_cfg.get("sub_buckets", [])
        now_ts = time.time()
        rows_to_insert = []
        for rel in to_add:
            b, module = resolve_file_bucket(rel, sub_buckets, repo_dir=repo_dir)
            bucket_id = module if (b and module) else (b.get("id") if b else "main")
            filepath = f"vfs://{repo_dir}/{rel}"
            g_status = git_status_map.get(rel, "")
            file_ts = now_ts
            try:
                file_ts = (repo_base_obj / rel).stat().st_mtime
            except Exception:
                file_ts = now_ts
            rows_to_insert.append((filepath, repo_dir, bucket_id, max(float(file_ts), now_ts), g_status))
            touched_buckets.add(f"{repo_dir}::{bucket_id}")
        conn.executemany(
            "INSERT OR REPLACE INTO topology_ledger (filepath, repo, bucket_id, timestamp, git_status) VALUES (?, ?, ?, ?, ?)",
            rows_to_insert,
        )

    return len(to_delete) + len(to_add), sorted(touched_buckets)


# Per-workspace fingerprint of the configuration the sieve reads, so ordinary settings saves (which also
# emit config_mutated) do not re-walk every repository.
_SIEVE_CONFIG_FINGERPRINTS: Dict[str, Dict[str, str]] = {}
_SIEVE_FINGERPRINT_LOCK = threading.Lock()


def _sieve_config_fingerprints(cfg: Dict[str, Any], workspace_id: Optional[str] = None) -> Dict[str, str]:
    """Fingerprints each repository's sieve configuration, workspace-level keys, and .gitignore/.git/info/exclude mtimes."""
    workspace_part = json.dumps({k: v for k, v in cfg.items() if k != _TARGET_REPOS_KEY}, sort_keys=True, default=str)
    fingerprints: Dict[str, str] = {}
    for r in _target_repo_configs(cfg):
        r_dir = r.get("repo_dir")
        if not r_dir:
            continue
        gi_stamp = ""
        try:
            r_path = get_repo_path(r_dir, workspace_id)
            if r_path:
                rp = Path(r_path)
                for rel_ignore in (".gitignore", ".git/info/exclude"):
                    ip = rp / rel_ignore
                    if ip.is_file():
                        st = ip.stat()
                        gi_stamp += f"|{rel_ignore}:{st.st_mtime_ns}:{st.st_size}"
        except Exception:
            pass
        fingerprints[str(r_dir)] = json.dumps(r, sort_keys=True, default=str) + workspace_part + gi_stamp
    return fingerprints


@topology_bp.on('config_mutated', priority=20)
def reconcile_topology_on_config_mutated(workspace_id=None, **kwargs):
    """Reconciles topology_ledger for repositories whose sieve configuration changed (exts, ignores, mounts)."""
    wid = workspace_id or "default"
    # This hook runs before akasa's own config-cache invalidation (priority 50), so drop this workspace's copy first.
    load_config.invalidate(workspace_id=wid)
    ctx = topology_bp.get_context(wid)
    live_cfg = ctx.config
    current = _sieve_config_fingerprints(live_cfg, wid)
    with _SIEVE_FINGERPRINT_LOCK:
        previous = _SIEVE_CONFIG_FINGERPRINTS.get(wid)
        _SIEVE_CONFIG_FINGERPRINTS[wid] = current
    # With no fingerprint from a full scan yet, every repository is reconciled once.
    changed_repos = [r_dir for r_dir, fp in current.items() if previous is None or previous.get(r_dir) != fp]
    if not changed_repos:
        return
    repo_cfgs = {r.get("repo_dir"): r for r in _target_repo_configs(live_cfg)}
    total_changes = 0
    with ctx.db as conn:
        for r_dir in changed_repos:
            changed, _ = _reconcile_repo_ledger_with_sieve(conn, wid, r_dir, repo_cfgs[r_dir], live_cfg)
            total_changes += changed
    if total_changes:
        hook_request_vfs_manifest.invalidate(workspace_id=wid)


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
    _ensure_sieve_reconciled(workspace_id)
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
    target_repos_map = {r.get("repo_dir"): r for r in _target_repo_configs(ctx.config) if r.get("repo_dir")}

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
                logical_target = f"vfs://{repo_dir}/{rel_path.strip('/')}"
                for vfs_fp in ctx.vfs.walk(logical_target):
                    walk_rel = InSetuURI(vfs_fp).path
                    if is_file_tracked_by_sieve(walk_rel, repo_cfg, ctx.config, repo_dir=repo_dir):
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
    rule_changed_repos = set()

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
            if Path(rel_to_repo).name in (".gitignore", "exclude") and repo_dir in target_repos_map:
                rule_changed_repos.add(repo_dir)
            if repo_cfg and not is_file_tracked_by_sieve(rel_to_repo, repo_cfg, ctx.config, repo_dir=repo_dir):
                affected = conn.execute("SELECT bucket_id FROM topology_ledger WHERE filepath = ?", (filepath,)).fetchall()
                if affected:
                    conn.execute("DELETE FROM topology_ledger WHERE filepath = ?", (filepath,))
                    dirty_repos.add(repo_dir)
                    for row in affected:
                        dirty_buckets.add(f"{repo_dir}::{row['bucket_id']}")
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
    # If .gitignore or .git/info/exclude changed in any repo, reconcile existing ledger rows against the updated rules
    for r_dir in rule_changed_repos:
        r_cfg = target_repos_map.get(r_dir)
        if r_cfg:
            changed_cnt, rec_buckets = _reconcile_repo_ledger_with_sieve(conn, workspace_id, r_dir, r_cfg, live_cfg)
            if changed_cnt:
                dirty_repos.add(r_dir)
                dirty_buckets.update(rec_buckets)

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
    for repo_cfg in _target_repo_configs(cfg):
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
                target_repos = _target_repo_configs(cfg)

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
    for r_cfg in _target_repo_configs(cfg):
        r_dir = r_cfg.get("repo_dir")
        if not r_dir:
            continue
        buckets = [b.get("id") for b in r_cfg.get("sub_buckets", []) if b.get("id") and not b.get("is_system")]
        idx_uri = resolve_repo_code_index_uri(ctx, r_dir, r_cfg)
        code_idx = (ctx.vfs.read(idx_uri) or "").strip()
        idx_full = code_idx if code_idx else "[No CODE_INDEX.md generated]"
        repos_summary.append({
            "repo": r_dir,
            "domain": r_cfg.get("domain", "Workspaces"),
            "buckets": buckets,
        })
        overview_lines.append(f"\n## Repository: {r_dir} (Buckets: {', '.join(buckets) if buckets else 'main'})\n{idx_full}")

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


_REPO_TIER_SETTINGS_CACHE: Dict[Tuple[str, str, str], Tuple[Tuple[Optional[str], Optional[str]], Dict[str, Any]]] = {}
_REPO_TIER_CACHE_LOCK = threading.Lock()

# Landmark kinds core knows about. Extensions add their own through the `register_repo_landmarks` hook.
# shape: "files" (every matching file), "dir" (the first existing directory), "paths" (matching directories or files).
# default_pick: "first" keeps only the first default that matches; "all" keeps every match.
CORE_LANDMARK_KINDS: List[Dict[str, Any]] = [
    {
        "id": "standards",
        "label": "Engineering Standards",
        "shape": "files",
        "output": "standards_files",
        "defaults": ["docs/standards/*.md", "docs/*engineering_standards*.md", "*engineering_standards*.md", "CONTRIBUTING.md"],
    },
    {
        "id": "contracts",
        "label": "API and Architectural Contracts",
        "shape": "files",
        "output": "contract_files",
        "defaults": ["docs/*contract*.md", "*contract*.md", "README.md"],
    },
    {
        "id": "models",
        "label": "Mental Models & Subsystem Invariants",
        "shape": "files",
        "output": "model_files",
        "defaults": ["docs/models/*.md", "docs/*mental_model*.md", "*mental_model*.md"],
    },
    {
        "id": "adrs",
        "label": "ADR Directory",
        "shape": "dir",
        "output": "adr_dir",
        "defaults": ["docs/adrs", "docs/adr", "adr"],
    },
    {
        "id": "tests",
        "label": "Unit Test Directories",
        "shape": "paths",
        "output": "test_dirs",
        "defaults": ["tests/unit", "tests", "test"],
        "default_pick": "first",
    },
    {
        "id": "fitness",
        "label": "Fitness Suites",
        "shape": "paths",
        "output": "fitness_dirs",
        "defaults": ["tests/fitness", "tests/fitness_functions.py"],
        "default_pick": "all",
    },
]
_LANDMARK_SHAPES = frozenset({"files", "dir", "paths"})
_LANDMARK_RESERVED_OUTPUTS = frozenset({"repo_name", "repo_title", "notices", "landmarks"})
_LANDMARK_NAME_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")


def get_landmark_kinds(workspace_id: Optional[str] = None) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Returns (kinds, notices): core landmark kinds followed by valid kinds that enabled extensions register.
    An extension declares `{"id", "label", "shape", "output", "defaults", "default_pick"?}` from a
    `register_repo_landmarks` hook. A declaration that reuses an id or output, uses an unknown shape,
    or has a default path that leaves the repository is skipped with a notice.
    """
    kinds: List[Dict[str, Any]] = [dict(k) for k in CORE_LANDMARK_KINDS]
    notices: List[str] = []
    seen_ids = {k["id"] for k in kinds}
    seen_outputs = {k["output"] for k in kinds} | set(_LANDMARK_RESERVED_OUTPUTS)
    try:
        registered_decls = hooks.emit_merge_list("register_repo_landmarks", workspace_id=workspace_id or "default")
    except (KeyError, Exception):
        registered_decls = []
    for decl in registered_decls:
        if not isinstance(decl, dict):
            continue
        kid = str(decl.get("id") or "")
        out = str(decl.get("output") or "")
        shape = decl.get("shape")
        defaults = decl.get("defaults") or []
        pick = decl.get("default_pick", "all")
        problem = None
        if not _LANDMARK_NAME_RE.match(kid) or not _LANDMARK_NAME_RE.match(out):
            problem = "id and output must be lowercase identifiers"
        elif kid in seen_ids or out in seen_outputs:
            problem = "id or output is already taken"
        elif shape not in _LANDMARK_SHAPES:
            problem = f"unknown shape '{shape}'"
        elif pick not in ("first", "all"):
            problem = f"unknown default_pick '{pick}'"
        elif not isinstance(defaults, list) or not all(_is_confined_repo_rel_spec(d) for d in defaults):
            problem = "defaults must be repository-relative paths"
        if problem:
            notices.append(f"Skipped landmark kind '{kid or '?'}': {problem}.")
            continue
        seen_ids.add(kid)
        seen_outputs.add(out)
        kinds.append({
            "id": kid,
            "label": str(decl.get("label") or kid),
            "shape": shape,
            "output": out,
            "defaults": list(defaults),
            "default_pick": pick,
        })
    return kinds, notices


def _empty_landmark_value(kind: Dict[str, Any]) -> Any:
    """The value a landmark kind has when nothing matches: "" for a directory, [] otherwise."""
    return "" if kind["shape"] == "dir" else []


def _resolve_landmark_kind(kind: Dict[str, Any], specs: Optional[List[str]], rel_files: List[str], repo_path: Optional[Path], repo_dir: str) -> Any:
    """
    Resolves one landmark kind for a repository to VFS URIs.
    Configured specs replace the kind's defaults entirely; with defaults, `default_pick: first`
    keeps only the first default that matches.
    """
    configured = specs is not None
    candidates = specs if configured else kind["defaults"]
    first_only = (not configured) and kind.get("default_pick") == "first"
    found: List[str] = []
    for sp in candidates:
        if kind["shape"] == "dir":
            matched_d = _match_tracked_dir(rel_files, repo_path, sp)
            if matched_d:
                return f"vfs://{repo_dir}/{matched_d}"
            continue
        if kind["shape"] == "files":
            hits = _match_tracked_files(rel_files, sp)
        else:
            matched_d = _match_tracked_dir(rel_files, repo_path, sp)
            hits = [matched_d] if matched_d else _match_tracked_files(rel_files, sp)
        found.extend(hits)
        if first_only and hits:
            break
    if kind["shape"] == "dir":
        return ""
    return [f"vfs://{repo_dir}/{rf}" for rf in dict.fromkeys(found)]


def _local_settings_ignored(ctx, repo: str) -> bool:
    """True when `<repo>/.insetu-data/.gitignore` lists `settings.local/`, so personal overrides stay out of commits."""
    existing = ctx.vfs.read(f"vfs://{repo}/.insetu-data/.gitignore")
    if existing is None:
        return False
    return any(line.strip().rstrip("/") == "settings.local" for line in existing.splitlines())


def _is_confined_repo_rel_spec(spec: Any) -> bool:
    """Returns True if `spec` is a non-empty, relative path/glob without `..` traversal or scheme prefixes."""
    if not isinstance(spec, str):
        return False
    clean = spec.replace("\\", "/").strip()
    if not clean or "://" in clean or clean.startswith(("/", "~")):
        return False
    if re.match(r'^[a-zA-Z]:', clean):
        return False
    parts = [p for p in clean.split("/") if p]
    if not parts or any(p == ".." for p in parts):
        return False
    return True


def _get_repo_content_field_ids(workspace_id: str, ext_name: str) -> set:
    """Returns the set of schema field IDs declared with `authority: 'repo_content'` for `ext_name`."""
    schemas = get_registered_settings_schemas(workspace_id)
    ext_schema = schemas.get(ext_name) or []
    allowed = set()
    for field_spec in ext_schema:
        if isinstance(field_spec, dict) and field_spec.get("authority") == "repo_content" and field_spec.get("id"):
            allowed.add(field_spec["id"])
    return allowed


def read_repo_tier_settings(ctx, repo: str, ext_name: str = "topology") -> Dict[str, Any]:
    """
    Reads one extension's repository-tier settings, keeping only fields declared `authority: repo_content`.
    Sources, in order (later wins):
    1. `vfs://<repo>/.insetu-data/settings/<ext_name>.md` (shared, committed)
    2. `vfs://<repo>/.insetu-data/settings.local/<ext_name>.md` (local override, git-ignored)
    Enforces `authority: repo_content` per schema field and ignores undeclared/unauthorized fields with notices.
    Cached by the pair of VFS content hashes (revision token).
    """
    wid = ctx.workspace_id or "default"
    clean_repo = str(repo or "").strip()
    if not clean_repo:
        return {"values": {}, "notices": [], "body_shared": "", "body_local": ""}

    shared_uri = f"vfs://{clean_repo}/.insetu-data/settings/{ext_name}.md"
    local_uri = f"vfs://{clean_repo}/.insetu-data/settings.local/{ext_name}.md"

    shared_raw = ctx.vfs.read(shared_uri)
    local_raw = ctx.vfs.read(local_uri)

    rev_token = (
        str(hash(shared_raw)) if shared_raw is not None else None,
        str(hash(local_raw)) if local_raw is not None else None,
    )
    cache_key = (wid, clean_repo, ext_name)
    with _REPO_TIER_CACHE_LOCK:
        cached = _REPO_TIER_SETTINGS_CACHE.get(cache_key)
        if cached and cached[0] == rev_token:
            return json.loads(json.dumps(cached[1]))

    allowed_fields = _get_repo_content_field_ids(wid, ext_name)
    merged_values: Dict[str, Any] = {}
    notices: List[str] = []
    if local_raw is not None and not _local_settings_ignored(ctx, clean_repo):
        # Reads never write: the person (or a future settings write path) adds the ignore line.
        notices.append(
            f"{local_uri} exists but '.insetu-data/.gitignore' does not list 'settings.local/', so these personal overrides could be committed."
        )
    body_shared = ""
    body_local = ""

    for tier_label, uri_str, raw_text in (
        ("shared", shared_uri, shared_raw),
        ("local", local_uri, local_raw),
    ):
        if raw_text is None:
            continue
        meta, body, _ = parse_frontmatter(raw_text)
        if tier_label == "shared":
            body_shared = body
        else:
            body_local = body
        if not isinstance(meta, dict):
            continue
        for k, v in meta.items():
            if k == "schema":
                continue
            if k not in allowed_fields:
                notices.append(
                    f"Ignored field '{k}' in {uri_str}: only fields with authority 'repo_content' may be set in repository settings."
                )
                continue
            if isinstance(v, dict) and isinstance(merged_values.get(k), dict):
                merged_values[k] = {**merged_values[k], **v}
            else:
                merged_values[k] = v

    result = {
        "values": merged_values,
        "notices": notices,
        "body_shared": body_shared,
        "body_local": body_local,
    }
    with _REPO_TIER_CACHE_LOCK:
        _REPO_TIER_SETTINGS_CACHE[cache_key] = (rev_token, result)
    return json.loads(json.dumps(result))


def _match_tracked_files(rel_files: List[str], spec: str) -> List[str]:
    """Matches a confined repo-relative path, directory, or glob against tracked relative file paths."""
    clean = spec.replace("\\", "/").strip().strip("/")
    if not clean:
        return []
    matched: List[str] = []
    has_glob = any(ch in clean for ch in ("*", "?", "["))
    for rf in rel_files:
        if has_glob:
            if fnmatch.fnmatch(rf, clean) or fnmatch.fnmatch(Path(rf).name, clean):
                matched.append(rf)
        else:
            if rf == clean or rf.startswith(f"{clean}/"):
                matched.append(rf)
    return sorted(list(dict.fromkeys(matched)))


def _match_tracked_dir(rel_files: List[str], repo_path: Optional[Path], spec: str) -> Optional[str]:
    """Verifies whether a confined repo-relative directory (or file path) exists in the tracked set or on disk."""
    clean = spec.replace("\\", "/").strip().strip("/")
    if not clean:
        return None
    if any(rf == clean or rf.startswith(f"{clean}/") for rf in rel_files):
        return clean
    if repo_path is not None:
        cand = (repo_path / clean).resolve()
        try:
            cand.relative_to(repo_path.resolve())
            if cand.exists():
                return clean
        except ValueError:
            pass
    return None


def resolve_repo_landmarks(ctx, repo: Optional[str] = None) -> Dict[str, Any]:
    """
    Resolves where a repository keeps each landmark kind (standards, contracts, ADRs, tests, fitness suites,
    and kinds registered by extensions). Returns `{"repo_name", "repo_title", "landmarks": {output: value}, "notices"}`.
    - Combines each kind's defaults with `.insetu-data/settings/topology.md` and `settings.local/topology.md` (`merge: override`).
    - Confines every path/glob to the repository (rejecting absolute paths and `..` segments with notices).
    - Resolves file and directory matches against `topology_ledger`, falling back to the disk for directories.
    """
    kinds, kind_notices = get_landmark_kinds(ctx.workspace_id)
    empty = {k["output"]: _empty_landmark_value(k) for k in kinds}
    cfg = ctx.config
    target_repos = _target_repo_configs(cfg)
    repo_cfg = None
    if repo:
        repo_cfg = next((r for r in target_repos if isinstance(r, dict) and r.get("repo_dir") == repo), None)
        if repo_cfg is None:
            # Only mounted repositories have landmarks; an unknown name must not borrow another repository's.
            return {
                "repo_name": repo, "repo_title": repo, "landmarks": empty,
                "notices": kind_notices + [f"'{repo}' is not a mounted repository."],
            }
    elif target_repos:
        repo_cfg = target_repos[0] if isinstance(target_repos[0], dict) else None

    repo_dir = str(repo or (repo_cfg.get("repo_dir") if repo_cfg else "") or "").strip()
    repo_title = str((repo_cfg.get("title") if repo_cfg else "") or repo_dir or "workspace").strip()

    if not repo_dir:
        return {"repo_name": "workspace", "repo_title": "workspace", "landmarks": empty, "notices": kind_notices}

    tracked_uris = get_topology_files_for_repo(ctx.workspace_id, repo_dir)
    if not tracked_uris:
        r_phys_str = get_repo_path(repo_dir, ctx.workspace_id)
        if r_phys_str and os.path.exists(r_phys_str) and repo_cfg:
            valid_rels = get_valid_workspace_files(r_phys_str, repo_cfg, ctx.workspace_id)
            tracked_uris = [f"vfs://{repo_dir}/{f}" for f in valid_rels]

    rel_files = sorted([
        InSetuURI(u).path for u in tracked_uris
        if not InSetuURI(u).basename.endswith((".gitkeep", ".keep"))
    ])
    r_phys_str = get_repo_path(repo_dir, ctx.workspace_id)
    r_phys = Path(r_phys_str).resolve() if r_phys_str else None

    tier_data = read_repo_tier_settings(ctx, repo_dir, "topology")
    notices: List[str] = kind_notices + list(tier_data.get("notices") or [])
    raw_landmarks = tier_data.get("values", {}).get("landmarks")
    known_ids = {k["id"] for k in kinds}
    landmarks_cfg: Dict[str, Any] = {}
    if isinstance(raw_landmarks, dict):
        for lk, lv in raw_landmarks.items():
            if lk not in known_ids:
                notices.append(f"Ignored unknown landmark key '{lk}' in topology settings for '{repo_dir}'.")
                continue
            landmarks_cfg[lk] = lv

    def _normalize_spec_list(raw_val: Any, key_label: str) -> Optional[List[str]]:
        if raw_val is None:
            return None
        items = raw_val if isinstance(raw_val, list) else ([raw_val] if isinstance(raw_val, str) else [])
        valid_specs: List[str] = []
        for item in items:
            s_item = str(item or "").strip()
            if not s_item:
                continue
            if not _is_confined_repo_rel_spec(s_item):
                notices.append(f"Refused unconfined landmark path '{s_item}' in landmarks.{key_label} for '{repo_dir}'.")
                continue
            valid_specs.append(s_item)
        return valid_specs

    resolved: Dict[str, Any] = {}
    for kind in kinds:
        specs = _normalize_spec_list(landmarks_cfg.get(kind["id"]), kind["id"])
        resolved[kind["output"]] = _resolve_landmark_kind(kind, specs, rel_files, r_phys, repo_dir)

    return {"repo_name": repo_dir, "repo_title": repo_title, "landmarks": resolved, "notices": notices}


def resolve_repo_code_index_uri(ctx, repo_dir: str, repo_cfg: Optional[Dict[str, Any]] = None) -> str:
    """
    Resolves the canonical VFS URI for a repository's CODE_INDEX.md:
    1. Explicit `index_path` in repo_cfg (or legacy `is_core_chassis` alias -> 'docs/CODE_INDEX.md').
    2. `vfs://<repo>/docs/CODE_INDEX.md` if it already exists and root `CODE_INDEX.md` does not.
    3. Default `vfs://<repo>/CODE_INDEX.md`.
    """
    if repo_cfg is None:
        repo_cfg = next((r for r in _target_repo_configs(ctx.config) if r.get("repo_dir") == repo_dir), {}) or {}
    custom_rel = str(repo_cfg.get("index_path") or "").strip().lstrip("/")
    if custom_rel and _is_confined_repo_rel_spec(custom_rel):
        return f"vfs://{repo_dir}/{custom_rel}"
    if repo_cfg.get("is_core_chassis"):
        return f"vfs://{repo_dir}/docs/CODE_INDEX.md"
    root_uri = f"vfs://{repo_dir}/CODE_INDEX.md"
    docs_uri = f"vfs://{repo_dir}/docs/CODE_INDEX.md"
    if not ctx.resolve_path(root_uri, must_exist=True, allow_heal=False) and ctx.resolve_path(docs_uri, must_exist=True, allow_heal=False):
        return docs_uri
    return root_uri


def infer_target_repo(
    ctx,
    explicit_repo: Optional[str] = None,
    candidate_uris: Optional[List[str]] = None,
) -> Optional[str]:
    """
    Resolves the target repository directory deterministically from:
    1. An explicit `repo` name (parameter or frontmatter `repo:`).
    2. A canonical `vfs://<repo>/...` URI (including `vfs://<repo>/.insetu-data/prompts/...`).
    3. A compiled `ctx://contexts/<repo>_...` or `ctx://diffs/<repo>_...` artifact URI.
    """
    repos_cfg = _target_repo_configs(ctx.config)
    known_repo_dirs = [r.get("repo_dir") for r in repos_cfg if r.get("repo_dir")]
    if not known_repo_dirs:
        return explicit_repo or None

    clean_explicit = str(explicit_repo or "").strip()
    if clean_explicit and clean_explicit in known_repo_dirs:
        return clean_explicit

    sorted_known = sorted(known_repo_dirs, key=len, reverse=True)
    for raw_item in (candidate_uris or []):
        inc_str = str(raw_item or "").strip()
        if not inc_str:
            continue
        try:
            u_inc = InSetuURI(InSetuURI.canonicalize(inc_str))
            if u_inc.scheme == "vfs" and u_inc.repo in known_repo_dirs:
                return u_inc.repo
            if u_inc.scheme == "ctx" and u_inc.volume == "prompts" and u_inc.path:
                first_seg, _, _ = u_inc.path.strip("/").partition("/")
                if first_seg in known_repo_dirs:
                    return first_seg
            if u_inc.scheme == "ctx" and u_inc.volume in ("contexts", "diffs"):
                base_inc = u_inc.basename.lower()
                for kr in sorted_known:
                    norm_kr = kr.lower().replace("-", "_")
                    if base_inc.startswith((f"{kr.lower()}_", f"{norm_kr}_")):
                        return kr
        except Exception:
            continue
    return clean_explicit or None


DEFAULT_GUARDRAIL_RULES = (
    "- **Single Source of Truth (SSOT) & DRY Centralization:** Ensure shared logic, schemas, and configurations exist in one canonical place without duplicate helpers.\n"
    "- **Architectural & Module Boundaries:** Verify that changes respect module layers, public interfaces, and dependency direction without abstraction leaks.\n"
    "- **State & Concurrency Hygiene:** Ensure state mutations are deterministic, properly synchronized, and free of race conditions or resource leaks.\n"
    "- **Security & Input Validation:** Verify that external inputs, paths, and credentials are validated and confined at system boundaries."
)


def build_sys_landmarks_context(
    ctx,
    repo_hint: Optional[str] = None,
    candidate_uris: Optional[List[str]] = None,
    extra_inputs: Optional[Dict[str, Any]] = None,
    prior_sys: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Single Source of Truth builder for the `sys.*` template variable dictionary.
    Used by both `engine_prompts.py` (`prompts/resolve`) and `orchestrator.py` (`execute_declarative_routine`).
    """
    extra = dict(extra_inputs or {})
    repos_cfg = _target_repo_configs(ctx.config)
    resolved_repo = infer_target_repo(
        ctx,
        explicit_repo=repo_hint or extra.get("repo"),
        candidate_uris=candidate_uris,
    )
    primary_repo_cfg = (
        next((r for r in repos_cfg if r.get("repo_dir") == resolved_repo), None)
        if resolved_repo else None
    ) or (repos_cfg[0] if repos_cfg else {})

    primary_repo_name = primary_repo_cfg.get("repo_dir") or resolved_repo or "workspace"
    primary_repo_title = primary_repo_cfg.get("title") or primary_repo_name
    primary_repo_desc = primary_repo_cfg.get("description") or ""

    landmarks_info = resolve_repo_landmarks(ctx, repo=primary_repo_name if primary_repo_name != "workspace" else None)
    raw_landmarks = landmarks_info.get("landmarks") or {}
    std_list = list(raw_landmarks.get("standards_files") or [])
    contract_list = list(raw_landmarks.get("contract_files") or [])
    model_list = list(raw_landmarks.get("model_files") or [])
    fitness_list = list(raw_landmarks.get("fitness_dirs") or [])
    test_list = list(raw_landmarks.get("test_dirs") or [])

    adr_dir_val = str(raw_landmarks.get("adr_dir") or f"vfs://{primary_repo_name}/docs/adrs")
    tracker_dir_val = str(raw_landmarks.get("tracker_dir") or f"vfs://{primary_repo_name}/.insetu-data/tracker")
    combined_contracts = list(dict.fromkeys(std_list + contract_list + model_list))
    contract_stack_md = (
        "\n".join(f"  - `{c}`" for c in combined_contracts)
        if combined_contracts
        else f"  - `vfs://{primary_repo_name}/CODE_INDEX.md`"
    )
    standards_doc_str = ", ".join(f"`{s}`" for s in std_list) if std_list else f"`vfs://{primary_repo_name}/CODE_INDEX.md`"
    hardening_targets = list(dict.fromkeys(fitness_list + test_list))
    hardening_str = ", ".join(f"`{h}`" for h in hardening_targets) if hardening_targets else f"`vfs://{primary_repo_name}/tests/`"

    # The accepted, assembled directives are always present. A caller's own directives for this run (a routine input)
    # are added after them under their own heading; they never replace what a person wrote or accepted.
    directives_text = get_directives(ctx, primary_repo_name).get("text", "")
    run_directives = str(extra.get("directives") or "").strip()
    if run_directives:
        directives_text = f"{directives_text}\n\n#### Directives for this run\n\n{run_directives}".strip()

    return {
        **(prior_sys or {}),
        **raw_landmarks,
        "repo_name": landmarks_info.get("repo_name") or primary_repo_name,
        "repo_title": str(extra.get("project_name") or landmarks_info.get("repo_title") or primary_repo_title),
        "repo_description": primary_repo_desc,
        "standards_doc": str(extra.get("standards_doc") or standards_doc_str),
        "contract_stack": str(extra.get("contract_stack") or contract_stack_md),
        "adr_dir": str(extra.get("adr_dir") or adr_dir_val),
        "tracker_dir": tracker_dir_val,
        "tracker_closed_dir": str(extra.get("tracker_closed_dir") or f"{tracker_dir_val.rstrip('/')}/epics/closed"),
        "guardrail_rules": str(extra.get("guardrail_rules") or DEFAULT_GUARDRAIL_RULES),
        "hardening_target": str(extra.get("hardening_target") or hardening_str),
        "directives": directives_text,
        "active_bucket": f"{primary_repo_name}::main",
    }


def discover_constitution_files(ctx) -> List[str]:
    """Returns the standards files to auto-pin (Tier 0) across mounted repositories, from each repository's landmarks."""
    constitution: List[str] = []
    for r_cfg in _target_repo_configs(ctx.config):
        r_dir = r_cfg.get("repo_dir")
        if not r_dir:
            continue
        landmarks = resolve_repo_landmarks(ctx, repo=r_dir).get("landmarks") or {}
        for std_uri in (landmarks.get("standards_files") or []):
            if std_uri and not std_uri.endswith((".gitkeep", ".keep")):
                constitution.append(str(InSetuURI(std_uri)))
    return sorted(list(dict.fromkeys(constitution)))


class TopologyLandmarksPayload(TypedDict, total=False):
    """Request schema for topology.landmarks: an optional repository name."""
    repo: Optional[str]


@topology_bp.route('landmarks', methods=['GET', 'POST'], request_schema=TopologyLandmarksPayload, docstring="[sync] Resolves repository landmarks (standards, contracts, ADRs, tests, fitness, and kinds extensions register) from .insetu-data/settings/topology.md and each kind's defaults.")
def api_topology_landmarks(ctx):
    """Resolves repository landmarks for one repository (the first mounted one when none is named)."""
    data = ctx.payload or {}
    repo = str(data.get("repo") or "").strip() or None
    return resolve_repo_landmarks(ctx, repo=repo)


class AuditUpkeepPayload(TypedDict, total=False):
    repo: Optional[str]
    scope: Optional[str]
    stage: Optional[str]
    god_object_min_lines: Optional[int]
    god_object_min_symbols: Optional[int]


@topology_bp.route('audit_upkeep', methods=['GET', 'POST'], request_schema=AuditUpkeepPayload, docstring="[sync] Deterministically audits workspace documentation/symbol drift, oversized God-object decomposition candidates, and test suite relevance.")
def api_topology_audit_upkeep(ctx):
    """Deterministically audits workspace documentation/symbol drift, God-object candidates, and test relevance."""
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
    target_configs = _target_repo_configs(ctx.config)
    requested_repo = str(data.get("repo") or "").strip()
    active_repos = [
        c.get("repo_dir")
        for c in target_configs
        if c.get("repo_dir") and (not requested_repo or c.get("repo_dir") == requested_repo)
    ]

    # Request Cartographer symbol_ledger refresh via decoupled hook before reading drift state
    try:
        ctx.emit('ensure_cartography_fresh', target_repos=active_repos or None)
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
            idx_uri = resolve_repo_code_index_uri(ctx, r_dir, r_cfg)
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
                    slice_info = extract_symbol_source_slice(fp, f_content, r["symbol_name"]) if f_content else None
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

    # Resolve each repository's test/fitness landmark prefixes once via resolve_repo_landmarks
    repo_test_prefixes: Dict[str, Tuple[str, ...]] = {}
    for r_dir in active_repos:
        lm_info = resolve_repo_landmarks(ctx, repo=r_dir).get("landmarks") or {}
        raw_t_uris = list(lm_info.get("test_dirs") or []) + list(lm_info.get("fitness_dirs") or [])
        prefixes = [u.rstrip("/") for u in raw_t_uris if isinstance(u, str) and u]
        if not prefixes:
            prefixes = [f"vfs://{r_dir}/tests", f"vfs://{r_dir}/test"]
        repo_test_prefixes[r_dir] = tuple(prefixes)

    def _is_repo_test_uri(r_dir: str, f_uri: str) -> bool:
        for pref in repo_test_prefixes.get(r_dir, ()):
            if f_uri == pref or f_uri.startswith(f"{pref}/"):
                return True
        return False

    # --- PILLAR 2: ZERO-LOGIC GOD-OBJECT DECOMPOSITION CANDIDATES ---
    repo_tracked_sets: Dict[str, set] = {}
    source_symbols_by_uri: Dict[str, List[str]] = {}
    for r_dir in active_repos:
        tracked_in_repo = get_topology_files_for_repo(ctx.workspace_id, r_dir)
        repo_tracked_sets[r_dir] = set(tracked_in_repo)
        for f_uri in tracked_in_repo:
            rel_p = InSetuURI(f_uri).path
            ext = Path(rel_p).suffix.lower()
            if ext not in SUPPORTED_SYMBOL_EXTENSIONS:
                continue
            content = ctx.vfs.read(f_uri)
            if not content:
                continue
            syms = extract_file_symbols(rel_p, content) or []
            is_test_f = _is_repo_test_uri(r_dir, f_uri)
            if not is_test_f and "/vendor/" not in f_uri:
                source_symbols_by_uri[f_uri] = [s["name"] for s in syms if s.get("name")]

            if scope in ("all", "modularize"):
                if is_test_f or "/vendor/" in f_uri:
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

    # --- PILLAR 3: TEST SUITE RELEVANCE (Generic Landmark & Language-Provider Driven) ---
    if scope in ("all", "tests"):
        for r_dir in active_repos:
            tracked_set = repo_tracked_sets.get(r_dir, set())
            test_texts: List[str] = []
            for f_uri in sorted(tracked_set):
                if not _is_repo_test_uri(r_dir, f_uri):
                    continue
                provider = get_language_provider(f_uri)
                if not provider:
                    continue
                t_text = ctx.vfs.read(f_uri) or ""
                if not t_text:
                    continue
                test_texts.append(t_text)
                for imp in provider.imports(f_uri, t_text):
                    mod_name = str(imp.get("module") or "").strip()
                    if not mod_name or not imp.get("is_from"):
                        continue
                    mod_rel = mod_name.lstrip(".").replace(".", "/")
                    if not mod_rel:
                        continue
                    candidates = (
                        f"vfs://{r_dir}/{mod_rel}.py",
                        f"vfs://{r_dir}/{mod_rel}/__init__.py",
                        f"vfs://{r_dir}/{r_dir}/{mod_rel}.py",
                        f"vfs://{r_dir}/{r_dir}/{mod_rel}/__init__.py",
                        f"vfs://{r_dir}/src/{mod_rel}.py",
                        f"vfs://{r_dir}/{mod_rel}.js",
                        f"vfs://{r_dir}/{mod_rel}.ts",
                    )
                    resolved_mod_uri = next((c for c in candidates if c in tracked_set), None)
                    if not resolved_mod_uri:
                        continue
                    mod_src = ctx.vfs.read(resolved_mod_uri) or ""
                    for imp_name in (imp.get("names") or []):
                        clean_sym = str(imp_name or "").strip()
                        if clean_sym and clean_sym != "*" and not re.search(rf'\b{re.escape(clean_sym)}\b', mod_src):
                            stale_test_imports.append({
                                "test_file": f_uri,
                                "line": imp.get("line", 1),
                                "module": mod_name,
                                "missing_symbol": clean_sym,
                            })
                            _add_target(f_uri)

            combined_repo_tests = "\n".join(test_texts)
            if combined_repo_tests:
                for src_uri, sym_names in sorted(source_symbols_by_uri.items()):
                    if not src_uri.startswith(f"vfs://{r_dir}/") or not sym_names:
                        continue
                    stem = Path(InSetuURI(src_uri).path).stem
                    if stem.startswith("__"):
                        continue
                    if stem not in combined_repo_tests and not any(s in combined_repo_tests for s in sym_names):
                        untested_capabilities.append({
                            "filepath": src_uri,
                            "repo": r_dir,
                            "symbols": sym_names[:5],
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
