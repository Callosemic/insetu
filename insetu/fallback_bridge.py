from pathlib import Path
# insetu/fallback_bridge.py

import os
import sys
import hmac
import json
import re
import secrets
import importlib.util
import time
import zipfile
import threading
from datetime import datetime
from flask import Flask, request, jsonify, send_file, render_template_string, redirect

app = Flask(__name__)

# --- BOTTOM-LAYER AUTH (V4, S8) ---
# The lifeboat listens on the port `tailscale serve` exposes, so it needs the same token as the app.
# Credentials come from akasa/auth/credentials.py, loaded by file path so a broken akasa package
# cannot lock you out. A phone that was signed in keeps working: the lifeboat is the same origin,
# and the session token is durable.
CONTROL_DIRNAME = os.environ.get("AKASA_CONTROL_DIR", ".insetu")
TOKEN_HEADERS = ("X-InSetu-Token", "X-Akasa-Token")
PUBLIC_PATHS = frozenset({"/", "/recovery", "/auth/bootstrap"})
LOOPBACK_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})
TRUSTED_HOST_SUFFIXES = (".ts.net",)
LIFEBOAT_TOKEN_FILENAME = "lifeboat_token"
_LIFEBOAT_TOKEN = None
_CREDENTIALS_MODULE = False  # False: not looked up yet; None: unavailable.


def _control_dir():
    return Path(os.getcwd()).resolve() / CONTROL_DIRNAME


def _credentials_module():
    """Loads akasa's stdlib-only credential store by path, without running akasa's package __init__."""
    global _CREDENTIALS_MODULE
    if _CREDENTIALS_MODULE is not False:
        return _CREDENTIALS_MODULE
    locations = []
    try:
        spec = importlib.util.find_spec("akasa")  # Locates the package; does not import it.
        if spec and spec.submodule_search_locations:
            locations.extend(spec.submodule_search_locations)
    except (ImportError, ValueError):
        pass
    locations.append(Path(__file__).resolve().parent.parent.parent.joinpath("akasa", "akasa").as_posix())
    _CREDENTIALS_MODULE = None
    for loc in locations:
        candidate = Path(loc) / "auth" / "credentials.py"
        if not candidate.is_file():
            continue
        try:
            c_spec = importlib.util.spec_from_file_location("insetu_lifeboat_credentials", candidate.as_posix())
            module = importlib.util.module_from_spec(c_spec)
            c_spec.loader.exec_module(module)
            _CREDENTIALS_MODULE = module
            break
        except Exception as e:
            print(f"⚠️ [Lifeboat] Could not load {candidate}: {e}")
    return _CREDENTIALS_MODULE


