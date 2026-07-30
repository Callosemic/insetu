from pathlib import Path
import os
import json

_cwd = os.getcwd()

def sniff_tenant_id():
    try:
        from flask import request
        if request and 'X-Workspace-ID' in request.headers:
            return request.headers['X-Workspace-ID']
    except RuntimeError:
        pass
    return "default"

def get_physics_for(workspace_id):
    return get_workspace_physics(workspace_id)

def get_tenant_control_dir(workspace_id=None):
    cfg_path, _, _ = get_workspace_physics(workspace_id)
    return Path(cfg_path).parent.as_posix()

def get_workspace_physics(workspace_id=None):
    if not workspace_id:
        workspace_id = sniff_tenant_id()

    local_insetu_dir = Path(_cwd).joinpath(".insetu").as_posix()
    default_config = Path(local_insetu_dir).joinpath("config.json").as_posix()
    index_path = Path(local_insetu_dir).joinpath("workspaces.json").as_posix()

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

    resolved_cfg = default_config
    cfg_path = None
    if os.path.exists(index_path):
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                w_data = json.load(f)
            registered = w_data.get("workspaces", {})
            if target_ws in registered:
                cfg_path = registered[target_ws].get("config_path")
            elif target_ws != "default":
                raise KeyError(f"Workspace '{target_ws}' is not registered.")
        except KeyError:
            raise
        except Exception:
            pass
    if cfg_path:
        if not os.path.isabs(os.path.expanduser(cfg_path)):
            resolved_cfg = os.path.abspath(Path(local_insetu_dir).joinpath(cfg_path).as_posix())
        else:
            resolved_cfg = os.path.abspath(os.path.expanduser(cfg_path))

    if not os.path.exists(resolved_cfg) and target_ws == "default":
        resolved_cfg = default_config

    workflows_path = Path(resolved_cfg).parent.joinpath("workflows.json").as_posix()
    if os.path.exists(resolved_cfg):
        try:
            with open(resolved_cfg, 'r', encoding='utf-8') as f: c_data = json.load(f)
            if "workspace_root" in c_data:
                return resolved_cfg, Path(c_data["workspace_root"]).expanduser().resolve().as_posix(), workflows_path
        except Exception:
            pass

        return resolved_cfg, Path(resolved_cfg).parent.parent.as_posix(), workflows_path

    if target_ws != "default":
        return resolved_cfg, Path(resolved_cfg).parent.parent.as_posix(), workflows_path

    return resolved_cfg, _cwd, workflows_path

def is_extension_enabled(ext_name, workspace_id=None):
    cfg = load_config(workspace_id)
    return ext_name in cfg.get("extensions", [])

def extension_auth(ext_name):
    def decorator(f):
        import functools
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            from flask import jsonify
            cfg = load_config()
            if ext_name not in cfg.get("extensions", []):
                return jsonify({"error": f"403 Forbidden: Extension '{ext_name}' is not enabled in this workspace."}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

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
    from insetu.kernel.vfs import VFSTransaction
    import json

    wid = workspace_id or sniff_tenant_id()
    if not wid:
        wid = "default"

    vfs = VFSTransaction(wid)
    vfs.save(filepath, json.dumps(data, indent=2), {"is_absolute_artifact": True})

    _JSON_CACHE[filepath] = data
    _JSON_MTIME[filepath] = 0

_MUTATED_CONFIG_CACHE = {}
_MUTATED_CONFIG_MTIME = {}

def load_config(workspace_id=None):
    cfg_path, _, _ = get_workspace_physics(workspace_id)
    current_mtime = os.path.getmtime(cfg_path) if os.path.exists(cfg_path) else 0
    if cfg_path not in _MUTATED_CONFIG_CACHE or current_mtime > _MUTATED_CONFIG_MTIME.get(cfg_path, 0):
        import copy
        cfg = copy.deepcopy(load_json_file(cfg_path, {}))

        from insetu.kernel.hooks import hooks
        hooks.emit('mutate_workspace_config', cfg, workspace_id=workspace_id)
        _MUTATED_CONFIG_CACHE[cfg_path] = cfg
        _MUTATED_CONFIG_MTIME[cfg_path] = current_mtime

    return _MUTATED_CONFIG_CACHE[cfg_path]

def get_all_workspace_ids():
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
    return json.dumps(payload, sort_keys=True)

def slugify(text):
    if not text:
        return ""
    import unicodedata
    import re
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

def resolve_sandbox_path(filepath, workspace_id=None):
    """Tier 1 Safe Path Resolution: Prevents directory traversal breakouts."""
    import re
    _, workspace_root, _ = get_workspace_physics(workspace_id)
    ws_root_path = Path(workspace_root).resolve()

    norm_path = filepath
    if Path(norm_path).is_absolute():
        resolved_abs = Path(norm_path).resolve()
        if str(resolved_abs).startswith(str(ws_root_path)):
            return resolved_abs.as_posix()
        try:
            norm_path = resolved_abs.relative_to(ws_root_path).as_posix()
        except ValueError:
            norm_path = resolved_abs.name
    norm_path = re.sub(r'\.\.(?=/|$)', '', str(norm_path))
    norm_path = re.sub(r'/+', '/', norm_path).strip('/')

    resolved = ws_root_path.joinpath(norm_path).resolve()
    if not resolved.exists():
        parts = norm_path.split('/')
        if len(parts) > 1 and parts[0] == parts[1]:
            dedup_path = ws_root_path.joinpath(*parts[1:]).resolve()
            if dedup_path.exists():
                return dedup_path.as_posix()

    return resolved.as_posix()

def resolve_system_artifact_path(filepath, workspace_id):
    cfg_path, _, _ = get_workspace_physics(workspace_id)
    active_insetu_base = Path(cfg_path).parent.resolve()
    default_insetu_base = Path(_cwd).joinpath(".insetu").resolve()
    resolved_abs = Path(filepath).resolve()
    if str(resolved_abs).startswith(str(active_insetu_base)) or str(resolved_abs).startswith(str(default_insetu_base)):
        return resolved_abs.as_posix()
    else:
        return resolve_sandbox_path(filepath, workspace_id)

def build_tree_dict(file_paths):
    tree = {}
    for path in file_paths:
        parts = path.split('/')
        current = tree
        for part in parts:
            if part not in current:
                current[part] = {}
            current = current[part]
    return tree

def generate_ascii_tree(file_paths):
    tree = build_tree_dict(file_paths)
    def print_tree(node, prefix=""):
        lines = []
        entries = sorted(list(node.keys()))
        for i, key in enumerate(entries):
            is_last = (i == len(entries) - 1)
            lines.append(f"{prefix}{'└── ' if is_last else '├── '}{key}")
            lines.extend(print_tree(node[key], prefix + ("    " if is_last else "│   ")))
        return lines
    return ".\n" + "\n".join(print_tree(tree))

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