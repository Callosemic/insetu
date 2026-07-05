import os
import json
import datetime
import subprocess
import shutil
from flask import Blueprint, jsonify, request
from insetu.utils_core import get_valid_workspace_files, get_workspace_physics, get_gather_paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

gather_bp = Blueprint('gather', __name__)
__depends__ = []

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
def write_bucket(output_path, filepaths, title, domain_str, repo_path, repo_dir, workspace_id=None):
    if not filepaths: return

    content_lines = []
    content_lines.append("="*60 + f"\nINSETU TOPOLOGY ({title})\n" + "="*60 + "\n")
    content_lines.append(generate_ascii_tree(filepaths) + "\n\n")
    for filepath in filepaths:
        try:
            with open(os.path.join(repo_path, filepath), 'r', encoding='utf-8') as infile: content = infile.read()
            display_domain = domain_str
            content_lines.append(f"\n\n{'='*60}\n>>>NEW FILE :: {repo_dir}/{filepath} | {display_domain}\n{'='*60}\n\n{content}")
        except Exception as e: print(f"Skipping {filepath}: {e}")

    from insetu.routes_fs import execute_vfs_save
    execute_vfs_save(workspace_id, output_path, "".join(content_lines), data={"is_absolute_artifact": True})
def generate_context_file(workspace_id=None):
    from insetu.utils_core import load_config, get_gather_paths, get_workspace_physics
    paths = get_gather_paths(workspace_id)
    _, ws_root, _ = get_workspace_physics(workspace_id)
    # Pre-flight purge: destroy all stale contexts to prevent ghost files (excluding active ephemerals)
    import time
    from insetu.db import get_connection
    w_conn = get_connection("workers", workspace_id=workspace_id)
    active_ephemerals = [row['filepath'] for row in w_conn.execute("SELECT filepath FROM ephemeral_artifacts").fetchall()]

    if os.path.exists(paths["contexts_dir"]):
        for f in os.listdir(paths["contexts_dir"]):
            f_path = os.path.join(paths["contexts_dir"], f)
            if os.path.isfile(f_path):
                if f_path not in active_ephemerals:
                    try:
                        os.remove(f_path)
                    except Exception:
                        pass

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
            r_title = config.get("title", config["repo_dir"].replace('-', ' ').title())
            manifest[f"{config['repo_dir']}_vault.json"] = {
                "files": [f"{config['repo_dir']}/{f}" for f in final_list],
                "meta": {"title": r_title, "domain": config.get("domain", "Media Vault"), "desc": config.get("description", "Media vault assets.")}
            }
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
                    b_title = data["cfg"].get("title", b_id.replace('_', ' ').title())
                    b_domain = data["cfg"].get("domain", config.get("domain", "Workspaces"))
                    b_desc = data["cfg"].get("description", f"Context payload for {b_title}.")

                    out_path = os.path.join(paths["contexts_dir"], safe_out)
                    write_bucket(out_path, data["files"], b_title.upper(), b_domain, repo_path, config['repo_dir'], workspace_id)
                    manifest[safe_out] = {
                        "files": [f"{config['repo_dir']}/{f}" for f in data["files"]],
                        "meta": {"title": b_title, "domain": b_domain, "desc": b_desc}
                    }
            for module, data in dynamic_files.items():
                files = data["files"]
                cfg = data["cfg"]
                meta_map = cfg.get("meta_map", {})
                meta = meta_map.get(module, {})

                title = meta.get("title", module.replace('_', ' ').title())
                domain = meta.get("domain", cfg.get("domain", "Dynamic Modules"))
                desc = meta.get("description", cfg.get("description", f"Dynamically mapped logic and templates for {title}."))

                out_path = os.path.join(paths["contexts_dir"], f"{module}_context.txt")
                write_bucket(out_path, files, title.upper(), domain, repo_path, config['repo_dir'], workspace_id)
                manifest[f"{module}_context.txt"] = {
                    "files": [f"{config['repo_dir']}/{f}" for f in files],
                    "meta": {"title": title, "domain": domain, "desc": desc}
                }
        else:
            safe_out = config.get("out_file", f"{safe_r_dir}_context.txt")
            out_path = os.path.join(paths["contexts_dir"], safe_out)
            r_title = config.get("title", config["repo_dir"].replace('-', ' ').title())
            r_domain = config.get("domain", "Workspaces")
            r_desc = config.get("description", f"Context payload for {r_title}.")

            write_bucket(out_path, final_list, r_title, r_domain, repo_path, config['repo_dir'], workspace_id)
            manifest[safe_out] = {
                "files": [f"{config['repo_dir']}/{f}" for f in final_list],
                "meta": {"title": r_title, "domain": r_domain, "desc": r_desc}
            }
    # --- EXTENSION HOOKS ---
    from insetu.hooks import hooks
    hooks.emit('compile_contexts', manifest=manifest, workspace_id=workspace_id)
    # Re-inject surviving Ephemeral Artifacts into the manifest so they persist through background compiles
    for f_path in active_ephemerals:
        if f_path.startswith(paths["contexts_dir"]):
            f_name = os.path.basename(f_path)
            # Ensure it aligns with the new schema
            manifest[f_name] = {
                "files": [f"data/contexts/{f_name}"],
                "meta": {"title": f"📦 {f_name.replace('.txt','')}", "domain": "Quick-Pack Clipboard", "desc": "Ad-hoc context payload."}
            }

    manifest_out_path = os.path.join(paths["contexts_dir"], "manifest.json")
    from insetu.routes_fs import execute_vfs_save
    execute_vfs_save(workspace_id, manifest_out_path, json.dumps(manifest, indent=2), data={"is_absolute_artifact": True})

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

    from insetu.routes_fs import execute_vfs_save
    execute_vfs_save(workspace_id, out_path, "\n".join(out_lines), data={"is_absolute_artifact": True})

    # Register with the Ephemeral Ledger (24h TTL)
    from insetu.workers import register_ephemeral_artifact
    register_ephemeral_artifact(out_path, "quick_pack", 86400, workspace_id=workspace_id)
    # Eagerly inject into the manifest using SSOT caching functions
    manifest_path = os.path.join(paths["contexts_dir"], "manifest.json")
    manifest = load_json_file(manifest_path, {})
    manifest[filename] = {
        "files": [f"data/contexts/{filename}"],
        "meta": {"title": f"📦 {target_dir or 'Workspace'}", "domain": "Quick-Pack Clipboard", "desc": f"Ad-hoc context packed on {datetime.datetime.now().strftime('%Y-%m-%d')} (24h TTL)"}
    }
    save_json_file(manifest_path, manifest)

    return jsonify({"status": "success", "filename": filename})
