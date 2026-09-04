import os
import queue
import threading
from pathlib import Path
from insetu.kernel.hooks import hooks

_VFS_WRITE_QUEUE = queue.Queue()
_VFS_WORKER_THREAD = None
_VFS_SHUTDOWN_SIGNAL = threading.Event()

def _vfs_commit_worker():
    """Consumes write payloads sequentially off-thread to guard the Flask event loop."""
    while True:
        if _VFS_SHUTDOWN_SIGNAL.is_set() and _VFS_WRITE_QUEUE.empty():
            break
        try:
            task = _VFS_WRITE_QUEUE.get(timeout=1.0)
            if task is None:
                _VFS_WRITE_QUEUE.task_done()
                continue
            workspace_id, filepath, content, data = task
            try:
                action = data.get("action", "save")
                if action == "delete":
                    from insetu.kernel.utils import resolve_sandbox_path
                    overrides = hooks.emit('vfs_resolve_path', filepath=filepath, workspace_id=workspace_id)
                    resolved_path = next((r for r in overrides if r), None) or resolve_sandbox_path(filepath, workspace_id)
                    
                    if os.path.exists(resolved_path):
                        if os.path.isdir(resolved_path):
                            import shutil
                            shutil.rmtree(resolved_path)
                        else:
                            os.remove(resolved_path)
                    ignore_ledger = bool(data.get("is_absolute_artifact") or data.get("ignore_ledger"))
                    if not ignore_ledger:
                        import time
                        from insetu.kernel.db import get_connection
                        db_conn = get_connection("workers", workspace_id=workspace_id)
                        db_conn.execute(
                            "INSERT OR REPLACE INTO vfs_event_log (filepath, mutation_type, timestamp) VALUES (?, ?, ?)",
                            (filepath, 'deleted', time.time())
                        )
                        db_conn.commit()
                    hooks.emit('vfs_mutated', workspace_id=workspace_id, mutations=[{"filepath": filepath, "operation": "delete", "ignore_ledger": ignore_ledger}])
                elif action == "move":
                    dest_path = data.get("dest_path")
                    from insetu.kernel.utils import resolve_sandbox_path
                    src_overrides = hooks.emit('vfs_resolve_path', filepath=filepath, workspace_id=workspace_id)
                    resolved_src = next((r for r in src_overrides if r), None) or resolve_sandbox_path(filepath, workspace_id)
                    
                    dest_overrides = hooks.emit('vfs_resolve_path', filepath=dest_path, workspace_id=workspace_id)
                    resolved_dest = next((r for r in dest_overrides if r), None) or resolve_sandbox_path(dest_path, workspace_id)
                    
                    if os.path.exists(resolved_src):
                        os.makedirs(Path(resolved_dest).parent, exist_ok=True)
                        import shutil
                        shutil.move(resolved_src, resolved_dest)
                    ignore_ledger = bool(data.get("is_absolute_artifact") or data.get("ignore_ledger"))
                    if not ignore_ledger:
                        import time
                        from insetu.kernel.db import get_connection
                        db_conn = get_connection("workers", workspace_id=workspace_id)
                        db_conn.execute(
                            "INSERT OR REPLACE INTO vfs_event_log (filepath, mutation_type, timestamp) VALUES (?, ?, ?)",
                            (filepath, 'deleted', time.time())
                        )
                        db_conn.execute(
                            "INSERT OR REPLACE INTO vfs_event_log (filepath, mutation_type, timestamp) VALUES (?, ?, ?)",
                            (dest_path, 'added', time.time())
                        )
                        db_conn.commit()
                    hooks.emit('vfs_mutated', workspace_id=workspace_id, mutations=[
                        {"filepath": filepath, "operation": "delete", "ignore_ledger": ignore_ledger},
                        {"filepath": dest_path, "operation": "save", "ignore_ledger": ignore_ledger}
                    ])
                else:
                    execute_vfs_save_physical(workspace_id, filepath, content, data)
            except Exception as e:
                print(f"❌ [VFS Pipeline] Background operation failed for {filepath}: {e}")
            finally:
                _VFS_WRITE_QUEUE.task_done()
        except queue.Empty:
            continue

@hooks.on('system_boot')
def start_vfs_pipeline():
    global _VFS_WORKER_THREAD
    _VFS_SHUTDOWN_SIGNAL.clear()
    _VFS_WORKER_THREAD = threading.Thread(target=_vfs_commit_worker, name="VFS-Commit-Pipeline", daemon=True)
    _VFS_WORKER_THREAD.start()
    print("🚀 Asynchronous VFS Commit Pipeline Online.")

@hooks.on('system_shutdown')
def stop_vfs_pipeline():
    print("🛑 Draining VFS Commit Pipeline...")
    _VFS_SHUTDOWN_SIGNAL.set()
    _VFS_WRITE_QUEUE.put(None)
    if _VFS_WORKER_THREAD:
        _VFS_WORKER_THREAD.join(timeout=5.0)

