import os
import sys
import subprocess
import shutil
import uuid
import time
from flask import jsonify
from insetu.core.sdk import InSetuExtension
from insetu.kernel.hooks import hooks

CRONIC_SCHEMA = {
    "cronic_jobs": {
        "id": "TEXT PRIMARY KEY",
        "filepath": "TEXT NOT NULL",
        "schedule": "TEXT NOT NULL",
        "enabled": "INTEGER DEFAULT 1",
        "last_run": "REAL",
        "last_status": "TEXT"
    }
}

cronic_bp = InSetuExtension(
    'cronic',
    __name__,
    title="Cronic Job Manager",
    description="Schedule scripts and executable files as system cron tasks.",
    schema=CRONIC_SCHEMA
)
__depends__ = []

def has_crontab():
    return shutil.which("crontab") is not None

def _sync_system_crontab(ctx):
    if not has_crontab():
        return
    """Rebuilds system crontab entries specifically for the active workspace."""
    jobs = ctx.db.get_all("cronic_jobs")
    crontab_lines = []

    workspace_tag = f"# managed-by-insetu:cronic:{ctx.workspace_id}:"

    # Read existing non-inSetu entries or entries from other workspaces
    try:
        current_cron = subprocess.check_output(["crontab", "-l"], text=True)
        for line in current_cron.splitlines():
            if workspace_tag not in line:
                crontab_lines.append(line)
    except subprocess.CalledProcessError:
        pass  # Empty or uninitialized crontab

    # Re-inject active jobs for this workspace
    python_bin = sys.executable
    for job in jobs:
        if not job.get('enabled'):
            continue

        abs_path = ctx.resolve_path(job['filepath'])
        ext = os.path.splitext(abs_path)[1].lower()

        if ext == '.py':
            cmd = f"{python_bin} {abs_path}"
        elif ext == '.sh':
            cmd = f"bash {abs_path}"
        else:
            cmd = abs_path

        log_file = ctx.resolve_path(f".insetu/data/cronic_{job['id']}.log")
        os.makedirs(os.path.dirname(log_file), exist_ok=True)

        cron_entry = f"{job['schedule']} {cmd} >> {log_file} 2>&1 {workspace_tag}{job['id']}"
        crontab_lines.append(cron_entry)

    new_crontab = "\n".join(crontab_lines) + "\n"
    subprocess.run(["crontab", "-"], input=new_crontab, text=True, check=True)
@cronic_bp.route('status', methods=['GET'])
def get_status(ctx):
    return jsonify({"has_crontab": has_crontab()})

@cronic_bp.route('list', methods=['GET'])
def list_jobs(ctx):
    return jsonify({"jobs": ctx.db.get_all("cronic_jobs")})

@cronic_bp.route('schedule', methods=['POST'])
def schedule_job(ctx):
    data = ctx.req.json or {}
    filepath = data.get("filepath", "").strip()
    schedule = data.get("schedule", "0 * * * *").strip()

    if not filepath or not (filepath.endswith('.py') or filepath.endswith('.sh')):
        return jsonify({"error": "Only .py or .sh files can be scheduled."}), 400

    job_id = f"job_{uuid.uuid4().hex[:8]}"
    ctx.db.insert_or_replace("cronic_jobs", {
        "id": job_id,
        "filepath": filepath,
        "schedule": schedule,
        "enabled": 1,
        "last_status": "pending"
    })

    _sync_system_crontab(ctx)
    return jsonify({"status": "success", "job_id": job_id})

@cronic_bp.route('toggle', methods=['POST'])
def toggle_job(ctx):
    data = ctx.req.json or {}
    job_id = data.get("job_id")
    enabled = 1 if data.get("enabled") else 0

    ctx.db.update("cronic_jobs", {"enabled": enabled}, "id", job_id)
    _sync_system_crontab(ctx)
    return jsonify({"status": "success"})

@cronic_bp.route('delete', methods=['POST'])
def delete_job(ctx):
    data = ctx.req.json or {}
    job_id = data.get("job_id")

    ctx.db.delete("cronic_jobs", "id", job_id)
    _sync_system_crontab(ctx)
    return jsonify({"status": "success"})

@cronic_bp.route('logs', methods=['GET'])
def get_logs(ctx):
    job_id = ctx.req.args.get("job_id")
    if not job_id:
        return jsonify({"logs": "No job ID supplied."}), 400

    log_file = ctx.resolve_path(f".insetu/data/cronic_{job_id}.log")

    if os.path.exists(log_file):
        with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            return jsonify({"logs": "".join(lines[-100:])})
    return jsonify({"logs": "No execution logs recorded yet."})
