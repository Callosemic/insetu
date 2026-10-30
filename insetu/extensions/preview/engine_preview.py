from pathlib import Path
import os
import sys
import time
import shlex
import secrets
import shutil
import signal
import subprocess
import threading
from collections import deque
from typing import TypedDict, Optional, List, Dict, Any
from insetu.core.sdk import InSetuExtension
from insetu.core.remote.engine_remote import set_tailscale_https_serve
from insetu.core.utils_core import (
    approve_command,
    is_command_approved,
    is_subpath,
    get_repo_path,
    get_sister_repos,
    is_port_listening as _is_port_listening,
    can_bind_port as _can_bind_port,
    allocate_ephemeral_port as _allocate_ephemeral_port,
)

PREVIEW_SETTINGS_SCHEMA = [
    {
        "id": "server_mode",
        "label": "Server Mode",
        "type": "select",
        "scope": "repo",
        "default": "auto",
        "options": [
            {"value": "auto", "label": "Auto-Detect (Passive)"},
            {"value": "static", "label": "Static HTTP (CORS + No-Cache)"},
            {"value": "uvicorn", "label": "Uvicorn (FastAPI / Starlette / ASGI)"},
            {"value": "flask", "label": "Flask (WSGI)"},
            {"value": "django", "label": "Django (manage.py runserver)"},
            {"value": "streamlit", "label": "Streamlit (Iframe Unblocked)"},
            {"value": "gradio", "label": "Gradio (ML / LLM Demo)"},
            {"value": "marimo", "label": "Marimo (Reactive Notebook)"},
            {"value": "vite", "label": "Vite (React / Vue / Svelte / Lit)"},
            {"value": "storybook", "label": "Storybook (Component Workbench)"},
            {"value": "mkdocs", "label": "MkDocs (Documentation Portal)"},
            {"value": "hugo", "label": "Hugo (Static Site Generator)"},
            {"value": "custom", "label": "Custom Command"}
        ],
        "description": "Execution profile for serving this repository."
    },
    {
        "id": "serve_dir",
        "label": "Serve Subdirectory",
        "type": "text",
        "scope": "repo",
        "default": ".",
        "description": "Relative directory inside the repository to serve from (e.g., '.', 'public', 'dist')."
    },
    {
        "id": "port",
        "label": "Dedicated Port",
        "type": "number",
        "scope": "repo",
        "default": 0,
        "description": "Set to 0 to auto-allocate a sticky free port in the 5100-5199 range on first start."
    },
    {
        "id": "bind_host",
        "label": "Bind Host Address",
        "type": "select",
        "scope": "repo",
        "default": "127.0.0.1",
        "options": [
            {"value": "127.0.0.1", "label": "127.0.0.1 (Loopback / Tailscale Serve)"},
            {"value": "0.0.0.0", "label": "0.0.0.0 (May be opened to the LAN on request)"}
        ],
        "description": "Servers always start on loopback. '0.0.0.0' only allows a person to open this repository's server to the LAN for one run or a limited time (S2)."
    },
    {
        "id": "entry_target",
        "label": "Entry Target / Custom Command",
        "type": "text",
        "scope": "repo",
        "default": "",
        "description": "Optional module target (e.g. 'main:app'), script path, or custom command with {port} and {host} placeholders."
    },
    {
        "id": "auto_start",
        "label": "Auto-Start on Workspace Boot",
        "type": "boolean",
        "scope": "repo",
        "default": False,
        "description": "Automatically launch this repository's server when the workspace boots."
    },
    {
        "id": "static_cors",
        "label": "Static Server CORS",
        "type": "boolean",
        "scope": "repo",
        "default": False,
        "description": "Send 'Access-Control-Allow-Origin: *' from the static server. Off by default: any web page could otherwise read the served files."
    },
    {
        "id": "tailscale_https",
        "label": "Bind Tailscale HTTPS Serve",
        "type": "boolean",
        "scope": "repo",
        "default": False,
        "description": "Automatically bind 'tailscale serve --bg --https=<port>' when the server starts."
    }
]
preview_bp = InSetuExtension(
    'preview',
    __name__,
    title="App Server & Preview",
    description="Managed per-repository development server supervisor and live web previewer.",
    settings_schema=PREVIEW_SETTINGS_SCHEMA,
    external_dependencies=["uvicorn"],
)
__depends__ = []

_PROCESS_REGISTRY: Dict[tuple, Dict[str, Any]] = {}
_REGISTRY_LOCK = threading.Lock()

