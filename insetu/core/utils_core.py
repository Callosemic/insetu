from pathlib import Path
import os
import json
import subprocess
from akasa.utils import load_config, get_workspace_physics, slugify, load_json_config, generate_ascii_tree, parse_uri
from akasa.hooks import hooks
import threading
import io
import re
from ruamel.yaml import YAML
from akasa.uri import AkasaURI

class InSetuURI(AkasaURI):
    """
    Host application subclass injecting domain-specific routing aliases.
    """
    @property
    def repo(self) -> str:
        return self.volume
    @property
    def is_diff(self) -> bool:
        return self.scheme == 'ctx' and self.volume == 'diffs'

    def bucket(self, workspace_id=None):
        from insetu.core.topology.engine_topology import resolve_file_bucket
        from akasa.utils import load_config

        cfg = load_config(workspace_id)
        for repo_cfg in cfg.get("target_repos", []):
            if repo_cfg.get("repo_dir") == self.repo:
                sub_buckets = repo_cfg.get("sub_buckets", [])
                b, module = resolve_file_bucket(self.path, sub_buckets, repo_dir=self.repo)
                return module if b and module else (b.get("id") if b else "main")
        return "main"


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
def resolve_macro_includes(text, current_filepath, pattern, read_callback, depth=0):
    import re
    if depth > 5:
        return text + "\n[!] INCLUSION DEPTH LIMIT EXCEEDED"
    def replacer(match):
        include_path = match.group(1).strip()
        params_str = match.group(2) if len(match.groups()) > 1 and match.group(2) else ""

        if include_path.startswith('./') or include_path.startswith('../'):
            parts = current_filepath.split('/')[:-1]
            for p in include_path.split('/'):
                if p == '.': continue
                elif p == '..': 
                    if parts: parts.pop()
                else: parts.append(p)
            target_path = '/'.join(parts)
        else:
            target_path = include_path.lstrip('/')

        inc_content = read_callback(target_path)
        if inc_content is not None:
            if params_str:
                param_matches = re.finditer(r'([a-zA-Z0-9_]+)\s*:\s*(?:"([^"]*)"|([^;}]*))', params_str)
                for pm in param_matches:
                    key = pm.group(1)
                    val = pm.group(2) if pm.group(2) is not None else pm.group(3).strip()
                    macro_pattern = r'\{\{\s*macro_' + re.escape(key) + r'\s*\}\}'
                    inc_content = re.sub(macro_pattern, val, inc_content)
            return resolve_macro_includes(inc_content, target_path, pattern, read_callback, depth + 1)
        else:
            return f"[!] MACRO TARGET NOT FOUND: {include_path}"

    return re.sub(pattern, replacer, text)
def _get_base_step_and_diffs(lines):
    """Analyzes a block of code to find its true structural base indentation unit (LCD > 1)."""
    indents = sorted(list(set(len(line) - len(line.lstrip()) for line in lines if line.strip())))
    if len(indents) > 1:
        diffs = [indents[k+1] - indents[k] for k in range(len(indents)-1)]
        valid_diffs = [d for d in diffs if d > 1]

        if valid_diffs:
            best_step = 4
            min_error = float('inf')

            for S in [4, 2, 3, 8]:
                error = 0
                has_base_jump = False

                for d in valid_diffs:
                    k = max(1, int(round(d / S)))
                    if k == 1:
                        has_base_jump = True
                    error += abs(d - (k * S))

                if not has_base_jump:
                    error += 1000 

                if error < min_error:
                    min_error = error
                    best_step = S

            return best_step, diffs
    return 4, []

