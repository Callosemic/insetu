"""
Tier 2 Core: Remote Access & Identity Providers.

One home for everything that lets a device off this machine reach the workbench:
- Tailscale identity: verifies the caller with `tailscale whois` against the trusted client IP
  that akasa's peer classifier extracted, instead of trusting identity headers at face value.
- Owner trust: the login that owns this machine's tailscaled is always allowed; anyone else
  must be listed in `allowed_dev_emails`. Tagged (non-human) nodes are always rejected.
- Tailscale Serve binding (formerly the Tier 3 'tailscale' extension) and the HTTPS helper
  used by the preview extension.
- Host-trust registration: the '.ts.net' suffix, Tailscale's identity headers, and any
  operator-configured hostnames (for ngrok or a reverse-proxy domain).
"""
import json
import os
import shutil
import subprocess
import threading
import time
from typing import Any, Dict, Optional, Tuple, TypedDict
from insetu.core.sdk import (
    InSetuExtension,
    SettingsManager,
    execute_binary,
    get_daemon_host_config_path,
    load_json_config,
    save_json_config,
    register_trusted_host_suffix,
    register_proxy_header,
    register_allowed_host,
)
from insetu.core.utils_core import child_env

__depends__ = []

TAILSCALE_HOST_SUFFIX = ".ts.net"
TAILSCALE_IDENTITY_HEADERS = ("Tailscale-User-Login", "Tailscale-User-Name", "Tailscale-User-Profile-Pic")
WHOIS_TTL_SECONDS = 60.0
WHOIS_FAILURE_TTL_SECONDS = 5.0
OWNER_TTL_SECONDS = 300.0
LEGACY_SETTINGS_BLOCK = "tailscale"

_CACHE_LOCK = threading.Lock()
_WHOIS_CACHE: Dict[str, Tuple[float, Optional[Dict[str, Any]]]] = {}
_OWNER_CACHE: Dict[str, Tuple[float, Optional[str]]] = {}
_HEADER_MODE_WARNED = {"done": False}


REMOTE_SETTINGS_SCHEMA = [
    {
        "id": "identity_mode",
        "label": "Tailscale Identity Verification",
        "type": "select",
        "scope": "daemon",
        "default": "whois",
        "options": [
            {"value": "whois", "label": "Verify with tailscale whois (recommended)"},
            {"value": "header", "label": "Trust Tailscale Serve identity headers (legacy)"},
            {"value": "off", "label": "Disabled (use the static auth token)"}
        ],
        "description": "How a remote device's Tailscale login is established. 'whois' asks the local tailscaled who owns the connecting address. 'header' trusts the headers Tailscale Serve adds and is only accepted for requests proxied from this machine."
    },
    {
        "id": "allowed_hosts",
        "label": "Additional Allowed Hostnames",
        "type": "text",
        "scope": "daemon",
        "default": "",
        "description": "Comma-separated hostnames (no ports) accepted by Host validation, such as an ngrok or reverse-proxy domain. Loopback and *.ts.net are always allowed. Restart the daemon after changing."
    },
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
        "endpoint": "remote/tailscale/bind",
        "description": "Manually trigger 'tailscale serve' for the active instance."
    }
]

remote_bp = InSetuExtension(
    'remote',
    __name__,
    title="Remote Access",
    description="Remote device access: Tailscale identity verification, Tailscale Serve binding, and trusted hostnames.",
    settings_schema=REMOTE_SETTINGS_SCHEMA,
    core=True,
)

# Host-trust registration happens at import so the Host gate and proxy detection
# know about Tailscale before the first request is served.
register_trusted_host_suffix(TAILSCALE_HOST_SUFFIX)
register_proxy_header(*TAILSCALE_IDENTITY_HEADERS)


# ==============================================================================
# TAILSCALE CLI PRIMITIVES
# ==============================================================================

def _tailscale_available() -> bool:
    return bool(shutil.which("tailscale"))