LOOPBACK_HOST = "127.0.0.1"
LAN_HOST = "0.0.0.0"
ALLOWED_BIND_HOSTS = (LOOPBACK_HOST, LAN_HOST)
ALLOWED_SERVER_MODES = tuple(
    opt["value"] for field in PREVIEW_SETTINGS_SCHEMA if field["id"] == "server_mode" for opt in field["options"]
)
# LAN exposure is a lease a person grants (S2): for the current server run, or for a fixed time.
LAN_LEASE_DURATIONS: Dict[str, Optional[int]] = {"run": None, "15m": 15 * 60, "1h": 60 * 60, "8h": 8 * 60 * 60}
APPROVAL_KIND = "preview"


class PreviewApprovalRequired(Exception):
    """Raised when a repository's custom launch command has not been approved by a person."""

    def __init__(self, repo: str, command: str):
        super().__init__(f"Custom command for '{repo}' needs approval before it can run: {command}")
        self.repo = repo
        self.command = command


def _approval_command_for(effective_mode: str, target: str) -> Optional[str]:
    """The caller-chosen command text that must be approved for a launch, or None when the launch runs no custom command."""
    clean = (target or "").strip()
    if effective_mode == "custom":
        return clean or None
    if effective_mode == "hugo" and clean:
        return f"hugo server {clean}"
    return None


def _validate_overrides(overrides: Dict[str, Any]) -> None:
    """Rejects bind hosts and server modes outside the listed options (S2)."""
    host = overrides.get("bind_host")
    if host is not None and host not in ALLOWED_BIND_HOSTS:
        raise ValueError(f"bind_host must be one of {', '.join(ALLOWED_BIND_HOSTS)}.")
    mode = overrides.get("server_mode")
    if mode is not None and mode not in ALLOWED_SERVER_MODES:
        raise ValueError(f"server_mode must be one of {', '.join(ALLOWED_SERVER_MODES)}.")

_STATIC_SERVER_SCRIPT = """
import html
import http.server
import io
import os
import socketserver
import sys
import urllib.parse

port = int(sys.argv[1])
host = sys.argv[2]
directory = os.path.realpath(sys.argv[3])
allow_cors = len(sys.argv) > 4 and sys.argv[4] == "1"

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def _refused(self):
        # Dotfiles (.git, .env) and anything a symlink points outside the served folder are never served.
        path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        if any(seg.startswith(".") for seg in path.split("/") if seg):
            return True
        real = os.path.realpath(self.translate_path(self.path))
        return not (real == directory or real.startswith(directory + os.sep))

    def send_head(self):
        if self._refused():
            self.send_error(404, "Not found")
            return None
        return super().send_head()

    def list_directory(self, path):
        try:
            names = sorted(n for n in os.listdir(path) if not n.startswith("."))
        except OSError:
            self.send_error(404, "Not found")
            return None
        items = []
        for name in names:
            shown = name + ("/" if os.path.isdir(os.path.join(path, name)) else "")
            items.append(f'<li><a href="{urllib.parse.quote(shown)}">{html.escape(shown)}</a></li>')
        body = ("<!DOCTYPE html><html><body><ul>" + "".join(items) + "</ul></body></html>").encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        return io.BytesIO(body)

    def end_headers(self):
        if allow_cors:
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS, HEAD")
            self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

class ReusableTCPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True

with ReusableTCPServer((host, port), NoCacheHandler) as httpd:
    print(f"Serving static files from '{directory}' on http://{host}:{port}", flush=True)
    httpd.serve_forever()
""".strip()
def _allocate_free_port(ctx, target_repo: str, bind_host: str = LOOPBACK_HOST) -> int:
    reserved_ports = set()
    for r_dir in get_sister_repos(ctx.workspace_id):
        if r_dir == target_repo:
            continue
        p = int(ctx.settings.get("port", 0, repo=r_dir) or 0)
        if p > 0:
            reserved_ports.add(p)
    with _REGISTRY_LOCK:
        for (ws_id, r_dir), entry in _PROCESS_REGISTRY.items():
            if (ws_id, r_dir) != (ctx.workspace_id, target_repo) and entry.get("port"):
                reserved_ports.add(int(entry["port"]))

    for candidate in range(5100, 5200):
        if candidate in reserved_ports:
            continue
        if not _is_port_listening(candidate) and _can_bind_port(candidate, bind_host):
            return candidate

    return _allocate_ephemeral_port(bind_host)


def _resolve_repo_python(repo_path: str) -> str:
    base = Path(repo_path)
    for venv_dir in (".venv", "venv", "env"):
        cand_unix = base / venv_dir / "bin" / "python"
        if cand_unix.exists():
            return cand_unix.as_posix()
        cand_win = base / venv_dir / "Scripts" / "python.exe"
        if cand_win.exists():
            return cand_win.as_posix()
    return sys.executable
