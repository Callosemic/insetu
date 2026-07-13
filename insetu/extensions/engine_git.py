from pathlib import Path
import os
import subprocess
import uuid
import json
from flask import jsonify
from insetu.sdk import InSetuExtension
from insetu.utils_core import get_workspace_physics
from insetu.hooks import hooks
from insetu.workers import submit_immediate_job, update_immediate_job_status, register_callback

git_bp = InSetuExtension('git', __name__)
__depends__ = []
@hooks.on('compile_contexts')
def on_compile_contexts_generate_diffs(manifest, workspace_id=None, **kwargs):
    try:
        generate_diff_context(workspace_id, manifest_ref=manifest)
    except Exception as e:
        print(f"Warning: Background Git auto-diff generation failed: {e}")

def generate_diff_context(workspace_id=None, target_repos=None, manifest_ref=None):
    from insetu.sdk import ExtensionContext
    from insetu.utils_core import get_safe_repo_id
    from insetu.engine_gather import resolve_file_bucket

    ctx = ExtensionContext('git', workspace_id)
    paths = ctx.paths
    _, ws_root, _ = ctx.config.get("workspace_physics", (None, ctx.paths["workspace_root"], None))

    live_cfg = ctx.config
    safe_targets = [get_safe_repo_id(r) for r in target_repos] if target_repos else []
    diffs_dir_path = Path(paths["diffs_dir"])
    if diffs_dir_path.exists():
        from insetu.routes_fs import execute_vfs_delete
        for f_path in diffs_dir_path.iterdir():
            if f_path.is_file() and ('_diffs.txt' in f_path.name or '_diffs_part' in f_path.name):
                f = f_path.name
                if not target_repos or any(f.startswith(st) for st in safe_targets):
                    try:
                        execute_vfs_delete(workspace_id, f_path.as_posix())
                    except Exception as e:
                        print(f"Warning: Failed to clear old diff file {f_path}: {e}")
    # Prune stale diff entries from the manifest to prevent ghost references
    is_standalone = manifest_ref is None
    from insetu.utils_core import load_json_file, save_json_file
    manifest_path = Path(paths["contexts_dir"]).joinpath("manifest.json").as_posix()

    working_manifest = manifest_ref if not is_standalone else load_json_file(manifest_path, {})
    stale_keys = [k for k in working_manifest.keys() if k.endswith('_diffs.txt') and (not target_repos or any(k.startswith(st) for st in safe_targets))]
    for k in stale_keys:
        del working_manifest[k]

    diff_manifest = []
    ws_root_path = Path(ws_root).resolve()
    for config in live_cfg.get("target_repos", []):
        if target_repos and config.get("repo_dir") not in target_repos: continue
        if config.get("exclude_from_diffs"): continue
        if config.get("archive_type", "repo") == "media-vault": continue
        safe_r_dir = get_safe_repo_id(config.get("repo_dir"))
        physical_path = config.get("physical_path")

        if physical_path:
            repo_path = Path(physical_path).expanduser().resolve()
        else:
            repo_path = (ws_root_path / config["repo_dir"]).resolve()
        if not repo_path.exists(): continue
        try:
            result = subprocess.run(['git', 'status', '--porcelain', '-uall'], capture_output=True, text=True, cwd=str(repo_path))
            lines = result.stdout.splitlines()
            if not lines: continue

            # Resolve Git root to normalize `--porcelain` paths against logical workspace directories
            git_root_res = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True, cwd=str(repo_path))
            git_root = Path(git_root_res.stdout.strip()).resolve() if git_root_res.returncode == 0 else repo_path.resolve()

            changed_files = []
            for line in lines:
                if len(line) < 3: continue
                status = line[:2]
                filepath = line[3:]
                if '->' in filepath: filepath = filepath.split('->')[-1].strip()
                if filepath.startswith('diffs/') or filepath.endswith('_diffs.txt'): continue

                abs_filepath = git_root / filepath
                try:
                    rel_to_repo = abs_filepath.relative_to(repo_path.resolve()).as_posix()
                except ValueError:
                    continue # File is outside our logical repo_dir bounding box, skip it
                if abs_filepath.is_file() or 'D' in status:
                    changed_files.append((rel_to_repo, status, filepath))

            if not changed_files: continue
            sub_buckets = config.get("sub_buckets", [])
            bucketed_files = {}

            managed_dirs = live_cfg.get("managed_dirs", []) + config.get("repo_managed_dirs", [])
            ignore_dirs = set(live_cfg.get("ignore_dirs", []) + config.get("repo_ignore_dirs", []))
            ignore_patterns = live_cfg.get("ignore_patterns", []) + config.get("repo_ignore_patterns", [])

            if sub_buckets:
                for rel_to_repo, status, orig_filepath in changed_files:
                    b, module = resolve_file_bucket(rel_to_repo, sub_buckets)
                    if b and b.get("exclude_from_diffs"): continue

                    if b and module:
                        b_id = f"{module}_diffs.txt"
                    elif b:
                        b_id = b.get("out_file", f"{safe_r_dir}_{b.get('id', 'bucket')}_context.txt").replace("_context.txt", "_diffs.txt")
                    else:
                        # Anti-Pattern Guard: Prevent unmatched managed OS directories or ignored files from bleeding into the default diff context
                        if any(rel_to_repo.startswith(d + '/') or f"/{d}/" in rel_to_repo for d in managed_dirs): continue
                        if any(pattern in rel_to_repo for pattern in ignore_patterns): continue
                        if set(p.lower() for p in rel_to_repo.split('/')).intersection(ignore_dirs): continue

                        b_id = config.get("out_file", f"{safe_r_dir}_context.txt").replace("_context.txt", "_diffs.txt")
                    if b_id not in bucketed_files: bucketed_files[b_id] = []
                    bucketed_files[b_id].append((rel_to_repo, status, orig_filepath))
            else:
                out_filename = config.get("out_file", f"{safe_r_dir}_context.txt").replace("_context.txt", "_diffs.txt")
                filtered_files = []
                for rel_to_repo, status, orig_filepath in changed_files:
                    if any(rel_to_repo.startswith(d + '/') or f"/{d}/" in rel_to_repo for d in managed_dirs): continue
                    if any(pattern in rel_to_repo for pattern in ignore_patterns): continue
                    if set(p.lower() for p in rel_to_repo.split('/')).intersection(ignore_dirs): continue
                    filtered_files.append((rel_to_repo, status, orig_filepath))
                if filtered_files:
                    bucketed_files[out_filename] = filtered_files
            for out_filename, files_in_bucket in bucketed_files.items():
                header_lines = []
                header_lines.append(f"============================================================")
                header_lines.append(f">>> DIFF SUMMARY :: {len(files_in_bucket)} FILE(S) CHANGED")
                header_lines.append(f"============================================================")
                for rel_path, f_status, _ in files_in_bucket:
                    header_lines.append(f"[{f_status.ljust(2)}] {rel_path}")
                header_lines.append("\n\n")
                header_str = "\n".join(header_lines)

                # OPTIMIZATION: Bulk fetch diffs to eliminate N+1 subprocess bottleneck
                files_to_diff = [orig_f for _, s, orig_f in files_in_bucket if s != "??"]
                bulk_diffs = {}
                if files_to_diff:
                    try:
                        # Diffs must be fetched relative to the git root to match porcelain output
                        diff_res = subprocess.run(['git', 'diff', 'HEAD', '--'] + files_to_diff, capture_output=True, text=True, cwd=str(git_root))
                        for chunk in diff_res.stdout.split('diff --git '):
                            if not chunk.strip(): continue
                            first_line = chunk.split('\n')[0]
                            parts = first_line.split(' b/')
                            if len(parts) == 2:
                                fname = parts[1].strip().strip('"') 
                                bulk_diffs[fname] = 'diff --git ' + chunk
                    except Exception as e:
                        print(f"Bulk diff error: {e}")

                text_blocks = []
                for rel_path, status, orig_filepath in files_in_bucket:
                    block_lines = []
                    abs_filepath = git_root / orig_filepath
                    if 'D' in status:
                        block_lines.append(f"============================================================")
                        block_lines.append(f">>>DELETED FILE :: {config['repo_dir']}/{rel_path} | PREVIOUSLY TRACKED")
                        block_lines.append(f"============================================================")
                        block_lines.append(bulk_diffs.get(orig_filepath, "[No diff available or file is binary]"))
                        block_lines.append("\n\n")
                    else:
                        block_lines.append(f"============================================================")
                        block_lines.append(f">>>NEW FILE :: {config['repo_dir']}/{rel_path} | CURRENT CONTENTS")
                        block_lines.append(f"============================================================")
                        try:
                            content = ctx.vfs.read(abs_filepath.as_posix())
                            if content: block_lines.append(content)
                            else: block_lines.append("[Binary or unreadable file]")
                        except Exception:
                            block_lines.append("[Binary or unreadable file]")

                        block_lines.append(f"\n============================================================")
                        block_lines.append(f">>>DIFF :: {config['repo_dir']}/{rel_path} | CHANGES SINCE LAST COMMIT")
                        block_lines.append(f"============================================================")

                        if status == "??":
                            block_lines.append("[Untracked file - full content above]")
                        else:
                            block_lines.append(bulk_diffs.get(orig_filepath, "[No diff available or file is binary]"))
                        block_lines.append("\n\n")

                    text_blocks.append("\n".join(block_lines))
                if text_blocks:
                    from insetu.engine_gather import compile_context_payload

                    # Diff specific manifest integration
                    meta = {
                        "type": "diff",
                        "title": out_filename.replace('_diffs.txt', '').replace('_', ' ').title(),
                        "domain": "Git Diffs",
                        "desc": "Just-In-Time generated diff payload."
                    }
                    manifest_entry = compile_context_payload(
                        workspace_id, 
                        diffs_dir_path.as_posix(), 
                        out_filename, 
                        header_str, 
                        text_blocks, 
                        [f"{config['repo_dir']}/{f}" for f, _, _ in files_in_bucket], 
                        meta
                    )
                    # Update central manifest explicitly so Gather/UI tools can find the diff chunks!
                    working_manifest[out_filename] = manifest_entry
                    diff_manifest.append({"filename": out_filename, "repo": config['repo_dir']})
        except Exception as e:
            print(f"Skipping diff generation for {config['repo_dir']}: {e}")
    if is_standalone:
        save_json_file(manifest_path, working_manifest, workspace_id)

    # VFS BARRIER: Block until the asynchronous write queue physically flushes diffs to the SSD
    from insetu.routes_fs import _VFS_WRITE_QUEUE
    _VFS_WRITE_QUEUE.join()

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
@git_bp.route('diffs/generate', methods=['POST'])
def api_generate_diffs(ctx):
    data = ctx.req.json or {}
    job_id = ctx.jobs.submit("diffs_task", target_repos=data.get("target_repos"))
    return jsonify({"status": "accepted", "job_id": job_id}), 202
