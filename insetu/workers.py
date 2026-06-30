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
def submit_job(job_id, ext_name, callback_name, interval_ms, args_json="{}", jitter_ms=0):
    """Writes a background task to the SQLite Ledger."""
    conn = get_connection("workers")
    now = time.time()
    conn.execute("""
        INSERT OR REPLACE INTO jobs (id, ext_name, callback_name, interval_ms, jitter_ms, next_run_at, status, args_json)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    """, (job_id, ext_name, callback_name, interval_ms, jitter_ms, now, args_json))
    conn.commit()

def _execute_job(job_id, ext_name, callback_name, interval_ms, jitter_ms, args_json):
    """Executes the mapped Python callback inside the ThreadPool."""
    func = _callbacks.get(f"{ext_name}:{callback_name}")
    if func:
        try:
            kwargs = json.loads(args_json)
            func(**kwargs)
        except Exception as e:
            print(f"❌ [Worker] Job {job_id} failed: {e}")
    # Reschedule in the ledger based on interval_ms and jitter
    if not _shutdown_event.is_set():
        try:
            import random
            actual_interval = interval_ms
            if jitter_ms and jitter_ms > 0:
                actual_interval += random.randint(-jitter_ms, jitter_ms)

            conn = get_connection("workers")
            next_run = time.time() + (actual_interval / 1000.0)
            conn.execute("UPDATE jobs SET status='pending', next_run_at=? WHERE id=?", (next_run, job_id))
            conn.commit()
        except Exception:
            pass

def _metronome_loop():
    """The unified Event Loop dispatcher."""
    while not _shutdown_event.is_set():
        try:
            conn = get_connection("workers")
            now = time.time()
            
            # Fetch ready jobs
            cursor = conn.execute("SELECT * FROM jobs WHERE status='pending' AND next_run_at <= ?", (now,))
            ready_jobs = cursor.fetchall()
            for row in ready_jobs:
                # Lock the job instantly to prevent Overrun Starvation
                conn.execute("UPDATE jobs SET status='running' WHERE id=?", (row['id'],))
                conn.commit()

                # Dispatch to ThreadPool
                jitter = row['jitter_ms'] if 'jitter_ms' in row.keys() else 0
                _executor.submit(_execute_job, row['id'], row['ext_name'], row['callback_name'], row['interval_ms'], jitter, row['args_json'])
        except Exception as e:
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