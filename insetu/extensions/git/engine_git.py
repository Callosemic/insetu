from pathlib import Path
import os
import subprocess
import uuid
import json
from flask import jsonify
from insetu.core.sdk import InSetuExtension
from insetu.kernel.utils import get_workspace_physics
from insetu.kernel.hooks import hooks

def get_headless_git_env():
    """Returns a secure OS environment block pre-configured for non-interactive SSH connections."""
    import os
    env = os.environ.copy()
    env["GIT_SSH_COMMAND"] = "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new"
    return env
def get_git_settings_schema(workspace_id):
    """Dynamically generates distinct setting configuration slots for every tracked repository."""
    from insetu.core.sdk import ExtensionContext
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
__depends__ = ['gather']
@hooks.on('request_paths')
def hook_git_request_paths(workspace_id=None, **kwargs):
    try:
        from pathlib import Path
        import os
        from insetu.kernel.utils import get_workspace_physics
        cfg_path, _, _ = get_workspace_physics(workspace_id)
        artifacts_base = Path(cfg_path).parent.joinpath("data").as_posix()
        paths = {
            "diffs_dir": Path(artifacts_base).joinpath("diffs").as_posix()
        }
        os.makedirs(paths["diffs_dir"], exist_ok=True)
        return paths
    except Exception: 
        return {}
@hooks.on('vfs_resolve_file')
def resolve_git_artifacts(filename=None, workspace_id=None, **kwargs):
    """Resolves ctx://diffs URIs and fallback searches for git diffs."""
    if not filename: return None
    from insetu.core.sdk import ExtensionContext
    from pathlib import Path
    import os
    ctx = ExtensionContext('git', workspace_id)

    safe_basename = Path(filename).name
    cand = Path(ctx.paths["diffs_dir"]).joinpath(safe_basename).as_posix()
    if os.path.exists(cand):
        return cand, True
    return None
@hooks.on('register_compilation_steps')
def _register_git_compilation_step(workspace_id=None, **kwargs):
    return [{
        "id": "git_diffs",
        "depends_on": ["gather_base"],
        "ext_name": "git",
        "worker_name": "compile_diffs_task"
    }]

@git_bp.worker("compile_diffs_task")
def _background_compile_diffs(ctx, force_full=False, target_repos=None, **kwargs):
    ctx.jobs.update_progress("Evaluating Git diffs...")
    manifest = ctx.manifest

    if isinstance(force_full, list):
        target_repos = force_full

    generate_diff_context(ctx.workspace_id, target_repos=target_repos, manifest_ref=manifest)

    return {"message": "Git diffs evaluated successfully."}