def _background_sweep_status(job_id, workspace_id):
    from insetu.sdk import ExtensionContext
    from insetu.utils_core import get_workspace_physics
    ctx = ExtensionContext('git', workspace_id)
    cfg = ctx.config
    _, ws_root, _ = get_workspace_physics(workspace_id)
    results = {}

    update_immediate_job_status(job_id, 'processing', "Scanning workspaces for untracked files...", workspace_id=workspace_id)
    from insetu.engine_gather import resolve_file_bucket

    managed_dirs_global = cfg.get("managed_dirs", [])
    ignore_dirs_global = cfg.get("ignore_dirs", [])
    ignore_patterns_global = cfg.get("ignore_patterns", [])

    for c in cfg.get("target_repos", []):
        repo = c.get("repo_dir")
        repo_path = Path(ws_root).joinpath(repo).as_posix()
        if c.get("physical_path"):
            repo_path = os.path.abspath(os.path.expanduser(c.get("physical_path")))
        if not os.path.exists(repo_path): continue
        try:
            res = subprocess.run(['git', 'status', '--porcelain', '-uall'], capture_output=True, text=True, cwd=repo_path)
            lines = res.stdout.splitlines()
            files = []

            repo_excluded = c.get("exclude_from_diffs", False)
            sub_buckets = c.get("sub_buckets", [])
            managed_dirs = managed_dirs_global + c.get("repo_managed_dirs", [])
            ignore_dirs = set(ignore_dirs_global + c.get("repo_ignore_dirs", []))
            ignore_patterns = ignore_patterns_global + c.get("repo_ignore_patterns", [])

            for line in lines:
                if len(line) < 3: continue
                status = line[:2]
                filepath = line[3:]
                if '->' in filepath: filepath = filepath.split('->')[-1].strip()

                is_excluded = repo_excluded
                if not is_excluded and sub_buckets:
                    b, _ = resolve_file_bucket(filepath, sub_buckets)
                    if b:
                        if b.get("exclude_from_diffs"):
                            is_excluded = True
                    else:
                        # Anti-Pattern Guard: If it falls through buckets and is a managed/ignored file, it is excluded from normal diffs
                        if any(filepath.startswith(d + '/') or f"/{d}/" in filepath for d in managed_dirs):
                            is_excluded = True
                        elif any(pattern in filepath for pattern in ignore_patterns):
                            is_excluded = True
                        elif set(p.lower() for p in filepath.split('/')).intersection(ignore_dirs):
                            is_excluded = True

                # Sweepable State catches ALL untracked files (??) PLUS any tracked file explicitly excluded from Diffs
                if is_excluded or status == "??":
                    files.append({"path": filepath, "status": status.strip()})

            if files:
                results[repo] = files
        except Exception:
            pass

    update_immediate_job_status(job_id, 'completed', "Scan complete.", artifact={"repos": results}, workspace_id=workspace_id)

