from pathlib import Path
import os
import subprocess
import uuid
import json
from flask import jsonify
from insetu.sdk import InSetuExtension
from insetu.utils import get_workspace_physics
from insetu.hooks import hooks

def get_headless_git_env():
    """Returns a secure OS environment block pre-configured for non-interactive SSH connections."""
    import os
    env = os.environ.copy()
    env["GIT_SSH_COMMAND"] = "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new"
    return env
def get_git_settings_schema(workspace_id):
    """Dynamically generates distinct setting configuration slots for every tracked repository."""
    from insetu.sdk import ExtensionContext
    ctx = ExtensionContext('git', workspace_id)
    cfg = ctx.config
    schema = []
    for repo in cfg.get("target_repos", []):
        repo_dir = repo.get("repo_dir")
        if not repo_dir or repo.get("exclude_from_diffs") or repo.get("archive_type") == "media-vault":
            continue
        schema.append({
            "id": f"strategy_{repo_dir}",
            "title": f"Pull Strategy: {repo.get('title', repo_dir)}",
            "type": "select",
            "options": [
                {"value": "rebase", "label": "Rebase (--rebase)"},
                {"value": "merge", "label": "Merge (--no-rebase)"},
                {"value": "ff_only", "label": "Fast-Forward Only (--ff-only)"},
                {"value": "runtime", "label": "🤔 Decide at Runtime"}
            ],
            "default": "rebase",
            "description": f"Reconciliation strategy for branch divergence inside the '{repo_dir}' workspace target."
        })
    return schema

git_bp = InSetuExtension('git', __name__, title="Version Control", description="Version control integration, diff generation, and workspace sweeping.", settings_schema=get_git_settings_schema)
__depends__ = []
@hooks.on('compile_contexts')
def on_compile_contexts_generate_diffs(manifest, workspace_id=None, **kwargs):
    try:
        is_full_sweep = kwargs.get('is_full_sweep', True)
        if isinstance(is_full_sweep, list):
            target_repos = is_full_sweep
        else:
            target_repos = None if is_full_sweep else kwargs.get('target_repos')
        generate_diff_context(workspace_id, target_repos=target_repos, manifest_ref=manifest)
    except Exception as e:
        print(f"Warning: Background Git auto-diff generation failed: {e}")
