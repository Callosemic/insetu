import os
import io
import random
import datetime
from contextlib import redirect_stdout
from flask import Flask, render_template, request, jsonify, send_file
from insetu.utils_core import resolve_workspace_path, get_sister_repos, WORKSPACE_ROOT
from insetu.engine_bridge import parse_blocks, apply_block_in_memory
import insetu.engine_gather as engine_gather
import insetu.engine_tracker as engine_tracker
app = Flask(__name__)

# --- INSETU EXTENSION ARCHITECTURE ROUTINE ---
def load_workspace_extensions():
    from insetu.utils_core import load_config
    import importlib

    cfg = load_config()
    extensions = cfg.get("extensions", [])

    for ext in extensions:
        try:
            # Dynamically resolve engine module names matching the plugin array flags
            module = importlib.import_module(f"insetu.engine_{ext}")
            blueprint = getattr(module, f"{ext}_bp")
            app.register_blueprint(blueprint)
            print(f"🔌 Extension Mounted Successfully: [engine_{ext}]")
        except (ImportError, AttributeError) as e:
            print(f"⚠️  Extension Mount Failed [{ext}]: {str(e)}")

# Ignite active workspace feature components JIT at application startup
load_workspace_extensions()

@app.route('/sw.js')
def sw():
    return send_file(os.path.join(app.static_folder, 'sw.js'), mimetype='application/javascript')
@app.route('/manifest.json')
def manifest():
    import json
    import os
    from insetu.utils_core import load_config

    # Load the base blueprint manifest map
    base_manifest_path = os.path.join(app.static_folder, 'manifest.json')
    try:
        with open(base_manifest_path, 'r', encoding='utf-8') as f:
            manifest_data = json.load(f)
    except Exception:
        manifest_data = {}
    cfg = load_config()
    instance_title = cfg.get("instance_title", "inSetu Developer OS")
    # Inject the instance title cleanly into the PWA footprint
    manifest_data["name"] = instance_title
    manifest_data["short_name"] = instance_title.split()[0] if instance_title else "Axoneme"

    # Establish complete PWA isolation using local instance scopes
    pwa_scope = cfg.get("instance_pwa_scope", "default")
    manifest_data["id"] = f"/pwa-{pwa_scope}"
    manifest_data["start_url"] = f"/?node={pwa_scope}"

    from insetu.utils_core import CONFIG_PATH
    # Append a cache-busting timestamp query parameter so browsers re-evaluate the custom icons
    ts = int(os.path.getmtime(CONFIG_PATH)) if os.path.exists(CONFIG_PATH) else 1
    if "icons" in manifest_data:
        for icon in manifest_data["icons"]:
            if "icon-192" in icon.get("src", ""):
                icon["src"] = f"/static/icon-192.png?v={ts}"
            elif "icon-512" in icon.get("src", ""):
                icon["src"] = f"/static/icon-512.png?v={ts}"

    return jsonify(manifest_data)
@app.before_request
def intercept_local_static_assets():
    """
    Intercepts standard static asset routing routes before Flask's native 
    static file engine serves them, checking the local environment first.
    """
    import os
    from flask import send_file
    from insetu.utils_core import CONFIG_PATH

    path = request.path
    if path in ['/static/icon-192.png', '/static/icon-512.png']:
        filename = os.path.basename(path)
        # Anchor to the absolute instance directory to survive os.chdir() hijacking
        instance_dir = os.path.dirname(CONFIG_PATH)
        local_path = os.path.join(instance_dir, "static", filename)
        if os.path.exists(local_path):
            return send_file(local_path, mimetype='image/png')

@app.route('/favicon.ico')
def favicon():
    from insetu.utils_core import load_config, CONFIG_PATH
    import os
    cfg = load_config()
    custom_icon_name = cfg.get("instance_favicon", "favicon.ico")

    # Anchor to the absolute instance directory to survive os.chdir() hijacking
    instance_dir = os.path.dirname(CONFIG_PATH)
    local_icon_path = os.path.join(instance_dir, "static", custom_icon_name)

    if os.path.exists(local_icon_path):
        mimetype = 'image/png' if local_icon_path.lower().endswith('.png') else 'image/vnd.microsoft.icon'
        return send_file(local_icon_path, mimetype=mimetype)
    return send_file(os.path.join(app.static_folder, 'favicon.ico'), mimetype='image/vnd.microsoft.icon')
@app.route('/api/repos', methods=['GET'])
def api_repos():
    from insetu.utils_core import get_sister_repos, load_config, WORKSPACE_ROOT
    import os
    cfg = load_config()
    targets = cfg.get("target_repos", [])

    # Dynamically inject discovered directories into meta_map for the frontend
    for c in targets:
        r_dir = c.get("repo_dir", "")
        for b in c.get("sub_buckets", []):
            if b.get("dynamic_split_prefix"):
                if "meta_map" not in b:
                    b["meta_map"] = {}
                dyn_dir = os.path.join(WORKSPACE_ROOT, r_dir, b["dynamic_split_prefix"])
                if os.path.exists(dyn_dir):
                    for brand in os.listdir(dyn_dir):
                        if os.path.isdir(os.path.join(dyn_dir, brand)) and not brand.startswith('.'):
                            if brand not in b["meta_map"]:
                                b["meta_map"][brand] = {"title": brand.replace('_', ' ').title()}
    from insetu.utils_core import CONFIG_PATH
    return jsonify({
        "repos": get_sister_repos(),
        "term_port": cfg.get("term_port", 8181),
        "targets": targets,
        "category_order": cfg.get("category_order", []),
        "hidden_outputs": cfg.get("hidden_outputs", ["context_prompt.md", "context_prompt_diffs.txt"]),
        "config_missing": not os.path.exists(CONFIG_PATH)
    })