def _run_tailscale_json(args, timeout: float = 3.0) -> Optional[Any]:
    """Runs a read-only tailscale subcommand and parses its JSON output. Returns None on any failure."""
    if not _tailscale_available():
        return None
    try:
        res = execute_binary(["tailscale"] + list(args), capture_output=True, text=True, timeout=timeout)
    except (subprocess.TimeoutExpired, OSError) as e:
        print(f"⚠️ [Remote] tailscale {' '.join(args[:1])} failed: {e}")
        return None
    if res.returncode != 0 or not (res.stdout or "").strip():
        return None
    try:
        return json.loads(res.stdout)
    except ValueError:
        print(f"⚠️ [Remote] tailscale {' '.join(args[:1])} returned malformed JSON.")
        return None


def tailscale_whois(ip: str) -> Optional[Dict[str, Any]]:
    """
    Resolves a tailnet address to {'login', 'tags', 'node'} via `tailscale whois --json`.
    Successful lookups are cached for 60s and failures for 5s, so a flaky daemon cannot lock users out for long.
    """
    clean_ip = str(ip or "").strip()
    if not clean_ip:
        return None
    now = time.monotonic()
    with _CACHE_LOCK:
        cached = _WHOIS_CACHE.get(clean_ip)
        if cached and cached[0] > now:
            return dict(cached[1]) if cached[1] else None

    payload = _run_tailscale_json(["whois", "--json", clean_ip])
    result: Optional[Dict[str, Any]] = None
    if isinstance(payload, dict):
        profile = payload.get("UserProfile") or {}
        node = payload.get("Node") or {}
        login = str(profile.get("LoginName") or "").strip()
        if login:
            result = {
                "login": login,
                "tags": list(node.get("Tags") or []),
                "node": str(node.get("ComputedName") or node.get("Name") or ""),
            }

    ttl = WHOIS_TTL_SECONDS if result else WHOIS_FAILURE_TTL_SECONDS
    with _CACHE_LOCK:
        _WHOIS_CACHE[clean_ip] = (now + ttl, dict(result) if result else None)
    return result


def tailscale_owner_login() -> Optional[str]:
    """Returns the login that owns this machine's tailscaled (None for tagged machines or when unavailable). Cached 5 min."""
    now = time.monotonic()
    with _CACHE_LOCK:
        cached = _OWNER_CACHE.get("self")
        if cached and cached[0] > now:
            return cached[1]

    owner: Optional[str] = None
    status = _run_tailscale_json(["status", "--json"], timeout=5.0)
    if isinstance(status, dict):
        self_node = status.get("Self") or {}
        if not (self_node.get("Tags") or []):
            user_id = self_node.get("UserID")
            users = status.get("User") or {}
            profile = users.get(str(user_id)) or users.get(user_id) or {}
            owner = str(profile.get("LoginName") or "").strip() or None

    ttl = OWNER_TTL_SECONDS if owner else WHOIS_FAILURE_TTL_SECONDS
    with _CACHE_LOCK:
        _OWNER_CACHE["self"] = (now + ttl, owner)
    return owner


def reset_identity_caches() -> None:
    """Test harness contract: clears WHOIS and owner caches."""
    with _CACHE_LOCK:
        _WHOIS_CACHE.clear()
        _OWNER_CACHE.clear()
    _HEADER_MODE_WARNED["done"] = False


# ==============================================================================
# IDENTITY PROVIDER (akasa Route B)
# ==============================================================================

def _identity_mode() -> str:
    try:
        mode = str(SettingsManager('remote', 'default').get("identity_mode", "whois") or "whois").strip().lower()
    except Exception as e:
        print(f"⚠️ [Remote] Could not read identity_mode, defaulting to whois: {e}")
        mode = "whois"
    return mode if mode in ("whois", "header", "off") else "whois"


def _is_login_authorized(login: str, config: Optional[Dict[str, Any]]) -> bool:
    """The machine owner is always authorized; anyone else must be listed in allowed_dev_emails."""
    clean = str(login or "").strip().lower()
    if not clean:
        return False
    allowed = [str(e).strip().lower() for e in ((config or {}).get("allowed_dev_emails") or []) if str(e).strip()]
    if clean in allowed:
        return True
    owner = tailscale_owner_login()
    return bool(owner and owner.strip().lower() == clean)


