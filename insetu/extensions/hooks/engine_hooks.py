import os
import subprocess
import json
import uuid
import datetime
from pathlib import Path
from flask import jsonify
from insetu.core.sdk import InSetuExtension, ExtensionContext
from insetu.kernel.hooks import hooks
from insetu.core.topology.engine_topology import resolve_file_bucket

HOOKS_SCHEMA = {
    "hooks_rules": {
        "id": "TEXT PRIMARY KEY",
        "name": "TEXT NOT NULL",
        "trigger_type": "TEXT NOT NULL",  # 'repo_update' | 'repo_bucket_update'
        "trigger_target": "TEXT NOT NULL", # 'repo_name' or 'repo_name::bucket_id'
        "command": "TEXT NOT NULL",
        "enabled": "INTEGER DEFAULT 1",
        "created_at": "TEXT NOT NULL"
    }
}
hooks_bp = InSetuExtension(
    'hooks', 
    __name__, 
    title="Automation Hooks", 
    description="IFTTT-style event automation for local commands and workflows.", 
    schema=HOOKS_SCHEMA
)
__depends__ = ['gather']


@hooks_bp.worker("execute_rule_task")
def _background_execute_rule(ctx, rule_id, rule_name, command, workspace_id=None):
    """Executes a hook rule's command off-thread to protect Flask event loop responsiveness."""
    ctx.jobs.update_progress(f"Running hook [{rule_name}]: {command}")

    ws_root = ctx.paths['workspace_root']

    # Resolve execution context
    expanded_cmd = command.strip()
    exec_cwd = ws_root
    
    if expanded_cmd.startswith('~'):
        expanded_cmd = os.path.expanduser(expanded_cmd)
    
    # Enforce non-interactive environment
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    print(f"🚀 [HOOKS WORKER] Executing command: {expanded_cmd} (cwd: {exec_cwd})")
    try:
        res = subprocess.run(
            expanded_cmd, 
            shell=True, 
            cwd=exec_cwd, 
            capture_output=True, 
            text=True, 
            env=env,
            timeout=300
        )
        if res.returncode == 0:
            out_summary = res.stdout.strip() or "Execution finished successfully."
            print(f"✅ [HOOKS WORKER] Command Succeeded:\n{out_summary}")
            return {"message": f"Hook [{rule_name}] succeeded.", "artifact": {"output": out_summary}}
        else:
            err_summary = res.stderr.strip() or res.stdout.strip() or f"Exit code {res.returncode}"
            print(f"❌ [HOOKS WORKER] Command Failed:\n{err_summary}")
            raise RuntimeError(f"Command failed:\n{err_summary}")
    except subprocess.TimeoutExpired as e:
        print(f"❌ [HOOKS WORKER] Command Timed Out")
        raise RuntimeError(f"Command timed out after 300 seconds:\n{e.stdout or ''}\n{e.stderr or ''}".strip())
    except Exception as e:
        print(f"❌ [HOOKS WORKER] Execution Error: {str(e)}")
        raise RuntimeError(f"Execution Error: {str(e)}")
@hooks.on('topology_resolved', priority=100)
def process_vfs_triggers(dirty_repos=None, dirty_buckets=None, workspace_id=None, events=None, **kwargs):
    """Event Bus Hook: Evaluates active automation rules based on resolved topology boundaries."""
    print(f"🔎 [HOOKS TELEMETRY] process_vfs_triggers triggered. dirty_repos: {dirty_repos}, events count: {len(events) if events else 0}")
    if not events:
        return
    # Security/Noise Guardrail: Do not trigger automations for system-level ledger-ignored writes
    # (e.g. CODE_INDEX.md cartography, or contexts/ payload generation)
    has_valid_event = any(not e.get("ignore_ledger") for e in events)
    print(f"🔎 [HOOKS TELEMETRY] has_valid_event: {has_valid_event}")
    if not has_valid_event:
        return

    ctx = hooks_bp.get_context(workspace_id)

    # Fetch enabled rules for this workspace
    try:
        active_rules = ctx.db.execute(
            "SELECT * FROM hooks_rules WHERE enabled = 1"
        ).fetchall()
        print(f"🔎 [HOOKS TELEMETRY] Found {len(active_rules)} active rules.")
    except Exception as e:
        print(f"🔎 [HOOKS TELEMETRY] Failed to fetch active rules: {e}")
        return

    if not active_rules:
        return

    touched_repos = set(dirty_repos or [])
    touched_buckets = set(dirty_buckets or [])

    # Evaluate rules against touched targets
    for rule in active_rules:
        r_type = rule['trigger_type']
        r_target = rule['trigger_target']
        should_trigger = False

        if r_type == 'repo_update':
            if r_target == 'ALL' or r_target in touched_repos:
                should_trigger = True
        elif r_type == 'repo_bucket_update':
            if r_target in touched_buckets or (r_target.startswith('ALL::') and any(b.endswith('::' + r_target.split('::')[1]) for b in touched_buckets)):
                should_trigger = True

        print(f"🔎 [HOOKS TELEMETRY] Evaluating Rule: '{rule['name']}'. Type: {r_type}, Target: {r_target}. should_trigger: {should_trigger}")

        if should_trigger:
            import time
            import insetu.kernel.db as kernel_db
            try:
                w_conn = kernel_db.get_connection('workers', workspace_id=workspace_id)
                # Deduplication / Debounce: Prevent the same rule from firing multiple times within 3 seconds      
                # due to overlapping individual and transaction-level VFS hooks.
                # Added a 300-second expiration to 'processing' locks to prevent eternal deadlocks if a process hangs.
                recent = w_conn.execute("""
                    SELECT id, status, created_at FROM immediate_jobs 
                    WHERE ext_name = 'hooks' 
                    AND callback_name = 'execute_rule_task' 
                    AND (
                        (status IN ('pending', 'processing') AND created_at > ?) 
                        OR created_at > ?
                    )
                    AND args_json LIKE ?
                """, (time.time() - 300.0, time.time() - 3.0, f'%"rule_id": "{rule["id"]}"%')).fetchone()

                if recent:
                    print(f"🔎 [HOOKS TELEMETRY] Skipping Rule '{rule['name']}' due to active/recent lock: Job ID {recent['id']}, Status: {recent['status']}, Created: {recent['created_at']}")
                    continue
            except Exception as db_err:
                print(f"⚠️ [Hooks] Warning: Deduplication query failed: {db_err}")
                pass

            print(f"🔎 [HOOKS TELEMETRY] Submitting Rule '{rule['name']}' to worker queue.")
            ctx.jobs.submit(
                "execute_rule_task", 
                rule_id=rule['id'], 
                rule_name=rule['name'], 
                command=rule['command']
            )