register_callback("git", "sweep_status_task", _background_sweep_status)

@git_bp.route('sweep/status', methods=['POST'])
def api_git_sweep_status(ctx):
    job_id = ctx.jobs.submit("sweep_status_task")
    return jsonify({"status": "accepted", "job_id": job_id}), 202
def _background_sweep_push(job_id, workspace_id, selections, message):
    import os
    import subprocess
    from insetu.sdk import ExtensionContext
    from insetu.utils_core import get_workspace_physics
    ctx = ExtensionContext('git', workspace_id)
    cfg = ctx.config
    _, ws_root, _ = get_workspace_physics(workspace_id)
    output_log = ""

    try:
        for repo, files in selections.items():
            if not files: continue
            update_immediate_job_status(job_id, 'processing', f"Pushing {repo}...", workspace_id=workspace_id)

            repo_path = Path(ws_root).joinpath(repo).as_posix()
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
@git_bp.route('sweep/push', methods=['POST'])
def api_git_sweep_push(ctx):
    data = ctx.req.json
    job_id = ctx.jobs.submit(
        "sweep_push_task", 
        selections=data.get('selections', {}), 
        message=data.get('message', 'chore: workspace sweep')
    )
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@git_bp.route('changelogs', methods=['GET'])
def api_git_changelogs(ctx):
    """Queries the rapid SQLite tracking index to populate recent commit suggestions."""
    repo = ctx.req.args.get('repo', '')
    changelogs = []
    # Abstracted horizontal cross-talk using the Event Bus
    from insetu.hooks import hooks
    try:
        results = hooks.emit('request_changelog_suggestions', repo=repo, workspace_id=ctx.workspace_id)
        for res in results:
            if res:
                changelogs.extend(res)
    except Exception as e:
        print(f"Warning: Failed to fetch release log suggestions via Event Bus: {e}")

    return jsonify({"repo": repo, "changelogs": changelogs})
