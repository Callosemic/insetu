import os
import shutil
import re
import json
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from insetu.utils_core import get_sister_repos, get_workspace_physics
from insetu.hooks import hooks
from insetu.db import get_connection

tracker_bp = Blueprint('tracker', __name__)
@hooks.on('system_boot')
def init_tracker_db():
    import json
    from insetu.utils_core import _cwd
    index_path = os.path.join(_cwd, ".insetu", "workspaces.json")
    workspace_ids = ["default"]
    if os.path.exists(index_path):
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                w_data = json.load(f)
            workspace_ids = list(w_data.get("workspaces", {}).keys())
            if "default" not in workspace_ids:
                workspace_ids.append("default")
        except Exception:
            pass

    for ws_id in workspace_ids:
        conn = get_connection('tracker', workspace_id=ws_id)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tracker_tickets (
                id TEXT PRIMARY KEY,
                repo TEXT,
                ticket_type TEXT,
                status TEXT,
                title TEXT,
                description TEXT,
                tags TEXT,
                sub_bucket TEXT,
                created_at TEXT,
                closed_at TEXT,
                filepath TEXT
            )
        """)
        conn.commit()
        _sync_disk_to_db(workspace_id=ws_id)

@hooks.on('post_file_save')
def handle_tracker_file_save(filepath):
    if ".tracker/" in filepath and filepath.endswith(".md"):
        _sync_disk_to_db()
def _sync_disk_to_db(workspace_id=None):
    _, ws_root, _ = get_workspace_physics(workspace_id)
    conn = get_connection('tracker', workspace_id=workspace_id)
    # JIT Schema Creation (Ensures dynamically spawned tenant databases have the correct tables)
    conn.execute('''CREATE TABLE IF NOT EXISTS tracker_tickets (
        id TEXT PRIMARY KEY,
        repo TEXT,
        ticket_type TEXT,
        status TEXT,
        title TEXT,
        description TEXT,
        tags TEXT,
        sub_bucket TEXT,
        created_at TEXT,
        closed_at TEXT,
        filepath TEXT
    )''')

    conn.execute("DELETE FROM tracker_tickets")
    for repo in get_sister_repos(workspace_id):
        base = os.path.join(ws_root, repo, ".tracker")
        if not os.path.exists(base): continue
        for root, _, filenames in os.walk(base):
            for f in filenames:
                if f.endswith('.md'):
                    abs_path = os.path.join(root, f)
                    rel_path = os.path.relpath(abs_path, ws_root).replace('\\', '/')
                    try:
                        with open(abs_path, 'r', encoding='utf-8') as file:
                            content = file.read()
                        yaml_match = re.search(r'^---\n([\s\S]*?)\n---', content)
                        title = f
                        t_id = "UNKNOWN"
                        created_at = "0000-00-00T00:00:00"
                        closed_at = None
                        sub_bucket = "None"
                        tags = "[]"

                        if yaml_match:
                            for line in yaml_match.group(1).split('\n'):
                                line = line.strip()
                                if line.startswith('title:'): title = line.split('title:', 1)[1].strip().strip('\'"')
                                elif line.startswith('id:'): t_id = line.split('id:', 1)[1].strip().strip('\'"')
                                elif line.startswith('created_at:'): created_at = line.split('created_at:', 1)[1].strip().strip('\'"')
                                elif line.startswith('closed_at:'):  
                                    val = line.split('closed_at:', 1)[1].strip()
                                    if val.lower() != 'null': closed_at = val.strip('\'"')
                                elif line.startswith('sub_bucket:'): sub_bucket = line.split('sub_bucket:', 1)[1].strip().strip('\'"')
                                elif line.startswith('tags:'):
                                    tags_raw = line.split('tags:', 1)[1].strip()
                                    if tags_raw.startswith('['):
                                        tags = json.dumps([t.strip().strip('\'"') for t in tags_raw.strip('[]').split(',') if t.strip()])
                                    else:
                                        tags = json.dumps([t.strip().strip('\'"') for t in tags_raw.split(',') if t.strip()])

                        desc = content
                        if yaml_match:
                            desc = content.replace(yaml_match.group(0), '').strip()
                            if desc.startswith('## Description'):
                                desc = re.sub(r'^## Description\n+', '', desc).strip()

                        ticket_type = "bug" if "/bugs/" in rel_path else "queue" if "/queue/" in rel_path else "todo"
                        status = "unknown"
                        if "/open/" in rel_path: status = "open"
                        elif "/active/" in rel_path: status = "active"
                        elif "/closed/" in rel_path: status = "closed"
                        elif "/archived/" in rel_path: status = "archived"

                        conn.execute("""
                            INSERT INTO tracker_tickets 
                            (id, repo, ticket_type, status, title, description, tags, sub_bucket, created_at, closed_at, filepath)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (t_id, repo, ticket_type, status, title, desc, tags, sub_bucket, created_at, closed_at, rel_path))
                    except Exception:
                        pass
    conn.commit()

