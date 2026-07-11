from pathlib import Path
import os
import json
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Shift spatial physics to the terminal's Current Working Directory,
# but enforce the universal sibling-repo architecture (repos are one level up).

_cwd = os.getcwd()
def sniff_tenant_id():
    """Universal helper to extract the active workspace tenant from Flask headers."""
    try:
        from flask import request
        if request and 'X-Workspace-ID' in request.headers:
            return request.headers['X-Workspace-ID']
    except RuntimeError:
        pass
    return "default"
def get_physics_for(workspace_id):
    """
    STATELESS ROUTING CORE CHASSIS
    Resolves spatial physics dynamically for the specified request tenant ID.
    """
    return get_workspace_physics(workspace_id)

def get_workspace_physics(workspace_id=None):
    """
    STATELESS ROUTING CORE
    Resolves spatial physics dynamically based on the requested tenant ID.
"""
    if not workspace_id:
        workspace_id = sniff_tenant_id()

    local_insetu_dir = Path(_cwd).joinpath(".insetu").as_posix()
    default_config = Path(local_insetu_dir).joinpath("config.json").as_posix()
    index_path = Path(local_insetu_dir).joinpath("workspaces.json").as_posix()

    # 1. Environment Variable Override (Overrides everything)
    env_config = os.environ.get("INSETU_CONFIG")
    if env_config:
        resolved_cfg = os.path.abspath(os.path.expanduser(env_config))
        return resolved_cfg, _cwd, Path(resolved_cfg).parent.joinpath("workflows.json").as_posix()

    target_ws = workspace_id
    if not target_ws:
        if os.path.exists(index_path):
            try:
                with open(index_path, 'r', encoding='utf-8') as f: w_data = json.load(f)
                target_ws = w_data.get("active_workspace", "default")
            except Exception:
                target_ws = "default"
        else:
            target_ws = "default"

    # 2. Host Workspace Switchboard
    resolved_cfg = default_config
    cfg_path = None

    if os.path.exists(index_path):
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                w_data = json.load(f)
            if target_ws in w_data.get("workspaces", {}):
                cfg_path = w_data["workspaces"][target_ws].get("config_path")
        except Exception:
            pass

    if cfg_path:
        if not os.path.isabs(os.path.expanduser(cfg_path)):
            resolved_cfg = os.path.abspath(Path(local_insetu_dir).joinpath(cfg_path).as_posix())
        else:
            resolved_cfg = os.path.abspath(os.path.expanduser(cfg_path))

    if not os.path.exists(resolved_cfg):
        resolved_cfg = default_config
    # 3. Resolve Workspace Root
    workflows_path = Path(resolved_cfg).parent.joinpath("workflows.json").as_posix()
    if os.path.exists(resolved_cfg):
        try:
            with open(resolved_cfg, 'r', encoding='utf-8') as f: c_data = json.load(f)
            if "workspace_root" in c_data:
                return resolved_cfg, Path(c_data["workspace_root"]).expanduser().resolve().as_posix(), workflows_path
        except Exception:
            pass

        return resolved_cfg, Path(resolved_cfg).parent.parent.as_posix(), workflows_path

    return resolved_cfg, _cwd, workflows_path
def get_gather_paths(workspace_id=None):
    """Dynamically calculates artifact physics for the requested tenant."""
    cfg_path, ws_root, wf_path = get_workspace_physics(workspace_id)
    workspace_dir = os.path.dirname(cfg_path)
    artifacts_base = Path(workspace_dir).joinpath("data").as_posix()

    paths = {
        "config_path": cfg_path,
        "workspace_root": ws_root,
        "workflows_path": wf_path,
        "artifacts_base": artifacts_base,
        "contexts_dir": Path(artifacts_base).joinpath("contexts").as_posix(),
        "prompts_dir": Path(workspace_dir).joinpath("prompts").as_posix(),
        "diffs_dir": Path(artifacts_base).joinpath("diffs").as_posix(),
        "gather_dir": Path(artifacts_base).joinpath("workflows").as_posix()
    }

    os.makedirs(paths["contexts_dir"], exist_ok=True)
    os.makedirs(paths["prompts_dir"], exist_ok=True)
    os.makedirs(paths["diffs_dir"], exist_ok=True)
    os.makedirs(paths["gather_dir"], exist_ok=True)
    return paths
def is_extension_enabled(ext_name, workspace_id=None):
    """Universal SSOT helper to verify if an optional extension is enabled for a tenant."""
    cfg = load_config(workspace_id)
    return ext_name in cfg.get("extensions", [])