def parse_blocks(text):
    import re
    files = {}
    current_file = None
    state = "OUTSIDE"
    current_type = "exact"
    search_lines, replace_lines = [], []

    if "<<<<<<< FILE:" in text:
        text = "<<<<<<< FILE:" + text.split("<<<<<<< FILE:", 1)[1]

    text = re.sub(
        r'^[ \t\xa0]*(?:>[ \t\xa0]*)+REPLACE[ \t\xa0]*(?:\n[ \t\xa0]*(?:>[ \t\xa0]*)+$)*',
        '>>>>>>> REPLACE',
        text,
        flags=re.MULTILINE
    )

    lines = text.replace('\r\n', '\n').replace('\xa0', ' ').split('\n')
    for line in lines:
        if line.startswith("<<<<<<< FILE:"):
            current_file = line.replace("<<<<<<< FILE:", "").strip()
            if current_file not in files: files[current_file] = []
            state = "OUTSIDE"
        elif line.startswith("<<<<<<< SEARCH"):
            state = "SEARCH"
            search_lines = []
            current_type = "regex" if "REGEX" in line else "exact"
        elif line.startswith("======="):
            if state == "SEARCH":
                state = "REPLACE"
                replace_lines = []
            elif state == "OUTSIDE" and current_file:
                print(f"  [~] Warning: Missing '<<<<<<< SEARCH' tag detected for {current_file}. Auto-healing as a genesis patch.")
                state = "REPLACE"
                search_lines = []
                replace_lines = []
        elif line.startswith(">>>>>>> REPLACE"):
            if state == "REPLACE" and current_file:
                files[current_file].append({
                    "type": current_type,
                    "search": "\n".join(search_lines),
                    "replace": "\n".join(replace_lines)
                })
            state = "OUTSIDE"
        else:
            if state == "SEARCH": search_lines.append(line)
            elif state == "REPLACE": replace_lines.append(line)
    return files

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
_WATCHDOG_DEBOUNCE_WINDOW = 2.0
_WATCHDOG_THREAD = None

def _watchdog_debouncer_loop():
    import time
    from akasa.db import get_connection
    while True:
        time.sleep(2.0)
        now = time.time()
        to_emit = {}
        with _WATCHDOG_LOCK:
            for cache_key, data in list(_WATCHDOG_PENDING.items()):
                abs_key = data['abs_key']
                # Final Guardrail: Ensure the VFS didn't touch it while the timer was ticking
                if time.time() - _NATIVE_VFS_WRITES.get(abs_key, 0) < _WATCHDOG_DEBOUNCE_WINDOW:
                    del _WATCHDOG_PENDING[cache_key]
                    continue

                if now - data['ts'] >= _WATCHDOG_DEBOUNCE_WINDOW:
                    to_emit[cache_key] = data
                    del _WATCHDOG_PENDING[cache_key]
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
                    w_conn.execute("INSERT OR REPLACE INTO vfs_event_log (filepath, mutation_type, timestamp) VALUES (?, ?, ?)", (logical_path, data['op'], now))
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
        with _WATCHDOG_LOCK:
            keys_to_remove = [k for k in _WATCHDOG_PENDING.keys() if k[1] == abs_key]
            for k in keys_to_remove:
                del _WATCHDOG_PENDING[k]
@hooks.on('start_filesystem_observer')
def start_filesystem_observer(workspace_ids=None, **kwargs):
    """Initializes a unified Watchdog observer for all active workspaces."""
    from akasa.extension import SettingsManager
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
        print("⚠️  Optional package 'watchdog' not found. External modifications require full sweeps.")
        return None
    except Exception as e:
        print(f"⚠️  Watcher initialization failed: {e}")
        return None

    class FileSystemObserver(FileSystemEventHandler):
        def __init__(self, workspace_id, repo_dir, target_path, ignore_dirs, ignore_patterns, ignore_exceptions=None):
            super().__init__()
            self.workspace_id = workspace_id
            self.repo_dir = repo_dir
            self.target_path = target_path
            self.ignore_dirs = ignore_dirs
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

                is_excepted = any(rel_to_target.startswith(exc) or exc in rel_to_target for exc in self.ignore_exceptions)
                if not is_excepted:
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
                    cache_key = (self.workspace_id, abs_key)
                    _WATCHDOG_PENDING[cache_key] = {'op': op, 'workspace_id': self.workspace_id, 'ts': time.time(), 'logical_path': logical_path, 'abs_key': abs_key}
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
        _, ws_root = get_workspace_physics(ws_id)
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
                ignore_exceptions = repo_cfg.get("ignore_exceptions") or []
                handler = FileSystemObserver(
                    workspace_id=ws_id,
                    repo_dir=r_dir,
                    target_path=target_path,
                    ignore_dirs=ignore_dirs,
                    ignore_patterns=ignore_patterns,
                    ignore_exceptions=ignore_exceptions
                )
                observer.schedule(handler, target_path, recursive=True)
                has_watches = True

    if has_watches:
        observer.start()
        print("👁️  Native Filesystem Watchers Engaged.")
    return observer