@hooks_bp.route('list', methods=['GET'])
def list_rules(ctx):
    rules = ctx.db.get_all("hooks_rules", order_by="created_at DESC")
    return jsonify({"rules": rules})


@hooks_bp.route('save', methods=['POST'])
def save_rule(ctx):
    data = ctx.req.json or {}
    rule_id = data.get('id') or f"rule_{uuid.uuid4().hex[:8]}"
    name = data.get('name', '').strip()
    trigger_type = data.get('trigger_type', 'repo_update')
    trigger_target = data.get('trigger_target', 'ALL').strip()
    command = data.get('command', '').strip()
    enabled = 1 if data.get('enabled', True) else 0
    now = datetime.datetime.now().isoformat()

    if not name or not command:
        return jsonify({"error": "Rule name and command are required."}), 400

    ctx.db.insert_or_replace("hooks_rules", {
        "id": rule_id,
        "name": name,
        "trigger_type": trigger_type,
        "trigger_target": trigger_target,
        "command": command,
        "enabled": enabled,
        "created_at": now
    })
    return jsonify({"status": "success", "id": rule_id})


@hooks_bp.route('toggle', methods=['POST'])
def toggle_rule(ctx):
    data = ctx.req.json or {}
    rule_id = data.get('id')
    enabled = 1 if data.get('enabled') else 0

    if not rule_id:
        return jsonify({"error": "Rule ID required."}), 400

    ctx.db.execute("UPDATE hooks_rules SET enabled = ? WHERE id = ?", (enabled, rule_id))
    ctx.db.commit()
    return jsonify({"status": "success"})
@hooks_bp.route('execute', methods=['POST'])
def execute_rule_manual(ctx):
    data = ctx.req.json or {}
    rule_id = data.get('id')
    if not rule_id:
        return jsonify({"error": "Rule ID required."}), 400

    rule = ctx.db.execute("SELECT name, command FROM hooks_rules WHERE id = ?", (rule_id,)).fetchone()
    if not rule:
        return jsonify({"error": "Rule not found."}), 404

    job_id = ctx.jobs.submit(
        "execute_rule_task", 
        rule_id=rule_id, 
        rule_name=rule['name'], 
        command=rule['command']
    )
    return jsonify({"status": "accepted", "job_id": job_id}), 202


@hooks_bp.route('delete', methods=['POST'])
def delete_rule(ctx):
    data = ctx.req.json or {}
    rule_id = data.get('id')

    if not rule_id:
        return jsonify({"error": "Rule ID required."}), 400

    ctx.db.delete("hooks_rules", "id", rule_id)
    return jsonify({"status": "success"})
@hooks_bp.route('logs', methods=['GET'])
def get_logs(ctx):
    import insetu.kernel.db as kernel_db
    import json
    # Use the central workers ledger, not the extension's local DB
    conn = kernel_db.get_connection('workers', workspace_id=ctx.workspace_id)

    try:
        cursor = conn.execute(
            "SELECT id, callback_name, status, status_message, artifact_json, updated_at "
            "FROM immediate_jobs WHERE ext_name = 'hooks' ORDER BY updated_at DESC LIMIT 20"
        )
        logs = []
        for row in cursor.fetchall():
            logs.append({
                "id": row['id'],
                "action": row['callback_name'],
                "status": row['status'],
                "message": row['status_message'],
                "artifact": json.loads(row['artifact_json']) if row['artifact_json'] else {},
                "updated_at": row['updated_at']
            })
        return jsonify({"logs": logs})
    except Exception as e:
        return jsonify({"error": str(e)}), 500