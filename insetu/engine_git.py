import os
import subprocess
import uuid
import json
from flask import Blueprint, request, jsonify
from insetu.utils_core import load_config, get_workspace_physics
from insetu.hooks import hooks
from insetu.workers import submit_immediate_job, update_immediate_job_status, register_callback

git_bp = Blueprint('git', __name__)
__depends__ = []

@hooks.on('pre_compile')
def on_pre_compile_generate_diffs(workspace_id=None):
    try:
        generate_diff_context(workspace_id)
    except Exception as e:
        print(f"Warning: Background Git auto-diff generation failed: {e}")
def generate_diff_context(workspace_id=None, target_repos=None):
    from insetu.utils_core import load_config, get_gather_paths, get_workspace_physics, get_safe_repo_id
    from insetu.engine_gather import resolve_file_bucket
    paths = get_gather_paths(workspace_id)
    _, ws_root, _ = get_workspace_physics(workspace_id)

    live_cfg = load_config(workspace_id)

    safe_targets = [get_safe_repo_id(r) for r in target_repos] if target_repos else []

    if os.path.exists(paths["diffs_dir"]):
        for f in os.listdir(paths["diffs_dir"]):
            f_path = os.path.join(paths["diffs_dir"], f)
            if os.path.isfile(f_path):
                # If target_repos is provided, only clear diff files belonging to those repos
                if not target_repos or any(f.startswith(st) for st in safe_targets):
                    try:
                        os.remove(f_path)
                    except Exception as e:
                        print(f"Warning: Failed to clear old diff file {f_path}: {e}")

    diff_manifest = []
    for config in live_cfg.get("target_repos", []):
        if target_repos and config.get("repo_dir") not in target_repos: continue
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
                    from insetu.routes_fs import execute_vfs_save
                    execute_vfs_save(workspace_id, out_path, "\n".join(out_lines), data={"is_absolute_artifact": True})
                    diff_manifest.append({"filename": out_filename, "repo": config['repo_dir']})
        except Exception as e:
            print(f"Skipping diff generation for {config['repo_dir']}: {e}")
    return diff_manifest
def _background_generate_diffs(job_id, workspace_id, target_repos=None):
    try:
        msg = f"Analyzing Git trees for {', '.join(target_repos)}..." if target_repos else "Analyzing Git trees across sister repositories..."
        update_immediate_job_status(job_id, 'processing', msg, workspace_id=workspace_id)
        files = generate_diff_context(workspace_id, target_repos)
        update_immediate_job_status(job_id, 'completed', "Diff generation complete.", artifact={"files": files, "target_repos": target_repos}, workspace_id=workspace_id)
    except Exception as e:
        update_immediate_job_status(job_id, 'failed', f"Diff generation failed: {str(e)}", workspace_id=workspace_id)

register_callback("git", "diffs_task", _background_generate_diffs)

@git_bp.route('/api/<workspace_id>/diffs/generate', methods=['POST'])
def api_generate_diffs(workspace_id):
    data = request.json or {}
    target_repos = data.get("target_repos", None)

    job_id = f"dif_{uuid.uuid4().hex[:8]}"
    args_json = json.dumps({"target_repos": target_repos})
    submit_immediate_job(job_id, "git", "diffs_task", args_json, workspace_id)
    return jsonify({"status": "accepted", "job_id": job_id}), 202

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
def _background_sweep_push(job_id, workspace_id, selections, message):
    import os
    import subprocess
    from insetu.utils_core import load_config, get_workspace_physics
    cfg = load_config(workspace_id)
    _, ws_root, _ = get_workspace_physics(workspace_id)
    output_log = ""

    try:
        for repo, files in selections.items():
            if not files: continue
            update_immediate_job_status(job_id, 'processing', f"Pushing {repo}...", workspace_id=workspace_id)

            repo_path = os.path.join(ws_root, repo)
            for c in cfg.get("target_repos", []):
                if c.get("repo_dir") == repo and c.get("physical_path"):
                    repo_path = os.path.abspath(os.path.expanduser(c.get("physical_path")))
                    break

            if not os.path.exists(repo_path): continue

            # Guarantee topology is perfectly mapped before staging
            from insetu.cartographer import map_repositories
            map_repositories(workspace_id)

            subprocess.run(['git', 'add'] + files, cwd=repo_path, check=True, capture_output=True)
            subprocess.run(['git', 'commit', '-m', message], cwd=repo_path, check=True, capture_output=True)
            subprocess.run(['git', 'push'], cwd=repo_path, check=True, capture_output=True, text=True)
            output_log += f"✅ {repo}: Pushed {len(files)} files.\n"

        update_immediate_job_status(job_id, 'completed', output_log, workspace_id=workspace_id)
    except subprocess.CalledProcessError as e:
        err = e.stderr.decode('utf-8') if isinstance(e.stderr, bytes) else (e.stderr or str(e))
        update_immediate_job_status(job_id, 'failed', f"{repo} Error: {err}", workspace_id=workspace_id)
    except Exception as e:
        update_immediate_job_status(job_id, 'failed', str(e), workspace_id=workspace_id)

register_callback("git", "sweep_push_task", _background_sweep_push)