def generate_diff_context(workspace_id=None, target_repos=None, manifest_ref=None):
    from insetu.sdk import ExtensionContext
    from insetu.core.utils_core import get_safe_repo_id
    from insetu.core.gather.engine_gather import resolve_file_bucket

    ctx = ExtensionContext('git', workspace_id)
    paths = ctx.paths
    _, ws_root, _ = ctx.config.get("workspace_physics", (None, ctx.paths["workspace_root"], None))

    live_cfg = ctx.config
    safe_targets = [get_safe_repo_id(r) for r in target_repos] if target_repos else []
    diffs_dir_path = Path(paths["diffs_dir"])
    if diffs_dir_path.exists():
        for f_path in diffs_dir_path.iterdir():
            if f_path.is_file() and ('_diffs.txt' in f_path.name or '_diffs_part' in f_path.name):
                f = f_path.name
                if not target_repos or any(f == f"{st}_diffs.txt" or f.startswith(f"{st}_") for st in safe_targets):
                    try:
                        ctx.vfs.save(f_path.as_posix(), "", data={"action": "delete"})
                    except Exception as e:
                        print(f"Warning: Failed to clear old diff file {f_path}: {e}")
    # Prune stale diff entries from the manifest to prevent ghost references
    is_standalone = manifest_ref is None

    working_manifest = manifest_ref if not is_standalone else ctx.manifest
    stale_keys = [k for k in working_manifest.keys() if k.endswith('_diffs.txt') and (not target_repos or any(k == f"{st}_diffs.txt" or k.startswith(f"{st}_") for st in safe_targets))]
    for k in stale_keys:
        del working_manifest[k]
    diff_manifest = []
    manifest_deltas = {}
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
                filepath = line[3:].strip().strip('"')
                if '->' in filepath: filepath = filepath.split('->')[-1].strip().strip('"')
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
            ignore_dirs = set(live_cfg.get("ignore_dirs", []) + config.get("repo_ignore_dirs", []))
            ignore_patterns = live_cfg.get("ignore_patterns", []) + config.get("repo_ignore_patterns", [])
            if sub_buckets:
                for rel_to_repo, status, orig_filepath in changed_files:
                    # Global ignore guards should apply BEFORE sub-bucket routing
                    if any(pattern in rel_to_repo for pattern in ignore_patterns): continue
                    if set(p.lower() for p in rel_to_repo.split('/')).intersection(ignore_dirs): continue

                    b, module = resolve_file_bucket(rel_to_repo, sub_buckets)
                    if b and b.get("exclude_from_diffs"): continue

                    if b and module:
                        b_id = f"{module}_diffs.txt"
                    elif b:
                        b_id = b.get("out_file", f"{safe_r_dir}_{b.get('id', 'bucket')}_context.txt").replace("_context.txt", "_diffs.txt")
                    else:
                        b_id = config.get("out_file", f"{safe_r_dir}_context.txt").replace("_context.txt", "_diffs.txt")

                    if b_id not in bucketed_files: bucketed_files[b_id] = []
                    bucketed_files[b_id].append((rel_to_repo, status, orig_filepath))
            else:
                out_filename = config.get("out_file", f"{safe_r_dir}_context.txt").replace("_context.txt", "_diffs.txt")
                filtered_files = []
                for rel_to_repo, status, orig_filepath in changed_files:
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
                    from insetu.core.gather.engine_gather import compile_context_payload

                    # Diff specific manifest integration
                    meta = {
                        "type": "diff",
                        "title": out_filename.replace('_diffs.txt', '').replace('_', ' ').title(),
                        "domain": "Git Diffs",
                        "desc": "Just-In-Time generated diff payload.",
                        "repo": config['repo_dir']
                    }
                    manifest_entry = compile_context_payload(
                        workspace_id, 
                        diffs_dir_path.as_posix(), 
                        out_filename, 
                        header_str, 
                        text_blocks, 
                        [f"{config['repo_dir']}/{f}" for f, s, _ in files_in_bucket if 'D' not in s], 
                        meta
                    )
                    # Update central manifest explicitly so Gather/UI tools can find the diff chunks!
                    working_manifest[out_filename] = manifest_entry
                    diff_manifest.append({"filename": out_filename, "repo": config['repo_dir']})
                    manifest_deltas[out_filename] = manifest_entry
        except Exception as e:
            print(f"Skipping diff generation for {config['repo_dir']}: {e}")
    if is_standalone:
        ctx.save_manifest(working_manifest)
    # VFS BARRIER: Block until the asynchronous write queue physically flushes diffs to the SSD
    from insetu.routes_fs import _VFS_WRITE_QUEUE
    _VFS_WRITE_QUEUE.join()

    return diff_manifest, manifest_deltas
@git_bp.worker("diffs_task")
def _background_generate_diffs(ctx, target_repos=None):
    msg = f"Analyzing Git trees for {', '.join(target_repos)}..." if target_repos else "Analyzing Git trees across sister repositories..."
    ctx.jobs.update_progress(msg)
    files, manifest_deltas = generate_diff_context(ctx.workspace_id, target_repos)
    # Notify the ecosystem (e.g., Flow) that diffs have updated so dependent batches can recompile
    if files:
        diff_filenames = [f['filename'] for f in files]
        ctx.emit('compile_contexts', manifest=ctx.manifest, is_full_sweep=False, touched_buckets=diff_filenames)

    return {"message": "Diff generation complete.", "artifact": {"files": files, "target_repos": target_repos, "manifest_deltas": manifest_deltas}}

