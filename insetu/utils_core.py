import os
import json
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Shift spatial physics to the terminal's Current Working Directory,
# but enforce the universal sibling-repo architecture (repos are one level up).
import os
import json
_cwd = os.getcwd()
def sniff_tenant_id():
    """Universal helper to extract the active workspace tenant from Flask headers."""
    try:
        from flask import request
        if request and 'X-Workspace-ID' in request.headers:
            return request.headers.get('X-Workspace-ID')
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

    local_insetu_dir = os.path.join(_cwd, ".insetu")
    default_config = os.path.join(local_insetu_dir, "config.json")
    index_path = os.path.join(local_insetu_dir, "workspaces.json")

    # 1. Environment Variable Override (Overrides everything)
    env_config = os.environ.get("INSETU_CONFIG")
    if env_config:
        resolved_cfg = os.path.abspath(os.path.expanduser(env_config))
        return resolved_cfg, _cwd, os.path.join(os.path.dirname(resolved_cfg), "workflows.json")

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
            resolved_cfg = os.path.abspath(os.path.join(local_insetu_dir, cfg_path))
        else:
            resolved_cfg = os.path.abspath(os.path.expanduser(cfg_path))

    if not os.path.exists(resolved_cfg):
        resolved_cfg = default_config

    # 3. Resolve Workspace Root
    workflows_path = os.path.join(os.path.dirname(resolved_cfg), "workflows.json")
    if os.path.exists(resolved_cfg):
        try:
            with open(resolved_cfg, 'r', encoding='utf-8') as f: c_data = json.load(f)
            if "workspace_root" in c_data:
                return resolved_cfg, os.path.abspath(os.path.expanduser(c_data["workspace_root"])), workflows_path
        except Exception:
            pass
        return resolved_cfg, os.path.dirname(os.path.dirname(resolved_cfg)), workflows_path

    return resolved_cfg, _cwd, workflows_path
def get_gather_paths(workspace_id=None):
    """Dynamically calculates artifact physics for the requested tenant."""
    cfg_path, ws_root, wf_path = get_workspace_physics(workspace_id)
    workspace_dir = os.path.dirname(cfg_path)
    artifacts_base = os.path.join(workspace_dir, "data")

    paths = {
        "config_path": cfg_path,
        "workspace_root": ws_root,
        "workflows_path": wf_path,
        "artifacts_base": artifacts_base,
        "contexts_dir": os.path.join(artifacts_base, "contexts"),
        "prompts_dir": os.path.join(workspace_dir, "prompts"),
        "diffs_dir": os.path.join(artifacts_base, "diffs"),
        "gather_dir": os.path.join(artifacts_base, "workflows")
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
def save_json_file(filepath, data):
    global _JSON_CACHE, _JSON_MTIME

    # Write through VFS pipeline if it's a configuration mutation to avoid blocking HTTP threads
    if filepath.endswith('config.json') or filepath.endswith('workflows.json'):
        from insetu.routes_fs import _VFS_WRITE_QUEUE
        try:
            workspace_id = sniff_tenant_id()
            _VFS_WRITE_QUEUE.put((workspace_id, filepath, json.dumps(data, indent=2), {}))
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
                        with open(os.path.join(repo_path, '.gitkeep'), 'w') as f: pass
            except Exception:
                pass

        try:
            result = subprocess.run(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], 
                                    capture_output=True, text=True, check=True, cwd=repo_path)
            git_files = set(result.stdout.splitlines())
        except Exception:
            git_files = set(os.path.relpath(os.path.join(r, f), repo_path).replace("\\", "/") 
                            for r, _, fs in os.walk(repo_path) for f in fs)
    else:
        # "media-vault" or future custom archive types bypass Git entirely
        git_files = set(os.path.relpath(os.path.join(r, f), repo_path).replace("\\", "/") 
                        for r, _, fs in os.walk(repo_path) for f in fs)

    valid_files = set()
    for file in git_files:
        norm_path = file.replace("\\", "/")
        if norm_path.startswith("./"): norm_path = norm_path[2:]
        if config.get("prefix") and not norm_path.startswith(config.get("prefix")): continue
        if not os.path.isfile(os.path.join(repo_path, norm_path)): continue
        if os.path.basename(norm_path).lower() in ignore_files: continue
        if config.get("apply_ignore"):
            if any(norm_path.startswith(exc) for exc in config.get("ignore_exceptions", [])):
                pass
            else:
                if set(p.lower() for p in norm_path.split('/')).intersection(ignore_dirs): continue
                if any(pattern in norm_path for pattern in ignore_patterns): continue
        # Always allow standard empty-directory anchors
        if os.path.basename(norm_path).lower() in (".gitkeep", ".keep"):
            valid_files.add(norm_path)
            continue
        ext = os.path.splitext(norm_path)[1].lower()

        # Merge global extensions with repo-specific extensions
        allowed_exts = set(live_cfg.get("include_extensions", []) + config.get("exts", []))
        if ext in allowed_exts: valid_files.add(norm_path)

    for forced_file in config.get("force_include", []):
        if os.path.exists(os.path.join(repo_path, forced_file)): valid_files.add(forced_file.replace("\\", "/"))

    return sorted(list(valid_files))
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
    cfg_path, ws_root, _ = get_workspace_physics(workspace_id)
    live_cfg = load_config(workspace_id)
    ignore_dirs = tuple(live_cfg.get("ignore_dirs", ['node_modules', '__pycache__', 'venv', '.venv', '.insetu', '.git']))
    managed_dirs = set(live_cfg.get("managed_dirs", []))

    search_roots = [os.path.dirname(cfg_path)]
    for repo in allowed_repos:
        repo_path = os.path.join(ws_root, repo)
        if os.path.exists(repo_path):
            search_roots.append(repo_path)
    search_roots = list(set(os.path.abspath(r) for r in search_roots))

    candidates = []
    for s_root in search_roots:
        for root, dirs, files in os.walk(s_root):
            dirs[:] = [d for d in dirs if (not d.startswith('.') or d in managed_dirs) and d not in ignore_dirs]
            for f in files:
                cand_abs = os.path.abspath(os.path.join(root, f)).replace('\\', '/')
                cand_rel = os.path.relpath(cand_abs, ws_root).replace('\\', '/')
                candidates.append((f, cand_rel))
    return candidates