def _detect_repo_mode(ctx, repo_dir: str, repo_path: str, serve_dir: str = ".") -> tuple:
    base = Path(repo_path).resolve()
    clean_sub = (serve_dir or ".").strip().strip("/")
    target_dir = (base / clean_sub).resolve() if clean_sub and clean_sub != "." else base
    if not target_dir.exists() or not is_subpath(target_dir, base):
        target_dir = base
        clean_sub = ""
    for hugo_cfg in ("hugo.toml", "hugo.yaml", "hugo.yml", "hugo.json"):
        if (target_dir / hugo_cfg).exists() or (base / hugo_cfg).exists():
            return "hugo", ""
    for d in (target_dir, base):
        has_legacy_cfg = any((d / c).exists() for c in ("config.toml", "config.yaml", "config.yml", "config.json")) or (d / "config" / "_default").is_dir()
        has_hugo_dirs = (d / "archetypes").is_dir() or ((d / "content").is_dir() and ((d / "layouts").is_dir() or (d / "themes").is_dir()))
        if has_legacy_cfg and has_hugo_dirs:
            return "hugo", ""
    if (target_dir / "mkdocs.yml").exists() or (base / "mkdocs.yml").exists():
        return "mkdocs", ""
    if (target_dir / ".storybook").is_dir() or (base / ".storybook").is_dir():
        return "storybook", ""
    for vite_cfg in ("vite.config.js", "vite.config.ts", "vite.config.mjs", "vite.config.cjs"):
        if (target_dir / vite_cfg).exists() or (base / vite_cfg).exists():
            return "vite", ""
    if (target_dir / "manage.py").exists() or (base / "manage.py").exists():
        return "django", "manage.py"
    if (target_dir / "streamlit_app.py").exists():
        return "streamlit", "streamlit_app.py"

    py_candidates = [
        ("core/main.py", "core.main:app"),
        ("app/main.py", "app.main:app"),
        ("main.py", "main:app"),
        ("app.py", "app:app"),
        ("wsgi.py", "wsgi:app")
    ]
    for rel_file, mod_target in py_candidates:
        fp = target_dir / rel_file
        if fp.exists() and fp.is_file():
            try:
                vfs_rel = f"{clean_sub}/{rel_file}".strip("/") if clean_sub else rel_file
                vfs_uri = f"vfs://{repo_dir}/{vfs_rel}"
                raw_text = ctx.vfs.read(vfs_uri) or ""
                head = raw_text[:8192]
                if "streamlit" in head:
                    return "streamlit", rel_file
                if "gradio" in head:
                    return "gradio", rel_file
                if "marimo" in head:
                    return "marimo", rel_file
                if any(fw in head for fw in ("FastAPI", "Starlette", "Litestar", "Quart")):
                    return "uvicorn", mod_target
                if "Flask(" in head:
                    return "flask", rel_file.replace(".py", "")
            except Exception:
                pass

    return "static", ""
