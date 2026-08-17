from pathlib import Path
import os
import json
import subprocess
from insetu.kernel.utils import load_config, get_workspace_physics, slugify, load_json_file, generate_ascii_tree
from insetu.kernel.hooks import hooks
import threading

_NATIVE_VFS_WRITES = {}
_WATCHDOG_TIMERS = {}
_WATCHDOG_DEBOUNCE_WINDOW = 10.0

@hooks.on('vfs_mutated')
def _track_native_vfs_writes(mutations=None, **kwargs):
    """Records native VFS mutations to prevent watchdog double-fires and cancels pending watchdog events."""
    if not mutations: return
    import time
    now = time.time()
    for m in mutations:
        if not m.get("is_watchdog"):
            filepath = m.get("filepath")
            if filepath:
                _NATIVE_VFS_WRITES[filepath] = now
                # Cancel any pending watchdog timer since the VFS natively handled it
                if filepath in _WATCHDOG_TIMERS:
                    _WATCHDOG_TIMERS[filepath].cancel()
                    del _WATCHDOG_TIMERS[filepath]

def start_filesystem_observer(workspace_ids):
    """Initializes a unified Watchdog observer for all active workspaces."""
    # Fast path: Check if ANY workspace has watchdog enabled before importing or instantiating
    active_configs = []
    for ws_id in workspace_ids:
        cfg = load_config(ws_id)
        if cfg.get("enable_watchdog", False):
            active_configs.append((ws_id, cfg))
            
    if not active_configs:
        return None
    try:
        from watchdog.observers import Observer
        from watchdog.observers.polling import PollingObserver
        from watchdog.events import FileSystemEventHandler
    except ImportError:
        raise ImportError("watchdog not installed")

    class FileSystemObserver(FileSystemEventHandler):
        def __init__(self, workspace_id, repo_dir, target_path, ignore_dirs, ignore_patterns):
            super().__init__()
            self.workspace_id = workspace_id
            self.repo_dir = repo_dir
            self.target_path = target_path
            self.ignore_dirs = ignore_dirs
            self.ignore_patterns = ignore_patterns

        def process_event(self, event, filepath_override=None, op_override=None):
            if event.is_directory: return

            src_path = filepath_override or event.src_path
            filename = Path(src_path).name
            if filename.startswith('.') or filename.endswith('~'): return

            try:
                rel_to_target = os.path.relpath(src_path, self.target_path).replace('\\', '/')
                logical_path = f"{self.repo_dir}/{rel_to_target}"
                # CPU Optimization: Drop events for ignored directories/patterns before waking the Event Bus
                parts = set(p.lower() for p in logical_path.split('/'))
                if parts.intersection(self.ignore_dirs): return
                if any(pattern in logical_path for pattern in self.ignore_patterns): return
                op = op_override or ('delete' if event.event_type == 'deleted' else 'save')
                import time
                now = time.time()

                # Deduplication 1: Was this file recently modified natively by our own VFS?
                if now - _NATIVE_VFS_WRITES.get(logical_path, 0) < _WATCHDOG_DEBOUNCE_WINDOW:
                    return

                # Deduplication 2: Trailing Debounce for external edits
                if logical_path in _WATCHDOG_TIMERS:
                    _WATCHDOG_TIMERS[logical_path].cancel()

                def _emit_debounced():
                    # Final Guardrail: Ensure the VFS didn't touch it while the timer was ticking
                    if time.time() - _NATIVE_VFS_WRITES.get(logical_path, 0) < _WATCHDOG_DEBOUNCE_WINDOW:
                        return

                    print(f"👀 [Watchdog] Caught '{op}' on: {logical_path} (after {_WATCHDOG_DEBOUNCE_WINDOW}s quiet)")
                    try:
                        from insetu.kernel.db import get_connection
                        w_conn = get_connection("workers", workspace_id=self.workspace_id)
                        w_conn.execute("INSERT OR REPLACE INTO vfs_event_log (filepath, mutation_type, timestamp) VALUES (?, ?, ?)", (logical_path, op, time.time()))
                        w_conn.commit()
                    except Exception:
                        pass

                    hooks.emit_background('vfs_mutated', workspace_id=self.workspace_id, mutations=[{"filepath": logical_path, "operation": op, "ignore_ledger": False, "is_watchdog": True}])

                    if logical_path in _WATCHDOG_TIMERS:
                        del _WATCHDOG_TIMERS[logical_path]

                timer = threading.Timer(_WATCHDOG_DEBOUNCE_WINDOW, _emit_debounced)
                _WATCHDOG_TIMERS[logical_path] = timer
                timer.start()

            except Exception:
                pass

        def on_modified(self, event): self.process_event(event)
        def on_created(self, event): self.process_event(event)
        def on_deleted(self, event): self.process_event(event)
        def on_moved(self, event):
            self.process_event(event, filepath_override=event.src_path, op_override='delete')
            if hasattr(event, 'dest_path'):
                self.process_event(event, filepath_override=event.dest_path, op_override='save')

    try:
        observer = Observer()
    except Exception:
        observer = PollingObserver()
    has_watches = False

    for ws_id, cfg in active_configs:
        _, ws_root, _ = get_workspace_physics(ws_id)
        global_ignore = set(cfg.get("ignore_dirs", []))
        global_patterns = cfg.get("ignore_patterns", [])
        for repo_cfg in cfg.get("target_repos", []):
            r_dir = repo_cfg.get("repo_dir")
            if not r_dir: continue
            p_path = repo_cfg.get("physical_path")
            target_path = os.path.abspath(os.path.expanduser(p_path)) if p_path else Path(ws_root).joinpath(r_dir).resolve().as_posix()
            if os.path.exists(target_path):
                if repo_cfg.get("repo_ignore_dirs") is not None:
                    ignore_dirs = set(repo_cfg.get("repo_ignore_dirs"))
                else:
                    ignore_dirs = set(global_ignore)

                if repo_cfg.get("repo_ignore_patterns") is not None:
                    ignore_patterns = repo_cfg.get("repo_ignore_patterns")
                else:
                    ignore_patterns = list(global_patterns)

                handler = FileSystemObserver(
                    workspace_id=ws_id,
                    repo_dir=r_dir,
                    target_path=target_path,
                    ignore_dirs=ignore_dirs,
                    ignore_patterns=ignore_patterns
                )
                observer.schedule(handler, target_path, recursive=True)
                has_watches = True

    if has_watches:
        observer.start()
        print("👁️  Native Filesystem Watchers Engaged.")
    return observer

