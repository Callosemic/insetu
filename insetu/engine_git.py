import os
import subprocess
from flask import Blueprint, request, jsonify
from insetu.utils_core import load_config, get_workspace_physics
from insetu.hooks import hooks
git_bp = Blueprint('git', __name__)

@hooks.on('pre_compile')
def on_pre_compile_generate_diffs(workspace_id=None):
    try:
        generate_diff_context(workspace_id)
    except Exception as e:
        print(f"Warning: Background Git auto-diff generation failed: {e}")

def generate_diff_context(workspace_id=None):
    from insetu.utils_core import load_config, get_gather_paths, get_workspace_physics, get_safe_repo_id
    from insetu.engine_gather import resolve_file_bucket
    paths = get_gather_paths(workspace_id)
    _, ws_root, _ = get_workspace_physics(workspace_id)
    for f in os.listdir(paths["diffs_dir"]):
        f_path = os.path.join(paths["diffs_dir"], f)
        if os.path.isfile(f_path):
            try:
                os.remove(f_path)
            except Exception as e:
                print(f"Warning: Failed to clear old diff file {f_path}: {e}")

    live_cfg = load_config(workspace_id)
    diff_manifest = []
    for config in live_cfg.get("target_repos", []):
        if config.get("exclude_from_diffs"): continue
        if config.get("archive_type", "repo") == "media-vault": continue
        safe_r_dir = get_safe_repo_id(config.get("repo_dir"))
        physical_path = config.get("physical_path")
        repo_path = os.path.abspath(os.path.expanduser(physical_path)) if physical_path else os.path.abspath(os.path.join(ws_root, config["repo_dir"]))

        if not os.path.exists(repo_path): continue
        try:
            result = subprocess.run(['git', 'status', '--porcelain', '-uall'], capture_output=True, text=True, cwd=repo_path)
            lines = result.stdout.splitlines()
            if not lines: continue
            changed_files = []
            for line in lines:
                if len(line) < 3: continue
                status = line[:2]
                filepath = line[3:]
                if '->' in filepath: filepath = filepath.split('->')[-1].strip()
                if filepath.startswith('diffs/') or filepath.endswith('_diffs.txt'): continue

                if os.path.isfile(os.path.join(repo_path, filepath)) or 'D' in status:
                    changed_files.append((filepath, status))
            if not changed_files: continue
            sub_buckets = config.get("sub_buckets", [])
            bucketed_files = {}

            if sub_buckets:
                for filepath, status in changed_files:
                    b, module = resolve_file_bucket(filepath, sub_buckets)
                    if b and module:
                        b_id = f"{module}_diffs.txt"
                    elif b:
                        b_id = b.get("out_file", f"{safe_r_dir}_{b.get('id', 'bucket')}_context.txt").replace("_context.txt", "_diffs.txt")
                    else:
                        b_id = config.get("out_file", f"{safe_r_dir}_context.txt").replace("_context.txt", "_diffs.txt")
                    if b_id not in bucketed_files: bucketed_files[b_id] = []
                    bucketed_files[b_id].append((filepath, status))
            else:
                out_filename = config.get("out_file", f"{safe_r_dir}_context.txt").replace("_context.txt", "_diffs.txt")
                bucketed_files[out_filename] = changed_files

            for out_filename, files_in_bucket in bucketed_files.items():
                out_lines = []
                out_lines.append(f"============================================================")
                out_lines.append(f">>> DIFF SUMMARY :: {len(files_in_bucket)} FILE(S) CHANGED")
                out_lines.append(f"============================================================")
                for f_path, f_status in files_in_bucket:
                    out_lines.append(f"[{f_status.ljust(2)}] {f_path}")
                out_lines.append("\n\n")

                # OPTIMIZATION: Bulk fetch diffs to eliminate N+1 subprocess bottleneck
                files_to_diff = [f for f, s in files_in_bucket if s != "??"]
                bulk_diffs = {}
                if files_to_diff:
                    try:
                        diff_res = subprocess.run(['git', 'diff', 'HEAD', '--'] + files_to_diff, capture_output=True, text=True, cwd=repo_path)
                        for chunk in diff_res.stdout.split('diff --git '):
                            if not chunk.strip(): continue
                            first_line = chunk.split('\n')[0]
                            parts = first_line.split(' b/')
                            if len(parts) == 2:
                                fname = parts[1].strip()
                                fname = fname.strip('"') 
                                bulk_diffs[fname] = 'diff --git ' + chunk
                    except Exception as e:
                        print(f"Bulk diff error: {e}")

                for filepath, status in files_in_bucket:
                    abs_filepath = os.path.join(repo_path, filepath)
                    if 'D' in status:
                        out_lines.append(f"============================================================")
                        out_lines.append(f">>>DELETED FILE :: {config['repo_dir']}/{filepath} | PREVIOUSLY TRACKED")
                        out_lines.append(f"============================================================")
                        out_lines.append(bulk_diffs.get(filepath, "[No diff available or file is binary]"))
                        out_lines.append("\n\n")
                        continue
                    else:
                        out_lines.append(f"============================================================")
                        out_lines.append(f">>>NEW FILE :: {config['repo_dir']}/{filepath} | CURRENT CONTENTS")
                        out_lines.append(f"============================================================")
                        try:
                            with open(abs_filepath, 'r', encoding='utf-8') as cf: out_lines.append(cf.read())
                        except Exception:
                            out_lines.append("[Binary or unreadable file]")

                    out_lines.append(f"\n============================================================")
                    out_lines.append(f">>>DIFF :: {config['repo_dir']}/{filepath} | CHANGES SINCE LAST COMMIT")
                    out_lines.append(f"============================================================")

                    if status == "??":
                        out_lines.append("[Untracked file - full content above]")
                    else:
                        out_lines.append(bulk_diffs.get(filepath, "[No diff available or file is binary]"))
                    out_lines.append("\n\n")
                if out_lines:
                    out_path = os.path.join(paths["diffs_dir"], out_filename)
                    with open(out_path, 'w', encoding='utf-8') as out_f:
                        out_f.write("\n".join(out_lines))
                    diff_manifest.append({"filename": out_filename, "repo": config['repo_dir']})
        except Exception as e:
            print(f"Skipping diff generation for {config['repo_dir']}: {e}")
    return diff_manifest

