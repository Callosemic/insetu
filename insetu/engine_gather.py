import os
import json
import datetime
import subprocess
import shutil
from insetu.utils_core import get_valid_workspace_files, get_workspace_physics, get_gather_paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
def generate_ascii_tree(file_paths):
    tree = {}
    for path in file_paths:
        parts = path.split('/')
        current = tree
        for part in parts:
            if part not in current: current[part] = {}
            current = current[part]
            
    def print_tree(node, prefix=""):
        lines = []
        entries = sorted(list(node.keys()))
        for i, key in enumerate(entries):
            is_last = (i == len(entries) - 1)
            lines.append(f"{prefix}{'└── ' if is_last else '├── '}{key}")
            lines.extend(print_tree(node[key], prefix + ("    " if is_last else "│   ")))
        return lines
    return ".\n" + "\n".join(print_tree(tree))
def resolve_file_bucket(filepath, sub_buckets):
    """DRY Helper to map a filepath to its configured sub-bucket."""
    for b in sub_buckets:
        prefix = b.get("dynamic_split_prefix")
        if prefix:
            if prefix == "." or filepath.startswith(prefix):
                parts = filepath.split("/")
                module_idx = len([p for p in prefix.split('/') if p and p != '.'])
                if len(parts) > module_idx + 1:
                    return b, parts[module_idx]
                return b, "misc"
        elif b.get("match_prefixes") and any(filepath.startswith(p) for p in b["match_prefixes"]):
            return b, None

    catch_all = next((b for b in sub_buckets if b.get("is_catch_all")), None)
    return catch_all, None

def write_bucket(output_path, filepaths, title, domain_str, repo_path, repo_dir):
    if not filepaths: return
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as outfile:
        outfile.write("="*60 + f"\nINSETU TOPOLOGY ({title})\n" + "="*60 + "\n")
        outfile.write(generate_ascii_tree(filepaths) + "\n\n")
        for filepath in filepaths:
            try:
                with open(os.path.join(repo_path, filepath), 'r', encoding='utf-8') as infile: content = infile.read()

                display_domain = domain_str

                outfile.write(f"\n\n{'='*60}\n>>>NEW FILE :: {repo_dir}/{filepath} | {display_domain}\n{'='*60}\n\n{content}")
            except Exception as e: print(f"Skipping {filepath}: {e}")