def _build_launch_command(
    ctx,
    repo_dir: str,
    repo_path: str,
    effective_mode: str,
    serve_dir: str,
    port: int,
    bind_host: str,
    entry_target: str,
    static_cors: bool = False,
    access_token: Optional[str] = None,
) -> tuple:
    base = Path(repo_path).resolve()
    clean_sub = (serve_dir or ".").strip().strip("/")
    work_dir = (base / clean_sub).resolve() if clean_sub and clean_sub != "." else base
    if not work_dir.exists() or not work_dir.is_dir() or not is_subpath(work_dir, base):
        work_dir = base

    py_bin = _resolve_repo_python(repo_path)
    _, inferred_target = _detect_repo_mode(ctx, repo_dir, repo_path, serve_dir=clean_sub)
    target = (entry_target or "").strip() or inferred_target

    env = os.environ.copy()
    env["PORT"] = str(port)
    env["HOST"] = str(bind_host)
    env["BROWSER"] = "none"
    env["PYTHONUNBUFFERED"] = "1"

    cors_flag = "1" if static_cors else "0"
    if effective_mode == "static":
        cmd = [py_bin, "-c", _STATIC_SERVER_SCRIPT, str(port), bind_host, work_dir.as_posix(), cors_flag]
        return cmd, base.as_posix(), env

    if effective_mode == "uvicorn":
        uv_target = target or "main:app"
        cmd = [py_bin, "-m", "uvicorn", uv_target, "--reload", "--host", bind_host, "--port", str(port)]
        return cmd, work_dir.as_posix(), env

    if effective_mode == "flask":
        fl_target = target or "app"
        cmd = [py_bin, "-m", "flask", "--app", fl_target, "run", "--reload", "--host", bind_host, "--port", str(port)]
        return cmd, work_dir.as_posix(), env

    if effective_mode == "django":
        dj_target = target or "manage.py"
        cmd = [py_bin, dj_target, "runserver", f"{bind_host}:{port}"]
        return cmd, work_dir.as_posix(), env

    if effective_mode == "streamlit":
        st_target = target or "app.py"
        cmd = [
            py_bin, "-m", "streamlit", "run", st_target,
            "--server.port", str(port),
            "--server.address", bind_host,
            "--server.headless", "true",
            "--server.enableCORS", "false",
            "--server.enableXsrfProtection", "false"
        ]
        return cmd, work_dir.as_posix(), env
    if effective_mode == "gradio":
        gr_target = target or "app.py"
        env["GRADIO_SERVER_NAME"] = str(bind_host)
        env["GRADIO_SERVER_PORT"] = str(port)
        venv_gradio = Path(py_bin).parent / ("gradio.exe" if os.name == "nt" else "gradio")
        gradio_bin = venv_gradio.as_posix() if venv_gradio.exists() else shutil.which("gradio")
        cmd = [gradio_bin, gr_target] if gradio_bin else [py_bin, gr_target]
        return cmd, work_dir.as_posix(), env

    if effective_mode == "marimo":
        mm_target = target or "notebook.py"
        # Edit mode runs code from the browser, so it always needs a token (never --no-token).
        cmd = [py_bin, "-m", "marimo", "edit", mm_target, "--host", bind_host, "--port", str(port), "--headless", "--token-password", access_token or secrets.token_urlsafe(18)]
        return cmd, work_dir.as_posix(), env

    if effective_mode == "vite":
        cmd = ["npx", "vite", "--host", bind_host, "--port", str(port), "--strictPort"]
        return cmd, work_dir.as_posix(), env

    if effective_mode == "storybook":
        cmd = ["npx", "storybook", "dev", "-p", str(port), "--host", bind_host, "--ci"]
        return cmd, work_dir.as_posix(), env
    if effective_mode == "mkdocs":
        cmd = [py_bin, "-m", "mkdocs", "serve", "--dev-addr", f"{bind_host}:{port}"]
        return cmd, work_dir.as_posix(), env

    if effective_mode == "hugo":
        hugo_bin = shutil.which("hugo") or "hugo"
        cmd = [hugo_bin, "server", "-D", "--bind", bind_host, "--port", str(port)]
        if target:
            cmd.extend(shlex.split(target))
        return cmd, work_dir.as_posix(), env

    if effective_mode == "custom":
        if not target:
            raise ValueError("Custom server mode requires a non-empty 'Entry Target / Custom Command'.")
        formatted = target.replace("{port}", str(port)).replace("{host}", str(bind_host))
        cmd = shlex.split(formatted)
        return cmd, work_dir.as_posix(), env

    cmd = [py_bin, "-c", _STATIC_SERVER_SCRIPT, str(port), bind_host, work_dir.as_posix(), cors_flag]
    return cmd, base.as_posix(), env


def _bind_tailscale_https(port: int, enable: bool, log_deque: deque):
    """Delegates Tailscale Serve binding to the core Remote Access module and records the outcome."""
    if not port or port <= 0:
        return
    ok, message = set_tailscale_https_serve(port, enable)
    if enable:
        log_deque.append(f"[Tailscale] {message}" if ok else f"[Tailscale Warning] Failed to bind HTTPS on {port}: {message}")
    elif not ok:
        log_deque.append(f"[Tailscale Warning] {message}")


def _terminate_server_entry(entry: Dict[str, Any]):
    if not entry:
        return
    proc = entry.get("proc")
    port = entry.get("port")
    tailscale_https = entry.get("tailscale_https", False)
    logs = entry.get("logs")
    lease_timer = (entry.get("lan_lease") or {}).get("timer")
    if lease_timer is not None:
        lease_timer.cancel()

    if proc and proc.poll() is None:
        try:
            pgid = os.getpgid(proc.pid)
            os.killpg(pgid, signal.SIGTERM)
            try:
                proc.wait(timeout=2.0)
            except subprocess.TimeoutExpired:
                os.killpg(pgid, signal.SIGKILL)
        except Exception:
            try:
                proc.terminate()
                proc.wait(timeout=1.0)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass

    if tailscale_https and port:
        _bind_tailscale_https(int(port), False, logs if logs is not None else deque(maxlen=10))


