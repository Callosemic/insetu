import time
from insetu.kernel.db import get_connection
from insetu.kernel.hooks import hooks
from insetu.kernel.utils import sniff_tenant_id

KERNEL_BOOT_TS = time.time()

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
    active_job_rows = conn.execute(
        "SELECT ext_name, callback_name, args_json FROM immediate_jobs WHERE status IN ('pending', 'processing')"
    ).fetchall()

    active_modules_set = set()
    pending_modules_set = set()
    is_compiling_immediate = False
    for r in active_job_rows:
        cb = r['callback_name'] or ""
        # Strictly define which tasks represent a global UI-blocking compilation state
        is_compiler = cb.startswith('compile_') or cb in ('pack_selection_task', 'execute_delayed_compile', 'boot_scan_task', 'resolve_topology_task', 'scan_topology_task')

        if is_compiler:
            is_compiling_immediate = True
            if r['ext_name']:
                active_modules_set.add(r['ext_name'])
            try:
                import json
                args = json.loads(r['args_json'] or "{}")
                for step in args.get('_chain', {}).get('steps', []):
                    if step.get('ext_name'):
                        pending_modules_set.add(step['ext_name'])
            except Exception:
                pass

    active_modules = list(active_modules_set)
    pending_modules = [m for m in pending_modules_set if m not in active_modules_set]

    # Routine metronome jobs (garbage collection, sweeps) do not lock the UI.
    compiling_jobs = conn.execute(
        "SELECT count(*) FROM jobs WHERE status = 'running' AND callback_name = 'execute_delayed_compile'"
    ).fetchone()[0]

    is_compiling = is_compiling_immediate or (compiling_jobs > 0)

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
        "backend_boot_ts": KERNEL_BOOT_TS,
        "is_compiling": is_compiling,
        "active_modules": active_modules,
        "pending_modules": pending_modules,
        "mutations": mutations,
        "signatures": signatures
    }