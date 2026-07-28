from pathlib import Path
import os
import time
import json
import threading
from concurrent.futures import ThreadPoolExecutor
from insetu.db import get_connection
from insetu.hooks import hooks

_executor = None
_metronome_thread = None
_shutdown_event = threading.Event()
_callbacks = {}
def register_callback(ext_name, callback_name, func):
    """Extensions register their background functions here to be triggered by the Metronome."""
    _callbacks[f"{ext_name}:{callback_name}"] = func

def _prepare_job_payload(args_json, workspace_id):
    if not workspace_id:
        from insetu.utils_core import sniff_tenant_id
        workspace_id = sniff_tenant_id()
    workspace_id = workspace_id or "default"
    _init_worker_schema(workspace_id)
    conn = get_connection("workers", workspace_id=workspace_id)
    now = time.time()
    try:
        args_payload = json.loads(args_json)
        if "_workspace_id" not in args_payload:
            args_payload["_workspace_id"] = workspace_id
        args_json = json.dumps(args_payload)
    except Exception:
        pass
    return workspace_id, conn, now, args_json

def submit_job(job_id, ext_name, callback_name, interval_ms, args_json="{}", jitter_ms=0, workspace_id=None):
    """Writes a background task to the SQLite Ledger securely tracking tenant contexts."""
    if _shutdown_event.is_set():
        return False

    workspace_id, conn, now, args_json = _prepare_job_payload(args_json, workspace_id)
    conn.execute("""
        INSERT OR REPLACE 
INTO jobs (id, ext_name, callback_name, interval_ms, jitter_ms, next_run_at, status, args_json)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    """, (job_id, ext_name, callback_name, interval_ms, jitter_ms, now, args_json))
    conn.commit()

def submit_immediate_job(job_id, ext_name, callback_name, args_json="{}", workspace_id=None):
    """Drops a task directly into the active ThreadPoolExecutor and logs its lifecycle for UI polling."""
    if _shutdown_event.is_set():
        return False

    workspace_id, conn, now, args_json = _prepare_job_payload(args_json, workspace_id)
    conn.execute("""
        INSERT OR REPLACE INTO immediate_jobs (id, ext_name, callback_name, status, status_message, artifact_json, created_at, updated_at, args_json)
        VALUES (?, ?, ?, 'processing', 'Initializing...', '{}', ?, ?, ?)
    """, (job_id, ext_name, callback_name, now, now, args_json))
    conn.commit()

    if not _shutdown_event.is_set():
        try:
            _executor.submit(_execute_immediate_job, job_id, ext_name, callback_name, args_json, workspace_id)
        except RuntimeError as e:
            if "shutdown" not in str(e).lower():
                raise
    return True
def update_immediate_job_meta(job_id, meta_dict, workspace_id="default"):
    """Helper for workers to safely update discrete metrics without altering stream status."""
    import json
    conn = get_connection("workers", workspace_id=workspace_id)
    conn.execute("UPDATE immediate_jobs SET meta_json=? WHERE id=?", (json.dumps(meta_dict), job_id))
    conn.commit()

def update_immediate_job_status(job_id, status, message=None, artifact=None, workspace_id="default"):
    """Helper for workers to update their streaming status."""
    conn = get_connection("workers", workspace_id=workspace_id)
    now = time.time()

    updates = ["updated_at=?"]
    params = [now]

    if status is not None:
        updates.append("status=?")
        params.append(status)
    if message is not None:
        updates.append("status_message=?")
        params.append(message)
    if artifact is not None:
        updates.append("artifact_json=?")
        params.append(json.dumps(artifact))

    params.append(job_id)
    query = f"UPDATE immediate_jobs SET {', '.join(updates)} WHERE id=?"
    conn.execute(query, tuple(params))
    conn.commit()

