## 🐍 Part 1: The Backend Engine (`insetu/insetu/`)

### 1. Create `insetu/auth.py`

Create a new dedicated authentication layer file. This handles communication with Tailscale's local daemon socket (`/var/run/tailscale/tailscaled.sock`) and exposes the unauthenticated bootstrap route.

```python
import os
import json
import socket
import secrets
from flask import Blueprint, request, jsonify
from insetu.utils_core import load_config

auth_bp = Blueprint('auth', __name__)

# Generate a cryptographically sound scrolling runtime session token
BOOT_TOKEN = secrets.token_hex(16)

def query_tailscale_whois(remote_ip):
    """Queries tailscaled via its native Unix socket to translate the IP into a Tailnet profile."""
    sock_path = "/var/run/tailscale/tailscaled.sock"
    if not os.path.exists(sock_path):
        return None

    try:
        # Construct a raw HTTP request tailored for Tailscale's LocalAPI socket
        # Tailscale requires the Host header to match exactly
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

        # Split HTTP header headers from the JSON response body
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
    client_ip = request.remote_addr
    cfg = load_config()

    # --- ROUTE A: TAILSCALE AUTO-HANDSHAKE ---
    ts_profile = query_tailscale_whois(client_ip)
    if ts_profile:
        user_email = ts_profile.get("UserProfile", {}).get("LoginName")
        allowed_emails = cfg.get("allowed_dev_emails", [])
        if user_email and user_email in allowed_emails:
            return jsonify({
                "status": "authenticated", 
                "token": BOOT_TOKEN, 
                "method": "tailscale",
                "user": user_email
            })

    # --- ROUTE B: PERSISTENT CONFIG TOKEN CHECK ---
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

```

### 2. Inject the Enforcement Gate in `insetu/app.py`

Register the new authentication blueprint and implement a global fast-failing authorization guard step.

```python
# <<<<<<< SEARCH (Around lines 20-30)
from insetu.routes_system import system_bp
from insetu.engine_gather import gather_bp
app.register_blueprint(fs_bp)
app.register_blueprint(bridge_bp)
app.register_blueprint(system_bp)
app.register_blueprint(gather_bp)
# =======
from insetu.routes_system import system_bp
from insetu.engine_gather import gather_bp
from insetu.auth import auth_bp, BOOT_TOKEN # Ingest security substrates
app.register_blueprint(fs_bp)
app.register_blueprint(bridge_bp)
app.register_blueprint(system_bp)
app.register_blueprint(gather_bp)
app.register_blueprint(auth_bp) # Mount public handshake layer

@app.before_request
def enforce_token_gate():
    """Universal interceptor enforcing token verification on all REST paths."""
    # Always allow core landing, public assets, and the auth route to bypass checks
    if request.path == '/' or request.path.startswith('/static/') or request.path == '/auth/bootstrap' or request.path == '/favicon.ico':
        return None

    client_token = request.headers.get('X-InSetu-Token')
    if not client_token or client_token != BOOT_TOKEN:
        return jsonify({"error": "401 Unauthorized: Invalid or missing execution credentials."}), 401
# >>>>>>> REPLACE

```

---

## 🎨 Part 2: The Frontend Substrate (`insetu/insetu/static/js/`)

### 1. Intercept payloads in `store.js`

Update your centralized `AppStore` state configuration to track token state without bleeding cross-tab variables.

```javascript
// Inside your createStore initialization dictionary (store.js)
// <<<<<<< SEARCH (Around line 5085)
            activeWorkspace: sessionStorage.getItem('insetu_workspace') || localStorage.getItem('insetu_workspace') || 'default',
            manifest: {},
// =======
            activeWorkspace: sessionStorage.getItem('insetu_workspace') || localStorage.getItem('insetu_workspace') || 'default',
            authToken: sessionStorage.getItem('insetu_boot_token') || '', // Track intent token cleanly
            manifest: {},
// >>>>>>> REPLACE

```

### 2. Upgrade the Core Network Shield in `app.js`

