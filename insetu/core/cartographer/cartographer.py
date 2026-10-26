import os
import threading
from pathlib import Path
from typing import Optional, List, Dict, Any
from insetu.core.sdk import InSetuExtension
from insetu.core.utils_core import (
    get_repo_path,
    load_config,
    build_tree_dict,
    execute_binary,
    InSetuURI,
)
from insetu.core.topology.engine_topology import get_valid_workspace_files, get_topology_files_for_repo

cartographer_bp = InSetuExtension('cartographer', __name__, title="Cartographer", description="Code index mapping.", core=True)
SCRIPT_DIR = Path(__file__).resolve().parent.as_posix()
_CARTOGRAPHER_SIG_CACHE = {}
_CARTOGRAPHER_CACHE_LOCK = threading.Lock()

@cartographer_bp.on('register_compilation_steps')
def _register_cartographer_compilation_step(workspace_id=None, **kwargs):
    return [{
        "id": "cartographer_map",
        "anchor": "body",
        "order": 15,
        "depends_on": ["topology_scan"],
        "ext_name": "cartographer",
        "worker_name": "map_task"
    }]
@cartographer_bp.worker("map_task")
def _background_map(
    ctx,
    target_repos: Optional[List[str]] = None,
    ledger_events: Optional[List[Dict[str, Any]]] = None,
):
    ctx.jobs.update_progress("Mapping repository topology...")
    map_repositories(ctx.workspace_id, target_repos=target_repos)
    return {
        "message": "Cartography complete.",
        "next_kwargs": {"ledger_events": ledger_events or []}
    }