def _background_git_push(job_id, workspace_id, repo, message, diff_file):
    import os
    import subprocess
    from insetu.sdk import ExtensionContext
    from insetu.utils_core import get_workspace_physics

    update_immediate_job_status(job_id, 'processing', f"Preparing to push {repo}...", workspace_id=workspace_id)

    ctx = ExtensionContext('git', workspace_id)
    cfg = ctx.config
    _, ws_root, _ = get_workspace_physics(workspace_id)
    repo_path = Path(ws_root).joinpath(repo).as_posix()
    for c in cfg.get("target_repos", []):
        if c.get("repo_dir") == repo and c.get("physical_path"):
            repo_path = os.path.abspath(os.path.expanduser(c.get("physical_path")))
            break

    if not os.path.exists(repo_path): 
        update_immediate_job_status(job_id, 'failed', "Repo not found", workspace_id=workspace_id)
        return
    files_to_stage = set()
    from insetu.engine_gather import resolve_file_bucket
    from insetu.utils_core import get_safe_repo_id

    repo_cfg = next((c for c in cfg.get("target_repos", []) if c.get("repo_dir") == repo), None)
    sub_buckets = repo_cfg.get("sub_buckets", []) if repo_cfg else []
    safe_r_dir = get_safe_repo_id(repo)
    target_diff_name = os.path.basename(diff_file) if diff_file else None

    # SSOT Enforcement: Query the Git tree directly rather than parsing diff artifacts
    status_res = subprocess.run(['git', 'status', '--porcelain', '-uall'], cwd=repo_path, capture_output=True, text=True)
    for line in status_res.stdout.splitlines():
        if len(line) >= 3:
            filepath = line[3:]
            if '->' in filepath: 
                filepath = filepath.split('->')[-1]
            filepath = filepath.strip()

            if target_diff_name:
                if sub_buckets:
                    b, module = resolve_file_bucket(filepath, sub_buckets)
                    if b and module:
                        b_id = f"{module}_diffs.txt"
                    elif b:
                        b_id = b.get("out_file", f"{safe_r_dir}_{b.get('id', 'bucket')}_context.txt").replace("_context.txt", "_diffs.txt")
                    else:
                        b_id = repo_cfg.get("out_file", f"{safe_r_dir}_context.txt").replace("_context.txt", "_diffs.txt") if repo_cfg else f"{safe_r_dir}_diffs.txt"
                else:
                    b_id = repo_cfg.get("out_file", f"{safe_r_dir}_context.txt").replace("_context.txt", "_diffs.txt") if repo_cfg else f"{safe_r_dir}_diffs.txt"

                # Only stage the file if it maps to the exact bucket the user clicked
                if b_id == target_diff_name:
                    files_to_stage.add(filepath)
            else:
                # Fallback to sweeping the whole repo if no specific diff bucket was targeted
                files_to_stage.add(filepath)

    if not files_to_stage:
        update_immediate_job_status(job_id, 'failed', "No files found to commit. Working tree is clean.", workspace_id=workspace_id)
        return

    try:
        from insetu.cartographer import map_repositories
        map_repositories(workspace_id)

        if os.path.exists(Path(repo_path).joinpath("CODE_INDEX.md").as_posix()): files_to_stage.add("CODE_INDEX.md")
        if os.path.exists(Path(repo_path).joinpath("docs", "CODE_INDEX.md").as_posix()): files_to_stage.add("docs/CODE_INDEX.md")
        for m_dir in cfg.get("managed_dirs", []):
            if os.path.exists(Path(repo_path).joinpath(m_dir).as_posix()): files_to_stage.add(f"{m_dir}/")

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
@git_bp.route('push', methods=['POST'])
def api_git_push(ctx):
    data = ctx.req.json
    repo = data.get('repo')
    message = data.get('message')

    if not repo or not message: return jsonify({"error": "Repo and message required"}), 400

    job_id = ctx.jobs.submit(
        "push_task", 
        repo=repo, 
        message=message, 
        diff_file=data.get('diff_file')
    )
    return jsonify({"status": "accepted", "job_id": job_id}), 202

