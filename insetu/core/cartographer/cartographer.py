import os
import subprocess
from pathlib import Path
from akasa.utils import get_workspace_physics, load_config, build_tree_dict
from insetu.core.topology.engine_topology import get_valid_workspace_files
from akasa.hooks import hooks
from insetu.core.sdk import InSetuExtension

cartographer_bp = InSetuExtension('cartographer', __name__, title="Cartographer", description="Code index mapping.", core=True)

SCRIPT_DIR = Path(__file__).resolve().parent.as_posix()

@hooks.on('register_compilation_steps')
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
def _background_map(ctx, target_repos=None, **kwargs):
    ctx.jobs.update_progress("Mapping repository topology...")
    map_repositories(ctx.workspace_id, target_repos=target_repos)
    return {
        "message": "Cartography complete.",
        "next_kwargs": {"ledger_events": kwargs.get("ledger_events", [])}
    }

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
                    cmap[clean_name.rstrip('/')] = comment
                    cmap[clean_name.rstrip('/') + '/'] = comment
        return cmap

    live_comments = {}
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            live_comments = parse_text_for_comments(f.read())
    git_comments = {}
    if repo_path:
        try:
            from insetu.core.utils_core import execute_binary
            rel_index = os.path.relpath(index_path, repo_path)
            res = execute_binary(['git', 'show', f'HEAD:{rel_index}'], capture_output=True, text=True, cwd=repo_path)
            if res.returncode == 0:
                git_comments = parse_text_for_comments(res.stdout)
        except Exception:
            pass

    # Merge comments: Live file takes precedence over Git, but missing live comments don't overwrite Git
    merged = git_comments.copy()
    merged.update(live_comments)
    return merged
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
    cfg_path, ws_root = get_workspace_physics(workspace_id)
    all_configs = cfg.get("target_repos", [])
    def process_repo(config):
        repo_dir = config.get("repo_dir")
        if not repo_dir: return
        if target_repos and repo_dir not in target_repos: return
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
            return
        if not silent: print(f"🗺️  Cartographing {repo_dir}...")

        comments = extract_existing_comments(index_path, repo_path)

        from insetu.core.topology.engine_topology import get_topology_files_for_repo
        valid_files = get_topology_files_for_repo(workspace_id, repo_dir, strip_prefix=True)

        if not valid_files: return

        filtered_files = [f for f in valid_files if not f.startswith('.tracker/') and '/.tracker/' not in f]
        if not filtered_files: return

        tree_dict = build_tree_dict(filtered_files)
        if config.get("is_core_chassis"):
            os.makedirs(Path(index_path).parent, exist_ok=True)

        header = f"# {config.get('title', repo_dir)} Code Index\n\nThis index serves as the architectural map. It outlines the core directories and their operational purpose to maintain a clear mental model of the ecosystem, preventing cognitive overload and logic drift.\n\n```text\n{repo_dir}/\n"
        managed_dirs = cfg.get("managed_dirs", []) + config.get("repo_managed_dirs", [])
        tree_lines = render_ascii_tree(tree_dict, comments, managed_dirs)
        footer = "\n```\n"

        logical_index_path = f"vfs://{repo_dir}/docs/CODE_INDEX.md" if config.get("is_core_chassis") else f"vfs://{repo_dir}/CODE_INDEX.md"
        from akasa.vfs import execute_vfs_save

        execute_vfs_save(workspace_id, logical_index_path, header + "\n".join(tree_lines) + footer, data={"ignore_ledger": True})

        missing = sum(1 for line in tree_lines if "[comment required]" in line)
        if not silent:
            if missing > 0:
                print(f"  └─ ✅ Index updated. ⚠️ {missing} placeholders require attention.")
            else:
                print(f"  └─ ✅ Index updated. Perfect documentation parity.")

    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(process_repo, config) for config in all_configs]
        concurrent.futures.wait(futures)

    if not silent: print("\n🎉 Cartography complete!\n")

if __name__ == "__main__":
    map_repositories()