@hooks.on('mutate_workspace_config')
def inject_tracker_config(cfg):
    """Dynamically injects the .tracker logic into the core OS pipelines."""
    if "tracker" not in cfg.get("extensions", []): return
    from insetu.utils_core import get_safe_repo_id

    # 1. Register .tracker as a Cartographer managed directory
    if "managed_dirs" not in cfg:
        cfg["managed_dirs"] = []
    if ".tracker" not in cfg["managed_dirs"]:
        cfg["managed_dirs"].append(".tracker")

    # 2. Inject the tracker sub-bucket into all mapped repositories
    for repo_cfg in cfg.get("target_repos", []):
        if "sub_buckets" not in repo_cfg:
            repo_cfg["sub_buckets"] = []

        safe_r_dir = get_safe_repo_id(repo_cfg.get("repo_dir", ""))

        # Prevent double-injection
        if not any(b.get("id") == "tracker" for b in repo_cfg["sub_buckets"]):
            repo_cfg["sub_buckets"].insert(0, {
                "id": "tracker",
                "title": f"ISSUE TRACKER ({repo_cfg.get('repo_dir', '').upper()})",
                "domain": "Active bugs, tasks, and planned units of work",
                "match_prefixes": [".tracker/"],
                "out_file": f"{safe_r_dir}_tracker_context.txt"
            })
def get_tracker_path(repo, ticket_type, status, workspace_id=None):
    """Resolves the physical directory for a ticket based on your taxonomy."""
    _, ws_root, _ = get_workspace_physics(workspace_id)
    base = os.path.join(ws_root, repo, ".tracker")
    if status == "closed":
        if ticket_type == "queue": return os.path.join(base, "queue", "closed")
        return os.path.join(base, "closed")
    elif status == "archived":
        if ticket_type == "queue": return os.path.join(base, "queue", "closed")
        return os.path.join(base, "closed", "archived")
    if ticket_type == "queue": return os.path.join(base, "queue", status)
    # For open/active, route to .tracker/todos/open or .tracker/bugs/active
    return os.path.join(base, f"{ticket_type}s", status)
def create_ticket(repo, ticket_type, status, title, description, tags="", sub_bucket="None", workspace_id=None):
    """Generates the physical Markdown file with YAML frontmatter."""
    # Create a short prefix dynamically from the repo name
    repo_prefix = repo.split("-")[-1].upper()[:3] if "-" in repo else repo.upper()[:3]
    if not repo_prefix: 
        repo_prefix = "TKT"

    now = datetime.now()
    timestamp = now.strftime("%Y%m%d_%H%M")

    ticket_id = f"{repo_prefix}-{ticket_type.upper()}-{timestamp}"
    filename = f"{ticket_id}.md"

    target_dir = get_tracker_path(repo, ticket_type, status, workspace_id=workspace_id)
    os.makedirs(target_dir, exist_ok=True)
    filepath = os.path.join(target_dir, filename)
    tags_yaml = f"\ntags: [{', '.join(f'{t.strip()}' for t in tags.split(',') if t.strip())}]" if tags else ""
    content = f"""---
id: {ticket_id}
title: "{title.replace('"', "'")}"
created_at: {now.isoformat(timespec='seconds')}
closed_at: null
sub_bucket: "{sub_bucket}"{tags_yaml}
---
## Description
{description}

## Notes / Execution Log
"""
    from insetu.routes_fs import execute_vfs_save

    target_ws = workspace_id or "default"
    ticket_path = f"{repo}/.tracker/{ticket_type}s/{status}/{filename}"

    execute_vfs_save(target_ws, ticket_path, content)
    return ticket_path
def _extract_closed_date(content):
    """Helper to consistently extract and validate closed_at timestamps from raw ticket YAML."""
    match = re.search(r"closed_at:\s*([^\n]+)", content)
    if match and match.group(1).strip() != "null":
        return match.group(1).strip()
    return None
