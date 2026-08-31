import time
from flask import jsonify
from insetu.core.sdk import InSetuExtension, ExtensionContext
from insetu.kernel.hooks import hooks

__depends__ = []

# 1. Define the Extension and Telemetry Schema
dev_bp = InSetuExtension(
    'dev',
    __name__,
    title="Developer Dashboard",
    description="System telemetry and diagnostic dashboard.",
    schema={
        'file_telemetry': {
            'id': 'INTEGER PRIMARY KEY AUTOINCREMENT',
            'filepath': 'TEXT',
            'operation': 'TEXT',
            'timestamp': 'REAL'
        },
        'bridge_errors': {
            'id': 'INTEGER PRIMARY KEY AUTOINCREMENT',
            'filepath': 'TEXT',
            'error_type': 'TEXT',
            'details': 'TEXT',
            'file_content': 'TEXT',
            'patch_payload': 'TEXT',
            'timestamp': 'REAL'
        }
    }
)

# 2. Intercept Ecosystem Hooks
@hooks.on('vfs_mutated')
def log_vfs_telemetry(mutations=None, workspace_id="default", **kwargs):
    if not mutations: return
    try:
        ctx = dev_bp.get_context(workspace_id)
        conn = ctx.db
        now = time.time()
        for m in mutations:
            conn.execute(
                "INSERT INTO file_telemetry (filepath, operation, timestamp) VALUES (?, ?, ?)",
                (m.get("filepath"), m.get("operation"), now)
            )
        conn.commit()
    except Exception as e:
        print(f"⚠️ [Dev Dash] Failed to log VFS telemetry: {e}")
@hooks.on('bridge_error')
def log_bridge_error(filepath=None, error_type=None, details=None, file_content=None, patch_payload=None, workspace_id="default", **kwargs):
    if not filepath: return
    try:
        ctx = dev_bp.get_context(workspace_id)
        conn = ctx.db
        conn.execute(
            "INSERT INTO bridge_errors (filepath, error_type, details, file_content, patch_payload, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            (filepath, error_type, details, file_content, patch_payload, time.time())
        )
        conn.commit()
    except Exception as e:
        print(f"⚠️ [Dev Dash] Failed to log bridge error: {e}")
# 3. Rest Route for Metric Aggregation
@dev_bp.route('metrics', methods=['GET'])
def get_dev_metrics(ctx):
    now = time.time()
    cutoff = now - 3600  

    # Fetch all telemetry in the last hour
    raw_telemetry = ctx.db.execute("SELECT filepath, timestamp FROM file_telemetry WHERE timestamp >= ?", (cutoff,)).fetchall()

    file_buckets = {}
    for row in raw_telemetry:
        fp = row['filepath']
        ts = row['timestamp']
        if fp not in file_buckets:
            file_buckets[fp] = [0] * 60

        # Distribute into 60 rolling 1-minute buckets (Index 59 = Current Minute)
        minute_idx = 59 - int((now - ts) / 60)
        if 0 <= minute_idx < 60:
            file_buckets[fp][minute_idx] += 1

    thrashing_data = []
    for fp, buckets in file_buckets.items():
        peak = max(buckets)
        # Redefined Thrashing: >= 3 mutations in a single minute
        if peak >= 3:
            thrashing_data.append({
                "filepath": fp,
                "total_mutations": sum(buckets),
                "peak_mutations": peak,
                "history": buckets
            })

    thrashing_data.sort(key=lambda x: x['peak_mutations'], reverse=True)

    error_rows = ctx.db.execute("""
        SELECT 
            GROUP_CONCAT(DISTINCT filepath) as filepath,
            error_type, 
            MAX(details) as details, 
            MAX(file_content) as file_content, 
            patch_payload, 
            MAX(timestamp) as timestamp,
            COUNT(*) as attempt_count
        FROM bridge_errors
        GROUP BY patch_payload, error_type
        ORDER BY timestamp DESC
        LIMIT 50
    """).fetchall()

    return jsonify({
        "thrashing": thrashing_data,
        "bridge_errors": [dict(r) for r in error_rows]
    })
# 4. Background Garbage Collection
@dev_bp.worker("sweep_telemetry")
def sweep_telemetry_worker(ctx, **kwargs):
    # Retain 2 hours of telemetry to support the 1-hour dashboard window
    cutoff = time.time() - 7200
    ctx.db.execute("DELETE FROM file_telemetry WHERE timestamp < ?", (cutoff,))
    
    # Retain bridge errors for up to 7 days for LLM analysis context
    week_cutoff = time.time() - (86400 * 7)
    ctx.db.execute("DELETE FROM bridge_errors WHERE timestamp < ?", (week_cutoff,))
    
    ctx.db.commit()
    return "Telemetry swept."
@hooks.on('workspace_boot')
def init_dev_workers(workspace_id=None, **kwargs):
    try:
        from insetu.kernel.workers import submit_job
        submit_job("dev_telemetry_sweeper", "dev", "sweep_telemetry", interval_ms=60000, workspace_id=workspace_id)
    except Exception:
        pass