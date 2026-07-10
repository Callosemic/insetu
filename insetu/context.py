import os
from insetu.routes_fs import execute_vfs_save
from insetu.utils_core import resolve_workspace_path

class VFSTransaction:
    """Provides atomic-style batching and async queue dispatch for file mutations."""
    def __init__(self, workspace_id):
        self.workspace_id = workspace_id
        self._buffer = []
        self._in_transaction = False

    def save(self, filepath, content, data=None):
        if self._in_transaction:
            self._buffer.append((filepath, content, data or {}))
        else:
            execute_vfs_save(self.workspace_id, filepath, content, data)

    def read(self, filepath):
        """Safely resolves and reads a file's contents, returning None if missing."""
        resolved = resolve_workspace_path(filepath, self.workspace_id)
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
                from insetu.hooks import hooks
                hooks.emit('vfs_transaction_committed', workspace_id=self.workspace_id, files=[f[0] for f in self._buffer])
            except Exception:
                pass

        self._buffer = []

    def walk(self, directory_path, exts=None):
        """Safely sweeps a directory within the workspace bounds, yielding files that match the extension array."""
        resolved_dir = resolve_workspace_path(directory_path, self.workspace_id)
        if not os.path.exists(resolved_dir):
            return

        for root, _, files in os.walk(resolved_dir):
            for f in files:
                if exts and not any(f.endswith(ext) for ext in exts):
                    continue
                yield os.path.relpath(os.path.join(root, f), resolved_dir)