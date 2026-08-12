import time
import uuid
import json
from pathlib import Path
from insetu.kernel.extension import InSetuExtension, ExtensionContext
from insetu.kernel.hooks import hooks
from insetu.kernel.workers import submit_immediate_job, register_callback

TOPOLOGY_SCHEMA = {
    "topology_ledger": {
        "filepath": "TEXT PRIMARY KEY",
        "repo": "TEXT",
        "bucket_id": "TEXT",
        "is_tracked": "INTEGER DEFAULT 1",
        "timestamp": "REAL"
    },
    "topology_event_buffer": {
        "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
        "filepath": "TEXT",
        "mutation_type": "TEXT",
        "timestamp": "REAL"
    }
}
topology_bp = InSetuExtension(
    'topology', 
    __name__, 
    title="Topology Engine", 
    description="Single Source of Truth (SSOT) for workspace file mapping and structural bucket routing.",
    schema=TOPOLOGY_SCHEMA,
    core=True
)
__depends__ = []
@hooks.on('register_manifest_signatures')
def hook_topology_manifest_signatures(workspace_id=None, since_ts=0.0, **kwargs):
    """Yields lightweight repository signatures for the vfs domain."""
    resolve_topology_buffer(workspace_id)
    ctx = topology_bp.get_context(workspace_id)
    rows = ctx.db.execute("SELECT repo, count(*) as cnt, max(timestamp) as max_ts FROM topology_ledger GROUP BY repo").fetchall()
    vfs_sigs = {}
    for r in rows:
        repo = r['repo']
        vfs_sigs[repo] = f"{r['cnt']}-{r['max_ts']}"
    return {"vfs": vfs_sigs}

@topology_bp.route('vfs', methods=['GET'])
def api_topology_vfs_repo(ctx):
    """Surgically fetches the VFS bucket structure for a specific repository."""
    resolve_topology_buffer(ctx.workspace_id)
    repo = ctx.req.args.get('repo', '').strip()
    conn = ctx.db
    if repo:
        rows = conn.execute("SELECT filepath, bucket_id FROM topology_ledger WHERE repo=?", (repo,)).fetchall()
    else:
        rows = conn.execute("SELECT filepath, repo, bucket_id FROM topology_ledger").fetchall()

    files_by_bucket = {}
    for r in rows:
        r_name = repo or r['repo']
        b_id = r['bucket_id']
        key = f"{r_name}::{b_id}"
        if key not in files_by_bucket:
            files_by_bucket[key] = {"files": [], "meta": {"type": "vfs_bucket", "repo": r_name, "bucket_id": b_id}}
        files_by_bucket[key]["files"].append(r['filepath'])
    return jsonify({"repo": repo, "buckets": files_by_bucket})
@hooks.on('force_topology_scan', priority=10)
def force_topology_scan(workspace_id=None, target_repos=None, **kwargs):
    """Synchronously forces a full physical disk walk to rebuild the Topology Ledger."""
    ctx = topology_bp.get_context(workspace_id)
    conn = ctx.db

    target_configs = ctx.config.get("target_repos", [])
    if target_repos:
        target_configs = [c for c in target_configs if c.get("repo_dir") in target_repos]

    _, ws_root, _ = ctx.config.get("workspace_physics", (None, ctx.paths["workspace_root"], None))

    for repo_cfg in target_configs:
        repo_dir = repo_cfg.get("repo_dir")
        if not repo_dir: continue

        physical_path = repo_cfg.get("physical_path")
        repo_path = Path(physical_path).expanduser().resolve() if physical_path else Path(ws_root) / repo_dir

        valid_files = get_valid_workspace_files(repo_path.as_posix(), repo_cfg, workspace_id)
        sub_buckets = repo_cfg.get("sub_buckets", [])

        conn.execute("DELETE FROM topology_ledger WHERE repo = ?", (repo_dir,))

        for f in valid_files:
            b, module = resolve_file_bucket(f, sub_buckets, repo_dir=repo_dir)
            bucket_id = module if (b and module) else (b.get("id") if b else "default_catch_all")
            filepath = f"{repo_dir}/{f}"
            conn.execute(
                "INSERT OR REPLACE INTO topology_ledger (filepath, repo, bucket_id, timestamp) VALUES (?, ?, ?, ?)",
                (filepath, repo_dir, bucket_id, time.time())
            )
    conn.commit()
    return True
