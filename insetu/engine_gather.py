import os
import json
import datetime
import subprocess
import shutil
from flask import Blueprint, jsonify, request
from insetu.utils_core import get_valid_workspace_files, get_workspace_physics, get_gather_paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

gather_bp = Blueprint('gather', __name__)

@gather_bp.route('/api/<workspace_id>/batches', methods=['GET'])
def api_batches(workspace_id):
    import os
    from insetu.utils_core import load_config, load_workflows, get_gather_paths, get_safe_repo_id

    cfg = load_config(workspace_id)
    w_cfg = load_workflows(workspace_id)
    paths = get_gather_paths(workspace_id)

    batches = w_cfg.get("context_batches", [])

    # Gather options for the UI batch editor
    expected_contexts = set()
    expected_diffs = set()

    for c in cfg.get("target_repos", []):
        r_dir = c.get("repo_dir", "")
        safe_r_dir = get_safe_repo_id(r_dir)
    
        subs = c.get("sub_buckets", [])

        if subs:
            for b in subs:
                if not b.get("dynamic_split_prefix"):
                    out = b.get("out_file", f"{r_dir}_{b.get('id')}_context.txt")
                    expected_contexts.add(f"contexts/{out}")
        
                    expected_diffs.add(f"diffs/{out.replace('_context.txt', '_diffs.txt')}")
                else:
                    # Dynamic split prefix - infer from active directories
                    dyn_dir = os.path.join(paths["workspace_root"], r_dir, b["dynamic_split_prefix"])
                   
                    if os.path.exists(dyn_dir):
                        for module in os.listdir(dyn_dir):
                            if os.path.isdir(os.path.join(dyn_dir, module)) and not module.startswith('.'):
                                expected_contexts.add(f"contexts/{module}_context.txt")
      
                                expected_diffs.add(f"diffs/{module}_diffs.txt")
        else:
            out = c.get("out_file", f"{safe_r_dir}_context.txt")
            expected_contexts.add(f"contexts/{out}")
            expected_diffs.add(f"diffs/{out.replace('_context.txt', '_diffs.txt')}")

    # Include physically existing files in case of unmapped manual overrides
    if os.path.exists(paths["contexts_dir"]):
       
        for f in os.listdir(paths["contexts_dir"]):
            if f.endswith('.txt'): expected_contexts.add(f"contexts/{f}")
    if os.path.exists(paths["diffs_dir"]):

        for f in os.listdir(paths["diffs_dir"]):
            if f.endswith('.txt'): expected_diffs.add(f"diffs/{f}")
    available_prompts = []
    if os.path.exists(paths["prompts_dir"]):
        for root, _, files in os.walk(paths["prompts_dir"]):
            for f in files:
                if f.lower().endswith(('.md', '.txt')) or f.lower() in ('.gitkeep', '.keep'):
                    rel_path = os.path.relpath(os.path.join(root, f), paths["prompts_dir"]).replace('\\', '/')
                    available_prompts.append(f"prompts/{rel_path}")

    artifacts_abs = paths["artifacts_base"].replace('\\', '/')
    profile_abs = os.path.dirname(paths["config_path"]).replace('\\', '/')

    return jsonify({
        "batches": batches,
       
        "available_contexts": sorted(list(expected_contexts)),
        "available_diffs": sorted(list(expected_diffs)),
        "available_prompts": sorted(available_prompts),
        "artifacts_dir": artifacts_abs,
        "profile_dir": profile_abs
    })

@gather_bp.route('/api/<workspace_id>/batches/save', methods=['POST'])
def api_batches_save(workspace_id):
    import json
    import insetu.utils_core as utils_core
    from insetu.utils_core import load_workflows, get_gather_paths

    paths = get_gather_paths(workspace_id)

    data = request.json
    w_cfg = load_workflows(workspace_id)
    batches = w_cfg.get("context_batches", [])
    batch_id = data.get("id")
    existing = next((b for b in batches if b["id"] == batch_id), None)

    if existing:
        # Clear optional fields if not present in the incoming payload to prevent ghost states
        for optional_key in ["include_prompt", "response_path", "prompt_text"]:
            if optional_key in existing and optional_key not in data:
                del existing[optional_key]
        existing.update(data)
    else:
        batches.append(data)

    w_cfg["context_batches"] = batches
    utils_core.save_json_file(paths["workflows_path"], w_cfg)

    # Auto-compile the modified batch silently
    target_batch = existing if existing else data
    try:
        compile_batch(target_batch, workspace_id)
    except Exception as e:
        print(f"Warning: Failed to auto-compile batch {batch_id}: {str(e)}")

    return jsonify({"status": "success"})

@gather_bp.route('/api/<workspace_id>/batches/delete', methods=['POST'])
def api_batches_delete(workspace_id):
    import insetu.utils_core as utils_core
    from insetu.utils_core import load_workflows, get_gather_paths
    paths = get_gather_paths(workspace_id)
    data = request.json
    batch_id = data.get("id")

    w_cfg = load_workflows(workspace_id)
    batches = w_cfg.get("context_batches", [])
    w_cfg["context_batches"] = [b for b in batches if b.get("id") != batch_id]

    utils_core.save_json_file(paths["workflows_path"], w_cfg)

    import os
    try:
        out_path = os.path.join(paths["gather_dir"], f"{batch_id}_context.txt")
        if os.path.exists(out_path):
            os.remove(out_path)
    except Exception:
        pass

    return jsonify({"status": "success"})

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