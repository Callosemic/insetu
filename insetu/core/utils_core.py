from pathlib import Path
import os
import json
import subprocess
from insetu.kernel.utils import load_config, get_workspace_physics, slugify, load_json_file, generate_ascii_tree, parse_uri
from insetu.kernel.hooks import hooks
import threading
import io
import re
from ruamel.yaml import YAML

def _get_yaml_engine():
    yaml = YAML(typ='rt')
    yaml.preserve_quotes = True
    yaml.indent(mapping=2, sequence=4, offset=2)
    yaml.width = 4096  # Prevent premature multi-line string wrapping
    return yaml

def parse_frontmatter(content):
    if not content:
        return {}, "", None

    yaml_match = re.search(r'^\s*---\n([\s\S]*?)\n\s*---', content)
    yaml_data = {}
    body = content

    if yaml_match:
        raw_yaml = yaml_match.group(1)
        body = content[yaml_match.end():].strip()

        if raw_yaml.strip():
            try:
                engine = _get_yaml_engine()
                parsed = engine.load(io.StringIO(raw_yaml))
                if isinstance(parsed, dict):
                    yaml_data = parsed
            except Exception as e:
                print(f"⚠️ [YAML Error] Frontmatter parse failure: {e}")

    return yaml_data, body, yaml_match
def update_frontmatter(content, new_data):
    yaml_data, body, _ = parse_frontmatter(content)

    if isinstance(yaml_data, dict):
        yaml_data.update(new_data)
    else:
        yaml_data = dict(new_data)

    engine = _get_yaml_engine()
    stream = io.StringIO()
    engine.dump(yaml_data, stream)
    formatted_yaml = stream.getvalue().strip()

    return f"---\n{formatted_yaml}\n---\n\n{body}"

def clean_date_str(val):
    """Safely normalizes varied date inputs into a standard ISO format."""
    from datetime import datetime, timedelta
    if val is None:
        return None
    if isinstance(val, (datetime, timedelta)):
        return val.isoformat()
    s = str(val).strip().strip('\'"')
    if not s or s.lower() in ('null', 'none', '0000-00-00t00:00:00', '0000-00-00'):
        return None
    return s

def get_earlier_date(d1, d2):
    """Safely compares and returns the earlier of two ISO timestamp strings."""
    from datetime import datetime
    d1_clean = clean_date_str(d1)
    d2_clean = clean_date_str(d2)
    if not d1_clean: return d2_clean
    if not d2_clean: return d1_clean
    try:
        dt1 = datetime.fromisoformat(d1_clean.replace('Z', '+00:00'))
        dt2 = datetime.fromisoformat(d2_clean.replace('Z', '+00:00'))
        return d1_clean if dt1 <= dt2 else d2_clean
    except Exception:
        return d1_clean if d1_clean <= d2_clean else d2_clean

def parse_list_field(raw_val):
    """Safely parses comma-separated strings or JSON arrays into a standardized JSON string."""
    try:
        if isinstance(raw_val, list):
            return json.dumps([str(d).strip() for d in raw_val if str(d).strip()])
        elif isinstance(raw_val, str) and raw_val.startswith('['):
            return json.dumps(json.loads(raw_val))
        elif isinstance(raw_val, str):
            return json.dumps([d.strip() for d in raw_val.split(',') if d.strip()])
    except Exception:
        pass
    return '[]'

def parse_string_enum(raw_val):
    """Safely parses and normalizes string enumerations (e.g., priority, sizes)."""
    return str(raw_val).upper() if raw_val and str(raw_val).lower() not in ('null', 'none', '') else ''
_NATIVE_VFS_WRITES = {}
_WATCHDOG_PENDING = {}
_WATCHDOG_LOCK = threading.Lock()
_WATCHDOG_DEBOUNCE_WINDOW = 10.0
_WATCHDOG_THREAD = None

