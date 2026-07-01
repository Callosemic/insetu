import os
import sqlite3
import threading
from insetu.utils_core import get_workspace_physics

# Thread-local storage guarantees safe connection pooling across the ASGI / Worker matrix
_local = threading.local()
def get_connection(db_name, workspace_id=None):
    """
    Returns a thread-local SQLite connection.
    Keys connection by (workspace_id, db_name) to support stateless multi-tenancy.
    Strictly enforces WAL mode and busy timeouts to prevent concurrent database locks.
    """
    if not hasattr(_local, 'connections'):
        _local.connections = {}

    if not workspace_id:
        try:
            from flask import request
            if request:
                workspace_id = request.headers.get('X-Workspace-ID')
        except RuntimeError:
            pass
    workspace_id = workspace_id or "default"

    cfg_path, _, _ = get_workspace_physics(workspace_id)
    artifacts_base = os.path.join(os.path.dirname(cfg_path), "data")
    db_path = os.path.join(artifacts_base, f"{db_name}.db")

    # Key the connection by tenant
    cache_key = (workspace_id, db_name)
    if cache_key not in _local.connections:
        # Phase 3: LRU Eviction Policy (Max 5 Workspaces to prevent WAL lock exhaustion)
        if len(_local.connections) > 5:
            oldest_key = list(_local.connections.keys())[0]
            try:
                _local.connections[oldest_key].close()
            except Exception: pass
            del _local.connections[oldest_key]

        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        # Bypassing same_thread check is safe here because we guarantee thread-local storage
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        
        # Enforce Concurrent Data Safety Laws
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.execute("PRAGMA busy_timeout=5000;")
        conn.commit()

        _local.connections[cache_key] = conn

    return _local.connections[cache_key]