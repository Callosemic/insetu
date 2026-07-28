import os
from pathlib import Path
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
            from insetu.routes_fs import execute_vfs_save
            execute_vfs_save(self.workspace_id, filepath, content, data)
    def read(self, filepath, is_absolute_artifact=False):
        """Safely resolves and reads a file's contents, returning None if missing."""
        from pathlib import Path
        if is_absolute_artifact and Path(filepath).is_absolute():
            from insetu.utils_core import resolve_system_artifact_path
            resolved = resolve_system_artifact_path(filepath, self.workspace_id)
        else:
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
            from insetu.routes_fs import execute_vfs_save
            for filepath, content, data in self._buffer:
                execute_vfs_save(self.workspace_id, filepath, content, data)
            # Broadcast the atomic commit to the ecosystem
            try:
                from insetu.hooks import hooks
                mutations = [{"filepath": f[0], "operation": "save", "ignore_ledger": bool((f[2] or {}).get("is_absolute_artifact") or (f[2] or {}).get("ignore_ledger"))} for f in self._buffer]
                hooks.emit_background('vfs_mutated', workspace_id=self.workspace_id, mutations=mutations)
            except Exception:
                pass

        self._buffer = []
    def walk(self, directory_path, exts=None):
        """Safely sweeps a directory within the workspace bounds, yielding strict workspace-relative file paths."""
        from insetu.utils_core import get_workspace_physics, load_config, get_valid_workspace_files
        resolved_dir = resolve_workspace_path(directory_path, self.workspace_id)
        if not os.path.exists(resolved_dir):
            return

        _, ws_root, _ = get_workspace_physics(self.workspace_id)
        cfg = load_config(self.workspace_id)

        # Identify if this directory maps to a known repository to inherit its specific rules
        target_repo_cfg = {}
        for r_cfg in cfg.get("target_repos", []):
            r_dir = r_cfg.get("repo_dir", "")
            if r_dir and (directory_path == r_dir or directory_path.startswith(r_dir + "/")):
                target_repo_cfg = r_cfg
                break

        # Delegate entirely to the Cartographer's SSOT utility
        valid_files = get_valid_workspace_files(resolved_dir, target_repo_cfg, self.workspace_id)
        if not valid_files:
            return

        for f in valid_files:
            if exts and not any(f.endswith(ext) for ext in exts):
                continue

            abs_path = Path(resolved_dir).joinpath(f).as_posix()
            # Pit of Success: Calculate relative to the true workspace root natively
            try:
                yield os.path.relpath(abs_path, ws_root).replace('\\', '/')
            except ValueError:
                yield abs_path