def extension_auth(ext_name):
    """
    SECURITY GUARDRAIL
    Intercepts API requests to ensure the requested extension is active in the targeted tenant's config.json.
"""
    def decorator(f):
        import functools
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            from flask import jsonify
            # The physics engine automatically resolves the tenant config via the HTTP headers
            cfg = load_config()
            if ext_name not in cfg.get("extensions", []):
                return jsonify({"error": f"403 Forbidden: Extension '{ext_name}' is not enabled in this workspace."}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator
# Module-level globals dismantled. All physics calculations are request-scoped functions.

_JSON_CACHE = {}
_JSON_MTIME = {}

def load_json_file(filepath, default_fallback=None):
    global _JSON_CACHE, _JSON_MTIME
    if default_fallback is None:
        default_fallback = {}

    if not filepath or not os.path.exists(filepath):
        return default_fallback

    current_mtime = os.path.getmtime(filepath)
    if filepath not in _JSON_CACHE or current_mtime > _JSON_MTIME.get(filepath, 0):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                _JSON_CACHE[filepath] = json.load(f)
        except Exception:
            _JSON_CACHE[filepath] = default_fallback
        _JSON_MTIME[filepath] = current_mtime

    return _JSON_CACHE[filepath]
def save_json_file(filepath, data, workspace_id=None):
    global _JSON_CACHE, _JSON_MTIME

    # Write through VFS pipeline if it's a configuration mutation to avoid blocking HTTP threads
    if filepath.endswith('config.json') or filepath.endswith('workflows.json'):
        from insetu.routes_fs import _VFS_WRITE_QUEUE
        try:
            wid = workspace_id or sniff_tenant_id()
            if not wid:
                print(f"⚠️ [Security] Context Leak Prevented: save_json_file lacks workspace_id for {filepath}.")
                wid = "default"
            _VFS_WRITE_QUEUE.put((wid, filepath, json.dumps(data, indent=2), {"is_absolute_artifact": True}))
        except Exception:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
    else:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)

    _JSON_CACHE[filepath] = data
    _JSON_MTIME[filepath] = 0  # Explicitly force mtime invalidation to bypass cache collisions
def load_config(workspace_id=None):
    cfg_path, _, _ = get_workspace_physics(workspace_id)
    cfg = load_json_file(cfg_path, {})
    from insetu.hooks import hooks
    hooks.emit('mutate_workspace_config', cfg, workspace_id=workspace_id)

    return cfg
def load_workflows(workspace_id=None):
    _, _, wf_path = get_workspace_physics(workspace_id)
    return load_json_file(wf_path, {"context_batches": []})

def get_valid_workspace_files(repo_path, config, workspace_id=None):
    """Universal SSOT for extracting valid files respecting context filters and ignore rules."""
    live_cfg = load_config(workspace_id)
    global_ignore_dirs = set(live_cfg.get("ignore_dirs", []))
    global_ignore_files = set(live_cfg.get("ignore_files", []))
    global_ignore_patterns = live_cfg.get("ignore_patterns", [])

    ignore_dirs = global_ignore_dirs.union(config.get("repo_ignore_dirs", []))
    ignore_files = global_ignore_files.union(config.get("repo_ignore_files", []))
    ignore_patterns = global_ignore_patterns + config.get("repo_ignore_patterns", [])
    archive_type = config.get("archive_type", "repo")

    if archive_type == "repo":
        # Self-Healing Git Layer Integrity Guard
        if os.path.exists(repo_path):
            try:
                check_tree = subprocess.run(['git', 'rev-parse', '--is-inside-work-tree'], 
                                            capture_output=True, text=True, cwd=repo_path)
                if check_tree.returncode != 0 or 'true' not in check_tree.stdout.lower():
                    # Truly untracked standalone directory detected: safely seed Git architecture
                    subprocess.run(['git', 'init'], capture_output=True, cwd=repo_path)

                    # Drop an empty anchor if the folder was completely barren
                    if not os.listdir(repo_path) or (len(os.listdir(repo_path)) == 1 and '.git' in os.listdir(repo_path)):
                        with open(Path(repo_path).joinpath('.gitkeep').as_posix(), 'w') as f: pass
            except Exception:
                pass
        try:
            result = subprocess.run(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], 
                                            capture_output=True, text=True, check=True, cwd=repo_path)
            git_files = set(result.stdout.splitlines())
        except Exception:
            git_files = set()
            for p in Path(repo_path).rglob('*'):
                    if p.is_file():
                        try:
                            git_files.add(p.relative_to(repo_path).as_posix())
                        except ValueError:
                            pass
    else:
        # "media-vault" or future custom archive types bypass Git entirely
        git_files = set()
        for p in Path(repo_path).rglob('*'):
            if p.is_file():
                    try:
                        git_files.add(p.relative_to(repo_path).as_posix())
                    except ValueError:
                        pass

    valid_files = set()
    repo_p = Path(repo_path)

    for file in git_files:
        norm_path = file
        if norm_path.startswith("./"): norm_path = norm_path[2:]
        if config.get("prefix") and not norm_path.startswith(config.get("prefix")): continue

        target_f = repo_p / norm_path
        if not target_f.is_file(): continue
        if target_f.name.lower() in ignore_files: continue

        if config.get("apply_ignore"):
            if any(norm_path.startswith(exc) for exc in config.get("ignore_exceptions", [])):
                    pass
            else:
                    if set(p.lower() for p in norm_path.split('/')).intersection(ignore_dirs): continue
                    if any(pattern in norm_path for pattern in ignore_patterns): continue

        # Always allow standard empty-directory anchors
        if target_f.name.lower() in (".gitkeep", ".keep"):
            valid_files.add(norm_path)
            continue

        ext = target_f.suffix.lower()

        # Merge global extensions with repo-specific extensions
        allowed_exts = set(live_cfg.get("include_extensions", []) + config.get("exts", []))
        if ext in allowed_exts: valid_files.add(norm_path)

    for forced_file in config.get("force_include", []):
        if (repo_p / forced_file).exists(): 
            valid_files.add(forced_file)

    return sorted(list(valid_files))
