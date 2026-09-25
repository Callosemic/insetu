from pathlib import Path
import os
import subprocess
import uuid
import json
from typing import TypedDict, Optional
from flask import jsonify
from insetu.core.sdk import InSetuExtension
from akasa.utils import get_workspace_physics
from akasa.hooks import hooks
from insetu.core.utils_core import get_repo_path, execute_binary
def get_headless_git_env():
    """Returns a secure OS environment block pre-configured for non-interactive SSH connections."""
    env = os.environ.copy()
    env["GIT_SSH_COMMAND"] = "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new"
    return env
def execute_git(*args_tuple, **kwargs):
    """Universal Git command wrapper supporting both logical volumes and physical paths."""
    import inspect
    env = get_headless_git_env()

    # Handle overloaded signatures: (ctx, repo, args) vs (repo_path, args)
    if hasattr(args_tuple[0], 'exec'):
        ctx, target, args = args_tuple[0], args_tuple[1], args_tuple[2]
    else:
        target, args = args_tuple[0], args_tuple[1]
        ctx = None
        # Attempt to dynamically resolve ctx from caller to prevent refactoring 60+ calls
        frame = inspect.currentframe().f_back
        while frame:
            if 'ctx' in frame.f_locals:
                ctx = frame.f_locals['ctx']
                break
            frame = frame.f_back
    check = kwargs.pop('check', True)
    cmd = ['git', '--no-optional-locks'] + args

    target_str = str(target)
    if ctx:
        if target_str.startswith('/') or target_str[1:3] == ':\\' or Path(target_str).is_absolute():
            return ctx.exec.run(cmd, cwd=target_str, check=check, env=env, **kwargs)
        else:
            return ctx.exec.run(cmd, volume=target_str, check=check, env=env, **kwargs)
    else:
        # Fallback for purely decoupled physical executions
        kwargs.setdefault('capture_output', True)
        kwargs.setdefault('text', True)
        return execute_binary(cmd, cwd=target_str, check=check, env=env, **kwargs)
GIT_SETTINGS_SCHEMA = [
    {
        "id": "pull_strategy",
        "label": "Pull Strategy",
        "type": "select",
        "scope": "repo",
        "options": [
            {"value": "rebase", "label": "Rebase (--rebase)"},
            {"value": "merge", "label": "Merge (--no-rebase)"},
            {"value": "ff_only", "label": "Fast-Forward Only (--ff-only)"},
            {"value": "runtime", "label": "🤔 Decide at Runtime"}
        ],
        "default": "rebase",
        "description": "Reconciliation strategy for branch divergence inside this repository."
    }
]
git_bp = InSetuExtension('git', __name__, title="Version Control", description="Version control integration, diff generation, and workspace sweeping.", settings_schema=GIT_SETTINGS_SCHEMA)
__depends__ = ['gather']
@hooks.on('request_paths')
def hook_git_request_paths(workspace_id=None, **kwargs):
    from insetu.core.utils_core import get_domain_artifact_path
    return {
        "diffs_dir": get_domain_artifact_path(workspace_id, "diffs", "git")
    }

@hooks.on('workspace_boot')
def mount_git_volumes(workspace_id=None, **kwargs):
    from akasa.vfs import mount_volume
    ctx = git_bp.get_context(workspace_id)
    mount_volume(workspace_id, 'ctx', 'diffs', ctx.paths.get("diffs_dir"))
@hooks.on('register_compilation_steps')
def _register_git_compilation_step(workspace_id=None, **kwargs):
    return [{
        "id": "git_diffs",
        "depends_on": ["gather_base"],
        "ext_name": "git",
        "worker_name": "compile_diffs_task"
    }]
import threading
_DIFF_FILE_CACHE = {}
_DIFF_FILE_CACHE_LOCK = threading.Lock()
@git_bp.worker("compile_diffs_task")
def _background_compile_diffs(ctx, force_full=False, target_repos=None, **kwargs):
    ctx.jobs.update_progress("Evaluating Git diffs...")
    ctx.sync_vfs_barrier()
    manifest = ctx.manifest.get("ctx", {})
    chain_state = kwargs.get('chain_state', {})
    touched_buckets = chain_state.get('touched_buckets')
    _, manifest_deltas, truly_modified_diffs = generate_diff_context(ctx.workspace_id, target_repos=target_repos, manifest_ref=manifest, touched_buckets=touched_buckets)

    from insetu.core.utils_core import BucketAddress
    evaluated_bucket_keys = set(touched_buckets or [])
    for filepath, entry in manifest_deltas.items():
        if entry and isinstance(entry, dict):
            meta = entry.get("meta", {})
            addr = BucketAddress.from_uri(filepath, meta=meta)
            evaluated_bucket_keys.add(addr.key)

    return {
        "message": "Git diffs evaluated successfully.",
        "artifact": {
            "files": list(manifest_deltas.keys()),
            "touched_buckets": list(evaluated_bucket_keys),
            "cleared_buckets": list(evaluated_bucket_keys),
            "touched_diffs": list(truly_modified_diffs),
            "is_full_sweep": force_full is True,
            "state_deltas": {"touched_diffs": list(truly_modified_diffs) if touched_buckets is not None else None}
        }
    }