@app.route('/api/system/workspaces', methods=['GET', 'POST'])
def api_workspaces():
    import json
    import os
    index_path = os.path.join(os.getcwd(), ".insetu", "profiles", "workspaces.json")

    if request.method == 'GET':
        if not os.path.exists(index_path):
            return jsonify({"active_workspace": "default", "workspaces": {}})

        with open(index_path, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))

    if request.method == 'POST':
        data = request.json
        new_active = data.get("active_workspace")
        if not os.path.exists(index_path):
            return jsonify({"error": "workspaces.json not found."}), 404

        with open(index_path, 'r', encoding='utf-8') as f:
            w_data = json.load(f)

        if new_active not in w_data.get("workspaces", {}):
            return jsonify({"error": "Workspace ID not found."}), 400

        w_data["active_workspace"] = new_active
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(w_data, f, indent=2)

        # Acknowledge the swap, then gracefully restart the daemon
        import threading
        import sys
        import os

        def restart():
            import time
            time.sleep(1.0)
            # Use absolute paths to guarantee a clean process replacement at the OS level
            python_exe = sys.executable
            cli_script = os.path.abspath(sys.argv[0])
            os.execv(python_exe, [python_exe, cli_script] + sys.argv[1:])

        threading.Thread(target=restart, daemon=True).start()

    return jsonify({"status": "success", "message": f"Switched to {new_active}"})
@app.route('/api/batches', methods=['GET'])
def api_batches():
    from insetu.utils_core import load_config, load_workflows
    import insetu.engine_gather as engine_gather
    import os
    cfg = load_config()
    w_cfg = load_workflows()
    batches = w_cfg.get("context_batches", [])

    # Gather options for the UI batch editor
    expected_contexts = set()
    expected_diffs = set()
    import insetu.utils_core as utils_core
    from insetu.utils_core import get_safe_repo_id
    for c in cfg.get("target_repos", []):
        r_dir = c.get("repo_dir", "")
        safe_r_dir = get_safe_repo_id(r_dir)

        # Add implicit tracker files
        t_ctx = f"{safe_r_dir}_tracker_context.txt"
        expected_contexts.add(f"contexts/{t_ctx}")
        expected_diffs.add(f"diffs/{t_ctx.replace('_context.txt', '_diffs.txt')}")

        subs = c.get("sub_buckets", [])
        if subs:
            for b in subs:
                if not b.get("dynamic_split_prefix"):
                    out = b.get("out_file", f"{r_dir}_{b.get('id')}_context.txt")
                    expected_contexts.add(f"contexts/{out}")
                    expected_diffs.add(f"diffs/{out.replace('_context.txt', '_diffs.txt')}")
                else:
                    # Dynamic split prefix - infer from active directories
                    dyn_dir = os.path.join(utils_core.WORKSPACE_ROOT, r_dir, b["dynamic_split_prefix"])
                    if os.path.exists(dyn_dir):
                        for brand in os.listdir(dyn_dir):
                            if os.path.isdir(os.path.join(dyn_dir, brand)) and not brand.startswith('.'):
                                expected_contexts.add(f"contexts/{brand}_context.txt")
                                expected_diffs.add(f"diffs/{brand}_diffs.txt")
        else:
            out = c.get("out_file", f"{safe_r_dir}_context.txt")
            expected_contexts.add(f"contexts/{out}")
            expected_diffs.add(f"diffs/{out.replace('_context.txt', '_diffs.txt')}")

    # Include physically existing files in case of unmapped manual overrides
    if os.path.exists(engine_gather.CONTEXTS_DIR):
        for f in os.listdir(engine_gather.CONTEXTS_DIR):
            if f.endswith('.txt'): expected_contexts.add(f"contexts/{f}")
    if os.path.exists(engine_gather.DIFFS_DIR):
        for f in os.listdir(engine_gather.DIFFS_DIR):
            if f.endswith('.txt'): expected_diffs.add(f"diffs/{f}")
    available_prompts = [f"prompts/{f}" for f in os.listdir(engine_gather.PROMPTS_DIR) if f.lower().endswith(('.md', '.txt'))] if os.path.exists(engine_gather.PROMPTS_DIR) else []
    artifacts_rel = os.path.relpath(engine_gather.ARTIFACTS_BASE, utils_core.WORKSPACE_ROOT).replace('\\', '/')
    profile_rel = os.path.relpath(os.path.dirname(utils_core.CONFIG_PATH), utils_core.WORKSPACE_ROOT).replace('\\', '/')

    return jsonify({
        "batches": batches,
        "available_contexts": sorted(list(expected_contexts)),
        "available_diffs": sorted(list(expected_diffs)),
        "available_prompts": sorted(available_prompts),
        "artifacts_dir": artifacts_rel,
        "profile_dir": profile_rel
    })