def parse_frontmatter(content):
    """Extracts YAML frontmatter and body from a markdown string."""
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
    """Updates or injects YAML frontmatter in a markdown string."""
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
    """Pure generator that yields concatenated text strings safely under a byte/char limit."""
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
def get_available_contexts(workspace_id=None):
    """
    SSOT Helper: Computes all expected and active context artifacts across the workspace.
    This provides a centralized directory map for any extension that needs to
    know what context files the system is capable of producing.
    """
    cfg = load_config(workspace_id)
    paths = get_gather_paths(workspace_id)

    expected_contexts = set()

    for c in cfg.get("target_repos", []):
        r_dir = c.get("repo_dir", "")
        safe_r_dir = get_safe_repo_id(r_dir)
        subs = c.get("sub_buckets", [])

        # Every repository inherently has an implicit catch-all bucket for unmapped files.
        out = c.get("out_file", f"{safe_r_dir}_context.txt")
        expected_contexts.add(f"contexts/{out}")

        if subs:
            for b in subs:
                if not b.get("dynamic_split_prefix"):
                    sub_out = b.get("out_file", f"{r_dir}_{b.get('id')}_context.txt")
                    expected_contexts.add(f"contexts/{sub_out}")
                else:
                    dyn_dir = Path(paths["workspace_root"]).joinpath(r_dir, b["dynamic_split_prefix"]).as_posix()
                    if os.path.exists(dyn_dir):
                        for module in os.listdir(dyn_dir):
                            if os.path.isdir(Path(dyn_dir).joinpath(module).as_posix()) and not module.startswith('.'):
                                expected_contexts.add(f"contexts/{module}_context.txt")
    # Read the active manifest for dynamic/ephemeral contexts
    manifest_path = Path(paths["contexts_dir"]).joinpath("manifest.json").as_posix()
    manifest_data = load_json_file(manifest_path, {})
    for key in manifest_data.keys():
        if key.endswith('_context.txt'):
            expected_contexts.add(f"contexts/{key}")

    return expected_contexts

def get_safe_repo_id(repo_dir):
    """Sanitizes repo directories into safe file prefixes (e.g., '.insetu' -> 'dot_insetu')."""
    if not repo_dir: return ""
    safe_dir = f"dot_{repo_dir[1:]}" if repo_dir.startswith('.') else repo_dir
    return safe_dir.replace('-', '_')
