from pathlib import Path
import os
import sqlite3
import threading
from insetu.kernel.utils import get_workspace_physics
from insetu.kernel.hooks import hooks

# Thread-local storage guarantees safe connection pooling across the ASGI / Worker matrix
_local = threading.local()

_REGISTERED_SCHEMAS = {}

def register_schema(ext_name, schema_dict):
    """Registers a declarative SQLite schema for automatic workspace migration."""
    _REGISTERED_SCHEMAS[ext_name] = schema_dict

def apply_declarative_schema(db_name, schema_dict, workspace_id=None):
    """Generates CREATE TABLE and executes ALTER TABLE ADD COLUMN migrations via diffing."""
    conn = get_connection(db_name, workspace_id)
    for table_name, columns in schema_dict.items():
        # 1. Generate CREATE TABLE
        col_defs = ", ".join([f"{col} {dtype}" for col, dtype in columns.items()])
        conn.execute(f"CREATE TABLE IF NOT EXISTS {table_name} ({col_defs})")

        # 2. Diff columns and ALTER TABLE
        cursor = conn.execute(f"PRAGMA table_info({table_name})")
        existing_cols = {row['name'] for row in cursor.fetchall()}

        for col, dtype in columns.items():
            if col not in existing_cols:
                try:
                    conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {col} {dtype}")
                except Exception as e:
                    print(f"⚠️ Auto-migration failed for {table_name}.{col}: {e}")
    conn.commit()
# Register core worker database schema for tracking all file deltas contextually
register_schema('workers', {
    'vfs_event_log': {
        'filepath': 'TEXT PRIMARY KEY',
        'mutation_type': 'TEXT',
        'timestamp': 'REAL'
    }
})
@hooks.on('system_boot')
def init_declarative_schemas():
    """Automatically provisions schemas and boots workspaces across all tenants."""
    from insetu.kernel.utils import get_all_workspace_ids
    for ws_id in get_all_workspace_ids():
        for ext_name, schema in _REGISTERED_SCHEMAS.items():
            apply_declarative_schema(ext_name, schema, ws_id)
        hooks.emit('workspace_boot', workspace_id=ws_id)

@hooks.on('workspace_shutdown')
def close_workspace_connections(workspace_id=None, **kwargs):
    """Evicts and closes thread-local SQLite connections for an unmounting tenant workspace."""
    if not workspace_id or not hasattr(_local, 'connections'):
        return
    keys_to_close = [k for k in _local.connections.keys() if k[0] == workspace_id]
    for key in keys_to_close:
        try:
            _local.connections[key].close()
        except Exception:
            pass
        del _local.connections[key]
def get_connection(db_name, workspace_id=None):
    """
    Returns a thread-local SQLite connection.
    Keys connection by (workspace_id, db_name) to support stateless multi-tenancy.
    Strictly enforces WAL mode and busy timeouts to prevent concurrent database locks.
    """
    if not hasattr(_local, 'connections'):
        _local.connections = {}
    if not workspace_id:
        from insetu.kernel.utils import sniff_tenant_id
        workspace_id = sniff_tenant_id()

    # Key the connection by tenant
    cache_key = (workspace_id, db_name)

    # True LRU: Pop and re-insert to move the accessed key to the end of the dictionary
    if cache_key in _local.connections:
        conn = _local.connections.pop(cache_key)
        _local.connections[cache_key] = conn
        return conn

    cfg_path, _, _ = get_workspace_physics(workspace_id)
    artifacts_base = Path(cfg_path).parent.joinpath("data").as_posix()
    db_path = Path(artifacts_base).joinpath(f"{db_name}.db").as_posix()

    # Phase 3: LRU Eviction Policy (Max 5 Workspaces to prevent WAL lock exhaustion)
    if len(_local.connections) >= 5:
        oldest_key = list(_local.connections.keys())[0]
        try:
            _local.connections[oldest_key].close()
        except Exception: pass
        del _local.connections[oldest_key]

    os.makedirs(Path(db_path).parent, exist_ok=True)
    # Bypassing same_thread check is safe here because we guarantee thread-local storage
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row

    # Enforce Concurrent Data Safety Laws
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    conn.commit()

    _local.connections[cache_key] = conn
    return conn