def load_workflows(workspace_id=None):
    cfg_path, _ = get_workspace_physics(workspace_id)
    wf_path = Path(cfg_path).parent.joinpath("workflows.json").as_posix()
    return load_json_config(wf_path, {"context_batches": []})

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
def get_domain_artifact_path(workspace_id, domain_name, ext_name=None):
    """Resolves and ensures physical existence of standard .insetu/ext/<ext_name>/data/<domain_name> directory."""
    from pathlib import Path
    import os
    from akasa.utils import get_workspace_physics

    ext = ext_name or domain_name
    try:
        cfg_path, _ = get_workspace_physics(workspace_id)
        domain_dir = Path(cfg_path).parent.joinpath("ext", ext, "data", domain_name).resolve().as_posix()
        os.makedirs(domain_dir, exist_ok=True)
        return domain_dir
    except Exception:
        return f".insetu/ext/{ext}/data/{domain_name}"


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

    resolved_dir = ctx.resolve_path(domain_dir)
    if not resolved_dir or not os.path.exists(resolved_dir):
        return
    exemptions = exempt_abs_paths or set()
    for ws_rel_path in ctx.vfs.walk(domain_dir, exts=['.txt']):
        f_path = ctx.resolve_path(ws_rel_path)
        f_basename = InSetuURI(ws_rel_path).basename

        if f_path not in exemptions and f_basename not in expected_artifacts_set and f_basename != "manifest.json":
            try:
                ctx.vfs.delete(ws_rel_path, data={"ignore_ledger": True})
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
            expected_artifacts.update(InSetuURI(c).basename for c in chunks)

    # 2. Identify orphaned manifest keys in this domain
    for k, v in list(current_manifest.items()):
        if domain_uri_prefix in k and k.endswith(filename_suffix):
            repo = v.get("meta", {}).get("repo") if isinstance(v, dict) else None
            is_targeted = target_repos and (repo in target_repos if repo else True)
            if k not in active_keys and (target_repos is None or is_targeted):
                manifest_deltas[k] = None
            else:
                chunks = v.get("chunks", [k]) if isinstance(v, dict) else [k]
                expected_artifacts.update(InSetuURI(c).basename for c in chunks)

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
    from akasa.hooks import hooks
    from akasa.utils import load_config

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
def get_repo_path(repo_dir, workspace_id=None):
    """SSOT for resolving a repository's physical override or logical path."""
    import os
    from akasa.utils import load_config
    cfg = load_config(workspace_id)
    for c in cfg.get("target_repos", []):
        if c.get("repo_dir") == repo_dir and c.get("physical_path"):
            return os.path.abspath(os.path.expanduser(c.get("physical_path")))

    # Fallback to standard sandbox resolution
    from akasa.vfs import _resolve_physical_path
    resolved = _resolve_physical_path(f"vfs://{repo_dir}", workspace_id)
    if not resolved:
        from akasa.utils import get_workspace_physics
        from pathlib import Path
        _, ws_root = get_workspace_physics(workspace_id)
        return Path(ws_root).joinpath(repo_dir).as_posix()
    return resolved

def get_sister_repos(workspace_id=None):
    cfg = load_config(workspace_id)
    return [repo.get("repo_dir") for repo in cfg.get("target_repos", []) if repo.get("repo_dir")]