def get_omniscient_workspace_files(workspace_id, allowed_repos):
    """
    SSOT OMNISCIENT SWEEP
    Centralizes all filesystem scanning loops to safely protect critical system 
    nodes (like .git) without duplicating walk arrays across controllers.
"""
    from pathlib import Path

    cfg_path, ws_root, _ = get_workspace_physics(workspace_id)
    ws_root_path = Path(ws_root).resolve()
    live_cfg = load_config(workspace_id)
    ignore_dirs = tuple(live_cfg.get("ignore_dirs", ['node_modules', '__pycache__', 'venv', '.venv', '.insetu', '.git']))
    managed_dirs = set(live_cfg.get("managed_dirs", []))

    search_roots = [Path(cfg_path).parent.resolve()]
    for repo in allowed_repos:
        repo_path = ws_root_path / repo
        if repo_path.exists():
            search_roots.append(repo_path)
    search_roots = list(set(search_roots))

    candidates = []
    for s_root in search_roots:
        for root, dirs, files in os.walk(str(s_root)):
            dirs[:] = [d for d in dirs if (not d.startswith('.') or d in managed_dirs) and d not in ignore_dirs]
            for f in files:
                cand_abs = Path(root) / f
                try:
                    cand_rel = cand_abs.relative_to(ws_root_path).as_posix()
                except ValueError:
                    cand_rel = cand_abs.as_posix()
                candidates.append((f, cand_rel))
    return candidates
def get_sister_repos(workspace_id=None):
    cfg = load_config(workspace_id)
    return [repo.get("repo_dir") for repo in cfg.get("target_repos", []) if repo.get("repo_dir")]
def resolve_workspace_path(path, workspace_id=None):
    from pathlib import Path
    import re

    _, workspace_root, _ = get_workspace_physics(workspace_id)
    ws_root_path = Path(workspace_root).resolve()

    norm_path = path
    # Prevent absolute path traversal containment breaches
    if Path(norm_path).is_absolute():
        resolved_abs = Path(norm_path).resolve()
        # Check if the target is explicitly wrapped inside an 
        # authorized physical target repository
        cfg = load_config(workspace_id)
        for repo in cfg.get("target_repos", []):
            p_path = repo.get("physical_path")
            if p_path:
                allowed_base = Path(p_path).expanduser().resolve()
                if str(resolved_abs).startswith(str(allowed_base)):
                    return resolved_abs.as_posix()

        # Fall back to locking down to the general workspace sandbox framework
        if str(resolved_abs).startswith(str(ws_root_path)):
            return resolved_abs.as_posix()

        # Disallow arbitrary system breakout traversals; anchor back inside the root container
        try:
            norm_path = resolved_abs.relative_to(ws_root_path).as_posix()
        except ValueError:
            norm_path = resolved_abs.name
    # Strip out malicious directory traversal operators safely
    norm_path = re.sub(r'\.\.(?=/|$)', '', str(norm_path))
    norm_path = re.sub(r'/+', '/', norm_path).strip('/')

    cfg = load_config(workspace_id)

    # Cross-Repo Boundary Protocol (Explicit :: syntax)
    if '::' in norm_path:
        boundary_parts = norm_path.split('::', 1)
        target_repo = boundary_parts[0]
        downstream = boundary_parts[1].lstrip('/')

        for repo in cfg.get("target_repos", []):
            if target_repo == repo.get("repo_dir"):
                physical_path = repo.get("physical_path")
                expanded_base = Path(physical_path).expanduser().resolve() if physical_path else (ws_root_path / target_repo).resolve()
                return expanded_base.joinpath(downstream).resolve().as_posix()

        # Fallback if repo not found: sanitize and let standard logic attempt resolution
        norm_path = norm_path.replace('::', '/')

    parts = [p for p in norm_path.split('/') if p]
    if not parts:
        return Path(path).as_posix()

    # Mount Point Protocol: Check for physical_path overrides
    for repo in cfg.get("target_repos", []):
        if parts[0] == repo.get("repo_dir"):
            physical_path = repo.get("physical_path")
            if physical_path:
                expanded_base = Path(physical_path).expanduser().resolve()
            else:
                expanded_base = (ws_root_path / repo.get("repo_dir")).resolve()

            # EDGE CASE FIX: "Repo Name == Top Level Folder Name" (e.g. insetu/insetu/app.py)
            path_stripped = expanded_base.joinpath(*parts[1:]).resolve() if len(parts) > 1 else expanded_base
            path_kept = expanded_base.joinpath(*parts).resolve()

            if path_kept.exists() and not path_stripped.exists():
                return path_kept.as_posix()

            # GENESIS PATCH AMBIGUITY HEALER
            if not path_kept.exists() and not path_stripped.exists():
                def get_unmatched_distance(target_path):
                    d_path = target_path.parent
                    distance = 0
                    while d_path and str(d_path).startswith(str(expanded_base)) and len(str(d_path)) >= len(str(expanded_base)):
                        if d_path.is_dir():
                            return distance
                        distance += 1
                        d_path = d_path.parent
                    return distance

                dist_kept = get_unmatched_distance(path_kept)
                dist_stripped = get_unmatched_distance(path_stripped)

                if dist_kept < dist_stripped:
                    return path_kept.as_posix()
                return path_stripped.as_posix()

            return path_stripped.as_posix()
    # Mathematically resolve against dynamic root
    return ws_root_path.joinpath(norm_path).resolve().as_posix()


