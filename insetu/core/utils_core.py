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