Modify the native `window.fetch` wrapper interceptor and the application lifecycle bootloader to force authorization checks.

```javascript
// --- UPDATE FETCH INTERCEPTOR ---
// <<<<<<< SEARCH (Around lines 4099-4103)
window.fetch = async (resource, options = {}) => {
    const isLocal = typeof resource === 'string' && (resource.startsWith('/') || resource.startsWith(window.location.origin));
    if (isLocal) {
        const headers = new Headers(options.headers || {});
        const activeWs = window.inSetu?.stores?.App?.getState()?.activeWorkspace ||
        sessionStorage.getItem('insetu_workspace') || localStorage.getItem('insetu_workspace') || 'default';
        if (!headers.has('X-Workspace-ID')) headers.append('X-Workspace-ID', activeWs);
        options.headers = headers;
    }
    return originalFetch(resource, options);
};
// =======
window.fetch = async (resource, options = {}) => {
    const isLocal = typeof resource === 'string' && (resource.startsWith('/') || resource.startsWith(window.location.origin));
    if (isLocal) {
        const headers = new Headers(options.headers || {});
        const activeWs = window.inSetu?.stores?.App?.getState()?.activeWorkspace ||
        sessionStorage.getItem('insetu_workspace') || localStorage.getItem('insetu_workspace') || 'default';
        
        // Inject tenancy boundaries natively
        if (!headers.has('X-Workspace-ID')) headers.append('X-Workspace-ID', activeWs);
        
        // Inject the secure cross-site drive-by protection token header
        const appToken = window.inSetu?.stores?.App?.getState()?.authToken || sessionStorage.getItem('insetu_boot_token');
        if (appToken && !headers.has('X-InSetu-Token')) headers.append('X-InSetu-Token', appToken);
        
        options.headers = headers;
    }
    return originalFetch(resource, options);
};
// >>>>>>> REPLACE

```

```javascript
// --- UPDATE LIFECYCLE BOOTLOADER ---
// Append the initialization loop right at the top of your DOMContentLoaded routine
// <<<<<<< SEARCH (Around line 4106)
window.addEventListener('DOMContentLoaded', async () => {
    clearTimeout(window.panicTimeout);
// =======
async function executeSecurityHandshake() {
    // Attempt a seamless, zero-config Tailscale handshake first
    let res = await originalFetch('/auth/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });

    if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem('insetu_boot_token', data.token);
        AppStore.setState({ authToken: data.token });
        return true;
    }

    // Fallback: Challenge issued, prompt client for static profile access token
    if (res.status === 401) {
        const userToken = prompt("🔑 inSetu Security Gate\nEnter the persistent 'auth_token' defined in your config.json:");
        if (!userToken) return false;

        let retryRes = await originalFetch('/auth/bootstrap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: userToken.trim() })
        });

        if (retryRes.ok) {
            const data = await retryRes.json();
            sessionStorage.setItem('insetu_boot_token', data.token);
            AppStore.setState({ authToken: data.token });
            return true;
        }
    }
    return false;
}

window.addEventListener('DOMContentLoaded', async () => {
    // Block application canvas rendering until intent validation settles safely
    const authenticated = await executeSecurityHandshake();
    if (!authenticated) {
        document.body.innerHTML = `<div style="font-family:monospace; color:var(--intent-danger); text-align:center; padding-top:20dvh;"><h2>❌ Access Denied</h2><p>Invalid framework credentials configuration.</p></div>`;
        return;
    }

    clearTimeout(window.panicTimeout);
// >>>>>>> REPLACE

```

---

## 🔒 Part 3: The Target Configuration Layer (`.insetu/`)

Update your default baseline or local workspace profile `config.json` matrix files to whitelist authorized developers:

```json
{
  "instance_title": "inSetu Developer OS",
  "port": 5005,
  "auth_token": "chassis_secure_key_exchange_2026",
  "allowed_dev_emails": [
    "your-tailscale-email@example.com",
    "collaborator@example.com"
  ]
}

```