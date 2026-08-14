import os
import sys
import json
import shutil
import subprocess
from pathlib import Path
def handle_service(action, cwd):
    """Manages the background systemd daemon for inSetu."""
    # Inject XDG_RUNTIME_DIR to prevent D-Bus "No medium found" errors over SSH/WSL
    if "XDG_RUNTIME_DIR" not in os.environ and hasattr(os, 'getuid'):
        os.environ["XDG_RUNTIME_DIR"] = f"/run/user/{os.getuid()}"

    service_name = "insetu.service"
    systemd_user_dir = Path.home() / ".config" / "systemd" / "user"
    service_file = systemd_user_dir / service_name

    if action == "install":
        insetu_bin = shutil.which("insetu")
        if not insetu_bin:
            print("❌ Error: Could not resolve the absolute path to the 'insetu' executable.")
            return

        systemd_user_dir.mkdir(parents=True, exist_ok=True)

        # Dynamically generate the systemd unit file
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

        print(f"⚙️  Installing systemd service at {service_file}...")
        subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
        subprocess.run(["systemctl", "--user", "enable", service_name], check=True)
        subprocess.run(["systemctl", "--user", "start", service_name], check=True)

        from insetu.kernel.utils import load_config
        cfg = load_config()
        port = int(os.environ.get("INSETU_PORT", cfg.get("port", 5005)))

        print(f"✅ inSetu daemon installed and anchored to: {cwd} (Port {port})")
        print(f"👉 Local Access URL: http://127.0.0.1:{port}")
        print("👉 You can now close this terminal. Check status anytime with: insetu service status")

    elif action == "uninstall":
        if service_file.exists():
            print("🛑 Stopping and disabling inSetu daemon...")
            subprocess.run(["systemctl", "--user", "stop", service_name])
            subprocess.run(["systemctl", "--user", "disable", service_name])
            service_file.unlink()
            subprocess.run(["systemctl", "--user", "daemon-reload"])
            print("✅ inSetu service uninstalled successfully.")
        else:
            print("⚠️  No inSetu service found to uninstall.")

    elif action == "status":
        from insetu.kernel.utils import load_config
        cfg = load_config()
        port = int(os.environ.get("INSETU_PORT", cfg.get("port", 5005)))
        print(f"⚙️  inSetu Service Telemetry:")
        print(f"   ├─ Anchored Directory: {cwd}")
        print(f"   ├─ Configured Port: {port}")
        print(f"   └─ Access URL: http://127.0.0.1:{port}\n")
        subprocess.run(["systemctl", "--user", "status", service_name])

    elif action in ["start", "stop", "restart"]:
        subprocess.run(["systemctl", "--user", action, service_name])
    else:
        print(f"❌ Unknown service action: {action}. Use install|uninstall|start|stop|restart|status.")
def scaffold_extension(ext_name):
    import re
    if not re.match(r'^[a-z0-9_]+$', ext_name):
        print("❌ Error: Extension name must be lowercase, alphanumeric, and underscores only.")
        return

    script_dir = Path(__file__).resolve().parent
    ext_dir = script_dir / "extensions" / ext_name

    if ext_dir.exists():
        print(f"❌ Error: Extension '{ext_name}' already exists.")
        return

    ext_dir.mkdir(parents=True, exist_ok=True)
    
    # __init__.py
    (ext_dir / "__init__.py").write_text("")
    
    # vendor.json
    (ext_dir / "vendor.json").write_text('{\n    "imports": {},\n    "python": {}\n}\n')

    cap_name = "".join(word.capitalize() for word in ext_name.split('_'))

    defaults_dir = script_dir / "defaults"
    
    # Read and interpolate engine_template_py.txt
    engine_tpl = defaults_dir / "engine_template_py.txt"
    if engine_tpl.exists():
        engine_code = engine_tpl.read_text(encoding="utf-8")
        engine_code = engine_code.replace("{{ext_name}}", ext_name).replace("{{cap_name}}", cap_name)
        (ext_dir / f"engine_{ext_name}.py").write_text(engine_code, encoding="utf-8")
    else:
        print("⚠️ Warning: engine_template_py.txt not found in defaults.")

    # Read and interpolate ext_template_js.txt
    js_tpl = defaults_dir / "ext_template_js.txt"
    if js_tpl.exists():
        js_code = js_tpl.read_text(encoding="utf-8")
        js_code = js_code.replace("{{ext_name}}", ext_name).replace("{{cap_name}}", cap_name)
        (ext_dir / f"ext_{ext_name}.js").write_text(js_code, encoding="utf-8")
    else:
        print("⚠️ Warning: ext_template_js.txt not found in defaults.")
    
    print(f"✅ Successfully scaffolded '{ext_name}' at {ext_dir.as_posix()}")
    print("👉 Next Steps:")
    print(f"1. Enable '{ext_name}' in your workspace config.json")
    print(f"2. Restart the daemon to mount the new routes.")

