import os
import re
import sys
import json
import shutil
import getpass
import threading
import subprocess
import urllib.request
from pathlib import Path


def scaffold_profiles(cwd):
    """Ensures baseline .insetu control directory and default configuration files exist."""
    base_dir = Path(cwd).joinpath(".insetu").as_posix()
    is_new_hub = not os.path.exists(base_dir)
    os.makedirs(base_dir, exist_ok=True)

    defaults_dir = Path(__file__).resolve().parent.parent.parent.joinpath("defaults").as_posix()

    target_config = Path(base_dir).joinpath("config.json").as_posix()
    if not os.path.exists(target_config):
        src_config = Path(defaults_dir).joinpath("config_json.txt").as_posix()
        if os.path.exists(src_config):
            shutil.copy(src_config, target_config)

    target_workflows = Path(base_dir).joinpath("workflows.json").as_posix()
    if not os.path.exists(target_workflows):
        with open(target_workflows, "w", encoding="utf-8") as f:
            json.dump({"context_batches": []}, f, indent=2)

    target_sys = Path(base_dir).joinpath("system.json").as_posix()
    if not os.path.exists(target_sys):
        src_sys = Path(defaults_dir).joinpath("system_json.txt").as_posix()
        if os.path.exists(src_sys):
            shutil.copy(src_sys, target_sys)

    target_gitignore = Path(base_dir).joinpath(".gitignore").as_posix()
    if not os.path.exists(target_gitignore):
        src_gitignore = Path(defaults_dir).joinpath("gitignore.txt").as_posix()
        if os.path.exists(src_gitignore):
            shutil.copy(src_gitignore, target_gitignore)

    if is_new_hub:
        print(f"[*] Initialized local inSetu environment at {base_dir}")
def _discover_candidate_repos(cwd):
    """Scans the current directory for candidate repositories to track."""
    from insetu.core.utils_core import get_default_repo_template as _get_default_repo_template
    cwd_path = Path(cwd).resolve()
    ignore_names = {
        'venv', '.venv', 'env', 'node_modules', '__pycache__',
        'dist', 'build', 'docs', 'tests', 'test', 'static', 'templates'
    }
    candidates = []

    # 1. Scan immediate subdirectories for explicit Git repositories first
    for item in sorted(cwd_path.iterdir()):
        if not item.is_dir() or item.name.startswith('.') or item.name in ignore_names:
            continue
        if (item / ".git").exists():
            candidates.append(_get_default_repo_template(item.name))

    # 2. If the root directory itself is a Git repo and has no sub-repos, track the root repo
    if not candidates and (cwd_path / ".git").exists():
        tpl = _get_default_repo_template(cwd_path.name)
        tpl["physical_path"] = cwd_path.as_posix()
        candidates.append(tpl)
        return candidates

    # 3. If neither root nor subdirectories have .git, look for code folders in a multi-folder hub
    if not candidates:
        for item in sorted(cwd_path.iterdir()):
            if not item.is_dir() or item.name.startswith('.') or item.name in ignore_names:
                continue
            if any(item.glob("*.py")) or any(item.glob("*.js")) or any(item.glob("*.md")):
                candidates.append(_get_default_repo_template(item.name))

    return candidates


def _discover_available_extensions():
    """Returns a sorted list of bundled extension IDs."""
    ext_dir = Path(__file__).resolve().parent.parent.parent / "extensions"
    if not ext_dir.exists():
        return []
    return sorted([
        item.name for item in ext_dir.iterdir()
        if item.is_dir() and not item.name.startswith("__") and (item / f"engine_{item.name}.py").exists()
    ])
def _ensure_root_gitignore(target_cwd):
    """Ensures .insetu/ is ignored if the workspace root itself is a Git repository."""
    git_dir = Path(target_cwd) / ".git"
    if not git_dir.exists():
        return
    gitignore_path = Path(target_cwd) / ".gitignore"
    try:
        if gitignore_path.exists():
            content = gitignore_path.read_text(encoding="utf-8")
            lines = [line.strip() for line in content.splitlines()]
            if ".insetu" not in lines and ".insetu/" not in lines:
                sep = "\n" if content and not content.endswith("\n") else ""
                gitignore_path.write_text(f"{content}{sep}\n# inSetu Control Plane\n.insetu/\n", encoding="utf-8")
        else:
            gitignore_path.write_text("# inSetu Control Plane\n.insetu/\n", encoding="utf-8")
    except Exception:
        pass