def transition_ticket(repo, current_rel_path, new_status, new_type=None, workspace_id=None):
    """Moves a ticket across the ecosystem and stamps the close date if applicable."""
    _, ws_root, _ = get_workspace_physics(workspace_id)
    abs_current = os.path.join(ws_root, current_rel_path)
    if not os.path.exists(abs_current):
        raise FileNotFoundError(f"Ticket not found: {abs_current}")

    # Infer type from the current path
    ticket_type = "bug" if "/bugs/" in current_rel_path else "queue" if "/queue/" in current_rel_path else "todo"
    if new_type: ticket_type = new_type

    target_dir = get_tracker_path(repo, ticket_type, new_status, workspace_id=workspace_id)
    os.makedirs(target_dir, exist_ok=True)
    
    filename = os.path.basename(current_rel_path)
    abs_target = os.path.join(target_dir, filename)
    
    # If transitioning to closed, stamp the YAML
    if new_status == "closed":
        with open(abs_current, "r", encoding="utf-8") as f:
            content = f.read()
        now_iso = datetime.now().isoformat(timespec='seconds')
        content = re.sub(r"closed_at:\s*null", f"closed_at: {now_iso}", content)
        with open(abs_current, "w", encoding="utf-8") as f:
            f.write(content)
    shutil.move(abs_current, abs_target)

    # Return the new relative path
    if new_status in ["closed", "archived"]:
        if ticket_type == "queue": return f"{repo}/.tracker/queue/closed/{filename}"
        return f"{repo}/.tracker/closed/{'archived/' if new_status == 'archived' else ''}{filename}"
    if ticket_type == "queue": return f"{repo}/.tracker/queue/{new_status}/{filename}"
    return f"{repo}/.tracker/{ticket_type}s/{new_status}/{filename}"
@hooks.on('pre_compile')
def pre_compile_tracker_housekeeping(workspace_id=None):
    try:
        rescue_orphan_tickets(workspace_id=workspace_id)
        reconcile_declared_closures(workspace_id=workspace_id)
        archive_stale_tickets(workspace_id=workspace_id)
    except Exception as e:
        print(f"Tracker housekeeping failed: {e}")
def rescue_orphan_tickets(workspace_id=None):
    """Sweeps for loose markdown tickets in .tracker/ or its subdirectories 
    and places  them in valid status folders."""
    _, ws_root, _ = get_workspace_physics(workspace_id)
    repos = get_sister_repos(workspace_id)
    rescued_count = 0
    for repo in repos:
        base_dir = os.path.join(ws_root, repo, ".tracker")
        if not os.path.exists(base_dir): continue

        for root, dirs, files in os.walk(base_dir):
            for filename in files:
                if not filename.endswith('.md'): continue
                filepath = os.path.join(root, filename)

                rel_dir = os.path.relpath(root, base_dir).replace('\\', '/')
                parts = rel_dir.split('/')
                if rel_dir == '.':
                    # Root of .tracker -> .tracker/queue/open
                    target_dir = get_tracker_path(repo, "queue", "open", workspace_id=workspace_id)
                elif parts[-1] not in ['open', 'active', 'closed', 'archived']:
                    # Subdirectory but no status folder -> Subdirectory/open
                    target_dir = os.path.join(root, "open")
                else:
                    continue # Already safely placed

                # Guardrail: Only move files that actually look like tickets (YAML frontmatter)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        head = f.read(10)
                    if not head.startswith('---'): continue
                except Exception:
                    continue

                os.makedirs(target_dir, exist_ok=True)
                dest_path = os.path.join(target_dir, filename)

                # Handle potential filename collisions gracefully
                if not os.path.exists(dest_path) or os.path.getmtime(filepath) > os.path.getmtime(dest_path):
                    shutil.move(filepath, dest_path)
                    rescued_count += 1
    return rescued_count