def current_token():
    """The token this lifeboat accepts: the app's durable session token, or a lifeboat-only one as a last resort."""
    global _LIFEBOAT_TOKEN
    if _LIFEBOAT_TOKEN:
        return _LIFEBOAT_TOKEN
    token = os.environ.get("AKASA_BOOT_TOKEN")  # Set when the app crashed in this same process, or as an override.
    creds = _credentials_module()
    if not token and creds is not None:
        try:
            token = creds.load_or_create_token(_control_dir())
        except OSError as e:
            print(f"⚠️ [Lifeboat] Could not read the session token: {e}")
    if not token and creds is None:
        try:  # Older akasa without credentials.py: the file format is one line of text.
            token = (_control_dir() / "auth" / "session_token").read_text(encoding="utf-8").strip() or None
        except (OSError, UnicodeDecodeError):
            token = None
    if not token:
        token = secrets.token_hex(32)
        token_file = _control_dir() / LIFEBOAT_TOKEN_FILENAME
        try:
            token_file.parent.mkdir(parents=True, exist_ok=True)
            fd = os.open(token_file.as_posix(), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                handle.write(token + "\n")
        except OSError:
            pass
        print(f"🔑 No saved inSetu token was readable, so the lifeboat made its own: {token}")
        print(f"   (also written to {token_file.as_posix()}; paste it into the recovery page)")
    _LIFEBOAT_TOKEN = token
    return token


def _token_matches(presented):
    expected = current_token()
    creds = _credentials_module()
    if creds is not None:
        return creds.verify_token(presented, expected)
    if not expected or not isinstance(presented, str) or not presented:
        return False
    return hmac.compare_digest(presented.encode("utf-8"), expected.encode("utf-8"))


def _configured_hosts():
    """Hostnames from Remote Access's 'allowed_hosts' setting in host.json (comma-separated)."""
    try:
        data = json.loads((_control_dir() / "host.json").read_text(encoding="utf-8"))
        raw = (data.get("remote") or {}).get("allowed_hosts") or ""
    except (OSError, ValueError, AttributeError):
        return set()
    return {h.strip().lower().rstrip(".") for h in str(raw).split(",") if h.strip()}


def _normalize_host(raw):
    host = str(raw or "").strip().lower()
    if host.startswith("["):
        host = host[1:].split("]", 1)[0]
    elif host.count(":") == 1:
        host = host.split(":", 1)[0]
    return host.rstrip(".")


def _host_allowed(raw):
    """DNS-rebinding guard, matching the app's rules: loopback, *.ts.net, and configured hosts."""
    host = _normalize_host(raw)
    if not host:
        return False
    if host in LOOPBACK_HOSTS:
        return True
    if any(host.endswith(sfx) and len(host) > len(sfx) for sfx in TRUSTED_HOST_SUFFIXES):
        return True
    return host in _configured_hosts()


@app.before_request
def _lifeboat_gate():
    if not _host_allowed(request.host):
        return jsonify({"error": "421 Misdirected Request: Host not allowed."}), 421
    if request.path in PUBLIC_PATHS or request.path.startswith("/static/"):
        return None
    presented = next((request.headers.get(h) for h in TOKEN_HEADERS if request.headers.get(h)), None)
    if not presented and request.path.startswith("/download/"):
        presented = request.args.get("token")  # Plain navigation fallback when a blob download fails.
    if not _token_matches(presented):
        return jsonify({"error": "401 Unauthorized: the lifeboat needs your inSetu token."}), 401
    return None


def _readable_roots():
    root, repos = _lifeboat_workspace()
    roots = [root, Path(os.getcwd()).resolve()]
    for repo in repos:
        if repo.get("physical_path"):
            roots.append(Path(repo["physical_path"]).expanduser().resolve())
    return roots


def _confine(raw_path):
    """Resolves a caller path (relative to the daemon directory) with symlinks followed; None outside the workspace or inside the credential store."""
    candidate = Path(raw_path)
    if not candidate.is_absolute():
        candidate = Path(os.getcwd()) / candidate
    resolved = Path(os.path.realpath(candidate))
    try:
        resolved.relative_to(Path(os.path.realpath(_control_dir() / "auth")))
        return None
    except ValueError:
        pass
    for base in _readable_roots():
        try:
            resolved.relative_to(Path(os.path.realpath(base)))
            return resolved
        except ValueError:
            continue
    return None

# --- STANDALONE PATCH ENGINE ---
# (Isolated from engine_bridge.py to ensure zero dependencies during Kernel Panic)

def expand_macros(text):
    text = re.sub(r'\{\{\s*ymm:(.)[x*](\d+)\s*\}\}', lambda m: m.group(1) * int(m.group(2)), text)
    text = re.sub(r'\{\{\s*(.)\s*\*\s*(\d+)\s*\}\}', lambda m: m.group(1) * int(m.group(2)), text)
    text = re.sub(r'\{\{\s*triple(.)\s*\}\}', lambda m: m.group(1) * 3, text)
    return text

def parse_blocks(text):
    files = {}
    current_file = None
    state = "OUTSIDE"
    comment_lines, search_lines, replace_lines = [], [], []
    lines = text.replace('\r\n', '\n').split('\n')
    for line in lines:
        if line.startswith("<<<<<<< FILE:"):
            current_file = line.replace("<<<<<<< FILE:", "").strip()
            if current_file not in files: files[current_file] = []
            state = "OUTSIDE"
        elif line.startswith("<<<<<<< ID:"):
            continue
        elif line.startswith("<<<<<<< COMMENT"):
            state = "COMMENT"
            comment_lines = []
        elif line.startswith("<<<<<<< SEARCH"):
            state = "SEARCH"
            search_lines = []
        elif line.startswith("======="):
            if state == "SEARCH":
                state = "REPLACE"
                replace_lines = []
            elif state in ("OUTSIDE", "COMMENT") and current_file:
                state = "REPLACE"
                search_lines = []
                replace_lines = []
        elif line.startswith(">>>>>>> REPLACE"):
            if state == "REPLACE" and current_file:
                files[current_file].append({
                    "comment": "\n".join(comment_lines).strip(),
                    "search": "\n".join(search_lines),
                    "replace": "\n".join(replace_lines)
                })
                comment_lines = []
            state = "OUTSIDE"
        else:
            if state == "COMMENT": comment_lines.append(line)
            elif state == "SEARCH": search_lines.append(line)
            elif state == "REPLACE": replace_lines.append(line)
    return files

def apply_block_in_memory(content, block):
    content = content.replace('\r\n', '\n')
    search_str = expand_macros(block["search"])
    replace_str = expand_macros(block["replace"])
    
    if not search_str.strip():
        return True, replace_str # Genesis patch
        
    # Simplified diff anchor logic for the lifeboat to ensure maximum stability
    if search_str in content:
        return True, content.replace(search_str, replace_str)
    else:
        return False, content

def _lifeboat_workspace():
    """Returns (workspace_root, target_repos) from the daemon's control files, using only the standard library."""
    cwd = Path(os.getcwd()).resolve()
    control = cwd / ".insetu"
    config_name = "config.json"
    try:
        ws_index = json.loads((control / "workspaces.json").read_text(encoding="utf-8"))
        active = ws_index.get("active_workspace") or "default"
        config_name = (ws_index.get("workspaces") or {}).get(active, {}).get("config_path") or config_name
    except (OSError, ValueError, AttributeError):
        pass
    try:
        cfg = json.loads((control / config_name).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        cfg = {}
    if not isinstance(cfg, dict):
        cfg = {}
    root = Path(cfg.get("workspace_root") or cwd).expanduser().resolve()
    repos = [r for r in (cfg.get("target_repos") or []) if isinstance(r, dict) and r.get("repo_dir")]
    return root, repos

def _resolve_patch_target(raw_target):
    """
    Maps a patch FILE header to an absolute path, mirroring the main bridge's vfs://<repo>/<path>
    resolution (longest repo_dir prefix, optional physical_path). Plain relative paths resolve against
    the daemon directory as before. Every write must land inside the
    workspace root, the daemon directory, or a repository's physical_path.
    Returns (absolute_path, None) or (None, reason).
    """
    raw = raw_target.strip().replace("\\", "/")
    root, repos = _lifeboat_workspace()
    allowed = [Path(os.path.realpath(b)) for b in _readable_roots()]

    if raw.startswith("vfs://"):
        logical = raw[len("vfs://"):].strip("/")
        best = None
        for repo in repos:
            r_dir = repo["repo_dir"].strip("/")
            if logical == r_dir or logical.startswith(r_dir + "/"):
                if best is None or len(r_dir) > len(best["repo_dir"].strip("/")):
                    best = repo
        if best is not None:
            r_dir = best["repo_dir"].strip("/")
            rel = logical[len(r_dir):].lstrip("/")
            if best.get("physical_path"):
                base = Path(best["physical_path"]).expanduser().resolve()
            elif root.name == r_dir:
                base = root
            else:
                base = root / r_dir
            candidate = base / rel
        else:
            candidate = root / logical
    elif "://" in raw:
        return None, f"Unsupported target '{raw_target}': the lifeboat writes vfs:// and plain paths only."
    else:
        candidate = Path(raw)

    resolved = Path(os.path.realpath(candidate))  # Follow symlinks so a link inside the workspace cannot point a write outside it.
    try:
        resolved.relative_to(Path(os.path.realpath(_control_dir() / "auth")))
        return None, "Refusing to write into the credential store."
    except ValueError:
        pass
    for base in allowed:
        try:
            resolved.relative_to(base)
            return resolved.as_posix(), None
        except ValueError:
            continue
    return None, f"Refusing to write outside the workspace: {resolved.as_posix()}"

# --- LIFEBOAT UI ---
HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>inSetu Recovery OS</title>
    <style>
        body { font-family: monospace; background: #0f172a; color: #38bdf8; padding: 20px; line-height: 1.6; }
        .banner { background: #dc2626; color: white; padding: 15px; font-weight: bold; border-radius: 4px; margin-bottom: 20px; text-align: center; }
        .panic-trace { background: rgba(0,0,0,0.3); padding: 15px; border-radius: 4px; text-align: left; font-family: monospace; font-size: 0.85rem; white-space: pre-wrap; overflow-x: auto; margin-top: 15px; color: #f8fafc; border: 1px solid #991b1b; }
        textarea { width: 100%; height: 300px; background: #1e293b; color: #e2e8f0; border: 1px solid #334155; padding: 10px; margin-bottom: 10px; font-family: monospace; box-sizing: border-box; }
        button { background: #10b981; color: white; border: none; padding: 10px 20px; cursor: pointer; font-weight: bold; border-radius: 4px; }
        .fs-container { background: #1e293b; padding: 15px; border: 1px solid #334155; border-radius: 4px; margin-top: 10px; max-height: 400px; overflow-y: auto; }
        .file-link { color: #38bdf8; text-decoration: none; cursor: pointer; display: block; margin: 5px 0; padding: 5px; border-radius: 4px; }
        .file-link:hover { background: #334155; text-decoration: none; }
    </style>
</head>
<body>
    <div class="banner">
        ⚠️ KERNEL PANIC: INSETU RECOVERY OS (LIFEBOAT FS) ⚠️<br><br>
        The primary Developer OS failed to boot. You are running on the zero-dependency fallback bridge.
        <div class="panic-trace" id="panic-trace" style="display: none;"></div>
    </div>

    <div id="token-box" style="display: none; background: #f59e0b20; border: 1px solid #f59e0b; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
        <h4 style="margin-top: 0; color: #fbbf24;">🔑 Token required</h4>
        <p style="font-size: 0.9rem; color: #94a3b8;">This browser has no saved inSetu token, or the lifeboat rejected it. Paste the token from <code>.insetu/auth/session_token</code> on the machine (or the one the lifeboat printed in its terminal).</p>
        <input id="token-input" type="password" autocomplete="off" style="width: 100%; box-sizing: border-box; padding: 8px; background: #1e293b; color: #e2e8f0; border: 1px solid #334155; font-family: monospace; margin-bottom: 10px;">
        <button onclick="saveToken(document.getElementById('token-input').value.trim()); bootPage();">Save token</button>
    </div>
    
    <h3>1. Emergency Sync Bridge</h3>
    <p>Paste your patch sandwich below to fix the corrupted core file. A successful patch will require you to manually restart the daemon.</p>
    <textarea id="payload" placeholder="<<<<<<< FILE: insetu/app.py
<<<<<<< SEARCH
[fixed code]
=======
[fixed code]
>>>>>>> REPLACE"></textarea>
    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button onclick="sync()">⚡ Execute Emergency Patch</button>
        <button onclick="navigator.clipboard.readText().then(t => { document.getElementById('payload').value = t; }).catch(e => alert('Clipboard access denied.'))" style="background: #475569;">📋 Paste</button>
        <button onclick="document.getElementById('payload').value = ''" style="background: #64748b;">❌ Clear</button>
        <button onclick="rebootOS()" style="background: #3b82f6;">🔄 Reboot inSetu OS</button>
    </div>
    <pre id="log" style="color: #f59e0b; margin-top: 15px; background: #1e293b; padding: 10px; border-radius: 4px; display: none;"></pre>

    <div style="background: #3b82f620; border: 1px solid #3b82f6; padding: 15px; border-radius: 4px; margin-top: 20px;">
        <h4 style="margin-top: 0; color: #60a5fa;">🆘 Architect Rescue Protocol</h4>
        <p style="font-size: 0.9rem; color: #94a3b8;">If you need an LLM to debug this kernel panic, this button will instantly compile the raw source code of the entire inSetu OS into a single context payload.</p>
        <button id="btn-emergency-dump" onclick="emergencyDump()" style="background: #3b82f6;">📦 Generate Core OS Context</button>
    </div>

    <hr style="border-color: #334155; margin: 30px 0;">

    <h3>2. Lifeboat File Evacuation</h3>
    <p style="color: #94a3b8;">If the OS is irreparably bricked, use this zero-dependency explorer to manually download and evacuate your tracked files.</p>
    <p>Current Directory: <span id="cwd-display" style="color: #f8fafc; font-weight: bold;"></span></p>
    <button onclick="loadFS('..')" style="background: #3b82f6; padding: 6px 12px; margin-bottom: 10px;">⬆️ Up Directory</button>
    
    <div class="fs-container" id="fs-list">Loading...</div>

    <script>
        function getToken() {
            try { return localStorage.getItem('insetu_boot_token') || sessionStorage.getItem('insetu_boot_token') || ''; } catch (e) { return ''; }
        }
        function saveToken(token) {
            if (!token) return;
            try { localStorage.setItem('insetu_boot_token', token); sessionStorage.setItem('insetu_boot_token', token); } catch (e) {}
        }
        // Every lifeboat API call carries the token; a 401 asks for it instead of failing silently.
        async function api(url, options = {}) {
            options.headers = Object.assign({}, options.headers || {}, { 'X-InSetu-Token': getToken() });
            const res = await fetch(url, options);
            document.getElementById('token-box').style.display = res.status === 401 ? 'block' : 'none';
            return res;
        }

        async function downloadFileResilient(fetchUrl, filename) {
            try {
                const res = await api(fetchUrl);
                if (!res.ok) throw new Error("Download failed");
                const blob = await res.blob();

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            } catch (e) {
                window.location.href = fetchUrl + (fetchUrl.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(getToken());
            }
        }

        async function sync() {
            const text = document.getElementById('payload').value;
            const log = document.getElementById('log');
            log.style.display = 'block';
            log.innerText = "Applying patch...";
            try {
                const res = await api('/api/bridge/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: text })
                });
                log.innerText = await res.text();
            } catch (e) {
                log.innerText = "Network Error: " + e.message;
            }
        }

        async function rebootOS() {
            if (!confirm("Attempt to reboot into the primary Developer OS?")) return;
            // Keep the token: it is durable, and the app and the lifeboat both accept it.
            if ('caches' in window) {
                try {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                } catch(e) {}
            }
            if ('serviceWorker' in navigator) {
                try {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    for (let reg of regs) await reg.unregister();
                } catch(e) {}
            }
            document.body.innerHTML = "<h2 style='color: #10b981; text-align: center; margin-top: 20%;'>Rebooting Engine...<br><span style='font-size: 0.8rem; color: #888;'>Waiting for OS to come back online...</span></h2>";
            try {
                const rebootRes = await api('/api/system/reboot', { method: 'POST' });
                if (rebootRes.status === 401) { window.location.reload(); return; }
                setTimeout(() => {
                    setInterval(async () => {
                        try {
                            const ping = await fetch('/auth/bootstrap?t=' + Date.now(), {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: '{}',
                                cache: 'no-store'
                            });
                            if (ping.ok || ping.status === 401) {
                                const data = await ping.json().catch(() => ({}));
                                if (data && data.status === 'recovery') {
                                    window.location.href = '/recovery';
                                } else {
                                    if (data && data.token) {
                                        sessionStorage.setItem('insetu_boot_token', data.token);
                                        localStorage.setItem('insetu_boot_token', data.token);
                                    }
                                    window.location.href = '/';
                                }
                            }
                        } catch(err) {}
                    }, 1000);
                }, 1500);
            } catch (e) {
                alert("Reboot failed: " + e.message);
            }
        }

        async function emergencyDump() {
            const btn = document.getElementById('btn-emergency-dump');
            const orig = btn.innerText;
            btn.innerText = "⏳ Compiling...";
            try {
                const res = await api('/api/system/emergency_dump', { method: 'POST' });
                const data = await res.json();
                if (res.ok) {
                    btn.innerText = "✅ Compiled successfully";
                    setTimeout(() => btn.innerText = orig, 3000);
                    await downloadFileResilient('/download/' + encodeURIComponent(data.file), data.file);
                } else {
                    alert("Dump failed: " + data.message);
                    btn.innerText = orig;
                }
            } catch (e) {
                alert("Network error: " + e.message);
                btn.innerText = orig;
            }
        }

        let currentPath = ".";
        async function loadFS(target) {
            if (target === '..') {
                const parts = currentPath.split('/');
                parts.pop();
                currentPath = parts.length ? parts.join('/') : '.';
            } else if (target !== '.') {
                currentPath = currentPath === '.' ? target : currentPath + '/' + target;
            }

            document.getElementById('cwd-display').innerText = currentPath === '.' ? '[Workspace Root]' : currentPath;
            const res = await api('/api/fs/list?dir=' + encodeURIComponent(currentPath));
            const data = await res.json().catch(() => ({ dirs: [], files: [] }));
            if (!res.ok) {
                document.getElementById('fs-list').innerHTML = '<span style="color: #64748b;">' + (res.status === 401 ? 'Save your token above to browse files.' : 'That folder is outside the workspace.') + '</span>';
                if (res.status === 403) { currentPath = '.'; }
                return;
            }
            
            const list = document.getElementById('fs-list');
            list.innerHTML = '';
            
            if (data.dirs.length === 0 && data.files.length === 0) {
                list.innerHTML = '<span style="color: #64748b;">Directory is empty.</span>';
                return;
            }

            data.dirs.forEach(d => {
                const a = document.createElement('a');
                a.className = 'file-link';
                a.innerText = '📁 ' + d;
                a.onclick = () => loadFS(d);
                list.appendChild(a);
            });
            
            data.files.forEach(f => {
                const a = document.createElement('a');
                a.className = 'file-link';
                a.innerText = '📄 ' + f;
                a.href = '#';
                const dlUrl = '/download/' + encodeURIComponent(currentPath === '.' ? f : currentPath + '/' + f);
                a.onclick = (e) => {
                    e.preventDefault();
                    downloadFileResilient(dlUrl, f);
                };
                list.appendChild(a);
            });
        }
        
        async function loadPanicDetails() {
            const res = await api('/api/system/panic_details');
            if (!res.ok) return;
            const data = await res.json().catch(() => ({}));
            const trace = document.getElementById('panic-trace');
            if (data.details) { trace.innerText = data.details; trace.style.display = 'block'; }
        }

        function bootPage() {
            loadPanicDetails();
            loadFS('.');
        }
        bootPage();
    </script>
</body>
</html>
"""

@app.route('/')
def index_redirect():
    return redirect('/recovery')

@app.route('/auth/bootstrap', methods=['GET', 'POST'])
def recovery_auth_bootstrap():
    """Allows reboot polling loops (from both main OS and recovery UI) to detect when the server is in recovery mode."""
    return jsonify({"status": "recovery", "mode": "lifeboat"}), 200

@app.route('/recovery')
def index():
    # Public page: the traceback is fetched separately with the token, because it can contain paths and secrets.
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/system/panic_details')
def panic_details():
    return jsonify({"details": os.environ.get("INSETU_PANIC_DETAILS", "")})

@app.route('/api/bridge/sync', methods=['POST'])
def bridge_sync():
    data = request.json
    raw_text = data.get("text", "")
    parsed = parse_blocks(raw_text)
    
    log = []
    for target_file, blocks in parsed.items():
        abs_path, reason = _resolve_patch_target(target_file)
        log.append(f"Targeting: {target_file}" + (f" -> {abs_path}" if abs_path and abs_path != os.path.abspath(target_file) else ""))
        if not abs_path:
            log.append(f"  [!] {reason}")
            continue
        
        if os.path.exists(abs_path):
            with open(abs_path, 'r', encoding='utf-8') as f:
                content = f.read()
        else:
            content = ""
            
        success = True
        for b in blocks:
            ok, content = apply_block_in_memory(content, b)
            if not ok:
                success = False
                log.append(f"  [!] Failed to anchor SEARCH block in {target_file}")
                break
                
        if success:
            if Path(abs_path).parent:
                os.makedirs(Path(abs_path).parent, exist_ok=True)
            with open(abs_path, 'w', encoding='utf-8') as f:
                f.write(content)
            log.append(f"  [✓] Successfully patched {target_file}")
            
    if not log:
        log.append("No valid patch blocks detected in payload.")
        
    return "\n".join(log), 200

@app.route('/api/fs/list')
def fs_list():
    target_dir = request.args.get('dir', '.')
    confined = _confine(target_dir)
    if confined is None:
        return jsonify({"dirs": [], "files": [], "error": "Outside the workspace."}), 403
    abs_dir = confined.as_posix()
    if not os.path.exists(abs_dir) or not os.path.isdir(abs_dir):
        return jsonify({"dirs": [], "files": []})
        
    dirs = []
    files = []
    for item in sorted(os.listdir(abs_dir)):
        # Hide internal Python files and Git noise
        if item in ('__pycache__', '.git'):
            continue
            
        if os.path.isdir(Path(abs_dir).joinpath(item).as_posix()):
            dirs.append(item)
        else:
            files.append(item)
            
    return jsonify({"dirs": dirs, "files": files})

@app.route('/download/<path:filepath>')
def download(filepath):
    # Paths are relative to the daemon directory and must stay inside the workspace (symlinks followed).
    confined = _confine(filepath)
    if confined is None:
        return "Refusing to read outside the workspace.", 403
    if confined.is_file():
        return send_file(confined.as_posix(), as_attachment=True)
    return "File not found", 404

@app.route('/api/system/emergency_dump', methods=['POST'])
def api_emergency_dump():
    """Zero-dependency hardcoded compiler that survives core config corruption."""
    try:
        # Point to the repository root
        repo_root = Path(__file__).resolve().parent.parent.parent.as_posix()
        out_file = "emergency_core_context.zip"
        
        target_dirs = [
            "docs",
            "akasa/akasa",
            "insetu/insetu/core",
            "insetu/insetu/extensions",
            "insetu/insetu/static",
            "insetu/insetu/templates"
        ]
        target_files = [
            "insetu/insetu/app.py",
            "insetu/insetu/cli.py",
            "insetu/insetu/fallback_bridge.py",
            "CODE_INDEX.md"
        ]
        
        # 1. Collect all matching target files
        matched_entries = []
        for root, _, files in os.walk(repo_root):
            if "__pycache__" in root or "node_modules" in root or ".git" in root: 
                continue
                
            rel_dir = os.path.relpath(root, repo_root).replace('\\', '/')
            
            # Match target directories (strictly limiting 'docs' to direct children)
            is_target_dir = False
            for d in target_dirs:
                if d == "docs":
                    if rel_dir == "docs":
                        is_target_dir = True
                        break
                elif rel_dir.startswith(d):
                    is_target_dir = True
                    break
            
            for f in files:
                if not f.endswith(('.py', '.js', '.html', '.md', '.json', '.txt')):
                    continue
                    
                rel_path = f"{rel_dir}/{f}" if rel_dir != "." else f
                
                if is_target_dir or rel_path in target_files:
                    filepath = Path(root).joinpath(f).as_posix()
                    matched_entries.append((rel_path, filepath))

        matched_entries.sort(key=lambda x: x[0])

        # 2. Build ASCII tree hierarchy
        tree_dict = {}
        for rel_path, _ in matched_entries:
            parts = rel_path.split('/')
            curr = tree_dict
            for part in parts:
                curr = curr.setdefault(part, {})

        tree_lines = ["."]
        def render_tree(node, prefix=""):
            items = list(node.keys())
            for i, key in enumerate(items):
                is_last = (i == len(items) - 1)
                connector = "└── " if is_last else "├── "
                child_prefix = "    " if is_last else "│   "
                tree_lines.append(f"{prefix}{connector}{key}")
                render_tree(node[key], prefix + child_prefix)

        render_tree(tree_dict)
        tree_str = "\n".join(tree_lines)

        # Print tree to console
        print("\n--- EMERGENCY CORE CONTEXT INCLUSION TREE ---")
        print(tree_str)
        print("---------------------------------------------\n")

        # 3. Write tree structure and file contents to context dump as ZIP
        with zipfile.ZipFile(out_file, "w", zipfile.ZIP_DEFLATED) as zf:
            tree_content = (
                "============================================================\n"
                f"INSETU EMERGENCY CORE CONTEXT ({datetime.now()})\n"
                "============================================================\n\n"
                "INCLUDED FILE STRUCTURE:\n"
                f"{tree_str}\n\n"
            )
            zf.writestr("00_FILE_STRUCTURE.txt", tree_content)
            
            buckets = {
                "akasa.txt": [],
                "extensions.txt": [],
                "core.txt": [],
                "misc.txt": []
            }
            
            for rel_path, filepath in matched_entries:
                if rel_path.startswith("sutram/sutram/"):
                    if "vendor_sutram.txt" not in buckets: buckets["vendor_sutram.txt"] = []
                    buckets["vendor_sutram.txt"].append((rel_path, filepath))
                elif rel_path.startswith("sutram/yenvui/"):
                    if "vendor_yenvui.txt" not in buckets: buckets["vendor_yenvui.txt"] = []
                    buckets["vendor_yenvui.txt"].append((rel_path, filepath))
                elif "/vendor/" in rel_path:
                    try:
                        vendor_name = rel_path.split('/vendor/')[1].split('/')[0]
                    except IndexError:
                        vendor_name = "misc"
                    bucket_key = f"vendor_{vendor_name}.txt"
                    if bucket_key not in buckets:
                        buckets[bucket_key] = []
                    buckets[bucket_key].append((rel_path, filepath))
                elif "vendor.json" in rel_path:
                    if "vendor_config.txt" not in buckets:
                        buckets["vendor_config.txt"] = []
                    buckets["vendor_config.txt"].append((rel_path, filepath))
                elif rel_path.startswith("akasa/"):
                    buckets["akasa.txt"].append((rel_path, filepath))
                elif rel_path.startswith("insetu/insetu/extensions/"):
                    buckets["extensions.txt"].append((rel_path, filepath))
                elif "insetu/insetu/core/" in rel_path or "app.py" in rel_path or "cli.py" in rel_path or "fallback_bridge.py" in rel_path:
                    buckets["core.txt"].append((rel_path, filepath))
                else:
                    buckets["misc.txt"].append((rel_path, filepath))
            
            max_chunk_bytes = 256 * 1024  # 256 KB per part without splitting individual files
            for bucket_name, entries in buckets.items():
                if not entries:
                    continue
                file_blocks = []
                for rel_path, filepath in entries:
                    try:
                        with open(filepath, 'r', encoding='utf-8') as inf:
                            content = inf.read()

                        # Strip massive inline base64 source maps from vendor JS files to preserve LLM token context
                        if filepath.endswith('.js'):
                            content = re.sub(r'//#\s*sourceMappingURL=data:application/json;base64,[A-Za-z0-9+/=]+', '', content)

                        block_str = f"\n\n{'='*60}\n>>> FILE: {rel_path}\n{'='*60}\n\n{content}"
                        file_blocks.append(block_str)
                    except Exception:
                        pass

                if not file_blocks:
                    continue

                chunks = []
                current_chunk = []
                current_bytes = 0
                for block_str in file_blocks:
                    block_bytes = len(block_str.encode('utf-8'))
                    if current_chunk and (current_bytes + block_bytes > max_chunk_bytes):
                        chunks.append("".join(current_chunk))
                        current_chunk = [block_str]
                        current_bytes = block_bytes
                    else:
                        current_chunk.append(block_str)
                        current_bytes += block_bytes
                if current_chunk:
                    chunks.append("".join(current_chunk))

                if len(chunks) == 1:
                    zf.writestr(bucket_name, chunks[0])
                else:
                    stem, ext = Path(bucket_name).stem, Path(bucket_name).suffix
                    for idx, chunk_text in enumerate(chunks, start=1):
                        zf.writestr(f"{stem}_part{idx}{ext}", chunk_text)

        return jsonify({"status": "success", "file": out_file})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/system/reboot', methods=['POST'])
def system_reboot():
    def restart():
        time.sleep(0.6)
        os.environ.pop("INSETU_PANIC_DETAILS", None)
        os.environ.pop("INSETU_SIMULATE_PANIC", None)
        os.environ.pop("WERKZEUG_RUN_MAIN", None)
        os.environ.pop("WERKZEUG_SERVER_FD", None)
        if os.path.exists(".panic_lock"):
            try:
                os.remove(".panic_lock")
            except OSError:
                pass
        python_exe = sys.executable
        cli_script = os.path.abspath(sys.argv[0])
        os.execv(python_exe, [python_exe, cli_script] + sys.argv[1:])

    threading.Thread(target=restart, daemon=True).start()
    return jsonify({"status": "success", "message": "Rebooting..."})

def run_recovery_app():
    port = int(os.environ.get("INSETU_PORT", 5005))
    print(f"🚀 Booting Immutable Recovery OS on Port {port}...")
    print(f"👉 Navigate to http://127.0.0.1:{port} to evacuate files or issue emergency patches.")
    for attempt in range(10):
        try:
            app.run(port=port, debug=False, use_reloader=False)
            break
        except OSError as e:
            if attempt < 9 and ("Address already in use" in str(e) or getattr(e, "errno", None) in (98, 48)):
                time.sleep(0.5)
            else:
                raise

if __name__ == "__main__":
    run_recovery_app()