@hooks.on('vfs_resolve_path')
def hook_vfs_resolve_path(filepath=None, workspace_id=None, **kwargs):
    """Provides logical repo::path boundary resolution to the Kernel VFS."""
    if filepath:
        if filepath.startswith("vfs://"):
            filepath = filepath.replace("vfs://", "", 1)

        if filepath.startswith("ctx://") or filepath.startswith("contexts/") or filepath.startswith("diffs/") or filepath.startswith("workflows/"):
            from insetu.kernel.hooks import hooks
            overrides = hooks.emit('vfs_resolve_file', filename=filepath, workspace_id=workspace_id)
            for res in overrides:
                if res and isinstance(res, tuple) and len(res) == 2 and os.path.exists(res[0]):
                    return res[0]
        return resolve_logical_path(filepath, workspace_id)
    return None
def load_workflows(workspace_id=None):
    _, _, wf_path = get_workspace_physics(workspace_id)
    return load_json_file(wf_path, {"context_batches": []})
def parse_frontmatter(content):
    import re
    yaml_match = re.search(r'^\s*---\n([\s\S]*?)\n\s*---', content)
    yaml_data = {}
    body = content
    if yaml_match:
        for line in yaml_match.group(1).split('\n'):
            if ':' in line:
                k, v = line.split(':', 1)
                yaml_data[k.strip()] = v.strip().strip('\'"')
        body = content[yaml_match.end():].strip()
    return yaml_data, body, yaml_match

def update_frontmatter(content, new_data):
    yaml_data, body, yaml_match = parse_frontmatter(content)
    yaml_data.update(new_data)

    new_yaml = ["---"]
    for k, v in yaml_data.items():
        if v is None or str(v).lower() == 'null':
            new_yaml.append(f"{k}: null")
        elif isinstance(v, (int, float, bool)) or (isinstance(v, str) and (v.startswith('[') or v.startswith('{'))):
            new_yaml.append(f"{k}: {v}")
        else:
            new_yaml.append(f'{k}: "{v}"')
    new_yaml.append("---")
    return "\n".join(new_yaml) + "\n\n" + body

def generate_text_chunks(blocks, chunk_limit=400000):
    current_chunk = []
    current_length = 0
    for block in blocks:
        block_len = len(block)
        if current_length + block_len > chunk_limit and current_length > 0:
            yield "".join(current_chunk)
            current_chunk = []
            current_length = 0
        current_chunk.append(block)
        current_length += block_len
    if current_chunk:
        yield "".join(current_chunk)

def evaluate_circuit_breaker(touched_count, total_count, threshold=0.5):
    if not total_count or total_count <= 0:
        return False
    return (touched_count / total_count) > threshold
