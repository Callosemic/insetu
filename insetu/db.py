import os
import sqlite3
import threading
from insetu.utils_core import CONFIG_PATH

# Anchor DBs to the localized data vault
WORKSPACE_DIR = os.path.dirname(CONFIG_PATH)
ARTIFACTS_BASE = os.path.join(WORKSPACE_DIR, "data")
os.makedirs(ARTIFACTS_BASE, exist_ok=True)

# Thread-local storage guarantees safe connection pooling across the ASGI / Worker matrix
_local = threading.local()

def get_connection(db_name, artifacts_base=ARTIFACTS_BASE):
    """
    Returns a thread-local SQLite connection.
    Strictly enforces WAL mode and busy timeouts to prevent concurrent database locks.
    """
    if not hasattr(_local, 'connections'):
        _local.connections = {}
    
    db_path = os.path.join(artifacts_base, f"{db_name}.db")
    
    if db_path not in _local.connections:
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        # Bypassing same_thread check is safe here because we guarantee thread-local storage
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        
        # Enforce Concurrent Data Safety Laws
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.execute("PRAGMA busy_timeout=5000;")
        conn.commit()
        
        _local.connections[db_path] = conn
        
    return _local.connections[db_path]