import os
import json
import shutil
import subprocess
from typing import TypedDict
from insetu.core.sdk import InSetuExtension, ExtensionContext, SettingsManager
from insetu.core.utils_core import execute_binary

__depends__ = []


def _get_tailscale_backend_state(env=None) -> str:
    """Checks 'tailscale status --json' to verify the local daemon is actively connected to a Tailnet."""
    if not shutil.which("tailscale"):
        return "MissingBinary"
    try:
        res = execute_binary(["tailscale", "status", "--json"], capture_output=True, text=True, timeout=5, env=env)
        if res.stdout:
            data = json.loads(res.stdout)
            return str(data.get("BackendState") or "Unknown")
    except Exception:
        pass
    return "Unknown"


def _execute_serve_bind(workspace_id="default", manual=False):
    """Internal helper to safely trigger Tailscale Serve with dynamic port resolution."""
    ctx = tailscale_bp.get_context(workspace_id)
    sys_port = SettingsManager('system', 'default').get("port", 5005)
    insetu_port = int(os.environ.get("INSETU_PORT", sys_port))

    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"

    backend_state = _get_tailscale_backend_state(env=env)
    if backend_state == "MissingBinary":
        if manual:
            raise RuntimeError("Tailscale binary not found in system PATH.")
        return "Tailscale Serve skipped: 'tailscale' binary not installed."

    if backend_state in ("NoState", "Stopped", "NeedsLogin", "NeedsMachineAuth", "Starting"):
        if manual:
            raise RuntimeError(f"Tailscale is not connected (state: {backend_state}). Run 'tailscale up' first.")
        return f"Tailscale Serve skipped on boot: daemon is not connected (state: {backend_state})."

    # Port Mode Resolution: 443 | sync | custom
    mode = str(ctx.settings.get("serve_port_mode", "443"))
    if mode == "sync":
        https_port = insetu_port
    elif mode == "custom":
        https_port = int(ctx.settings.get("custom_serve_port", 8443))
    else:
        try:
            https_port = int(mode)
        except ValueError:
            https_port = 443

    # 1. Try non-interactive sudo with an explicit 10-second timeout
    cmd_sudo = ["sudo", "-n", "tailscale", "serve", "--bg", f"--https={https_port}", f"http://127.0.0.1:{insetu_port}"]
    try:
        res = execute_binary(cmd_sudo, capture_output=True, text=True, timeout=10, env=env)
        if res.returncode == 0:
            return f"Successfully bound local port {insetu_port} to Tailscale Serve HTTPS port {https_port}."
    except (subprocess.TimeoutExpired, Exception):
        pass

    # 2. Fallback without sudo for non-root / user-space Tailnet environments
    cmd_nosudo = ["tailscale", "serve", "--bg", f"--https={https_port}", f"http://127.0.0.1:{insetu_port}"]
    try:
        res_nosudo = execute_binary(cmd_nosudo, capture_output=True, text=True, timeout=10, env=env)
        if res_nosudo.returncode == 0:
            return f"Successfully bound local port {insetu_port} to Tailscale Serve HTTPS port {https_port}."
        err_out = (res_nosudo.stderr or res_nosudo.stdout or "").strip()
        if not manual and any(s in err_out for s in ("NoState", "Stopped", "NeedsLogin", "not logged in")):
            return f"Tailscale Serve skipped on boot: {err_out}"
        raise RuntimeError(f"Tailscale Serve failed: {err_out}")
    except subprocess.TimeoutExpired:
        if not manual:
            return "Tailscale Serve skipped on boot: command timed out."
        raise RuntimeError("Tailscale Serve command timed out after 10 seconds.")


# Declarative Settings Schema with Port Mode Selection & Action Trigger
TAILSCALE_SETTINGS_SCHEMA = [
    {
        "id": "auto_bind",
        "label": "Auto-Bind Tailscale Serve on Boot",
        "type": "boolean",
        "scope": "daemon",
        "default": True,
        "description": "Automatically runs 'tailscale serve' to expose inSetu over HTTPS when the workspace boots."
    },
    {
        "id": "serve_port_mode",
        "label": "Tailscale Serve HTTPS Port Mode",
        "type": "select",
        "scope": "daemon",
        "default": "443",
        "options": [
            {"value": "443", "label": "443 (Standard HTTPS)"},
            {"value": "sync", "label": "Sync to Active App Port"},
            {"value": "custom", "label": "Custom Port"}
        ],
        "description": "Choose whether Tailscale exposes HTTPS on port 443, matches the active inSetu port, or uses a custom port."
    },
    {
        "id": "custom_serve_port",
        "label": "Custom HTTPS Port",
        "type": "number",
        "scope": "daemon",
        "default": 8443,
        "description": "Used only when Port Mode is set to 'Custom Port'."
    },
    {
        "id": "trigger_bind_now",
        "label": "Bind Tailscale Serve Now",
        "type": "action",
        "scope": "daemon",
        "button_label": "⚡ Execute Bind",
        "intent": "primary",
        "endpoint": "tailscale/bind",
        "description": "Manually trigger 'tailscale serve' for the active instance."
    }
]
tailscale_bp = InSetuExtension(
    'tailscale', 
    __name__, 
    title="Tailscale Network Manager", 
    description="Auto-bind inSetu over Tailscale Serve on boot.",
    settings_schema=TAILSCALE_SETTINGS_SCHEMA,
    external_binaries=["tailscale"],
)
@tailscale_bp.worker("bind_serve_task")
def _background_bind_serve(ctx, manual: bool = False):
    ctx.jobs.update_progress("Configuring Tailscale Serve binding...")
    return _execute_serve_bind(ctx.workspace_id, manual=bool(manual))
@tailscale_bp.on('topology_boot_complete')
def auto_bind_on_workspace_boot(ctx, workspace_id=None, **kwargs):
    """Tenant Boot Hook: Evaluates auto-bind preference off-thread when the workspace mounts."""
    # Tailscale serve is a host daemon setting for port 5005; bind once on default workspace
    if ctx.workspace_id != 'default':
        return

    try:
        if ctx.settings.get("auto_bind", True):
            # Dispatch to worker queue with job coalescing to prevent thundering herds
            ctx.jobs.submit("bind_serve_task", coalesce=True, job_category="system_background", manual=False)
    except Exception as e:
        print(f"⚠️ [Tailscale] Auto-bind trigger failed for [{ctx.workspace_id}]: {e}")
class TailscaleBindPayload(TypedDict, total=False):
    pass
@tailscale_bp.route('bind', methods=['POST'], request_schema=TailscaleBindPayload, docstring="Manually triggers 'tailscale serve' to expose the local inSetu port to the Tailnet.")
def api_bind_tailscale(ctx):
    """Manually triggers 'tailscale serve' to expose the local inSetu port to the Tailnet."""
    job_id = ctx.jobs.submit("bind_serve_task", job_category="ui_blocking", manual=True)
    return {"status": "accepted", "job_id": job_id}, 202