def extract_manifest_files(manifest_data, target_key=None, domain='auto', exclude_types=None, include_types=None):
    def _extract(data):
        if isinstance(data, dict):
            item_type = data.get("meta", {}).get("type", "unknown")
            if exclude_types and item_type in exclude_types:
                return []
            if include_types and item_type not in include_types:
                return []
            return data.get("chunks", data.get("files", []))
        elif isinstance(data, list):
            if include_types: return []
            return data
        return []
    ctx_manifest = manifest_data.get("ctx", {}) if isinstance(manifest_data, dict) else {}
    vfs_manifest = manifest_data.get("vfs", {}) if isinstance(manifest_data, dict) else {}

    if target_key:
        entry = ctx_manifest.get(target_key) if domain == 'ctx' else (vfs_manifest.get(target_key) if domain == 'vfs' else (ctx_manifest.get(target_key) or vfs_manifest.get(target_key) or manifest_data.get(target_key)))
        if entry is None and ("/" in target_key or "\\" in target_key):
            base_name = Path(target_key).name
            entry = ctx_manifest.get(base_name) if domain == 'ctx' else (vfs_manifest.get(base_name) if domain == 'vfs' else (ctx_manifest.get(base_name) or vfs_manifest.get(base_name) or manifest_data.get(base_name)))
        return _extract(entry or {})

    all_files = set()
    target_partition = ctx_manifest if domain == 'ctx' else (vfs_manifest if domain == 'vfs' else (vfs_manifest if (manifest_data.get('vfs') or manifest_data.get('ctx')) else manifest_data))

    for k, v in target_partition.items():
        extracted = _extract(v)
        if extracted:
            if isinstance(k, str) and k.endswith('.txt'):
                all_files.add(k)
            for f in extracted:
                if isinstance(f, str):
                    all_files.add(f)
    return sorted(list(all_files))
def get_safe_repo_id(repo_dir):
    if not repo_dir: return ""
    safe_dir = f"dot_{repo_dir[1:]}" if repo_dir.startswith('.') else repo_dir
    return safe_dir.replace('-', '_')
def get_flattened_buckets(workspace_id=None, target_configs=None):
    """Backend SSOT helper for resolving flattened sub-buckets with defensive null-safety."""
    if target_configs is None:
        cfg = load_config(workspace_id)
        target_configs = cfg.get("target_repos", []) or []

    if not isinstance(target_configs, list):
        return []

    flattened = []
    for repo in target_configs:
        if not repo or not isinstance(repo, dict):
            continue
        sub_buckets = repo.get("sub_buckets") or []
        if isinstance(sub_buckets, list):
            for b in sub_buckets:
                if b and isinstance(b, dict) and not b.get("is_system"):
                    b_copy = dict(b)
                    b_copy["repo_dir"] = repo.get("repo_dir", "")
                    b_copy["repo_title"] = repo.get("title") or repo.get("repo_dir", "")
                    flattened.append(b_copy)
    return flattened
def get_available_contexts(workspace_id=None, exclusion_flags=None, exclude_types=None, include_types=None):
    from insetu.kernel.hooks import hooks
    from insetu.kernel.utils import load_config

    cfg = load_config(workspace_id)
    flags = [exclusion_flags] if isinstance(exclusion_flags, str) else (exclusion_flags or [])

    excluded_repos = set()
    if flags:
        for c in cfg.get("target_repos", []):
            if any(c.get(flag) for flag in flags):
                excluded_repos.add(c.get("repo_dir"))

    declarations = []
    for res in hooks.emit('gather_declare_topology', workspace_id=workspace_id):
        if res: declarations.extend(res)

    expected_contexts = set()
    for decl in declarations:
        meta = decl.get("meta", {})
        item_type = meta.get("type", "unknown")
        repo = meta.get("repo")

        if repo and repo in excluded_repos:
            continue
        if exclude_types and item_type in exclude_types:
            continue
        if include_types and item_type not in include_types:
            continue

        out_dir = "contexts"
        if item_type == "diff": out_dir = "diffs"
        elif item_type == "flow": out_dir = "workflows"

        expected_contexts.add(f"{out_dir}/{decl['filename']}")

    return expected_contexts
def get_sister_repos(workspace_id=None):
    cfg = load_config(workspace_id)
    return [repo.get("repo_dir") for repo in cfg.get("target_repos", []) if repo.get("repo_dir")]