def generate_diff_context(workspace_id=None, target_repos=None, manifest_ref=None, touched_buckets=None):
    from insetu.core.utils_core import get_safe_repo_id
    from insetu.core.topology.engine_topology import resolve_file_bucket
    import concurrent.futures
    ctx = git_bp.get_context(workspace_id)
    paths = ctx.paths
    live_cfg = ctx.config
    safe_targets = [get_safe_repo_id(r) for r in target_repos] if target_repos else []
    diffs_dir_path = Path(paths["diffs_dir"])
    is_standalone = manifest_ref is None
    working_manifest = manifest_ref if not is_standalone else ctx.manifest.get("ctx", {})
    diff_manifest = []
    manifest_deltas = {}
    truly_modified_diffs = set()

    def process_repo(config):
        local_diff_manifest = []
        local_manifest_deltas = {}
        local_modified_diffs = set()

        if target_repos and config.get("repo_dir") not in target_repos: return None
        if config.get("exclude_from_diffs"): return None
        if config.get("archive_type", "repo") == "media-vault": return None
        safe_r_dir = get_safe_repo_id(config.get("repo_dir"))
        repo_path = Path(get_repo_path(config.get("repo_dir"), ctx.workspace_id))

        if not repo_path.exists(): return None
        try:
            # OPTIMIZATION 1: --no-optional-locks avoids heavy background index refreshes
            result = execute_git(str(repo_path), ['status', '--porcelain', '-uall'], check=False)
            lines = result.stdout.splitlines()
            if not lines: return None

            git_root_res = execute_git(str(repo_path), ['rev-parse', '--show-toplevel'], check=False)
            git_root = Path(git_root_res.stdout.strip()).resolve() if git_root_res.returncode == 0 else repo_path.resolve()
            changed_files = []
            from insetu.core.utils_core import InSetuURI
            for line in lines:
                if len(line) < 3: continue
                status = line[:2]
                filepath = line[3:].strip().strip('"')
                if '->' in filepath: filepath = filepath.split('->')[-1].strip().strip('"')
                if InSetuURI.from_any(filepath).is_diff: continue

                abs_filepath = git_root / filepath
                try:
                    rel_to_repo = abs_filepath.relative_to(repo_path.resolve()).as_posix()
                except ValueError:
                    continue
                if abs_filepath.is_file() or 'D' in status:
                    changed_files.append((rel_to_repo, status, filepath))

            if not changed_files: return None
            sub_buckets = config.get("sub_buckets", [])
            bucketed_files = {}
            bucket_meta = {}
            ignore_dirs = set(live_cfg.get("ignore_dirs", []) + config.get("repo_ignore_dirs", []))
            ignore_patterns = live_cfg.get("ignore_patterns", []) + config.get("repo_ignore_patterns", [])
            if sub_buckets:
                for rel_to_repo, status, orig_filepath in changed_files:
                    if any(pattern in rel_to_repo for pattern in ignore_patterns): continue
                    if set(p.lower() for p in rel_to_repo.split('/')).intersection(ignore_dirs): continue

                    b, module = resolve_file_bucket(rel_to_repo, sub_buckets, repo_dir=config.get('repo_dir'))
                    if b and b.get("exclude_from_diffs"): continue
                    if b and module:
                        b_id = f"ctx://diffs/{module}_diffs.txt"
                        b_title = b.get("meta_map", {}).get(module, {}).get("title", module.replace('_', ' ').title())
                        b_domain = b.get("meta_map", {}).get(module, {}).get("domain", b.get("domain", config.get("domain", "Workspaces")))
                        b_bucket_id = module
                    elif b:
                        b_id = f"ctx://diffs/{safe_r_dir}_{b.get('id', 'bucket')}_diffs.txt"
                        b_title = b.get("title", b.get("id", "bucket").replace('_', ' ').title())
                        b_domain = b.get("domain", config.get("domain", "Workspaces"))
                        b_bucket_id = b.get('id', 'bucket')
                    else:
                        b_id = f"ctx://diffs/{safe_r_dir}_diffs.txt"
                        b_title = config.get("title", safe_r_dir.replace('_', ' ').title())
                        b_domain = config.get("domain", "Workspaces")
                        b_bucket_id = "main"

                    if b_id not in bucketed_files: 
                        bucketed_files[b_id] = []
                        bucket_meta[b_id] = {"title": b_title, "domain": b_domain, "bucket_id": b_bucket_id}
                    bucketed_files[b_id].append((rel_to_repo, status, orig_filepath))
            else:
                out_filename = f"ctx://diffs/{safe_r_dir}_diffs.txt"
                filtered_files = []
                for rel_to_repo, status, orig_filepath in changed_files:
                    if any(pattern in rel_to_repo for pattern in ignore_patterns): continue
                    if set(p.lower() for p in rel_to_repo.split('/')).intersection(ignore_dirs): continue
                    filtered_files.append((rel_to_repo, status, orig_filepath))
                if filtered_files:
                    bucketed_files[out_filename] = filtered_files
                    bucket_meta[out_filename] = {
                        "title": config.get("title", safe_r_dir.replace('_', ' ').title()),
                        "domain": config.get("domain", "Workspaces")
                    }
            for out_filename, files_in_bucket in bucketed_files.items():
                header_lines = []
                header_lines.append(f"============================================================")
                header_lines.append(f">>> DIFF SUMMARY :: {len(files_in_bucket)} FILE(S) CHANGED")
                header_lines.append(f"============================================================")
                for rel_path, f_status, _ in files_in_bucket:
                    header_lines.append(f"[{f_status.ljust(2)}] {rel_path}")
                header_lines.append("\n\n")
                header_str = "\n".join(header_lines)

                # Shadow Cache: Filter out unchanged files based on mtime and size
                stale_files = []
                cached_blocks = {}
                for rel_path, status, orig_filepath in files_in_bucket:
                    abs_filepath = git_root / orig_filepath
                    try:
                        stat = os.stat(abs_filepath)
                        mtime, size = stat.st_mtime, stat.st_size
                    except FileNotFoundError:
                        mtime, size = 0, 0
                    cache_key = (workspace_id, str(abs_filepath))
                    with _DIFF_FILE_CACHE_LOCK:
                        cached = _DIFF_FILE_CACHE.get(cache_key)

                    if cached and cached['mtime'] == mtime and cached['size'] == size and cached['status'] == status:
                        cached_blocks[orig_filepath] = cached['block']
                    else:
                        stale_files.append((rel_path, status, orig_filepath, mtime, size))

                files_to_diff = [orig_f for _, s, orig_f, _, _ in stale_files if s != "??"]
                bulk_diffs = {}
                if files_to_diff:
                    try:
                        # Diff ONLY the stale files to save massive CPU/IO overhead
                        diff_res = execute_git(str(git_root), ['diff', 'HEAD', '--'] + files_to_diff, check=False)
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
                    if orig_filepath in cached_blocks:
                        text_blocks.append(cached_blocks[orig_filepath])
                        continue

                    # Retrieve matching stale file entry to save its metadata
                    stale_entry = next((item for item in stale_files if item[2] == orig_filepath), None)
                    if not stale_entry: continue
                    _, _, _, mtime, size = stale_entry

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
                            content = ctx.vfs.read(f"vfs://{config['repo_dir']}/{rel_path}")
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
                    block_text = "\n".join(block_lines)
                    text_blocks.append(block_text)

                    # Store in the shadow cache with thread-safe capacity eviction
                    cache_key = (workspace_id, str(abs_filepath))
                    with _DIFF_FILE_CACHE_LOCK:
                        if len(_DIFF_FILE_CACHE) > 5000:
                            try:
                                oldest_key = next(iter(_DIFF_FILE_CACHE))
                                _DIFF_FILE_CACHE.pop(oldest_key, None)
                            except StopIteration:
                                pass

                        _DIFF_FILE_CACHE[cache_key] = {
                            'mtime': mtime,
                            'size': size,
                            'status': status,
                            'block': block_text
                        }
                if text_blocks:
                    from insetu.core.gather.engine_gather import compile_context_payload

                    new_content_full = header_str + "".join(text_blocks)
                    existing_content = ""
                    try:
                        # Reconstruct full existing content from all chunks to prevent false positive diffs
                        responses = ctx.emit('resolve_payload_chunks', uri=out_filename, manifest=working_manifest)
                        chunks = next((r for r in responses if r), [out_filename])
                        for c in chunks:
                            chunk_text = ctx.vfs.read(c)
                            if chunk_text:
                                existing_content += chunk_text
                    except Exception:
                        pass
                    if existing_content == new_content_full and out_filename in working_manifest:
                        local_diff_manifest.append({"filename": out_filename, "repo": config['repo_dir']})
                        local_manifest_deltas[out_filename] = working_manifest[out_filename]
                        continue
                    local_modified_diffs.add(out_filename)
                    b_meta = bucket_meta.get(out_filename, {})
                    meta = {
                        "type": "diff",
                        "title": b_meta.get("title", InSetuURI(out_filename).basename.replace('_diffs.txt', '').replace('_', ' ').title()),
                        "domain": b_meta.get("domain", "Git Diffs"),
                        "desc": "Just-In-Time generated diff payload.",
                        "repo": config['repo_dir'],
                        "bucket_id": b_meta.get("bucket_id", "main")
                    }
                    manifest_entry = compile_context_payload(
                        workspace_id, 
                        None, 
                        out_filename, 
                        header_str, 
                        text_blocks, 
                        [f"{config['repo_dir']}/{f}" for f, s, _ in files_in_bucket if 'D' not in s], 
                        meta
                    )
                    local_manifest_deltas[out_filename] = manifest_entry
                    local_diff_manifest.append({"filename": out_filename, "repo": config['repo_dir']})
        except Exception as e:
            print(f"Skipping diff generation for {config.get('repo_dir', 'Unknown')}: {e}")

        return (local_diff_manifest, local_manifest_deltas, local_modified_diffs)

    # OPTIMIZATION 2: ThreadPoolExecutor processes independent repositories in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(process_repo, config) for config in live_cfg.get("target_repos", [])]
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res:
                lm_diff, lm_delta, l_mod = res
                diff_manifest.extend(lm_diff)
                manifest_deltas.update(lm_delta)
                working_manifest.update(lm_delta)
                truly_modified_diffs.update(l_mod)
    from insetu.core.utils_core import reconcile_and_vacuum_domain
    reconcile_and_vacuum_domain(
        ctx,
        domain_uri_prefix="ctx://diffs/",
        manifest_deltas=manifest_deltas,
        domain_dir="ctx://diffs",
        filename_suffix="_diffs.txt",
        target_repos=target_repos
    )
    return diff_manifest, manifest_deltas, truly_modified_diffs