def _get_repo_status_snapshot(ctx, repo_dir: str) -> Dict[str, Any]:
    repo_path = get_repo_path(repo_dir, ctx.workspace_id)
    cfg_all = ctx.settings.get_all(repo=repo_dir)
    configured_mode = cfg_all.get("server_mode") or "auto"
    serve_dir = cfg_all.get("serve_dir") or "."
    configured_port = int(cfg_all.get("port") or 0)
    bind_host = cfg_all.get("bind_host") or LOOPBACK_HOST
    entry_target = cfg_all.get("entry_target") or ""
    auto_start = bool(cfg_all.get("auto_start", False))
    tailscale_https = bool(cfg_all.get("tailscale_https", False))
    detected_mode, inferred_target = _detect_repo_mode(ctx, repo_dir, repo_path, serve_dir=serve_dir) if Path(repo_path).exists() else ("static", "")
    effective_mode = detected_mode if configured_mode == "auto" else configured_mode

    key = (ctx.workspace_id, repo_dir)
    status = "stopped"
    active_port = configured_port
    pid = None
    recent_logs: List[str] = []
    effective_bind = LOOPBACK_HOST
    lease_until = None
    lease_duration = None
    access_token = None
    running_tailscale = tailscale_https

    with _REGISTRY_LOCK:
        entry = _PROCESS_REGISTRY.get(key)
        if entry:
            proc = entry.get("proc")
            active_port = int(entry.get("port") or configured_port or 0)
            recent_logs = list(entry.get("logs", []))
            effective_bind = entry.get("bind_host") or LOOPBACK_HOST
            lease = entry.get("lan_lease") or {}
            lease_until = lease.get("until")
            lease_duration = lease.get("duration")
            access_token = entry.get("access_token")
            running_tailscale = bool(entry.get("tailscale_https", tailscale_https))
            if proc and proc.poll() is None:
                status = "running"
                pid = proc.pid
            else:
                exit_code = proc.poll() if proc else None
                status = "crashed" if exit_code not in (None, 0, -signal.SIGTERM, -signal.SIGKILL) else "stopped"

    if status == "stopped" and active_port > 0 and _is_port_listening(active_port):
        status = "external"
    if status != "running":
        effective_bind, lease_until, lease_duration, access_token = LOOPBACK_HOST, None, None, None
    exposure = "lan" if effective_bind == LAN_HOST else ("tailnet" if running_tailscale else "loopback")

    return {
        "repo": repo_dir,
        "status": status,
        "port": active_port,
        "pid": pid,
        "server_mode": configured_mode,
        "effective_mode": effective_mode,
        "detected_mode": detected_mode,
        "inferred_target": inferred_target,
        "serve_dir": serve_dir,
        "bind_host": bind_host,
        "effective_bind_host": effective_bind,
        "exposure": exposure,
        "lan_lease_until": lease_until,
        "lan_lease_duration": lease_duration,
        "lan_allowed": bind_host == LAN_HOST,
        "access_token": access_token,
        "entry_target": entry_target,
        "auto_start": auto_start,
        "tailscale_https": tailscale_https,
        "logs": recent_logs[-50:]
    }
