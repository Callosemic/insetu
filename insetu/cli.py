import os
import sys
import json
import shutil
import threading
from pathlib import Path

os.environ.setdefault("MALLOC_ARENA_MAX", "2")
try:
    threading.stack_size(1024 * 1024)
except Exception:
    pass

# Enforce host-specific control directory for the Akasa kernel using pure stdlib
os.environ["AKASA_CONTROL_DIR"] = ".insetu"

# Ensure sibling akasa repo is discoverable in local dev setups
_sibling_akasa = Path(__file__).resolve().parent.parent.parent.joinpath("akasa")
if _sibling_akasa.exists() and (_sibling_akasa / "akasa").is_dir():
    _akasa_posix = _sibling_akasa.as_posix()
    if _akasa_posix not in sys.path:
        sys.path.insert(0, _akasa_posix)


def scaffold_profiles(cwd):
    """Minimal zero-dependency profile bootstrapper for the Immutable Recovery Bootloader."""
    base_dir = Path(cwd).joinpath(".insetu").as_posix()
    os.makedirs(base_dir, exist_ok=True)

    defaults_dir = Path(__file__).resolve().parent.joinpath("defaults").as_posix()
    for target_name, src_name, fallback_payload in [
        ("config.json", "config_json.txt", None),
        ("host.json", "host_json.txt", {"port": 5005}),
        ("workspaces.json", "workspaces_json.txt", {"workspaces": {"default": {"config_path": "config.json"}}, "active_workspace": "default"}),
        (".gitignore", "gitignore.txt", None)
    ]:
        target_p = Path(base_dir).joinpath(target_name).as_posix()
        src_p = Path(defaults_dir).joinpath(src_name).as_posix()
        if not os.path.exists(target_p):
            copied = False
            if os.path.exists(src_p):
                try:
                    shutil.copy(src_p, target_p)
                    copied = True
                except OSError:
                    copied = False
            if not copied and fallback_payload is not None:
                Path(target_p).write_text(json.dumps(fallback_payload, indent=2), encoding="utf-8")

    os.makedirs(Path(base_dir).joinpath("data").as_posix(), exist_ok=True)
    os.makedirs(Path(base_dir).joinpath("cache", "db").as_posix(), exist_ok=True)


def main():
    if len(sys.argv) < 2:
        print("Usage: insetu [init | serve | gui | service | shortcut | create-extension | mcp]")
        sys.exit(1)

    command = sys.argv[1]
    cwd = os.getcwd()

    if command in ("-h", "--help", "help"):
        print("inSetu Developer OS CLI")
        print("Usage: insetu [init | serve | gui | service | shortcut | create-extension | mcp]")
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

    elif command == "mcp":
        scaffold_profiles(cwd)
        from insetu.core.system.cli_commands import handle_mcp_stdio as _handle_mcp_stdio
        _handle_mcp_stdio(cwd, sys.argv[2:])

    else:
        print(f"Unknown command: {command}")
        print("Usage: insetu [init | serve | gui | service | shortcut | create-extension | mcp]")
        sys.exit(1)


if __name__ == "__main__":
    main()