def resolve_macro_includes(text, current_filepath, pattern, read_callback, depth=0):
    """
    A domain-agnostic template expander.
    - pattern: compiled regex capturing the target path.
    - read_callback: function(target_path) -> string
    """
    import re
    if depth > 5:
        return text + "\n[!] INCLUSION DEPTH LIMIT EXCEEDED"

    def replacer(match):
        include_path = match.group(1).strip()

        # Path resolution logic stays in core
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

        # Extension provides the data via callback
        inc_content = read_callback(target_path)

        if inc_content is not None:
            return resolve_macro_includes(inc_content, target_path, pattern, read_callback, depth + 1)
        else:
            return f"[!] MACRO TARGET NOT FOUND: {include_path}"

    return re.sub(pattern, replacer, text)


def search_workspace_files(workspace_id, query):
    """Globally searches tracked Markdown files in the workspace using the manifest index."""
    terms = [t for t in query.split() if t]
    if not terms: return []

    import json
    paths = get_gather_paths(workspace_id)

    manifest_path = Path(paths["contexts_dir"]).joinpath("manifest.json").as_posix()
    md_files = set()
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r', encoding='utf-8') as f:
            try:
                manifest = json.load(f)
                for data in manifest.values():
                    file_list = data.get("files", []) if isinstance(data, dict) else data
                    for filepath in file_list:
                        if filepath.lower().endswith('.md'):
                            md_files.add(filepath)
            except Exception:
                pass
    results = []
    for filepath in md_files:
        abs_path = resolve_workspace_path(filepath, workspace_id)
        if not os.path.exists(abs_path): continue

        try:
            with open(abs_path, 'r', encoding='utf-8') as f:
                content = f.read()

            content_lower = content.lower()
            score = 0
            snippet = ""
            file_lower = filepath.lower()

            for term in terms:
                if term in file_lower:
                    score += 2
                if term in content_lower:
                    score += 1

            if score > 0:
                first_term = next((t for t in terms if t in content_lower), None)
                if first_term:
                    idx = content_lower.find(first_term)
                    start = max(0, idx - 30)
                    end = min(len(content), idx + 70)
                    snippet = content[start:end].replace('\n', ' ').strip()

                results.append({
                    "path": filepath,
                    "score": score,
                    "snippet": snippet
                })
        except Exception:
            pass

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:50]

def get_all_workspace_ids():
    """Returns a list of all active workspace IDs from the central switchboard."""
    import json
    import os
    from pathlib import Path
    
    # Assumes _cwd is available in module scope
    index_path = Path(_cwd).joinpath(".insetu", "workspaces.json").as_posix()
    workspace_ids = ["default"]
    if os.path.exists(index_path):
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                w_data = json.load(f)
            workspace_ids = list(w_data.get("workspaces", {}).keys())
            if "default" not in workspace_ids:
                workspace_ids.append("default")
        except Exception:
            pass
    return workspace_ids
def generate_idempotency_hash(payload: dict) -> str:
    """
    Generates a deterministic JSON string representation of a payload 
    for immediate job request-deduplication and idempotency checks.
    """
    import json
    return json.dumps(payload, sort_keys=True)

def slugify(text):
    """Converts a string into a clean, filesystem-safe ASCII slug, with multi-lingual safety hooks."""
    if not text:
        return ""
    import unicodedata
    import re

    # Manual pre-mapping translation table for non-decomposable stroke characters
    charmap = {
        'Đ': 'D', 'đ': 'd',
        'Æ': 'AE', 'æ': 'ae',
        'Ø': 'O', 'ø': 'o',
        'ß': 'ss'
    }
    for broken, fixed in charmap.items():
        text = text.replace(broken, fixed)

    clean = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8')
    clean = re.sub(r'[^a-zA-Z0-9_-]', '_', clean.lower())
    return re.sub(r'_+', '_', clean).strip('_')