@remote_bp.on('execute_identity_handshake')
def tailscale_identity_handshake(request=None, peer=None, client_ip=None, config=None, **kwargs):
    """Route B provider: authenticates a remote device by its verified Tailscale login. Fails closed."""
    mode = _identity_mode()
    if mode == "off" or peer is None:
        return None

    header_login = ""
    if request is not None:
        try:
            header_login = str(request.headers.get("Tailscale-User-Login") or "").strip()
        except Exception:
            header_login = ""

    if mode == "header":
        # Legacy mode: only headers added by a proxy on this machine are considered.
        if not (peer.via_proxy and peer.peer_is_loopback and header_login):
            return None
        if not _HEADER_MODE_WARNED["done"]:
            _HEADER_MODE_WARNED["done"] = True
            print("⚠️ [Remote] identity_mode='header' trusts Tailscale Serve headers without verification. Prefer 'whois'.")
        if _is_login_authorized(header_login, config):
            return {"status": "authenticated", "method": "tailscale_header", "user": header_login}
        print(f"🔐 [Remote] Rejected Tailscale login '{header_login}': not the machine owner or in allowed_dev_emails.")
        return None

    # Default: verify the trusted client address with tailscaled.
    trusted_ip = str(client_ip or "").strip()
    if not trusted_ip or peer.is_direct_loopback:
        return None
    identity = tailscale_whois(trusted_ip)
    if not identity:
        return None
    if identity["tags"]:
        print(f"🔐 [Remote] Rejected tagged Tailscale node '{identity['node']}' ({', '.join(identity['tags'])}).")
        return None
    if header_login and header_login.lower() != identity["login"].lower():
        print(f"🔐 [Remote] Rejected request: identity header '{header_login}' does not match whois login '{identity['login']}'.")
        return None
    if not _is_login_authorized(identity["login"], config):
        print(f"🔐 [Remote] Rejected Tailscale login '{identity['login']}': not the machine owner or in allowed_dev_emails.")
        return None
    return {"status": "authenticated", "method": "tailscale", "user": identity["login"]}


# ==============================================================================
# SETTINGS MIGRATION & HOST REGISTRATION
# ==============================================================================

def migrate_legacy_tailscale_settings() -> bool:
    """Copies daemon settings saved by the retired 'tailscale' extension into the 'remote' block once."""
    host_path = get_daemon_host_config_path()
    data = load_json_config(host_path, {})
    legacy = data.get(LEGACY_SETTINGS_BLOCK)
    if not isinstance(legacy, dict) or not legacy:
        return False
    current = data.get("remote") if isinstance(data.get("remote"), dict) else {}
    merged = dict(current)
    changed = False
    for key in ("auto_bind", "serve_port_mode", "custom_serve_port"):
        if key in legacy and key not in merged:
            merged[key] = legacy[key]
            changed = True
    if changed:
        data["remote"] = merged
        save_json_config(host_path, data, workspace_id="default")
        print("🔁 [Remote] Migrated legacy Tailscale extension settings into Remote Access.")
    return changed


def register_configured_hosts() -> Tuple[str, ...]:
    """Registers operator-configured hostnames (comma-separated 'allowed_hosts' setting) with the Host gate."""
    raw = SettingsManager('remote', 'default').get("allowed_hosts", "") or ""
    hosts = tuple(h.strip() for h in str(raw).split(",") if h.strip())
    if hosts:
        register_allowed_host(*hosts)
    return hosts


@remote_bp.on('system_boot')
def init_remote_access(**kwargs):
    """Boot hook: migrates legacy Tailscale settings and registers configured hostnames."""
    try:
        migrate_legacy_tailscale_settings()
    except Exception as e:
        print(f"⚠️ [Remote] Legacy settings migration failed: {e}")
    try:
        register_configured_hosts()
    except Exception as e:
        print(f"⚠️ [Remote] Failed to register allowed hosts: {e}")


# ==============================================================================
# TAILSCALE SERVE BINDING (formerly the Tier 3 'tailscale' extension)
# ==============================================================================