@hooks.on('request_vfs_manifest')
def hook_request_vfs_manifest(workspace_id=None, **kwargs):
    """Returns the vfs manifest derived directly from the topology ledger."""
    resolve_topology_buffer(workspace_id)
    ctx = topology_bp.get_context(workspace_id)
    rows = ctx.db.get_all("topology_ledger")

    manifest = {}
    for r in rows:
        repo = r['repo']
        bucket_id = r['bucket_id']
        manifest_key = f"{repo}::{bucket_id}"
        if manifest_key not in manifest:
            manifest[manifest_key] = {"files": [], "meta": {"type": "vfs_bucket", "repo": repo, "bucket_id": bucket_id}}
        manifest[manifest_key]["files"].append(r['filepath'])

    return manifest
def get_omniscient_workspace_files(workspace_id, allowed_repos):
    """Fast SQL replacement for the old os.walk bridge optimization."""
    resolve_topology_buffer(workspace_id)
    ctx = topology_bp.get_context(workspace_id)
    if not allowed_repos: return []
    placeholders = ','.join(['?'] * len(allowed_repos))
    rows = ctx.db.execute(f"SELECT filepath FROM topology_ledger WHERE repo IN ({placeholders})", tuple(allowed_repos)).fetchall()
    return [(Path(r['filepath']).name, r['filepath']) for r in rows]

def get_topology_files_for_repo(workspace_id, repo_dir, strip_prefix=True):
    """SSOT accessor to retrieve ledger paths and format them cleanly for downstream modules."""
    resolve_topology_buffer(workspace_id)
    ctx = topology_bp.get_context(workspace_id)
    rows = ctx.db.execute("SELECT filepath FROM topology_ledger WHERE repo = ?", (repo_dir,)).fetchall()

    result = []
    for r in rows:
        fp = r['filepath']
        if strip_prefix and fp.startswith(f"{repo_dir}/"):
            result.append(fp[len(repo_dir)+1:])
        else:
            result.append(fp)
    return result
@hooks.on('vfs_mutated', priority=10)
def buffer_topology_events(mutations=None, workspace_id=None, **kwargs):
    """
    Stage 1 Slew Limiter: Catches high-velocity disk/watchdog mutations 
    and buffers them to absorb the I/O storm.
    """
    if not mutations: return

    ctx = topology_bp.get_context(workspace_id)
    conn = ctx.db
    now = time.time()
    buffered_count = 0

    for m in mutations:
        if m.get("ignore_ledger"):
            continue

        filepath = m.get("filepath")
        if not filepath:
            continue

        # Gatekeeper: Filter out internal system artifacts and VFS context streams
        norm_path = filepath.replace('\\', '/')
        if norm_path.startswith("ctx://") or "/data/contexts/" in norm_path or "/data/diffs/" in norm_path or "/data/workflows/" in norm_path or ".insetu/data/" in norm_path:
            continue

        op = m.get("operation")
        conn.execute(
            "INSERT INTO topology_event_buffer (filepath, mutation_type, timestamp) VALUES (?, ?, ?)",
            (filepath, op, now)
        )
        buffered_count += 1

    if buffered_count == 0:
        return

    conn.commit()

    # Dispatch the resolution worker. The `coalesce=True` flag ensures that if a storm 
    # of mutations arrives within the debounce window, they attach to the existing job.
    job_id = f"tpl_{uuid.uuid4().hex[:8]}"
    submit_immediate_job(job_id, "topology", "resolve_topology_task", "{}", workspace_id=workspace_id, coalesce=True)