def _ensure_master_key_on_disk():
    """Synchronously ensures the global master_key.txt exists on disk before CLI encryption."""
    from cryptography.fernet import Fernet as _Fernet
    control_dir_name = os.environ.get("AKASA_CONTROL_DIR", ".insetu")
    global_key_path = Path.home().joinpath(control_dir_name, "master_key.txt")
    local_key_path = Path(os.getcwd()).joinpath(control_dir_name, "master_key.txt")

    if local_key_path.exists() and local_key_path.stat().st_size > 0:
        if not global_key_path.exists():
            global_key_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(local_key_path.as_posix(), global_key_path.as_posix())
        return

    if not global_key_path.exists() or global_key_path.stat().st_size == 0:
        global_key_path.parent.mkdir(parents=True, exist_ok=True)
        key = _Fernet.generate_key()
        global_key_path.write_bytes(key)


def handle_init(cwd, args):
    """Interactive and headless onboarding wizard for initializing an inSetu workspace."""
    auto_yes = "-y" in args or "--yes" in args
    force = "-f" in args or "--force" in args
    positional = [a for a in args if not a.startswith("-")]
    if positional:
        target_cwd = Path(positional[0]).expanduser().resolve()
        target_cwd.mkdir(parents=True, exist_ok=True)
        cwd = target_cwd.as_posix()
        os.chdir(cwd)
        import akasa.utils as _akasa_utils
        _akasa_utils._cwd = cwd

    base_dir = Path(cwd).joinpath(".insetu")
    config_path = base_dir.joinpath("config.json")
    cwd_name = Path(cwd).resolve().name

    print("\n============================================================")
    print("inSetu Developer OS — Workspace Initialization Wizard")
    print("============================================================\n")

    if config_path.exists() and not force:
        if auto_yes:
            print(f"[*] Workspace already initialized at {config_path.as_posix()} (use --force to overwrite).")
            return
        try:
            ans = input("Existing configuration detected at .insetu/config.json. Re-initialize? [y/N]: ").strip().lower()
            if ans not in ('y', 'yes'):
                print("Aborted initialization.")
                return
        except (EOFError, KeyboardInterrupt):
            print("\nAborted initialization.")
            return

    default_title = f"inSetu: {cwd_name}"
    default_port = 5005
    discovered_repos = _discover_candidate_repos(cwd)
    available_exts = _discover_available_extensions()
    default_exts = [e for e in ["git", "notes", "prompts", "update"] if e in available_exts]
    llm_provider = None
    llm_model = None
    llm_api_key = ""

    if auto_yes:
        title = default_title
        port = default_port
        selected_repos = discovered_repos
        selected_exts = default_exts
    else:
        try:
            inp_title = input(f"1. Workspace Title [{default_title}]: ").strip()
            title = inp_title if inp_title else default_title

            inp_port = input(f"2. Daemon Port [{default_port}]: ").strip()
            port = int(inp_port) if inp_port.isdigit() else default_port

            if discovered_repos:
                repo_names = ", ".join(r["repo_dir"] for r in discovered_repos)
                inp_repos = input(f"3. Track discovered repositories ({repo_names})? [Y/n]: ").strip().lower()
                selected_repos = [] if inp_repos in ('n', 'no') else discovered_repos
            else:
                selected_repos = []
                print("3. No subdirectories detected yet (you can add repositories anytime in the UI).")

            ext_display = ", ".join(default_exts)
            print(f"   Available extensions: {', '.join(available_exts)}")
            inp_exts = input(f"4. Enabled Extensions (comma-separated) [{ext_display}]: ").strip()
            if inp_exts:
                selected_exts = [e.strip().lower() for e in inp_exts.split(",") if e.strip().lower() in available_exts]
            else:
                selected_exts = default_exts

            inp_llm = input("5. LLM Provider (anthropic / gemini / claude_cli / skip) [skip]: ").strip().lower()
            if inp_llm in ("anthropic", "gemini", "claude_cli"):
                llm_provider = inp_llm
                default_m = "gemini-2.5-pro" if inp_llm == "gemini" else "claude-3-5-sonnet-latest"
                inp_model = input(f"   Model Name [{default_m}]: ").strip()
                llm_model = inp_model if inp_model else default_m
                if inp_llm in ("anthropic", "gemini"):
                    llm_api_key = getpass.getpass(f"   Enter {inp_llm.title()} API Key (hidden, press Enter to skip): ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nAborted initialization.")
            return

    scaffold_profiles(cwd)

    final_exts = ["config"] + [e for e in selected_exts if e != "config"]
    config_payload = {
        "instance_title": title,
        "instance_emoji": "⚙️",
        "port": port,
        "ignore_dirs": ["node_modules", "__pycache__", "venv", ".venv", ".git", ".insetu", "dist", "build"],
        "ignore_files": [".DS_Store"],
        "ignore_patterns": ["*.pyc", "*.log"],
        "include_extensions": [".py", ".js", ".ts", ".json", ".md", ".txt", ".html", ".css", ".sh", ".yaml", ".yml", ".toml"],
        "managed_dirs": [".tracker"],
        "target_repos": selected_repos,
        "extensions": final_exts
    }

    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config_payload, f, indent=2)

    sys_path = base_dir.joinpath("system.json")
    try:
        sys_data = json.loads(sys_path.read_text(encoding="utf-8")) if sys_path.exists() else {}
    except Exception:
        sys_data = {}
    sys_data["port"] = port
    if "workspaces" not in sys_data:
        sys_data["workspaces"] = {"default": {"config_path": "config.json"}}
    sys_path.write_text(json.dumps(sys_data, indent=2), encoding="utf-8")
    ws_settings_path = base_dir.joinpath("workspace.settings.json")
    try:
        ws_settings = json.loads(ws_settings_path.read_text(encoding="utf-8")) if ws_settings_path.exists() else {}
    except Exception:
        ws_settings = {}
    ws_settings.setdefault("system", {})["instance_title"] = title
    if llm_provider:
        ws_settings.setdefault("llm", {})["provider"] = llm_provider
        ws_settings["llm"]["model"] = llm_model
    ws_settings_path.write_text(json.dumps(ws_settings, indent=2), encoding="utf-8")

    _ensure_root_gitignore(cwd)

    try:
        _ensure_master_key_on_disk()
        if llm_api_key:
            from akasa.auth import encrypt_secret as _encrypt_secret
            secrets_path = base_dir.joinpath("secrets.json")
            try:
                secrets_data = json.loads(secrets_path.read_text(encoding="utf-8")) if secrets_path.exists() else {}
            except Exception:
                secrets_data = {}
            secrets_data.setdefault("llm", {})["api_key"] = _encrypt_secret(llm_api_key)
            secrets_path.write_text(json.dumps(secrets_data, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"Warning: Failed to initialize encryption key or secrets: {e}")

    print(f"\n[*] Workspace initialized at {base_dir.resolve().as_posix()}")
    print(f"    ├─ Title:      {title}")
    print(f"    ├─ Port:       {port}")
    print(f"    ├─ Repos:      {len(selected_repos)} tracked ({', '.join(r['repo_dir'] for r in selected_repos) or 'none'})")
    print(f"    └─ Extensions: {', '.join(final_exts)}")
    print("\nNext Steps:")
    print("    • Start server:          insetu serve")
    print("    • Launch desktop shell:  insetu gui")
    print("    • Install systemd unit:  insetu service install\n")


def handle_service(action, cwd):
    """Manages the background systemd daemon for inSetu."""
    if "XDG_RUNTIME_DIR" not in os.environ and hasattr(os, 'getuid'):
        os.environ["XDG_RUNTIME_DIR"] = f"/run/user/{os.getuid()}"

    service_name = "insetu.service"
    systemd_user_dir = Path.home() / ".config" / "systemd" / "user"
    service_file = systemd_user_dir / service_name

    if action == "install":
        scaffold_profiles(cwd)
        insetu_bin = shutil.which("insetu")
        if not insetu_bin:
            print("Error: Could not resolve the absolute path to the 'insetu' executable.")
            return

        systemd_user_dir.mkdir(parents=True, exist_ok=True)
        unit_content = f"""[Unit]
Description=inSetu Developer OS
After=network.target

[Service]
Type=simple
WorkingDirectory={cwd}
ExecStart={insetu_bin} serve
Restart=always
RestartSec=3
Environment="PATH={os.environ.get('PATH', '')}"
Environment="PYTHONUNBUFFERED=1"

[Install]
WantedBy=default.target
"""
        service_file.write_text(unit_content)

        print(f"Installing systemd service at {service_file}...")
        subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
        subprocess.run(["systemctl", "--user", "enable", service_name], check=True)
        subprocess.run(["systemctl", "--user", "start", service_name], check=True)

        from akasa.utils import load_config as _load_config
        cfg = _load_config()
        port = int(os.environ.get("INSETU_PORT", cfg.get("port", 5005)))

        print(f"inSetu daemon installed and anchored to: {cwd} (Port {port})")
        print(f"Local Access URL: http://127.0.0.1:{port}")
        print("You can now close this terminal. Check status anytime with: insetu service status")

    elif action == "uninstall":
        if service_file.exists():
            print("Stopping and disabling inSetu daemon...")
            subprocess.run(["systemctl", "--user", "stop", service_name])
            subprocess.run(["systemctl", "--user", "disable", service_name])
            service_file.unlink()
            subprocess.run(["systemctl", "--user", "daemon-reload"])
            print("inSetu service uninstalled successfully.")
        else:
            print("No inSetu service found to uninstall.")

    elif action == "status":
        from akasa.utils import load_config as _load_config
        cfg = _load_config()
        port = int(os.environ.get("INSETU_PORT", cfg.get("port", 5005)))
        print("inSetu Service Telemetry:")
        print(f"   ├─ Anchored Directory: {cwd}")
        print(f"   ├─ Configured Port: {port}")
        print(f"   └─ Access URL: http://127.0.0.1:{port}\n")
        subprocess.run(["systemctl", "--user", "status", service_name])

    elif action in ["start", "stop", "restart"]:
        subprocess.run(["systemctl", "--user", action, service_name])
    else:
        print(f"Unknown service action: {action}. Use install|uninstall|start|stop|restart|status.")


def scaffold_extension(ext_name):
    """Scaffolds a new bundled extension directory from default templates."""
    if not re.match(r'^[a-z0-9_]+$', ext_name):
        print("Error: Extension name must be lowercase, alphanumeric, and underscores only.")
        return

    root_dir = Path(__file__).resolve().parent.parent.parent
    ext_dir = root_dir / "extensions" / ext_name

    if ext_dir.exists():
        print(f"Error: Extension '{ext_name}' already exists.")
        return

    ext_dir.mkdir(parents=True, exist_ok=True)
    (ext_dir / "__init__.py").write_text("")
    (ext_dir / "vendor.json").write_text('{\n    "imports": {},\n    "python": {}\n}\n')

    cap_name = "".join(word.capitalize() for word in ext_name.split('_'))
    defaults_dir = root_dir / "defaults"

    engine_tpl = defaults_dir / "engine_template_py.txt"
    if engine_tpl.exists():
        engine_code = engine_tpl.read_text(encoding="utf-8")
        engine_code = engine_code.replace("{{ext_name}}", ext_name).replace("{{cap_name}}", cap_name)
        (ext_dir / f"engine_{ext_name}.py").write_text(engine_code, encoding="utf-8")
    else:
        print("Warning: engine_template_py.txt not found in defaults.")

    js_tpl = defaults_dir / "ext_template_js.txt"
    if js_tpl.exists():
        js_code = js_tpl.read_text(encoding="utf-8")
        js_code = js_code.replace("{{ext_name}}", ext_name).replace("{{cap_name}}", cap_name)
        (ext_dir / f"ext_{ext_name}.js").write_text(js_code, encoding="utf-8")
    else:
        print("Warning: ext_template_js.txt not found in defaults.")

    print(f"Successfully scaffolded '{ext_name}' at {ext_dir.as_posix()}")
    print("Next Steps:")
    print(f"1. Enable '{ext_name}' in your workspace config.json")
    print("2. Restart the daemon to mount the new routes.")


def check_daemon_alive(port):
    """Pings localhost to check if an inSetu daemon is already running."""
    url = f"http://127.0.0.1:{port}/auth/bootstrap"
    req = urllib.request.Request(
        url,
        headers={"Content-Type": "application/json"},
        data=b"{}"
    )
    try:
        with urllib.request.urlopen(req, timeout=0.8) as res:
            return res.status in (200, 401)
    except Exception:
        return False


def launch_gui(cwd):
    """Launches pywebview desktop shell, attaching to an active daemon or starting an embedded server."""
    try:
        import webview as _webview
    except ImportError:
        print("Desktop GUI requires pywebview. Install with: pip install pywebview (or pip install insetu[gui])")
        sys.exit(1)

    from akasa.utils import load_config as _load_config
    from insetu.app import run_app as _run_app

    scaffold_profiles(cwd)
    cfg = _load_config()
    port = int(os.environ.get("INSETU_PORT", cfg.get("port", 5005)))

    if check_daemon_alive(port):
        print(f"Attaching GUI to active inSetu daemon on http://127.0.0.1:{port}...")
    else:
        print(f"No active daemon detected. Booting embedded server on port {port}...")
        server_thread = threading.Thread(target=_run_app, daemon=True)
        server_thread.start()

    title = cfg.get("instance_title", "inSetu Developer OS")
    _webview.create_window(
        title=title,
        url=f"http://127.0.0.1:{port}",
        width=1280,
        height=800,
        resizable=True
    )
    _webview.start()


def create_desktop_shortcut(cwd):
    """Generates a native OS application shortcut for inSetu GUI."""
    scaffold_profiles(cwd)
    insetu_bin = shutil.which("insetu") or os.path.abspath(sys.argv[0])
    icon_path = Path(__file__).resolve().parent.parent.parent / "static" / "icon-192.png"

    if sys.platform == "linux" or sys.platform.startswith("freebsd"):
        apps_dir = Path.home() / ".local" / "share" / "applications"
        apps_dir.mkdir(parents=True, exist_ok=True)
        desktop_file = apps_dir / "insetu.desktop"

        content = f"""[Desktop Entry]
Type=Application
Name=inSetu Developer OS
Comment=inSetu Developer OS Desktop Shell
Exec={insetu_bin} gui
Icon={icon_path}
Terminal=false
Categories=Development;IDE;
Path={cwd}
"""
        desktop_file.write_text(content)
        desktop_file.chmod(0o755)
        print(f"Linux desktop shortcut generated: {desktop_file}")

    elif sys.platform == "darwin":
        apps_dir = Path.home() / "Applications"
        app_bundle = apps_dir / "inSetu Developer OS.app"
        contents_dir = app_bundle / "Contents"
        macos_dir = contents_dir / "MacOS"
        macos_dir.mkdir(parents=True, exist_ok=True)

        launcher_script = macos_dir / "inSetu"
        launcher_script.write_text(f"""#!/bin/bash
cd "{cwd}"
exec "{insetu_bin}" gui
""")
        launcher_script.chmod(0o755)

        plist_file = contents_dir / "Info.plist"
        plist_file.write_text("""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>inSetu</string>
    <key>CFBundleIdentifier</key>
    <string>dev.insetu.developer-os</string>
    <key>CFBundleName</key>
    <string>inSetu Developer OS</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>2.0.0</string>
</dict>
</plist>
""")
        print(f"macOS App bundle generated: {app_bundle}")

    elif sys.platform == "win32":
        start_menu = Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs"
        start_menu.mkdir(parents=True, exist_ok=True)
        shortcut_path = start_menu / "inSetu Developer OS.lnk"

        ps_script = f"""
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("{shortcut_path}")
$Shortcut.TargetPath = "{insetu_bin}"
$Shortcut.Arguments = "gui"
$Shortcut.WorkingDirectory = "{cwd}"
$Shortcut.Save()
"""
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], check=True)
        print(f"Windows Start Menu shortcut generated: {shortcut_path}")