def _get_tailscale_backend_state(env=None) -> str:
    """Checks 'tailscale status --json' to verify the local daemon is actively connected to a Tailnet."""
    if not _tailscale_available():
        return "MissingBinary"
    try:
        res = execute_binary(["tailscale", "status", "--json"], capture_output=True, text=True, timeout=5, env=env)
        if res.stdout:
            data = json.loads(res.stdout)
            return str(data.get("BackendState") or "Unknown")
    except (subprocess.TimeoutExpired, OSError, ValueError) as e:
        print(f"⚠️ [Remote] Could not read Tailscale backend state: {e}")
    return "Unknown"


def _execute_serve_bind(workspace_id="default", manual=False, https_port_override: Optional[int] = None):
    """Internal helper to safely trigger Tailscale Serve with dynamic port resolution."""
    ctx = remote_bp.get_context(workspace_id)
    sys_port = SettingsManager('system', 'default').get("port", 5005)
    insetu_port = int(os.environ.get("INSETU_PORT", sys_port))

    env = child_env("tool")
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

    # Port Mode Resolution: explicit override | 443 | sync | custom
    mode = str(ctx.settings.get("serve_port_mode", "443"))
    if https_port_override:
        https_port = int(https_port_override)
    elif mode == "sync":
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
    except (subprocess.TimeoutExpired, OSError):
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


def set_tailscale_https_serve(port: int, enable: bool) -> Tuple[bool, str]:
    """Binds or releases 'tailscale serve --https=<port>' for a loopback dev server. Used by the preview extension."""
    if not port or int(port) <= 0:
        return False, "No port to bind."
    if not _tailscale_available():
        return False, "Tailscale binary not found in system PATH."
    try:
        if enable:
            res = execute_binary(
                ["tailscale", "serve", "--bg", f"--https={int(port)}", f"http://127.0.0.1:{int(port)}"],
                timeout=8
            )
            if res.returncode == 0:
                return True, f"Bound HTTPS serve on port {port}"
            return False, (res.stderr or res.stdout or "").strip() or f"tailscale serve exited with {res.returncode}"
        res_off = execute_binary(["tailscale", "serve", f"--https={int(port)}", "off"], timeout=5)
        return res_off.returncode == 0, f"Released HTTPS serve on port {port}"
    except (subprocess.TimeoutExpired, OSError) as e:
        return False, str(e)


@remote_bp.worker("bind_serve_task")
def _background_bind_serve(ctx, manual: bool = False, https_port: int = 0):
    ctx.jobs.update_progress("Configuring Tailscale Serve binding...")
    return _execute_serve_bind(ctx.workspace_id, manual=bool(manual), https_port_override=int(https_port or 0) or None)


@remote_bp.on('topology_boot_complete')
def auto_bind_on_workspace_boot(ctx, workspace_id=None, **kwargs):
    """Tenant Boot Hook: Evaluates auto-bind preference off-thread when the workspace mounts."""
    # Tailscale serve is a host daemon setting; bind once on the default workspace
    if ctx.workspace_id != 'default':
        return

    try:
        if ctx.settings.get("auto_bind", True):
            # Dispatch to worker queue with job coalescing to prevent thundering herds
            ctx.jobs.submit("bind_serve_task", coalesce=True, job_category="system_background", manual=False)
    except Exception as e:
        print(f"⚠️ [Remote] Tailscale auto-bind trigger failed for [{ctx.workspace_id}]: {e}")


class TailscaleBindPayload(TypedDict, total=False):
    https_port: int


@remote_bp.route('tailscale/bind', methods=['POST'], request_schema=TailscaleBindPayload, docstring="Manually triggers 'tailscale serve' to expose the local inSetu port to the Tailnet. Optional https_port overrides the configured port mode.")
def api_bind_tailscale(ctx):
    """Manually triggers 'tailscale serve' to expose the local inSetu port to the Tailnet. Optional https_port overrides the configured port mode."""
    data = ctx.payload or {}
    try:
        https_port = int(data.get("https_port") or 0)
    except (TypeError, ValueError):
        return {"error": "https_port must be an integer."}, 400
    if https_port and not (1 <= https_port <= 65535):
        return {"error": "https_port must be between 1 and 65535."}, 400
    job_id = ctx.jobs.submit("bind_serve_task", job_category="ui_blocking", manual=True, https_port=https_port)
    return {"status": "accepted", "job_id": job_id}, 202