def get_sister_repos(workspace_id=None):
    cfg = load_config(workspace_id)
    return [repo.get("repo_dir") for repo in cfg.get("target_repos", []) if repo.get("repo_dir")]
def resolve_workspace_path(path, workspace_id=None):
    _, workspace_root, _ = get_workspace_physics(workspace_id)

    norm_path = path.replace('\\', '/')
    # Prevent absolute path traversal containment breaches
    if os.path.isabs(norm_path):
        resolved_abs = os.path.abspath(norm_path)
        # Check if the target is explicitly wrapped inside an authorized physical target repository
        cfg = load_config(workspace_id)
        for repo in cfg.get("target_repos", []):
            p_path = repo.get("physical_path")
            if p_path:
                allowed_base = os.path.abspath(os.path.expanduser(p_path))
                if resolved_abs.startswith(allowed_base):
                    return resolved_abs
        # Fall back to locking down to the general workspace sandbox framework
        if resolved_abs.startswith(os.path.abspath(workspace_root)):
            return resolved_abs
        # Disallow arbitrary system breakout traversals; anchor back inside the root container
        norm_path = os.path.relpath(resolved_abs, workspace_root).replace('\\', '/')

    import re
    # Strip out malicious directory traversal operators safely
    norm_path = re.sub(r'\.\.(?=/|$)', '', norm_path)
    norm_path = re.sub(r'/+', '/', norm_path).strip('/')
    parts = [p for p in norm_path.split('/') if p]
    if not parts:
        return path

    # Mount Point Protocol: Check for physical_path overrides
    cfg = load_config(workspace_id)
    for repo in cfg.get("target_repos", []):
        if parts[0] == repo.get("repo_dir"):
            physical_path = repo.get("physical_path")
            expanded_base = os.path.abspath(os.path.expanduser(physical_path)) if physical_path else os.path.abspath(os.path.join(workspace_root, repo.get("repo_dir")))
            
            # EDGE CASE FIX: "Repo Name == Top Level Folder Name" (e.g. insetu/insetu/app.py)
            path_stripped = os.path.abspath(os.path.join(expanded_base, *parts[1:])) if len(parts) > 1 else expanded_base
            path_kept = os.path.abspath(os.path.join(expanded_base, *parts))
            if os.path.exists(path_kept) and not os.path.exists(path_stripped):
                return path_kept

            # GENESIS PATCH AMBIGUITY HEALER:
            # If neither exists (new file), evaluate which path fragment requires creating the fewest new
            # subdirectories by tracing backwards to the deepest existing directory.
            if not os.path.exists(path_kept) and not os.path.exists(path_stripped):
                def get_unmatched_distance(target_path):
                    d_path = os.path.dirname(target_path)
                    distance = 0
                    while d_path and d_path.startswith(expanded_base) and len(d_path) >= len(expanded_base):
                        if os.path.isdir(d_path):
                            return distance
                        distance += 1
                        d_path = os.path.dirname(d_path)
                    return distance
                dist_kept = get_unmatched_distance(path_kept)
                dist_stripped = get_unmatched_distance(path_stripped)
                # Only use path_kept if it explicitly maps closer to an existing physical tree

                if dist_kept < dist_stripped:
                    return path_kept
                return path_stripped

            return path_stripped
    # Mathematically resolve against dynamic root
    return os.path.abspath(os.path.join(workspace_root, norm_path))


def search_workspace_files(workspace_id, query):
    """Globally searches tracked Markdown files in the workspace using the manifest index."""
    terms = [t for t in query.split() if t]
    if not terms: return []

    import json
    paths = get_gather_paths(workspace_id)

    manifest_path = os.path.join(paths["contexts_dir"], "manifest.json")
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