@git_bp.route('diffs/generate', methods=['POST'])
def api_generate_diffs(ctx):
    data = ctx.req.json or {}
    job_id = ctx.jobs.submit("diffs_task", target_repos=data.get("target_repos"))
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@git_bp.worker("sweep_status_task")
def _background_sweep_status(ctx):
    from insetu.utils import get_workspace_physics
    cfg = ctx.config
    _, ws_root, _ = get_workspace_physics(ctx.workspace_id)
    results = {}
    ctx.jobs.update_progress("Scanning workspaces for untracked files...")
    from insetu.core.gather.engine_gather import resolve_file_bucket

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
            ignore_dirs = set(ignore_dirs_global + c.get("repo_ignore_dirs", []))
            ignore_patterns = ignore_patterns_global + c.get("repo_ignore_patterns", [])

            for line in lines:
                if len(line) < 3: continue
                status = line[:2]
                filepath = line[3:]
                if '->' in filepath: filepath = filepath.split('->')[-1].strip()

                is_excluded = repo_excluded
                if not is_excluded:
                    if any(pattern in filepath for pattern in ignore_patterns):
                        is_excluded = True
                    elif set(p.lower() for p in filepath.split('/')).intersection(ignore_dirs):
                        is_excluded = True
                    elif sub_buckets:
                        b, _ = resolve_file_bucket(filepath, sub_buckets)
                        if b and b.get("exclude_from_diffs"):
                            is_excluded = True

                # Sweepable State should ONLY catch files explicitly excluded from normal Diffs
                if is_excluded:
                    files.append({"path": filepath, "status": status.strip()})

            if files:
                results[repo] = files
        except Exception:
            pass

    return {"message": "Scan complete.", "artifact": {"repos": results}}

@git_bp.route('sweep/status', methods=['POST'])
def api_git_sweep_status(ctx):
    job_id = ctx.jobs.submit("sweep_status_task")
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@git_bp.worker("sweep_push_task")
def _background_sweep_push(ctx, selections, message):
    import os
    import subprocess
    from insetu.utils import get_workspace_physics
    cfg = ctx.config
    _, ws_root, _ = get_workspace_physics(ctx.workspace_id)
    output_log = ""

    try:
        for repo, files in selections.items():
            if not files: continue
            ctx.jobs.update_progress(f"Pushing {repo}...")

            repo_path = Path(ws_root).joinpath(repo).as_posix()
            for c in cfg.get("target_repos", []):
                if c.get("repo_dir") == repo and c.get("physical_path"):
                    repo_path = os.path.abspath(os.path.expanduser(c.get("physical_path")))
                    break
            if not os.path.exists(repo_path): continue
            # Guarantee topology is perfectly mapped before staging
            from insetu.core.cartographer.cartographer import map_repositories
            map_repositories(ctx.workspace_id)
            subprocess.run(['git', 'add'] + files, cwd=repo_path, check=True, capture_output=True)
            subprocess.run(['git', 'commit', '-m', message], cwd=repo_path, check=True, capture_output=True)
            git_env = get_headless_git_env()

            try:
                subprocess.run(['git', 'push'], cwd=repo_path, check=True, capture_output=True, text=True, env=git_env)
            except subprocess.CalledProcessError as e:
                err_out = e.stderr or e.stdout
                err_str = err_out.decode('utf-8', errors='replace') if isinstance(err_out, bytes) else str(err_out)

                if "has no upstream branch" in err_str or "setUpstream" in err_str:
                    subprocess.run(['git', 'push', '-u', 'origin', 'HEAD'], cwd=repo_path, check=True, capture_output=True, text=True, env=git_env)
                else:
                    raise e

            output_log += f"✅ {repo}: Pushed {len(files)} files.\n"

        return output_log
    except subprocess.CalledProcessError as e:
        err = e.stderr.decode('utf-8') if isinstance(e.stderr, bytes) else (e.stderr or str(e))
        raise RuntimeError(f"{repo} Error: {err}")

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
    try:
        results = ctx.emit('request_changelog_suggestions', repo=repo)
        for res in results:
            if res:
                changelogs.extend(res)
    except Exception as e:
        print(f"Warning: Failed to fetch release log suggestions via Event Bus: {e}")

    return jsonify({"repo": repo, "changelogs": changelogs})
