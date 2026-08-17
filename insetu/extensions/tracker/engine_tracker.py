from pathlib import Path
import os
import shutil
import re
import json
from datetime import datetime, timedelta
from flask import request, jsonify
from insetu.kernel.utils import sniff_tenant_id
from insetu.kernel.hooks import hooks
from insetu.core.sdk import InSetuExtension
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
        "filepath": "TEXT",
        "tier": "INTEGER DEFAULT 3",
        "parent_id": "TEXT",
        "depends_on": "TEXT DEFAULT '[]'",
        "priority": "TEXT DEFAULT 'P2'",
        "size": "TEXT DEFAULT 'M'"
    }
}
# The database seed is now strictly empty. System defaults are dynamically injected on-the-fly.
DEFAULT_KANBAN_PROFILES = []
DEFAULT_PARENT_TABS = [
    {"id": "tasks", "label": "Tasks"}
]

def _parse_list_field(raw_val):
    """Helper to safely parse comma-separated strings or JSON arrays into a standardized JSON string."""
    try:
        if isinstance(raw_val, list):
            return json.dumps([str(d).strip() for d in raw_val if str(d).strip()])
        elif isinstance(raw_val, str) and raw_val.startswith('['):
            # Ensure valid JSON, then re-serialize to normalize spacing
            return json.dumps(json.loads(raw_val))
        elif isinstance(raw_val, str):
            return json.dumps([d.strip() for d in raw_val.split(',') if d.strip()])
    except Exception:
        pass
    return '[]'
def _parse_string_enum(raw_val):
    """Helper to safely parse and normalize string enumerations like priority and size."""
    return str(raw_val).upper() if raw_val and str(raw_val).lower() not in ('null', 'none', '') else ''

DEFAULT_GLOBAL_VIEWS = [
    { "_uuid": "sys_v1", "id": "epics", "label": "🎯 Epics", "target_tier": 1, "layout": "stacked", "filters": { "ticket_types": "epic, campaign", "statuses": "" } },
    { "_uuid": "sys_v2", "id": "sprints", "label": "📦 Sprints", "target_tier": 2, "layout": "stacked", "filters": { "ticket_types": "sprint, article, video", "statuses": "" } },
    { "_uuid": "sys_v3", "id": "todos", "label": "📄 To-Dos", "target_tier": 3, "layout": "columns", "filters": { "ticket_types": "todo, draft", "statuses": "" } },
    { "_uuid": "sys_v4", "id": "bugs", "label": "🐛 Bugs", "target_tier": 3, "layout": "columns", "filters": { "ticket_types": "bug, edit", "statuses": "" } },
    { "_uuid": "sys_v5", "id": "queue", "label": "🔬 Queue", "target_tier": 3, "layout": "columns", "filters": { "ticket_types": "queue, publish", "statuses": "" } },
    { "_uuid": "sys_v6", "id": "log", "label": "📜 Log", "target_tier": None, "layout": "log", "filters": { "ticket_types": "", "statuses": "" } }
]
TRACKER_SETTINGS_SCHEMA = [
    {
        "id": "parent_tabs",
        "type": "hidden",
        "scope": "workspace",
        "default": DEFAULT_PARENT_TABS
    },
    {
        "id": "hierarchy_labels",
        "type": "hidden",
        "scope": "repo",
        "default": {
            "tier_1": "Campaigns",
            "tier_2": "Sprints",
            "tier_3": "Tasks"
        }
    },
    {
        "id": "custom_views",
        "type": "hidden",
        "scope": "repo",
        "default": [
            { "id": "todos", "label": "To-Dos", "target_tier": 3, "layout": "columns", "filters": { "ticket_type": "todo" } },
            { "id": "bugs", "label": "Bugs", "target_tier": 3, "layout": "columns", "filters": { "ticket_type": "bug" } },
            { "id": "queue", "label": "Queue", "target_tier": 3, "layout": "columns", "filters": { "ticket_type": "queue" } },
            { "id": "sprints", "label": "Sprints", "target_tier": 2, "layout": "stacked", "filters": {} },
            { "id": "campaigns", "label": "Campaigns", "target_tier": 1, "layout": "stacked", "filters": {} },
            { "id": "log", "label": "Log", "target_tier": None, "layout": "log", "filters": {} }
        ]
    },
    {
        "id": "global_views",
        "type": "hidden",
        "scope": "workspace",
        "default": DEFAULT_GLOBAL_VIEWS
    },
    {
        "id": "kanban_profiles",
        "type": "hidden",
        "scope": "workspace",
        "default": DEFAULT_KANBAN_PROFILES
    },
    {
        "id": "kanban_repo_map",
        "type": "hidden",
        "scope": "workspace",
        "default": {}
    },
    {"id": "isolate_context", "label": "Spawn Separate Tracker Context", "type": "boolean", "scope": "workspace", "default": True},
    {"id": "exclude_from_diffs", "label": "Exclude Tracker from Git Diffs (Sends to Sweepable State)", "type": "boolean", "scope": "workspace", "default": True},
    {"id": "include_closed", "label": "Include Closed in Context", "type": "select", "scope": "workspace", "options": [{"value": "grace_period", "label": "Grace Period"}, {"value": "all", "label": "All"}, {"value": "none", "label": "None"}], "default": "grace_period"},
    {"id": "spawn_closed", "label": "Spawn Separate Closed Context", "type": "boolean", "scope": "workspace", "default": False},
    {"id": "include_archived_in_log", "label": "Include Archived in UI Log & Changelog", "type": "boolean", "scope": "workspace", "default": False},
    {"id": "grace_period_days", "label": "Grace Period (Days)", "type": "number", "scope": "workspace", "default": 7},
    {"id": "auto_archive", "label": "Auto-Archive", "type": "boolean", "scope": "workspace", "default": True},
    {"id": "archive_days", "label": "Archive After (Days)", "type": "number", "scope": "workspace", "default": 30},
    {"id": "domain_strategy", "label": "Domain Strategy", "type": "select", "scope": "workspace", "options": [{"value": "default", "label": "Default"}, {"value": "repo", "label": "Match Repo Domain"}, {"value": "custom", "label": "Custom Domain"}], "default": "default"},
    {"id": "domain_custom_value", "label": "Custom Domain Value", "type": "text", "scope": "workspace", "default": ""}
]
tracker_bp = InSetuExtension('tracker', __name__, title="Issue Tracker", description="Markdown-based Kanban issue tracking.", schema=TRACKER_SCHEMA, settings_schema=TRACKER_SETTINGS_SCHEMA)
__depends__ = []
@tracker_bp.worker("archive_stale_task")
def _background_archive_stale_tickets(ctx):
    ctx.jobs.update_progress("Sweeping for stale entries...")
    count = archive_stale_tickets(workspace_id=ctx.workspace_id)
    return f"Archived {count} stale tickets."