def _watchdog_debouncer_loop():
    import time
    from insetu.kernel.db import get_connection
    while True:
        time.sleep(2.0)
        now = time.time()
        to_emit = {}
        with _WATCHDOG_LOCK:
            for path, data in list(_WATCHDOG_PENDING.items()):
                # Final Guardrail: Ensure the VFS didn't touch it while the timer was ticking
                if time.time() - _NATIVE_VFS_WRITES.get(path, 0) < _WATCHDOG_DEBOUNCE_WINDOW:
                    del _WATCHDOG_PENDING[path]
                    continue

                if now - data['ts'] >= _WATCHDOG_DEBOUNCE_WINDOW:
                    to_emit[path] = data
                    del _WATCHDOG_PENDING[path]
        if to_emit:
            ws_groups = {}
            for abs_key, data in to_emit.items():
                logical_path = data.get('logical_path', abs_key)
                print(f"👀 [Watchdog] Caught '{data['op']}' on: {logical_path} (after {_WATCHDOG_DEBOUNCE_WINDOW}s quiet)")
                ws_id = data['workspace_id']
                if ws_id not in ws_groups: ws_groups[ws_id] = []
                ws_groups[ws_id].append({"filepath": logical_path, "operation": data['op'], "ignore_ledger": False, "is_watchdog": True})
                try:
                    w_conn = get_connection("workers", workspace_id=ws_id)
                    w_conn.execute("INSERT OR REPLACE INTO vfs_event_log (filepath, mutation_type, timestamp) VALUES (?, ?, ?)", (path, data['op'], now))
                    w_conn.commit()
                except Exception: pass

            for ws_id, mutations in ws_groups.items():
                hooks.emit_background('vfs_mutated', workspace_id=ws_id, mutations=mutations)
@hooks.on('pre_file_save')
def _track_intent_vfs_writes(workspace_id=None, filepath=None, resolved_path=None, **kwargs):
    """Records VFS intent BEFORE disk I/O to completely seal Watchdog race conditions."""
    if not filepath: return
    import time
    now = time.time()

    # Memory Leak Prevention: Prune timestamps older than the debounce window
    if len(_NATIVE_VFS_WRITES) > 1000:
        expired = [k for k, v in _NATIVE_VFS_WRITES.items() if now - v > _WATCHDOG_DEBOUNCE_WINDOW * 2]
        for k in expired:
            del _NATIVE_VFS_WRITES[k]

    if resolved_path:
        abs_key = os.path.abspath(resolved_path).lower()
        _NATIVE_VFS_WRITES[abs_key] = now
        if abs_key in _WATCHDOG_PENDING:
            with _WATCHDOG_LOCK:
                _WATCHDOG_PENDING.pop(abs_key, None)
