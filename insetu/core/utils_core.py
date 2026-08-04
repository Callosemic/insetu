from pathlib import Path
import os
import json
import subprocess
from insetu.kernel.utils import load_config, get_workspace_physics, slugify, load_json_file, generate_ascii_tree
from insetu.kernel.hooks import hooks
@hooks.on('vfs_resolve_path')
def hook_vfs_resolve_path(filepath=None, workspace_id=None, **kwargs):
    """Provides logical repo::path boundary resolution to the Kernel VFS."""
    if filepath:
        if filepath.startswith("system://"):
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

def get_valid_workspace_files(repo_path, config, workspace_id=None):
    live_cfg = load_config(workspace_id)
    global_ignore_dirs = set(live_cfg.get("ignore_dirs", []))
    global_ignore_files = set(live_cfg.get("ignore_files", []))
    global_ignore_patterns = live_cfg.get("ignore_patterns", [])

    ignore_dirs = global_ignore_dirs.union(config.get("repo_ignore_dirs", []))
    ignore_files = global_ignore_files.union(config.get("repo_ignore_files", []))
    ignore_patterns = global_ignore_patterns + config.get("repo_ignore_patterns", [])
    archive_type = config.get("archive_type", "repo")

    if archive_type == "repo":
        if os.path.exists(repo_path):
            try:
                check_tree = subprocess.run(['git', 'rev-parse', '--is-inside-work-tree'], 
                                            capture_output=True, text=True, cwd=repo_path)
                if check_tree.returncode != 0 or 'true' not in check_tree.stdout.lower():
                    subprocess.run(['git', 'init'], capture_output=True, cwd=repo_path)
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
                    try: git_files.add(p.relative_to(repo_path).as_posix())
                    except ValueError: pass
    else:
        git_files = set()
        for p in Path(repo_path).rglob('*'):
            if p.is_file():
                try: git_files.add(p.relative_to(repo_path).as_posix())
                except ValueError: pass

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

        if repo_p.name == '.insetu' and (norm_path.startswith('data/') or '/data/' in norm_path):
            continue

        if target_f.name.lower() in (".gitkeep", ".keep"):
            valid_files.add(norm_path)
            continue

        ext = target_f.suffix.lower()
        allowed_exts = set(live_cfg.get("include_extensions", []) + config.get("exts", []))
        if ext in allowed_exts: valid_files.add(norm_path)

    for forced_file in config.get("force_include", []):
        if (repo_p / forced_file).exists(): 
            valid_files.add(forced_file)

    return sorted(list(valid_files))

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

def extract_manifest_files(manifest_data, target_key=None, exclude_types=None, include_types=None):
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
    if target_key:
        entry = manifest_data.get(target_key)
        if entry is None and ("/" in target_key or "\\" in target_key):
            entry = manifest_data.get(Path(target_key).name)
        return _extract(entry or {})

    all_files = set()
    for k, v in manifest_data.items():
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

