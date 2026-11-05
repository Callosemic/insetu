"""Out-of-band filesystem observer and deterministic content-addressed VFS echo filter."""
from collections import OrderedDict
import os
from pathlib import Path
import threading
import time
from typing import Optional, Tuple

from insetu.core.sdk import (
    SettingsManager,
    compute_vfs_sha256,
    get_all_workspace_ids,
    get_connection,
    get_workspace_physics,
    has_pending_vfs_write,
    hooks,
    load_config,
)

_NATIVE_VFS_WRITES = {}
_NATIVE_VFS_HASHES = OrderedDict()
_WATCHDOG_PENDING = {}
_WATCHDOG_LOCK = threading.Lock()
_WATCHDOG_DEBOUNCE_WINDOW = 2.0
_WATCHDOG_THREAD = None
_WATCHDOG_OBSERVER = None


def _is_watchdog_vfs_echo(abs_key: str, src_path: str, op: str) -> Tuple[bool, Optional[str]]:
    """
    Deterministic Content-Addressed Echo Filter:
    Verifies whether an OS filesystem event matches an in-flight or already-committed internal VFS mutation.
    Returns (is_echo, disk_sha256).
    """
    if has_pending_vfs_write(src_path):
        return True, None

    with _WATCHDOG_LOCK:
        expected_hash = _NATIVE_VFS_HASHES.get(abs_key)

    if op == 'delete':
        if expected_hash == "__DELETED__" and not os.path.exists(src_path):
            return True, None
        return False, None

    if not os.path.exists(src_path) or os.path.isdir(src_path):
        return False, None

    try:
        st = os.stat(src_path)
        if st.st_size > 2 * 1024 * 1024:
            return False, None
        with open(src_path, 'r', encoding='utf-8') as f:
            disk_text = f.read()
        disk_hash = compute_vfs_sha256(disk_text)
        if expected_hash and disk_hash == expected_hash:
            return True, disk_hash
        return False, disk_hash
    except Exception:
        return False, None


def _watchdog_debouncer_loop():
    while True:
        time.sleep(2.0)
        now = time.time()
        to_emit = {}
        with _WATCHDOG_LOCK:
            for cache_key, data in list(_WATCHDOG_PENDING.items()):
                if now - data['ts'] >= _WATCHDOG_DEBOUNCE_WINDOW:
                    to_emit[cache_key] = data
                    del _WATCHDOG_PENDING[cache_key]
        if to_emit:
            ws_groups = {}
            for cache_key, data in to_emit.items():
                abs_key = data['abs_key']
                src_path = data.get('src_path', abs_key)
                is_echo, disk_hash = _is_watchdog_vfs_echo(abs_key, src_path, data['op'])
                if is_echo:
                    continue
                logical_path = data.get('logical_path', abs_key)
                print(f"👀 [Watchdog] Caught '{data['op']}' on: {logical_path} (after {_WATCHDOG_DEBOUNCE_WINDOW}s quiet)")
                ws_id = data['workspace_id']
                if ws_id not in ws_groups: ws_groups[ws_id] = []
                mut_entry = {"filepath": logical_path, "operation": data['op'], "ignore_ledger": False, "is_watchdog": True}
                if disk_hash:
                    mut_entry["base_hash"] = disk_hash
                ws_groups[ws_id].append(mut_entry)
                try:
                    w_conn = get_connection("workers", workspace_id=ws_id)
                    w_conn.execute("INSERT OR REPLACE INTO vfs_event_log (filepath, mutation_type, timestamp) VALUES (?, ?, ?)", (logical_path, data['op'], now))
                    w_conn.commit()
                except Exception: pass

            for ws_id, mutations in ws_groups.items():
                hooks.emit_background('vfs_mutated', workspace_id=ws_id, mutations=mutations)


@hooks.on('pre_file_save')
def _track_intent_vfs_writes(workspace_id=None, filepath=None, resolved_path=None, content=None, data=None, **kwargs):
    """Records deterministic VFS content hashes BEFORE disk I/O to eliminate Watchdog self-echoes."""
    if not filepath or not resolved_path:
        return
    abs_key = os.path.abspath(resolved_path).lower()
    action = (data or {}).get("action", "save") if isinstance(data, dict) else "save"
    target_hash = "__DELETED__" if action in ("delete", "move") else compute_vfs_sha256(content or "")

    with _WATCHDOG_LOCK:
        _NATIVE_VFS_WRITES[abs_key] = time.time()
        _NATIVE_VFS_HASHES[abs_key] = target_hash
        _NATIVE_VFS_HASHES.move_to_end(abs_key)
        while len(_NATIVE_VFS_HASHES) > 2048:
            _NATIVE_VFS_HASHES.popitem(last=False)
        keys_to_remove = [k for k in _WATCHDOG_PENDING.keys() if k[1] == abs_key]
        for k in keys_to_remove:
            del _WATCHDOG_PENDING[k]