def start_filesystem_observer(workspace_ids):
    """Initializes a unified Watchdog observer for all active workspaces."""
    from insetu.kernel.extension import SettingsManager
    if not SettingsManager('core_system', 'default').get("enable_watchdog", True):
        return None

    active_configs = []
    for ws_id in workspace_ids:
        cfg = load_config(ws_id)
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
        def process_event(self, event, filepath_override=None, op_override=None, is_dir_override=None):
            src_path = filepath_override or event.src_path
            is_dir = is_dir_override if is_dir_override is not None else getattr(event, 'is_directory', False)
            # 🚨 O(N^2) STORM PREVENTER 🚨
            # Watchdog fires events for directories whenever their contents change.
            # Since Watchdog natively fires individual events for all files *inside* dragged-and-dropped folders anyway, 
            # we can completely ban directory events to prevent telemetry flooding and recursive OS walks.
            if is_dir:
                return

            filename = Path(src_path).name
            if filename.startswith('.') or filename.endswith('~') or filename == 'CODE_INDEX.md': return

            op = op_override or ('delete' if event.event_type == 'deleted' else 'save')
            try:
                rel_to_target = os.path.relpath(src_path, self.target_path).replace('\\', '/')
                if rel_to_target == '.' or rel_to_target == '': return
                logical_path = f"vfs://{self.repo_dir}/{rel_to_target}"

                if is_dir:
                    logical_path += '/'
                # CPU Optimization: Drop events for ignored directories/patterns before waking the Event Bus
                parts = set(p.lower() for p in logical_path.strip('/').split('/'))

                # Hardcoded OS Guardrails to prevent Watchdog infinite I/O loops and UI flooding
                if parts.intersection({'.git', '.insetu', 'node_modules', '__pycache__', 'venv'}): return

                if parts.intersection(self.ignore_dirs): return
                if any(pattern in logical_path for pattern in self.ignore_patterns): return
                import time
                now = time.time()

                logical_path_lower = logical_path.lower()
                # Deduplication 1: Was this file recently modified natively by our own VFS?
                abs_key = os.path.abspath(src_path).lower()
                if now - _NATIVE_VFS_WRITES.get(abs_key, 0) < _WATCHDOG_DEBOUNCE_WINDOW:
                    return
                # Deduplication 2: Unified Trailing Debounce
                global _WATCHDOG_THREAD
                with _WATCHDOG_LOCK:
                    _WATCHDOG_PENDING[abs_key] = {'op': op, 'workspace_id': self.workspace_id, 'ts': time.time(), 'logical_path': logical_path}
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
    """Provides logical vfs://repo/path boundary resolution to the Kernel VFS."""
    if filepath:
        is_artifact = filepath.startswith("ctx://") or filepath.startswith("contexts/") or filepath.startswith("diffs/") or filepath.startswith("workflows/")
        if is_artifact:
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
def get_domain_artifact_path(workspace_id, domain_name):
    """Resolves and ensures physical existence of standard .insetu/data/<domain_name> directory."""
    from pathlib import Path
    import os
    from insetu.kernel.utils import get_workspace_physics

    try:
        cfg_path, _, _ = get_workspace_physics(workspace_id)
        domain_dir = Path(cfg_path).parent.joinpath("data", domain_name).resolve().as_posix()
        os.makedirs(domain_dir, exist_ok=True)
        return domain_dir
    except Exception:
        return f".insetu/data/{domain_name}"


def get_safe_repo_id(repo_dir):
    if not repo_dir: return ""
    safe_dir = f"dot_{repo_dir[1:]}" if repo_dir.startswith('.') else repo_dir
    return safe_dir.replace('-', '_')
def vacuum_manifest_artifacts(ctx, domain_dir, expected_artifacts_set, exempt_abs_paths=None):
    """
    Centralized garbage collector for compiled context artifacts.
    Sweeps a specific VFS domain directory and deletes any .txt files
    that are not explicitly declared in the expected_artifacts_set.
    """
    import os
    from pathlib import Path

    if not os.path.exists(domain_dir):
        return

    exemptions = exempt_abs_paths or set()

    for ws_rel_path in ctx.vfs.walk(domain_dir, exts=['.txt']):
        f_path = ctx.resolve_path(ws_rel_path)
        f_basename = Path(f_path).name

        if f_path not in exemptions and f_basename not in expected_artifacts_set and f_basename != "manifest.json":
            try:
                ctx.vfs.delete(ws_rel_path)
            except Exception:
                pass