@git_bp.worker("sweep_status_task")
def _background_sweep_status(ctx, **kwargs):
    from insetu.core.topology.engine_topology import topology_bp
    cfg = ctx.config
    results = {}
    ctx.jobs.update_progress("Scanning workspaces for untracked files...")
    ctx.sync_vfs_barrier()

    top_ctx = topology_bp.get_context(ctx.workspace_id)
    for c in cfg.get("target_repos", []):
        repo = c.get("repo_dir")
        repo_path = get_repo_path(repo, ctx.workspace_id)
        if not os.path.exists(repo_path): continue

        try:
            res = execute_git(repo_path, ['status', '--porcelain', '-uall'], check=False)
            lines = res.stdout.splitlines()
            files = []

            # SSOT Elimination of manual OS walking: Fetch tracked paths from Topology Ledger
            top_rows = top_ctx.db.execute("SELECT filepath, bucket_id FROM topology_ledger WHERE repo = ?", (repo,)).fetchall()
            tracked_info = {r['filepath']: r['bucket_id'] for r in top_rows}

            excluded_buckets = set()
            for b in c.get("sub_buckets", []):
                if b.get("exclude_from_diffs"):
                    # Record dynamic modules inside excluded buckets or root bucket IDs
                    excluded_buckets.add(b.get("id"))
                    if b.get("meta_map"):
                        excluded_buckets.update(b["meta_map"].keys())

            repo_excluded = c.get("exclude_from_diffs", False)

            for line in lines:
                if len(line) < 3: continue
                status = line[:2]
                filepath = line[3:]
                if '->' in filepath: filepath = filepath.split('->')[-1].strip()

                full_rel_path = f"{repo}/{filepath}"

                # A file qualifies for the "Sweepable State" tray if it exists in Git but is NOT 
                # in the active topology ledger (i.e. ignored) OR if it is explicitly excluded from diffs
                is_excluded = repo_excluded or (full_rel_path not in tracked_info) or (tracked_info.get(full_rel_path) in excluded_buckets)

                if is_excluded:
                    files.append({"path": filepath, "status": status.strip()})

            if files:
                results[repo] = files
        except Exception:
            pass

    return {"message": "Scan complete.", "artifact": {"repos": results}}