@app.route('/api/batches/save', methods=['POST'])
def api_batches_save():
    from insetu.utils_core import load_workflows, WORKFLOWS_PATH
    import insetu.utils_core as utils_core
    import json
    data = request.json
    w_cfg = load_workflows()
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
    utils_core.save_json_file(WORKFLOWS_PATH, w_cfg)

    # Auto-compile the modified batch silently
    import insetu.engine_gather as engine_gather
    target_batch = existing if existing else data
    try:
        engine_gather.compile_batch(target_batch)
    except Exception as e:
        print(f"Warning: Failed to auto-compile batch {batch_id}: {str(e)}")

    return jsonify({"status": "success"})
@app.route('/')
def index():
    from insetu.utils_core import load_config
    cfg = load_config()
    instance_title = cfg.get("instance_title", "inSetu Developer OS")
    instance_emoji = cfg.get("instance_emoji", "⚙️")
    extensions = cfg.get("extensions", [])
    return render_template('index.html', title=instance_title, emoji=instance_emoji, extensions=extensions)
import threading
_COMPILER_LOCK = threading.Lock()
@app.route('/submit', methods=['POST'])
def submit():
    if not _COMPILER_LOCK.acquire(blocking=False):
        existing_files = [f for f in os.listdir(engine_gather.CONTEXTS_DIR) if f.endswith('.txt')] if os.path.exists(engine_gather.CONTEXTS_DIR) else []
        return jsonify({"status": "success", "message": "Compilation locked. Serving cached context.", "files": sorted(existing_files)})
    try:
        try:
            engine_tracker.rescue_orphan_tickets()
            engine_tracker.reconcile_declared_closures()
            engine_tracker.archive_stale_tickets()
        except Exception as e:
            print(f"Warning: Tracker housekeeping failed: {str(e)}")

        # Ensure diffs are actively generated before compiling contexts
        try:
            engine_gather.generate_diff_context()
        except Exception as e:
            print(f"Warning: Diff generation failed: {str(e)}")

        try:
            from insetu.cartographer import map_repositories
            map_repositories()
        except Exception as e:
            print(f"Warning: Cartographer failed: {str(e)}")
        engine_gather.generate_context_file()
        generated_files = [f for f in os.listdir(engine_gather.CONTEXTS_DIR) if f.endswith('.txt')]
        res = jsonify({"status": "success", "message": "Context successfully compiled!", "files": sorted(generated_files)})
    except Exception as e:
        import traceback
        print(f"CRITICAL COMPILER ERROR:\n{traceback.format_exc()}")
        res = jsonify({"status": "error", "message": f"Compilation Error: {str(e)}", "files": []})
    finally:
        _COMPILER_LOCK.release()
    return res

@app.route('/api/fs/move', methods=['POST'])
def api_fs_move():
    data = request.json
    filepath = data.get("filepath", "").strip()
    dest_path = data.get("dest_path", "").strip()
    if not filepath or not dest_path: return jsonify({"error": "Filepath and destination required"}), 400

    resolved_src = resolve_workspace_path(filepath)
    resolved_dest = resolve_workspace_path(dest_path)

    if not os.path.exists(resolved_src): return jsonify({"error": "Source file not found"}), 404

    os.makedirs(os.path.dirname(resolved_dest), exist_ok=True)

    import shutil
    try:
        shutil.move(resolved_src, resolved_dest)
    except Exception as e:
        return jsonify({"error": f"OS Move Failed: {str(e)}"}), 500

    try:
        from insetu.cartographer import map_repositories
        map_repositories()
    except Exception as e:
        print(f"Warning: Cartographer failed during move: {str(e)}")

    return jsonify({"status": "success", "new_filepath": dest_path})

@app.route('/api/fs/archive', methods=['POST'])
def api_fs_archive():
    data = request.json
    filepath = data.get("filepath", "").strip()
    if not filepath: return jsonify({"error": "Filepath required"}), 400
    resolved_path = resolve_workspace_path(filepath)
    if not os.path.exists(resolved_path): return jsonify({"error": "File not found"}), 404

    archive_dir = os.path.join(os.path.dirname(resolved_path), "archived")
    os.makedirs(archive_dir, exist_ok=True)
    new_path = os.path.join(archive_dir, os.path.basename(resolved_path))

    import shutil
    try:
        shutil.move(resolved_path, new_path)
    except Exception as e:
        return jsonify({"error": f"OS Move Failed: {str(e)}"}), 500

    try:
        from insetu.cartographer import map_repositories
        map_repositories()
    except Exception as e:
        print(f"Warning: Cartographer failed during archive: {str(e)}")

    return jsonify({"status": "success"})

@app.route('/api/fs/delete', methods=['POST'])
def api_fs_delete():
    data = request.json
    filepath = data.get("filepath", "").strip()
    if not filepath: return jsonify({"error": "Filepath required"}), 400
    resolved_path = resolve_workspace_path(filepath)
    if not os.path.exists(resolved_path): return jsonify({"error": "File not found"}), 404

    try:
        os.remove(resolved_path)
    except Exception as e:
        return jsonify({"error": f"OS Remove Failed: {str(e)}"}), 500

    try:
        from insetu.cartographer import map_repositories
        map_repositories()
    except Exception as e:
        print(f"Warning: Cartographer failed during delete: {str(e)}")

    return jsonify({"status": "success"})