def reconcile_and_vacuum_domain(ctx, domain_uri_prefix, manifest_deltas, domain_dir, filename_suffix="_context.txt", target_repos=None):
    """
    SSOT reconciler: Identifies orphaned domain manifest entries, merges deltas,
    persists manifest state, and vacuums orphaned text artifacts on disk.
    """
    from pathlib import Path
    current_manifest = ctx.manifest.get("ctx", {})
    expected_artifacts = set()
    active_keys = set()

    # 1. Register new/updated deltas
    for filename, entry in manifest_deltas.items():
        if entry:
            active_keys.add(filename)
            chunks = entry.get("chunks", [filename])
            expected_artifacts.update(Path(c).name for c in chunks)

    # 2. Identify orphaned manifest keys in this domain
    for k, v in list(current_manifest.items()):
        if domain_uri_prefix in k and k.endswith(filename_suffix):
            repo = v.get("meta", {}).get("repo") if isinstance(v, dict) else None
            is_targeted = target_repos and (repo in target_repos if repo else True)
            if k not in active_keys and (target_repos is None or is_targeted):
                manifest_deltas[k] = None
            else:
                chunks = v.get("chunks", [k]) if isinstance(v, dict) else [k]
                expected_artifacts.update(Path(c).name for c in chunks)

    # 3. Commit manifest changes & sync barrier
    if manifest_deltas:
        for k, v in manifest_deltas.items():
            if v is None:
                current_manifest.pop(k, None)
            else:
                current_manifest[k] = v
        ctx.save_manifest(manifest_deltas, is_full_compile=False)
        ctx.sync_vfs_barrier()

    # 4. Sweep disk for orphaned files
    vacuum_manifest_artifacts(ctx, domain_dir, expected_artifacts)

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
        filename = decl.get("filename", "")
        if filename:
            expected_contexts.add(filename)

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
    # Centralized URI parsing to extract repository boundaries safely BEFORE slash collapsing
    repo_dir, rel_path = parse_uri(norm_path)

    rel_path_str = str(rel_path).strip().replace('\\', '/')
    rel_path_str = re.sub(r'\.\.(?=/|$)', '', rel_path_str)
    rel_path_str = re.sub(r'/+', '/', rel_path_str).strip('/')
    target_repos = cfg.get("target_repos", [])
    # Map logical workspace bounds ({repo}/path) to physical disk paths deterministically
    for repo in target_repos:
        if repo_dir == repo.get("repo_dir"):
            p_path = repo.get("physical_path")
            if p_path:
                repo_base = Path(p_path).expanduser().resolve()
            elif ws_root_path.name == repo_dir:
                repo_base = ws_root_path
            else:
                repo_base = (ws_root_path / repo_dir).resolve()

            return repo_base.joinpath(rel_path_str).resolve().as_posix()

    # Fallback to standard sandbox resolution (reconstruct clean path without schemes)
    clean_fallback = f"{repo_dir}/{rel_path_str}".strip('/')
    return ws_root_path.joinpath(clean_fallback).resolve().as_posix()


def find_path_candidates(query_path, workspace_id=None, allowed_repos=None):
    """
    Explicit, opt-in candidate finder for path disambiguation.
    Principal consumer is the Yomama Sync Bridge.
    """
    if not query_path:
        return []

    from insetu.core.topology.engine_topology import get_omniscient_workspace_files
    clean_query = str(query_path).replace('\\', '/').strip('/')
    clean_query = clean_query.replace('vfs://', '').replace('ctx://', '')
    query_basename = Path(clean_query).name.lower()

    omniscient = get_omniscient_workspace_files(workspace_id, allowed_repos)
    candidates = []

    for cand_basename, cand_rel in omniscient:
        cand_basename_lower = cand_basename.lower()
        cand_rel_lower = cand_rel.lower()

        if cand_rel_lower == clean_query.lower():
            candidates.append({"filepath": cand_rel, "score": 1.0, "match_type": "exact_match"})
        elif cand_basename_lower == query_basename:
            score = 0.9 if clean_query.lower() in cand_rel_lower else 0.8
            candidates.append({"filepath": cand_rel, "score": score, "match_type": "basename_match"})
        elif clean_query.lower() in cand_rel_lower or cand_rel_lower.endswith(clean_query.lower()):
            candidates.append({"filepath": cand_rel, "score": 0.7, "match_type": "subpath_match"})

    candidates.sort(key=lambda x: x["score"], reverse=True)
    return candidates
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