def resolve_topology_buffer(workspace_id):
    """Processes any pending events in topology_event_buffer, updates topology_ledger, and emits topology_resolved."""
    ctx = topology_bp.get_context(workspace_id)
    conn = ctx.db

    events = conn.execute("SELECT filepath, mutation_type FROM topology_event_buffer ORDER BY timestamp ASC").fetchall()
    if not events:
        return []

    conn.execute("DELETE FROM topology_event_buffer")

    dirty_buckets = set()
    dirty_repos = set()
    target_repos = ctx.config.get("target_repos", [])

    for e in events:
        filepath = e["filepath"]
        op = e["mutation_type"]
        repo_dir = filepath.split('/')[0] if '/' in filepath else "global"
        dirty_repos.add(repo_dir)
        if op == "delete":
            conn.execute("DELETE FROM topology_ledger WHERE filepath = ?", (filepath,))
        else:
            repo_cfg = next((r for r in target_repos if r.get("repo_dir") == repo_dir), None)

            is_ignored = False
            rel_to_repo = filepath[len(repo_dir)+1:] if filepath.startswith(f"{repo_dir}/") else filepath

            if repo_cfg:
                live_cfg = ctx.config
                ignore_dirs = set(live_cfg.get("ignore_dirs", [])).union(repo_cfg.get("repo_ignore_dirs", []))
                ignore_files = set(live_cfg.get("ignore_files", [])).union(repo_cfg.get("repo_ignore_files", []))
                ignore_patterns = live_cfg.get("ignore_patterns", []) + repo_cfg.get("repo_ignore_patterns", [])

                filename = Path(filepath).name.lower()

                if filename in ignore_files:
                    is_ignored = True
                elif any(pattern in rel_to_repo for pattern in ignore_patterns):
                    is_ignored = True
                elif set(p.lower() for p in rel_to_repo.split('/')).intersection(ignore_dirs):
                    is_ignored = True

            if is_ignored:
                continue

            sub_buckets = repo_cfg.get("sub_buckets", []) if repo_cfg else []
            b, module = resolve_file_bucket(rel_to_repo, sub_buckets, repo_dir=repo_dir)

            if b and module:
                bucket_id = module
            elif b:
                bucket_id = b.get("id") or "main"
            else:
                bucket_id = "default_catch_all"

            conn.execute(
                "INSERT OR REPLACE INTO topology_ledger (filepath, repo, bucket_id, timestamp) VALUES (?, ?, ?, ?)",
                (filepath, repo_dir, bucket_id, time.time())
            )
            dirty_buckets.add(f"{repo_dir}::{bucket_id}")

    conn.commit()

    event_dicts = [dict(e) for e in events]
    hooks.emit(
        'topology_resolved', 
        workspace_id=workspace_id, 
        dirty_repos=list(dirty_repos), 
        dirty_buckets=list(dirty_buckets), 
        events=event_dicts
    )

    return event_dicts
@hooks.on('workspace_boot')
def init_topology_on_boot(workspace_id=None, **kwargs):
    """Topology owns the boot sequence. Maps the drive immediately."""
    job_id = f"tpl_boot_{uuid.uuid4().hex[:8]}"
    submit_immediate_job(job_id, "topology", "boot_scan_task", "{}", workspace_id=workspace_id)

@topology_bp.worker("boot_scan_task")
def _background_boot_scan(ctx, job_id=None, **kwargs):
    ctx.jobs.update_progress("Initializing workspace topology...")
    force_topology_scan(workspace_id=ctx.workspace_id)
    from insetu.kernel.hooks import hooks
    hooks.emit_background('topology_boot_complete', workspace_id=ctx.workspace_id)

@topology_bp.worker("resolve_topology_task")
def _background_resolve_topology(ctx, job_id=None, **kwargs):
    """
    Processes the event buffer after physical disk I/O settles, updates the tracking 
    ledger, and emits `topology_resolved` to awaken downstream compilers.
    """
    # Absolute Settlement Barrier: 2.0 second debounce to outlast watchdog bursts (e.g. git checkout)
    time.sleep(2.0)

    ctx.jobs.update_progress("Resolving physical topology boundaries...")
    events = resolve_topology_buffer(ctx.workspace_id)
    if not events:
        return {"message": "No topology events to resolve."}

    return {"message": f"Topology settled. Resolved {len(events)} events."}

