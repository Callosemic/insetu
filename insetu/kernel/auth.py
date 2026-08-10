import os
import json
import socket
import secrets
from flask import Blueprint, request, jsonify
from insetu.kernel.utils import load_config, save_json_file, get_workspace_physics
from insetu.kernel.extension import InSetuExtension
auth_bp = Blueprint('auth', __name__)
def get_master_key():
    from insetu.kernel.utils import _cwd
    from pathlib import Path
    key_path = Path(_cwd).joinpath(".insetu", "master_key.txt")
    if not key_path.exists():
        from cryptography.fernet import Fernet
        key_path.parent.mkdir(parents=True, exist_ok=True)
        key = Fernet.generate_key()
        key_path.write_bytes(key)
    return key_path.read_bytes()

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
        "description": "This key encrypts your secrets.json. If you move this workspace to another machine, you must copy this key to .insetu/master_key.txt on the new machine. DO NOT LOSE THIS."
    }]
)
@security_bp.route('settings', methods=['POST'])
def update_security_settings(ctx):
    data = ctx.req.json or {}
    new_key = data.get("master_fernet_key")
    if new_key:
        from insetu.kernel.utils import _cwd
        from pathlib import Path
        key_path = Path(_cwd).joinpath(".insetu", "master_key.txt")
        key_path.write_bytes(new_key.encode('utf-8'))
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