def _execute_immediate_job(job_id, ext_name, callback_name, args_json, target_ws):
    """Executes an immediate job and manages its lifecycle in the ledger."""
    func = _callbacks.get(f"{ext_name}:{callback_name}")
    try:
        kwargs = json.loads(args_json)
        if "_workspace_id" in kwargs:
            target_ws = kwargs.pop("_workspace_id")
    except Exception:
        kwargs = {}

    if func:
        try:
            import inspect
            sig = inspect.signature(func)
            if 'workspace_id' in sig.parameters:
                kwargs['workspace_id'] = target_ws
            if 'job_id' in sig.parameters:
                kwargs['job_id'] = job_id
            func(**kwargs)

            # If the function didn't already mark it completed/failed, do it here gracefully
            conn = get_connection("workers", workspace_id=target_ws)
            current = conn.execute("SELECT status FROM immediate_jobs WHERE id=?", (job_id,)).fetchone()
            if current and current['status'] == 'processing':
                update_immediate_job_status(job_id, 'completed', 'Execution finished.', None, target_ws)
        except Exception as e:
            print(f"❌ [Worker] Immediate Job {job_id} failed on workspace [{target_ws}]: {e}")
            update_immediate_job_status(job_id, 'failed', f"Error: {str(e)}", None, target_ws)
    else:
        update_immediate_job_status(job_id, 'failed', f"Callback {ext_name}:{callback_name} not found.", None, target_ws)
def register_ephemeral_artifact(filepath, owner, ttl_seconds, workspace_id="default"):
    conn = get_connection("workers", workspace_id=workspace_id)
    now = time.time()
    import uuid
    art_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO ephemeral_artifacts (id, filepath, module_owner, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
        (art_id, filepath, owner, now, now + ttl_seconds)
    )
    conn.commit()

def sweep_ephemeral_artifacts(workspace_id="default"):
    """Sweeps and deletes expired temporary files and old immediate jobs."""
    conn = get_connection("workers", workspace_id=workspace_id)
    now = time.time()

    # 1. Sweep Ephemeral Artifacts
    cursor = conn.execute("SELECT id, filepath FROM ephemeral_artifacts WHERE expires_at < ?", (now,))
    for row in cursor.fetchall():
        try:
            import os
            if os.path.exists(row['filepath']):
                os.remove(row['filepath'])
            conn.execute("DELETE FROM ephemeral_artifacts WHERE id=?", (row['id'],))
        except Exception as e:
            print(f"⚠️ Failed to garbage collect ephemeral artifact {row['filepath']}: {e}")

    # 2. Sweep Old Immediate Jobs (> 24 hours)
    cutoff = now - 86400
    conn.execute("DELETE FROM immediate_jobs WHERE updated_at < ? AND status IN ('completed', 'failed')", (cutoff,))
    conn.commit()

register_callback("workers", "sweep_ephemeral_artifacts", sweep_ephemeral_artifacts)

def _execute_job(job_id, ext_name, callback_name, interval_ms, jitter_ms, args_json, fallback_ws="default"):
    """Executes the mapped Python callback inside the ThreadPool ensuring contextual tenant forwarding."""
    func = _callbacks.get(f"{ext_name}:{callback_name}")
    target_ws = fallback_ws
    try:
        kwargs = json.loads(args_json)
        if "_workspace_id" in kwargs:
            target_ws = kwargs.pop("_workspace_id")
    except Exception:
        kwargs = {}

    if func:
        try:
            import inspect
            sig = inspect.signature(func)
            if 'workspace_id' in sig.parameters:
                kwargs['workspace_id'] = target_ws
            func(**kwargs)
        except Exception as e:
            print(f"❌ [Worker] Job {job_id} failed on workspace context [{target_ws}]: {e}")
    
    if not _shutdown_event.is_set():
        try:
            import random
            actual_interval = interval_ms
            if jitter_ms and jitter_ms > 0:
                actual_interval += random.randint(-jitter_ms, jitter_ms)

            conn = get_connection("workers", workspace_id=target_ws)
            next_run = time.time() + (actual_interval / 1000.0)
            conn.execute("UPDATE jobs SET status='pending', next_run_at=? WHERE id=?", (next_run, job_id))
            conn.commit()
        except Exception:
            pass
def _metronome_loop():
    """The unified Event Loop dispatcher supporting dynamic multi-tenancy."""
    from insetu.utils_core import _cwd, load_json_file
    while not _shutdown_event.is_set():
        try:
            index_path = Path(_cwd).joinpath(".insetu", "workspaces.json").as_posix()
            workspace_ids = ["default"]

            if os.path.exists(index_path):
                try:
                    w_data = load_json_file(index_path, {})

                    workspace_ids = list(w_data.get("workspaces", {}).keys())
                    if "default" not in workspace_ids:
                        workspace_ids.append("default")
                except Exception:
                    pass
            now = time.time()
            for ws_id in workspace_ids:
                try:
                    # JIT initialization: instantly prep schemas for newly mounted workspaces
                    _init_worker_schema(ws_id)
                    conn = get_connection("workers", workspace_id=ws_id)
                    cursor = conn.execute("SELECT * FROM jobs WHERE status='pending' AND next_run_at <= ?", (now,))
                    ready_jobs = cursor.fetchall()
                    for row in ready_jobs:
                        conn.execute("UPDATE jobs SET status='running' WHERE id=?", (row['id'],))
                        conn.commit()

                        jitter = row['jitter_ms'] if 'jitter_ms' in row.keys() else 0
                        _executor.submit(_execute_job, row['id'], row['ext_name'], row['callback_name'], row['interval_ms'], jitter, row['args_json'], ws_id)
                except Exception:
                    pass
        except Exception:
            pass
        time.sleep(1.0) # Tick pace