@hooks.on('request_available_diffs')
def provide_available_diffs(workspace_id=None, **kwargs):
    """Soft-dependency provider: Supplies expected diffs to the Gather/Flow UI dropdowns."""
    from insetu.sdk import ExtensionContext
    from insetu.utils_core import get_safe_repo_id
    import os
    ctx = ExtensionContext('git', workspace_id)
    cfg = ctx.config
    paths = ctx.paths
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
                if b.get("exclude_from_diffs"): continue

                if not b.get("dynamic_split_prefix"):
                    sub_out = b.get("out_file", f"{safe_r_dir}_{b.get('id')}_context.txt")
                    expected_diffs.add(f"diffs/{sub_out.replace('_context.txt', '_diffs.txt')}")
                else:
                    dyn_dir = Path(paths["workspace_root"]).joinpath(r_dir, b["dynamic_split_prefix"]).as_posix()
                    if os.path.exists(dyn_dir):
                        for module in os.listdir(dyn_dir):
                            if os.path.isdir(Path(dyn_dir).joinpath(module).as_posix()) and not module.startswith('.'):
                                expected_diffs.add(f"diffs/{module}_diffs.txt")
    if os.path.exists(paths["diffs_dir"]):
        for f in os.listdir(paths["diffs_dir"]):
            if f.endswith('_diffs.txt') or '_diffs_part' in f:
                expected_diffs.add(f"diffs/{f}")

    return list(expected_diffs)