def generate_diff_context(workspace_id=None, target_repos=None, manifest_ref=None, touched_buckets=None):
    from insetu.core.sdk import ExtensionContext
    from insetu.core.utils_core import get_safe_repo_id
    from insetu.core.topology.engine_topology import resolve_file_bucket
    import concurrent.futures

    ctx = ExtensionContext('git', workspace_id)
    paths = ctx.paths
    _, ws_root, _ = ctx.config.get("workspace_physics", (None, ctx.paths["workspace_root"], None))
    live_cfg = ctx.config
    safe_targets = [get_safe_repo_id(r) for r in target_repos] if target_repos else []
    diffs_dir_path = Path(paths["diffs_dir"])
    is_standalone = manifest_ref is None
    working_manifest = manifest_ref if not is_standalone else ctx.manifest
    diff_manifest = []
    manifest_deltas = {}
    active_generated_diffs = set()
    ws_root_path = Path(ws_root).resolve()

    touched_diff_buckets = set(b.replace('_context.txt', '_diffs.txt') for b in touched_buckets) if touched_buckets is not None else None

    def process_repo(config):
        local_diff_manifest = []
        local_manifest_deltas = {}
        local_active_diffs = set()

        if target_repos and config.get("repo_dir") not in target_repos: return None
        if config.get("exclude_from_diffs"): return None
        if config.get("archive_type", "repo") == "media-vault": return None

        safe_r_dir = get_safe_repo_id(config.get("repo_dir"))
        physical_path = config.get("physical_path")

        if physical_path:
            repo_path = Path(physical_path).expanduser().resolve()
        else:
            repo_path = (ws_root_path / config["repo_dir"]).resolve()
        if not repo_path.exists(): return None

        try:
            # OPTIMIZATION 1: --no-optional-locks avoids heavy background index refreshes
            result = subprocess.run(['git', '--no-optional-locks', 'status', '--porcelain', '-uall'], capture_output=True, text=True, cwd=str(repo_path))
            lines = result.stdout.splitlines()
            if not lines: return None

            git_root_res = subprocess.run(['git', '--no-optional-locks', 'rev-parse', '--show-toplevel'], capture_output=True, text=True, cwd=str(repo_path))
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

                    b, module = resolve_file_bucket(rel_to_repo, sub_buckets)
                    if b and b.get("exclude_from_diffs"): continue

                    if b and module:
                        b_id = f"{module}_diffs.txt"
                        b_title = b.get("meta_map", {}).get(module, {}).get("title", module.replace('_', ' ').title())
                        b_domain = b.get("meta_map", {}).get(module, {}).get("domain", b.get("domain", config.get("domain", "Workspaces")))
                    elif b:
                        b_id = b.get("out_file", f"{safe_r_dir}_{b.get('id', 'bucket')}_context.txt").replace("_context.txt", "_diffs.txt")
                        b_title = b.get("title", b.get("id", "bucket").replace('_', ' ').title())
                        b_domain = b.get("domain", config.get("domain", "Workspaces"))
                    else:
                        b_id = config.get("out_file", f"{safe_r_dir}_context.txt").replace("_context.txt", "_diffs.txt")
                        b_title = config.get("title", safe_r_dir.replace('_', ' ').title())
                        b_domain = config.get("domain", "Workspaces")

                    if b_id not in bucketed_files: 
                        bucketed_files[b_id] = []
                        bucket_meta[b_id] = {"title": b_title, "domain": b_domain}
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
                    bucket_meta[out_filename] = {
                        "title": config.get("title", safe_r_dir.replace('_', ' ').title()),
                        "domain": config.get("domain", "Workspaces")
                    }

            for out_filename, files_in_bucket in bucketed_files.items():
                if touched_diff_buckets is not None and out_filename not in touched_diff_buckets:
                    continue

                header_lines = []
                header_lines.append(f"============================================================")
                header_lines.append(f">>> DIFF SUMMARY :: {len(files_in_bucket)} FILE(S) CHANGED")
                header_lines.append(f"============================================================")
                for rel_path, f_status, _ in files_in_bucket:
                    header_lines.append(f"[{f_status.ljust(2)}] {rel_path}")
                header_lines.append("\n\n")
                header_str = "\n".join(header_lines)

                files_to_diff = [orig_f for _, s, orig_f in files_in_bucket if s != "??"]
                bulk_diffs = {}
                if files_to_diff:
                    try:
                        diff_res = subprocess.run(['git', '--no-optional-locks', 'diff', 'HEAD', '--'] + files_to_diff, capture_output=True, text=True, cwd=str(git_root))
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

                    new_content_full = header_str + "".join(text_blocks)
                    existing_content = ""
                    try:
                        # Reconstruct full existing content from all chunks to prevent false positive diffs
                        responses = ctx.emit('resolve_payload_chunks', uri=f"ctx://diffs/{out_filename}")
                        chunks = next((r for r in responses if r), [f"ctx://diffs/{out_filename}"])
                        for c in chunks:
                            chunk_text = ctx.vfs.read(c, is_absolute_artifact=True)
                            if chunk_text:
                                existing_content += chunk_text
                    except Exception:
                        pass

                    if existing_content == new_content_full and out_filename in working_manifest:
                        local_diff_manifest.append({"filename": out_filename, "repo": config['repo_dir']})
                        local_active_diffs.add(out_filename)
                        continue
                    b_meta = bucket_meta.get(out_filename, {})
                    meta = {
                        "type": "diff",
                        "title": b_meta.get("title", out_filename.replace('_diffs.txt', '').replace('_', ' ').title()),
                        "domain": b_meta.get("domain", "Git Diffs"),
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
                    local_manifest_deltas[out_filename] = manifest_entry
                    local_diff_manifest.append({"filename": out_filename, "repo": config['repo_dir']})
                    local_active_diffs.add(out_filename)
        except Exception as e:
            print(f"Skipping diff generation for {config.get('repo_dir', 'Unknown')}: {e}")

        return (local_diff_manifest, local_manifest_deltas, local_active_diffs)

    # OPTIMIZATION 2: ThreadPoolExecutor processes independent repositories in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(process_repo, config) for config in live_cfg.get("target_repos", [])]
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res:
                lm_diff, lm_delta, l_active = res
                diff_manifest.extend(lm_diff)
                manifest_deltas.update(lm_delta)
                working_manifest.update(lm_delta)
                active_generated_diffs.update(l_active)
    # Git Vacuum & Manifest Cleanup
    expected_diff_artifacts = active_generated_diffs.copy()
    for k, v in list(working_manifest.items()):
        if k.endswith('_diffs.txt'):
            repo = v.get("meta", {}).get("repo")
            if (target_repos is None or repo in target_repos) and k not in active_generated_diffs:
                manifest_deltas[k] = None

    if os.path.exists(diffs_dir_path.as_posix()):
        for ws_rel_path in ctx.vfs.walk(diffs_dir_path.as_posix(), exts=['.txt']):
            f_basename = Path(ctx.resolve_path(ws_rel_path)).name

            is_target_repo_file = False
            if target_repos is None:
                is_target_repo_file = True
            else:
                for tr in safe_targets:
                    if f_basename.startswith(f"{tr}_"):
                        is_target_repo_file = True
                        break

            if is_target_repo_file and f_basename not in expected_diff_artifacts:
                try:
                    ctx.vfs.save(ws_rel_path, "", data={"action": "delete"})
                except Exception:
                    pass

    # Always save manifest deltas to ensure downstream consumers (like Flow) read accurate chunks from the DB
    if manifest_deltas:
        for k, v in manifest_deltas.items():
            if v is None:
                working_manifest.pop(k, None)
            else:
                working_manifest[k] = v
        ctx.save_manifest(manifest_deltas, is_full_compile=False)
    elif is_standalone:
        ctx.save_manifest(working_manifest, is_full_compile=False)

    # VFS BARRIER: Block until the asynchronous write queue physically flushes diffs to the SSD
    ctx.sync_vfs_barrier()

    return diff_manifest, manifest_deltas
@git_bp.worker("sweep_status_task")
def _background_sweep_status(ctx):
    from insetu.kernel.utils import get_workspace_physics
    from insetu.core.sdk import ExtensionContext
    cfg = ctx.config
    _, ws_root, _ = get_workspace_physics(ctx.workspace_id)
    results = {}
    ctx.jobs.update_progress("Scanning workspaces for untracked files...")

    top_ctx = ExtensionContext('topology', ctx.workspace_id)

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

@git_bp.route('sweep/status', methods=['POST'])
def api_git_sweep_status(ctx):
    job_id = ctx.jobs.submit("sweep_status_task")
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@git_bp.worker("sweep_push_task")
def _background_sweep_push(ctx, selections, message):
    import os
    import subprocess
    from insetu.kernel.utils import get_workspace_physics
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
    from insetu.kernel.utils import get_workspace_physics

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
    from insetu.core.topology.engine_topology import resolve_file_bucket
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
    from insetu.core.sdk import ExtensionContext
    from insetu.core.utils_core import get_available_contexts
    import os
    ctx = ExtensionContext('git', workspace_id)
    paths = ctx.paths
    # 1. Derive the baseline topology directly from the SSOT using exclusion flags array
    base_contexts = get_available_contexts(workspace_id, exclusion_flags=["exclude_from_diffs", "exclude_from_context"], include_types=["gather"])
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
    repo_path = ctx.get_repo_path(repo)

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
    repo_path = ctx.get_repo_path(repo)
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
    repo_path = ctx.get_repo_path(repo)

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
    repo_path = ctx.get_repo_path(repo)
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
    repo_path = ctx.get_repo_path(repo)

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