@hooks.on('system_boot')
def start_filesystem_observer(**kwargs):
    """Initializes a unified Watchdog observer for all active workspaces."""
    global _WATCHDOG_OBSERVER
    if _WATCHDOG_OBSERVER is not None:
        stop_filesystem_observer()
    workspace_ids = get_all_workspace_ids()
    if not SettingsManager('system', 'default').get("enable_watchdog", True):
        return None

    active_configs = []
    for ws_id in workspace_ids:
        cfg = load_config(ws_id)
        active_configs.append((ws_id, cfg))
    if not active_configs:
        return None
    try:
        from watchdog.observers import Observer as _Observer
        from watchdog.observers.polling import PollingObserver as _PollingObserver
        from watchdog.events import FileSystemEventHandler as _FileSystemEventHandler
    except ImportError:
        print("⚠️  Optional package 'watchdog' not found. External modifications require full sweeps.")
        return None
    except Exception as e:
        print(f"⚠️  Watcher initialization failed: {e}")
        return None
    class FileSystemObserver(_FileSystemEventHandler):
        def __init__(self, workspace_id, repo_dir, target_path, ignore_dirs, ignore_files, ignore_patterns, ignore_exceptions=None):
            super().__init__()
            self.workspace_id = workspace_id
            self.repo_dir = repo_dir
            self.target_path = target_path
            self.ignore_dirs = ignore_dirs
            self.ignore_files = ignore_files
            self.ignore_patterns = ignore_patterns
            self.ignore_exceptions = ignore_exceptions or []
        def process_event(self, event, filepath_override=None, op_override=None, is_dir_override=None):
            src_path = filepath_override or event.src_path
            is_dir = is_dir_override if is_dir_override is not None else getattr(event, 'is_directory', False)

            # 🚨 O(N^2) STORM PREVENTER 🚨
            # Watchdog fires 'modified' events for directories whenever a child file changes.
            # We explicitly drop these to prevent telemetry storms, but we MUST preserve 
            # directory creations, deletions, and moves to catch atomic folder operations.
            if is_dir and event.event_type == 'modified':
                return

            filename = Path(src_path).name
            if (filename.startswith('.') and filename != '.gitignore') or filename.endswith('~') or filename.upper() == 'CODE_INDEX.MD' or filename == 'manifest.json': return
            if filename.endswith(('.db', '.db-wal', '.db-shm', '.db-journal')): return

            op = op_override or ('delete' if event.event_type == 'deleted' else 'save')
            try:
                rel_to_target = os.path.relpath(src_path, self.target_path).replace('\\', '/')
                if rel_to_target == '.' or rel_to_target == '': return
                logical_path = f"vfs://{self.repo_dir}/{rel_to_target}"

                if is_dir:
                    logical_path += '/'
                # CPU Optimization: Drop events for ignored directories/patterns before waking the Event Bus
                parts = set(p.lower() for p in logical_path.strip('/').split('/'))
                norm_rel_lower = rel_to_target.lower()

                # Hardcoded OS Guardrails to prevent Watchdog infinite I/O loops on cache/db while allowing .insetu/data/
                if parts.intersection({'.git', 'node_modules', '__pycache__', 'venv'}): return
                if '.insetu' in parts and not (norm_rel_lower.startswith('.insetu/data/') or '/.insetu/data/' in norm_rel_lower):
                    return
                from insetu.core.topology.engine_topology import matches_gitignore_patterns as _matches_gitignore_patterns
                is_excepted = any(rel_to_target.startswith(exc.lstrip('/')) for exc in self.ignore_exceptions if exc) or _matches_gitignore_patterns(rel_to_target, self.ignore_exceptions)
                if not is_excepted:
                    if filename.lower() in self.ignore_files: return
                    if parts.intersection(self.ignore_dirs): return
                    if self.ignore_patterns and (
                        any(pattern in logical_path for pattern in self.ignore_patterns)
                        or _matches_gitignore_patterns(rel_to_target, self.ignore_patterns)
                    ):
                        return
                abs_key = os.path.abspath(src_path).lower()
                # Deduplication 1: Deterministic Content-Addressed VFS Echo Check
                if not is_dir:
                    is_echo, _ = _is_watchdog_vfs_echo(abs_key, src_path, op)
                    if is_echo:
                        return
                # Deduplication 2: Unified Trailing Slew Limiter (Batcher)
                global _WATCHDOG_THREAD
                with _WATCHDOG_LOCK:
                    cache_key = (self.workspace_id, abs_key)
                    _WATCHDOG_PENDING[cache_key] = {
                        'op': op,
                        'workspace_id': self.workspace_id,
                        'ts': time.time(),
                        'logical_path': logical_path,
                        'abs_key': abs_key,
                        'src_path': src_path
                    }
                    if _WATCHDOG_THREAD is None or not _WATCHDOG_THREAD.is_alive():
                        _WATCHDOG_THREAD = threading.Thread(target=_watchdog_debouncer_loop, daemon=True)
                        _WATCHDOG_THREAD.start()

            except Exception:
                pass

        def on_modified(self, event): self.process_event(event)
        def on_created(self, event): self.process_event(event)
        def on_deleted(self, event): self.process_event(event)
        def on_moved(self, event):
            is_dir = getattr(event, 'is_directory', False)
            self.process_event(event, filepath_override=event.src_path, op_override='delete', is_dir_override=is_dir)
            if hasattr(event, 'dest_path'):
                self.process_event(event, filepath_override=event.dest_path, op_override='save', is_dir_override=is_dir)
    try:
        observer = _Observer()
    except Exception:
        observer = _PollingObserver()
    has_watches = False
    scheduled_watches = set()
    for ws_id, cfg in active_configs:
        _, ws_root = get_workspace_physics(ws_id)
        global_ignore = set(d.lower() for d in cfg.get("ignore_dirs", []))
        global_ignore_files = set(f.lower() for f in cfg.get("ignore_files", []))
        global_patterns = cfg.get("ignore_patterns", [])
        for repo_cfg in cfg.get("target_repos", []):
            r_dir = repo_cfg.get("repo_dir")
            if not r_dir: continue
            p_path = repo_cfg.get("physical_path")
            target_path = os.path.abspath(os.path.expanduser(p_path)) if p_path else Path(ws_root).joinpath(r_dir).resolve().as_posix()
            watch_key = (ws_id, target_path)
            if watch_key in scheduled_watches:
                continue
            if os.path.exists(target_path):
                scheduled_watches.add(watch_key)
                if repo_cfg.get("repo_ignore_dirs") is not None:
                    ignore_dirs = set(d.lower() for d in repo_cfg.get("repo_ignore_dirs"))
                else:
                    ignore_dirs = set(global_ignore)

                if repo_cfg.get("repo_ignore_files") is not None:
                    ignore_files = set(f.lower() for f in repo_cfg.get("repo_ignore_files"))
                else:
                    ignore_files = set(global_ignore_files)

                if repo_cfg.get("repo_ignore_patterns") is not None:
                    ignore_patterns = repo_cfg.get("repo_ignore_patterns")
                else:
                    ignore_patterns = list(global_patterns)
                ignore_exceptions = repo_cfg.get("ignore_exceptions") or []
                handler = FileSystemObserver(
                    workspace_id=ws_id,
                    repo_dir=r_dir,
                    target_path=target_path,
                    ignore_dirs=ignore_dirs,
                    ignore_files=ignore_files,
                    ignore_patterns=ignore_patterns,
                    ignore_exceptions=ignore_exceptions
                )
                observer.schedule(handler, target_path, recursive=True)
                has_watches = True
    if has_watches:
        observer.start()
        _WATCHDOG_OBSERVER = observer
        print("👁️  Native Filesystem Watchers Engaged.")


@hooks.on('system_shutdown')
def stop_filesystem_observer(**kwargs):
    global _WATCHDOG_OBSERVER
    if _WATCHDOG_OBSERVER:
        try:
            _WATCHDOG_OBSERVER.stop()
            _WATCHDOG_OBSERVER.join(timeout=2.0)
        except Exception: pass
        _WATCHDOG_OBSERVER = None