@git_bp.worker("push_task")
def _background_git_push(ctx, repo, message, diff_file):
    import os
    import subprocess
    from insetu.utils import get_workspace_physics

    ctx.jobs.update_progress(f"Preparing to push {repo}...")

    cfg = ctx.config
    _, ws_root, _ = get_workspace_physics(ctx.workspace_id)
    repo_path = Path(ws_root).joinpath(repo).as_posix()
    for c in cfg.get("target_repos", []):
        if c.get("repo_dir") == repo and c.get("physical_path"):
            repo_path = os.path.abspath(os.path.expanduser(c.get("physical_path")))
            break
    if not os.path.exists(repo_path): 
        raise ValueError("Repo not found")
    files_to_stage = set()
    from insetu.core.gather.engine_gather import resolve_file_bucket
    from insetu.core.utils_core import get_safe_repo_id
    repo_cfg = next((c for c in cfg.get("target_repos", []) if c.get("repo_dir") == repo), None)
    sub_buckets = repo_cfg.get("sub_buckets", []) if repo_cfg else []
    safe_r_dir = get_safe_repo_id(repo)
    target_diff_name = Path(diff_file).name if diff_file else None

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
        raise ValueError("No files found to commit. Working tree is clean.")

    # Pre-flight check: verify a remote actually exists before attempting to push
    remote_check = subprocess.run(['git', 'remote'], cwd=repo_path, capture_output=True, text=True)
    if not remote_check.stdout.strip():
        raise ValueError(f"No remote configured for '{repo}'. Please add a remote (e.g., 'git remote add origin <url>') via the terminal first.")
    try:
        from insetu.core.cartographer.cartographer import map_repositories
        map_repositories(ctx.workspace_id)

        ctx.jobs.update_progress(f"Committing and pushing {repo}...")
        subprocess.run(['git', 'add'] + list(files_to_stage), cwd=repo_path, check=True, capture_output=True)

        committed = False
        status_res = subprocess.run(['git', 'status', '--porcelain'], cwd=repo_path, capture_output=True, text=True)
        if status_res.stdout.strip():
            subprocess.run(['git', 'commit', '-m', message], cwd=repo_path, check=True, capture_output=True)
            committed = True
        git_env = get_headless_git_env()

        try:
            push_res = subprocess.run(['git', 'push'], cwd=repo_path, check=True, capture_output=True, text=True, env=git_env)
            output = push_res.stdout + ("\n" + push_res.stderr if push_res.stderr else "")
        except subprocess.CalledProcessError as e:
            err_out = e.stderr or e.stdout
            err_str = err_out.decode('utf-8', errors='replace') if isinstance(err_out, bytes) else (err_out or str(e))

            # Auto-heal missing upstream branches
            if "has no upstream branch" in err_str or "setUpstream" in err_str:
                push_res = subprocess.run(['git', 'push', '-u', 'origin', 'HEAD'], cwd=repo_path, check=True, capture_output=True, text=True, env=git_env)
                output = push_res.stdout + ("\n" + push_res.stderr if push_res.stderr else "")
            else:
                raise e

        return output.strip()
    except subprocess.CalledProcessError as e:
        err_out = e.stderr or e.stdout
        err_out = err_out.decode('utf-8', errors='replace') if isinstance(err_out, bytes) else (err_out or str(e))

        if 'committed' in locals() and committed and hasattr(e, 'cmd') and 'push' in e.cmd:
            raise RuntimeError(f"Local commit succeeded, but pushing to remote failed.\n\nError: {err_out}")
        else:
            raise RuntimeError(err_out)

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
    from insetu.core.utils_core import get_available_contexts
    import os
    ctx = ExtensionContext('git', workspace_id)
    paths = ctx.paths

    # 1. Derive the baseline topology directly from the SSOT using exclusion flags array
    base_contexts = get_available_contexts(workspace_id, exclusion_flags=["exclude_from_diffs", "exclude_from_context"])
    expected_diffs = set()

    # 2. Map SOTU contexts to diff payloads seamlessly
    for context_path in base_contexts:
        filename = context_path.split('/')[-1]
        expected_diffs.add(f"diffs/{filename.replace('_context.txt', '_diffs.txt')}")
    # 3. Include ad-hoc diffs currently tracked in the manifest
    manifest = ctx.manifest
    for key in manifest.keys():
        if key.endswith('_diffs.txt'):
            expected_diffs.add(f"diffs/{key}")

    return list(expected_diffs)
