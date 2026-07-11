from pathlib import Path
import os
import shutil
import re
import json
from datetime import datetime, timedelta
from flask import request, jsonify
from insetu.utils_core import get_sister_repos, get_workspace_physics, sniff_tenant_id
from insetu.hooks import hooks
from insetu.db import get_connection
from insetu.sdk import InSetuExtension

TRACKER_SCHEMA = {
    "tracker_tickets": {
        "id": "TEXT PRIMARY KEY",
        "repo": "TEXT",
        "ticket_type": "TEXT",
        "status": "TEXT",
        "title": "TEXT",
        "description": "TEXT",
        "tags": "TEXT",
        "sub_bucket": "TEXT",
        "created_at": "TEXT",
        "closed_at": "TEXT",
        "delivery_date": "TEXT",
        "filepath": "TEXT"
    }
}

tracker_bp = InSetuExtension('tracker', __name__, schema=TRACKER_SCHEMA)
__depends__ = []

@hooks.on('system_boot')
def init_tracker_db():
    from insetu.utils_core import get_all_workspace_ids
    for ws_id in get_all_workspace_ids():
        _sync_disk_to_db(workspace_id=ws_id)
@hooks.on('post_file_save')
def handle_tracker_file_save(filepath, workspace_id=None):
    if ".tracker/" in filepath and filepath.endswith(".md"):
        _, ws_root, _ = get_workspace_physics(workspace_id)
        abs_path = Path(ws_root).joinpath(filepath).as_posix()
        if os.path.exists(abs_path):
            _parse_and_upsert_ticket(abs_path, filepath, workspace_id)

@hooks.on('post_file_delete')
def handle_tracker_file_delete(filepath, workspace_id=None):
    if ".tracker/" in filepath and filepath.endswith(".md"):
        conn = get_connection('tracker', workspace_id=workspace_id)
        conn.execute("DELETE FROM tracker_tickets WHERE filepath = ?", (filepath,))
        conn.commit()

