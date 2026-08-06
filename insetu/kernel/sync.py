import time
from insetu.kernel.db import get_connection
from insetu.kernel.hooks import hooks
from insetu.kernel.utils import sniff_tenant_id

def get_system_deltas(workspace_id=None, since_ts=0.0):
    """
    Calculates lightweight system deltas and collects domain-specific signatures.
    Acts as the low-level kernel heartbeat substrate.
    """
    wid = workspace_id or sniff_tenant_id() or "default"
    now = time.time()
    conn = get_connection("workers", workspace_id=wid)
    
    # 1. Physical Mutations
    cursor = conn.execute(
        "SELECT filepath, mutation_type as operation, timestamp FROM vfs_event_log WHERE timestamp > ? ORDER BY timestamp ASC",
        (since_ts,)
    )
    mutations = [dict(r) for r in cursor.fetchall()]

    # 2. Telemetry & Is Compiling State
    compiling_immediate = conn.execute(
        "SELECT count(*) FROM immediate_jobs WHERE status IN ('pending', 'processing')"
    ).fetchone()[0]
    
    compiling_jobs = conn.execute(
        "SELECT count(*) FROM jobs WHERE status = 'running'"
    ).fetchone()[0]

    is_compiling = (compiling_immediate > 0) or (compiling_jobs > 0)

    # 3. Collect Signatures via Event Bus
    signatures = {}
    hook_responses = hooks.emit('register_manifest_signatures', workspace_id=wid, since_ts=since_ts)
    for res in hook_responses:
        if isinstance(res, dict):
            for domain, sigs in res.items():
                if domain not in signatures:
                    signatures[domain] = {}
                if isinstance(sigs, dict):
                    signatures[domain].update(sigs)

    return {
        "timestamp": now,
        "is_compiling": is_compiling,
        "mutations": mutations,
        "signatures": signatures
    }