@git_bp.route('status', methods=['GET'])
def api_git_status(ctx):
    import subprocess
    from pathlib import Path
    repos_status = {}
    for c in ctx.config.get("target_repos", []):
        repo_dir = c.get("repo_dir")
        if not repo_dir: continue

        physical_path = c.get("physical_path")
        repo_path = Path(physical_path).expanduser().resolve() if physical_path else Path(ctx.resolve_path(repo_dir))
        if not repo_path.exists(): continue
        try:
            check_git = subprocess.run(['git', 'rev-parse', '--is-inside-work-tree'], capture_output=True, text=True, cwd=repo_path)
            if check_git.returncode == 0 and 'true' in check_git.stdout.lower():
                curr_res = subprocess.run(['git', 'branch', '--show-current'], capture_output=True, text=True, cwd=repo_path)
                current_branch = curr_res.stdout.strip()
                br_res = subprocess.run(['git', 'branch', '--format=%(refname:short)'], capture_output=True, text=True, cwd=repo_path)
                branches = [b.strip() for b in br_res.stdout.splitlines() if b.strip()]
                ahead_behind = ""
                try:
                    remote_res = subprocess.run(['git', 'remote', '-v'], capture_output=True, text=True, cwd=repo_path)
                    remotes_out = remote_res.stdout.lower()

                    # 1. Verify a remote exists and has an online network protocol
                    has_remote = bool(remotes_out.strip())
                    is_online = any(proto in remotes_out for proto in ['http://', 'https://', 'git@', 'ssh://'])

                    if not has_remote or not is_online:
                        ahead_behind = "☁️ Local Only"
                    else:
                        try:
                            # 2. Compare HEAD against its configured upstream tracking branch
                            ab_res = subprocess.run(['git', 'rev-list', '--left-right', '--count', 'HEAD...@{u}'], capture_output=True, text=True, cwd=repo_path, check=True)
                            parts = ab_res.stdout.strip().split()
                            if len(parts) == 2:
                                ahead, behind = int(parts[0]), int(parts[1])
                                if ahead > 0 or behind > 0:
                                    ahead_behind = f"{f'⬆️ {ahead}' if ahead > 0 else ''} {f'⬇️ {behind}' if behind > 0 else ''}".strip()
                                else:
                                    ahead_behind = "✔️ Sync"
                            else:
                                ahead_behind = "☁️ Local Only"
                        except Exception:
                            ahead_behind = "☁️ Local Only" # No upstream configured or no commits yet
                except Exception:
                    has_remote = False
                    ahead_behind = "☁️ Local Only"

                try:
                    status_res = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True, cwd=repo_path)
                    # Detect unmerged states: DD, AU, UD, UA, DU, AA, UU
                    conflicts = [line[3:] for line in status_res.stdout.splitlines() if len(line) >= 2 and line[:2] in ('DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU')]
                except Exception:
                    conflicts = []

                repos_status[repo_dir] = {"is_git": True, "current": current_branch, "branches": branches, "sync_status": ahead_behind, "conflicts": conflicts, "has_remote": has_remote}
            else:
                repos_status[repo_dir] = {"is_git": False}
        except Exception:
            repos_status[repo_dir] = {"is_git": False}
    return jsonify({"status": "success", "repos": repos_status})
@git_bp.worker("init_task")
def _background_git_init(ctx, repo, branch):
    import subprocess
    import os

    ctx.jobs.update_progress(f"Initializing Git repository for {repo}...")

    repo_path = ctx.resolve_path(repo)
    for c in ctx.config.get("target_repos", []):
        if c.get("repo_dir") == repo and c.get("physical_path"):
            repo_path = os.path.abspath(os.path.expanduser(c.get("physical_path")))
            break

    try:
        subprocess.run(['git', 'init', '-b', branch], cwd=repo_path, check=True, capture_output=True, text=True)
        return f"Initialized Git repository on branch '{branch}'."
    except subprocess.CalledProcessError as e:
        err = e.stderr or e.stdout
        err_str = err.decode('utf-8', errors='replace') if isinstance(err, bytes) else str(err)
        raise RuntimeError(err_str)