@git_bp.route('/api/<workspace_id>/diffs/generate', methods=['POST'])
def api_generate_diffs(workspace_id):
    try:
        files = generate_diff_context(workspace_id)
        return jsonify({"status": "success", "files": files})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@git_bp.route('/api/git/sweep/status', methods=['GET'])
def api_git_sweep_status():
    workspace_id = request.headers.get('X-Workspace-ID')
    cfg = load_config(workspace_id)
    _, ws_root, _ = get_workspace_physics(workspace_id)
    results = {}
    for c in cfg.get("target_repos", []):
        repo = c.get("repo_dir")
        repo_path = os.path.join(ws_root, repo)
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
@git_bp.route('/api/git/sweep/push', methods=['POST'])
def api_git_sweep_push():
    workspace_id = request.headers.get('X-Workspace-ID')
    data = request.json
    selections = data.get('selections', {})
    message = data.get('message', 'chore: workspace sweep')

    cfg = load_config(workspace_id)
    _, ws_root, _ = get_workspace_physics(workspace_id)
    output_log = ""

    for repo, files in selections.items():
        if not files: continue

        repo_path = os.path.join(ws_root, repo)
        for c in cfg.get("target_repos", []):
            if c.get("repo_dir") == repo and c.get("physical_path"):
                repo_path = os.path.abspath(os.path.expanduser(c.get("physical_path")))
                break

        if not os.path.exists(repo_path): continue
        try:
            # Guarantee topology is perfectly mapped before staging
            from insetu.cartographer import map_repositories
            map_repositories(workspace_id)

            subprocess.run(['git', 'add'] + files, cwd=repo_path, check=True, capture_output=True)
            subprocess.run(['git', 'commit', '-m', message], cwd=repo_path, check=True, capture_output=True)
            subprocess.run(['git', 'push'], cwd=repo_path, check=True, capture_output=True, text=True)
            output_log += f"✅ {repo}: Pushed {len(files)} files.\n"
        except subprocess.CalledProcessError as e:
            err = e.stderr.decode('utf-8') if isinstance(e.stderr, bytes) else (e.stderr or str(e))
            return jsonify({"error": f"{repo} Error: {err}"}), 500

    return jsonify({"status": "success", "output": output_log})
