import os
import shutil
import re
from datetime import datetime, timedelta
from insetu.utils_core import WORKSPACE_ROOT, get_sister_repos
def get_tracker_path(repo, ticket_type, status):
    """Resolves the physical directory for a ticket based on your taxonomy."""
    base = os.path.join(WORKSPACE_ROOT, repo, ".tracker")
    if status == "closed":
        if ticket_type == "queue": return os.path.join(base, "queue", "closed")
        return os.path.join(base, "closed")
    elif status == "archived":
        if ticket_type == "queue": return os.path.join(base, "queue", "closed")
        return os.path.join(base, "closed", "archived")
    if ticket_type == "queue": return os.path.join(base, "queue", status)
    # For open/active, route to .tracker/todos/open or .tracker/bugs/active
    return os.path.join(base, f"{ticket_type}s", status)
def create_ticket(repo, ticket_type, status, title, description, tags="", sub_bucket="None"):
    """Generates the physical Markdown file with YAML frontmatter."""
    # Create a short prefix dynamically from the repo name
    repo_prefix = repo.split("-")[-1].upper()[:3] if "-" in repo else repo.upper()[:3]
    if not repo_prefix: 
        repo_prefix = "TKT"
        
    now = datetime.now()
    timestamp = now.strftime("%Y%m%d_%H%M")
    
    ticket_id = f"{repo_prefix}-{ticket_type.upper()}-{timestamp}"
    filename = f"{ticket_id}.md"
    
    target_dir = get_tracker_path(repo, ticket_type, status)
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
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
        
    return f"{repo}/.tracker/{ticket_type}s/{status}/{filename}"
def _extract_closed_date(content):
    """Helper to consistently extract and validate closed_at timestamps from raw ticket YAML."""
    match = re.search(r"closed_at:\s*([^\n]+)", content)
    if match and match.group(1).strip() != "null":
        return match.group(1).strip()
    return None

def transition_ticket(repo, current_rel_path, new_status, new_type=None):
    """Moves a ticket across the ecosystem and stamps the close date if applicable."""
    abs_current = os.path.join(WORKSPACE_ROOT, current_rel_path)
    if not os.path.exists(abs_current):
        raise FileNotFoundError(f"Ticket not found: {abs_current}")

    # Infer type from the current path
    ticket_type = "bug" if "/bugs/" in current_rel_path else "queue" if "/queue/" in current_rel_path else "todo"
    if new_type: ticket_type = new_type

    target_dir = get_tracker_path(repo, ticket_type, new_status)
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
def rescue_orphan_tickets():
    """Sweeps for loose markdown tickets in .tracker/ or its subdirectories and places them in valid status folders."""
    repos = get_sister_repos()
    rescued_count = 0
    for repo in repos:
        base_dir = os.path.join(WORKSPACE_ROOT, repo, ".tracker")
        if not os.path.exists(base_dir): continue

        for root, dirs, files in os.walk(base_dir):
            for filename in files:
                if not filename.endswith('.md'): continue
                filepath = os.path.join(root, filename)

                rel_dir = os.path.relpath(root, base_dir).replace('\\', '/')
                parts = rel_dir.split('/')

                if rel_dir == '.':
                    # Root of .tracker -> .tracker/queue/open
                    target_dir = os.path.join(base_dir, "queue", "open")
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

def reconcile_declared_closures():
    """
    Sweeps active tracking tracks for tickets where an LLM has declaratively
    set a closed_at timestamp, physically moving them to their correct closed directories.
    """
    repos = get_sister_repos()
    reconciled_count = 0

    for repo in repos:
        base_dir = os.path.join(WORKSPACE_ROOT, repo, ".tracker")
        if not os.path.exists(base_dir): 
            continue

        # Active scanning targets across both todos and bugs
        scan_tracks = [
            ("todo", "open"), ("todo", "active"),
            ("bug", "open"), ("bug", "active"),
            ("queue", "open")
        ]

        for ticket_type, status in scan_tracks:
            track_dir = get_tracker_path(repo, ticket_type, status)
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
                        target_dir = get_tracker_path(repo, ticket_type, "closed")
                        os.makedirs(target_dir, exist_ok=True)

                        shutil.move(filepath, os.path.join(target_dir, filename))
                        reconciled_count += 1
                except Exception:
                    pass # Safeguard against structural anomalies during disk read

    return reconciled_count

def archive_stale_tickets():
    """Sweeps all repos for closed tickets older than 30 days and archives them."""
    repos = get_sister_repos()
    cutoff_date = datetime.now() - timedelta(days=30)
    archived_count = 0
    
    for repo in repos:
        closed_dir = os.path.join(WORKSPACE_ROOT, repo, ".tracker", "closed")
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