@hooks.on('topology_boot_complete')
def pre_warm_git_sweep(workspace_id=None, **kwargs):
    """Pre-warms the Git sweepable state silently in the background after the topology settles."""
    ctx = git_bp.get_context(workspace_id)
    ctx.jobs.submit_one_shot("sweep_status_task", 5000, job_category="system_background")
class GitSweepStatusPayload(TypedDict, total=False):
    pass

@git_bp.route('sweep/status', methods=['POST'], request_schema=GitSweepStatusPayload, docstring="Scans workspaces for untracked files or metadata ready to be swept into VCS.")
def api_git_sweep_status(ctx):
    """Scans workspaces for untracked files or metadata ready to be swept into VCS."""
    job_id = ctx.jobs.submit("sweep_status_task", coalesce=True, job_category="ui_blocking")
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@git_bp.worker("sweep_push_task")
def _background_sweep_push(ctx, selections, message, **kwargs):
    ctx.sync_vfs_barrier()
    output_log = ""
    has_errors = False

    for repo, files in selections.items():
        if not files: continue
        ctx.jobs.update_progress(f"Pushing {repo}...")

        repo_path = get_repo_path(repo, ctx.workspace_id)
        if not os.path.exists(repo_path): continue

        try:
            # Guarantee topology is perfectly mapped before staging
            from insetu.core.cartographer.cartographer import map_repositories
            map_repositories(ctx.workspace_id)
            execute_git(repo_path, ['add'] + files)

            # Ensure we only commit if there are actually staged files to prevent empty-commit crashes
            status_res = execute_git(repo_path, ['status', '--porcelain'], check=False)
            if status_res.stdout.strip():
                execute_git(repo_path, ['commit', '-m', message])
            try:
                execute_git(repo_path, ['push'])
            except subprocess.CalledProcessError as e:
                err_out = e.stderr or e.stdout
                err_str = err_out.decode('utf-8', errors='replace') if isinstance(err_out, bytes) else str(err_out)

                if "non-fast-forward" in err_str or "fetch first" in err_str or "Updates were rejected" in err_str:
                    output_log += f"⚠️ {repo}: Push rejected (remote changes pending). Please pull first.\n"
                    has_errors = True
                    continue
                elif "has no upstream branch" in err_str or "set-upstream" in err_str or "setUpstream" in err_str:
                    curr_branch = execute_git(repo_path, ['branch', '--show-current'], check=False).stdout.strip()
                    if curr_branch:
                        execute_git(repo_path, ['push', '-u', 'origin', curr_branch])
                    else:
                        raise RuntimeError(f"Cannot set upstream: detached HEAD state.")
                else:
                    raise e
            output_log += f"✅ {repo}: Pushed {len(files)} files.\n"
        except subprocess.CalledProcessError as e:
            err = e.stderr.decode('utf-8', errors='replace') if hasattr(e, 'stderr') and isinstance(e.stderr, bytes) else (getattr(e, 'stderr', None) or str(e))
            output_log += f"❌ {repo} Error: {err}\n"
            has_errors = True

    if has_errors:
        return {"message": output_log.strip() + "\n\n⚠️ Some repositories failed to push. Please check their individual Git Control tabs.", "artifact": {"git_state_mutated": True}}

    return {"message": output_log.strip(), "artifact": {"git_state_mutated": True}}
class GitSweepPushPayload(TypedDict):
    selections: dict
    message: str
@git_bp.route('sweep/push', methods=['POST'], request_schema=GitSweepPushPayload, docstring="Commits and pushes selected untracked/swept files to their respective repositories.")
def api_git_sweep_push(ctx):
    """Commits and pushes selected untracked/swept files to their respective repositories."""
    data = ctx.req.json
    job_id = ctx.jobs.submit(
        "sweep_push_task", 
        selections=data.get('selections', {}), 
        message=data.get('message', 'chore: workspace sweep'),
        job_category="ui_blocking"
    )
    return jsonify({"status": "accepted", "job_id": job_id}), 202
class GitRepoPayload(TypedDict):
    repo: str

