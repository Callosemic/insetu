import os
import re
import subprocess
import json
from pathlib import Path
from insetu.utils_core import get_valid_workspace_files, get_workspace_physics, load_config
from insetu.hooks import hooks
from insetu.workers import submit_immediate_job, update_immediate_job_status, register_callback
import uuid

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
def _background_map(job_id, workspace_id, target_repos=None):
    try:
        update_immediate_job_status(job_id, 'processing', "Mapping repository topology...", workspace_id=workspace_id)
        map_repositories(workspace_id, target_repos=target_repos)
        update_immediate_job_status(job_id, 'completed', "Cartography complete.", workspace_id=workspace_id)
    except Exception as e:
        update_immediate_job_status(job_id, 'failed', f"Mapping failed: {str(e)}", workspace_id=workspace_id)
register_callback("cartographer", "map_task", _background_map)

def extract_existing_comments(index_path, repo_path=None):
    """Pass 1: Extracts existing comments, falling back to Git history to prevent data loss."""
    def parse_text_for_comments(text):
        cmap = {}
        for line in text.splitlines():
            if "#" in line and any(c in line for c in ("├──", "└──", "│")):
                parts = line.split("#", 1)
                clean_name = parts[0].lstrip(' │├└─\t').rstrip(' \t')
                comment = parts[1].strip()
                # Ignore system placeholders to prevent placeholder lock-in
                if clean_name and comment not in ("[comment required]", "[managed file]"):
                    cmap[clean_name] = comment
        return cmap

    live_comments = {}
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            live_comments = parse_text_for_comments(f.read())

    git_comments = {}
    if repo_path:
        try:
            rel_index = os.path.relpath(index_path, repo_path)
            res = subprocess.run(['git', 'show', f'HEAD:{rel_index}'], capture_output=True, text=True, cwd=repo_path)
            if res.returncode == 0:
                git_comments = parse_text_for_comments(res.stdout)
        except Exception:
            pass

    # Merge comments: Live file takes precedence over Git, but missing live comments don't overwrite Git
    merged = git_comments.copy()
    merged.update(live_comments)
    return merged

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
def render_ascii_tree(node, comment_map, managed_dirs, prefix="", current_path=""):
    """Pass 2: Builds the new tree and injects the preserved or placeholder comments."""
    lines = []
    entries = sorted(list(node.keys()))

    # Declarative management: Check if current path falls under managed folders
    is_managed = any(d in current_path.split("/") for d in managed_dirs)

    for i, key in enumerate(entries):
        is_last = (i == len(entries) - 1)
        connector = "└── " if is_last else "├── "

        # Determine if it's a directory (has children) to match folder keys
        is_dir = isinstance(node[key], dict) and len(node[key]) > 0
        lookup_key = f"{key}/" if is_dir else key

        # Attempt to match the exact key, fallback to the raw key
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
        next_path = f"{current_path}/{key}" if current_path else key
        lines.extend(render_ascii_tree(node[key], comment_map, managed_dirs, prefix + extension, next_path))

    return lines
def map_repositories(workspace_id=None, silent=True, target_repos=None):
    if not silent: print(f"\n{'-'*50}\n🚀 inSetu: Mapping Repository Topologies\n{'-'*50}")
    cfg = load_config(workspace_id)
    cfg_path, ws_root, _ = get_workspace_physics(workspace_id)
    all_configs = cfg.get("target_repos", [])
    for config in all_configs:
        repo_dir = config.get("repo_dir")
        if not repo_dir:
            continue
        if target_repos and repo_dir not in target_repos:
            continue
        from pathlib import Path
        ws_root_path = Path(ws_root).resolve()

        physical_path = config.get("physical_path")
        if physical_path:
            repo_path = Path(physical_path).expanduser().resolve()
        else:
            repo_path = (ws_root_path / repo_dir).resolve()

        index_path = (repo_path / "docs" / "CODE_INDEX.md") if config.get("is_core_chassis") else (repo_path / "CODE_INDEX.md")
        if not repo_path.exists():
            if not silent: print(f"⚠️  Skipping {repo_dir}: Directory not found.")
            continue
        if not silent: print(f"🗺️  Cartographing {repo_dir}...")
        # Pass 1: Preserve (checking disk and Git history)
        comments = extract_existing_comments(index_path, repo_path)
        # Pass 2: Discover & Filter (SSOT)
        valid_files = get_valid_workspace_files(repo_path, config)

        if not valid_files:
            continue

        # Exclude highly volatile state folders like .tracker from the architectural code index
        filtered_files = [f for f in valid_files if not f.startswith('.tracker/') and '/.tracker/' not in f]

        if not filtered_files:
            continue

        tree_dict = build_tree_dict(filtered_files)

        # Ensure the docs directory exists if writing to the core chassis
        if config.get("is_core_chassis"):
            os.makedirs(os.path.dirname(index_path), exist_ok=True)
        header = f"# {config.get('title', repo_dir)} Code Index\n\nThis index serves as the architectural map. It outlines the core directories and their operational purpose to maintain a clear mental model of the ecosystem, preventing cognitive overload and logic drift.\n\n```text\n{repo_dir}/\n"
        # Extract declarative managed list from config
        managed_dirs = cfg.get("managed_dirs", []) + config.get("repo_managed_dirs", [])
        tree_lines = render_ascii_tree(tree_dict, comments, managed_dirs)
        footer = "\n```\n"
        try:
            rel_index_path = index_path.relative_to(ws_root_path).as_posix()
        except ValueError:
            rel_index_path = index_path.as_posix()

        from insetu.routes_fs import execute_vfs_save

        # ADR 0018: Ignore Ledger to prevent Cartographer from triggering infinite recompilation loops
        execute_vfs_save(workspace_id, rel_index_path, header + "\n".join(tree_lines) + footer, data={"ignore_ledger": True})

        missing = sum(1 for line in tree_lines if "[comment required]" in line)
        if missing > 0:
            if not silent: print(f"  └─ ✅ Index updated. ⚠️ {missing} placeholders require attention.")
        else:
            if not silent: print(f"  └─ ✅ Index updated. Perfect documentation parity.")

    if not silent: print("\n🎉 Cartography complete!\n")

if __name__ == "__main__":
    map_repositories()