def generate_context_file(workspace_id=None):
    from insetu.utils_core import load_config, get_gather_paths, get_workspace_physics
    paths = get_gather_paths(workspace_id)
    _, ws_root, _ = get_workspace_physics(workspace_id)

    # Pre-flight purge: destroy all stale contexts to prevent ghost files
    for f in os.listdir(paths["contexts_dir"]):
        f_path = os.path.join(paths["contexts_dir"], f)
        if os.path.isfile(f_path): os.remove(f_path)

    live_cfg = load_config(workspace_id)
    from insetu.utils_core import get_safe_repo_id
    manifest = {}
    for config in live_cfg.get("target_repos", []):
        if config.get("exclude_from_context"): continue
        safe_r_dir = get_safe_repo_id(config.get("repo_dir"))

        physical_path = config.get("physical_path")
        if physical_path:
            repo_path = os.path.abspath(os.path.expanduser(physical_path))
        else:
            repo_path = os.path.abspath(os.path.join(ws_root, config["repo_dir"]))

        if not os.path.exists(repo_path): continue
        final_list = get_valid_workspace_files(repo_path, config)
        if not final_list: continue
        archive_type = config.get("archive_type", "repo")
        if archive_type == "media-vault":
            # Expose to UI manifest without generating massive context string payloads
            manifest[f"{config['repo_dir']}_vault.json"] = [f"{config['repo_dir']}/{f}" for f in final_list]
            continue
        elif archive_type == "prompt-library":
            # Inject into UI under the Prompts & State category without dumping context payloads
            manifest["prompts_context.txt"] = [f"{config['repo_dir']}/{f}" for f in final_list]
            continue
        sub_buckets = config.get("sub_buckets", [])
        if sub_buckets:
            buckets = {b["id"]: {"files": [], "cfg": b} for b in sub_buckets if not b.get("dynamic_split_prefix")}
            dynamic_files = {}
            for filepath in final_list:
                b, module = resolve_file_bucket(filepath, sub_buckets)

                if b and module:
                    if module not in dynamic_files: dynamic_files[module] = {"files": [], "cfg": b}
                    dynamic_files[module]["files"].append(filepath)
                elif b:
                    buckets[b["id"]]["files"].append(filepath)
                else:
                    if "default_catch_all" not in buckets:
                        # Formalize the implicit catch-all bucket for unmapped files
                        buckets["default_catch_all"] = {
                            "files": [], 
                            "cfg": {
                                "id": "catch_all", 
                                "title": config.get("title", config["repo_dir"]), 
                                "domain": config.get("domain", "Workspaces"), 
                                "out_file": config.get("out_file", f"{safe_r_dir}_context.txt")
                            }
                        }
                    buckets["default_catch_all"]["files"].append(filepath)
            for b_id, data in buckets.items():
                if data["files"]:
                    safe_out = data["cfg"].get("out_file", f"{config['repo_dir']}_{b_id}_context.txt")

                    out_path = os.path.join(paths["contexts_dir"], safe_out)
                    write_bucket(out_path, data["files"], data["cfg"].get("title", b_id.upper()), data["cfg"].get("domain", ""), repo_path, config['repo_dir'])
                    manifest[safe_out] = [f"{config['repo_dir']}/{f}" for f in data["files"]]
            for module, data in dynamic_files.items():
                files = data["files"]
                cfg = data["cfg"]
                meta_map = cfg.get("meta_map", {})
                meta = meta_map.get(module, {})

                title = meta.get("title", module.replace('_', ' ').title())
                domain = meta.get("domain", cfg.get("domain", "Dynamic Modules"))


                out_path = os.path.join(paths["contexts_dir"], f"{module}_context.txt")
                write_bucket(out_path, files, title.upper(), domain, repo_path, config['repo_dir'])
                manifest[f"{module}_context.txt"] = [f"{config['repo_dir']}/{f}" for f in files]
        else:
            safe_out = config.get("out_file", f"{safe_r_dir}_context.txt")
            out_path = os.path.join(paths["contexts_dir"], safe_out)

            write_bucket(out_path, final_list, config.get("title", config["repo_dir"]), config.get("domain", ""), repo_path, config['repo_dir'])
            manifest[safe_out] = [f"{config['repo_dir']}/{f}" for f in final_list]
    # --- EXTENSION HOOKS ---
    from insetu.hooks import hooks
    hooks.emit('compile_contexts', manifest=manifest, workspace_id=workspace_id)

    # --- COMPILE CONTEXT BATCHES ---
    from insetu.utils_core import load_workflows
    w_cfg = load_workflows(workspace_id)
    context_batches = w_cfg.get("context_batches", [])
    for batch in context_batches:
        compile_batch(batch, workspace_id)

    with open(os.path.join(paths["contexts_dir"], "manifest.json"), 
        "w", encoding="utf-8") as f:
        json.dump(manifest, f)
def compile_batch(batch, workspace_id=None):
    from insetu.utils_core import get_gather_paths
    paths = get_gather_paths(workspace_id)
    batch_id = batch.get("id")
    if not batch_id: return
    includes = batch.get("includes", [])
    out_path = os.path.join(paths["gather_dir"], f"{batch_id}_context.txt")
    with open(out_path, "w", encoding="utf-8") as out_f:
        out_f.write(f"========== BATCH: {batch.get('title', batch_id)} ==========\n\n")
        for inc in includes:
            inc_path = os.path.join(paths["artifacts_base"], inc)
            if os.path.exists(inc_path):
                with open(inc_path, "r", encoding="utf-8") as in_f:
                    out_f.write(f"--- {inc} ---\n")
                    out_f.write(in_f.read())
                    out_f.write("\n\n")
            else:
                out_f.write(f"--- {inc} (NOT FOUND) ---\n\n")