@git_bp.route('changelogs', methods=['GET'], request_schema=GitRepoPayload, docstring="Queries the tracking index to populate recent commit/changelog suggestions.")
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
def _background_git_push(ctx, repo, message, diff_file, **kwargs):
    ctx.jobs.update_progress(f"Preparing to push {repo}...")
    ctx.sync_vfs_barrier()
    cfg = ctx.config
    repo_path = get_repo_path(repo, ctx.workspace_id)
    if not os.path.exists(repo_path): 
        raise ValueError("Repo not found")
    files_to_stage = set()
    from insetu.core.topology.engine_topology import resolve_file_bucket
    from insetu.core.utils_core import get_safe_repo_id
    repo_cfg = next((c for c in cfg.get("target_repos", []) if c.get("repo_dir") == repo), None)
    sub_buckets = repo_cfg.get("sub_buckets", []) if repo_cfg else []
    from insetu.core.utils_core import InSetuURI
    safe_r_dir = get_safe_repo_id(repo)
    target_diff_name = InSetuURI(diff_file).basename if diff_file else None
    # SSOT Enforcement: Query the Git tree directly rather than parsing diff artifacts
    status_res = execute_git(repo_path, ['status', '--porcelain', '-uall'], check=False)
    git_root_res = execute_git(str(repo_path), ['rev-parse', '--show-toplevel'], check=False)
    git_root = Path(git_root_res.stdout.strip()).resolve() if git_root_res.returncode == 0 else Path(repo_path).resolve()
    resolved_repo_path = Path(repo_path).resolve()
    for line in status_res.stdout.splitlines():
        if len(line) >= 3:
            filepath = line[3:].strip().strip('"')
            if '->' in filepath: 
                filepath = filepath.split('->')[-1].strip().strip('"')
            if InSetuURI.from_any(filepath).is_diff: continue

            abs_filepath = git_root / filepath
            try:
                rel_to_repo = abs_filepath.relative_to(resolved_repo_path).as_posix()
            except ValueError:
                rel_to_repo = filepath

            if target_diff_name:
                if sub_buckets:
                    b, module = resolve_file_bucket(rel_to_repo, sub_buckets, repo_dir=repo)
                    if b and module:
                        b_id = f"ctx://diffs/{module}_diffs.txt"
                    elif b:
                        b_id = f"ctx://diffs/{safe_r_dir}_{b.get('id', 'bucket')}_diffs.txt"
                    else:
                        b_id = f"ctx://diffs/{safe_r_dir}_diffs.txt"
                else:
                    b_id = f"ctx://diffs/{safe_r_dir}_diffs.txt"

                # Only stage the file if it maps to the exact bucket the user clicked
                if InSetuURI(b_id).basename == target_diff_name:
                    files_to_stage.add(rel_to_repo)
            else:
                # Fallback to sweeping the whole repo if no specific diff bucket was targeted
                files_to_stage.add(rel_to_repo)
    if not files_to_stage:
        raise ValueError("No files found to commit. Working tree is clean.")
    # Pre-flight check: verify a remote actually exists before attempting to push
    remote_check = execute_git(repo_path, ['remote'], check=False)
    if not remote_check.stdout.strip():
        raise ValueError(f"No remote configured for '{repo}'. Please add a remote (e.g., 'git remote add origin <url>') via the terminal first.")
    try:
        from insetu.core.cartographer.cartographer import map_repositories
        map_repositories(ctx.workspace_id)

        ctx.jobs.update_progress(f"Committing and pushing {repo}...")
        execute_git(repo_path, ['add'] + list(files_to_stage))

        committed = False
        status_res = execute_git(repo_path, ['status', '--porcelain'], check=False)
        if status_res.stdout.strip():
            execute_git(repo_path, ['commit', '-m', message])
            committed = True
        try:
            push_res = execute_git(repo_path, ['push'])
            output = push_res.stdout + ("\n" + push_res.stderr if push_res.stderr else "")
        except subprocess.CalledProcessError as e:
            err_out = e.stderr or e.stdout
            err_str = err_out.decode('utf-8', errors='replace') if isinstance(err_out, bytes) else (err_out or str(e))

            if "non-fast-forward" in err_str or "fetch first" in err_str or "Updates were rejected" in err_str:
                raise RuntimeError(f"Push rejected: The remote branch has changes you don't have locally. Please pull first.")
            elif "has no upstream branch" in err_str or "set-upstream" in err_str or "setUpstream" in err_str:
                curr_branch = execute_git(repo_path, ['branch', '--show-current'], check=False).stdout.strip()
                if curr_branch:
                    push_res = execute_git(repo_path, ['push', '-u', 'origin', curr_branch])
                    output = push_res.stdout + ("\n" + push_res.stderr if push_res.stderr else "")
                else:
                    raise RuntimeError("Cannot set upstream: repository is in detached HEAD state.")
            else:
                raise e

        return {"message": output.strip(), "artifact": {"git_state_mutated": True}}
    except subprocess.CalledProcessError as e:
        err_out = e.stderr or e.stdout
        err_out = err_out.decode('utf-8', errors='replace') if isinstance(err_out, bytes) else (err_out or str(e))

        if 'committed' in locals() and committed and hasattr(e, 'cmd') and 'push' in e.cmd:
            raise RuntimeError(f"Local commit succeeded, but pushing to remote failed.\n\nError: {err_out}")
        else:
            raise RuntimeError(err_out)
class GitPushPayload(TypedDict, total=False):
    repo: str
    message: str
    diff_file: Optional[str]
@git_bp.route('push', methods=['POST'], request_schema=GitPushPayload, docstring="Commits and pushes staged changes to the remote repository. Requires 'repo' and commit 'message'.")
def api_git_push(ctx):
    """Commits and pushes staged changes to the remote repository. Requires 'repo' and commit 'message'."""
    data = ctx.req.json
    repo = data.get('repo')
    message = data.get('message')
    if not repo or not message: return jsonify({"error": "Repo and message required"}), 400

    job_id = ctx.jobs.submit(
        "push_task", 
        repo=repo, 
        message=message, 
        diff_file=data.get('diff_file'),
        job_category="ui_blocking"
    )
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@hooks.on('request_available_diffs')
def provide_available_diffs(workspace_id=None, **kwargs):
    """Soft-dependency provider: Supplies expected diffs to the Gather/Flow UI dropdowns."""
    from insetu.core.utils_core import get_available_contexts
    ctx = git_bp.get_context(workspace_id)
    paths = ctx.paths
    # 1. Derive the baseline topology directly from the SSOT using exclusion flags array
    base_contexts = get_available_contexts(workspace_id, exclusion_flags=["exclude_from_diffs", "exclude_from_context"], include_types=["gather"])
    expected_diffs = set()
    from insetu.core.utils_core import InSetuURI
    # 2. Map SOTU contexts to diff payloads seamlessly
    for context_path in base_contexts:
        filename = InSetuURI(context_path).basename
        expected_diffs.add(f"ctx://diffs/{filename.replace('_context.txt', '_diffs.txt')}")
    # 3. Include ad-hoc diffs currently tracked in the manifest
    manifest = ctx.manifest.get("ctx", {})
    for key in manifest.keys():
        if InSetuURI.from_any(key).is_diff:
            expected_diffs.add(key)

    return list(expected_diffs)