def extract_existing_comments(index_path, repo_path=None, vfs_content=None):
    """Pass 1: Extracts path-scoped and basename comments from VFS content, falling back to Git history only if empty."""
    def parse_text_for_comments(text):
        cmap = {}
        basename_first_comment = {}
        path_stack = []
        for line in text.splitlines():
            if "#" in line and any(c in line for c in ("├──", "└──", "│")):
                parts = line.split("#", 1)
                left_part = parts[0]
                clean_name = left_part.lstrip(' │├└─\t').rstrip(' \t')
                comment = parts[1].strip()
                if not clean_name:
                    continue
                prefix_len = len(left_part) - len(left_part.lstrip(' │├└─\t'))
                depth = max(0, (prefix_len // 4) - 1)
                path_stack = path_stack[:depth]
                bare_name = clean_name.rstrip('/')
                path_stack.append(bare_name)
                rel_path = "/".join(path_stack)
                # Ignore system placeholders to prevent placeholder lock-in
                if comment not in ("[comment required]", "[managed file]"):
                    cmap[rel_path] = comment
                    cmap[f"{rel_path}/"] = comment
                    basename_first_comment.setdefault(clean_name, comment)
                    basename_first_comment.setdefault(bare_name, comment)
                    basename_first_comment.setdefault(f"{bare_name}/", comment)
        for b_key, b_comment in basename_first_comment.items():
            if b_key not in cmap:
                cmap[b_key] = b_comment
        return cmap

    raw_index = vfs_content
    if raw_index is None and os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            raw_index = f.read()
    live_comments = parse_text_for_comments(raw_index) if raw_index else {}
    git_comments = {}
    if repo_path and (not live_comments or "[comment required]" in (raw_index or "")):
        try:
            rel_index = Path(index_path).resolve().relative_to(Path(repo_path).resolve()).as_posix()
            res = execute_binary(['git', 'show', f'HEAD:{rel_index}'], capture_output=True, text=True, cwd=repo_path)
            if res.returncode == 0:
                git_comments = parse_text_for_comments(res.stdout)
        except Exception:
            pass

    merged = git_comments.copy()
    merged.update(live_comments)
    return merged


def _is_path_managed(current_path: str, managed_dirs: List[str]) -> bool:
    if not current_path or not managed_dirs:
        return False
    norm_cur = current_path.strip("/")
    cur_parts = set(norm_cur.split("/"))
    for d in managed_dirs:
        clean_d = str(d or "").strip("/")
        if not clean_d:
            continue
        if "/" in clean_d:
            if norm_cur == clean_d or norm_cur.startswith(f"{clean_d}/") or f"/{clean_d}/" in f"/{norm_cur}/":
                return True
        elif clean_d in cur_parts:
            return True
    return False


def render_ascii_tree(node, comment_map, managed_dirs, prefix="", current_path=""):
    """Pass 2: Builds the new tree and injects the preserved or placeholder comments."""
    lines = []
    entries = sorted(list(node.keys()))

    # Declarative management: Check if current path falls under managed folders
    is_managed = _is_path_managed(current_path, managed_dirs)

    for i, key in enumerate(entries):
        is_last = (i == len(entries) - 1)
        connector = "└── " if is_last else "├── "
        # Determine if it's a directory (has children) to match folder keys
        is_dir = isinstance(node[key], dict) and len(node[key]) > 0
        next_path = f"{current_path}/{key}" if current_path else key
        rel_lookup_key = f"{next_path}/" if is_dir else next_path
        lookup_key = f"{key}/" if is_dir else key

        # Attempt to match the relative path key first, then exact basename key, then raw key
        comment = comment_map.get(rel_lookup_key)
        if comment is None:
            comment = comment_map.get(next_path)
        if comment is None:
            comment = comment_map.get(lookup_key)
        if comment is None:
            comment = comment_map.get(key)
        if comment is None:
            # If the folder matches our managed list and the item itself is a file
            if is_managed and not is_dir:
                comment_str = " # [managed file]"
            else:
                comment_str = " # [comment required]"
        elif comment == "":
            comment_str = " #"
        else:
            comment_str = f" # {comment}"
            
        # Pad the line to align the comments cleanly (e.g., at column 40)
        raw_line = f"{prefix}{connector}{key}{'/' if is_dir else ''}"
        padded_line = raw_line.ljust(35)
        lines.append(f"{padded_line}{comment_str}")
        extension = "    " if is_last else "│   "
        lines.extend(render_ascii_tree(node[key], comment_map, managed_dirs, prefix + extension, next_path))

    return lines
def map_repositories(workspace_id=None, silent=True, target_repos=None):
    if not silent: print(f"\n{'-'*50}\n🚀 inSetu: Mapping Repository Topologies\n{'-'*50}")
    ctx = cartographer_bp.get_context(workspace_id)
    cfg = ctx.config
    all_configs = cfg.get("target_repos", [])
    def process_repo(config):
        repo_dir = config.get("repo_dir")
        if not repo_dir: return
        if target_repos and repo_dir not in target_repos: return
        repo_path = Path(get_repo_path(repo_dir, workspace_id)).resolve()

        index_path = (repo_path / "docs" / "CODE_INDEX.md") if config.get("is_core_chassis") else (repo_path / "CODE_INDEX.md")
        if not repo_path.exists():
            if not silent: print(f"⚠️  Skipping {repo_dir}: Directory not found.")
            return
        if not silent: print(f"🗺️  Cartographing {repo_dir}...")
        logical_index_path = f"vfs://{repo_dir}/docs/CODE_INDEX.md" if config.get("is_core_chassis") else f"vfs://{repo_dir}/CODE_INDEX.md"
        valid_uris = get_topology_files_for_repo(workspace_id, repo_dir)

        if not valid_uris: return
        hidden_managed = {d for d in (set(cfg.get("managed_dirs", [])) | {".insetu-data"}) if d.startswith('.')}
        filtered_files = [
            InSetuURI(u).path for u in valid_uris
            if not any(InSetuURI(u).path.startswith(f"{d}/") or f"/{d}/" in InSetuURI(u).path for d in hidden_managed)
        ]
        if not filtered_files: return

        managed_dirs = config.get("repo_managed_dirs") if config.get("repo_managed_dirs") is not None else cfg.get("managed_dirs", [])
        live_vfs_index = ctx.vfs.read(logical_index_path)
        cache_key = (workspace_id or "default", repo_dir)
        pre_sig = (tuple(filtered_files), hash(live_vfs_index), tuple(managed_dirs))
        with _CARTOGRAPHER_CACHE_LOCK:
            if live_vfs_index is not None and _CARTOGRAPHER_SIG_CACHE.get(cache_key) == pre_sig:
                return

        comments = extract_existing_comments(index_path, repo_path, vfs_content=live_vfs_index)
        tree_dict = build_tree_dict(filtered_files)
        if config.get("is_core_chassis"):
            os.makedirs(Path(index_path).parent, exist_ok=True)

        header = f"# {config.get('title', repo_dir)} Code Index\n\nThis index serves as the architectural map. It outlines the core directories and their operational purpose to maintain a clear mental model of the ecosystem, preventing cognitive overload and logic drift.\n\n```text\n{repo_dir}/\n"
        tree_lines = render_ascii_tree(tree_dict, comments, managed_dirs)
        footer = "\n```\n"
        rendered_index = header + "\n".join(tree_lines) + footer
        if rendered_index != live_vfs_index:
            ctx.vfs.save(logical_index_path, rendered_index, data={"ignore_ledger": True})
        post_sig = (tuple(filtered_files), hash(rendered_index), tuple(managed_dirs))
        with _CARTOGRAPHER_CACHE_LOCK:
            _CARTOGRAPHER_SIG_CACHE[cache_key] = post_sig

        missing = sum(1 for line in tree_lines if "[comment required]" in line)
        if not silent:
            if missing > 0:
                print(f"  └─ ✅ Index updated. ⚠️ {missing} placeholders require attention.")
            else:
                print(f"  └─ ✅ Index updated. Perfect documentation parity.")
    ctx.jobs.map_parallel(process_repo, all_configs)

    if not silent: print("\n🎉 Cartography complete!\n")

if __name__ == "__main__":
    map_repositories()