def start_repo_server(ctx, repo_dir: str, overrides: Optional[Dict[str, Any]] = None, lan_lease: Optional[str] = None) -> Dict[str, Any]:
    """
    Starts or restarts a repository's server. It binds loopback unless lan_lease names a duration in
    LAN_LEASE_DURATIONS, which only the human-only preview.open_lan route passes (S2). Auto-start
    and every other caller therefore always get loopback.
    """
    overrides = overrides or {}
    _validate_overrides(overrides)
    if lan_lease is not None and lan_lease not in LAN_LEASE_DURATIONS:
        raise ValueError(f"LAN lease duration must be one of {', '.join(LAN_LEASE_DURATIONS)}.")
    repo_path = get_repo_path(repo_dir, ctx.workspace_id)
    if not repo_path or not Path(repo_path).exists():
        raise ValueError(f"Repository path not found for '{repo_dir}'.")

    # Persist any explicit configuration overrides (except auto_start unless explicitly passed)
    settings_to_persist = {}
    for k in ("server_mode", "serve_dir", "port", "bind_host", "entry_target", "tailscale_https", "auto_start", "static_cors"):
        if k in overrides and overrides[k] is not None:
            settings_to_persist[k] = overrides[k]

    if settings_to_persist:
        ctx.settings.update(settings_to_persist, repo=repo_dir)

    cfg = ctx.settings.get_all(repo=repo_dir)
    configured_mode = cfg.get("server_mode") or "auto"
    serve_dir = cfg.get("serve_dir") or "."
    port = int(cfg.get("port") or 0)
    lan_allowed = (cfg.get("bind_host") or LOOPBACK_HOST) == LAN_HOST
    if lan_lease is not None and not lan_allowed:
        raise ValueError(f"'{repo_dir}' is set to loopback only. Set Bind Host to 0.0.0.0 to allow opening it to the LAN.")
    bind_host = LAN_HOST if lan_lease is not None else LOOPBACK_HOST
    entry_target = cfg.get("entry_target") or ""
    tailscale_https = bool(cfg.get("tailscale_https", False))
    static_cors = bool(cfg.get("static_cors", False))

    # Approval is checked at launch, so a command saved through any settings path still needs a person's approval.
    detected_mode, inferred_target = _detect_repo_mode(ctx, repo_dir, repo_path, serve_dir=serve_dir)
    effective_mode = detected_mode if configured_mode == "auto" else configured_mode
    pending = _approval_command_for(effective_mode, entry_target.strip() or (inferred_target if effective_mode == "hugo" else ""))
    if pending and not is_command_approved(ctx.workspace_id, APPROVAL_KIND, repo_dir, pending):
        raise PreviewApprovalRequired(repo_dir, pending)

    key = (ctx.workspace_id, repo_dir)
    with _REGISTRY_LOCK:
        existing = _PROCESS_REGISTRY.pop(key, None)
    if existing:
        _terminate_server_entry(existing)

    # Allocate sticky port if unconfigured (0) and persist back to repo.settings.json
    if port <= 0:
        port = _allocate_free_port(ctx, repo_dir, bind_host=bind_host)
        ctx.settings.set("port", port, repo=repo_dir)

    # If an external process is already listening on this port, adopt it without colliding
    if _is_port_listening(port):
        snapshot = _get_repo_status_snapshot(ctx, repo_dir)
        snapshot["status"] = "external"
        return snapshot

    access_token = secrets.token_urlsafe(18) if effective_mode == "marimo" else None
    cmd, cwd_path, env = _build_launch_command(
        ctx=ctx,
        repo_dir=repo_dir,
        repo_path=repo_path,
        effective_mode=effective_mode,
        serve_dir=serve_dir,
        port=port,
        bind_host=bind_host,
        entry_target=entry_target,
        static_cors=static_cors,
        access_token=access_token,
    )

    log_deque: deque = deque(maxlen=200)
    shown_cmd = [("<token>" if access_token and part == access_token else part) for part in cmd]
    log_deque.append(f"[$] ({cwd_path}) {' '.join(shown_cmd)}")
    if lan_lease is not None:
        span = "until this server stops" if LAN_LEASE_DURATIONS[lan_lease] is None else f"for {lan_lease}"
        log_deque.append(f"[Preview] Opened to the LAN on {LAN_HOST}:{port} {span} at a person's request.")

    proc = ctx.exec.popen(
        cmd,
        cwd=cwd_path,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        start_new_session=True
    )

    def _stream_logs(p, buf, secret):
        try:
            for line in iter(p.stdout.readline, ''):
                if not line:
                    break
                clean = line.rstrip('\r\n')
                if secret:
                    clean = clean.replace(secret, "<token>")  # marimo prints its access token in the startup URL.
                buf.append(clean)
        except Exception:
            pass
        finally:
            try:
                p.stdout.close()
            except Exception:
                pass

    reader_thread = threading.Thread(target=_stream_logs, args=(proc, log_deque, access_token), daemon=True)
    reader_thread.start()

    entry = {
        "proc": proc,
        "port": port,
        "mode": effective_mode,
        "logs": log_deque,
        "started_at": time.time(),
        "tailscale_https": tailscale_https,
        "bind_host": bind_host,
        "access_token": access_token,
    }
    if lan_lease is not None:
        seconds = LAN_LEASE_DURATIONS[lan_lease]
        lease = {"duration": lan_lease, "granted_at": time.time(), "until": (time.time() + seconds) if seconds else None, "timer": None}
        if seconds:
            timer = threading.Timer(seconds, _expire_lan_lease, args=(ctx.workspace_id, repo_dir, entry))
            timer.daemon = True
            lease["timer"] = timer
            timer.start()
        entry["lan_lease"] = lease
    with _REGISTRY_LOCK:
        _PROCESS_REGISTRY[key] = entry

    # 1.5-second readiness & early crash probe (15 x 100ms)
    for _ in range(15):
        if proc.poll() is not None:
            break
        if _is_port_listening(port):
            break
        time.sleep(0.1)

    if proc.poll() is None and tailscale_https:
        _bind_tailscale_https(port, True, log_deque)

    return _get_repo_status_snapshot(ctx, repo_dir)