@git_bp.route('status', methods=['GET'], docstring="Retrieves the Git working tree status, active branches, and conflict state for all tracked repositories.")
def api_git_status(ctx):
    """Retrieves the Git working tree status, active branches, and conflict state for all tracked repositories."""
    repos_status = {}
    for c in ctx.config.get("target_repos", []):
        repo_dir = c.get("repo_dir")
        if not repo_dir: continue

        repo_path = Path(get_repo_path(repo_dir, ctx.workspace_id))
        if not repo_path.exists(): continue
        try:
            check_git = execute_git(repo_path, ['rev-parse', '--is-inside-work-tree'], check=False)
            if check_git.returncode == 0 and 'true' in check_git.stdout.lower():
                curr_res = execute_git(repo_path, ['branch', '--show-current'], check=False)
                current_branch = curr_res.stdout.strip()
                git_dir = repo_path / '.git'
                pending_operation = None
                if not current_branch:
                    if (git_dir / 'rebase-merge').exists() or (git_dir / 'rebase-apply').exists():
                        try:
                            head_name = (git_dir / 'rebase-merge' / 'head-name').read_text().strip()
                            current_branch = f"REBASING {head_name.replace('refs/heads/', '')}"
                        except Exception:
                            current_branch = "REBASING"
                    elif (git_dir / 'MERGE_HEAD').exists():
                        current_branch = "MERGING"
                    else:
                        current_branch = "DETACHED HEAD"

                if 'REBASING' in current_branch or (git_dir / 'rebase-merge').exists() or (git_dir / 'rebase-apply').exists():
                    pending_operation = "rebase"
                elif 'MERGING' in current_branch or (git_dir / 'MERGE_HEAD').exists():
                    pending_operation = "merge"

                br_res = execute_git(repo_path, ['branch', '--format=%(refname:short)'], check=False)
                branches = [b.strip() for b in br_res.stdout.splitlines() if b.strip()]
                ahead_behind = ""
                try:
                    remote_res = execute_git(repo_path, ['remote', '-v'], check=False)
                    remotes_out = remote_res.stdout.lower()

                    # 1. Verify a remote exists and has an online network protocol
                    has_remote = bool(remotes_out.strip())
                    is_online = any(proto in remotes_out for proto in ['http://', 'https://', 'git@', 'ssh://', 'github.com', 'gitlab.com'])

                    if not has_remote or not is_online:
                        ahead_behind = "☁️ Local Only"
                    else:
                        try:
                            # 2. Compare HEAD against its configured upstream tracking branch
                            ab_res = execute_git(repo_path, ['rev-list', '--left-right', '--count', 'HEAD...@{u}'])
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
                    status_res = execute_git(repo_path, ['status', '--porcelain'], check=False)
                    # Detect unmerged states: DD, AU, UD, UA, DU, AA, UU
                    conflicts = [line[3:] for line in status_res.stdout.splitlines() if len(line) >= 2 and line[:2] in ('DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU')]
                except Exception:
                    conflicts = []
                repos_status[repo_dir] = {"is_git": True, "current": current_branch, "branches": branches, "sync_status": ahead_behind, "conflicts": conflicts, "has_remote": has_remote, "pending_operation": pending_operation}
            else:
                repos_status[repo_dir] = {"is_git": False}
        except Exception:
            repos_status[repo_dir] = {"is_git": False}
    return jsonify({"status": "success", "repos": repos_status})
@git_bp.worker("resolve_state_task")
def _background_resolve_state(ctx, repo, action, **kwargs):
    ctx.jobs.update_progress(f"Executing {action} for {repo}...")
    repo_path = get_repo_path(repo, ctx.workspace_id)
    git_dir = Path(repo_path) / '.git'
    is_rebase = (git_dir / 'rebase-merge').exists() or (git_dir / 'rebase-apply').exists()
    is_merge = (git_dir / 'MERGE_HEAD').exists()

    try:
        if action == "abort":
            if is_rebase:
                execute_git(repo_path, ['rebase', '--abort'])
            elif is_merge:
                execute_git(repo_path, ['merge', '--abort'])
            else:
                raise RuntimeError("No active rebase or merge detected to abort.")
            return {"message": "Operation aborted successfully.", "artifact": {"git_state_mutated": True}}

        elif action == "continue":
            if is_rebase:
                env = get_headless_git_env()
                # GIT_EDITOR=true bypasses the interactive text editor prompt during a headless rebase
                env['GIT_EDITOR'] = 'true'
                ctx.exec.run(['git', '--no-optional-locks', 'rebase', '--continue'], cwd=repo_path, check=True, env=env)
            elif is_merge:
                execute_git(repo_path, ['commit', '--no-edit'])
            else:
                raise RuntimeError("No active rebase or merge detected to continue.")
            return {"message": "Operation continued successfully.", "artifact": {"git_state_mutated": True}}
    except subprocess.CalledProcessError as e:
        err_str = e.stderr.decode('utf-8', errors='replace') if hasattr(e, 'stderr') and isinstance(e.stderr, bytes) else (getattr(e, 'stderr', None) or str(e))
        if not err_str and hasattr(e, 'stdout') and e.stdout:
            err_str = e.stdout.decode('utf-8', errors='replace') if isinstance(e.stdout, bytes) else str(e.stdout)
        raise RuntimeError(f"Git Error: {err_str}")

class GitResolveStatePayload(TypedDict):
    repo: str
    action: str
@git_bp.route('resolve_state', methods=['POST'], request_schema=GitResolveStatePayload, docstring="Continues or aborts an active rebase/merge state.")
def api_git_resolve_state(ctx):
    """Continues or aborts an active rebase/merge state."""
    data = ctx.req.json or {}
    repo = data.get('repo')
    action = data.get('action')
    if not repo or action not in ('continue', 'abort'): return jsonify({"error": "Invalid payload"}), 400

    job_id = ctx.jobs.submit("resolve_state_task", repo=repo, action=action, job_category="ui_blocking")
    return jsonify({"status": "accepted", "job_id": job_id}), 202