def resolve_logical_path(path, workspace_id=None):
    from pathlib import Path
    from insetu.core.utils_core import InSetuURI

    if not path:
        return ""

    cfg = load_config(workspace_id)
    _, workspace_root = get_workspace_physics(workspace_id)
    ws_root_path = Path(workspace_root).resolve()

    uri = InSetuURI(str(path))

    # If absolute, bypass normal boundaries but safely attempt stripping
    if Path(uri.path).is_absolute():
        resolved_abs = Path(uri.path).resolve()
        if resolved_abs.exists():
            return resolved_abs.as_posix()
        try:
            norm_path = resolved_abs.relative_to(ws_root_path).as_posix()
        except ValueError:
            norm_path = resolved_abs.name
        uri = InSetuURI(norm_path)

    target_repos = cfg.get("target_repos", [])

    # Reconstruct the full logical path
    clean_fallback = f"{uri.volume}/{uri.path}".strip('/') if uri.volume else uri.path

    # Map logical workspace bounds by matching the longest registered repo_dir prefix
    best_repo = None
    best_rel_path = ""
    for repo in target_repos:
        r_dir = repo.get("repo_dir")
        if not r_dir: continue
        if clean_fallback == r_dir or clean_fallback.startswith(r_dir + '/'):
            if not best_repo or len(r_dir) > len(best_repo.get("repo_dir")):
                best_repo = repo
                best_rel_path = clean_fallback[len(r_dir):].lstrip('/')

    if best_repo:
        p_path = best_repo.get("physical_path")
        if p_path:
            repo_base = Path(p_path).expanduser().resolve()
        elif ws_root_path.name == best_repo.get("repo_dir"):
            repo_base = ws_root_path
        else:
            repo_base = (ws_root_path / best_repo.get("repo_dir")).resolve()

        return repo_base.joinpath(best_rel_path).resolve().as_posix()

    # Fallback to standard sandbox resolution
    return ws_root_path.joinpath(clean_fallback).resolve().as_posix()
@hooks.on('expand_selection')
def hook_expand_selection(items=None, workspace_id=None, **kwargs):
    from akasa.vfs import VFSTransaction
    from akasa.hooks import hooks
    from insetu.core.utils_core import InSetuURI

    vfs_manifest_res = hooks.emit('request_vfs_manifest', workspace_id=workspace_id)
    vfs_manifest = next((m for m in vfs_manifest_res if m), {})
    tracked_files = set()
    for bucket in vfs_manifest.values():
        tracked_files.update(bucket.get('files', []))
    files = []
    with VFSTransaction(workspace_id) as vfs:
        for item in items:
            if isinstance(item, str):
                uri_obj = InSetuURI(item)
                if not uri_obj.scheme:
                    if uri_obj.basename.endswith('_context.txt'): 
                        uri_obj = InSetuURI(f"ctx://contexts/{uri_obj.path}")
                    elif uri_obj.basename.endswith('_diffs.txt'): 
                        uri_obj = InSetuURI(f"ctx://diffs/{uri_obj.path}")
                    elif uri_obj.path.startswith('prompts/'): 
                        uri_obj = InSetuURI(f"ctx://{uri_obj.path}")
                    else: 
                        uri_obj = InSetuURI(f"vfs://{uri_obj.path}")

                if uri_obj.is_dir and uri_obj.scheme == 'vfs':
                    item = {'folderpath': uri_obj.path}
                else:
                    item = {'filepath': f"{uri_obj.scheme}://{uri_obj.volume}/{uri_obj.path}".replace('//', '/').replace(':/', '://')}

            if 'filepath' in item:
                filepath = item['filepath']
                uri_obj = InSetuURI(filepath)

                if uri_obj.scheme == 'ctx':
                    responses = hooks.emit('resolve_payload_chunks', uri=filepath, workspace_id=workspace_id)
                    chunks = next((r for r in responses if r), [filepath])
                    files.extend(chunks)
                else:
                    files.append(filepath if uri_obj.scheme == 'vfs' else f"vfs://{filepath}")
            elif 'folderpath' in item:
                folderpath = item['folderpath']
                uri_obj = InSetuURI(folderpath)
                target_walk = uri_obj.path

                for f in vfs.walk(target_walk):
                    if f in tracked_files:
                        files.append(f if InSetuURI(f).scheme == 'vfs' else f"vfs://{f}")

    unique_files = []
    seen = set()
    for f in files:
        if f not in seen:
            seen.add(f)
            unique_files.append(f)
    return unique_files

@hooks.on('find_path_candidates')
def find_path_candidates(query_path=None, workspace_id=None, allowed_repos=None, **kwargs):
    """
    Explicit, opt-in candidate finder for path disambiguation.
    Principal consumer is the Yomama Sync Bridge.
    """
    if not query_path:
        return []
    from insetu.core.topology.engine_topology import get_omniscient_workspace_files
    clean_query = InSetuURI(str(query_path)).path.replace('\\', '/').strip('/')
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