def _expire_lan_lease(workspace_id: str, repo_dir: str, entry: Dict[str, Any]) -> None:
    """Timer callback: when a timed LAN lease ends, restart that same server run on loopback."""
    with _REGISTRY_LOCK:
        if _PROCESS_REGISTRY.get((workspace_id, repo_dir)) is not entry:
            return  # The server was restarted or stopped since; that already ended the lease.
    try:
        ctx = preview_bp.get_context(workspace_id)
        snapshot = start_repo_server(ctx, repo_dir)
        with _REGISTRY_LOCK:
            new_entry = _PROCESS_REGISTRY.get((workspace_id, repo_dir))
            if new_entry and new_entry.get("logs") is not None:
                new_entry["logs"].appendleft(f"[Preview] LAN lease ({(entry.get('lan_lease') or {}).get('duration')}) expired; restarted on loopback.")
        return snapshot
    except Exception as e:
        print(f"⚠️ [Preview] Could not return '{repo_dir}' to loopback after its LAN lease expired: {e}")
        stop_repo_server(preview_bp.get_context(workspace_id), repo_dir)


def stop_repo_server(ctx, repo_dir: str) -> Dict[str, Any]:
    key = (ctx.workspace_id, repo_dir)
    with _REGISTRY_LOCK:
        entry = _PROCESS_REGISTRY.pop(key, None)
    if entry:
        _terminate_server_entry(entry)
    return _get_repo_status_snapshot(ctx, repo_dir)
@preview_bp.on('topology_boot_complete')
def auto_boot_pinned_preview_servers(ctx, workspace_id=None, **kwargs):
    """Phase 2 Boot Hook: Spawns only repositories with explicit auto_start=True."""
    wid = ctx.workspace_id
    for repo_dir in get_sister_repos(wid):
        try:
            if ctx.settings.get("auto_start", False, repo=repo_dir):
                start_repo_server(ctx, repo_dir)
        except Exception as e:
            print(f"⚠️ [Preview] Auto-start failed for '{repo_dir}' in workspace '{wid}': {e}")
@preview_bp.on('workspace_shutdown')
def cleanup_workspace_preview_servers(workspace_id=None, **kwargs):
    if not workspace_id:
        return
    to_stop = []
    with _REGISTRY_LOCK:
        for (ws_id, r_dir) in list(_PROCESS_REGISTRY.keys()):
            if ws_id == workspace_id:
                to_stop.append(_PROCESS_REGISTRY.pop((ws_id, r_dir)))
    for entry in to_stop:
        _terminate_server_entry(entry)
@preview_bp.on('system_shutdown')
def cleanup_all_preview_servers(**kwargs):
    with _REGISTRY_LOCK:
        entries = list(_PROCESS_REGISTRY.values())
        _PROCESS_REGISTRY.clear()
    for entry in entries:
        _terminate_server_entry(entry)


class PreviewStartPayload(TypedDict, total=False):
    repo: str
    server_mode: str
    serve_dir: str
    port: int
    bind_host: str
    entry_target: str
    tailscale_https: bool
    auto_start: bool


class PreviewRepoTargetPayload(TypedDict):
    repo: str


class PreviewOpenLanPayload(TypedDict, total=False):
    repo: str
    duration: str


class PreviewApproveCommandPayload(TypedDict):
    repo: str
    command: str


def _approval_required_response(err: PreviewApprovalRequired):
    return {
        "status": "needs_approval",
        "repo": err.repo,
        "command": err.command,
        "error": f"This custom command has not been approved: {err.command}. A person must approve it in the Preview tab before it can run.",
    }, 403
@preview_bp.route('status', methods=['GET'], docstring="[sync] Passively inspects server status, sticky ports, and detected modes across all workspace repositories without spawning processes.")
def api_preview_status(ctx):
    """Passively inspects server status, sticky ports, and detected modes across all workspace repositories."""
    req_repo = str(ctx.payload.get('repo') or '').strip()
    repos = [req_repo] if req_repo else get_sister_repos(ctx.workspace_id)
    servers = {}
    for r_dir in repos:
        if r_dir:
            servers[r_dir] = _get_repo_status_snapshot(ctx, r_dir)
    return {"servers": servers}