@git_bp.worker("init_task")
def _background_git_init(ctx, repo, branch, **kwargs):
    ctx.jobs.update_progress(f"Initializing Git repository for {repo}...")
    repo_path = get_repo_path(repo, ctx.workspace_id)
    try:
        execute_git(repo_path, ['init', '-b', branch])
        return {"message": f"Initialized Git repository on branch '{branch}'.", "artifact": {"git_state_mutated": True}}
    except subprocess.CalledProcessError as e:
        err = e.stderr or e.stdout
        err_str = err.decode('utf-8', errors='replace') if isinstance(err, bytes) else str(err)
        raise RuntimeError(err_str)
class GitInitPayload(TypedDict, total=False):
    repo: str
    branch: Optional[str]
@git_bp.route('init', methods=['POST'], request_schema=GitInitPayload, docstring="Initializes a new Git repository locally on a specified branch.")
def api_git_init(ctx):
    """Initializes a new Git repository locally on a specified branch."""
    repo = ctx.req.json.get('repo')
    branch = ctx.req.json.get('branch', 'main')
    if not repo: return jsonify({"error": "Repo required"}), 400

    job_id = ctx.jobs.submit("init_task", repo=repo, branch=branch, job_category="ui_blocking")
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@git_bp.worker("fetch_preview_task")
def _background_git_fetch_preview(ctx, repo, **kwargs):
    ctx.jobs.update_progress(f"Fetching remote for {repo}...")
    repo_path = get_repo_path(repo, ctx.workspace_id)
    try:
        # Pre-flight check: intercept active rebase indicators
        git_dir = Path(repo_path) / '.git'
        if (git_dir / 'rebase-merge').exists() or (git_dir / 'rebase-apply').exists():
            raise RuntimeError(f"Active rebase in progress for '{repo}'. Please resolve conflicts and run 'git rebase --continue' or 'git rebase --abort' in the terminal before pulling.")
        # Pre-flight check: verify a remote actually exists
        remote_check = execute_git(repo_path, ['remote'], check=False)
        if not remote_check.stdout.strip():
            raise RuntimeError(f"No remote configured for '{repo}'. Please add a remote (e.g., 'git remote add origin <url>') via the terminal first.")

        # Fetch and prune dead tracking branches to prevent ghost upstream checks
        execute_git(repo_path, ['fetch', '--prune'], timeout=30)
        # Check if an upstream branch is actually configured
        up_res = execute_git(repo_path, ['rev-parse', '--verify', '@{u}'], check=False)
        if up_res.returncode != 0:
            curr_branch = execute_git(repo_path, ['branch', '--show-current'], check=False).stdout.strip()
            if curr_branch:
                err_msg = f"No upstream tracking branch configured for '{curr_branch}'.\nPlease run this in your terminal:\n\ngit branch --set-upstream-to=origin/{curr_branch} {curr_branch}"
            else:
                err_msg = "You are in a detached HEAD state. Cannot pull."
            raise RuntimeError(err_msg)

        # Gather the incoming commits and file statistics using the robust branch reference name
        curr_branch = execute_git(repo_path, ['branch', '--show-current'], check=False).stdout.strip()
        remote_target = f"origin/{curr_branch}" if curr_branch else "@{u}"

        log_res = execute_git(repo_path, ['log', f'HEAD..{remote_target}', '--oneline'], check=False)
        stat_res = execute_git(repo_path, ['diff', '--stat', f'HEAD..{remote_target}'], check=False)

        incoming_log = log_res.stdout.strip()
        if not incoming_log:
            # Fallback to an outright verification if git tracking is desynced but upstream reports commits
            ab_res = execute_git(repo_path, ['rev-list', '--left-right', '--count', 'HEAD...@{u}'], check=False)
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
        if "non-fast-forward" in err_str or "fetch first" in err_str or "Updates were rejected" in err_str:
            raise RuntimeError("Push rejected (non-fast-forward): The remote branch contains work you do not have locally. Please pull and merge.")
        raise RuntimeError(err_str)
@git_bp.route('fetch_preview', methods=['POST'], request_schema=GitRepoPayload, docstring="Fetches the remote repository and previews incoming commits and changes without pulling.")
def api_git_fetch_preview(ctx):
    """Fetches the remote repository and previews incoming commits and changes without pulling."""
    repo = ctx.req.json.get('repo')
    if not repo: return jsonify({"error": "Repo required"}), 400
    job_id = ctx.jobs.submit("fetch_preview_task", repo=repo, job_category="ui_blocking")
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@git_bp.worker("pull_task")
def _background_git_pull(ctx, repo, strategy=None, **kwargs):
    ctx.jobs.update_progress(f"Pulling {repo}...")
    repo_path = get_repo_path(repo, ctx.workspace_id)

    # Query the repository-scoped setting from the strict 3-tier cascade
    configured_strategy = ctx.settings.get("pull_strategy", "rebase", repo=repo)

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
    git_dir = Path(repo_path) / '.git'
    if (git_dir / 'rebase-merge').exists() or (git_dir / 'rebase-apply').exists():
        raise RuntimeError(f"Active rebase in progress for '{repo}'. Please resolve conflicts and run 'git rebase --continue' or 'git rebase --abort' in the terminal before pulling.")

    curr_branch = execute_git(repo_path, ['branch', '--show-current'], check=False).stdout.strip()
    remote = execute_git(repo_path, ['config', f'branch.{curr_branch}.remote'], check=False).stdout.strip() or 'origin'
    merge = execute_git(repo_path, ['config', f'branch.{curr_branch}.merge'], check=False).stdout.strip()
    remote_branch = merge.replace('refs/heads/', '') if merge.startswith('refs/heads/') else curr_branch
    args = ['pull', '--autostash']
    if strategy == "rebase": args.append('--rebase')
    elif strategy == "merge": args.append('--no-rebase')
    elif strategy == "ff_only": args.append('--ff-only')

    # Explicitly target the remote and branch to prevent ambiguous configuration failures
    if remote and remote_branch:
        args.extend([remote, remote_branch])

    try:
        # Enforce a strict 30-second circuit breaker to prevent zombie network deadlocks
        res = execute_git(repo_path, args, timeout=30)
        # Combine stdout and stderr to capture fetch logs and rebase outputs
        output = res.stdout.strip() + "\n" + res.stderr.strip()
        return {"message": output.strip(), "artifact": {"git_state_mutated": True}}
    except subprocess.CalledProcessError as e:
        err = e.stderr or e.stdout
        err_str = err.decode('utf-8', errors='replace') if isinstance(err, bytes) else str(err)
        raise RuntimeError(err_str)
