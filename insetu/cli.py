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

        print(f"✅ inSetu daemon installed and anchored to: {cwd}")
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

    elif action in ["start", "stop", "restart", "status"]:
        subprocess.run(["systemctl", "--user", action, service_name])
    else:
        print(f"❌ Unknown service action: {action}. Use install|uninstall|start|stop|restart|status.")
def scaffold_profiles(cwd):
    base_dir = Path(cwd).joinpath(".insetu").as_posix()
    is_new_hub = not os.path.exists(base_dir)
    os.makedirs(base_dir, exist_ok=True)
  
    script_dir = os.path.dirname(os.path.abspath(__file__))
    defaults_dir = Path(script_dir).joinpath("defaults").as_posix()
    
    # Scaffold the default config
    target_config = Path(base_dir).joinpath("config.json").as_posix()
    if not os.path.exists(target_config):
        src_config = Path(defaults_dir).joinpath("config.json").as_posix()
        if os.path.exists(src_config):
            shutil.copy(src_config, target_config)

    # Scaffold workflows
    target_workflows = Path(base_dir).joinpath("workflows.json").as_posix()
    if not os.path.exists(target_workflows):
        with open(target_workflows, "w", encoding="utf-8") as f:
            json.dump({"context_batches": []}, f, indent=2)

    # Scaffold the switchboard locally
    target_ws = Path(base_dir).joinpath("workspaces.json").as_posix()
    if not os.path.exists(target_ws):
        src_ws = Path(defaults_dir).joinpath("workspaces.json").as_posix()
        if os.path.exists(src_ws):
            shutil.copy(src_ws, target_ws)
            
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
        print("Usage: insetu [serve | service]")
        sys.exit(1)

    command = sys.argv[1]
    cwd = os.getcwd()
    if command == "serve":
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
            from insetu.fallback_bridge import run_recovery_app
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