def get_valid_workspace_files(repo_path, config, workspace_id=None):
    import os
    import subprocess
    from pathlib import Path
    from insetu.kernel.utils import load_config

    live_cfg = load_config(workspace_id)
    global_ignore_dirs = set(live_cfg.get("ignore_dirs", []))
    global_ignore_files = set(live_cfg.get("ignore_files", []))
    global_ignore_patterns = live_cfg.get("ignore_patterns", [])

    ignore_dirs = global_ignore_dirs.union(config.get("repo_ignore_dirs", []))
    ignore_files = global_ignore_files.union(config.get("repo_ignore_files", []))
    ignore_patterns = global_ignore_patterns + config.get("repo_ignore_patterns", [])
    archive_type = config.get("archive_type", "repo")

    if archive_type == "repo":
        if os.path.exists(repo_path):
            try:
                check_tree = subprocess.run(['git', 'rev-parse', '--is-inside-work-tree'], 
                                            capture_output=True, text=True, cwd=repo_path)
                if check_tree.returncode != 0 or 'true' not in check_tree.stdout.lower():
                    subprocess.run(['git', 'init'], capture_output=True, cwd=repo_path)
                    if not os.listdir(repo_path) or (len(os.listdir(repo_path)) == 1 and '.git' in os.listdir(repo_path)):
                        from insetu.kernel.vfs import execute_vfs_save
                        execute_vfs_save(workspace_id, Path(repo_path).joinpath('.gitkeep').as_posix(), "", data={"is_absolute_artifact": True, "ignore_ledger": True})
            except Exception:
                pass
        try:
            result = subprocess.run(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], 
                                            capture_output=True, text=True, check=True, cwd=repo_path)
            git_files = set(result.stdout.splitlines())
        except Exception:
            git_files = set()
            for p in Path(repo_path).rglob('*'):
                if p.is_file():
                    try: git_files.add(p.relative_to(repo_path).as_posix())
                    except ValueError: pass
    else:
        git_files = set()
        for p in Path(repo_path).rglob('*'):
            if p.is_file():
                try: git_files.add(p.relative_to(repo_path).as_posix())
                except ValueError: pass

    valid_files = set()
    repo_p = Path(repo_path)

    for file in git_files:
        norm_path = file
        if norm_path.startswith("./"): norm_path = norm_path[2:]
        if config.get("prefix") and not norm_path.startswith(config.get("prefix")): continue

        target_f = repo_p / norm_path
        if not target_f.is_file(): continue
        if target_f.name.lower() in ignore_files: continue
        if config.get("apply_ignore"):
            if any(norm_path.startswith(exc) for exc in config.get("ignore_exceptions", [])):
                pass
            else:
                if set(p.lower() for p in norm_path.split('/')).intersection(ignore_dirs): continue
                if any(pattern in norm_path for pattern in ignore_patterns): continue

        if repo_p.name == '.insetu' and (norm_path.startswith('data/') or '/data/' in norm_path):
            continue

        if target_f.name.lower() in (".gitkeep", ".keep"):
            valid_files.add(norm_path)
            continue
        ext = target_f.suffix.lower()
        fname = target_f.name.lower()
        allowed_exts = set(live_cfg.get("include_extensions", []) + config.get("exts", []))
        if ext in allowed_exts or fname in allowed_exts: valid_files.add(norm_path)

    for forced_file in config.get("force_include", []):
        if (repo_p / forced_file).exists(): 
            valid_files.add(forced_file)

    return sorted(list(valid_files))

def resolve_file_bucket(filepath, sub_buckets, repo_dir=""):
    import re
    clean_filepath = re.sub(r'^(?:\[[A-Z?!\s]{1,2}\]\s+|[A-Z?!\s]{2}\s+)', '', filepath).strip()

    if ' -> ' in clean_filepath:
        clean_filepath = clean_filepath.split(' -> ')[-1].strip()

    clean_filepath_lower = clean_filepath.lower()
    safe_repo_prefix = (repo_dir.lower() + "/") if repo_dir else ""

    for b in sub_buckets:
        prefix = b.get("dynamic_split_prefix")
        if prefix:
            prefix_lower = prefix.lower()
            if prefix_lower == "." or clean_filepath_lower.startswith(prefix_lower):
                parts = clean_filepath.split("/")
                module_idx = len([p for p in prefix.split('/') if p and p != '.'])
                if len(parts) > module_idx + 1:
                    return b, parts[module_idx]
                continue
        elif b.get("match_prefixes"):
            for p in b["match_prefixes"]:
                p_lower = p.lower()
                if clean_filepath_lower.startswith(p_lower):
                    return b, None
                if safe_repo_prefix and p_lower.startswith(safe_repo_prefix):
                    stripped_p = p_lower[len(safe_repo_prefix):]
                    if stripped_p and clean_filepath_lower.startswith(stripped_p):
                        return b, None
    catch_all = next((b for b in sub_buckets if b.get("is_catch_all")), None)
    return catch_all, None