_INITIALIZED_WORKSPACES = set()

def _init_worker_schema(workspace_id="default"):
        global _INITIALIZED_WORKSPACES
        if workspace_id in _INITIALIZED_WORKSPACES:
                return

        conn = get_connection("workers", workspace_id=workspace_id)
        conn.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                        id TEXT PRIMARY KEY,
                        ext_name TEXT,
                        callback_name TEXT,
                        interval_ms INTEGER,
                        jitter_ms INTEGER DEFAULT 0,
                        next_run_at REAL,
                        status TEXT,
                        args_json TEXT
                )
        """)
        conn.execute("""
                CREATE TABLE IF NOT EXISTS ephemeral_artifacts (
                        id TEXT PRIMARY KEY,
                        filepath TEXT,
                        module_owner TEXT,
                        created_at REAL,
                        expires_at REAL
                )
        """)
        conn.execute("""
                CREATE TABLE IF NOT EXISTS immediate_jobs (
                        id TEXT PRIMARY KEY,
                        ext_name TEXT,
                        callback_name TEXT,
                        status TEXT,
                        status_message TEXT,
                        artifact_json TEXT,
                        meta_json TEXT,
                        created_at REAL,
                        updated_at REAL,
                        args_json TEXT
                )
        """)
        try:
                conn.execute("ALTER TABLE jobs ADD COLUMN jitter_ms INTEGER DEFAULT 0")
                conn.execute("ALTER TABLE immediate_jobs ADD COLUMN meta_json TEXT")
                conn.commit()
        except Exception:
                pass
        conn.execute("UPDATE jobs SET status='pending' WHERE status='running'")
        conn.execute("""
                INSERT OR REPLACE INTO jobs (id, ext_name, callback_name, interval_ms, jitter_ms, next_run_at, status, args_json)
                VALUES ('sys_garbage_collector', 'workers', 'sweep_ephemeral_artifacts', 300000, 10000, 0, 'pending', '{}')
        """)
        conn.execute("""
                INSERT OR REPLACE INTO jobs (id, ext_name, callback_name, interval_ms, jitter_ms, next_run_at, status, args_json)
                VALUES ('sys_vfs_ledger_daemon', 'gather', 'process_vfs_ledger', 1000, 0, 0, 'pending', '{}')
        """)
        conn.commit()
        _INITIALIZED_WORKSPACES.add(workspace_id)

_observer = None

class NonGitDirectoryWatcher:
    """Listens directly to the host OS filesystem for external unmanaged mutations."""
    def __init__(self, workspace_id, repo_dir):
        self.workspace_id = workspace_id
        self.repo_dir = repo_dir
    def dispatch(self, event):
        if event.is_directory: return
        filename = Path(event.src_path).name
        if filename.startswith('.') or filename.endswith('~'): return

        from insetu.utils_core import get_workspace_physics
        try:
            _, ws_root, _ = get_workspace_physics(self.workspace_id)
            ws_rel_path = os.path.relpath(event.src_path, ws_root).replace('\\', '/')

            mutation_type = 'modified'
            if event.event_type == 'created': mutation_type = 'added'
            elif event.event_type == 'deleted': mutation_type = 'deleted'

            from insetu.db import get_connection
            import time
            db_conn = get_connection("workers", workspace_id=self.workspace_id)
            db_conn.execute(
                "INSERT OR REPLACE INTO vfs_event_log (filepath, mutation_type, timestamp) VALUES (?, ?, ?)",
                (ws_rel_path, mutation_type, time.time())
            )
            db_conn.commit()
        except Exception:
            pass
import time
SYSTEM_BOOT_TIME = time.time()

@hooks.on('system_boot')
def start_workers():
        global _executor, _metronome_thread, _observer

        from insetu.utils_core import _cwd, load_json_file
        import os
        index_path = Path(_cwd).joinpath(".insetu", "workspaces.json").as_posix()
        workspace_ids = ["default"]
        if os.path.exists(index_path):
                try:
                        w_data = load_json_file(index_path, {})
                        workspace_ids = list(w_data.get("workspaces", {}).keys())
                        if "default" not in workspace_ids:
                                workspace_ids.append("default")
                except Exception:
                        pass
        for ws_id in workspace_ids:
                _init_worker_schema(ws_id)
                # Clean up ghost jobs strictly once during the OS boot sequence
                conn = get_connection("workers", workspace_id=ws_id)
                conn.execute("UPDATE immediate_jobs SET status='failed', status_message='Interrupted by system reboot.' WHERE status IN ('pending', 'processing')")
                conn.commit()

                # Boot-Time Heuristic: Offline Mutation Guard
                from insetu.sdk import ExtensionContext
                from insetu.utils_core import load_json_file
                import uuid, json
                ctx = ExtensionContext('gather', ws_id)
                cache_path = Path(ctx.paths["contexts_dir"]).joinpath("manifest_cache.json").as_posix()
                cache_data = load_json_file(cache_path, {})
                last_compile = cache_data.get("last_full_compile_time", 0)

                if SYSTEM_BOOT_TIME > last_compile:
                    job_id = f"cmp_{uuid.uuid4().hex[:8]}"
                    args_json = json.dumps({"force_full": True})
                    conn.execute("""
                        INSERT OR REPLACE INTO immediate_jobs (id, ext_name, callback_name, status, status_message, artifact_json, created_at, updated_at, args_json)
                        VALUES (?, ?, ?, 'processing', 'Healing offline mutations...', '{}', ?, ?, ?)
                    """, (job_id, "gather", "compile_contexts", time.time(), time.time(), args_json))
                    conn.commit()

        _executor = ThreadPoolExecutor(max_workers=3)
        # Flush the immediate_jobs queue natively for the boot heuristics
        for ws_id in workspace_ids:
            conn = get_connection("workers", workspace_id=ws_id)
            for row in conn.execute("SELECT id, args_json FROM immediate_jobs WHERE callback_name='compile_contexts' AND status='processing'").fetchall():
                _executor.submit(_execute_immediate_job, row['id'], "gather", "compile_contexts", row['args_json'], ws_id)
        _shutdown_event.clear()
        _metronome_thread = threading.Thread(target=_metronome_loop, daemon=True)
        _metronome_thread.start()
        print("⚙️  Stateless Worker Metronome Online.")

        try:
            from watchdog.observers import Observer
            from watchdog.events import FileSystemEventHandler

            _observer = Observer()
            has_watches = False

            for ws_id in workspace_ids:
                from insetu.utils_core import load_config, get_workspace_physics
                cfg = load_config(ws_id)
                _, ws_root, _ = get_workspace_physics(ws_id)

                for repo_cfg in cfg.get("target_repos", []):
                    if repo_cfg.get("archive_type", "repo") != "repo":
                        r_dir = repo_cfg.get("repo_dir")
                        p_path = repo_cfg.get("physical_path")
                        target_path = os.path.abspath(os.path.expanduser(p_path)) if p_path else Path(ws_root).joinpath(r_dir).resolve().as_posix()

                        if os.path.exists(target_path):
                            handler = FileSystemEventHandler()
                            watcher = NonGitDirectoryWatcher(ws_id, r_dir)
                            handler.on_modified = watcher.dispatch
                            handler.on_created = watcher.dispatch
                            handler.on_deleted = watcher.dispatch

                            _observer.schedule(handler, target_path, recursive=True)
                            has_watches = True
            if has_watches:
                _observer.start()
                print("👁️  Native Non-Git Filesystem Watchers Engaged.")
        except ImportError:
            print("⚠️  Optional package 'watchdog' not found. External modifications require full sweeps.")
        except Exception as e:
            print(f"⚠️  Watcher initialization failed: {e}")

@hooks.on('system_shutdown')
def stop_workers():
    global _executor, _observer
    print("🛑 Suspending Worker Metronome...")
    _shutdown_event.set()
    if _observer:
        try:
            _observer.stop()
            _observer.join(timeout=2.0)
        except Exception: pass
    if _executor:
        _executor.shutdown(wait=False)

    try:
        conn = get_connection("workers")
        conn.execute("UPDATE jobs SET status='pending' WHERE status='running'")
        conn.commit()
    except Exception:
        pass