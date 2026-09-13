import os
import json
import socket
import secrets
from flask import Blueprint, request, jsonify
from insetu.kernel.utils import load_config, save_json_file, get_workspace_physics
from insetu.kernel.extension import InSetuExtension
auth_bp = Blueprint('auth', __name__)
def get_master_key():
    import os
    import shutil
    from insetu.kernel.utils import _cwd
    from pathlib import Path

    global_key_path = Path.home().joinpath(".insetu", "master_key.txt")
    local_key_path = Path(_cwd).joinpath(".insetu", "master_key.txt")

    # Safe Migration: If a legacy local key exists...
    if local_key_path.exists() and os.path.getsize(local_key_path) > 0:
        # If no global key exists yet, elevate this local key to be the global key
        if not global_key_path.exists():
            global_key_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(local_key_path.as_posix(), global_key_path.as_posix())
            return global_key_path.read_bytes()
        else:
            # A global key already exists. This local key is different.
            # We MUST keep using the local one here so we don't brick this specific workspace's secrets.
            return local_key_path.read_bytes()

    # Standard Global Key Generation/Loading
    if not global_key_path.exists() or os.path.getsize(global_key_path) == 0:
        from cryptography.fernet import Fernet
        global_key_path.parent.mkdir(parents=True, exist_ok=True)
        key = Fernet.generate_key()
        global_key_path.write_bytes(key)

    return global_key_path.read_bytes()

def encrypt_secret(val: str) -> str:
    if not val: return val
    from cryptography.fernet import Fernet
    f = Fernet(get_master_key())
    return "v1:" + f.encrypt(val.encode('utf-8')).decode('utf-8')

def decrypt_secret(val: str) -> str:
    if not val or not val.startswith("v1:"):
        return val
    from cryptography.fernet import Fernet
    f = Fernet(get_master_key())
    try:
        return f.decrypt(val[3:].encode('utf-8')).decode('utf-8')
    except Exception:
        return ""
security_bp = InSetuExtension(
    'security', __name__, title="Security & Encryption", 
    description="Local encryption key management.",
    core=True,
    settings_schema=lambda ws: [{
        "id": "master_fernet_key",
        "label": "inSetu Master Encryption Key (Fernet)",
        "type": "text",
        "scope": "daemon",
        "secure": False,
        "default": get_master_key().decode('utf-8'),
        "description": "This global key encrypts your secrets.json. It is stored securely in your user home directory (~/.insetu/master_key.txt). If you move this workspace to another machine, you must copy this key to the new machine. DO NOT LOSE THIS."
    }]
)
@security_bp.route('settings', methods=['POST'])
def update_security_settings(ctx):
    data = ctx.req.json or {}
    new_key = data.get("master_fernet_key")
    if new_key:
        import os
        from pathlib import Path
        from insetu.kernel.utils import _cwd

        global_key_path = Path.home().joinpath(".insetu", "master_key.txt")
        local_key_path = Path(_cwd).joinpath(".insetu", "master_key.txt")

        # If a local legacy key exists, update that one to avoid breaking state, otherwise update global
        target_path = local_key_path if local_key_path.exists() else global_key_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(new_key.encode('utf-8'))

    return {"status": "success", "requires_refresh": False}

# Generate a cryptographically sound scrolling runtime session token
# Anchor to the environment so it survives os.execv() and Werkzeug hot-reloads
BOOT_TOKEN = os.environ.get("INSETU_BOOT_TOKEN")
if not BOOT_TOKEN:
    BOOT_TOKEN = secrets.token_hex(16)
    os.environ["INSETU_BOOT_TOKEN"] = BOOT_TOKEN

def query_tailscale_whois(remote_ip):
    """Queries tailscaled via its native Unix socket to translate the IP into a Tailnet profile."""
    sock_path = "/var/run/tailscale/tailscaled.sock"
    if not os.path.exists(sock_path):
        return None

    try:
        # Construct a raw HTTP request tailored for Tailscale's LocalAPI socket
        payload = f"GET /localapi/v0/whois?ip={remote_ip} HTTP/1.1\r\nHost: local-tailscaled.sock\r\n\r\n"
        
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.settimeout(0.5)
        s.connect(sock_path)
        s.sendall(payload.encode('utf-8'))
        
        response = b""
        while True:
            chunk = s.recv(4096)
            if not chunk:
                break
            response += chunk
        s.close()

        # Split HTTP headers from the JSON response body
        if b"\r\n\r\n" in response:
            body = response.split(b"\r\n\r\n", 1)[1]
            return json.loads(body.decode('utf-8'))
    except Exception:
        pass
    return None
@auth_bp.route('/auth/bootstrap', methods=['POST'])
def bootstrap():
    """Unauthenticated token exchange gate supporting absolute dynamic fallback routing."""
    data = request.json or {}

    # Extract real IP if behind Tailscale Serve or a Reverse Proxy
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr).split(',')[0].strip()
    # --- ROUTE A: LOCALHOST BYPASS ---
    # If the user is physically on the machine, auto-authenticate
    if client_ip == '127.0.0.1':
        # Check for cross-origin browser requests (Localhost Drive-By CSRF prevention)
        origin = request.headers.get('Origin', '')
        referer = request.headers.get('Referer', '')
        allowed_hosts = ['127.0.0.1', 'localhost', '.ts.net']
        if origin and not any(host in origin for host in allowed_hosts):
            return jsonify({"error": "Forbidden: Cross-origin request blocked"}), 403
        if referer and not any(host in referer for host in allowed_hosts):
            return jsonify({"error": "Forbidden: Cross-origin request blocked"}), 403

        return jsonify({
            "status": "authenticated", 
            "token": BOOT_TOKEN, 
            "method": "localhost"
        })

    cfg = load_config()

    # --- ROUTE B: TAILSCALE AUTO-HANDSHAKE & TOFU ---
    # 1. Check if Tailscale Serve injected the identity headers directly
    user_email = request.headers.get('Tailscale-User-Login')
    
    # 2. Fallback to Unix socket WHOIS for direct Tailnet IP connections
    if not user_email:
        ts_profile = query_tailscale_whois(client_ip)
        if ts_profile:
            user_email = ts_profile.get("UserProfile", {}).get("LoginName")
    if user_email:
        allowed_emails = cfg.get("allowed_dev_emails", [])
        # Trust On First Use (TOFU)
        if not allowed_emails:
            from insetu.kernel.utils import load_json_file
            cfg_path, _, _ = get_workspace_physics()
            raw_cfg = load_json_file(cfg_path, {})
            raw_cfg["allowed_dev_emails"] = [user_email]
            save_json_file(cfg_path, raw_cfg)
            return jsonify({
                "status": "authenticated", 
                "token": BOOT_TOKEN, 
                "method": "tailscale_tofu",
                "user": user_email
            })
        
        # Standard Whitelist Check
        elif user_email in allowed_emails:
            return jsonify({
                "status": "authenticated", 
                "token": BOOT_TOKEN, 
                "method": "tailscale",
                "user": user_email
            })

    # --- ROUTE C: PERSISTENT CONFIG TOKEN CHECK ---
    client_token = data.get("token")
    system_token = cfg.get("auth_token")

    if system_token and client_token == system_token:
        return jsonify({
            "status": "authenticated", 
            "token": BOOT_TOKEN, 
            "method": "static_config"
        })

    return jsonify({
        "status": "challenge", 
        "message": "Authentication required."
    }), 401