@app.route('/api/fs/save', methods=['POST'])
def api_fs_save():
    """Universal save-back endpoint. Integrates directly with workspace paths."""
    data = request.json
    if not data:
        return jsonify({"error": "Invalid or missing JSON payload"}), 400

    filepath, content = data.get("filepath", "").strip(), data.get("content", "")
    if not filepath: 
        return jsonify({"error": "Filepath is required"}), 400

    # Intercept SOTU saves to trigger automatic artifact rotation
    if "sotu/sotu_" in filepath.lower() and filepath.lower().endswith(".md"):
        import insetu.engine_gather as engine_gather
        engine_gather.rotate_sotus()
    if data.get("is_new_repo"):
        from insetu.utils_core import WORKSPACE_ROOT
        resolved_path = os.path.join(WORKSPACE_ROOT, filepath)
    else:
        resolved_path = resolve_workspace_path(filepath)

    archive_path = data.get("archive_path")
    original_response_path = data.get("original_response_path")
    if archive_path and original_response_path and "{date}" in original_response_path:
        resolved_archive = resolve_workspace_path(archive_path)
        os.makedirs(resolved_archive, exist_ok=True)

        # Extract prefix from response_path (e.g. "sotu/sotu_{date}.md" -> "sotu_")
        basename = os.path.basename(original_response_path)
        prefix = basename.split("{date}")[0]

        resolved_target_dir = os.path.dirname(resolved_path)
        if os.path.exists(resolved_target_dir):
            import shutil
            for f in os.listdir(resolved_target_dir):
                if f.startswith(prefix) and os.path.isfile(os.path.join(resolved_target_dir, f)):
                    shutil.move(os.path.join(resolved_target_dir, f), os.path.join(resolved_archive, f))

    is_new = not os.path.exists(resolved_path)

    # Defend against catastrophic JSONDecodeErrors crashing the daemon
    if filepath.lower().endswith('.json'):
        import json
        try:
            json.loads(content)
        except json.JSONDecodeError as e:
            return jsonify({"error": f"Invalid JSON syntax: {str(e)}"}), 400
    target_dir = os.path.dirname(resolved_path)

    if target_dir:
        try:
            os.makedirs(target_dir, exist_ok=True)
        except Exception as e:
            import traceback
            return jsonify({"error": f"Directory Creation Error: {str(e)}\n\n{traceback.format_exc()}"}), 500

    try:
        with open(resolved_path, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        return jsonify({"error": f"File System Error: {str(e)}"}), 500
    if data.get("is_new_repo") and data.get("repo_dir"):
        repo_dir = data.get("repo_dir")
        from insetu.utils_core import load_config, CONFIG_PATH
        import json
        cfg = load_config()
        targets = cfg.get("target_repos", [])
        if not any(r.get("repo_dir") == repo_dir for r in targets):
            ext_str = data.get("repo_exts", ".py,.json,.md,.sh,.txt,.html,.css,.js")
            exts = [e.strip() for e in ext_str.split(",") if e.strip()]

            targets.append({
                "repo_dir": repo_dir,
                "title": data.get("repo_title") or repo_dir.replace("-", " ").replace("_", " ").title(),
                "domain": data.get("repo_domain") or "Workspaces",
                "description": data.get("repo_desc") or f"Auto-initialized repository: {repo_dir}",
                "exts": exts,
                "apply_ignore": True
            })
            cfg["target_repos"] = targets
            import insetu.utils_core as utils_core
            utils_core.save_json_file(CONFIG_PATH, cfg)
    if is_new:
        try:
            from insetu.cartographer import map_repositories
            map_repositories()
        except Exception as e:
            print(f"Warning: Cartographer failed during save: {str(e)}")

    return jsonify({"status": "success", "message": f"Saved {filepath}", "is_new": is_new})
def get_repo_from_diff(diff_filename):
    from insetu.utils_core import load_config, get_sister_repos
    cfg = load_config()
    sister_repos = get_sister_repos()
    clean_name = diff_filename.replace("_tracker_diffs.txt", "").replace("_diffs.txt", "")
    from insetu.utils_core import get_safe_repo_id
    for c in cfg.get("target_repos", []):
        repo_id = get_safe_repo_id(c.get("repo_dir"))
        if repo_id in clean_name or clean_name in repo_id: return c["repo_dir"]
        if c.get("out_file") and clean_name in c["out_file"].replace("_context.txt", ""): return c["repo_dir"]

        # Search through sub_buckets for specific out_files like axoneme_os_kernel_context.txt
        for b in c.get("sub_buckets", []):
            if b.get("out_file") and clean_name in b["out_file"].replace("_context.txt", ""): return c["repo_dir"]
    fallback = clean_name.replace("_", "-")
    if fallback in sister_repos: return fallback

    # If all exact mapping fails, fallback to the first available repository
    return sister_repos[0] if sister_repos else "workspace"
@app.route('/api/git/sweep/status', methods=['GET'])
def api_git_sweep_status():
    from insetu.utils_core import load_config, WORKSPACE_ROOT
    import subprocess
    cfg = load_config()
    results = {}
    for c in cfg.get("target_repos", []):
        repo = c.get("repo_dir")
        repo_path = os.path.join(WORKSPACE_ROOT, repo)
        if c.get("physical_path"):
            repo_path = os.path.abspath(os.path.expanduser(c.get("physical_path")))
        if not os.path.exists(repo_path): continue
        try:
            # Use -uall to recursively list untracked files inside new directories
            res = subprocess.run(['git', 'status', '--porcelain', '-uall'], capture_output=True, text=True, cwd=repo_path)
            lines = res.stdout.splitlines()
            files = []
            for line in lines:
                if len(line) < 3: continue
                status = line[:2]
                filepath = line[3:]
                if '->' in filepath: filepath = filepath.split('->')[-1].strip()
                files.append({"path": filepath, "status": status.strip()})
            if files:
                results[repo] = files
        except Exception:
            pass
    return jsonify({"repos": results})

@app.route('/api/git/sweep/push', methods=['POST'])
def api_git_sweep_push():
    from insetu.utils_core import load_config, WORKSPACE_ROOT
    import subprocess
    data = request.json
    selections = data.get('selections', {})
    message = data.get('message', 'chore: workspace sweep')

    cfg = load_config()
    output_log = ""

    for repo, files in selections.items():
        if not files: continue

        repo_path = os.path.join(WORKSPACE_ROOT, repo)
        for c in cfg.get("target_repos", []):
            if c.get("repo_dir") == repo and c.get("physical_path"):
                repo_path = os.path.abspath(os.path.expanduser(c.get("physical_path")))
                break

        if not os.path.exists(repo_path): continue

        try:
            # Guarantee topology is perfectly mapped before staging
            from insetu.cartographer import map_repositories
            map_repositories()

            subprocess.run(['git', 'add'] + files, cwd=repo_path, check=True, capture_output=True)
            subprocess.run(['git', 'commit', '-m', message], cwd=repo_path, check=True, capture_output=True)
            subprocess.run(['git', 'push'], cwd=repo_path, check=True, capture_output=True, text=True)
            output_log += f"✅ {repo}: Pushed {len(files)} files.\n"
        except subprocess.CalledProcessError as e:
            err = e.stderr.decode('utf-8') if isinstance(e.stderr, bytes) else (e.stderr or str(e))
            return jsonify({"error": f"{repo} Error: {err}"}), 500

    return jsonify({"status": "success", "output": output_log})

@app.route('/api/git/changelogs', methods=['GET'])
def api_git_changelogs():
    diff_file = request.args.get('diff_file', '')
    repo = get_repo_from_diff(diff_file)
    tracker_dir = os.path.join(WORKSPACE_ROOT, repo, ".tracker", "closed")
    changelogs = []
    if os.path.exists(tracker_dir):
        parsed_logs = []
        for f in os.listdir(tracker_dir):
            if f.endswith('.md'):
                try:
                    with open(os.path.join(tracker_dir, f), 'r', encoding='utf-8', errors='ignore') as fh:
                        title, date_str = None, "0000"
                        for line in fh:
                            line = line.strip()
                            if line.startswith('title:'):
                                title = line.split('title:', 1)[1].strip().strip('\'"')
                            elif line.startswith('closed_at:'):
                                val = line.split('closed_at:', 1)[1].strip().strip('\'"')
                                if val.lower() != 'null':
                                    date_str = val
                            if title and date_str != "0000":
                                break # Found both, stop reading file
                        if title:
                            parsed_logs.append({"title": title, "date": date_str})
                except Exception: pass

        # Sort descending by the deterministic ISO timestamp
        parsed_logs.sort(key=lambda x: x["date"], reverse=True)
        for log in parsed_logs[:5]:
            changelogs.append({"title": log["title"]})
    return jsonify({"repo": repo, "changelogs": changelogs})
@app.route('/api/git/push', methods=['POST'])
def api_git_push():
    data = request.json
    repo = data.get('repo')
    message = data.get('message')
    diff_file = data.get('diff_file')
    if not repo or not message or not diff_file: return jsonify({"error": "Repo, message, and diff_file required"}), 400

    from insetu.utils_core import load_config
    cfg = load_config()
    repo_path = os.path.join(WORKSPACE_ROOT, repo)
    for c in cfg.get("target_repos", []):
        if c.get("repo_dir") == repo and c.get("physical_path"):
            repo_path = os.path.abspath(os.path.expanduser(c.get("physical_path")))
            break

    if not os.path.exists(repo_path): return jsonify({"error": "Repo not found"}), 404

    # Parse the specific files out of the diff payload
    import insetu.engine_gather as engine_gather
    diff_path = os.path.join(engine_gather.DIFFS_DIR, diff_file)
    files_to_stage = set()
    if os.path.exists(diff_path):
        with open(diff_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith(">>>NEW FILE :: /") or line.startswith(">>>DIFF :: /") or line.startswith(">>>DELETED FILE :: /"):
                    filepath = line.split(":: /")[1].split(" |")[0].strip()
                    files_to_stage.add(filepath)

    if not files_to_stage:
        return jsonify({"error": "No files found in diff payload to commit."}), 400

    import subprocess
    try:
        # Guarantee topology is perfectly mapped before staging
        from insetu.cartographer import map_repositories
        map_repositories()

        # Auto-include the updated Code Index and Tracker states so metadata stays synced
        if os.path.exists(os.path.join(repo_path, "CODE_INDEX.md")): files_to_stage.add("CODE_INDEX.md")
        if os.path.exists(os.path.join(repo_path, "docs", "CODE_INDEX.md")): files_to_stage.add("docs/CODE_INDEX.md")
        if os.path.exists(os.path.join(repo_path, ".tracker")): files_to_stage.add(".tracker/")
        # Surgically add only the parsed files + metadata
        subprocess.run(['git', 'add'] + list(files_to_stage), cwd=repo_path, check=True, capture_output=True)
        # Gracefully handle empty commits
        committed = False
        status_res = subprocess.run(['git', 'status', '--porcelain'], cwd=repo_path, capture_output=True, text=True)
        if status_res.stdout.strip():
            subprocess.run(['git', 'commit', '-m', message], cwd=repo_path, check=True, capture_output=True)
            committed = True

        push_res = subprocess.run(['git', 'push'], cwd=repo_path, check=True, capture_output=True, text=True)


        output = push_res.stdout
        if push_res.stderr:
            output += "\n" + push_res.stderr

        return jsonify({"status": "success", "output": output.strip()})
    except subprocess.CalledProcessError as e:
        err_out = e.stderr or e.stdout
        if isinstance(err_out, bytes):
            err_out = err_out.decode('utf-8', errors='replace')
        if not err_out:

            err_out = str(e)

        if 'committed' in locals() and committed and hasattr(e, 'cmd') and 'push' in e.cmd:
            return jsonify({
                "status": "partial", 
                "error": err_out, 
                "message": "Local commit succeeded, but pushing to the remote repository failed. The daemon likely lacks Git credentials."
            }), 200

        return jsonify({"error": err_out}), 500

@app.route('/api/diffs/generate', methods=['POST'])
def api_generate_diffs():
    try:
        files = engine_gather.generate_diff_context()
        return jsonify({"status": "success", "files": files})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
@app.route('/api/tracker/new', methods=['POST'])
def api_tracker_new():
    data = request.json
    try:
        new_path = engine_tracker.create_ticket(
            repo=data['repo'], 
            ticket_type=data['type'], 
            status=data['status'], 
            title=data['title'], 
            description=data['description'],
            tags=data.get('tags', ''),
            sub_bucket=data.get('sub_bucket', 'None')
        )
        # Remap topologies so the UI instantly knows about the new file
        from insetu.cartographer import map_repositories
        map_repositories()
        return jsonify({"status": "success", "filepath": new_path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route('/api/tracker/files', methods=['GET'])
def api_tracker_files():
    files = []
    try:
        for repo in get_sister_repos():
            base = os.path.join(WORKSPACE_ROOT, repo, ".tracker")
            if os.path.exists(base):
                for root, _, filenames in os.walk(base):
                    for f in filenames:
                        if f.endswith('.md'):
                            abs_path = os.path.join(root, f)
                            rel_path = os.path.relpath(abs_path, WORKSPACE_ROOT).replace('\\', '/')
                            files.append(rel_path)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify({"files": files})

@app.route('/api/tracker/transition', methods=['POST'])
def api_tracker_transition():
    data = request.json
    try:
        new_path = engine_tracker.transition_ticket(
            repo=data['repo'], 
            current_rel_path=data['filepath'], 
            new_status=data['new_status'],
            new_type=data.get('new_type')
        )
        return jsonify({"status": "success", "new_filepath": new_path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route('/api/manifest', methods=['GET'])
def api_manifest():
    manifest_path = os.path.join(engine_gather.CONTEXTS_DIR, "manifest.json")
    headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r', encoding='utf-8') as f: 
            return f.read(), 200, headers
    return jsonify({}), 200, headers
@app.route('/download/<path:filename>')
def download_file(filename):
    # Strip the arbitrary prefix to prevent double-nesting (e.g. prompts/prompts/file.md)
    safe_basename = os.path.basename(filename)
    search_paths = [os.path.join(d, safe_basename) for d in [engine_gather.CONTEXTS_DIR, engine_gather.PROMPTS_DIR, engine_gather.DIFFS_DIR, engine_gather.GATHER_DIR]]
    file_path = next((p for p in search_paths if os.path.exists(p)), None)
    if not file_path: return jsonify({"error": "File not found"}), 404
    base, ext = os.path.splitext(filename)
    dl_name = f"{base}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}{ext}"
    return send_file(file_path, as_attachment=True, download_name=dl_name, mimetype='application/octet-stream')

@app.route('/api/bridge/sync', methods=['POST'])
def bridge_sync():
    data = request.json
    out = io.StringIO()
    sister_repos = get_sister_repos()
    
    with redirect_stdout(out):
        try:
            raw_text, active_files, dry_run = data.get("text", ""), data.get("active_files", []), data.get("dry_run", False)
            pinned_repos_raw = data.get("pinned_repos", ["ALL"])
            allowed_repos = sister_repos if "ALL" in pinned_repos_raw else [r for r in sister_repos if r in pinned_repos_raw]
            
            parsed_structure = parse_blocks(raw_text)
            pid = f"{random.getrandbits(16):04x}".upper()
            print(f"\n=== SYNC TRANSACTION PULSE [{datetime.datetime.now().strftime('%H:%M:%S')}] ID: {pid} ===")
            for target_file, blocks in parsed_structure.items():
                if target_file not in active_files or not blocks: continue

                # Execution Lock Containment Check
                norm_target = target_file.replace('\\', '/')
                explicit_repo = norm_target.split('/')[0] if '/' in norm_target else None
                if explicit_repo in sister_repos and explicit_repo not in allowed_repos:
                    print(f"  [!] TRANSACTION ABORTED: Target repository '{explicit_repo}' is not pinned. Skipping {target_file}.")
                    print("." * 30)
                    continue
                resolved_path = resolve_workspace_path(target_file)
                is_genesis = all(not b["search"].strip() for b in blocks)
                if is_genesis and explicit_repo not in sister_repos:
                                if len(allowed_repos) == 1:
                                                target_file = f"{allowed_repos[0]}/{norm_target}"
                                                norm_target = target_file.replace('\\', '/')
                                                explicit_repo = allowed_repos[0]
                                                resolved_path = resolve_workspace_path(target_file)
                                                print(f"  [⚡] Auto-Resolved: Genesis patch missing repo anchor. Defaulting to '{explicit_repo}'.")
                                else:
                                                bad_anchor = explicit_repo or target_file
                                                print(f"  [!] TRANSACTION ERROR: Genesis patch missing valid repository anchor.")
                                                print(f"  [!] TRANSACTION ABORTED: '{bad_anchor}' is not a recognized repository. Please prepend the repository name (e.g., repo-name/path/to/file).")
                                                print("." * 30)
                                                continue

# Smart Resolution Engine
                if not is_genesis:
                    from insetu.utils_core import CONFIG_PATH
                    basename = os.path.basename(target_file)
                    # Anchor to the absolute instance directory, bypassing volatile OS working directories
                    search_roots = [os.path.dirname(CONFIG_PATH)]
                    for repo in allowed_repos:
                        repo_path = os.path.join(WORKSPACE_ROOT, repo)
                        if os.path.exists(repo_path):
                            search_roots.append(repo_path)

                    search_roots = list(set(os.path.abspath(r) for r in search_roots))

                    candidates = []
                    for s_root in search_roots:
                        for root, dirs, files in os.walk(s_root):
                            # Explicitly allow .tracker while blocking other hidden/system folders
                            dirs[:] = [d for d in dirs if (not d.startswith('.') or d == '.tracker') and d not in ('node_modules', '__pycache__', 'venv', '.venv', '.insetu', '.git')]
                            if basename in files:
                                cand_abs = os.path.abspath(os.path.join(root, basename)).replace('\\', '/')
                                cand_rel = os.path.relpath(cand_abs, WORKSPACE_ROOT).replace('\\', '/')
                                if cand_rel not in candidates:
                                    candidates.append(cand_rel)

                    target_norm = target_file.replace('\\', '/')
                    def grade_candidate(c):
                        if c == target_norm or c.endswith("/" + target_norm):
                            return (0, len(c))
                        return (1, len(c))

                    candidates.sort(key=grade_candidate)
                    exact_match_passed = False
                    verified_alts = []
                    failed_diff_cands = []

                    for cand in candidates:
                        cand_abs = os.path.join(WORKSPACE_ROOT, cand)
                        try:
                            with open(cand_abs, 'r', encoding='utf-8') as cf:
                                temp_content = cf.read()
                            cand_success = True
                            for b in blocks:
                                success, _ = apply_block_in_memory(temp_content, b, silent=True)
                                if not success:
                                    cand_success = False
                                    break

                            if cand_success:
                                verified_alts.append(cand)
                                if os.path.abspath(resolved_path) == os.path.abspath(cand_abs):
                                    exact_match_passed = True
                                    break
                            else:
                                failed_diff_cands.append(cand)
                        except Exception:
                            pass

                    if not exact_match_passed:
                        if verified_alts:
                            best_alt = verified_alts[0]
                            if len(allowed_repos) == 1:
                                print(f"  [⚡] Auto-Resolved: Only 1 repo pinned. Seamlessly routing '{target_file}' to '{best_alt}'.")
                                target_file = best_alt
                                resolved_path = resolve_workspace_path(target_file)
                            else:
                                print(f"  [?] Smart Resolution: Anchors failed or file missing for '{target_file}'.")
                                print(f"  [✓] Confirmed Match: Found '{best_alt}' which perfectly matches your SEARCH anchors.")
                                if len(verified_alts) > 1:
                                    print(f"  [i] (Note: Also verified {len(verified_alts)-1} other valid matches).")
                                print(f"  [ACTION_REQUIRED: UPDATE_PATH | {target_file} | {best_alt} ]")
                                print("  [!] Halting execution for this file.")
                                print("." * 30)
                                continue
                        else:
                            if not os.path.exists(resolved_path):
                                if failed_diff_cands:
                                    print(f"  [!] TRANSACTION ERROR: Found {len(failed_diff_cands)} matching path candidate(s), but your SEARCH block failed the diff test.")
                                    for fc in failed_diff_cands:
                                        print(f"      - {fc}")
                                    print("  [!] TRANSACTION ABORTED: Check your SEARCH block for hallucinated padding or mismatched context.")
                                else:
                                    print(f"  [!] TRANSACTION ERROR: Target file not found at path: {resolved_path}")
                                    print(f"  [!] TRANSACTION ABORTED: Check your directory context or cross-repo prefix.")
                                print("." * 30)
                                continue

                abs_target = os.path.abspath(resolved_path)
                display_path = os.path.relpath(abs_target, WORKSPACE_ROOT).replace('\\', '/')

                print(f"Targeting: {display_path} ({len(blocks)} chunks mapped)")

                if os.path.exists(resolved_path):
                    with open(resolved_path, 'r', encoding='utf-8') as f: working_content = f.read()
                else:
                    if blocks and blocks[0]["search"].strip():
                        print(f"  [!] TRANSACTION ERROR: Target file not found at path: {resolved_path}")
                        print(f"  [!] TRANSACTION ABORTED: Check your directory context or cross-repo prefix.")
                        print("." * 30)
                        continue
                    working_content = ""
                
                original_content = working_content
                file_success = True
                for idx, b in enumerate(blocks):
                    success, updated_content = apply_block_in_memory(working_content, b)
                    if success: working_content = updated_content
                    else:
                        if not dry_run:
                            print(f"  [!] TRANSACTION ERROR: Chunk {idx + 1} failed.")
                            print(f"  [ACTION_REQUIRED: COPY_STATE | {target_file} ]")
                        file_success = False
                        break
                # --- PRE-FLIGHT SYNTAX VALIDATION ---
                if file_success:
                    ext = os.path.splitext(target_file)[1].lower()
                    try:
                        if ext == '.py':
                            import ast
                            ast.parse(working_content)
                        elif ext == '.json':
                            import json
                            json.loads(working_content)
                        elif ext == '.js':
                            # Leverage local V8 engine for native JS parsing (bypassing execution)
                            import subprocess
                            import base64
                            try:
                                # Use --input-type=module to correctly parse ES6 imports
                                res = subprocess.run(
                                    ['node', '--input-type=module', '-c'], 
                                    input=working_content, 
                                    capture_output=True, 
                                    text=True
                                )
                                if res.returncode != 0:
                                    err_str = res.stderr.strip()
                                    err_b64 = base64.b64encode(err_str.encode('utf-8')).decode('utf-8')
                                    print(f"  [!] SYNTAX ERROR: Patch introduces invalid JavaScript in {target_file}.")
                                    print(f"      {err_str}")
                                    print(f"  [ACTION_REQUIRED: COPY_ERROR | {err_b64} ]")
                                    print(f"  [ACTION_REQUIRED: COPY_STATE | {target_file} ]")
                                    file_success = False
                            except FileNotFoundError:
                                print(f"  [~] Warning: Node.js not found in PATH. Skipping JS syntax validation for {target_file}.")
                    except SyntaxError as e:
                        import base64
                        err_str = f"Line {e.lineno}: {e.msg}"
                        err_b64 = base64.b64encode(err_str.encode('utf-8')).decode('utf-8')
                        print(f"  [!] SYNTAX ERROR: Patch introduces invalid Python syntax in {target_file}.")
                        print(f"      {err_str}")
                        print(f"  [ACTION_REQUIRED: COPY_ERROR | {err_b64} ]")
                        print(f"  [ACTION_REQUIRED: COPY_STATE | {target_file} ]")
                        file_success = False
                    except ValueError as e:
                        import base64
                        err_str = str(e)
                        err_b64 = base64.b64encode(err_str.encode('utf-8')).decode('utf-8')
                        print(f"  [!] SYNTAX ERROR: Patch introduces invalid JSON syntax in {target_file}.")
                        print(f"      Details: {err_str}")
                        print(f"  [ACTION_REQUIRED: COPY_ERROR | {err_b64} ]")
                        print(f"  [ACTION_REQUIRED: COPY_STATE | {target_file} ]")
                        file_success = False
                    except Exception as e:
                        print(f"  [!] SYNTAX ERROR: Validation failed for {target_file}. Details: {str(e)}")
                        file_success = False

                if file_success and working_content != original_content and not dry_run:
                    if os.path.dirname(resolved_path):
                        os.makedirs(os.path.dirname(resolved_path), exist_ok=True)
                    with open(resolved_path, 'w', encoding='utf-8') as f: f.write(working_content)
                    print(f"  [✓] Transaction complete: In-memory composition committed cleanly for {target_file}.")
                elif file_success and dry_run:
                    print(f"  [✓] [DRY RUN] Verified perfectly for {target_file}.")
                print("." * 30)
            print(f"=== PULSE {pid} COMPLETE ===\n")
        except Exception as e: print(f"  [!] System processing fault: {str(e)}")
        
    return out.getvalue(), 200, {'Content-Type': 'text/plain; charset=utf-8'}

@app.route('/api/bridge/fetch', methods=['GET'])
def bridge_fetch():
    resolved_path = resolve_workspace_path(request.args.get('file', ''))
    if resolved_path and os.path.exists(resolved_path):
        with open(resolved_path, 'r', encoding='utf-8') as f: return f.read(), 200, {'Content-Type': 'text/plain; charset=utf-8'}
    return "File not found.", 404
def run_app():
    from insetu.utils_core import load_config
    import os
    cfg = load_config()
    # Lock the port on initial boot so it survives os.execv workspace swaps
    if "INSETU_PORT" not in os.environ:
        os.environ["INSETU_PORT"] = str(cfg.get("port", 5005))

    port = int(os.environ["INSETU_PORT"])

    print(f"🚀 Starting inSetu Developer OS (Port {port})...")
    print(f"👉 Open http://127.0.0.1:{port} in your browser")
    app.run(debug=True, port=port)

if __name__ == "__main__":
    run_app()