@git_bp.route('init', methods=['POST'])
def api_git_init(ctx):
    repo = ctx.req.json.get('repo')
    branch = ctx.req.json.get('branch', 'main')
    if not repo: return jsonify({"error": "Repo required"}), 400

    job_id = ctx.jobs.submit("init_task", repo=repo, branch=branch)
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@git_bp.worker("fetch_preview_task")
def _background_git_fetch_preview(ctx, repo):
    import subprocess
    import os

    ctx.jobs.update_progress(f"Fetching remote for {repo}...")
    repo_path = ctx.resolve_path(repo)
    for c in ctx.config.get("target_repos", []):
        if c.get("repo_dir") == repo and c.get("physical_path"):
            repo_path = os.path.abspath(os.path.expanduser(c.get("physical_path")))
            break
    try:
        # Pre-flight check: intercept active rebase indicators
        from pathlib import Path
        git_dir = Path(repo_path) / '.git'
        if (git_dir / 'rebase-merge').exists() or (git_dir / 'rebase-apply').exists():
            raise RuntimeError(f"Active rebase in progress for '{repo}'. Please resolve conflicts and run 'git rebase --continue' or 'git rebase --abort' in the terminal before pulling.")

        # Pre-flight check: verify a remote actually exists
        remote_check = subprocess.run(['git', 'remote'], cwd=repo_path, capture_output=True, text=True)
        if not remote_check.stdout.strip():
            raise RuntimeError(f"No remote configured for '{repo}'. Please add a remote (e.g., 'git remote add origin <url>') via the terminal first.")

        # Prevent SSH prompts from hanging the background process indefinitely
        git_env = get_headless_git_env()
        # Fetch and prune dead tracking branches to prevent ghost upstream checks
        subprocess.run(['git', 'fetch', '--prune'], cwd=repo_path, check=True, capture_output=True, text=True, env=git_env, timeout=30)
        # Check if an upstream branch is actually configured
        up_res = subprocess.run(['git', 'rev-parse', '--verify', '@{u}'], cwd=repo_path, capture_output=True)
        if up_res.returncode != 0:
            curr_branch = subprocess.run(['git', 'branch', '--show-current'], cwd=repo_path, capture_output=True, text=True).stdout.strip()
            if curr_branch:
                err_msg = f"No upstream tracking branch configured for '{curr_branch}'.\nPlease run this in your terminal:\n\ngit branch --set-upstream-to=origin/{curr_branch} {curr_branch}"
            else:
                err_msg = "You are in a detached HEAD state. Cannot pull."
            raise RuntimeError(err_msg)

        # Gather the incoming commits and file statistics using the robust branch reference name
        curr_branch = subprocess.run(['git', 'branch', '--show-current'], cwd=repo_path, capture_output=True, text=True).stdout.strip()
        remote_target = f"origin/{curr_branch}" if curr_branch else "@{u}"

        log_res = subprocess.run(['git', 'log', f'HEAD..{remote_target}', '--oneline'], cwd=repo_path, capture_output=True, text=True)
        stat_res = subprocess.run(['git', 'diff', '--stat', f'HEAD..{remote_target}'], cwd=repo_path, capture_output=True, text=True)

        incoming_log = log_res.stdout.strip()
        if not incoming_log:
            # Fallback to an outright verification if git tracking is desynced but upstream reports commits
            ab_res = subprocess.run(['git', 'rev-list', '--left-right', '--count', 'HEAD...@{u}'], capture_output=True, text=True, cwd=repo_path)
            parts = ab_res.stdout.strip().split()
            behind_count = int(parts[1]) if len(parts) == 2 else 0

            if behind_count > 0:
                incoming_log = f"[{behind_count} Incoming commits detected via tracking ref mismatch]"
                stat_res_text = "[Run pull to reconcile divergence]"
            else:
                stat_res_text = ""

        if not incoming_log:
            return {"message": "Already up to date.", "artifact": {"has_changes": False}}
        else:
            stat_out = stat_res.stdout.strip() if 'stat_res_text' not in locals() else stat_res_text
            msg = f"Incoming Commits:\n{incoming_log}\n\nFiles Changed:\n{stat_out}"
            return {"message": msg, "artifact": {"has_changes": True}}
    except subprocess.CalledProcessError as e:
        err = e.stderr or e.stdout
        err_str = err.decode('utf-8', errors='replace') if isinstance(err, bytes) else str(err)
        if "could not read Username" in err_str or "No such device" in err_str:
            raise RuntimeError("Authentication failed. Headless Git requires SSH URLs (git@github.com:...) instead of HTTPS, or a cached credential helper.")
        raise RuntimeError(err_str)