def reconcile_declared_closures(workspace_id=None):
    """
    Sweeps active tracking tracks for tickets where an LLM has declaratively
    set a closed_at timestamp, physically moving them to their correct closed directories.
    """
    _, ws_root, _ = get_workspace_physics(workspace_id)
    repos = get_sister_repos(workspace_id)
    reconciled_count = 0

    for repo in repos:
        base_dir = os.path.join(ws_root, repo, ".tracker")
        if not os.path.exists(base_dir): 
            continue

        # Active scanning targets across both todos and bugs
        scan_tracks = [
            ("todo", "open"), ("todo", "active"),
            ("bug", "open"), ("bug", "active"),
            ("queue", "open")
        ]

        for ticket_type, status in scan_tracks:
            track_dir = get_tracker_path(repo, ticket_type, status, workspace_id=workspace_id)
            if not os.path.exists(track_dir): 
                continue

            for filename in os.listdir(track_dir):
                if not filename.endswith(".md"): 
                    continue

                filepath = os.path.join(track_dir, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()
                    closed_date_str = _extract_closed_date(content)
                    if closed_date_str:
                        # Content has declared closure. Resolve physical destination
                        target_dir = get_tracker_path(repo, ticket_type, "closed", workspace_id=workspace_id)
                        os.makedirs(target_dir, exist_ok=True)

                        shutil.move(filepath, os.path.join(target_dir, filename))
                        reconciled_count += 1
                except Exception:
                    pass # Safeguard against structural anomalies during disk read

    return reconciled_count
def archive_stale_tickets(workspace_id=None):
    """Sweeps all repos for closed tickets older than 30 days and archives them."""
    _, ws_root, _ = get_workspace_physics(workspace_id)
    repos = get_sister_repos(workspace_id)
    cutoff_date = datetime.now() - timedelta(days=30)
    archived_count = 0


    for repo in repos:
        closed_dir = os.path.join(ws_root, repo, ".tracker", "closed")
        if not os.path.exists(closed_dir): continue

        archive_dir = os.path.join(closed_dir, "archived")

        for filename in os.listdir(closed_dir):
            if not filename.endswith(".md"): continue

            filepath = os.path.join(closed_dir, filename)
            if os.path.isfile(filepath):
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                # Extract closed_at from YAML
                closed_date_str = _extract_closed_date(content)
                if closed_date_str:
                    try:
                        closed_date = datetime.fromisoformat(closed_date_str)
                        if closed_date < cutoff_date:
                            os.makedirs(archive_dir, exist_ok=True)
                            shutil.move(filepath, os.path.join(archive_dir, filename))
                            archived_count += 1
                    except ValueError:
                        pass # Ignore malformed dates

    return archived_count
@tracker_bp.route('/api/tracker/new', methods=['POST'])
def api_tracker_new():
    workspace_id = request.headers.get('X-Workspace-ID')
    data = request.json
    try:
        new_path = create_ticket(
            repo=data['repo'], 
            ticket_type=data['type'], 
            status=data['status'], 
            title=data['title'], 
            description=data['description'],
            tags=data.get('tags', ''),
            sub_bucket=data.get('sub_bucket', 'None'),
            workspace_id=workspace_id
        )
        from insetu.cartographer import map_repositories
        map_repositories(workspace_id)
        _sync_disk_to_db(workspace_id)
        return jsonify({"status": "success", "filepath": new_path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@tracker_bp.route('/api/tracker/files', methods=['GET'])
def api_tracker_files():
    workspace_id = request.headers.get('X-Workspace-ID')
    try:
        # JIT sync to populate the database for dynamically swapped workspaces
        _sync_disk_to_db(workspace_id)
        conn = get_connection('tracker', workspace_id=workspace_id)
        cursor = conn.execute("SELECT * FROM tracker_tickets")
        tasks = []
        for row in cursor.fetchall():
            tasks.append({
                "id": row['id'],
                "repo": row['repo'],
                "isTodo": row['ticket_type'] == 'todo',
                "isBug": row['ticket_type'] == 'bug',
                "isQueue": row['ticket_type'] == 'queue',
                "status": row['status'],
                "title": row['title'],
                "description": row['description'],
                "tags": json.loads(row['tags']) if row['tags'] else [],
                "subBucket": row['sub_bucket'],
                "timestamp": row['created_at'],
                "filepath": row['filepath']
            })
        return jsonify({"tasks": tasks})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@tracker_bp.route('/api/tracker/transition', methods=['POST'])
def api_tracker_transition():
    workspace_id = request.headers.get('X-Workspace-ID')
    data = request.json
    try:
        new_path = transition_ticket(
            repo=data['repo'], 
            current_rel_path=data['filepath'], 
            new_status=data['new_status'],
            new_type=data.get('new_type'),
            workspace_id=workspace_id
        )
        _sync_disk_to_db(workspace_id)
        return jsonify({"status": "success", "new_filepath": new_path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500