import os
import subprocess
import threading
import json
from flask import jsonify
from insetu.core.sdk import InSetuExtension, ExtensionContext
from insetu.kernel.hooks import hooks
from insetu.kernel.utils import get_all_workspace_ids

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
    try:
        _run_term_stream(ws, workspace_id)
    except Exception as e:
        import traceback
        err = traceback.format_exc().replace('\n', '\r\n')
        try:
            ws.send(f"\r\n\x1b[31m[Fatal Terminal Error]\r\n{err}\x1b[0m\r\n")
            ws.close()
        except:
            pass

def _run_term_stream(ws, workspace_id):
    from insetu.kernel.utils import is_extension_enabled
    if not is_extension_enabled('term', workspace_id):
        ws.close()
        return
    if not SUPPORT_PTY:
        ws.send("PTY is not supported on this host operating system (Windows natively requires pywinpty).\r\n")
        ws.close()
        return

    ctx = ExtensionContext('term', workspace_id)
    ws_root = ctx.paths['workspace_root']

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
    ws_lock = threading.Lock()
    is_closing = False

    def safe_send(payload):
        if is_closing: return
        try:
            with ws_lock:
                ws.send(payload)
        except Exception:
            pass

    def read_from_pty():
        try:
            while not is_closing:
                r, _, _ = select.select([master_fd], [], [], 0.1)
                if master_fd in r:
                    data = os.read(master_fd, 4096)
                    if not data:
                        break
                    safe_send(data)
        except OSError:
            pass  # Expected standard exception when PTY gracefully closes
        except Exception as e:
            safe_send(f"\r\n\x1b[31m[PTY Read Error] {str(e)}\x1b[0m\r\n")

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
        safe_send(f"\r\n\x1b[31m[WS Receive Error] {str(e)}\x1b[0m\r\n")
    finally:
        is_closing = True
        try:
            os.close(master_fd)
            p.terminate()
            p.wait(timeout=1.0)
        except Exception:
            try:
                p.kill()
            except:
                pass