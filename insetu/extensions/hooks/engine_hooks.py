import os
import subprocess
import json
import uuid
import datetime
from pathlib import Path
from flask import jsonify
from insetu.sdk import InSetuExtension, ExtensionContext
from insetu.hooks import hooks
from insetu.engine_gather import resolve_file_bucket

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
__depends__ = []


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
    
    try:
        res = subprocess.run(
            expanded_cmd, 
            shell=True, 
            cwd=exec_cwd, 
            capture_output=True, 
            text=True, 
            env=env
        )
        if res.returncode == 0:
            out_summary = res.stdout.strip() or "Execution finished successfully."
            return {"message": f"Hook [{rule_name}] succeeded.", "artifact": {"output": out_summary}}
        else:
            err_summary = res.stderr.strip() or res.stdout.strip() or f"Exit code {res.returncode}"
            raise RuntimeError(f"Command failed:\n{err_summary}")
    except Exception as e:
        raise RuntimeError(f"Execution Error: {str(e)}")
@hooks.on('post_file_save', priority=100)
@hooks.on('post_file_delete', priority=100)
@hooks.on('vfs_transaction_committed', priority=100)
def process_vfs_triggers(files=None, filepath=None, workspace_id=None, **kwargs):
    """Event Bus Hook: Evaluates active automation rules whenever VFS commits settle."""
    if not files and filepath:
        files = [filepath]
    if not files:
        return
        
    from insetu.sdk import ExtensionContext
    ctx = ExtensionContext('hooks', workspace_id)
    
    if not ctx.config:
        return
        
    # Fetch enabled rules for this workspace
    try:
        active_rules = ctx.db.execute(
            "SELECT * FROM hooks_rules WHERE enabled = 1"
        ).fetchall()
    except Exception:
        return

    if not active_rules:
        return

    cfg = ctx.config
    target_repos = cfg.get("target_repos", [])
    
    # Analyze mutated files
    touched_repos = set()
    touched_buckets = set() # Format: 'repo::bucket_id'
    for filepath in files:
        clean_path = str(filepath).lstrip('/')
        if '/' not in clean_path:
            continue

        repo_dir = clean_path.split('/')[0]
        touched_repos.add(repo_dir)

        repo_cfg = next((r for r in target_repos if r.get("repo_dir") == repo_dir), None)
        if repo_cfg:
            sub_buckets = repo_cfg.get("sub_buckets", [])
            if sub_buckets:
                rel_path = clean_path[len(repo_dir) + 1:]
                bucket, module = resolve_file_bucket(rel_path, sub_buckets)
                if bucket:
                    b_id = module if (bucket.get("dynamic_split_prefix") and module) else bucket.get("id")
                    if b_id:
                        touched_buckets.add(f"{repo_dir}::{b_id}")

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

        if should_trigger:
            from insetu.db import get_connection
            try:
                w_conn = get_connection("workers", workspace_id=workspace_id)
                recent = w_conn.execute("""
                    SELECT id FROM immediate_jobs 
                    WHERE ext_name = 'hooks' 
                    AND callback_name = 'execute_rule_task' 
                    AND status = 'processing'
                    AND args_json LIKE ?
                """, (f'%"rule_id": "{rule["id"]}"%',)).fetchone()
                if recent:
                    continue
            except Exception:
                pass

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
    from insetu.db import get_connection
    import json
    # Use the central workers ledger, not the extension's local DB
    conn = get_connection("workers", workspace_id=ctx.workspace_id)

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