def resolve_logical_path(path, workspace_id=None):
    from pathlib import Path
    import re

    if not path:
        return ""

    cfg = load_config(workspace_id)
    _, workspace_root, _ = get_workspace_physics(workspace_id)
    ws_root_path = Path(workspace_root).resolve()

    norm_path = str(path).strip().replace('\\', '/')

    # Handle absolute paths
    if Path(norm_path).is_absolute():
        resolved_abs = Path(norm_path).resolve()
        if resolved_abs.exists():
            return resolved_abs.as_posix()
        try:
            norm_path = resolved_abs.relative_to(ws_root_path).as_posix()
        except ValueError:
            norm_path = resolved_abs.name

    norm_path = re.sub(r'\.\.(?=/|$)', '', norm_path)
    norm_path = re.sub(r'/+', '/', norm_path).strip('/')

    # Handle explicit repo boundary ::
    if '::' in norm_path:
        boundary_parts = norm_path.split('::', 1)
        target_repo, downstream = boundary_parts[0], boundary_parts[1].lstrip('/')
        for repo in cfg.get("target_repos", []):
            if target_repo == repo.get("repo_dir"):
                physical_path = repo.get("physical_path")
                expanded_base = Path(physical_path).expanduser().resolve() if physical_path else (ws_root_path / target_repo).resolve()
                return expanded_base.joinpath(downstream).resolve().as_posix()
        norm_path = norm_path.replace('::', '/')

    # Pass 1: Direct match relative to workspace root
    direct_cand = ws_root_path.joinpath(norm_path).resolve()
    if direct_cand.exists():
        return direct_cand.as_posix()

    # Pass 2: Try prefixing with each target repo ({repo}/path)
    target_repos = cfg.get("target_repos", [])
    for repo in target_repos:
        repo_dir = repo.get("repo_dir")
        p_path = repo.get("physical_path")
        repo_base = Path(p_path).expanduser().resolve() if p_path else (ws_root_path / repo_dir).resolve()

        repo_cand = repo_base.joinpath(norm_path).resolve()
        if repo_cand.exists():
            return repo_cand.as_posix()
    # Pass 3: Handle redundant/duplicated repo prefixes by stripping leading repo_dir segments
    parts = [p for p in norm_path.split('/') if p]
    for repo in target_repos:
        repo_dir = repo.get("repo_dir")
        p_path = repo.get("physical_path")
        repo_base = Path(p_path).expanduser().resolve() if p_path else (ws_root_path / repo_dir).resolve()

        if parts and parts[0] == repo_dir:
            stripped_cand = repo_base.joinpath(*parts[1:]).resolve()
            if stripped_cand.exists():
                return stripped_cand.as_posix()

    # Fallback for new file creation: Anchor new paths to their target repository
    if parts:
        for repo in target_repos:
            if parts[0] == repo.get("repo_dir"):
                repo_dir = repo.get("repo_dir")
                p_path = repo.get("physical_path")
                repo_base = Path(p_path).expanduser().resolve() if p_path else (ws_root_path / repo_dir).resolve()
                return repo_base.joinpath(*parts[1:]).resolve().as_posix()

    return direct_cand.as_posix()
def get_default_repo_template(repo_dir, title=None, domain=None, description=None, exts=None):
    if not exts:
        exts = [".py", ".json", ".md", ".sh", ".txt", ".html", ".css", ".js"]
    return {
        "repo_dir": repo_dir,
        "title": title or repo_dir.replace("-", " ").replace("_", " ").title(),
        "domain": domain or "Workspaces",
        "description": description or f"Auto-initialized repository: {repo_dir}",
        "exts": exts,
        "apply_ignore": True,
        "sub_buckets": []
    }
def sanitize_workspace_config(cfg):
    cfg.pop("_settings_schemas", None)
    valid_repos = []
    seen_dirs = set()
    for repo in (cfg.get("target_repos") or []):
        if not repo or not repo.get("repo_dir") or not repo.get("repo_dir").strip():
            continue

        r_dir = repo.get("repo_dir").strip()
        repo["repo_dir"] = r_dir

        if repo.get("physical_path"):
            repo["physical_path"] = repo["physical_path"].strip()

        if r_dir in seen_dirs:
            continue
        seen_dirs.add(r_dir)

        valid_buckets = []
        for b in (repo.get("sub_buckets") or []):
            if not b or b.get("is_system"):
                continue
            if not b.get("dynamic_split_prefix"):
                if not b.get("id"):
                    title = b.get("title", "").strip()
                    b["id"] = slugify(title) if title else "untitled_bucket"
            b.pop("is_catch_all", None)
            valid_buckets.append(b)
        repo["sub_buckets"] = valid_buckets
        valid_repos.append(repo)
    cfg["target_repos"] = valid_repos
    return cfg