def scaffold_profiles(cwd):
    base_dir = Path(cwd).joinpath(".insetu").as_posix()
    is_new_hub = not os.path.exists(base_dir)
    os.makedirs(base_dir, exist_ok=True)
  
    script_dir = Path(__file__).resolve().parent.as_posix()
    defaults_dir = Path(script_dir).joinpath("defaults").as_posix()
    
    # Scaffold the default config
    target_config = Path(base_dir).joinpath("config.json").as_posix()
    if not os.path.exists(target_config):
        src_config = Path(defaults_dir).joinpath("config_json.txt").as_posix()
        if os.path.exists(src_config):
            shutil.copy(src_config, target_config)

    # Scaffold workflows
    target_workflows = Path(base_dir).joinpath("workflows.json").as_posix()
    if not os.path.exists(target_workflows):
        with open(target_workflows, "w", encoding="utf-8") as f:
            json.dump({"context_batches": []}, f, indent=2)

    # Scaffold the Tier 1 OS config locally
    target_sys = Path(base_dir).joinpath("system.json").as_posix()
    if not os.path.exists(target_sys):
        src_sys = Path(defaults_dir).joinpath("system_json.txt").as_posix()
        if os.path.exists(src_sys):
            shutil.copy(src_sys, target_sys)
            
    # Scaffold the Git safeguard
    target_gitignore = Path(base_dir).joinpath(".gitignore").as_posix()
    if not os.path.exists(target_gitignore):
        src_gitignore = Path(defaults_dir).joinpath("gitignore.txt").as_posix()
        if os.path.exists(src_gitignore):
            shutil.copy(src_gitignore, target_gitignore)

    if is_new_hub:
        print(f"[*] Initialized local inSetu environment at {base_dir}")
def main():
    if len(sys.argv) < 2:
        print("Usage: insetu [serve | service | create-extension]")
        sys.exit(1)

    command = sys.argv[1]
    cwd = os.getcwd()
    
    if command == "create-extension":
        if len(sys.argv) < 3:
            print("Usage: insetu create-extension <extension_name>")
            sys.exit(1)
        scaffold_extension(sys.argv[2])
        
    elif command == "serve":
        scaffold_profiles(cwd)
        # The Immutable Recovery Bootloader
        try:
            # Import after scaffolding to ensure paths resolve correctly
            from insetu.app import run_app
            run_app()
        except Exception as e:
            import traceback
            err_details = traceback.format_exc()
            print(f"\n[!] KERNEL PANIC: {type(e).__name__} detected during boot.")
            print(f"[!] Details:\n{err_details}")
            print("[!] Booting Immutable Recovery OS (Lifeboat FS)...")
            os.environ["INSETU_PANIC_DETAILS"] = err_details
            from insetu.kernel.fallback_bridge import run_recovery_app
            run_recovery_app()
    elif command == "service":
        if len(sys.argv) < 3:
            print("Usage: insetu service [install | uninstall | start | stop | restart | status]")
            sys.exit(1)

        # Scaffold the profiles just in case they run install on a fresh directory
        if sys.argv[2] == "install":
            scaffold_profiles(cwd)

        handle_service(sys.argv[2], cwd)
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    main()