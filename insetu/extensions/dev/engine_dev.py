import time
from typing import TypedDict, Optional
from flask import jsonify
from insetu.core.sdk import InSetuExtension, ExtensionContext
from akasa.hooks import hooks
from insetu.core.utils_core import InSetuURI

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
        },
        'system_errors': {
            'id': 'INTEGER PRIMARY KEY AUTOINCREMENT',
            'source': 'TEXT',
            'error_type': 'TEXT',
            'message': 'TEXT',
            'traceback': 'TEXT',
            'payload': 'TEXT',
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
        insert_data = []
        for m in mutations:
            if not m.get("ignore_ledger") and m.get("filepath"):
                uri = InSetuURI.from_any(m.get("filepath"))
                if uri.scheme == 'vfs':
                    insert_data.append((str(uri), m.get("operation"), now))

        if insert_data:
            conn.executemany(
                "INSERT INTO file_telemetry (filepath, operation, timestamp) VALUES (?, ?, ?)",
                insert_data
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

@hooks.on('system_error')
def log_system_error(source="unknown", error_type="Exception", message="", traceback="", payload="", workspace_id="default", **kwargs):
    try:
        ctx = dev_bp.get_context(workspace_id)
        conn = ctx.db
        conn.execute(
            "INSERT INTO system_errors (source, error_type, message, traceback, payload, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            (source, error_type, message, traceback, payload, time.time())
        )
        conn.commit()
    except Exception as e:
        print(f"⚠️ [Dev Dash] Failed to log system error: {e}")

# 3. Rest Route for Metric Aggregation
class CmdExecPayload(TypedDict, total=False):
    command: str
    cwd: Optional[str]
    timeout: Optional[int]

class CmdExecResponse(TypedDict):
    exit_code: int
    stdout: str
    stderr: str
@dev_bp.route('exec', methods=['POST'], request_schema=CmdExecPayload, response_schema=CmdExecResponse, docstring="Executes an arbitrary shell command within the workspace sandbox for testing and verification.")
def api_dev_exec(ctx):
    """Executes an arbitrary shell command within the workspace sandbox for testing and verification."""
    data = ctx.req.json or {}
    cmd = data.get("command", "").strip()
    if not cmd:
        return jsonify({"error": "Command string is required."}), 400

    timeout = min(int(data.get("timeout", 30)), 120)
    cwd = data.get("cwd")

    try:
        res = ctx.exec.run(cmd, shell=True, cwd=cwd, timeout=timeout)
        return jsonify({
            "exit_code": res.returncode,
            "stdout": res.stdout or "",
            "stderr": res.stderr or ""
        })
    except Exception as e:
        return jsonify({
            "exit_code": -1,
            "stdout": "",
            "stderr": str(e)
        }), 500
@dev_bp.route('metrics', methods=['GET'], docstring="Retrieves system telemetry metrics, including file thrashing limits and bridge errors.")
def get_dev_metrics(ctx):
    """Retrieves system telemetry metrics, including file thrashing limits and bridge errors."""
    now = time.time()
    cutoff = now - 3600  
    # Fetch all telemetry in the last hour from the correct workers ledger
    import akasa.db as kernel_db
    w_conn = kernel_db.get_connection("workers", workspace_id=ctx.workspace_id)
    raw_telemetry = w_conn.execute("SELECT filepath, timestamp FROM vfs_event_log WHERE timestamp >= ?", (cutoff,)).fetchall()

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

    system_error_rows = ctx.db.execute("""
        SELECT source, error_type, message, traceback, payload, timestamp
        FROM system_errors
        ORDER BY timestamp DESC
        LIMIT 50
    """).fetchall()

    return jsonify({
        "thrashing": thrashing_data,
        "bridge_errors": [dict(r) for r in error_rows],
        "system_errors": [dict(r) for r in system_error_rows]
    })
@dev_bp.route('sql/databases', methods=['GET'], docstring="Lists all available SQLite databases within the tenant data directory.")
def list_sql_databases(ctx):
    """Lists all available SQLite databases within the tenant data directory."""
    from pathlib import Path
    import os
    ext_base = Path(ctx.paths['control_dir']).joinpath("ext")
    dbs = []
    if ext_base.exists() and ext_base.is_dir():
        for ext_dir in ext_base.iterdir():
            if ext_dir.is_dir():
                db_dir = ext_dir.joinpath("db")
                if db_dir.exists() and db_dir.is_dir():
                    for p in db_dir.glob("*.db"):
                        dbs.append(p.stem)
    return jsonify({"databases": sorted(list(set(dbs)))})
class SqlQueryPayload(TypedDict, total=False):
    db_name: str
    query: str

@dev_bp.route('sql/query', methods=['POST'], request_schema=SqlQueryPayload, docstring="Executes a constrained SQL query against a target workspace database.")
def execute_sql_query(ctx):
    """Executes a constrained SQL query against a target workspace database."""
    data = ctx.req.json or {}
    db_name = data.get("db_name", "workers").strip()
    query = data.get("query", "").strip()
    if not query:
        return jsonify({"error": "SQL query string is required."}), 400
    from pathlib import Path
    import akasa.db as kernel_db
    clean_db_name = Path(db_name).stem or "workers"

    try:
        conn = kernel_db.get_connection(clean_db_name, workspace_id=ctx.workspace_id)
        t0 = time.time()
        cursor = conn.execute(query)
        elapsed_ms = round((time.time() - t0) * 1000, 2)

        is_select = cursor.description is not None
        if is_select:
            columns = [col[0] for col in cursor.description]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
            return jsonify({
                "status": "success",
                "database": clean_db_name,
                "type": "select",
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
                "elapsed_ms": elapsed_ms
            })
        else:
            conn.commit()
            return jsonify({
                "status": "success",
                "database": clean_db_name,
                "type": "mutation",
                "affected_rows": cursor.rowcount,
                "elapsed_ms": elapsed_ms
            })
    except Exception as e:
        return jsonify({
            "status": "error",
            "database": clean_db_name,
            "error": str(e)
        }), 400
@dev_bp.route('logs', methods=['GET'], docstring="Retrieves the systemd journal logs for the background backend daemon.")
def get_backend_logs(ctx):
    """Retrieves the systemd journal logs for the background backend daemon."""
    from insetu.core.utils_core import execute_binary
    try:
        # Query the systemd journal for the user service if running in background
        res = execute_binary(
            ["journalctl", "--user", "-u", "insetu.service", "-n", "200", "--no-pager"], 
            capture_output=True, text=True, timeout=5
        )
        if res.returncode == 0 and res.stdout.strip():
            return jsonify({"status": "success", "logs": res.stdout.strip()})
        else:
            return jsonify({
                "status": "success", 
                "logs": "No systemd logs found for 'insetu.service'.\nIf you are running via 'insetu serve' directly in your terminal, the logs will print there instead."
            })
    except Exception as e:
        return jsonify({"status": "error", "logs": f"Failed to fetch logs: {str(e)}"})
@dev_bp.worker("download_boot_logs_task")
def download_boot_logs_worker(ctx, **kwargs):
    from insetu.core.utils_core import execute_binary
    from pathlib import Path
    from akasa.workers import register_ephemeral_artifact

    ctx.jobs.update_progress("Extracting current invocation systemd logs...")
    try:
        # 1. Retrieve the unique InvocationID for the current service run
        inv_res = execute_binary(
            ["systemctl", "--user", "show", "-p", "InvocationID", "--value", "insetu.service"],
            capture_output=True, text=True, timeout=5
        )
        inv_id = inv_res.stdout.strip()

        # 2. Filter journalctl strictly by InvocationID if available
        if inv_id and inv_id != "00000000000000000000000000000000":
            cmd = ["journalctl", "--user", f"_SYSTEMD_INVOCATION_ID={inv_id}", "--no-pager"]
        else:
            cmd = ["journalctl", "--user", "-u", "insetu.service", "-n", "5000", "--no-pager"]

        res = execute_binary(
            cmd, capture_output=True, text=True, timeout=15
        )
        log_content = res.stdout.strip() if (res.returncode == 0 and res.stdout.strip()) else "No systemd logs found for current invocation of 'insetu.service'."
    except Exception as e:
        log_content = f"Failed to extract invocation logs: {str(e)}"

    out_file = f"ctx://contexts/insetu_boot_log_{int(time.time())}.txt"
    ctx.vfs.save(out_file, log_content, data={"ignore_ledger": True})

    from akasa.utils import resolve_system_artifact_path
    abs_out_path = resolve_system_artifact_path(out_file, ctx.workspace_id)
    register_ephemeral_artifact(abs_out_path, "dev_logs", 3600, workspace_id=ctx.workspace_id)

    return {
        "message": "Invocation logs exported successfully.",
        "artifact": {
            "file": out_file,
            "url": f"/download/{out_file}"
        }
    }
class DownloadLogsPayload(TypedDict, total=False):
    pass

@dev_bp.route('logs/download', methods=['POST'], request_schema=DownloadLogsPayload, docstring="Exports the current backend daemon invocation logs to a downloadable text file.")
def api_download_logs(ctx):
    """Exports the current backend daemon invocation logs to a downloadable text file."""
    job_id = ctx.jobs.submit("download_boot_logs_task", job_category="ui_blocking")
    return jsonify({"status": "accepted", "job_id": job_id}), 202

# 4. Background Garbage Collection
@dev_bp.worker("sweep_telemetry")
def sweep_telemetry_worker(ctx, **kwargs):
    # Retain 2 hours of telemetry to support the 1-hour dashboard window
    cutoff = time.time() - 7200
    ctx.db.execute("DELETE FROM file_telemetry WHERE timestamp < ?", (cutoff,))
    # Retain bridge errors for up to 7 days for LLM analysis context
    week_cutoff = time.time() - (86400 * 7)
    ctx.db.execute("DELETE FROM bridge_errors WHERE timestamp < ?", (week_cutoff,))
    ctx.db.execute("DELETE FROM system_errors WHERE timestamp < ?", (week_cutoff,))

    ctx.db.commit()
    return "Telemetry swept."
@hooks.on('topology_boot_complete')
def init_dev_workers(workspace_id=None, **kwargs):
    try:
        from akasa.workers import submit_job
        submit_job("dev_telemetry_sweeper", "dev", "sweep_telemetry", interval_ms=60000, workspace_id=workspace_id)
    except Exception:
        pass