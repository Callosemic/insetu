import os
import sys
import json
import shutil
from pathlib import Path

# Enforce host-specific control directory for the Akasa kernel
os.environ["AKASA_CONTROL_DIR"] = ".insetu"


def scaffold_profiles(cwd):
    """Minimal zero-dependency profile bootstrapper for the Immutable Recovery Bootloader."""
    base_dir = Path(cwd).joinpath(".insetu").as_posix()
    os.makedirs(base_dir, exist_ok=True)

    defaults_dir = Path(__file__).resolve().parent.joinpath("defaults").as_posix()
    for target_name, src_name in [
        ("config.json", "config_json.txt"),
        ("system.json", "system_json.txt"),
        (".gitignore", "gitignore.txt")
    ]:
        target_p = Path(base_dir).joinpath(target_name).as_posix()
        src_p = Path(defaults_dir).joinpath(src_name).as_posix()
        if not os.path.exists(target_p) and os.path.exists(src_p):
            shutil.copy(src_p, target_p)

    os.makedirs(Path(base_dir).joinpath("data").as_posix(), exist_ok=True)
    os.makedirs(Path(base_dir).joinpath("cache", "db").as_posix(), exist_ok=True)


def main():
    if len(sys.argv) < 2:
        print("Usage: insetu [init | serve | gui | service | shortcut | create-extension]")
        sys.exit(1)

    command = sys.argv[1]
    cwd = os.getcwd()

    if command in ("-h", "--help", "help"):
        print("inSetu Developer OS CLI")
        print("Usage: insetu [init | serve | gui | service | shortcut | create-extension]")
        sys.exit(0)

    if command == "serve":
        scaffold_profiles(cwd)
        try:
            from insetu.app import run_app as _run_app
            _run_app()
        except Exception:
            import traceback as _traceback
            err_details = _traceback.format_exc()
            print("\n[!] KERNEL PANIC detected during boot.")
            print(f"[!] Details:\n{err_details}")
            print("[!] Booting Immutable Recovery OS (Lifeboat FS)...")
            os.environ["INSETU_PANIC_DETAILS"] = err_details
            from insetu.fallback_bridge import run_recovery_app as _run_recovery_app
            _run_recovery_app()

    elif command == "init":
        from insetu.core.system.cli_commands import handle_init as _handle_init
        _handle_init(cwd, sys.argv[2:])

    elif command == "create-extension":
        if len(sys.argv) < 3:
            print("Usage: insetu create-extension <extension_name>")
            sys.exit(1)
        from insetu.core.system.cli_commands import scaffold_extension as _scaffold_extension
        _scaffold_extension(sys.argv[2])

    elif command == "gui":
        from insetu.core.system.cli_commands import launch_gui as _launch_gui
        _launch_gui(cwd)

    elif command == "shortcut":
        from insetu.core.system.cli_commands import create_desktop_shortcut as _create_desktop_shortcut
        _create_desktop_shortcut(cwd)

    elif command == "service":
        if len(sys.argv) < 3:
            print("Usage: insetu service [install | uninstall | start | stop | restart | status]")
            sys.exit(1)
        from insetu.core.system.cli_commands import handle_service as _handle_service
        _handle_service(sys.argv[2], cwd)

    else:
        print(f"Unknown command: {command}")
        print("Usage: insetu [init | serve | gui | service | shortcut | create-extension]")
        sys.exit(1)


if __name__ == "__main__":
    main()