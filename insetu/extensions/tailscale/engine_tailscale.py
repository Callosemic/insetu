import os
import subprocess
from flask import jsonify
from insetu.core.sdk import InSetuExtension, ExtensionContext
from insetu.kernel.hooks import hooks

__depends__ = []


def _execute_serve_bind(workspace_id="default"):
    """Internal helper to safely trigger Tailscale Serve with dynamic port resolution."""
    ctx = ExtensionContext('tailscale', workspace_id)

    insetu_port = int(os.environ.get("INSETU_PORT", ctx.config.get("port", 5005)))
    
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

    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"

    # 1. Try non-interactive sudo with an explicit 10-second timeout
    cmd_sudo = ["sudo", "-n", "tailscale", "serve", "--bg", f"--https={https_port}", f"http://127.0.0.1:{insetu_port}"]
    try:
        res = subprocess.run(cmd_sudo, capture_output=True, text=True, timeout=10, env=env)
        if res.returncode == 0:
            return f"Successfully bound local port {insetu_port} to Tailscale Serve HTTPS port {https_port}."
    except (subprocess.TimeoutExpired, Exception):
        pass

    # 2. Fallback without sudo for non-root / user-space Tailnet environments
    cmd_nosudo = ["tailscale", "serve", "--bg", f"--https={https_port}", f"http://127.0.0.1:{insetu_port}"]
    try:
        res_nosudo = subprocess.run(cmd_nosudo, capture_output=True, text=True, timeout=10, env=env)
        if res_nosudo.returncode == 0:
            return f"Successfully bound local port {insetu_port} to Tailscale Serve HTTPS port {https_port}."
        raise RuntimeError(f"Tailscale Serve failed: {res_nosudo.stderr or res_nosudo.stdout}")
    except subprocess.TimeoutExpired:
        raise RuntimeError("Tailscale Serve command timed out after 10 seconds.")


# Declarative Settings Schema with Port Mode Selection & Action Trigger
TAILSCALE_SETTINGS_SCHEMA = [
    {
        "id": "auto_bind",
        "label": "Auto-Bind Tailscale Serve on Boot",
        "type": "boolean",
        "default": True,
        "description": "Automatically runs 'tailscale serve' to expose inSetu over HTTPS when the workspace boots."
    },
    {
        "id": "serve_port_mode",
        "label": "Tailscale Serve HTTPS Port Mode",
        "type": "select",
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
        "default": 8443,
        "description": "Used only when Port Mode is set to 'Custom Port'."
    },
    {
        "id": "trigger_bind_now",
        "label": "Bind Tailscale Serve Now",
        "type": "action",
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
    settings_schema=TAILSCALE_SETTINGS_SCHEMA
)


@tailscale_bp.worker("bind_serve_task")
def _background_bind_serve(ctx, **kwargs):
    ctx.jobs.update_progress("Configuring Tailscale Serve binding...")
    return _execute_serve_bind(ctx.workspace_id)


@hooks.on('workspace_boot')
def auto_bind_on_workspace_boot(workspace_id=None, **kwargs):
    """Tenant Boot Hook: Evaluates auto-bind preference off-thread when the workspace mounts."""
    if not workspace_id:
        return

    try:
        ctx = ExtensionContext('tailscale', workspace_id)
        if ctx.settings.get("auto_bind", True):
            # Dispatch to worker queue to keep workspace boot non-blocking
            ctx.jobs.submit("bind_serve_task")
    except Exception as e:
        print(f"⚠️ [Tailscale] Auto-bind trigger failed for [{workspace_id}]: {e}")


@tailscale_bp.route('bind', methods=['POST'])
def api_bind_tailscale(ctx):
    job_id = ctx.jobs.submit("bind_serve_task")
    return jsonify({"status": "accepted", "job_id": job_id}), 202