def _parse_and_upsert_ticket(abs_path, rel_path, workspace_id):
    """Surgically parses a single markdown ticket and UPSERTs it into the cache."""
    try:
        with open(abs_path, 'r', encoding='utf-8') as file:
            content = file.read()
        yaml_match = re.search(r'^\s*---\n([\s\S]*?)\n\s*---', content)

        filename = os.path.basename(rel_path)
        title = filename
        t_id = "UNKNOWN"
        created_at = "0000-00-00T00:00:00"
        closed_at = None
        sub_bucket = "None"
        tags = "[]"
        delivery_date = None
        if yaml_match:
            for line in yaml_match.group(1).split('\n'):
                line = line.strip()
                if line.startswith('title:'): title = line.split('title:', 1)[1].strip().strip('\'"')
                elif line.startswith('id:'): t_id = line.split('id:', 1)[1].strip().strip('\'"')
                elif line.startswith('created_at:'): created_at = line.split('created_at:', 1)[1].strip().strip('\'"')
                elif line.startswith('closed_at:'):  
                    val = line.split('closed_at:', 1)[1].strip()
                    if val.lower() != 'null': closed_at = val.strip('\'"')
                elif line.startswith('delivery_date:'):
                    val = line.split('delivery_date:', 1)[1].strip()
                    if val.lower() != 'null': delivery_date = val.strip('\'"')
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
        elif "/log/" in rel_path: status = "logged"

        repo = rel_path.split('/')[0] if '/' in rel_path else "unknown"
        if yaml_match:
            for line in yaml_match.group(1).split('\n'):
                line = line.strip()
                if line.startswith('repo:'): repo = line.split('repo:', 1)[1].strip().strip('\'"')
                elif line.startswith('type:'):
                    raw_t = line.split('type:', 1)[1].strip().strip('\'"').lower()
                    if "bug" in raw_t: ticket_type = "bug"
                    elif "queue" in raw_t: ticket_type = "queue"
                    else: ticket_type = "todo"
                elif line.startswith('status:'):
                    raw_s = line.split('status:', 1)[1].strip().strip('\'"').lower()
                    if "active" in raw_s: status = "active"
                    elif "clos" in raw_s: status = "closed"
                    elif "archiv" in raw_s: status = "archived"
                    elif "log" in raw_s: status = "logged"
                    else: status = "open"
        conn = get_connection('tracker', workspace_id=workspace_id)
        conn.execute("""
            INSERT OR REPLACE INTO tracker_tickets 
            (id, repo, ticket_type, status, title, description, tags, sub_bucket, created_at, closed_at, delivery_date, filepath)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (t_id, repo, ticket_type, status, title, desc, tags, sub_bucket, created_at, closed_at, delivery_date, rel_path))
        conn.commit()
    except Exception as e:
        print(f"Error parsing ticket {rel_path}: {e}")
def _sync_disk_to_db(workspace_id=None):
    from insetu.sdk import ExtensionContext
    ctx = ExtensionContext('tracker', workspace_id)
    ctx.db.execute("DELETE FROM tracker_tickets")
    for repo in get_sister_repos(workspace_id):
        tracker_path = f"{repo}/.tracker"
        # SDK VFS Walk abstracts physical path resolution and spatial bounds
        for ws_rel_path in ctx.vfs.walk(tracker_path, exts=['.md']):
            abs_path = ctx.resolve_path(ws_rel_path)
            _parse_and_upsert_ticket(abs_path, ws_rel_path, workspace_id)

    ctx.db.commit()
@hooks.on('mutate_workspace_config')
def inject_tracker_config(cfg, **kwargs):
    """Dynamically injects the .tracker logic into the core OS pipelines."""
    if "tracker" not in cfg.get("extensions", []): return
    from insetu.utils_core import get_safe_repo_id

    # 1. Register .tracker as a Cartographer managed directory
    if "managed_dirs" not in cfg:
        cfg["managed_dirs"] = []
    if ".tracker" not in cfg["managed_dirs"]:
        cfg["managed_dirs"].append(".tracker")
    # 2. Inject the tracker sub-bucket into all mapped repositories
    tracker_cfg = cfg.get("extension_config", {}).get("tracker", {})
    strat = tracker_cfg.get("domain_strategy", "default")
    custom_val = tracker_cfg.get("domain_custom_value", "")

    for repo_cfg in cfg.get("target_repos", []):
        if "sub_buckets" not in repo_cfg:
            repo_cfg["sub_buckets"] = []

        safe_r_dir = get_safe_repo_id(repo_cfg.get("repo_dir", ""))

        domain = "Active bugs, tasks, and planned units of work"
        if strat == "repo":
            domain = repo_cfg.get("domain", "Workspaces")
        elif strat == "custom" and custom_val:
            domain = custom_val

        # Prevent double-injection
        if not any(b.get("id") == "tracker" for b in repo_cfg["sub_buckets"]):
            repo_cfg["sub_buckets"].insert(0, {
                "id": "tracker",
                "title": f"ISSUE TRACKER ({repo_cfg.get('repo_dir', '').upper()})",
                "domain": domain,
                "match_prefixes": [".tracker/"],
                "out_file": f"{safe_r_dir}_tracker_context.txt",
                "is_system": True
            })
def get_tracker_path(repo, ticket_type, status, workspace_id=None):
    """Resolves the physical directory for a ticket based on your taxonomy."""
    _, ws_root, _ = get_workspace_physics(workspace_id)
    base = Path(ws_root).joinpath(repo, ".tracker").as_posix()
    if status == "archived":
        return Path(base).joinpath("log", "archived").as_posix()
    elif status == "logged":
        return Path(base).joinpath("log").as_posix()

    folder_type = "queue" if ticket_type == "queue" else f"{ticket_type}s"
    return Path(base).joinpath(folder_type, status).as_posix()
def create_ticket(repo, ticket_type, status, title, description, tags="", sub_bucket="None", delivery_date=None, workspace_id=None):
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
    filepath = Path(target_dir).joinpath(filename).as_posix()
    tags_yaml = f"\ntags: [{', '.join(f'{t.strip()}' for t in tags.split(',') if t.strip())}]" if tags else ""
    delivery_yaml = f'\ndelivery_date: "{delivery_date}"' if delivery_date else "\ndelivery_date: null"
    content = f"""---
repo: "{repo}"
type: "{ticket_type}"
status: "{status}"
id: {ticket_id}
title: "{title.replace('"', "'")}"
created_at: {now.isoformat(timespec='seconds')}
closed_at: null
sub_bucket: "{sub_bucket}"{tags_yaml}{delivery_yaml}
---

## Description
{description}

## Notes / Execution Log
"""
    from insetu.routes_fs import execute_vfs_save

    target_ws = workspace_id or "default"
    folder_type = "queue" if ticket_type == "queue" else f"{ticket_type}s"
    ticket_path = f"{repo}/.tracker/{folder_type}/{status}/{filename}"
    # Synchronously seed the local ledger cache row to guarantee transactional accuracy on immediate CQRS query sweeps
    conn = get_connection('tracker', workspace_id=target_ws)
    conn.execute("""
        INSERT OR REPLACE INTO tracker_tickets 
        (id, repo, ticket_type, status, title, description, tags, sub_bucket, created_at, closed_at, delivery_date, filepath)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

    """, (ticket_id, repo, ticket_type, status, title, description, json.dumps([t.strip() for t in tags.split(',') if t.strip()]), sub_bucket, now.isoformat(), None, delivery_date, ticket_path))
    conn.commit()

    execute_vfs_save(target_ws, ticket_path, content)
    return ticket_path
def _extract_closed_date(content):
    """Helper to consistently extract and parse closed_at timestamps from raw ticket YAML."""
    match = re.search(r"closed_at:\s*([^\n]+)", content)
    if match and match.group(1).strip() != "null":
        date_str = match.group(1).strip().strip('\'"')
        try:
            return datetime.fromisoformat(date_str).replace(tzinfo=None)
        except (ValueError, TypeError):
            return None
    return None
def transition_ticket(repo, current_rel_path, new_status, new_type=None, workspace_id=None):
    """Moves a ticket across the ecosystem and stamps the close date if applicable."""
    _, ws_root, _ = get_workspace_physics(workspace_id)
    abs_current = Path(ws_root).joinpath(current_rel_path).as_posix()
    if not os.path.exists(abs_current):
        raise FileNotFoundError(f"Ticket not found: {abs_current}")

    # Infer type from the current path
    ticket_type = "bug" if "/bugs/" in current_rel_path else "queue" if "/queue/" in current_rel_path else "todo"
    if new_type: ticket_type = new_type

    filename = os.path.basename(current_rel_path)

    with open(abs_current, "r", encoding="utf-8") as f:
        content = f.read()
    # Calculate updated frontmatter safely in memory
    if new_status in ["closed", "logged", "archived"] and "closed_at: null" in content:
        now_iso = datetime.now().isoformat(timespec='seconds')
        content = re.sub(r"closed_at:\s*null", f"closed_at: {now_iso}", content)

    # Update declarative YAML fields
    content = re.sub(r"status:\s*\"?[a-zA-Z]+\"?", f'status: "{new_status}"', content)
    if new_type:
        content = re.sub(r"type:\s*\"?[a-zA-Z]+\"?", f'type: "{new_type}"', content)
    # Re-calculate correct relative tracking track targets
    if new_status == "archived":
        new_rel_path = f"{repo}/.tracker/log/archived/{filename}"
    elif new_status == "logged":
        new_rel_path = f"{repo}/.tracker/log/{filename}"
    else:
        folder_type = "queue" if ticket_type == "queue" else f"{ticket_type}s"
        new_rel_path = f"{repo}/.tracker/{folder_type}/{new_status}/{filename}"

    from insetu.routes_fs import execute_vfs_save
    # Process modifications asynchronously through our off-thread VFS queue pipeline
    execute_vfs_save(workspace_id, new_rel_path, content, data={"delete_source": current_rel_path if current_rel_path != new_rel_path else None})

    # Synchronously project state transitions inside the SQLite index cache for instant read synchronization
    conn = get_connection('tracker', workspace_id=workspace_id)
    conn.execute("""
        UPDATE tracker_tickets 
        SET status = ?, filepath = ?, ticket_type = ?, closed_at = ?
        WHERE filepath = ?
    """, (new_status, new_rel_path, ticket_type, datetime.now().isoformat() if new_status == "closed" else None, current_rel_path))
    conn.commit()

    return new_rel_path
@hooks.on('pre_compile')
def pre_compile_tracker_housekeeping(workspace_id=None):
    try:
        enforce_declarative_tickets(workspace_id=workspace_id)
        archive_stale_tickets(workspace_id=workspace_id)
    except Exception as e:
        print(f"Tracker housekeeping failed: {e}")
def enforce_declarative_tickets(workspace_id=None):
    """
    SSOT Enforcer: Sweeps all .tracker directories. Reads the YAML frontmatter.
    If the physical path contradicts the YAML, the YAML wins -> file is moved.
    If the YAML is missing fields, the physical path infers them -> YAML is rewritten.
    """
    from insetu.utils_core import load_config
    _, ws_root, _ = get_workspace_physics(workspace_id)
    repos = get_sister_repos(workspace_id)
    cfg = load_config(workspace_id)
    enforced_count = 0

    valid_buckets_by_repo = {}
    for c in cfg.get("target_repos", []):
        r = c.get("repo_dir")
        buckets = {"None", "tracker"}
        for b in c.get("sub_buckets", []):
            if b.get("id"): buckets.add(b["id"])
            if b.get("meta_map"): buckets.update(b["meta_map"].keys())
        valid_buckets_by_repo[r] = buckets

    for current_repo in repos:
        base_dir = Path(ws_root).joinpath(current_repo, ".tracker").as_posix()
        if not os.path.exists(base_dir): continue

        for root, _, files in os.walk(base_dir):
            for filename in files:
                if not filename.endswith('.md'): continue
                filepath = Path(root).joinpath(filename).as_posix()
                rel_dir = os.path.relpath(root, base_dir)
                rel_dir_lower = rel_dir.lower()
                # Infer current state from path as fallback, defaulting to todo
                inferred_type = "todo"
                if "bug" in rel_dir_lower: inferred_type = "bug"
                elif "queue" in rel_dir_lower: inferred_type = "queue"
                inferred_status = "open"
                if "active" in rel_dir_lower: inferred_status = "active"
                elif "close" in rel_dir_lower: inferred_status = "closed"
                elif "archive" in rel_dir_lower: inferred_status = "archived"
                elif "log" in rel_dir_lower: inferred_status = "logged"

                # Attempt to rescue sub-bucket categorizations from messy AI-generated folders
                inferred_sub_bucket = "None"
                standard_dirs = {"todos", "bugs", "queue", "closed", "open", "active", "archived", "logged", "todo", "bug", ".", "log"}
                for part in rel_dir.split('/'):
                    if part and part.lower() not in standard_dirs:
                        inferred_sub_bucket = part
                        break
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    # Heal double-YAML malformations created by prior regex failures
                    pseudo_match = re.search(r'^\s*---\n[\s\S]*?\n\s*---\n+((?:repo|type|status|id|title|created_at|closed_at|sub_bucket|tags):[\s\S]*?\n\s*---)', content)
                    yaml_data_rescue = {}
                    if pseudo_match:
                        bad_block = pseudo_match.group(1)
                        for line in bad_block.split('\n'):
                            if ':' in line and not line.strip().startswith('---'):
                                k, v = line.split(':', 1)
                                yaml_data_rescue[k.strip()] = v.strip().strip('\'"')
                        content = content.replace(bad_block, '').strip()

                    yaml_match = re.search(r'^\s*---\n([\s\S]*?)\n\s*---', content)

                    yaml_data = {}
                    if yaml_match:
                        yaml_lines = yaml_match.group(1).split('\n')
                        for line in yaml_lines:
                            if ':' in line:
                                k, v = line.split(':', 1)
                                yaml_data[k.strip()] = v.strip().strip('\'"')

                    yaml_data.update(yaml_data_rescue)

                    # Read declarative values or fallback to inferred values if missing
                    raw_repo = yaml_data.get('repo', current_repo)
                    decl_repo = raw_repo if raw_repo in repos else current_repo

                    hallucinated_tags = []
                    if raw_repo != decl_repo and raw_repo and raw_repo.lower() != 'none':
                        hallucinated_tags.append(raw_repo.replace(' ', '-').replace('"', ''))

                    # Strict validation: clamp AI hallucinations back to system enumerations
                    raw_type = yaml_data.get('type', inferred_type).lower()
                    if "bug" in raw_type: decl_type = "bug"
                    elif "todo" in raw_type: decl_type = "todo"
                    elif "queue" in raw_type: decl_type = "queue"
                    else: decl_type = inferred_type
                    raw_status = yaml_data.get('status', inferred_status).lower()
                    if "active" in raw_status: decl_status = "active"
                    elif "clos" in raw_status: decl_status = "closed"
                    elif "archiv" in raw_status: decl_status = "archived"
                    elif "log" in raw_status: decl_status = "logged"
                    else: decl_status = "open"
                    decl_id = yaml_data.get('id', filename.replace('.md', ''))
                    decl_title = yaml_data.get('title', filename.replace('.md', ''))

                    # Query the SQLite cache ledger to evaluate historical context metrics
                    db_status = None
                    db_created_at = None
                    db_closed_at = None
                    try:
                        conn = get_connection('tracker', workspace_id=workspace_id)
                        cache_row = conn.execute("SELECT status, created_at, closed_at FROM tracker_tickets WHERE id = ?", (decl_id,)).fetchone()
                        if cache_row:
                            db_status = cache_row['status']
                            db_created_at = cache_row['created_at']
                            db_closed_at = cache_row['closed_at']
                    except Exception:
                        pass

                    # Lock down original creation metrics against LLM omissions or overwrites
                    if db_created_at:
                        decl_created = db_created_at
                    else:
                        # Fall back to file frontmatter string, or stamp fresh system time if truly new
                        file_created = yaml_data.get('created_at')
                        if file_created and file_created.lower() != 'null':
                            decl_created = file_created
                        else:
                            decl_created = datetime.now().isoformat(timespec='seconds')
                    # Enforce the System Clock as the single authority on closure timelines
                    if decl_status in ('closed', 'logged', 'archived'):
                        if db_status in ('open', 'active', 'queue', 'todo', 'bug'):
                            # State transition detected (Open -> Closed)! Force system clock to override LLM hallucinations.
                            decl_closed = datetime.now().isoformat(timespec='seconds')
                        elif db_status in ('closed', 'logged', 'archived') and db_closed_at:
                            # Ticket was already closed historically; retain original system record
                            decl_closed = db_closed_at
                        else:
                            # db_status is None (Untracked from Git) OR missing date. Trust the file to preserve history.
                            file_closed = yaml_data.get('closed_at')
                            if file_closed and file_closed.lower() != 'null':
                                decl_closed = file_closed
                            else:
                                decl_closed = datetime.now().isoformat(timespec='seconds')
                    else:
                        decl_closed = 'null'

                    decl_sub = yaml_data.get('sub_bucket')
                    if not decl_sub or decl_sub == 'None':
                        # If the AI hallucinated a category in 'type', rescue it!
                        bad_type = yaml_data.get('type', '')
                        if bad_type.lower() not in ["bug", "todo", "queue"] and bad_type:
                            decl_sub = bad_type
                        else:
                            decl_sub = inferred_sub_bucket

                    # Validate sub_bucket against config.json
                    valid_buckets = valid_buckets_by_repo.get(decl_repo, {"None", "tracker"})
                    if decl_sub not in valid_buckets:
                        if decl_sub and decl_sub.lower() != 'none':
                            hallucinated_tags.append(decl_sub.replace(' ', '-').replace('"', ''))
                        decl_sub = "None"

                    decl_tags_raw = yaml_data.get('tags', '[]')
                    try:
                        import json
                        # Attempt to parse as JSON array, otherwise split by comma
                        decl_tags_list = json.loads(decl_tags_raw) if decl_tags_raw.startswith('[') else [t.strip() for t in decl_tags_raw.split(',') if t.strip()]
                    except Exception:
                        decl_tags_list = []

                    for ht in hallucinated_tags:
                        if ht not in decl_tags_list: decl_tags_list.append(ht)

                    decl_tags = json.dumps(decl_tags_list) if decl_tags_list else '[]'
                    # Determine if we need to rewrite YAML (fields missing or mismatched)
                    needs_rewrite = (
                        'repo' not in yaml_data or 'type' not in yaml_data or 
                        'status' not in yaml_data or yaml_data.get('closed_at', '').lower() != decl_closed.lower() or
                        yaml_data.get('status') != decl_status or yaml_data.get('type') != decl_type or
                        bool(pseudo_match)
                    )

                    # Determine intended physical destination based on declarative state
                    intended_dir = get_tracker_path(decl_repo, decl_type, decl_status, workspace_id=workspace_id)
                    intended_filename = f"{decl_id}.md"
                    intended_path = Path(intended_dir).joinpath(intended_filename).as_posix()
                    current_rel_path = os.path.relpath(filepath, ws_root)
                    intended_rel_path = os.path.relpath(intended_path, ws_root)
                    # Self-Healing: Duplicate / Ghost File Detection
                    if current_rel_path != intended_rel_path and os.path.exists(intended_path):
                        current_mtime = os.path.getmtime(filepath)
                        intended_mtime = os.path.getmtime(intended_path)

                        should_delete_ghost = (intended_mtime >= current_mtime)

                        # Lazy Evaluation: Only execute the expensive disk read if the mtime check fails 
                        # AND the file sizes are identical (a cheap heuristic for identical content).
                        if not should_delete_ghost and os.path.getsize(filepath) == os.path.getsize(intended_path):
                            with open(intended_path, 'r', encoding='utf-8') as f_int:
                                should_delete_ghost = (content == f_int.read())

                        if should_delete_ghost:
                            from insetu.routes_fs import execute_vfs_delete
                            execute_vfs_delete(workspace_id, current_rel_path)
                            continue

                    if current_rel_path != intended_rel_path or needs_rewrite:
                        # Reconstruct pristine YAML
                        new_yaml = (
                            f"---\n"
                            f"repo: \"{decl_repo}\"\n"
                            f"type: \"{decl_type}\"\n"
                            f"status: \"{decl_status}\"\n"
                            f"id: {decl_id}\n"
                            f"title: \"{decl_title}\"\n"
                            f"created_at: {decl_created}\n"
                            f"closed_at: {decl_closed}\n"
                            f"sub_bucket: \"{decl_sub}\"\n"
                        )
                        if decl_tags and decl_tags != '[]':
                            new_yaml += f"tags: {decl_tags}\n"
                        new_yaml += "---"

                        if yaml_match:
                            new_content = content.replace(yaml_match.group(0), new_yaml)
                        else:
                            new_content = f"{new_yaml}\n\n{content}"

                        from insetu.routes_fs import execute_vfs_save
                        execute_vfs_save(workspace_id, intended_rel_path, new_content, data={"delete_source": current_rel_path if current_rel_path != intended_rel_path else None})
                        enforced_count += 1

                except Exception:
                    pass

        # Post-sweep cleanup: remove empty ghost directories left behind
        for root, dirs, files in os.walk(base_dir, topdown=False):
            for d in dirs:
                dir_path = Path(root).joinpath(d).as_posix()
                try:
                    if not os.listdir(dir_path):
                        os.rmdir(dir_path)
                except OSError:
                    pass

    return enforced_count
def archive_stale_tickets(workspace_id=None):
    """Sweeps all repos for tickets passing the 7-day log and 30-day archive thresholds."""
    _, ws_root, _ = get_workspace_physics(workspace_id)
    repos = get_sister_repos(workspace_id)
    date_7 = datetime.now() - timedelta(days=7)
    date_30 = datetime.now() - timedelta(days=30)
    archived_count = 0

    for repo in repos:
        # Sweep 1: Move >7 day closed tickets to log
        for folder_type in ["todos", "bugs", "queue"]:
            closed_dir = Path(ws_root).joinpath(repo, ".tracker", folder_type, "closed").as_posix()
            if not os.path.exists(closed_dir): continue

            for filename in os.listdir(closed_dir):
                if not filename.endswith(".md"): continue

                filepath = Path(closed_dir).joinpath(filename).as_posix()
                if os.path.isfile(filepath):
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()
                    closed_date = _extract_closed_date(content)
                    if closed_date and closed_date < date_7:
                        content = re.sub(r"status:\s*\"?closed\"?", 'status: "logged"', content)
                        new_rel_path = f"{repo}/.tracker/log/{filename}"
                        old_rel_path = f"{repo}/.tracker/{folder_type}/closed/{filename}"
                        from insetu.routes_fs import execute_vfs_save
                        execute_vfs_save(workspace_id, new_rel_path, content, data={"delete_source": old_rel_path})
                        archived_count += 1

        # Sweep 2: Move >30 day logged tickets to archive
        log_dir = Path(ws_root).joinpath(repo, ".tracker", "log").as_posix()
        if os.path.exists(log_dir):
            for filename in os.listdir(log_dir):
                if not filename.endswith(".md"): continue

                filepath = Path(log_dir).joinpath(filename).as_posix()
                if os.path.isfile(filepath):
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()
                    closed_date = _extract_closed_date(content)
                    if closed_date and closed_date < date_30:
                        content = re.sub(r"status:\s*\"?logged\"?", 'status: "archived"', content)
                        new_rel_path = f"{repo}/.tracker/log/archived/{filename}"
                        old_rel_path = f"{repo}/.tracker/log/{filename}"
                        from insetu.routes_fs import execute_vfs_save
                        execute_vfs_save(workspace_id, new_rel_path, content, data={"delete_source": old_rel_path})
                        archived_count += 1

    return archived_count
@tracker_bp.route('new', methods=['POST'])
def api_tracker_new(ctx):
    data = ctx.req.json
    try:
        new_path = create_ticket(
            repo=data['repo'], 
            ticket_type=data['type'], 
            status=data['status'], 
            title=data['title'], 
            description=data['description'],
            tags=data.get('tags', ''),
            sub_bucket=data.get('sub_bucket', 'None'),
            delivery_date=data.get('delivery_date'),
            workspace_id=ctx.workspace_id
        )
        return jsonify({"status": "success", "filepath": new_path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@tracker_bp.route('files', methods=['GET'])
def api_tracker_files(ctx):
    try:
        conn = ctx.db

        # True CQRS Mandate: Perform an initial seed walk only if the cache index is completely blank.
        count_check = conn.execute("SELECT count(*) FROM tracker_tickets").fetchone()[0]
        if count_check == 0:
            _sync_disk_to_db(ctx.workspace_id)
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
                "closedAt": row['closed_at'],
                "deliveryDate": row['delivery_date'],
                "filepath": row['filepath']
            })
        return jsonify({"tasks": tasks})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@tracker_bp.route('transition', methods=['POST'])
def api_tracker_transition(ctx):
    data = ctx.req.json
    try:
        new_path = transition_ticket(
            repo=data['repo'], 
            current_rel_path=data['filepath'], 
            new_status=data['new_status'],
            new_type=data.get('new_type'),
            workspace_id=ctx.workspace_id
        )
        return jsonify({"status": "success", "new_filepath": new_path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@hooks.on('request_changelog_suggestions')
def provide_changelog_suggestions(repo, workspace_id=None, **kwargs):
    """Provides recent closed tickets to other extensions (like Git) without exposing DB internals."""
    changelogs = []
    try:
        conn = get_connection('tracker', workspace_id=workspace_id)
        cursor = conn.execute("""
            SELECT title FROM tracker_tickets 
            WHERE repo = ? AND status = 'closed' 
            ORDER BY COALESCE(closed_at, created_at) DESC LIMIT 5
        """, (repo,))
        for row in cursor.fetchall():
            changelogs.append({"title": row['title']})
    except Exception:
        pass
    return changelogs