def execute_vfs_move(workspace_id, filepath, dest_path):
    _VFS_WRITE_QUEUE.put((workspace_id, filepath, "", {"action": "move", "dest_path": dest_path}))
    return {"status": "accepted", "message": f"File move queued."}, 202

def execute_vfs_archive(workspace_id, filepath):
    from pathlib import Path
    from insetu.kernel.utils import resolve_sandbox_path
    overrides = hooks.emit('vfs_resolve_path', filepath=filepath, workspace_id=workspace_id)
    resolved_path = next((r for r in overrides if r), None) or resolve_sandbox_path(filepath, workspace_id)
    
    archive_dir = Path(resolved_path).parent / "archived"
    new_path = archive_dir / Path(resolved_path).name

    from insetu.kernel.utils import get_workspace_physics
    _, ws_root, _ = get_workspace_physics(workspace_id)
    try:
        rel_dest = os.path.relpath(new_path, ws_root).replace('\\', '/')
    except ValueError:
        rel_dest = new_path.as_posix()

    _VFS_WRITE_QUEUE.put((workspace_id, filepath, "", {"action": "move", "dest_path": rel_dest}))
    return {"status": "accepted", "message": f"File archive queued.", "new_path": rel_dest}, 202

def execute_vfs_delete(workspace_id, filepath):
    _VFS_WRITE_QUEUE.put((workspace_id, filepath, "", {"action": "delete"}))
    return {"status": "accepted", "message": f"File deletion queued."}, 202
def execute_vfs_save(workspace_id, filepath, content, data=None):
    if data is None:
        data = {}
    if filepath.lower().endswith('.json'):
        import json
        try:
            json.loads(content)
        except Exception as e:
            raise ValueError(f"Invalid JSON syntax: {str(e)}")
    _VFS_WRITE_QUEUE.put((workspace_id, filepath, content, data))
    return {"status": "accepted", "message": f"File {filepath} queued for atomic background commit."}
