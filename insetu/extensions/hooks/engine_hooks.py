import os
import time
import hashlib
import subprocess
import json
import shlex
import uuid
import datetime
from pathlib import Path
from typing import TypedDict, Optional
from flask import jsonify
from insetu.core.sdk import InSetuExtension, ExtensionContext
from akasa.hooks import hooks
import akasa.utils as _akasa_utils
from akasa.utils import load_json_config, save_json_config
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
def _background_execute_rule(ctx, rule_id, rule_name, command, workspace_id=None, **kwargs):
    """Executes a hook rule's command off-thread to protect Flask event loop responsiveness."""
    ctx.jobs.update_progress(f"Running hook [{rule_name}]: {command}")

    ws_root = str(ctx.paths['workspace_root'])

    # Resolve execution context
    expanded_cmd = command.strip()
    exec_cwd = ws_root
    
    if expanded_cmd.startswith('~'):
        expanded_cmd = os.path.expanduser(expanded_cmd)
    # Enforce non-interactive environment
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"

    use_shell = any(char in expanded_cmd for char in (';', '&&', '||', '|', '>', '<', '&'))
    cmd = expanded_cmd if use_shell else shlex.split(expanded_cmd)

    print(f"🚀 [HOOKS WORKER] Executing command: {expanded_cmd} (cwd: {exec_cwd})")
    try:
        res = ctx.exec.run(
            cmd, 
            shell=use_shell, 
            cwd=exec_cwd, 
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
    if not events:
        return
    print(f"🔎 [HOOKS TELEMETRY] process_vfs_triggers triggered. dirty_repos: {dirty_repos}, events count: {len(events)}")
    # Security/Noise Guardrail: Do not trigger automations for system-level ledger-ignored writes
    # (e.g. CODE_INDEX.md cartography, or contexts/ payload generation)
    has_valid_event = any(not e.get("ignore_ledger") for e in events)
    print(f"🔎 [HOOKS TELEMETRY] has_valid_event: {has_valid_event}")
    if not has_valid_event:
        return
    ctx = hooks_bp.get_context(workspace_id)

    # Fetch enabled rules for this workspace
    try:
        _ensure_hooks_hydrated(ctx)
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
            try:
                if ctx.jobs.is_in_flight("execute_rule_task", args_like=f'%"rule_id": "{rule["id"]}"%', window_sec=3.0):
                    print(f"🔎 [HOOKS TELEMETRY] Skipping Rule '{rule['name']}' due to active/recent debounce lock.")
                    continue
            except Exception as db_err:
                print(f"⚠️ [Hooks] Warning: Deduplication query failed: {db_err}")
            print(f"🔎 [HOOKS TELEMETRY] Submitting Rule '{rule['name']}' to worker queue.")
            ctx.jobs.submit(
                "execute_rule_task", 
                rule_id=rule['id'], 
                rule_name=rule['name'], 
                command=rule['command'],
                job_category="system_background"
            )
def _get_approved_hook_ids(ctx) -> set:
    sys_path = Path(_akasa_utils._cwd).joinpath(".insetu", "system.json").as_posix()
    sys_data = load_json_config(sys_path, {})
    return set(sys_data.get("approved_hooks", {}).get(ctx.workspace_id, []))

def _mark_hook_approved(ctx, rule_id: str, command: str):
    sig = f"{rule_id}:{hashlib.sha256(command.encode('utf-8')).hexdigest()[:16]}"
    sys_path = Path(_akasa_utils._cwd).joinpath(".insetu", "system.json").as_posix()
    sys_data = load_json_config(sys_path, {})
    approved = set(sys_data.setdefault("approved_hooks", {}).get(ctx.workspace_id, []))
    approved.add(sig)
    sys_data["approved_hooks"][ctx.workspace_id] = sorted(list(approved))
    save_json_config(sys_path, sys_data, workspace_id="default")

def _ensure_hooks_hydrated(ctx):
    count = ctx.db.execute("SELECT count(*) FROM hooks_rules").fetchone()[0]
    saved = ctx.store.get("rules.json", "rules", None)
    if count == 0 and saved:
        approved = _get_approved_hook_ids(ctx)
        for r in saved:
            if r.get("id") and r.get("command"):
                sig = f"{r['id']}:{hashlib.sha256(r['command'].encode('utf-8')).hexdigest()[:16]}"
                is_safe = 1 if (r.get("enabled") and sig in approved) else 0
                ctx.db.insert_or_replace("hooks_rules", {
                    "id": r["id"],
                    "name": r.get("name", "Unnamed Rule"),
                    "trigger_type": r.get("trigger_type", "repo_update"),
                    "trigger_target": r.get("trigger_target", "ALL"),
                    "command": r["command"],
                    "enabled": is_safe,
                    "created_at": r.get("created_at", datetime.datetime.now().isoformat())
                })
    elif count > 0 and saved is None:
        for r in ctx.db.get_all("hooks_rules"):
            if r.get("enabled"):
                _mark_hook_approved(ctx, r["id"], r["command"])
        _flush_hooks_to_json(ctx)

def _flush_hooks_to_json(ctx):
    rules = ctx.db.get_all("hooks_rules", order_by="created_at DESC")
    ctx.store.set("rules.json", "rules", rules)

@hooks_bp.route('list', methods=['GET'], docstring="Lists all configured automation rules.")
def list_rules(ctx):
    """Lists all configured automation rules."""
    _ensure_hooks_hydrated(ctx)
    rules = ctx.db.get_all("hooks_rules", order_by="created_at DESC")
    return jsonify({"rules": rules})
class HookSavePayload(TypedDict, total=False):
    name: str
    trigger_type: str
    trigger_target: str
    command: str
    id: Optional[str]
    enabled: Optional[bool]
@hooks_bp.route('save', methods=['POST'], request_schema=HookSavePayload, docstring="Creates or updates a local automation rule.")
def save_rule(ctx):
    """Creates or updates a local automation rule."""
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

    _ensure_hooks_hydrated(ctx)
    ctx.db.insert_or_replace("hooks_rules", {
        "id": rule_id,
        "name": name,
        "trigger_type": trigger_type,
        "trigger_target": trigger_target,
        "command": command,
        "enabled": enabled,
        "created_at": now
    })
    _mark_hook_approved(ctx, rule_id, command)
    _flush_hooks_to_json(ctx)
    return jsonify({"status": "success", "id": rule_id})
class HookTogglePayload(TypedDict):
    id: str
    enabled: bool
@hooks_bp.route('toggle', methods=['POST'], request_schema=HookTogglePayload, docstring="Enables or disables an automation rule.")
def toggle_rule(ctx):
    """Enables or disables an automation rule."""
    data = ctx.req.json or {}
    rule_id = data.get('id')
    enabled = 1 if data.get('enabled') else 0
    if not rule_id:
        return jsonify({"error": "Rule ID required."}), 400

    _ensure_hooks_hydrated(ctx)
    ctx.db.execute("UPDATE hooks_rules SET enabled = ? WHERE id = ?", (enabled, rule_id))
    ctx.db.commit()
    if enabled:
        row = ctx.db.get_by_id("hooks_rules", rule_id)
        if row:
            _mark_hook_approved(ctx, rule_id, row["command"])
    _flush_hooks_to_json(ctx)
    return jsonify({"status": "success"})
class HookIdPayload(TypedDict):
    id: str
@hooks_bp.route('execute', methods=['POST'], request_schema=HookIdPayload, docstring="Manually executes an automation rule.")
def execute_rule_manual(ctx):
    """Manually executes an automation rule."""
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
        command=rule['command'],
        job_category="ui_blocking"
    )
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@hooks_bp.route('delete', methods=['POST'], request_schema=HookIdPayload, docstring="Permanently deletes an automation rule.")
def delete_rule(ctx):
    """Permanently deletes an automation rule."""
    data = ctx.req.json or {}
    rule_id = data.get('id')
    if not rule_id:
        return jsonify({"error": "Rule ID required."}), 400

    _ensure_hooks_hydrated(ctx)
    ctx.db.delete("hooks_rules", "id", rule_id)
    _flush_hooks_to_json(ctx)
    return jsonify({"status": "success"})
@hooks_bp.route('logs', methods=['GET'], docstring="Retrieves logs for executed automation rules.")
def get_logs(ctx):
    """Retrieves logs for executed automation rules."""
    try:
        return jsonify({"logs": ctx.jobs.get_recent_logs(limit=20)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500