def get_omniscient_workspace_files(workspace_id, allowed_repos):
    from pathlib import Path
    cfg_path, ws_root, _ = get_workspace_physics(workspace_id)
    ws_root_path = Path(ws_root).resolve()
    live_cfg = load_config(workspace_id)
    ignore_dirs = tuple(live_cfg.get("ignore_dirs", ['node_modules', '__pycache__', 'venv', '.venv', '.insetu', '.git']))

    search_roots = [Path(cfg_path).parent.resolve()]
    for repo in allowed_repos:
        repo_path = ws_root_path / repo
        if repo_path.exists():
            search_roots.append(repo_path)
    search_roots = list(set(search_roots))
    candidates = []
    for s_root in search_roots:
        for root, dirs, files in os.walk(str(s_root)):
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            for f in files:
                cand_abs = Path(root) / f
                try:
                    cand_rel = cand_abs.relative_to(ws_root_path).as_posix()
                except ValueError:
                    cand_rel = cand_abs.as_posix()
                candidates.append((f, cand_rel))
    return candidates

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
    from insetu.kernel.utils import load_config, load_json_file
    from insetu.kernel.extension import ExtensionContext
    from insetu.core.utils_core import get_safe_repo_id
    cfg = load_config(workspace_id)
    ctx = ExtensionContext('gather', workspace_id)
    paths = ctx.paths
    flags = [exclusion_flags] if isinstance(exclusion_flags, str) else (exclusion_flags or [])
    expected_contexts = set()

    for c in (cfg.get("target_repos") or []):
        if not isinstance(c, dict): continue
        repo_excluded = any(c.get(flag) for flag in flags if isinstance(flag, str))
        r_dir = c.get("repo_dir", "")
        safe_r_dir = get_safe_repo_id(r_dir)
        subs = [b for b in (c.get("sub_buckets") or []) if isinstance(b, dict)]

        if not repo_excluded and not any(b.get("is_catch_all") for b in subs):
            out = c.get("out_file", f"{safe_r_dir}_context.txt")
            if out: expected_contexts.add(f"contexts/{out}")

        if subs:
            for b in subs:
                if repo_excluded or any(b.get(flag) for flag in flags if isinstance(flag, str)):
                    continue
                if not b.get("dynamic_split_prefix"):
                    sub_out = b.get("out_file", f"{r_dir}_{b.get('id', 'bucket')}_context.txt")
                    if sub_out: expected_contexts.add(f"contexts/{sub_out}")
                else:
                    dyn_dir = Path(paths["workspace_root"]).joinpath(r_dir, b["dynamic_split_prefix"]).as_posix()
                    if os.path.exists(dyn_dir):
                        for module in os.listdir(dyn_dir):
                            if os.path.isdir(Path(dyn_dir).joinpath(module).as_posix()) and not module.startswith('.'):
                                expected_contexts.add(f"contexts/{module}_context.txt")
    manifests = hooks.emit('request_manifest', workspace_id=workspace_id)
    manifest_data = next((m for m in manifests if m), {})

    for k, v in manifest_data.items():
        if isinstance(k, str) and k.endswith('.txt') and isinstance(v, dict):
            item_type = v.get("meta", {}).get("type", "unknown")
            if exclude_types and item_type in exclude_types:
                continue
            if include_types and item_type not in include_types:
                continue
            expected_contexts.add(f"contexts/{k}")

    return expected_contexts

def resolve_file_bucket(filepath, sub_buckets):
    """DRY Helper to map a filepath to its configured sub-bucket."""
    import re
    clean_filepath = re.sub(r'^(?:\[[A-Z?!\s]{1,2}\]\s+|[A-Z?!\s]{2}\s+)', '', filepath).strip()

    if ' -> ' in clean_filepath:
        clean_filepath = clean_filepath.split(' -> ')[-1].strip()

    for b in sub_buckets:
        prefix = b.get("dynamic_split_prefix")
        if prefix:
            if prefix == "." or clean_filepath.startswith(prefix):
                parts = clean_filepath.split("/")
                module_idx = len([p for p in prefix.split('/') if p and p != '.'])
                if len(parts) > module_idx + 1:
                    return b, parts[module_idx]
                continue
        elif b.get("match_prefixes") and any(clean_filepath.startswith(p) for p in b["match_prefixes"]):
            return b, None

    catch_all = next((b for b in sub_buckets if b.get("is_catch_all")), None)
    return catch_all, None

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

        curr_parts = list(parts)
        while curr_parts and curr_parts[0] == repo_dir:
            curr_parts.pop(0)
            if curr_parts:
                stripped_cand = repo_base.joinpath(*curr_parts).resolve()
                if stripped_cand.exists():
                    return stripped_cand.as_posix()

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
    for repo in (cfg.get("target_repos") or []):
        if not repo or not repo.get("repo_dir"):
            continue
        valid_buckets = []
        for b in (repo.get("sub_buckets") or []):
            if not b or b.get("is_system"):
                continue
            if not b.get("dynamic_split_prefix"):
                if not b.get("id"):
                    title = b.get("title", "").strip()
                    b["id"] = slugify(title) if title else "untitled_bucket"
            valid_buckets.append(b)
        repo["sub_buckets"] = valid_buckets
        valid_repos.append(repo)
    cfg["target_repos"] = valid_repos
    return cfg