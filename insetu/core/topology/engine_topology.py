import time
import uuid
import json
import threading
import queue
from pathlib import Path
from flask import jsonify
from akasa.extension import ExtensionContext
from insetu.core.sdk import InSetuExtension
from akasa.hooks import hooks
from akasa.workers import submit_immediate_job, register_callback
from insetu.core.utils_core import get_repo_path

TOPOLOGY_SCHEMA = {
    "topology_ledger": {
        "filepath": "TEXT PRIMARY KEY",
        "repo": "TEXT",
        "bucket_id": "TEXT",
        "is_tracked": "INTEGER DEFAULT 1",
        "timestamp": "REAL"
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

@hooks.on('register_compilation_steps')
def _register_topology_compilation_step(workspace_id=None, **kwargs):
    return [{
        "id": "topology_scan",
        "depends_on": [],
        "ext_name": "topology",
        "worker_name": "scan_topology_task"
    }]
@topology_bp.worker("scan_topology_task")
def _background_scan_topology(ctx, ledger_events=None, **kwargs):
    import time
    from akasa.db import get_connection
    w_conn = get_connection('workers', workspace_id=ctx.workspace_id)

    # Barrier Sync: Await async VFS pipeline writes to settle before draining topology
    try:
        ctx.sync_vfs_barrier(timeout=10.0)
    except TimeoutError as e:
        print(f"⚠️ [Topology] {str(e)} Proceeding with partial disk state.")

    timeout_loops = 0
    while timeout_loops < 20:
        active_tpl = w_conn.execute("SELECT id FROM immediate_jobs WHERE id LIKE 'tpl_%' AND status IN ('pending', 'processing')").fetchone()
        if not active_tpl:
            break
        ctx.jobs.update_progress("Waiting for concurrent topology mappers to settle...")
        time.sleep(0.5)
        timeout_loops += 1

    from insetu.core.topology.engine_topology import resolve_topology_buffer
    drained_events = resolve_topology_buffer(ctx.workspace_id)
    all_events = ledger_events or []
    event_dict = {e['filepath']: e for e in all_events}

    for de in drained_events:
        event_dict[de['filepath']] = de

    # EVENT TRAP HEALER: Steal trapped events from the 12-second delayed job and assassinate it.
    delayed_job_id = f"cmp_del_{ctx.workspace_id}"
    delayed_job = w_conn.execute("SELECT args_json FROM jobs WHERE id=? AND status='pending'", (delayed_job_id,)).fetchone()

    if delayed_job and delayed_job['args_json']:
        try:
            import json
            delayed_args = json.loads(delayed_job['args_json'])
            for de in delayed_args.get('ledger_events', []):
                event_dict[de['filepath']] = de
        except Exception:
            pass

    all_events = list(event_dict.values())

    from akasa.workers import cancel_job
    cancel_job(delayed_job_id, workspace_id=ctx.workspace_id)

    return {
        "message": "Topology mapped successfully.",
        "next_kwargs": {"ledger_events": all_events}
    }

@hooks.on('register_manifest_signatures')
def hook_topology_manifest_signatures(workspace_id=None, since_ts=0.0, **kwargs):
    """Yields lightweight repository signatures for the vfs domain."""
    ctx = topology_bp.get_context(workspace_id)
    rows = ctx.db.execute("SELECT repo, count(*) as cnt, max(timestamp) as max_ts FROM topology_ledger GROUP BY repo").fetchall()
    vfs_sigs = {}
    for r in rows:
        repo = r['repo']
        vfs_sigs[repo] = f"{r['cnt']}-{r['max_ts']}"
    return {"vfs": vfs_sigs}

@topology_bp.route('vfs', methods=['GET'])
def api_topology_vfs_repo(ctx):
    """Surgically fetches the VFS bucket structure for a specific repository."""
    repo = ctx.req.args.get('repo', '').strip()
    conn = ctx.db
    if repo:
        rows = conn.execute("SELECT filepath, bucket_id FROM topology_ledger WHERE repo=?", (repo,)).fetchall()
    else:
        rows = conn.execute("SELECT filepath, repo, bucket_id FROM topology_ledger").fetchall()

    files_by_bucket = {}
    for r in rows:
        r_name = repo or r['repo']
        b_id = r['bucket_id']
        key = f"{r_name}::{b_id}"
        if key not in files_by_bucket:
            files_by_bucket[key] = {"files": [], "meta": {"type": "vfs_bucket", "repo": r_name, "bucket_id": b_id}}
        files_by_bucket[key]["files"].append(r['filepath'])
    return jsonify({"repo": repo, "buckets": files_by_bucket})
@hooks.on('force_topology_scan', priority=10)
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

    for repo_cfg in target_configs:
        repo_dir = repo_cfg.get("repo_dir")
        if not repo_dir: continue

        repo_path = get_repo_path(repo_dir, workspace_id)

        valid_files = get_valid_workspace_files(repo_path, repo_cfg, workspace_id)
        sub_buckets = repo_cfg.get("sub_buckets", [])

        conn.execute("DELETE FROM topology_ledger WHERE repo = ?", (repo_dir,))
        for f in valid_files:
            b, module = resolve_file_bucket(f, sub_buckets, repo_dir=repo_dir)
            bucket_id = module if (b and module) else (b.get("id") if b else "main")
            filepath = f"{repo_dir}/{f}"
            conn.execute(
                "INSERT OR REPLACE INTO topology_ledger (filepath, repo, bucket_id, timestamp) VALUES (?, ?, ?, ?)",
                (filepath, repo_dir, bucket_id, time.time())
            )
    conn.commit()
    return True
from akasa.utils import thread_safe_cache

@hooks.on('vfs_manifest_mutated')
def _invalidate_topology_manifest(workspace_id=None, **kwargs):
    hook_request_vfs_manifest.invalidate(workspace_id=workspace_id)
@hooks.on('request_vfs_manifest')
@thread_safe_cache(ttl=2.0, key_maker=lambda workspace_id=None, **kwargs: str(workspace_id))
def hook_request_vfs_manifest(workspace_id=None, **kwargs):
    """Returns the vfs manifest derived directly from the topology ledger via raw tuple queries."""
    try:
        ctx = topology_bp.get_context(workspace_id)
        cursor = ctx.db.execute("SELECT repo, bucket_id, filepath FROM topology_ledger")

        manifest = {}
        for repo, bucket_id, filepath in cursor.fetchall():
            manifest_key = f"{repo}::{bucket_id}"
            if manifest_key not in manifest:
                manifest[manifest_key] = {"files": [], "meta": {"type": "vfs_bucket", "repo": repo, "bucket_id": bucket_id}}
            manifest[manifest_key]["files"].append(filepath)

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
    return [(Path(r['filepath']).name, r['filepath']) for r in rows]

def get_topology_files_for_repo(workspace_id, repo_dir, strip_prefix=True):
    """SSOT accessor to retrieve ledger paths and format them cleanly for downstream modules."""
    resolve_topology_buffer(workspace_id)
    ctx = topology_bp.get_context(workspace_id)
    rows = ctx.db.execute("SELECT filepath FROM topology_ledger WHERE repo = ?", (repo_dir,)).fetchall()

    result = []
    for r in rows:
        fp = r['filepath']
        if strip_prefix and fp.startswith(f"{repo_dir}/"):
            result.append(fp[len(repo_dir)+1:])
        else:
            result.append(fp)
    return result
_TOPOLOGY_RAM_QUEUE = queue.Queue()
_TOPOLOGY_SLEW_THREAD = None

def _topology_slew_limiter_loop():
    from akasa.db import get_connection
    from akasa.utils import fold_vfs_events
    from akasa.workers import submit_immediate_job
    try:
        from akasa.events import sse_bus
    except ImportError:
        sse_bus = None

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
                # Trigger macro-resolution worker FIRST (as a silent background task)
                job_id = f"tpl_res_{ws_id}"
                submit_immediate_job(job_id, "topology", "resolve_topology_task", "{}", workspace_id=ws_id, coalesce=True, job_category="system_background")

                # Guardrail: Delay the SSE broadcast by 250ms to ensure the worker has finished updating 
                # the SQLite ledger. Otherwise, the UI fetches a stale manifest and flashes the cards.
                if sse_bus:
                    threading.Timer(0.25, lambda w=ws_id, f=folded: sse_bus.emit_sse('vfs_mutated', {"mutations": f, "workspace_id": w})).start()
        except Exception as e:
            print(f"⚠️ [Topology Slew] Worker loop error: {e}")

@hooks.on('vfs_mutated', priority=10)
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
        if not filepath:
            continue

        from akasa.utils import parse_uri
        is_dir = filepath.endswith('/') or filepath.endswith('\\')

        repo, rel_path = parse_uri(filepath)
        norm_path = f"vfs://{repo}/{rel_path}".strip('/') if rel_path else f"vfs://{repo}"

        if is_dir and not norm_path.endswith('/'):
            norm_path += '/'

        op = m.get("operation", "save")
        _TOPOLOGY_RAM_QUEUE.put_nowait((workspace_id, {"filepath": norm_path, "operation": op}))
def resolve_topology_buffer(workspace_id):
    """Processes any pending events in topology_event_buffer, updates topology_ledger, and emits topology_resolved."""
    hooks.emit('vfs_manifest_mutated', workspace_id=workspace_id)
    ctx = topology_bp.get_context(workspace_id)
    conn = ctx.db
    events = conn.execute("SELECT id, filepath, mutation_type FROM topology_event_buffer ORDER BY timestamp ASC").fetchall()
    if not events:
        return []

    event_ids = [e["id"] for e in events]
    placeholders = ",".join(["?"] * len(event_ids))
    conn.execute(f"DELETE FROM topology_event_buffer WHERE id IN ({placeholders})", tuple(event_ids))
    conn.commit()

    dirty_buckets = set()
    dirty_repos = set()
    target_repos = ctx.config.get("target_repos", [])
    target_repos_map = {r.get("repo_dir"): r for r in target_repos if r and r.get("repo_dir")}
    from akasa.utils import parse_uri
    import os

    final_events = []
    # Safely expand directories without iterating over a mutating list
    from insetu.core.utils_core import InSetuURI
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
    from insetu.core.utils_core import InSetuURI
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
        filepath = clean_filepath
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

            is_ignored = False
            rel_to_repo = filepath[len(repo_dir)+1:] if filepath.startswith(f"{repo_dir}/") else filepath
            if repo_cfg:
                live_cfg = ctx.config

                ignore_exceptions = repo_cfg.get("ignore_exceptions") or []
                if any(rel_to_repo.startswith(exc) or exc in rel_to_repo for exc in ignore_exceptions):
                    is_ignored = False
                else:
                    ignore_dirs = set(repo_cfg.get("repo_ignore_dirs") if repo_cfg.get("repo_ignore_dirs") is not None else (live_cfg.get("ignore_dirs") or []))
                    ignore_files = set(repo_cfg.get("repo_ignore_files") if repo_cfg.get("repo_ignore_files") is not None else (live_cfg.get("ignore_files") or []))
                    ignore_patterns = repo_cfg.get("repo_ignore_patterns") if repo_cfg.get("repo_ignore_patterns") is not None else (live_cfg.get("ignore_patterns") or [])
                    filename = Path(filepath).name.lower()
                    if filename in ignore_files:
                        is_ignored = True
                    elif any(pattern in rel_to_repo for pattern in ignore_patterns):
                        is_ignored = True
                    elif set(p.lower() for p in rel_to_repo.split('/')).intersection(ignore_dirs):
                        is_ignored = True
                    else:
                        if filename not in (".gitkeep", ".keep"):
                            ext = Path(filepath).suffix.lower()
                            allowed_exts = set(repo_cfg.get("exts") if repo_cfg.get("exts") is not None else (live_cfg.get("include_extensions") or []))
                            if ext not in allowed_exts and filename not in allowed_exts:
                                is_ignored = True

            if is_ignored:
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
            existing = conn.execute("SELECT timestamp FROM topology_ledger WHERE filepath = ?", (filepath,)).fetchone()
            is_genuinely_modified = True

            if phys_mtime is None:
                is_genuinely_modified = False
            elif existing:
                if phys_mtime <= existing["timestamp"]:
                    is_genuinely_modified = False

            if is_genuinely_modified:
                conn.execute(
                    "INSERT OR REPLACE INTO topology_ledger (filepath, repo, bucket_id, timestamp) VALUES (?, ?, ?, ?)",
                    (filepath, repo_dir, bucket_id, time.time())
                )
                dirty_repos.add(repo_dir)
                dirty_buckets.add(f"{repo_dir}::{bucket_id}")
    conn.commit()

    hooks.emit(
        'topology_resolved', 
        workspace_id=workspace_id, 
        dirty_repos=list(dirty_repos), 
        dirty_buckets=list(dirty_buckets), 
        events=final_events
    )

    return final_events
@hooks.on('mutate_workspace_config')
def mount_topology_volumes_dynamically(cfg, workspace_id=None, **kwargs):
    """Dynamically remounts VFS volumes whenever the configuration changes."""
    from akasa.vfs import mount_volume
    from akasa.utils import get_workspace_physics
    from pathlib import Path

    _, ws_root = get_workspace_physics(workspace_id)
    for repo_cfg in cfg.get("target_repos", []):
        repo_dir = repo_cfg.get("repo_dir")
        if repo_dir:
            p_path = repo_cfg.get("physical_path")
            if p_path:
                repo_path = Path(p_path).expanduser().resolve().as_posix()
            else:
                repo_path = Path(ws_root).joinpath(repo_dir).resolve().as_posix()
            mount_volume(workspace_id, 'vfs', repo_dir, repo_path)
@hooks.on('workspace_boot')
def init_topology_on_boot(workspace_id=None, **kwargs):
    """Topology owns the boot sequence. Maps the drive immediately."""
    ctx = topology_bp.get_context(workspace_id)

    # Force a mount evaluation during boot using the current config
    mount_topology_volumes_dynamically(ctx.config, workspace_id)

    try:
        ctx.db.execute("CREATE INDEX IF NOT EXISTS idx_topology_repo ON topology_ledger(repo)")
        ctx.db.execute("CREATE INDEX IF NOT EXISTS idx_topology_bucket ON topology_ledger(bucket_id)")
        ctx.db.commit()
    except Exception:
        pass

    job_id = f"tpl_boot_{uuid.uuid4().hex[:8]}"
    submit_immediate_job(job_id, "topology", "boot_scan_task", "{}", workspace_id=workspace_id, job_category="ui_blocking")
@topology_bp.worker("boot_scan_task")
def _background_boot_scan(ctx, job_id=None, **kwargs):
    ctx.jobs.update_progress("Initializing workspace topology...")
    force_topology_scan(workspace_id=ctx.workspace_id)
    from akasa.hooks import hooks
    # Flush dirty tracking to ensure clean boot UI state
    hooks.emit('topology_resolved', workspace_id=ctx.workspace_id, dirty_repos=[], dirty_buckets=[], events=[], clear_all=True)
    hooks.emit('topology_boot_complete', workspace_id=ctx.workspace_id)

@topology_bp.worker("resolve_topology_task")
def _background_resolve_topology(ctx, job_id=None, **kwargs):
    """
    Processes the event buffer after physical disk I/O settles, updates the tracking 
    ledger, and emits `topology_resolved` to awaken downstream compilers.
    """
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

    print(f"🌍 [TOPOLOGY TELEMETRY] Worker resolved {total_resolved} events. Emitted topology_resolved.")
    if total_resolved == 0:
        return {"message": "No topology events to resolve."}

    return {"message": f"Topology settled. Resolved {total_resolved} events."}
def get_valid_workspace_files(repo_path, config, workspace_id=None):
    import os
    from pathlib import Path
    from akasa.utils import load_config
    from insetu.core.utils_core import execute_binary

    live_cfg = load_config(workspace_id)

    ignore_dirs = set(config.get("repo_ignore_dirs") if config.get("repo_ignore_dirs") is not None else (live_cfg.get("ignore_dirs") or []))
    ignore_files = set(config.get("repo_ignore_files") if config.get("repo_ignore_files") is not None else (live_cfg.get("ignore_files") or []))
    ignore_patterns = config.get("repo_ignore_patterns") if config.get("repo_ignore_patterns") is not None else (live_cfg.get("ignore_patterns") or [])
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
                        from akasa.vfs import execute_vfs_save
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

    for m_dir in (live_cfg.get("managed_dirs") or []):
        m_path = repo_p / m_dir
        if m_path.exists() and m_path.is_dir():
            for p in m_path.rglob('*'):
                if p.is_file():
                    try: git_files.add(p.relative_to(repo_p).as_posix())
                    except ValueError: pass

    valid_files = set()

    for file in git_files:
        norm_path = file
        if norm_path.startswith("./"): norm_path = norm_path[2:]
        if config.get("prefix") and not norm_path.startswith(config.get("prefix")): continue

        target_f = repo_p / norm_path
        if not target_f.is_file(): continue
        if target_f.name.lower() in ignore_files: continue
        if config.get("apply_ignore"):
            if any(norm_path.startswith(exc) for exc in (config.get("ignore_exceptions") or [])):
                pass
            else:
                if set(p.lower() for p in norm_path.split('/')).intersection(ignore_dirs): continue
                if any(pattern in norm_path for pattern in ignore_patterns): continue

        if repo_p.name == '.insetu' and (norm_path.startswith('data/') or '/data/' in norm_path):
            continue
        if target_f.name.lower() in (".gitkeep", ".keep"):
            valid_files.add(norm_path)
            continue
        ext = target_f.suffix.lower()
        fname = target_f.name.lower()

        allowed_exts = set(config.get("exts") if config.get("exts") is not None else (live_cfg.get("include_extensions") or []))

        if ext in allowed_exts or fname in allowed_exts: valid_files.add(norm_path)

    for forced_file in (config.get("force_include") or []):
        if (repo_p / forced_file).exists(): 
            valid_files.add(forced_file)

    return sorted(list(valid_files))

def resolve_file_bucket(filepath, sub_buckets, repo_dir=""):
    import re
    clean_filepath = re.sub(r'^(?:\[[A-Z?!\s]{1,2}\]\s+|[A-Z?!\s]{2}\s+)', '', filepath).strip()

    if ' -> ' in clean_filepath:
        clean_filepath = clean_filepath.split(' -> ')[-1].strip()

    clean_filepath_lower = clean_filepath.lower()
    safe_repo_prefix = (repo_dir.lower() + "/") if repo_dir else ""

    for b in sub_buckets:
        prefix = b.get("dynamic_split_prefix")
        if prefix:
            prefix_lower = prefix.lower()
            if prefix_lower == "." or clean_filepath_lower.startswith(prefix_lower):
                parts = clean_filepath.split("/")
                module_idx = len([p for p in prefix.split('/') if p and p != '.'])
                if len(parts) > module_idx + 1:
                    return b, parts[module_idx]
                continue
        elif b.get("match_prefixes"):
            for p in b["match_prefixes"]:
                p_lower = p.lower()
                if clean_filepath_lower.startswith(p_lower):
                    return b, None
                if safe_repo_prefix and p_lower.startswith(safe_repo_prefix):
                    stripped_p = p_lower[len(safe_repo_prefix):]
                    if stripped_p and clean_filepath_lower.startswith(stripped_p):
                        return b, None
    catch_all = next((b for b in sub_buckets if b.get("is_catch_all")), None)
    return catch_all, None
def resolve_owning_workspaces(event_name, **kwargs):
    """Domain-aware spatial router for OS lifecycle events."""
    if event_name != 'vfs_mutated': return set()

    mutations = kwargs.get('mutations', [])
    origin_workspace_id = kwargs.get('workspace_id')
    owning_workspaces = set()

    from akasa.utils import get_all_workspace_ids, get_workspace_physics, load_config
    from akasa.vfs import _resolve_physical_path
    from pathlib import Path

    all_ws_ids = get_all_workspace_ids()

    for m in mutations:
        filepath = m.get('filepath')
        if not filepath: continue

        # 1. Elevate the logical alias into an absolute physical identity
        abs_target = None
        if Path(filepath).is_absolute():
            abs_target = Path(filepath).resolve().as_posix()
        elif origin_workspace_id:
            resolved = _resolve_physical_path(filepath, origin_workspace_id)
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
hooks.set_workspace_router(resolve_owning_workspaces)