@git_bp.route('fetch_preview', methods=['POST'])
def api_git_fetch_preview(ctx):
    repo = ctx.req.json.get('repo')
    if not repo: return jsonify({"error": "Repo required"}), 400
    job_id = ctx.jobs.submit("fetch_preview_task", repo=repo)
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@git_bp.worker("pull_task")
def _background_git_pull(ctx, repo, strategy=None):
    import subprocess
    import os

    ctx.jobs.update_progress(f"Pulling {repo}...")
    repo_path = ctx.resolve_path(repo)
    for c in ctx.config.get("target_repos", []):
        if c.get("repo_dir") == repo and c.get("physical_path"):
            repo_path = os.path.abspath(os.path.expanduser(c.get("physical_path")))
            break

    # Query the repository-namespaced setting from the dynamic schema
    configured_strategy = ctx.settings.get(f"strategy_{repo}", "rebase")

    if configured_strategy == "runtime":
        # If set to runtime, allow the interactive UI choice parameter to take precedence
        if not strategy or strategy == "runtime":
            strategy = "rebase" # Fall back to safe baseline if modal selection was skipped
    else:
        strategy = configured_strategy

    # Absolute Guardrail: Ensure a valid reconciliation flag is always present,
    # catching any nulls or empty strings leaking from the settings JSON.
    if strategy not in ["rebase", "merge", "ff_only"]:
        strategy = "rebase"

    # Pre-flight check: intercept active rebase indicators
    from pathlib import Path
    git_dir = Path(repo_path) / '.git'
    if (git_dir / 'rebase-merge').exists() or (git_dir / 'rebase-apply').exists():
        raise RuntimeError(f"Active rebase in progress for '{repo}'. Please resolve conflicts and run 'git rebase --continue' or 'git rebase --abort' in the terminal before pulling.")

    curr_branch = subprocess.run(['git', 'branch', '--show-current'], cwd=repo_path, capture_output=True, text=True).stdout.strip()
    remote = subprocess.run(['git', 'config', f'branch.{curr_branch}.remote'], cwd=repo_path, capture_output=True, text=True).stdout.strip() or 'origin'
    merge = subprocess.run(['git', 'config', f'branch.{curr_branch}.merge'], cwd=repo_path, capture_output=True, text=True).stdout.strip()
    remote_branch = merge.replace('refs/heads/', '') if merge.startswith('refs/heads/') else curr_branch

    cmd = ['git', 'pull']
    if strategy == "rebase": cmd.append('--rebase')
    elif strategy == "merge": cmd.append('--no-rebase')
    elif strategy == "ff_only": cmd.append('--ff-only')

    # Explicitly target the remote and branch to prevent ambiguous configuration failures
    if remote and remote_branch:
        cmd.extend([remote, remote_branch])
    git_env = get_headless_git_env()

    try:
        # Enforce a strict 30-second circuit breaker to prevent zombie network deadlocks
        res = subprocess.run(cmd, cwd=repo_path, check=True, capture_output=True, text=True, env=git_env, timeout=30)
        # Combine stdout and stderr to capture fetch logs and rebase outputs
        output = res.stdout.strip() + "\n" + res.stderr.strip()
        return output.strip()
    except subprocess.CalledProcessError as e:
        err = e.stderr or e.stdout
        err_str = err.decode('utf-8', errors='replace') if isinstance(err, bytes) else str(err)
        raise RuntimeError(err_str)