def execute_vfs_save_physical(workspace_id, filepath, content, data):
    try:
        hooks.emit('pre_file_save', workspace_id=workspace_id, filepath=filepath, content=content, data=data)
    except Exception as e:
        pass

    if data.get("is_absolute_artifact"):
        from insetu.kernel.utils import resolve_system_artifact_path
        resolved_path = resolve_system_artifact_path(filepath, workspace_id)
    else:
        from insetu.kernel.utils import resolve_sandbox_path
        overrides = hooks.emit('vfs_resolve_path', filepath=filepath, workspace_id=workspace_id)
        resolved_path = next((r for r in overrides if r), None) or resolve_sandbox_path(filepath, workspace_id)
    is_new = not os.path.exists(resolved_path)

    # Idempotency Gatekeeper: Kill phantom writes by dropping identical payloads
    if not is_new and not data.get("delete_source"):
        try:
            with open(resolved_path, 'r', encoding='utf-8') as f:
                if f.read() == content:
                    print(f"💽 [VFS TELEMETRY] Silent drop (idempotent): {filepath}")
                    return  # Silently drop the transaction before touching disk or the event ledger
        except Exception:
            pass
    print(f"💽 [VFS TELEMETRY] Writing to disk: {filepath}")

    target_dir = Path(resolved_path).parent.as_posix()
    if target_dir:
        os.makedirs(target_dir, exist_ok=True)
    with open(resolved_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    import time
    from insetu.kernel.db import get_connection
    db_conn = get_connection("workers", workspace_id=workspace_id)
    ignore_ledger = bool(data.get("is_absolute_artifact") or data.get("ignore_ledger"))
    if not ignore_ledger:
        db_conn.execute(
            "INSERT OR REPLACE INTO vfs_event_log (filepath, mutation_type, timestamp) VALUES (?, ?, ?)",
            (filepath, 'modified' if not is_new else 'added', time.time())
        )
        db_conn.commit()
        
    delete_source = data.get("delete_source")
    if delete_source:
        overrides = hooks.emit('vfs_resolve_path', filepath=delete_source, workspace_id=workspace_id)
        from insetu.kernel.utils import resolve_sandbox_path
        old_abs_path = next((r for r in overrides if r), None) or resolve_sandbox_path(delete_source, workspace_id)
        if os.path.exists(old_abs_path) and os.path.abspath(old_abs_path) != os.path.abspath(resolved_path):
            os.remove(old_abs_path)
            hooks.emit('vfs_mutated', workspace_id=workspace_id, mutations=[{"filepath": delete_source, "operation": "delete", "ignore_ledger": ignore_ledger}])
            try:
                parent_dir = Path(old_abs_path).parent.as_posix()
                while parent_dir and os.path.isdir(parent_dir) and not os.listdir(parent_dir):
                    os.rmdir(parent_dir)
                    parent_dir = Path(parent_dir).parent.as_posix()
            except OSError:
                pass
            if not data.get("is_absolute_artifact") and not data.get("ignore_ledger"):
                db_conn.execute(
                    "INSERT OR REPLACE INTO vfs_event_log (filepath, mutation_type, timestamp) VALUES (?, ?, ?)",
                    (delete_source, 'deleted', time.time())
                )
                db_conn.commit()
    print(f"💽 [VFS TELEMETRY] Emitting vfs_mutated for {filepath} (ignore_ledger={ignore_ledger})")
    hooks.emit('vfs_mutated', workspace_id=workspace_id, mutations=[{"filepath": filepath, "operation": "save", "ignore_ledger": ignore_ledger}])
class VFSTransaction:
    """Provides atomic-style batching and async queue dispatch for file mutations."""
    def __init__(self, workspace_id):
        self.workspace_id = workspace_id
        self._buffer = []
        self._in_transaction = False
    def save(self, filepath, content, data=None):
        data = data or {}
        # Pre-flight Idempotency Gatekeeper: drop unchanged payloads to prevent phantom VFS events
        if not data.get("delete_source") and self.read(filepath, is_absolute_artifact=data.get("is_absolute_artifact")) == content:
            return
        if self._in_transaction:
            self._buffer.append((filepath, content, data))
        else:
            execute_vfs_save(self.workspace_id, filepath, content, data)

    def delete(self, filepath, data=None):
        """Ergonomic wrapper for queuing an atomic VFS deletion."""
        data = data or {}
        data["action"] = "delete"
        if self._in_transaction:
            self._buffer.append((filepath, "", data))
        else:
            execute_vfs_save(self.workspace_id, filepath, "", data)
    def read(self, filepath, is_absolute_artifact=False):
        """Safely resolves and reads a file's contents, returning None if missing."""
        from pathlib import Path
        from insetu.kernel.utils import resolve_system_artifact_path, resolve_sandbox_path

        check_path = filepath.replace("vfs://", "", 1) if filepath and filepath.startswith("vfs://") else filepath
        if (is_absolute_artifact and Path(check_path).is_absolute()) or (filepath and filepath.startswith("ctx://")):
            from insetu.core.routes_fs import resolve_vfs_file
            if filepath.startswith("ctx://"):
                resolved, _ = resolve_vfs_file(self.workspace_id, filepath)
            else:
                resolved = resolve_system_artifact_path(filepath, self.workspace_id)
        else:
            # Let Tier 2 intercept and resolve complex logical paths via the event bus if needed
            from insetu.kernel.hooks import hooks
            overrides = hooks.emit('vfs_resolve_path', filepath=filepath, workspace_id=self.workspace_id)
            resolved = next((r for r in overrides if r), None)

            if not resolved:
                resolved = resolve_sandbox_path(filepath, self.workspace_id)

        if not os.path.exists(resolved):
            return None
        with open(resolved, 'r', encoding='utf-8') as f:
            return f.read()

    def __enter__(self):
        self._in_transaction = True
        self._buffer = []
        return self
    def __exit__(self, exc_type, exc_val, exc_tb):
        self._in_transaction = False
        if exc_type is None and self._buffer:
            for filepath, content, data in self._buffer:
                execute_vfs_save(self.workspace_id, filepath, content, data)
            # Broadcast the atomic commit to the ecosystem
            try:
                from insetu.kernel.hooks import hooks
                mutations = [{"filepath": f[0], "operation": "save", "ignore_ledger": bool((f[2] or {}).get("is_absolute_artifact") or (f[2] or {}).get("ignore_ledger"))} for f in self._buffer]
                hooks.emit('vfs_mutated', workspace_id=self.workspace_id, mutations=mutations)
            except Exception:
                pass

        self._buffer = []
    def walk(self, directory_path, exts=None):
        """Safely sweeps a directory within the workspace bounds, yielding strict workspace-relative file paths."""
        from insetu.kernel.utils import resolve_sandbox_path
        import os
        from pathlib import Path

        # Let Tier 2 intercept and resolve complex logical paths via the event bus
        from insetu.kernel.hooks import hooks
        overrides = hooks.emit('vfs_resolve_path', filepath=directory_path, workspace_id=self.workspace_id)
        resolved_dir = next((r for r in overrides if r), None)

        if not resolved_dir:
            resolved_dir = resolve_sandbox_path(directory_path, self.workspace_id)

        if not os.path.exists(resolved_dir):
            return

        for root, dirs, files in os.walk(resolved_dir):
            # Ignore standard noise at the kernel level
            dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', '__pycache__']]
            for file in files:
                if exts and not any(file.endswith(ext) for ext in exts):
                    continue

                abs_path = Path(root).joinpath(file).as_posix()
                rel_to_resolved = os.path.relpath(abs_path, resolved_dir).replace('\\', '/')

                if rel_to_resolved == '.':
                    yield directory_path
                elif not directory_path:
                    yield rel_to_resolved
                else:
                    sep = "" if directory_path.endswith('/') else "/"
                    yield f"{directory_path}{sep}{rel_to_resolved}"