class GitPullPayload(TypedDict, total=False):
    repo: str
    strategy: Optional[str]
@git_bp.route('pull', methods=['POST'], request_schema=GitPullPayload, docstring="Pulls incoming changes from the remote repository using the specified strategy (rebase, merge, ff_only).")
def api_git_pull(ctx):
    """Pulls incoming changes from the remote repository using the specified strategy (rebase, merge, ff_only)."""
    data = ctx.req.json or {}
    repo = data.get('repo')
    strategy = data.get('strategy')
    if not repo: return jsonify({"error": "Repo required"}), 400
    job_id = ctx.jobs.submit("pull_task", repo=repo, strategy=strategy, job_category="ui_blocking")
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@git_bp.worker("add_remote_task")
def _background_git_add_remote(ctx, repo, remote_url, resolution=None, **kwargs):
    ctx.jobs.update_progress(f"Adding remote origin for {repo}...")
    repo_path = get_repo_path(repo, ctx.workspace_id)
    try:
        # Ensure HEAD exists by creating an empty initial commit if the repo is completely empty
        head_check = execute_git(repo_path, ['rev-parse', 'HEAD'], check=False)
        if head_check.returncode != 0:
            ctx.jobs.update_progress("Creating initial commit to establish HEAD...")
            execute_git(repo_path, ['commit', '--allow-empty', '-m', 'chore: initial commit'])
        # Check if origin already exists to handle retries gracefully
        check_remote = execute_git(repo_path, ['remote'], check=False)
        if 'origin' in check_remote.stdout.split():
            execute_git(repo_path, ['remote', 'set-url', 'origin', remote_url])
        else:
            execute_git(repo_path, ['remote', 'add', 'origin', remote_url])
        curr_branch = execute_git(repo_path, ['branch', '--show-current'], check=False).stdout.strip() or 'main'

        if resolution == "force":
            ctx.jobs.update_progress("Force pushing to overwrite remote...")
            push_res = execute_git(repo_path, ['push', '-u', 'origin', curr_branch, '--force'])
            return push_res.stdout + push_res.stderr
        elif resolution == "pull":
            ctx.jobs.update_progress("Pulling and merging unrelated histories...")
            # Fetch first, then merge allowing unrelated histories
            execute_git(repo_path, ['pull', 'origin', curr_branch, '--allow-unrelated-histories', '--no-edit', '--no-rebase'], timeout=30)

            ctx.jobs.update_progress("Pushing merged history to remote...")
            push_res = execute_git(repo_path, ['push', '-u', 'origin', curr_branch])
            return push_res.stdout + push_res.stderr
        else:
            # Standard push
            ctx.jobs.update_progress("Pushing initial commit to remote...")
            push_res = execute_git(repo_path, ['push', '-u', 'origin', curr_branch])
            return push_res.stdout + push_res.stderr

    except subprocess.CalledProcessError as e:
        err = e.stderr or e.stdout
        err_str = err.decode('utf-8', errors='replace') if isinstance(err, bytes) else str(err)
        if "could not read Username" in err_str or "No such device" in err_str:
            raise RuntimeError("Authentication failed. Headless Git requires SSH URLs (git@github.com:...) instead of HTTPS, or a cached credential helper.")
        raise RuntimeError(err_str)
class GitRemoteAddPayload(TypedDict, total=False):
    repo: str
    url: str
    resolution: Optional[str]
@git_bp.route('remote/add', methods=['POST'], request_schema=GitRemoteAddPayload, docstring="Connects a local repository to a remote Git URL and pushes.")
def api_git_remote_add(ctx):
    """Connects a local repository to a remote Git URL and pushes."""
    repo = ctx.req.json.get('repo')
    url = ctx.req.json.get('url')
    resolution = ctx.req.json.get('resolution')
    if not repo or not url: return jsonify({"error": "Repo and URL required"}), 400

    job_id = ctx.jobs.submit("add_remote_task", repo=repo, remote_url=url, resolution=resolution, job_category="ui_blocking")
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@git_bp.worker("checkout_task")
def _background_git_checkout(ctx, repo, branch, create_new, **kwargs):
    ctx.jobs.update_progress(f"Checking out {branch} in {repo}...")
    repo_path = get_repo_path(repo, ctx.workspace_id)
    args = ['checkout', '-b', branch] if create_new else ['checkout', branch]
    try:
        res = execute_git(repo_path, args)
        return {"message": (res.stdout + res.stderr).strip(), "artifact": {"git_state_mutated": True}}
    except subprocess.CalledProcessError as e:
        err = e.stderr or e.stdout
        err_str = err.decode('utf-8', errors='replace') if isinstance(err, bytes) else str(err)
        raise RuntimeError(err_str)
class GitCheckoutPayload(TypedDict, total=False):
    repo: str
    branch: str
    create_new: Optional[bool]
@git_bp.route('checkout', methods=['POST'], request_schema=GitCheckoutPayload, docstring="Checks out an existing branch or creates a new one.")
def api_git_checkout(ctx):
    """Checks out an existing branch or creates a new one."""
    repo = ctx.req.json.get('repo')
    branch = ctx.req.json.get('branch')
    create_new = ctx.req.json.get('create_new', False)
    if not repo or not branch: return jsonify({"error": "Repo and branch required"}), 400

    job_id = ctx.jobs.submit("checkout_task", repo=repo, branch=branch, create_new=create_new, job_category="ui_blocking")
    return jsonify({"status": "accepted", "job_id": job_id}), 202