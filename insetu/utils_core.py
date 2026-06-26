import os
import json
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Shift spatial physics to the terminal's Current Working Directory,
# but enforce the universal sibling-repo architecture (repos are one level up).
import os
import json
_cwd = os.getcwd()
def _resolve_workspace_physics():
    """
    Agnostic spatial anchoring:
    1. Check for an explicit environment variable override.
    2. Check for an active profile in '.insetu/profiles/workspaces.json'.
    3. Default to '.insetu/profiles/default/config.json'.
    """
    profiles_dir = os.path.join(_cwd, ".insetu", "profiles")
    default_config = os.path.join(profiles_dir, "default", "config.json")
    # 1. Environment Variable Override
    env_config = os.environ.get("INSETU_CONFIG")
    if env_config:
        resolved_cfg = os.path.abspath(os.path.expanduser(env_config))
        return resolved_cfg, _cwd
    # 2. Workspace Hotswapper
    index_path = os.path.join(profiles_dir, "workspaces.json")
    resolved_cfg = default_config
    if os.path.exists(index_path):
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                w_data = json.load(f)

            active = w_data.get("active_workspace")
            if active and active in w_data.get("workspaces", {}):
                cfg_path = w_data["workspaces"][active].get("config_path")
                if cfg_path:
                    # Resolve relative to the profiles_dir
                    resolved_cfg = os.path.abspath(os.path.join(profiles_dir, os.path.expanduser(cfg_path)))
        except Exception as e:
            print(f"Warning: Failed to parse {index_path}: {e}")

    # 3. Check for Workspace Root Override inside the active config
    if os.path.exists(resolved_cfg):
        try:
            with open(resolved_cfg, 'r', encoding='utf-8') as f:
                c_data = json.load(f)
            if "workspace_root" in c_data:
                return resolved_cfg, os.path.abspath(os.path.expanduser(c_data["workspace_root"]))
        except Exception:
            pass

    return resolved_cfg, _cwd
CONFIG_PATH, WORKSPACE_ROOT = _resolve_workspace_physics()
WORKFLOWS_PATH = os.path.join(os.path.dirname(CONFIG_PATH), "workflows.json") if CONFIG_PATH else ""

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
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    _JSON_CACHE[filepath] = data
    _JSON_MTIME[filepath] = 0  # Explicitly force mtime invalidation to bypass cache collisions

def load_config():
    return load_json_file(CONFIG_PATH, {})

def load_workflows():
    return load_json_file(WORKFLOWS_PATH, {"context_batches": []})
def get_valid_workspace_files(repo_path, config):
    """Universal SSOT for extracting valid files respecting context filters and ignore rules."""
    live_cfg = load_config()
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

def get_sister_repos():

    cfg = load_config()
    return [repo.get("repo_dir") for repo in cfg.get("target_repos", []) if repo.get("repo_dir")]
def resolve_workspace_path(path):
    norm_path = path.replace('\\', '/')
    if os.path.isabs(norm_path):
        return norm_path
    clean_parts = [p for p in norm_path.split('/') if p not in ('..', '.', '')]
    if not clean_parts:
        return path

    # Mount Point Protocol: Check for physical_path overrides
    cfg = load_config()
    for repo in cfg.get("target_repos", []):
        if clean_parts[0] == repo.get("repo_dir"):
            physical_path = repo.get("physical_path")
            if physical_path:
                expanded_base = os.path.expanduser(physical_path)
                return os.path.join(expanded_base, *clean_parts[1:])

    # Strictly anchor to WORKSPACE_ROOT to prevent silent writes into the CLI working directory
    return os.path.join(WORKSPACE_ROOT, *clean_parts)