@git_bp.route('pull', methods=['POST'])
def api_git_pull(ctx):
    data = ctx.req.json or {}
    repo = data.get('repo')
    strategy = data.get('strategy')
    if not repo: return jsonify({"error": "Repo required"}), 400
    job_id = ctx.jobs.submit("pull_task", repo=repo, strategy=strategy)
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@git_bp.worker("add_remote_task")
def _background_git_add_remote(ctx, repo, remote_url, resolution=None):
    import subprocess
    import os

    ctx.jobs.update_progress(f"Adding remote origin for {repo}...")
    repo_path = ctx.resolve_path(repo)
    for c in ctx.config.get("target_repos", []):
        if c.get("repo_dir") == repo and c.get("physical_path"):
            repo_path = os.path.abspath(os.path.expanduser(c.get("physical_path")))
            break
    try:
        # Ensure HEAD exists by creating an empty initial commit if the repo is completely empty
        head_check = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=repo_path, capture_output=True)
        if head_check.returncode != 0:
            ctx.jobs.update_progress("Creating initial commit to establish HEAD...")
            subprocess.run(['git', 'commit', '--allow-empty', '-m', 'chore: initial commit'], cwd=repo_path, check=True, capture_output=True)
        # Check if origin already exists to handle retries gracefully
        check_remote = subprocess.run(['git', 'remote'], cwd=repo_path, capture_output=True, text=True)
        if 'origin' in check_remote.stdout.split():
            subprocess.run(['git', 'remote', 'set-url', 'origin', remote_url], cwd=repo_path, check=True, capture_output=True, text=True)
        else:
            subprocess.run(['git', 'remote', 'add', 'origin', remote_url], cwd=repo_path, check=True, capture_output=True, text=True)

        git_env = get_headless_git_env()

        if resolution == "force":
            ctx.jobs.update_progress("Force pushing to overwrite remote...")
            push_res = subprocess.run(['git', 'push', '-u', 'origin', 'HEAD', '--force'], cwd=repo_path, check=True, capture_output=True, text=True, env=git_env)
            return push_res.stdout + push_res.stderr
        elif resolution == "pull":
            ctx.jobs.update_progress("Pulling and merging unrelated histories...")
            # Fetch first, then merge allowing unrelated histories
            curr_branch = subprocess.run(['git', 'branch', '--show-current'], cwd=repo_path, capture_output=True, text=True).stdout.strip() or 'main'
            subprocess.run(['git', 'pull', 'origin', curr_branch, '--allow-unrelated-histories', '--no-edit', '--no-rebase'], cwd=repo_path, check=True, capture_output=True, text=True, env=git_env, timeout=30)

            ctx.jobs.update_progress("Pushing merged history to remote...")
            push_res = subprocess.run(['git', 'push', '-u', 'origin', 'HEAD'], cwd=repo_path, check=True, capture_output=True, text=True, env=git_env)
            return push_res.stdout + push_res.stderr
        else:
            # Standard push
            ctx.jobs.update_progress("Pushing initial commit to remote...")
            push_res = subprocess.run(['git', 'push', '-u', 'origin', 'HEAD'], cwd=repo_path, check=True, capture_output=True, text=True, env=git_env)
            return push_res.stdout + push_res.stderr

    except subprocess.CalledProcessError as e:
        err = e.stderr or e.stdout
        err_str = err.decode('utf-8', errors='replace') if isinstance(err, bytes) else str(err)
        if "could not read Username" in err_str or "No such device" in err_str:
            raise RuntimeError("Authentication failed. Headless Git requires SSH URLs (git@github.com:...) instead of HTTPS, or a cached credential helper.")
        raise RuntimeError(err_str)

@git_bp.route('remote/add', methods=['POST'])
def api_git_remote_add(ctx):
    repo = ctx.req.json.get('repo')
    url = ctx.req.json.get('url')
    resolution = ctx.req.json.get('resolution')
    if not repo or not url: return jsonify({"error": "Repo and URL required"}), 400

    job_id = ctx.jobs.submit("add_remote_task", repo=repo, remote_url=url, resolution=resolution)
    return jsonify({"status": "accepted", "job_id": job_id}), 202

@git_bp.worker("checkout_task")
def _background_git_checkout(ctx, repo, branch, create_new):
    import subprocess
    import os

    ctx.jobs.update_progress(f"Checking out {branch} in {repo}...")

    repo_path = ctx.resolve_path(repo)
    for c in ctx.config.get("target_repos", []):
        if c.get("repo_dir") == repo and c.get("physical_path"):
            repo_path = os.path.abspath(os.path.expanduser(c.get("physical_path")))
            break

    cmd = ['git', 'checkout', '-b', branch] if create_new else ['git', 'checkout', branch]
    try:
        res = subprocess.run(cmd, cwd=repo_path, check=True, capture_output=True, text=True)
        return res.stdout + res.stderr
    except subprocess.CalledProcessError as e:
        err = e.stderr or e.stdout
        err_str = err.decode('utf-8', errors='replace') if isinstance(err, bytes) else str(err)
        raise RuntimeError(err_str)

@git_bp.route('checkout', methods=['POST'])
def api_git_checkout(ctx):
    repo = ctx.req.json.get('repo')
    branch = ctx.req.json.get('branch')
    create_new = ctx.req.json.get('create_new', False)
    if not repo or not branch: return jsonify({"error": "Repo and branch required"}), 400

    job_id = ctx.jobs.submit("checkout_task", repo=repo, branch=branch, create_new=create_new)
    return jsonify({"status": "accepted", "job_id": job_id}), 202