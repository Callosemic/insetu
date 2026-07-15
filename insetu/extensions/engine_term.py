import os
import subprocess
import threading
import json
from flask import jsonify
from insetu.sdk import InSetuExtension
from insetu.hooks import hooks
from insetu.utils_core import get_all_workspace_ids, get_workspace_physics, load_config

try:
    from flask_sock import Sock
    HAS_SOCK = True
except ImportError:
    HAS_SOCK = False
    class Sock:
        def route(self, *args, **kwargs):
            return lambda f: f
    print("⚠️  [Terminal] flask-sock is not installed. Terminal connections will drop. Run: pip install flask-sock")

# Cross-platform PTY support check
try:
    import pty
    import select
    import termios
    import struct
    import fcntl
    SUPPORT_PTY = True
except ImportError:
    SUPPORT_PTY = False
TERM_SETTINGS_SCHEMA = []
term_bp = InSetuExtension('term', __name__, title="Terminal Interface", description="Native terminal emulator.", settings_schema=TERM_SETTINGS_SCHEMA)
__depends__ = []

sock = Sock()
if HAS_SOCK:
    term_bp.sock = sock

def set_winsize(fd, row, col, xpix=0, ypix=0):
    """Native IOCTL system call to resize the PTY grid."""
    if not SUPPORT_PTY: return
    try:
        winsize = struct.pack("HHHH", row, col, xpix, ypix)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
    except Exception:
        pass

@sock.route('/api/<workspace_id>/term/stream')
def term_stream(ws, workspace_id):
    """Native full-duplex PTY WebSocket pipeline, removing the WSGI proxy sandwich."""
    from insetu.utils_core import is_extension_enabled
    if not is_extension_enabled('term', workspace_id):
        ws.close(message="403 Forbidden: Terminal extension disabled.")
        return

    if not SUPPORT_PTY:
        ws.send("PTY is not supported on this host operating system (Windows natively requires pywinpty).\r\n")
        ws.close()
        return
    _, ws_root, _ = get_workspace_physics(workspace_id)

    # Fork a new PTY natively
    master_fd, slave_fd = pty.openpty()

    env = os.environ.copy()
    env["TERM"] = "xterm-256color"
    try:
        p = subprocess.Popen(
            ["bash", "-l"],
            preexec_fn=os.setsid if os.name == 'posix' else None,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            cwd=ws_root,
            env=env
        )
    except FileNotFoundError:
        try:
            # Fallback to sh if bash is missing (e.g., Alpine Linux Docker containers)
            p = subprocess.Popen(
                ["sh", "-l"],
                preexec_fn=os.setsid if os.name == 'posix' else None,
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                cwd=ws_root,
                env=env
            )
        except Exception as e:
            ws.send(f"\r\n\x1b[31m[Terminal Error] Failed to start shell: {str(e)}\x1b[0m\r\n")
            ws.close()
            return
    except Exception as e:
        ws.send(f"\r\n\x1b[31m[Terminal Error] {str(e)}\x1b[0m\r\n")
        ws.close()
        return

    os.close(slave_fd)
    def read_from_pty():
        try:
            while True:
                r, _, _ = select.select([master_fd], [], [], 0.1)
                if master_fd in r:
                    data = os.read(master_fd, 4096)
                    if not data:
                        break
                    ws.send(data)
        except OSError:
            pass  # Expected standard exception when PTY gracefully closes
        except Exception as e:
            try: ws.send(f"\r\n\x1b[31m[PTY Read Error] {str(e)}\x1b[0m\r\n")
            except: pass
        finally:
            try:
                ws.close()
            except:
                pass

    t = threading.Thread(target=read_from_pty, daemon=True)
    t.start()

    try:
        while True:
            data = ws.receive()
            if not data:
                break

            # Intercept declarative JSON configurations (like resize events) natively
            if isinstance(data, str) and data.startswith('{"type":"resize"'):
                try:
                    msg = json.loads(data)
                    set_winsize(master_fd, msg["rows"], msg["cols"])
                except Exception:
                    pass
            else:
                # Pipe raw input directly to the kernel
                os.write(master_fd, data if isinstance(data, bytes) else data.encode('utf-8'))
    except Exception as e:
        try: ws.send(f"\r\n\x1b[31m[WS Receive Error] {str(e)}\x1b[0m\r\n")
        except: pass
    finally:
        try:
            os.close(master_fd)
            p.terminate()
            p.wait(timeout=1.0)
        except Exception:
            try:
                p.kill()
            except:
                pass