@preview_bp.route('start', methods=['POST'], request_schema=PreviewStartPayload, docstring="[sync] Starts or restarts a managed development server for a target repository and returns its status and sticky port.")
def api_preview_start(ctx):
    """Starts or restarts a managed development server for a target repository."""
    data = ctx.payload or {}
    repo_dir = str(data.get("repo") or "").strip()
    if not repo_dir:
        return {"error": "Repository name ('repo') is required."}, 400
    try:
        snapshot = start_repo_server(ctx, repo_dir, overrides=data)
        return {"status": "success", "server": snapshot}
    except PreviewApprovalRequired as e:
        return _approval_required_response(e)
    except Exception as e:
        return {"error": str(e)}, 400


@preview_bp.route('open_lan', methods=['POST'], request_schema=PreviewOpenLanPayload, mcp_expose=False, docstring="[sync] Restarts a repository's server bound to 0.0.0.0 for the current run ('run') or a limited time ('15m', '1h', '8h'). Human-only: hidden from MCP and banned in routines (S2).")
def api_preview_open_lan(ctx):
    """Restarts a repository's server on 0.0.0.0 under a LAN lease a person grants."""
    data = ctx.payload or {}
    repo_dir = str(data.get("repo") or "").strip()
    duration = str(data.get("duration") or "run").strip()
    if not repo_dir:
        return {"error": "Repository name ('repo') is required."}, 400
    try:
        return {"status": "success", "server": start_repo_server(ctx, repo_dir, lan_lease=duration)}
    except PreviewApprovalRequired as e:
        return _approval_required_response(e)
    except Exception as e:
        return {"error": str(e)}, 400


@preview_bp.route('close_lan', methods=['POST'], request_schema=PreviewRepoTargetPayload, docstring="[sync] Ends a repository's LAN lease early by restarting its server on loopback.")
def api_preview_close_lan(ctx):
    """Ends a repository's LAN lease early by restarting its server on loopback."""
    data = ctx.payload or {}
    repo_dir = str(data.get("repo") or "").strip()
    if not repo_dir:
        return {"error": "Repository name ('repo') is required."}, 400
    try:
        return {"status": "success", "server": start_repo_server(ctx, repo_dir)}
    except PreviewApprovalRequired as e:
        return _approval_required_response(e)
    except Exception as e:
        return {"error": str(e)}, 400


@preview_bp.route('approve_command', methods=['POST'], request_schema=PreviewApproveCommandPayload, mcp_expose=False, docstring="[sync] Records a person's approval of a repository's custom preview command. Human-only: hidden from MCP and banned in routines (P5).")
def api_preview_approve_command(ctx):
    """Records a person's approval of one exact custom preview command for a repository."""
    data = ctx.payload or {}
    repo_dir = str(data.get("repo") or "").strip()
    command = str(data.get("command") or "").strip()
    if not repo_dir or not command:
        return {"error": "Both 'repo' and 'command' are required."}, 400
    if repo_dir not in get_sister_repos(ctx.workspace_id):
        return {"error": f"Unknown repository '{repo_dir}'."}, 400
    return {"status": "approved", "repo": repo_dir, "command": command, "signature": approve_command(ctx.workspace_id, APPROVAL_KIND, repo_dir, command)}


@preview_bp.route('stop', methods=['POST'], request_schema=PreviewRepoTargetPayload, docstring="[sync] Terminates a running development server process group for a target repository.")
def api_preview_stop(ctx):
    """Terminates a running development server process group for a target repository."""
    data = ctx.payload or {}
    repo_dir = str(data.get("repo") or "").strip()
    if not repo_dir:
        return {"error": "Repository name ('repo') is required."}, 400
    snapshot = stop_repo_server(ctx, repo_dir)
    return {"status": "success", "server": snapshot}


@preview_bp.route('logs', methods=['GET'], request_schema=PreviewRepoTargetPayload, docstring="[sync] Returns buffered stdout/stderr lines for a repository's managed preview server.")
def api_preview_logs(ctx):
    """Returns buffered stdout/stderr lines for a repository's managed preview server."""
    repo_dir = str(ctx.payload.get("repo") or "").strip()
    if not repo_dir:
        return {"error": "Repository parameter ('repo') is required."}, 400
    snapshot = _get_repo_status_snapshot(ctx, repo_dir)
    key = (ctx.workspace_id, repo_dir)
    with _REGISTRY_LOCK:
        entry = _PROCESS_REGISTRY.get(key)
        full_logs = list(entry.get("logs", [])) if entry else []
    return {
        "repo": repo_dir,
        "status": snapshot["status"],
        "port": snapshot["port"],
        "logs": full_logs
    }