import os
import subprocess
from flask import Blueprint, request, jsonify
from insetu.utils_core import load_config, get_workspace_physics

git_bp = Blueprint('git', __name__)

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
    workspace_id = request.headers.get('X-Workspace-ID')
    _, ws_root, _ = get_workspace_physics(workspace_id)
    repo = request.args.get('repo', '')
    tracker_dir = os.path.join(ws_root, repo, ".tracker", "closed")
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
@git_bp.route('/api/git/push', methods=['POST'])
def api_git_push():
    workspace_id = request.headers.get('X-Workspace-ID')
    data = request.json
    repo = data.get('repo')
    message = data.get('message')
    if not repo or not message: return jsonify({"error": "Repo and message required"}), 400

    cfg = load_config(workspace_id)
    _, ws_root, _ = get_workspace_physics(workspace_id)
    repo_path = os.path.join(ws_root, repo)
    for c in cfg.get("target_repos", []):
        if c.get("repo_dir") == repo and c.get("physical_path"):
            repo_path = os.path.abspath(os.path.expanduser(c.get("physical_path")))
            break

    if not os.path.exists(repo_path): return jsonify({"error": "Repo not found"}), 404

    # Git is the SSOT for repository state. Query it directly instead of parsing artifact files.
    status_res = subprocess.run(['git', 'status', '--porcelain', '-uall'], cwd=repo_path, capture_output=True, text=True)
    
    files_to_stage = set()
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