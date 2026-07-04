import os
import json
import datetime
import subprocess
import shutil
from flask import Blueprint, jsonify, request
from insetu.utils_core import get_valid_workspace_files, get_workspace_physics, get_gather_paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

gather_bp = Blueprint('gather', __name__)

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
                continue # Let boundary files fall through to explicit buckets or the catch-all
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
    import time
    now_ts = time.time()
    for f in os.listdir(paths["contexts_dir"]):
        f_path = os.path.join(paths["contexts_dir"], f)
        if os.path.isfile(f_path):
            if f.startswith("quick_pack_"):
                # 24-hour TTL (86400 seconds) for ad-hoc clipboard packs
                if now_ts - os.path.getmtime(f_path) > 86400:
                    os.remove(f_path)
            else:
                os.remove(f_path)

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
            # Handled upstream via the compile_contexts Event Hook
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
    # Re-inject surviving Quick-Packs into the manifest so they persist through background compiles
    for f in os.listdir(paths["contexts_dir"]):
        if f.startswith("quick_pack_") and f.endswith(".txt"):
            manifest[f] = [f"data/contexts/{f}"]

    with open(os.path.join(paths["contexts_dir"], 
        "manifest.json"), 
        "w", encoding="utf-8") as f:
        json.dump(manifest, f)

@gather_bp.route('/api/<workspace_id>/gather/quick-pack', methods=['POST'])
def api_gather_quick_pack(workspace_id):
    """Stateless generator for ephemeral, ad-hoc context payloads without disk pollution."""
    data = request.json
    target_dir = data.get('target_dir', '').strip()
    recursive = data.get('recursive', False)
    specific_files = data.get('specific_files', None)

    if not target_dir:
        return jsonify({"error": "Target directory required."}), 400

    from insetu.utils_core import get_omniscient_workspace_files, get_workspace_physics
    repo = target_dir.split('/')[0]

    # SSOT Cartography: Pull exclusively from allowed files, protecting .git and node_modules
    all_files = get_omniscient_workspace_files(workspace_id, [repo])

    matched_files = []
    target_prefix = target_dir + '/' if target_dir else ''

    for filename, rel_path in all_files:
        if not rel_path.startswith(target_prefix) and target_dir != repo: 
            continue

        if specific_files is not None:
            if rel_path in specific_files:
                matched_files.append(rel_path)
            continue

        if not recursive:
            # Enforce 1-level depth by counting spatial slashes relative to the target
            target_depth = target_dir.count('/')
            file_depth = rel_path.count('/')
            if file_depth > target_depth + (1 if target_dir else 0):
                continue

        matched_files.append(rel_path)

    if not matched_files:
        return jsonify({"error": "No valid tracked files found in the specified path."}), 404

    _, ws_root, _ = get_workspace_physics(workspace_id)
    out_lines = []
    out_lines.append("="*60)
    out_lines.append(f"INSETU AD-HOC CONTEXT PAYLOAD ({target_dir})")
    out_lines.append("="*60)
    out_lines.append("")

    out_lines.append(generate_ascii_tree(matched_files))
    out_lines.append("\n")
    for rel_path in sorted(matched_files):
        abs_path = os.path.join(ws_root, rel_path)
        try:
            with open(abs_path, 'r', encoding='utf-8') as f:
                content = f.read()
            out_lines.append(f"{'='*60}\n>>>NEW FILE :: {rel_path} | Ad-Hoc Payload\n{'='*60}\n\n{content}\n\n")
        except Exception as e:
            out_lines.append(f"{'='*60}\n>>>NEW FILE :: {rel_path} | Ad-Hoc Payload\n{'='*60}\n\n[Error reading file: {str(e)}]\n\n")
    import time
    from insetu.utils_core import get_gather_paths, load_json_file, save_json_file

    safe_name = target_dir.replace('/', '_').replace('\\', '_') if target_dir else 'workspace'
    filename = f"quick_pack_{int(time.time())}_{safe_name}.txt"
    paths = get_gather_paths(workspace_id)
    out_path = os.path.join(paths["contexts_dir"], filename)

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(out_lines))

    # Eagerly inject into the manifest using SSOT caching functions
    manifest_path = os.path.join(paths["contexts_dir"], "manifest.json")
    manifest = load_json_file(manifest_path, {})
    manifest[filename] = [f"data/contexts/{filename}"]
    save_json_file(manifest_path, manifest)

    return jsonify({"status": "success", "filename": filename})
@gather_bp.route('/api/<workspace_id>/gather/quick-pack/clear', methods=['POST'])
def api_gather_quick_pack_clear(workspace_id):
    import os
    from insetu.utils_core import get_gather_paths, load_json_file, save_json_file
    paths = get_gather_paths(workspace_id)

    count = 0
    if os.path.exists(paths["contexts_dir"]):
        for f in os.listdir(paths["contexts_dir"]):
            if f.startswith("quick_pack_") and f.endswith(".txt"):
                try:
                    os.remove(os.path.join(paths["contexts_dir"], f))
                    count += 1
                except Exception: pass

    manifest_path = os.path.join(paths["contexts_dir"], "manifest.json")
    manifest = load_json_file(manifest_path, {})

    keys_to_remove = [k for k in manifest.keys() if k.startswith("quick_pack_")]
    if keys_to_remove:
        for k in keys_to_remove:
            del manifest[k]
        save_json_file(manifest_path, manifest)

    return jsonify({"status": "success", "cleared": count})