@cronic_bp.worker("run_manual_task")
def _run_manual_worker(ctx, job_id=None, **kwargs):
    cronic_job_id = kwargs.get("cronic_job_id")
    job = ctx.db.get_by_id("cronic_jobs", cronic_job_id)
    if not job:
        raise ValueError("Cronic job record not found.")

    abs_path = ctx.resolve_path(job['filepath'])
    ext = os.path.splitext(abs_path)[1].lower()

    log_file = ctx.resolve_path(f".insetu/data/cronic_{job['id']}.log")
    os.makedirs(os.path.dirname(log_file), exist_ok=True)

    if ext == '.py':
        cmd = f'"{sys.executable}" "{abs_path}"'
    else:
        cmd = f'bash "{abs_path}"'

    # Route output streams directly to the log file at the OS level
    full_cmd = f"{cmd} >> \"{log_file}\" 2>&1"

    with open(log_file, "a", encoding="utf-8") as f:
        f.write(f"\n--- Manual Run Dispatched [{time.ctime()}] ---\n")

    ctx.db.update("cronic_jobs", {"last_run": time.time(), "last_status": "dispatched"}, "id", job['id'])

    # Fire and forget into the OS background, instantly releasing the inSetu worker thread
    subprocess.Popen(full_cmd, shell=True, start_new_session=(os.name == 'posix'))

    return {"message": "Job dispatched to OS background."}
@cronic_bp.route('run_now', methods=['POST'])
def run_now(ctx):
    data = ctx.req.json or {}
    job_id = ctx.jobs.submit("run_manual_task", cronic_job_id=data.get("job_id"))
    return jsonify({"status": "accepted", "job_id": job_id}), 202

@cronic_bp.worker("kill_task")
def _kill_task_worker(ctx, job_id=None, **kwargs):
    cronic_job_id = kwargs.get("cronic_job_id")
    job = ctx.db.get_by_id("cronic_jobs", cronic_job_id)
    if not job:
        raise ValueError("Cronic job record not found.")

    abs_path = ctx.resolve_path(job['filepath'])

    # Issue a SIGTERM to any process executing this exact script path
    cmd = f'pkill -f "{abs_path}"'
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)

    ctx.db.update("cronic_jobs", {"last_status": "terminated"}, "id", job['id'])

    log_file = ctx.resolve_path(f".insetu/data/cronic_{job['id']}.log")
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(f"\n--- Job Terminated Manually [{time.ctime()}] ---\n")

    # pkill returns 0 if it successfully killed something, 1 if nothing matched
    if res.returncode == 0:
        return {"message": "Termination signal sent to running processes."}
    else:
        return {"message": "No active processes found for this job."}

@cronic_bp.route('kill', methods=['POST'])
def kill_job(ctx):
    data = ctx.req.json or {}
    job_id = ctx.jobs.submit("kill_task", cronic_job_id=data.get("job_id"))
    return jsonify({"status": "accepted", "job_id": job_id}), 202

@cronic_bp.worker("sweep_logs_task")
def _sweep_logs_worker(ctx, **kwargs):
    """Garbage collect logs older than 30 days."""
    log_dir = ctx.resolve_path(".insetu/data/")
    if not os.path.exists(log_dir):
        return "No logs to sweep."

    cutoff = time.time() - (30 * 86400)
    count = 0
    for f in os.listdir(log_dir):
        if f.startswith("cronic_") and f.endswith(".log"):
            f_path = os.path.join(log_dir, f)
            if os.path.getmtime(f_path) < cutoff:
                try:
                    os.remove(f_path)
                    count += 1
                except Exception:
                    pass
    return f"Swept {count} old log files."
@hooks.on('workspace_boot')
def cronic_workspace_boot(workspace_id=None, **kwargs):
    if not workspace_id or not has_crontab():
        return

    try:
        from insetu.kernel.utils import is_extension_enabled
        if not is_extension_enabled("cronic", workspace_id):
            return

        ctx = cronic_bp.get_context(workspace_id)

        # 1. Schedule the background log sweeper (Runs once every 24 hours)
        from insetu.kernel.workers import submit_job
        job_id = f"cronic_sweep_{workspace_id}"
        submit_job(job_id, "cronic", "sweep_logs_task", interval_ms=86400000, jitter_ms=3600000, workspace_id=workspace_id)

        # 2. Heal state drift: read system crontab and sync DB
        try:
            current_cron = subprocess.check_output(["crontab", "-l"], text=True)
        except subprocess.CalledProcessError:
            current_cron = ""

        workspace_tag = f"# managed-by-insetu:cronic:{workspace_id}:"
        active_job_ids = set()

        for line in current_cron.splitlines():
            if workspace_tag in line:
                parts = line.split(workspace_tag)
                if len(parts) > 1:
                    active_job_ids.add(parts[1].strip())

        jobs = ctx.db.get_all("cronic_jobs")
        drift_healed = 0
        for job in jobs:
            if job['enabled'] == 1 and job['id'] not in active_job_ids:
                ctx.db.update("cronic_jobs", {"enabled": 0}, "id", job['id'])
                drift_healed += 1

        if drift_healed > 0:
            print(f"⏰ [Cronic] Healed {drift_healed} orphaned jobs detected from crontab drift.")
    except Exception as e:
        print(f"⚠️ [Cronic] Boot hook failed: {e}")