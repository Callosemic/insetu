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
def submit_job(job_id, ext_name, callback_name, interval_ms, args_json="{}", 
    jitter_ms=0, workspace_id=None):
    """Writes a background task to the SQLite Ledger securely tracking tenant contexts."""
    if not workspace_id:
        try:
            from flask import request
            if request:
                workspace_id = request.headers.get('X-Workspace-ID')
        except RuntimeError:
            pass
    workspace_id = workspace_id or "default"

    conn = get_connection("workers", workspace_id=workspace_id)
    now = time.time()
    try:
        args_payload = json.loads(args_json)
        if "_workspace_id" not in args_payload:
            args_payload["_workspace_id"] = workspace_id
        args_json = json.dumps(args_payload)
    except Exception:
        pass

    conn.execute("""
        INSERT OR REPLACE INTO jobs (id, ext_name, callback_name, interval_ms, jitter_ms, next_run_at, status, args_json)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    """, (job_id, ext_name, callback_name, interval_ms, jitter_ms, now, args_json))
    conn.commit()

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
    from insetu.utils_core import _cwd
    while not _shutdown_event.is_set():
        try:
            index_path = os.path.join(_cwd, ".insetu", "workspaces.json")
            workspace_ids = ["default"]
            if os.path.exists(index_path):
                try:
                    with open(index_path, 'r', encoding='utf-8') as f:
                        w_data = json.load(f)
                        workspace_ids = list(w_data.get("workspaces", {}).keys())
                        if "default" not in workspace_ids:
                            workspace_ids.append("default")
                except Exception:
                    pass

            now = time.time()
            for ws_id in workspace_ids:
                try:
                    conn = get_connection("workers", workspace_id=ws_id)
                    cursor = conn.execute("SELECT * FROM jobs WHERE status='pending' AND next_run_at <= ?", (now,))
                    ready_jobs = cursor.fetchall()
                    for row in ready_jobs:
                        conn.execute("UPDATE jobs SET status='running' WHERE id=?", (row['id'],))
                        conn.commit()

                        jitter = row['jitter_ms'] if 'jitter_ms' in row.keys() else 0
                        _executor.submit(_execute_job, row['id'], row['ext_name'], row['callback_name'], row['interval_ms'], jitter, row['args_json'])
                except Exception:
                    pass
        except Exception:
            pass

        time.sleep(1.0) # Tick pace
@hooks.on('system_boot')
def start_workers():
    global _executor, _metronome_thread

    conn = get_connection("workers")
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
    try:
        conn.execute("ALTER TABLE jobs ADD COLUMN jitter_ms INTEGER DEFAULT 0")
        conn.commit()
    except Exception:
        pass

    # Heal the ledger: Demote any jobs left 'running' from a prior kernel panic back to 'pending'
    conn.execute("UPDATE jobs SET status='pending' WHERE status='running'")
    conn.commit()
    
    _executor = ThreadPoolExecutor(max_workers=3)
    _shutdown_event.clear()
    _metronome_thread = threading.Thread(target=_metronome_loop, daemon=True)
    _metronome_thread.start()
    print("⚙️  Stateless Worker Metronome Online.")

@hooks.on('system_shutdown')
def stop_workers():
    global _executor
    print("🛑 Suspending Worker Metronome...")
    _shutdown_event.set()
    if _executor:
        _executor.shutdown(wait=True)
    
    try:
        conn = get_connection("workers")
        conn.execute("UPDATE jobs SET status='pending' WHERE status='running'")
        conn.commit()
    except Exception:
        pass