@git_bp.route('/api/git/changelogs', methods=['GET'])
def api_git_changelogs():
    """Queries the rapid SQLite tracking index to populate recent commit suggestions."""
    workspace_id = request.headers.get('X-Workspace-ID')
    repo = request.args.get('repo', '')
    changelogs = []
    # Abstracted horizontal cross-talk using the Event Bus
    from insetu.hooks import hooks
    try:
        results = hooks.emit('request_changelog_suggestions', repo=repo, workspace_id=workspace_id)
        for res in results:
            if res:
                changelogs.extend(res)
    except Exception as e:
        print(f"Warning: Failed to fetch release log suggestions via Event Bus: {e}")

    return jsonify({"repo": repo, "changelogs": changelogs})
@git_bp.route('/api/git/push', methods=['POST'])
def api_git_push():
    workspace_id = request.headers.get('X-Workspace-ID')
    data = request.json
    repo = data.get('repo')
    message = data.get('message')
    diff_file = data.get('diff_file')
    if not repo or not message: return jsonify({"error": "Repo and message required"}), 400

    cfg = load_config(workspace_id)
    _, ws_root, _ = get_workspace_physics(workspace_id)
    repo_path = os.path.join(ws_root, repo)
    for c in cfg.get("target_repos", []):
        if c.get("repo_dir") == repo and c.get("physical_path"):
            repo_path = os.path.abspath(os.path.expanduser(c.get("physical_path")))
            break

    if not os.path.exists(repo_path): return jsonify({"error": "Repo not found"}), 404

    files_to_stage = set()
    if diff_file:
        from insetu.utils_core import get_gather_paths
        paths = get_gather_paths(workspace_id)
        diff_path = os.path.join(paths["diffs_dir"], diff_file)
        if os.path.exists(diff_path):
            with open(diff_path, 'r', encoding='utf-8') as f:
                content = f.read()
            summary_section = content.split('\n\n')[0]
            for line in summary_section.splitlines():
                if line.startswith('[') and '] ' in line:
                    filepath = line.split('] ', 1)[1].strip()
                    files_to_stage.add(filepath)

    if not files_to_stage:
        # Fallback if diff_file wasn't specified or couldn't be parsed
        status_res = subprocess.run(['git', 'status', '--porcelain', '-uall'], cwd=repo_path, capture_output=True, text=True)
        for line in status_res.stdout.splitlines():
            if len(line) >= 3:
                filepath = line[3:]
                # Safely handle git renames (e.g., R  old -> new)
                if '->' in filepath: 
                    filepath = filepath.split('->')[-1]
                files_to_stage.add(filepath.strip())

    if not files_to_stage:
        return jsonify({"error": "No files found to commit. Working tree is clean."}), 400
    try:
        # Guarantee topology is perfectly mapped before staging
        from insetu.cartographer import map_repositories
        map_repositories(workspace_id)
        # Auto-include the updated Code Index and managed extension states so metadata stays synced
        if os.path.exists(os.path.join(repo_path, "CODE_INDEX.md")): files_to_stage.add("CODE_INDEX.md")
        if os.path.exists(os.path.join(repo_path, "docs", "CODE_INDEX.md")): files_to_stage.add("docs/CODE_INDEX.md")
        for m_dir in cfg.get("managed_dirs", []):
            if os.path.exists(os.path.join(repo_path, m_dir)): files_to_stage.add(f"{m_dir}/")

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