@hooks.on('workspace_boot')
def schedule_tracker_archiving(workspace_id=None, **kwargs):
    # Schedule background archiving to run silently every 1 hour
    from insetu.kernel.workers import submit_job
    submit_job(f"trk_arch_{workspace_id}", "tracker", "archive_stale_task", interval_ms=3600000, jitter_ms=300000, workspace_id=workspace_id)
@hooks.on('vfs_mutated')
def handle_tracker_vfs_mutations(mutations=None, workspace_id=None, **kwargs):
    if not mutations: return

    ctx = tracker_bp.get_context(workspace_id)

    for m in mutations:
        filepath = m.get("filepath", "")
        op = m.get("operation")

        if ".tracker/" in filepath and filepath.endswith(".md"):
            if op == "save":
                abs_path = ctx.resolve_path(filepath)
                if os.path.exists(abs_path):
                    _parse_and_upsert_ticket(abs_path, filepath, workspace_id)
                    # Offload single-file AST enforcement to prevent synchronous write-blocking
                    ctx.jobs.submit("enforce_tickets_task", specific_file=filepath)
            elif op == "delete":
                ctx.db.execute("DELETE FROM tracker_tickets WHERE filepath = ?", (filepath,))
                ctx.db.commit()
def _parse_and_upsert_ticket(abs_path, rel_path, workspace_id):
    """Surgically parses a single markdown ticket and UPSERTs it into the cache."""
    from insetu.core.utils_core import parse_frontmatter
    ctx = tracker_bp.get_context(workspace_id)
    try:
        content = ctx.vfs.read(rel_path)
        if content is None:
            return

        yaml_data, body, _ = parse_frontmatter(content)

        filename = Path(rel_path).name
        title = yaml_data.get('title', filename)
        t_id = yaml_data.get('id', "UNKNOWN")
        created_at = yaml_data.get('created_at', "0000-00-00T00:00:00")

        closed_at = yaml_data.get('closed_at')
        if str(closed_at).lower() == 'null': closed_at = None

        delivery_date = yaml_data.get('delivery_date')
        if str(delivery_date).lower() == 'null': delivery_date = None
        sub_bucket = yaml_data.get('sub_bucket', "None")
        tags = _parse_list_field(yaml_data.get('tags', '[]'))

        desc = body
        if desc.startswith('## Description'):
            desc = re.sub(r'^## Description\n+', '', desc).strip()
        inferred = Path(rel_path).parent.parent.name.lower()
        if inferred.endswith("s"): inferred = inferred[:-1]

        ticket_type = yaml_data.get('type', inferred if inferred else "todo").lower()
        status = yaml_data.get('status')
        if not status:
            if "/open/" in rel_path: status = "open"
            elif "/active/" in rel_path: status = "active"
            elif "/closed/" in rel_path: status = "closed"
            elif "/archived/" in rel_path: status = "archived"
            elif "/log/" in rel_path: status = "logged"
            else: status = "unknown"
        else:
            status = status.lower()
            if "active" in status: status = "active"
            elif "clos" in status: status = "closed"
            elif "archiv" in status: status = "archived"
            elif "log" in status: status = "logged"
            else: status = "open"
        repo = yaml_data.get('repo', rel_path.split('/')[0] if '/' in rel_path else "unknown")
        tier = _resolve_tier(ctx, repo, ticket_type)
        parent_id = yaml_data.get('parent_id') or yaml_data.get('parent')
        if str(parent_id).lower() in ('null', 'none', ''): parent_id = None
        depends_on = _parse_list_field(yaml_data.get('depends_on', '[]'))
        priority = _parse_string_enum(yaml_data.get('priority'))
        size = _parse_string_enum(yaml_data.get('size'))

        conn = ctx.db
        conn.execute("""
            INSERT OR REPLACE INTO tracker_tickets 
            (id, repo, ticket_type, status, title, description, tags, sub_bucket, created_at, closed_at, delivery_date, filepath, tier, parent_id, depends_on, priority, size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (t_id, repo, ticket_type, status, title, desc, tags, sub_bucket, created_at, closed_at, delivery_date, rel_path, tier, parent_id, depends_on, priority, size))
        conn.commit()
    except Exception as e:
        print(f"Error parsing ticket {rel_path}: {e}")
def _sync_disk_to_db(workspace_id=None):
    from insetu.core.topology.engine_topology import get_topology_files_for_repo
    ctx = tracker_bp.get_context(workspace_id)
    ctx.db.execute("DELETE FROM tracker_tickets")
    repos = [r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")]

    for repo in repos:
        # SSOT Elimination of manual OS walking: Fetch tracked paths from Topology Ledger
        repo_files = get_topology_files_for_repo(workspace_id, repo, strip_prefix=False)
        tracker_files = [f for f in repo_files if '.tracker/' in f and f.endswith('.md')]

        for ws_rel_path in tracker_files:
            abs_path = ctx.resolve_path(ws_rel_path)
            _parse_and_upsert_ticket(abs_path, ws_rel_path, workspace_id)

    ctx.db.commit()
@hooks.on('mutate_workspace_config')
def inject_tracker_config(cfg, workspace_id=None, **kwargs):
    """Dynamically injects the .tracker logic into the core OS pipelines."""
    if "tracker" not in cfg.get("extensions", []): return
    from insetu.core.utils_core import get_safe_repo_id

    ctx = tracker_bp.get_context(workspace_id)
    tracker_cfg = ctx.settings.get_all()
    # 1. Register .tracker as a Cartographer managed directory
    if "managed_dirs" not in cfg:
        cfg["managed_dirs"] = []
    if ".tracker" not in cfg["managed_dirs"]:
        cfg["managed_dirs"].append(".tracker")

    # 2. Force Topology Engine to map .tracker even if the user ignored it
    for repo_cfg in cfg.get("target_repos", []):
        if "ignore_exceptions" not in repo_cfg:
            repo_cfg["ignore_exceptions"] = []
        if ".tracker/" not in repo_cfg["ignore_exceptions"]:
            repo_cfg["ignore_exceptions"].append(".tracker/")

    # 3. Inject the tracker sub-bucket into all mapped repositories
    strat = tracker_cfg.get("domain_strategy", "default")
    custom_val = tracker_cfg.get("domain_custom_value", "")
    isolate_context = tracker_cfg.get("isolate_context", True)
    exclude_from_diffs = tracker_cfg.get("exclude_from_diffs", True)
    include_closed = tracker_cfg.get("include_closed", "grace_period")
    spawn_closed = tracker_cfg.get("spawn_closed", False)
    for repo_cfg in cfg.get("target_repos", []):
        if "sub_buckets" not in repo_cfg:
            repo_cfg["sub_buckets"] = []
        safe_r_dir = get_safe_repo_id(repo_cfg.get("repo_dir", ""))

        domain = "Tracker Issues"
        if strat == "repo":
            domain = repo_cfg.get("domain", "Workspaces")
        elif strat == "custom" and custom_val:
            domain = custom_val

        main_prefixes = [
            ".tracker/todos/open", ".tracker/todos/active", 
            ".tracker/bugs/open", ".tracker/bugs/active", 
            ".tracker/queue/open", ".tracker/queue/active"
        ]
        closed_prefixes = [".tracker/todos/closed", ".tracker/bugs/closed", ".tracker/queue/closed"]
        log_prefixes = [".tracker/log/"]

        if include_closed == "grace_period":
            main_prefixes.extend(closed_prefixes)
        elif include_closed == "all":
            main_prefixes.extend(closed_prefixes)
            main_prefixes.extend(log_prefixes)
        # Clear existing dynamic sub-buckets to apply new logic
        repo_cfg["sub_buckets"] = [b for b in repo_cfg["sub_buckets"] if b.get("id") not in ("tracker", "tracker_closed", "tracker_omitted")]
        if isolate_context:
            repo_cfg["sub_buckets"].insert(0, {
                "id": "tracker",
                "title": f"ISSUE TRACKER ({repo_cfg.get('repo_dir', '').upper()})",
                "domain": domain,
                "match_prefixes": main_prefixes,
                "exclude_from_diffs": exclude_from_diffs,
                "is_system": True
            })

        if include_closed == "none":
            if spawn_closed:
                repo_cfg["sub_buckets"].append({
                    "id": "tracker_closed",
                    "title": f"CLOSED TICKETS ({repo_cfg.get('repo_dir', '').upper()})",
                    "domain": "Closed and Logged Work",
                    "match_prefixes": closed_prefixes + log_prefixes,
                    "exclude_from_diffs": exclude_from_diffs,
                    "is_system": True
                })

        # Conditional Catch-all to prevent unmapped tracker files from bleeding into the default context
        if isolate_context:
            repo_cfg["sub_buckets"].append({
                "id": "tracker_omitted",
                "title": f"OMITTED TICKETS ({repo_cfg.get('repo_dir', '').upper()})",
                "domain": "Hidden Context",
                "match_prefixes": [".tracker/"],
                "exclude_from_diffs": True,
                "is_system": True
            })
        elif include_closed == "none" and not spawn_closed:
            # If not isolated, but closed tickets should be omitted and aren't spawned
            repo_cfg["sub_buckets"].append({
                "id": "tracker_omitted",
                "title": f"OMITTED TICKETS ({repo_cfg.get('repo_dir', '').upper()})",
                "domain": "Hidden Context",
                "match_prefixes": closed_prefixes + log_prefixes,
                "exclude_from_diffs": True,
                "is_system": True
            })
# Declarative definitions for immutable system templates
SYSTEM_SCHEMAS = [
    {
        "id": "agile_basic",
        "name": "Agile Basic (Coding)",
        "t1_label": "Epics", "t1_types": "epic",
        "t2_label": "Sprints", "t2_types": "sprint",
        "t3_label": "Tasks", "t3_types": "todo, bug, queue"
    },
    {
        "id": "publish_funnel",
        "name": "Publish and Promote Funnel",
        "t1_label": "Campaigns", "t1_types": "campaign",
        "t2_label": "Content Pieces", "t2_types": "article, video",
        "t3_label": "Tasks", "t3_types": "draft, edit, publish"
    }
]

def _resolve_tier(ctx, repo, ticket_type):
    """DRY Helper: Resolves the integer tier of a ticket based on active Kanban schemas."""
    kanban_repo_map = ctx.settings.get("kanban_repo_map", {})
    kanban_profiles = ctx.settings.get("kanban_profiles", [])
    schema_id = kanban_repo_map.get(repo, "agile_basic")

    # Safely merge System Schemas with the user's Custom Schemas
    active_schemas = SYSTEM_SCHEMAS + kanban_profiles
    schema = next((s for s in active_schemas if s.get("id") == schema_id), None)

    if schema:
        t1 = [t.strip().lower() for t in schema.get("t1_types", "").split(",")]
        t2 = [t.strip().lower() for t in schema.get("t2_types", "").split(",")]
        if ticket_type in t1: return 1
        elif ticket_type in t2: return 2
    return 3

def get_tracker_path(repo, ticket_type, status):
    """Resolves the relative directory for a ticket based on your taxonomy."""
    base = f"{repo}/.tracker"
    if status == "archived":
        return f"{base}/log/archived"
    elif status == "logged":
        return f"{base}/log"

    folder_type = "queue" if ticket_type == "queue" else f"{ticket_type}s"
    return f"{base}/{folder_type}/{status}"
def create_ticket(ctx, repo, ticket_type, status, title, description, tags="", sub_bucket="None", delivery_date=None, parent_id=None, depends_on="", priority="", size=""):
    """Generates the physical Markdown file with YAML frontmatter."""
    from insetu.core.utils_core import update_frontmatter
    tier = _resolve_tier(ctx, repo, ticket_type)

    repo_prefix = repo.split("-")[-1].upper()[:3] if "-" in repo else repo.upper()[:3]
    if not repo_prefix: repo_prefix = "TKT"

    now = datetime.now()
    timestamp = now.strftime("%Y%m%d_%H%M")
    ticket_id = f"{repo_prefix}-{ticket_type.upper()}-{timestamp}"
    filename = f"{ticket_id}.md"

    target_dir = get_tracker_path(repo, ticket_type, status)

    raw_content = f"## Description\n{description}\n\n## Notes / Execution Log\n"

    tags_list = [t.strip() for t in tags.split(',') if t.strip()]
    deps_list = [d.strip() for d in depends_on.split(',') if d.strip()]

    yaml_data = {
        "repo": repo,
        "type": ticket_type,
        "status": status,
        "id": ticket_id,
        "title": title.replace('"', "'"),
        "created_at": now.isoformat(timespec='seconds'),
        "closed_at": "null",
        "sub_bucket": sub_bucket
    }
    if priority: yaml_data["priority"] = priority.upper()
    if size: yaml_data["size"] = size.upper()
    if parent_id: yaml_data["parent_id"] = parent_id
    if deps_list: yaml_data["depends_on"] = json.dumps(deps_list)
    if tags_list: yaml_data["tags"] = json.dumps(tags_list)
    if delivery_date: yaml_data["delivery_date"] = delivery_date

    content = update_frontmatter(raw_content, yaml_data)

    folder_type = "queue" if ticket_type == "queue" else f"{ticket_type}s"
    ticket_path = f"{repo}/.tracker/{folder_type}/{status}/{filename}"

    conn = ctx.db
    conn.execute("""
        INSERT OR REPLACE INTO tracker_tickets 
        (id, repo, ticket_type, status, title, description, tags, sub_bucket, created_at, closed_at, delivery_date, filepath, tier, parent_id, depends_on, priority, size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (ticket_id, repo, ticket_type, status, title, description, json.dumps(tags_list), sub_bucket, now.isoformat(), None, delivery_date, ticket_path, int(tier), parent_id, json.dumps(deps_list), priority.upper(), size.upper()))
    conn.commit()

    ctx.vfs.save(ticket_path, content)
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
@tracker_bp.worker("harmonize_vocab_task")
def _background_harmonize_vocabulary(ctx, renames=None, **kwargs):
    """Background Metronome job to migrate physical Markdown files to new semantic types."""
    if not renames: return
    from insetu.core.utils_core import parse_frontmatter
    import json
    conn = ctx.db
    try:
        for rename in renames:
            old_type = rename.get('old', '').lower()
            new_type = rename.get('new', '').lower()
            target_repo = rename.get('repo')
            if not old_type or not new_type: continue

            # 1. Isolate target files using the CQRS cache
            if target_repo:
                cursor = conn.execute("SELECT filepath, status, repo FROM tracker_tickets WHERE ticket_type = ? AND repo = ?", (old_type, target_repo))
            else:
                cursor = conn.execute("SELECT filepath, status, repo FROM tracker_tickets WHERE ticket_type = ?", (old_type,))
            for row in cursor.fetchall():
                old_rel_path = row['filepath']
                status = row['status']
                repo = row['repo']

                content = ctx.vfs.read(old_rel_path)
                if not content: continue

                yaml_data, body, _ = parse_frontmatter(content)
                yaml_data['type'] = new_type

                # Recalculate target path
                from pathlib import Path
                filename = Path(old_rel_path).name
                new_rel_path = f".tracker/{new_type}/{status}/{filename}"
                # Reconstruct MaC payload (preserving structure, updating type)
                from insetu.core.utils_core import update_frontmatter
                new_content = update_frontmatter(content, yaml_data)
                # Execute async VFS transactions
                ctx.vfs.save(new_rel_path, new_content)
                if new_rel_path != old_rel_path:
                    ctx.vfs.delete(old_rel_path)
    finally:
        # Release the UI Mutex lock reliably
        ctx.settings.set("tracker_is_migrating", False)


def transition_ticket(ctx, repo, current_rel_path, new_status, new_type=None):
    """Moves a ticket across the ecosystem and stamps the close date if applicable."""
    from insetu.core.utils_core import update_frontmatter, parse_frontmatter

    content = ctx.vfs.read(current_rel_path)
    if content is None:
        raise FileNotFoundError(f"Ticket not found: {current_rel_path}")

    filename = Path(current_rel_path).name
    yaml_data, body, _ = parse_frontmatter(content)

    # SSOT: Read the active type directly from the file's declarative state
    ticket_type = yaml_data.get("type", "todo").lower()
    if new_type: ticket_type = new_type

    if new_status in ["closed", "logged", "archived"] and (yaml_data.get("closed_at") in ["null", None, ""]):
        yaml_data["closed_at"] = datetime.now().isoformat(timespec='seconds')

    yaml_data["status"] = new_status
    if new_type: yaml_data["type"] = new_type

    content = update_frontmatter(content, yaml_data)

    if new_status == "archived":
        new_rel_path = f"{repo}/.tracker/log/archived/{filename}"
    elif new_status == "logged":
        new_rel_path = f"{repo}/.tracker/log/{filename}"
    else:
        folder_type = "queue" if ticket_type == "queue" else f"{ticket_type}s"
        new_rel_path = f"{repo}/.tracker/{folder_type}/{new_status}/{filename}"

    ctx.vfs.save(new_rel_path, content, data={"delete_source": current_rel_path if current_rel_path != new_rel_path else None})
    tier = _resolve_tier(ctx, repo, ticket_type)

    conn = ctx.db
    conn.execute("""
        UPDATE tracker_tickets 
        SET status = ?, filepath = ?, ticket_type = ?, closed_at = ?, tier = ?
        WHERE filepath = ?
    """, (new_status, new_rel_path, ticket_type, datetime.now().isoformat() if new_status == "closed" else None, tier, current_rel_path))
    conn.commit()

    return new_rel_path
@tracker_bp.worker("enforce_tickets_task")
def _background_enforce_tickets(ctx, specific_file=None, **kwargs):
    ctx.jobs.update_progress("Enforcing declarative ticket states...")
    enforce_declarative_tickets(workspace_id=ctx.workspace_id, specific_file=specific_file)
    return "Ticket housekeeping complete."
@tracker_bp.worker("sync_cache_task")
def _background_sync_cache(ctx, **kwargs):
    ctx.jobs.update_progress("Hydrating tracker cache...")
    _sync_disk_to_db(ctx.workspace_id)
    ctx.jobs.submit("enforce_tickets_task")
    return "Cache hydrated."

@hooks.on('topology_boot_complete')
@hooks.on('force_topology_scan')
def manual_tracker_housekeeping(workspace_id=None, **kwargs):
    """Hydrates Tracker safely after Topology maps the workspace, or on manual refresh."""
    ctx = tracker_bp.get_context(workspace_id)
    ctx.jobs.submit("sync_cache_task")

def enforce_declarative_tickets(workspace_id=None, specific_file=None):
    """
    SSOT Enforcer: Sweeps all .tracker directories (or a specific file). 
    If the physical path contradicts the YAML, the YAML wins -> file is moved.
    If the YAML is missing fields, the physical path infers them -> YAML is rewritten.
    """
    from insetu.core.topology.engine_topology import topology_bp
    ctx = tracker_bp.get_context(workspace_id)
    repos = [r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")]
    cfg = ctx.config
    enforced_count = 0

    valid_buckets_by_repo = {}
    for c in cfg.get("target_repos", []):
        r = c.get("repo_dir")
        buckets = {"None", "tracker"}
        for b in c.get("sub_buckets", []):
            if b.get("id"): buckets.add(b["id"])
            if b.get("meta_map"): buckets.update(b["meta_map"].keys())
        valid_buckets_by_repo[r] = buckets
    target_files = []
    if specific_file:
        target_files.append((specific_file.split('/')[0], specific_file))
    else:
        from insetu.core.topology.engine_topology import get_topology_files_for_repo
        for current_repo in repos:
            repo_files = get_topology_files_for_repo(workspace_id, current_repo, strip_prefix=False)
            tracker_files = [f for f in repo_files if '.tracker/' in f and f.endswith('.md')]
            for f in tracker_files:
                target_files.append((current_repo, f))

    # Pre-fetch the cache ledger to eliminate O(N) query scaling leaks
    cache_ledger = {}
    try:
        conn = ctx.db
        for row in conn.execute("SELECT id, status, created_at, closed_at, tier, parent_id, depends_on, priority, size FROM tracker_tickets").fetchall():
            cache_ledger[row['id']] = row
    except Exception:
        pass

    for current_repo, ws_rel_path in target_files:
        tracker_rel_base = f"{current_repo}/.tracker"

        if True:
            filename = Path(ws_rel_path).name
            filepath = ctx.resolve_path(ws_rel_path)
            rel_dir = Path(ws_rel_path[len(tracker_rel_base)+1:]).parent.as_posix()
            if rel_dir == '.': rel_dir = ''
            rel_dir_lower = rel_dir.lower()

            # Infer current state from path as fallback, defaulting to todo
            inferred_type = "todo"
            parts = [p for p in rel_dir_lower.split('/') if p]
            if parts and parts[0] != "log":
                inferred_type = parts[0][:-1] if parts[0].endswith("s") else parts[0]

            inferred_status = "open"
            if "active" in rel_dir_lower: inferred_status = "active"
            elif "close" in rel_dir_lower: inferred_status = "closed"
            elif "archive" in rel_dir_lower: inferred_status = "archived"
            elif "log" in rel_dir_lower: inferred_status = "logged"
            try:
                content = ctx.vfs.read(ws_rel_path)
                if content is None:
                    continue

                from insetu.core.utils_core import parse_frontmatter, update_frontmatter
                yaml_data, body, yaml_match = parse_frontmatter(content)

                # Read declarative values or fallback to inferred values if missing
                raw_repo = yaml_data.get('repo', current_repo)
                decl_repo = raw_repo if raw_repo in repos else current_repo
                hallucinated_tags = []
                if raw_repo != decl_repo and raw_repo and raw_repo.lower() != 'none':
                    hallucinated_tags.append(raw_repo.replace(' ', '-').replace('"', ''))

                # Dynamic validation: Clamp AI hallucinations back to the repository's configured vocabulary
                kanban_repo_map = ctx.settings.get("kanban_repo_map", {})
                kanban_profiles = ctx.settings.get("kanban_profiles", [])
                schema_id = kanban_repo_map.get(decl_repo, "agile_basic")
                active_schemas = SYSTEM_SCHEMAS + kanban_profiles
                schema = next((s for s in active_schemas if s.get("id") == schema_id), None)

                valid_types = []
                if schema:
                    for t_key in ["t1_types", "t2_types", "t3_types"]:
                        valid_types.extend([x.strip().lower() for x in schema.get(t_key, "").split(",") if x.strip()])
                if not valid_types: valid_types = ["todo", "bug", "queue"]

                # Attempt to rescue sub-bucket categorizations from messy AI-generated folders
                inferred_sub_bucket = "None"
                standard_dirs = {"closed", "open", "active", "archived", "logged", ".", "log"}
                for vt in valid_types:
                    standard_dirs.add(vt)
                    standard_dirs.add(f"{vt}s")

                for part in rel_dir.split('/'):
                    if part and part.lower() not in standard_dirs:
                        inferred_sub_bucket = part
                        break

                raw_type = yaml_data.get('type', inferred_type).lower()
                if raw_type in valid_types:
                    decl_type = raw_type
                else:
                    # Heuristic rescue for legacy types, otherwise fallback to the primary Tier 3 type
                    if "bug" in raw_type and "bug" in valid_types: decl_type = "bug"
                    elif "todo" in raw_type and "todo" in valid_types: decl_type = "todo"
                    elif "queue" in raw_type and "queue" in valid_types: decl_type = "queue"
                    else: decl_type = valid_types[0]

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
                db_tier = 3
                db_parent = None
                db_deps = "[]"
                db_prio = ""
                db_size = ""

                cache_row = cache_ledger.get(decl_id)
                if cache_row:
                    db_status = cache_row['status']
                    db_created_at = cache_row['created_at']
                    db_closed_at = cache_row['closed_at']
                    db_tier = cache_row['tier']
                    db_parent = cache_row['parent_id']
                    db_deps = cache_row['depends_on']
                    db_prio = cache_row['priority'] or ""
                    db_size = cache_row['size'] or ""

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
                    if bad_type.lower() not in valid_types and bad_type:
                        decl_sub = bad_type
                    else:
                        decl_sub = inferred_sub_bucket

                # Validate sub_bucket against config.json
                valid_buckets = valid_buckets_by_repo.get(decl_repo, {"None", "tracker"})
                if decl_sub not in valid_buckets:
                    if decl_sub and decl_sub.lower() != 'none':
                        hallucinated_tags.append(decl_sub.replace(' ', '-').replace('"', ''))
                    decl_sub = "None"

                # Leverage the centralized parser, then decode to safely append hallucinated tags
                decl_tags_str = _parse_list_field(yaml_data.get('tags', '[]'))
                decl_tags_list = json.loads(decl_tags_str)

                for ht in hallucinated_tags:
                    if ht not in decl_tags_list: decl_tags_list.append(ht)

                decl_tags = json.dumps(decl_tags_list) if decl_tags_list else '[]'
                # Determine if we need to rewrite YAML (fields missing or mismatched)
                needs_rewrite = (
                    'repo' not in yaml_data or 'type' not in yaml_data or 
                    'status' not in yaml_data or yaml_data.get('closed_at', '').lower() != decl_closed.lower() or
                    yaml_data.get('status') != decl_status or yaml_data.get('type') != decl_type
                )
                # Determine intended physical destination based on declarative state
                intended_dir = get_tracker_path(decl_repo, decl_type, decl_status)
                intended_filename = f"{decl_id}.md"
                intended_rel_path = f"{intended_dir}/{intended_filename}"
                current_rel_path = ws_rel_path
                intended_path = ctx.resolve_path(intended_rel_path)
                # Self-Healing: Duplicate / Ghost File Detection
                if current_rel_path != intended_rel_path and Path(intended_path).exists():
                    current_mtime = Path(filepath).stat().st_mtime
                    intended_mtime = Path(intended_path).stat().st_mtime

                    should_delete_ghost = (intended_mtime >= current_mtime)

                    # Lazy Evaluation: Only execute the expensive disk read if the mtime check fails 
                    # AND the file sizes are identical (a cheap heuristic for identical content).
                    if not should_delete_ghost and Path(filepath).stat().st_size == Path(intended_path).stat().st_size:
                        f_int_content = ctx.vfs.read(intended_rel_path)
                        should_delete_ghost = (content == f_int_content)

                    if should_delete_ghost:
                        ctx.vfs.delete(current_rel_path)
                        continue
                if current_rel_path != intended_rel_path or needs_rewrite:
                    # Extract and preserve structural attributes
                    decl_parent_id = yaml_data.get('parent_id') or yaml_data.get('parent') or db_parent
                    if str(decl_parent_id).lower() in ('null', 'none', ''): decl_parent_id = None
                    decl_depends_on = _parse_list_field(yaml_data.get('depends_on', db_deps))
                    decl_priority = _parse_string_enum(yaml_data.get('priority', db_prio))
                    decl_size = _parse_string_enum(yaml_data.get('size', db_size))
                    # Reconstruct pristine YAML
                    from insetu.core.utils_core import update_frontmatter
                    new_data = {
                        "repo": decl_repo,
                        "type": decl_type,
                        "status": decl_status,
                        "id": decl_id,
                        "title": decl_title,
                        "created_at": decl_created,
                        "closed_at": decl_closed,
                        "sub_bucket": decl_sub
                    }
                    if decl_priority: new_data["priority"] = decl_priority
                    if decl_size: new_data["size"] = decl_size
                    if decl_parent_id: new_data["parent_id"] = decl_parent_id

                    try:
                        if decl_depends_on and decl_depends_on != '[]': new_data["depends_on"] = json.loads(decl_depends_on)
                    except Exception: pass
                    try:
                        if decl_tags and decl_tags != '[]': new_data["tags"] = json.loads(decl_tags)
                    except Exception: pass

                    new_content = update_frontmatter(content, new_data)
                    ctx.vfs.save(intended_rel_path, new_content, data={"delete_source": current_rel_path if current_rel_path != intended_rel_path else None})
                    enforced_count += 1
            except Exception as e:
                print(f"Warning: Ticket Housekeeping failed on {ws_rel_path}: {e}")

    return enforced_count
def archive_stale_tickets(workspace_id=None):
    """Sweeps all repos for tickets passing the dynamic log and archive thresholds."""
    ctx = tracker_bp.get_context(workspace_id)
    tracker_cfg = ctx.settings.get_all()

    grace_days = int(tracker_cfg.get("grace_period_days", 7))
    auto_archive = tracker_cfg.get("auto_archive", True)
    archive_days = int(tracker_cfg.get("archive_days", 30))

    repos = [r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")]
    date_grace = datetime.now() - timedelta(days=grace_days)
    date_archive = datetime.now() - timedelta(days=archive_days)
    archived_count = 0

    for repo in repos:
        # Sweep 1: Move >grace_period day closed tickets to log
        for folder_type in ["todos", "bugs", "queue"]:
            closed_dir_rel = f"{repo}/.tracker/{folder_type}/closed"
            for ws_rel_path in ctx.vfs.walk(closed_dir_rel, exts=['.md']):
                filename = Path(ws_rel_path).name
                content = ctx.vfs.read(ws_rel_path)
                if content:
                    closed_date = _extract_closed_date(content)
                    if closed_date and closed_date < date_grace:
                        content = re.sub(r"status:\s*\"?closed\"?", 'status: "logged"', content)
                        new_rel_path = f"{repo}/.tracker/log/{filename}"
                        old_rel_path = f"{repo}/.tracker/{folder_type}/closed/{filename}"
                        ctx.vfs.save(new_rel_path, content, data={"delete_source": old_rel_path})
                        archived_count += 1
        # Sweep 2: Move >archive_days day logged tickets to archive
        if auto_archive:
            log_dir_rel = f"{repo}/.tracker/log"
            for ws_rel_path in ctx.vfs.walk(log_dir_rel, exts=['.md']):
                filename = Path(ws_rel_path).name
                # Skip archived folder contents
                if "archived" in ws_rel_path:
                    continue

                content = ctx.vfs.read(ws_rel_path)
                if content:
                    closed_date = _extract_closed_date(content)
                    if closed_date and closed_date < date_archive:
                        content = re.sub(r"status:\s*\"?logged\"?", 'status: "archived"', content)
                        new_rel_path = f"{repo}/.tracker/log/archived/{filename}"
                        old_rel_path = f"{repo}/.tracker/log/{filename}"
                        ctx.vfs.save(new_rel_path, content, data={"delete_source": old_rel_path})
                        archived_count += 1

    return archived_count
@tracker_bp.route('system_schemas', methods=['GET'])
def api_tracker_system_schemas(ctx):
    """SSOT: Provides the immutable system schemas to the frontend."""
    from flask import jsonify
    # Hydrate the isSystem flag dynamically over the wire
    hydrated_schemas = [{**s, "isSystem": True} for s in SYSTEM_SCHEMAS]
    return jsonify({"system_schemas": hydrated_schemas})
@tracker_bp.route('vocab_settings', methods=['POST'])
def save_vocab_settings(ctx):
    """Intercepts vocabulary changes to trigger the background harmonization engine."""
    from flask import jsonify

    data = ctx.req.json
    repo = ctx.req.args.get('repo')

    payload = {}
    for key in ['hierarchy_labels', 'kanban_profiles', 'kanban_repo_map', 'parent_tabs', 'global_views']:
        if key in data:
            payload[key] = data[key]
    if payload:
        ctx.settings.update(payload, repo=repo)

    # Emit settings update hook so ecosystem components (like RAG compiler) can react
    ctx.emit('tracker_settings_updated')

    renames = data.get('renames', [])
    if renames:
        ctx.settings.set('tracker_is_migrating', True)
        job_id = ctx.jobs.submit("harmonize_vocab_task", renames=renames)
        return jsonify({"status": "accepted", "job_id": job_id}), 202

    return jsonify({"status": "ok", "migrating": False})

@tracker_bp.route('new', methods=['POST'])
def api_tracker_new(ctx):
    data = ctx.req.json
    try:
        new_path = create_ticket(
            ctx=ctx,
            repo=data['repo'], 
            ticket_type=data['type'], 
            status=data['status'], 
            title=data['title'], 
            description=data['description'],
            tags=data.get('tags', ''),
            sub_bucket=data.get('sub_bucket', 'None'),
            delivery_date=data.get('delivery_date'),
            parent_id=data.get('parent_id'),
            depends_on=data.get('depends_on', ''),
            priority=data.get('priority', ''),
            size=data.get('size', '')
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
            ctx.jobs.submit("sync_cache_task")
            return jsonify({"tasks": [], "hydrating": True})

        include_archived = ctx.settings.get("include_archived_in_log", False)

        # Ensure proper boolean conversion in case the JSON config stored it as a string
        if isinstance(include_archived, str):
            include_archived = include_archived.lower() == 'true'

        if include_archived:
            cursor = conn.execute("SELECT * FROM tracker_tickets")
        else:
            cursor = conn.execute("SELECT * FROM tracker_tickets WHERE status != 'archived'")
        tasks = []
        for row in cursor.fetchall():
            tags_parsed = []
            if row['tags']:
                try:
                    tags_parsed = json.loads(row['tags'])
                    if not isinstance(tags_parsed, list):
                        tags_parsed = [str(tags_parsed)]
                except Exception:
                    tags_parsed = [t.strip() for t in str(row['tags']).split(',') if t.strip()]
            try:
                depends_on_parsed = json.loads(row['depends_on']) if row['depends_on'] else []
            except Exception:
                depends_on_parsed = []
            tasks.append({
                "id": row['id'],
                "repo": row['repo'],
                "tier": row['tier'],
                "parentId": row['parent_id'],
                "dependsOn": depends_on_parsed,
                "priority": row['priority'] or '',
                "size": row['size'] or '',
                "ticket_type": row['ticket_type'],
                "isTodo": row['ticket_type'] == 'todo',
                "isBug": row['ticket_type'] == 'bug',
                "isQueue": row['ticket_type'] == 'queue',
                "status": row['status'],
                "title": row['title'],
                "description": row['description'],
                "tags": tags_parsed,
                "subBucket": row['sub_bucket'],
                "timestamp": row['created_at'],
                "closedAt": row['closed_at'],
                "deliveryDate": row['delivery_date'],
                "filepath": row['filepath']
            })
        return jsonify({"tasks": tasks})
    except Exception as e:
        print(f"⚠️ [Tracker Error] api_tracker_files failed: {e}")
        return jsonify({"error": str(e)}), 500
@tracker_bp.route('transition', methods=['POST'])
def api_tracker_transition(ctx):
    data = ctx.req.json
    try:
        new_path = transition_ticket(
            ctx=ctx,
            repo=data['repo'], 
            current_rel_path=data['filepath'], 
            new_status=data['new_status'],
            new_type=data.get('new_type')
        )
        return jsonify({"status": "success", "new_filepath": new_path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@hooks.on('request_changelog_suggestions')
def provide_changelog_suggestions(repo, workspace_id=None, **kwargs):
    """Provides recent closed tickets to other extensions (like Git) without exposing DB internals."""
    ctx = tracker_bp.get_context(workspace_id)
    include_archived = ctx.settings.get("include_archived_in_log", False)

    # Ensure proper boolean conversion in case the JSON config stored it as a string
    if isinstance(include_archived, str):
        include_archived = include_archived.lower() == 'true'

    # We include 'logged' gracefully alongside 'closed' to capture recent grace-period tickets
    status_filter = "status IN ('closed', 'logged', 'archived')" if include_archived else "status IN ('closed', 'logged')"
    changelogs = []
    try:
        conn = ctx.db
        cursor = conn.execute(f"""
            SELECT title FROM tracker_tickets 
            WHERE repo = ? AND {status_filter} 
            ORDER BY COALESCE(closed_at, created_at) DESC LIMIT 10
        """, (repo,))
        for row in cursor.fetchall():
            changelogs.append({"title": row['title']})
    except Exception:
        pass
    return changelogs
@hooks.on('tracker_settings_updated')
def on_tracker_settings_updated(workspace_id=None, **kwargs):
    """Event Bus hook: Rebuilds context payloads immediately when tracker settings are updated."""
    import json
    import uuid
    import insetu.kernel.workers as workers
    job_id = f"cmp_{uuid.uuid4().hex[:8]}"
    workers.submit_immediate_job(job_id, "gather", "compile_contexts", json.dumps({"force_full": True}), workspace_id=workspace_id)
    return {"job_id": job_id}