@git_bp.route('/api/git/sweep/push', methods=['POST'])
def api_git_sweep_push():
    workspace_id = request.headers.get('X-Workspace-ID')
    data = request.json
    selections = data.get('selections', {})
    message = data.get('message', 'chore: workspace sweep')

    job_id = f"swp_{uuid.uuid4().hex[:8]}"
    args_json = json.dumps({"selections": selections, "message": message})
    submit_immediate_job(job_id, "git", "sweep_push_task", args_json, workspace_id)

    return jsonify({"status": "accepted", "job_id": job_id}), 202
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
def _background_git_push(job_id, workspace_id, repo, message, diff_file):
    import os
    import subprocess
    from insetu.utils_core import load_config, get_workspace_physics

    update_immediate_job_status(job_id, 'processing', f"Preparing to push {repo}...", workspace_id=workspace_id)

    cfg = load_config(workspace_id)
    _, ws_root, _ = get_workspace_physics(workspace_id)
    repo_path = os.path.join(ws_root, repo)
    for c in cfg.get("target_repos", []):
        if c.get("repo_dir") == repo and c.get("physical_path"):
            repo_path = os.path.abspath(os.path.expanduser(c.get("physical_path")))
            break

    if not os.path.exists(repo_path): 
        update_immediate_job_status(job_id, 'failed', "Repo not found", workspace_id=workspace_id)
        return

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
        status_res = subprocess.run(['git', 'status', '--porcelain', '-uall'], cwd=repo_path, capture_output=True, text=True)
        for line in status_res.stdout.splitlines():
            if len(line) >= 3:
                filepath = line[3:]
                if '->' in filepath: 
                    filepath = filepath.split('->')[-1]
                files_to_stage.add(filepath.strip())

    if not files_to_stage:
        update_immediate_job_status(job_id, 'failed', "No files found to commit. Working tree is clean.", workspace_id=workspace_id)
        return

    try:
        from insetu.cartographer import map_repositories
        map_repositories(workspace_id)

        if os.path.exists(os.path.join(repo_path, "CODE_INDEX.md")): files_to_stage.add("CODE_INDEX.md")
        if os.path.exists(os.path.join(repo_path, "docs", "CODE_INDEX.md")): files_to_stage.add("docs/CODE_INDEX.md")
        for m_dir in cfg.get("managed_dirs", []):
            if os.path.exists(os.path.join(repo_path, m_dir)): files_to_stage.add(f"{m_dir}/")

        update_immediate_job_status(job_id, 'processing', f"Committing and pushing {repo}...", workspace_id=workspace_id)
        subprocess.run(['git', 'add'] + list(files_to_stage), cwd=repo_path, check=True, capture_output=True)

        committed = False
        status_res = subprocess.run(['git', 'status', '--porcelain'], cwd=repo_path, capture_output=True, text=True)
        if status_res.stdout.strip():
            subprocess.run(['git', 'commit', '-m', message], cwd=repo_path, check=True, capture_output=True)
            committed = True

        push_res = subprocess.run(['git', 'push'], cwd=repo_path, check=True, capture_output=True, text=True)
        output = push_res.stdout + ("\n" + push_res.stderr if push_res.stderr else "")

        update_immediate_job_status(job_id, 'completed', output.strip(), workspace_id=workspace_id)
    except subprocess.CalledProcessError as e:
        err_out = e.stderr or e.stdout
        err_out = err_out.decode('utf-8', errors='replace') if isinstance(err_out, bytes) else (err_out or str(e))

        if 'committed' in locals() and committed and hasattr(e, 'cmd') and 'push' in e.cmd:
            update_immediate_job_status(job_id, 'failed', f"Local commit succeeded, but pushing to remote failed. The daemon likely lacks Git credentials.\n\nError: {err_out}", workspace_id=workspace_id)
        else:
            update_immediate_job_status(job_id, 'failed', err_out, workspace_id=workspace_id)

register_callback("git", "push_task", _background_git_push)
@git_bp.route('/api/git/push', methods=['POST'])
def api_git_push():
    workspace_id = request.headers.get('X-Workspace-ID')
    data = request.json
    repo = data.get('repo')
    message = data.get('message')
    diff_file = data.get('diff_file')

    if not repo or not message: return jsonify({"error": "Repo and message required"}), 400

    job_id = f"psh_{uuid.uuid4().hex[:8]}"
    args_json = json.dumps({"repo": repo, "message": message, "diff_file": diff_file})

    submit_immediate_job(job_id, "git", "push_task", args_json, workspace_id)

    return jsonify({"status": "accepted", "job_id": job_id}), 202

@hooks.on('request_available_diffs')
def provide_available_diffs(workspace_id=None, **kwargs):
    """Soft-dependency provider: Supplies expected diffs to the Gather/Flow UI dropdowns."""
    from insetu.utils_core import load_config, get_gather_paths, get_safe_repo_id
    import os
    cfg = load_config(workspace_id)
    paths = get_gather_paths(workspace_id)
    expected_diffs = set()

    for c in cfg.get("target_repos", []):
        if c.get("exclude_from_diffs"): continue
        r_dir = c.get("repo_dir", "")
        safe_r_dir = get_safe_repo_id(r_dir)
        subs = c.get("sub_buckets", [])

        out = c.get("out_file", f"{safe_r_dir}_context.txt")
        expected_diffs.add(f"diffs/{out.replace('_context.txt', '_diffs.txt')}")

        if subs:
            for b in subs:
                if not b.get("dynamic_split_prefix"):
                    sub_out = b.get("out_file", f"{r_dir}_{b.get('id')}_context.txt")
                    expected_diffs.add(f"diffs/{sub_out.replace('_context.txt', '_diffs.txt')}")
                else:
                    dyn_dir = os.path.join(paths["workspace_root"], r_dir, b["dynamic_split_prefix"])
                    if os.path.exists(dyn_dir):
                        for module in os.listdir(dyn_dir):
                            if os.path.isdir(os.path.join(dyn_dir, module)) and not module.startswith('.'):
                                expected_diffs.add(f"diffs/{module}_diffs.txt")

    if os.path.exists(paths["diffs_dir"]):
        for f in os.listdir(paths["diffs_dir"]):
            if f.endswith('.txt'):
                expected_diffs.add(f"diffs/{f}")

    return list(expected_diffs)