@gather_bp.route('/api/<workspace_id>/gather/quick-pack/clear', methods=['POST'])
def api_gather_quick_pack_clear(workspace_id):
    import os
    from insetu.db import get_connection
    from insetu.utils_core import get_gather_paths, load_json_file, save_json_file

    conn = get_connection("workers", workspace_id=workspace_id)
    cursor = conn.execute("SELECT id, filepath FROM ephemeral_artifacts WHERE module_owner = 'quick_pack'")

    count = 0
    ephemeral_basenames = []

    for row in cursor.fetchall():
        try:
            if os.path.exists(row['filepath']):
                os.remove(row['filepath'])
            ephemeral_basenames.append(os.path.basename(row['filepath']))
            conn.execute("DELETE FROM ephemeral_artifacts WHERE id=?", (row['id'],))
            count += 1
        except Exception: 
            pass

    conn.commit()

    paths = get_gather_paths(workspace_id)
    manifest_path = os.path.join(paths["contexts_dir"], "manifest.json")
    manifest = load_json_file(manifest_path, {})

    keys_to_remove = [k for k in manifest.keys() if k in ephemeral_basenames]
    if keys_to_remove:
        for k in keys_to_remove:
            del manifest[k]
        save_json_file(manifest_path, manifest)

    return jsonify({"status": "success", "cleared": count})
