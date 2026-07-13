import os
import subprocess
import shutil
import socket
from flask import jsonify
from insetu.sdk import InSetuExtension
from insetu.hooks import hooks
from insetu.utils_core import get_all_workspace_ids, get_workspace_physics, load_config

TERM_SETTINGS_SCHEMA = [
    {
        "id": "base_port",
        "label": "Terminal Starting Port",
        "type": "number",
        "default": 8181,
        "description": "The baseline network port to begin probing for available sockets sequentially."
    }
]

term_bp = InSetuExtension('term', __name__, settings_schema=TERM_SETTINGS_SCHEMA)
__depends__ = []

_term_processes = {}
_active_term_ports = {}

def _find_next_free_port(start_port):
    """Direct socket probing routine to verify socket availability natively."""
    port = start_port
    while port < 65535:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                port += 1
    raise RuntimeError("No free sockets available within system operational limits.")
@term_bp.route('port', methods=['GET'])
def get_workspace_terminal_port(ctx):
    """Stateless tenant route returning the dynamically tracked port allotment after auditing process health."""
    port = _active_term_ports.get(ctx.workspace_id)
    proc = _term_processes.get(ctx.workspace_id)

    if not port:
        return jsonify({"error": "Terminal process matrix not allocated for this workspace or extension is disabled."}), 404

    # Direct Health Audit: Check if the background process has prematurely exited
    if proc and proc.poll() is not None:
        # Cleanup stale state maps instantly to heal the tracking matrix
        _active_term_ports.pop(ctx.workspace_id, None)
        _term_processes.pop(ctx.workspace_id, None)
        return jsonify({"error": f"Terminal process crashed post-launch with exit code {proc.returncode}."}), 500

    return jsonify({"term_port": port})

@hooks.on('system_boot')
def boot_managed_terminals():
    """Lifecycle Hook: Scans active tenant registries and provisions dynamic ttyd instances sequentially."""
    global _term_processes, _active_term_ports
    ttyd_bin = shutil.which("ttyd")
    if not ttyd_bin:
        print("⚠️  [Terminal Extension] 'ttyd' binary not found in system PATH. Internal terminal management disabled.")
        return

    from insetu.sdk import ExtensionContext
    sys_ctx = ExtensionContext('term', 'default')
    starting_port = int(sys_ctx.settings.get("base_port", 8181))
    current_port = starting_port

    for ws_id in get_all_workspace_ids():
        try:
            cfg = load_config(ws_id)
            if "term" not in cfg.get("extensions", []):
                continue

            _, ws_root, _ = get_workspace_physics(ws_id)
            if not os.path.exists(ws_root):
                print(f"⚠️  [Terminal Extension] Skipping workspace '{ws_id}'. Path missing: {ws_root}")
                continue
            allocated_port = _find_next_free_port(current_port)
            current_port = allocated_port + 1  # Advance pointer for subsequent tenants
            # Pit of Success: Enforce the -W write-access flag, as ttyd defaults to read-only security permissions
            # We omit the client-option flag to ensure binary launch compatibility across varying host ttyd distributions.
            cmd = [ttyd_bin, "-i", "127.0.0.1", "-p", str(allocated_port), "-W", "bash"]

            print(f"🔌 [Terminal Extension] Spawning isolated ttyd shell for tenant '{ws_id}' on port {allocated_port}...")

            def _setup_linux_safety_jail():
                """Configures process group isolation and registers a parent-death signal trigger."""
                if hasattr(os, 'setsid'):
                    os.setsid()
                # Intercept parent termination natively via libc to prevent orphan zombies
                try:
                    import ctypes
                    import signal
                    libc = ctypes.CDLL(None)
                    # PR_SET_PDEATHSIG = 1
                    libc.prctl(1, signal.SIGTERM)
                except Exception:
                    pass

            proc = subprocess.Popen(
                cmd,
                cwd=ws_root,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                preexec_fn=_setup_linux_safety_jail
            )
            _term_processes[ws_id] = proc
            _active_term_ports[ws_id] = allocated_port
        except Exception as e:
            print(f"❌ [Terminal Extension] Failed to initialize process for workspace '{ws_id}': {e}")

@hooks.on('system_shutdown')
def shutdown_managed_terminals():
    """Lifecycle Hook: Cleanly kills spawned subprocess grids to prevent rogue background worker leaks."""
    global _term_processes, _active_term_ports
    print("🛑 Terminating managed terminal process matrix...")
    for ws_id, proc in _term_processes.items():
        try:
            if proc.poll() is None:
                proc.terminate()
                proc.wait(timeout=2.0)
        except subprocess.TimeoutExpired:
            proc.kill()
        except Exception as e:
            print(f"⚠️  [Terminal Extension] Exception thrown clearing worker thread for '{ws_id}': {e}")
    _term_processes.clear()
    _active_term_ports.clear()