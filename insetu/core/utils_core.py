from pathlib import Path
import os
import json
import subprocess
from insetu.utils import load_config, get_workspace_physics, slugify, load_json_file

def get_gather_paths(workspace_id=None):
    cfg_path, ws_root, wf_path = get_workspace_physics(workspace_id)
    workspace_dir = Path(cfg_path).parent.as_posix()
    artifacts_base = Path(workspace_dir).joinpath("data").as_posix()
    paths = {
        "config_path": cfg_path,
        "control_dir": workspace_dir,
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
        return _extract(manifest_data.get(target_key, {}))

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
def get_available_contexts(workspace_id=None, exclusion_flags=None, exclude_types=None, include_types=None):
    cfg = load_config(workspace_id)
    paths = get_gather_paths(workspace_id)
    flags = [exclusion_flags] if isinstance(exclusion_flags, str) else (exclusion_flags or [])
    expected_contexts = set()

    for c in cfg.get("target_repos", []):
        repo_excluded = any(c.get(flag) for flag in flags)
        r_dir = c.get("repo_dir", "")
        safe_r_dir = get_safe_repo_id(r_dir)
        subs = c.get("sub_buckets", [])

        if not repo_excluded and not any(b.get("is_catch_all") for b in subs):
            out = c.get("out_file", f"{safe_r_dir}_context.txt")
            expected_contexts.add(f"contexts/{out}")

        if subs:
            for b in subs:
                if repo_excluded or any(b.get(flag) for flag in flags):
                    continue
                if not b.get("dynamic_split_prefix"):
                    sub_out = b.get("out_file", f"{r_dir}_{b.get('id')}_context.txt")
                    expected_contexts.add(f"contexts/{sub_out}")
                else:
                    dyn_dir = Path(paths["workspace_root"]).joinpath(r_dir, b["dynamic_split_prefix"]).as_posix()
                    if os.path.exists(dyn_dir):
                        for module in os.listdir(dyn_dir):
                            if os.path.isdir(Path(dyn_dir).joinpath(module).as_posix()) and not module.startswith('.'):
                                expected_contexts.add(f"contexts/{module}_context.txt")
    manifest_path = Path(paths["contexts_dir"]).joinpath("manifest.json").as_posix()
    manifest_data = load_json_file(manifest_path, {})

    for f in extract_manifest_files(manifest_data, exclude_types=exclude_types, include_types=include_types):
        if f.endswith('.txt'):
            expected_contexts.add(f"contexts/{f}")

    return expected_contexts

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

def get_sister_repos(workspace_id=None):
    cfg = load_config(workspace_id)
    return [repo.get("repo_dir") for repo in cfg.get("target_repos", []) if repo.get("repo_dir")]

def resolve_logical_path(path, workspace_id=None):
    from pathlib import Path
    import re
    _, workspace_root, _ = get_workspace_physics(workspace_id)
    ws_root_path = Path(workspace_root).resolve()

    norm_path = path
    if Path(norm_path).is_absolute():
        resolved_abs = Path(norm_path).resolve()
        cfg = load_config(workspace_id)
        for repo in cfg.get("target_repos", []):
            p_path = repo.get("physical_path")
            if p_path:
                allowed_base = Path(p_path).expanduser().resolve()
                if str(resolved_abs).startswith(str(allowed_base)):
                    return resolved_abs.as_posix()

        if str(resolved_abs).startswith(str(ws_root_path)):
            return resolved_abs.as_posix()
        try:
            norm_path = resolved_abs.relative_to(ws_root_path).as_posix()
        except ValueError:
            norm_path = resolved_abs.name

    norm_path = re.sub(r'\.\.(?=/|$)', '', str(norm_path))
    norm_path = re.sub(r'/+', '/', norm_path).strip('/')

    cfg = load_config(workspace_id)

    if '::' in norm_path:
        boundary_parts = norm_path.split('::', 1)
        target_repo = boundary_parts[0]
        downstream = boundary_parts[1].lstrip('/')

        for repo in cfg.get("target_repos", []):
            if target_repo == repo.get("repo_dir"):
                physical_path = repo.get("physical_path")
                expanded_base = Path(physical_path).expanduser().resolve() if physical_path else (ws_root_path / target_repo).resolve()
                return expanded_base.joinpath(downstream).resolve().as_posix()
        norm_path = norm_path.replace('::', '/')

    parts = [p for p in norm_path.split('/') if p]
    if not parts:
        return Path(path).as_posix()

    for repo in cfg.get("target_repos", []):
        if parts[0] == repo.get("repo_dir"):
            physical_path = repo.get("physical_path")
            if physical_path:
                expanded_base = Path(physical_path).expanduser().resolve()
            else:
                expanded_base = (ws_root_path / repo.get("repo_dir")).resolve()
            if len(parts) == 1:
                if expanded_base.exists():
                    return expanded_base.as_posix()

            candidate_paths = []
            if len(parts) > 1:
                candidate_paths.append(expanded_base.joinpath(*parts[1:]).resolve())
            candidate_paths.append(expanded_base.joinpath(*parts).resolve())

            repo_dir_name = repo.get("repo_dir")
            dup_idx = 1
            while dup_idx < len(parts) and parts[dup_idx] == repo_dir_name:
                dup_idx += 1
                if dup_idx < len(parts):
                    candidate_paths.append(expanded_base.joinpath(*parts[dup_idx:]).resolve())

            for cand in candidate_paths:
                if cand.exists():
                    return cand.as_posix()

            path_stripped = candidate_paths[0] if candidate_paths else expanded_base
            path_kept = expanded_base.joinpath(*parts).resolve()

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

    return ws_root_path.joinpath(norm_path).resolve().as_posix()

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

def search_workspace_files(workspace_id, query):
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
                for filepath in extract_manifest_files(manifest):
                    if filepath.lower().endswith('.md'):
                        md_files.add(filepath)
            except Exception:
                pass
    results = []
    for filepath in md_files:
        abs_path = resolve_logical_path(filepath, workspace_id)
        if not os.path.exists(abs_path): continue
        try:
            with open(abs_path, 'r', encoding='utf-8') as f:
                content = f.read()

            content_lower = content.lower()
            score = 0
            snippet = ""
            file_lower = filepath.lower()

            for term in terms:
                if term in file_lower: score += 2
                if term in content_lower: score += 1

            if score > 0:
                first_term = next((t for t in terms if t in content_lower), None)
                if first_term:
                    idx = content_lower.find(first_term)
                    start = max(0, idx - 30)
                    end = min(len(content), idx + 70)
                    snippet = content[start:end].replace('\n', ' ').strip()
                results.append({"path": filepath, "score": score, "snippet": snippet})
        except Exception:
            pass

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:50]

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
    for repo in cfg.get("target_repos", []):
        if not repo.get("repo_dir"):
            continue
        valid_buckets = []
        for b in repo.get("sub_buckets", []):
            if b.get("is_system"):
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