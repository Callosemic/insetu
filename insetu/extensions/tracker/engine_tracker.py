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
def _normalize_status(raw_status, fallback="open"):
    if not raw_status: return fallback
    s = str(raw_status).lower()
    if "active" in s: return "active"
    if "clos" in s: return "closed"
    if "archiv" in s: return "archived"
    if "log" in s: return "logged"
    if "template" in s: return "template"
    return fallback

def _canonicalize_repo(ctx, repo_name):
    if not repo_name or str(repo_name).lower() in ('null', 'none', ''):
        return 'unknown'
    repos = [r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")]
    for r in repos:
        if r.lower() == str(repo_name).lower():
            return r
    return str(repo_name)

DEFAULT_GLOBAL_VIEWS = [
    { "_uuid": "sys_v1", "id": "epics", "label": "🎯 Epics", "target_tier": 1, "layout": "stacked", "filters": { "ticket_types": "epic, campaign", "statuses": "open, active" }, "repo_strategy": "global", "explicit_repos": [] },
    { "_uuid": "sys_v2", "id": "sprints", "label": "📦 Sprints", "target_tier": 2, "layout": "stacked", "filters": { "ticket_types": "sprint, article, video", "statuses": "open, active" }, "repo_strategy": "global", "explicit_repos": [] },
    { "_uuid": "sys_v3", "id": "todos", "label": "📄 To-Dos", "target_tier": 3, "layout": "columns", "filters": { "ticket_types": "todo, draft", "statuses": "open, active, closed" }, "repo_strategy": "global", "explicit_repos": [] },
    { "_uuid": "sys_v4", "id": "bugs", "label": "🐛 Bugs", "target_tier": 3, "layout": "columns", "filters": { "ticket_types": "bug, edit", "statuses": "open, active, closed" }, "repo_strategy": "global", "explicit_repos": [] },
    { "_uuid": "sys_v5", "id": "queue", "label": "🔬 Queue", "target_tier": 3, "layout": "columns", "filters": { "ticket_types": "queue, publish", "statuses": "open, active, closed" }, "repo_strategy": "global", "explicit_repos": [] },
    { "_uuid": "sys_v6", "id": "log", "label": "📜 Log", "target_tier": None, "layout": "log", "filters": { "ticket_types": "", "statuses": "closed, logged, archived" }, "repo_strategy": "global", "explicit_repos": [] }
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
def _background_archive_stale_tickets(ctx, **kwargs):
    ctx.jobs.update_progress("Sweeping for stale entries...")
    count = archive_stale_tickets(workspace_id=ctx.workspace_id)
    return f"Archived {count} stale tickets."
@hooks.on('workspace_boot')
def initialize_tracker_schemas(workspace_id=None, **kwargs):
    # Phase 1: Initialize hardware-accelerated query indexes on the tickets ledger
    ctx = tracker_bp.get_context(workspace_id)
    try:
        ctx.db.execute("CREATE INDEX IF NOT EXISTS idx_tracker_repo ON tracker_tickets(repo)")
        ctx.db.execute("CREATE INDEX IF NOT EXISTS idx_tracker_status ON tracker_tickets(status)")
        ctx.db.execute("CREATE INDEX IF NOT EXISTS idx_tracker_tier ON tracker_tickets(tier)")
        ctx.db.execute("CREATE INDEX IF NOT EXISTS idx_tracker_sub_bucket ON tracker_tickets(sub_bucket)")
        ctx.db.commit()
    except Exception:
        pass

@hooks.on('topology_boot_complete')
def schedule_tracker_archiving(workspace_id=None, **kwargs):
    # Phase 2: Schedule background archiving to run silently every 1 hour
    from insetu.kernel.workers import submit_job
    submit_job(f"trk_arch_{workspace_id}", "tracker", "archive_stale_task", interval_ms=3600000, jitter_ms=300000, workspace_id=workspace_id)
@hooks.on('vfs_mutated')
def handle_tracker_vfs_mutations(mutations=None, workspace_id=None, **kwargs):
    if not mutations: return

    ctx = tracker_bp.get_context(workspace_id)

    for m in mutations:
        filepath = m.get("filepath", "")
        op = m.get("operation")

        repo_dir, clean_rel = ctx.parse_uri(filepath)
        canonical_rel_path = f"{repo_dir}/{clean_rel}" if repo_dir else clean_rel

        if ".tracker/" in canonical_rel_path and canonical_rel_path.endswith(".md"):
            if op == "save":
                abs_path = ctx.resolve_path(canonical_rel_path)
                if os.path.exists(abs_path):
                    _parse_and_upsert_ticket(abs_path, canonical_rel_path, workspace_id)
                    # Offload single-file AST enforcement to prevent synchronous write-blocking
                    ctx.jobs.submit("enforce_tickets_task", specific_file=canonical_rel_path)
            elif op == "delete":
                ctx.db.execute("DELETE FROM tracker_tickets WHERE filepath = ?", (canonical_rel_path,))
                ctx.db.commit()
def _parse_and_upsert_ticket(abs_path, rel_path, workspace_id):
    """Surgically parses a single markdown ticket and UPSERTs it into the cache."""
    from insetu.core.utils_core import parse_frontmatter, clean_date_str, parse_list_field, parse_string_enum
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
        created_at = clean_date_str(yaml_data.get('created_at')) or yaml_data.get('created_at', "0000-00-00T00:00:00")
        closed_at = clean_date_str(yaml_data.get('closed_at'))
        delivery_date = clean_date_str(yaml_data.get('delivery_date'))

        sub_bucket = yaml_data.get('sub_bucket', "None")
        tags = parse_list_field(yaml_data.get('tags', '[]'))

        desc = body
        if desc.startswith('## Description'):
            desc = re.sub(r'^## Description\n+', '', desc).strip()
        inferred = Path(rel_path).parent.parent.name.lower()
        if inferred.endswith("s"): inferred = inferred[:-1]

        ticket_type = yaml_data.get('type', inferred if inferred else "task").lower()
        inferred_status = "unknown"
        if "/open/" in rel_path: inferred_status = "open"
        elif "/active/" in rel_path: inferred_status = "active"
        elif "/closed/" in rel_path: inferred_status = "closed"
        elif "/archived/" in rel_path: inferred_status = "archived"
        elif "/log/" in rel_path: inferred_status = "logged"
        elif "/template/" in rel_path: inferred_status = "template"

        status = _normalize_status(yaml_data.get('status'), fallback=inferred_status)

        repo_dir, _ = ctx.parse_uri(rel_path)
        raw_repo = yaml_data.get('repo') or repo_dir or "unknown"
        repo = _canonicalize_repo(ctx, raw_repo)
        tier = yaml_data.get('tier')
        if tier is None:
            tier = _resolve_tier(ctx, repo, ticket_type)
        parent_id = yaml_data.get('parent_id') or yaml_data.get('parent')
        if str(parent_id).lower() in ('null', 'none', ''): parent_id = None
        depends_on = parse_list_field(yaml_data.get('depends_on', '[]'))
        priority = parse_string_enum(yaml_data.get('priority'))
        size = parse_string_enum(yaml_data.get('size'))

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
        repo_dir = repo_cfg.get("repo_dir", "")
        schema = _get_schema(ctx, repo_dir)
        valid_types = _get_valid_types(schema)

        main_prefixes = []
        closed_prefixes = []
        for vt in valid_types:
            folder = vt if vt.endswith('s') or vt == 'queue' else f"{vt}s"
            main_prefixes.extend([f".tracker/{folder}/open", f".tracker/{folder}/active"])
            closed_prefixes.append(f".tracker/{folder}/closed")

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
def _get_schema(ctx, repo):
    """DRY Helper: Retrieves the active merged schema for a given repository."""
    kanban_repo_map = ctx.settings.get("kanban_repo_map", {})
    kanban_profiles = ctx.settings.get("kanban_profiles", [])
    schema_id = kanban_repo_map.get(repo, "agile_basic")
    active_schemas = SYSTEM_SCHEMAS + kanban_profiles
    return next((s for s in active_schemas if s.get("id") == schema_id), None)

def _get_valid_types(schema):
    """DRY Helper: Extracts all valid ticket types from a schema."""
    valid_types = []
    if schema:
        for t_key in ["t1_types", "t2_types", "t3_types"]:
            valid_types.extend([x.strip().lower() for x in schema.get(t_key, "").split(",") if x.strip()])
    return valid_types or ["todo", "bug", "queue"]

def _resolve_tier(ctx, repo, ticket_type):
    """DRY Helper: Resolves the integer tier of a ticket based on active Kanban schemas."""
    schema = _get_schema(ctx, repo)
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

    # Smart pluralization: avoid double 's' and handle known uncountables dynamically
    folder_type = ticket_type if ticket_type.endswith('s') or ticket_type == 'queue' else f"{ticket_type}s"
    return f"{base}/{folder_type}/{status}"
def create_ticket(ctx, repo, ticket_type, status, title, description, tags="", sub_bucket="None", delivery_date=None, parent_id=None, depends_on="", priority="", size="", ticket_id=None, tier=None):
    """Generates the physical Markdown file with YAML frontmatter."""
    from insetu.core.utils_core import update_frontmatter
    if tier is None:
        tier = _resolve_tier(ctx, repo, ticket_type)

    now = datetime.now()

    if not ticket_id:
        repo_prefix = repo.split("-")[-1].upper()[:3] if "-" in repo else repo.upper()[:3]
        if not repo_prefix: repo_prefix = "TKT"

        timestamp = now.strftime("%Y%m%d_%H%M%S") # Include seconds to prevent rapid-fire collisions
        import random
        entropy = f"{random.getrandbits(16):04x}".upper()
        ticket_id = f"{repo_prefix}-{ticket_type.upper()}-{timestamp}-{entropy}"

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
        "sub_bucket": sub_bucket,
        "tier": int(tier)
    }
    if priority: yaml_data["priority"] = priority.upper()
    if size: yaml_data["size"] = size.upper()
    if parent_id: yaml_data["parent_id"] = parent_id
    if deps_list: yaml_data["depends_on"] = deps_list
    if tags_list: yaml_data["tags"] = tags_list
    if delivery_date: yaml_data["delivery_date"] = delivery_date
    content = update_frontmatter(raw_content, yaml_data)

    ticket_path = Path(target_dir).joinpath(filename).as_posix()

    conn = ctx.db
    conn.execute("""
        INSERT OR REPLACE INTO tracker_tickets 
        (id, repo, ticket_type, status, title, description, tags, sub_bucket, created_at, closed_at, delivery_date, filepath, tier, parent_id, depends_on, priority, size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (ticket_id, repo, ticket_type, status, title, description, json.dumps(tags_list), sub_bucket, now.isoformat(), None, delivery_date, ticket_path, int(tier), parent_id, json.dumps(deps_list), priority.upper(), size.upper()))
    conn.commit()

    ctx.vfs.save(ticket_path, content)
    return ticket_path
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
                new_rel_path = Path(get_tracker_path(repo, new_type, status)).joinpath(filename).as_posix()
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
    from insetu.core.utils_core import update_frontmatter, parse_frontmatter, parse_list_field

    repo_dir, clean_rel = ctx.parse_uri(current_rel_path)
    canonical_current_rel = f"{repo_dir}/{clean_rel}" if repo_dir else clean_rel

    content = ctx.vfs.read(canonical_current_rel)
    if content is None:
        raise FileNotFoundError(f"Ticket not found: {canonical_current_rel}")

    filename = Path(canonical_current_rel).name
    yaml_data, body, _ = parse_frontmatter(content)
    # SSOT: Read the active type directly from the file's declarative state
    ticket_type = yaml_data.get("type", "task").lower()
    if new_type: ticket_type = new_type
    if new_status in ["closed", "logged", "archived"]:
        # Evaluate Blockers
        depends_str = parse_list_field(yaml_data.get('depends_on', '[]'))
        import json
        for dep in json.loads(depends_str):
            d_repo, d_id = dep.split("/", 1) if "/" in dep else (repo, dep)
            dep_row = ctx.db.execute("SELECT status FROM tracker_tickets WHERE id=? AND repo=?", (d_id, d_repo)).fetchone()
            if dep_row and dep_row['status'] not in ["closed", "logged", "archived"]:
                raise ValueError(f"Blocked by open dependency: {dep}")

        if yaml_data.get("closed_at") in ["null", None, ""]:
            yaml_data["closed_at"] = datetime.now().isoformat(timespec='seconds')
    yaml_data["status"] = new_status
    if new_type: yaml_data["type"] = new_type

    content = update_frontmatter(content, yaml_data)
    new_rel_path = Path(get_tracker_path(repo, ticket_type, new_status)).joinpath(filename).as_posix()

    ctx.vfs.save(new_rel_path, content, data={"delete_source": canonical_current_rel if canonical_current_rel != new_rel_path else None})
    tier = _resolve_tier(ctx, repo, ticket_type)

    conn = ctx.db
    conn.execute("""
        UPDATE tracker_tickets 
        SET status = ?, filepath = ?, ticket_type = ?, closed_at = ?, tier = ?
        WHERE filepath = ?
    """, (new_status, new_rel_path, ticket_type, datetime.now().isoformat() if new_status == "closed" else None, tier, canonical_current_rel))
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
    from insetu.core.utils_core import clean_date_str, parse_list_field, parse_string_enum
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
        repo_dir, rel_path = ctx.parse_uri(specific_file)
        target_files.append((repo_dir, f"{repo_dir}/{rel_path}" if repo_dir else rel_path))
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
            # Infer current state from path as fallback
            inferred_type = "task"
            parts = [p for p in rel_dir_lower.split('/') if p]
            if parts and parts[0] != "log":
                inferred_type = parts[0][:-1] if parts[0].endswith("s") else parts[0]
            inferred_status = "open"
            if "active" in rel_dir_lower: inferred_status = "active"
            elif "close" in rel_dir_lower: inferred_status = "closed"
            elif "archive" in rel_dir_lower: inferred_status = "archived"
            elif "log" in rel_dir_lower: inferred_status = "logged"
            elif "template" in rel_dir_lower: inferred_status = "template"
            try:
                content = ctx.vfs.read(ws_rel_path)
                if content is None:
                    continue

                from insetu.core.utils_core import parse_frontmatter, update_frontmatter
                yaml_data, body, yaml_match = parse_frontmatter(content)
                # Read declarative values or fallback to inferred values if missing
                raw_repo = yaml_data.get('repo')
                decl_repo = _canonicalize_repo(ctx, raw_repo or current_repo)
                hallucinated_tags = []
                if raw_repo and decl_repo and raw_repo.lower() != decl_repo.lower() and raw_repo.lower() != 'none':
                    hallucinated_tags.append(raw_repo.replace(' ', '-').replace('"', ''))
                # Dynamic validation: Clamp AI hallucinations back to the repository's configured vocabulary
                schema = _get_schema(ctx, decl_repo)
                valid_types = _get_valid_types(schema)

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
                    # Fallback to the primary Tier 3 type if the current type violates the active schema
                    decl_type = valid_types[0]
                decl_status = _normalize_status(yaml_data.get('status'), fallback=inferred_status)
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
                    db_created_at = clean_date_str(cache_row['created_at'])
                    db_closed_at = clean_date_str(cache_row['closed_at'])
                    db_tier = cache_row['tier']
                    db_parent = cache_row['parent_id']
                    db_deps = cache_row['depends_on']
                    db_prio = cache_row['priority'] or ""
                    db_size = cache_row['size'] or ""

                # Lock down original creation metrics against LLM omissions or overwrites
                file_created = clean_date_str(yaml_data.get('created_at'))
                if db_created_at:
                    decl_created = db_created_at
                elif file_created:
                    decl_created = file_created
                else:
                    decl_created = datetime.now().isoformat(timespec='seconds')

                # Enforce the System Clock as the single authority on closure timelines
                file_closed = clean_date_str(yaml_data.get('closed_at'))
                if decl_status in ('closed', 'logged', 'archived'):
                    if db_status in ('open', 'active'):
                        # State transition detected (Open -> Closed)! Force system clock to override LLM hallucinations.
                        decl_closed = datetime.now().isoformat(timespec='seconds')
                    elif db_status in ('closed', 'logged', 'archived') and db_closed_at:
                        # Ticket was already closed historically; retain original system record
                        decl_closed = db_closed_at
                    elif file_closed:
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
                decl_tags_str = parse_list_field(yaml_data.get('tags', '[]'))
                decl_tags_list = json.loads(decl_tags_str)
                for ht in hallucinated_tags:
                    if ht not in decl_tags_list: decl_tags_list.append(ht)

                decl_tags = json.dumps(decl_tags_list) if decl_tags_list else '[]'

                decl_tier = yaml_data.get('tier')
                if decl_tier is None:
                    decl_tier = db_tier if db_tier else _resolve_tier(ctx, decl_repo, decl_type)

                # Determine if we need to rewrite YAML (fields missing or mismatched)
                needs_rewrite = (
                    'repo' not in yaml_data or
                    yaml_data.get('repo') != decl_repo or
                    'type' not in yaml_data or
                    yaml_data.get('type') != decl_type or
                    'status' not in yaml_data or
                    yaml_data.get('status') != decl_status or
                    'tier' not in yaml_data or
                    int(yaml_data.get('tier', 0)) != int(db_tier) or
                    clean_date_str(yaml_data.get('created_at')) != decl_created or
                    (clean_date_str(yaml_data.get('closed_at')) or 'null') != decl_closed
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
                    decl_depends_on = parse_list_field(yaml_data.get('depends_on', db_deps))
                    decl_priority = parse_string_enum(yaml_data.get('priority', db_prio))
                    decl_size = parse_string_enum(yaml_data.get('size', db_size))
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
                        "sub_bucket": decl_sub,
                        "tier": int(decl_tier)
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
@tracker_bp.worker("spawn_template_task")
def _background_spawn_template(ctx, target_repo=None, template_id=None, variables=None, **kwargs):
    variables = variables or {}
    ctx.jobs.update_progress("Spawning template instance...")
    all_tickets = ctx.db.get_all("tracker_tickets")

    root_ticket = next((t for t in all_tickets if t['id'] == template_id), None)
    if not root_ticket:
        raise ValueError("Template root ticket not found.")

    tree_tickets = []
    def collect_children(parent_id):
        children = [t for t in all_tickets if t['parent_id'] == parent_id]
        for c in children:
            tree_tickets.append(c)
            collect_children(c['id'])

    tree_tickets.append(root_ticket)
    collect_children(template_id)

    import uuid, datetime, json

    id_map = {}
    now = datetime.datetime.now()

    repo_prefix = target_repo.split("-")[-1].upper()[:3] if "-" in target_repo else target_repo.upper()[:3]
    if not repo_prefix: repo_prefix = "TKT"

    # Generate sequential timestamps to prevent collision
    for idx, t in enumerate(tree_tickets):
        ticket_type = t['ticket_type']
        timestamp = (now + datetime.timedelta(seconds=idx)).strftime("%Y%m%d_%H%M%S")
        new_id = f"{repo_prefix}-{ticket_type.upper()}-{timestamp}"
        id_map[t['id']] = new_id

    import re
    def apply_vars(text):
        if not text: return text
        def replacer(match):
            key = match.group(1).strip()
            default_val = match.group(2).strip() if match.group(2) else ""
            # If the UI passed a value, use it. Otherwise use the default.
            return variables.get(key, default_val)

        # Matches {{key}} or {{key|default}}
        return re.sub(r'\{\{\s*([^}|]+)(?:\|([^}]+))?\s*\}\}', replacer, text)

    for t in tree_tickets:
        new_id = id_map[t['id']]
        new_title = apply_vars(t['title'])
        new_desc = apply_vars(t['description'])
        new_parent = id_map.get(t['parent_id']) if t['parent_id'] else None

        try:
            old_deps = json.loads(t['depends_on']) if t['depends_on'] else []
        except Exception:
            old_deps = []
        new_deps = [id_map.get(d, d) for d in old_deps]

        tags = ""
        try:
            tags_arr = json.loads(t['tags']) if t['tags'] else []
            tags = ",".join(tags_arr)
        except Exception: pass
        create_ticket(
            ctx=ctx,
            repo=target_repo,
            ticket_type=t['ticket_type'],
            status="open",
            title=new_title,
            description=new_desc,
            tags=tags,
            sub_bucket=t['sub_bucket'],
            delivery_date=None,
            parent_id=new_parent,
            depends_on=",".join(new_deps),
            priority=t['priority'] or "",
            size=t['size'] or "",
            ticket_id=new_id,
            tier=t['tier']
        )

    return {"message": f"Successfully spawned template instance with {len(tree_tickets)} tasks.", "artifact": {}}

@tracker_bp.route('spawn_template', methods=['POST'])
def api_tracker_spawn_template(ctx):
    data = ctx.req.json
    target_repo = data.get('target_repo')
    template_id = data.get('template_id')
    variables = data.get('variables', {})

    if not target_repo or not template_id:
        return jsonify({"error": "Target repo and template_id required."}), 400

    job_id = ctx.jobs.submit("spawn_template_task", target_repo=target_repo, template_id=template_id, variables=variables)
    return jsonify({"status": "accepted", "job_id": job_id}), 202

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
        schema = _get_schema(ctx, repo)
        valid_types = _get_valid_types(schema)
        folders_to_sweep = set([vt if vt.endswith('s') or vt == 'queue' else f"{vt}s" for vt in valid_types])
        from insetu.core.utils_core import parse_frontmatter, update_frontmatter, clean_date_str

        # Sweep 1: Move >grace_period day closed tickets to log
        for folder_type in folders_to_sweep:
            closed_dir_rel = f"{repo}/.tracker/{folder_type}/closed"
            for ws_rel_path in ctx.vfs.walk(closed_dir_rel, exts=['.md']):
                filename = Path(ws_rel_path).name
                content = ctx.vfs.read(ws_rel_path)
                if content:
                    yaml_data, _, _ = parse_frontmatter(content)
                    closed_date_str = clean_date_str(yaml_data.get('closed_at'))
                    if closed_date_str:
                        try:
                            closed_date = datetime.fromisoformat(closed_date_str.replace('Z', '+00:00')).replace(tzinfo=None)
                            if closed_date < date_grace:
                                yaml_data['status'] = "logged"
                                new_content = update_frontmatter(content, yaml_data)
                                new_rel_path = Path(f"{repo}/.tracker/log").joinpath(filename).as_posix()
                                ctx.vfs.save(new_rel_path, new_content, data={"delete_source": ws_rel_path})
                                archived_count += 1
                        except Exception:
                            pass

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
                    yaml_data, _, _ = parse_frontmatter(content)
                    closed_date_str = clean_date_str(yaml_data.get('closed_at'))
                    if closed_date_str:
                        try:
                            closed_date = datetime.fromisoformat(closed_date_str.replace('Z', '+00:00')).replace(tzinfo=None)
                            if closed_date < date_archive:
                                yaml_data['status'] = "archived"
                                new_content = update_frontmatter(content, yaml_data)
                                new_rel_path = Path(f"{repo}/.tracker/log/archived").joinpath(filename).as_posix()
                                ctx.vfs.save(new_rel_path, new_content, data={"delete_source": ws_rel_path})
                                archived_count += 1
                        except Exception:
                            pass

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
            size=data.get('size', ''),
            tier=data.get('tier')
        )
        return jsonify({"status": "success", "filepath": new_path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@tracker_bp.route('index', methods=['GET'])
def api_tracker_index(ctx):
    """CQRS Aggregation Path: Leverages SQLite json_each to compile distinct tags and buckets in C."""
    conn = ctx.db
    try:
        tag_rows = conn.execute("""
            SELECT DISTINCT json_each.value 
            FROM tracker_tickets, json_each(CASE WHEN json_valid(tags) THEN tags ELSE '[]' END) 
            WHERE status != 'archived' AND json_each.value IS NOT NULL AND json_each.value != '' 
            ORDER BY 1
        """).fetchall()
        tags = [r[0] for r in tag_rows]

        bucket_rows = conn.execute("""
            SELECT DISTINCT sub_bucket 
            FROM tracker_tickets 
            WHERE status != 'archived' AND sub_bucket IS NOT NULL AND sub_bucket != 'None' 
            ORDER BY 1
        """).fetchall()
        sub_buckets = [r[0] for r in bucket_rows]

        status_rows = conn.execute("""
            SELECT status, COUNT(*) 
            FROM tracker_tickets 
            WHERE status != 'archived' 
            GROUP BY status
        """).fetchall()
        status_counts = {r[0]: r[1] for r in status_rows}

        return jsonify({
            "tags": tags,
            "sub_buckets": sub_buckets,
            "status_counts": status_counts
        })
    except Exception as e:
        return jsonify({"tags": [], "sub_buckets": [], "status_counts": {}})

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
        if isinstance(include_archived, str):
            include_archived = include_archived.lower() == 'true'

        # Hardware-Accelerated JSON Construction via SQLite C-Extensions
        query = """
            SELECT json_group_array(
                json_object(
                    'id', id,
                    'repo', repo,
                    'tier', tier,
                    'parentId', parent_id,
                    'dependsOn', CASE WHEN json_valid(depends_on) THEN json(depends_on) ELSE json('[]') END,
                    'priority', COALESCE(priority, ''),
                    'size', COALESCE(size, ''),
                    'ticket_type', ticket_type,
                    'status', status,
                    'title', title,
                    'description', description,
                    'tags', CASE WHEN json_valid(tags) THEN json(tags) ELSE json('[]') END,
                    'subBucket', sub_bucket,
                    'timestamp', created_at,
                    'closedAt', closed_at,
                    'deliveryDate', delivery_date,
                    'filepath', filepath
                )
            )
            FROM tracker_tickets
        """
        if not include_archived:
            query += " WHERE status != 'archived'"

        json_result = conn.execute(query).fetchone()[0]
        if not json_result or json_result == '[{}]': 
            json_result = '[]'

        # Stream the raw JSON string directly to the client without Python serialization overhead
        return f'{{"tasks": {json_result}}}', 200, {'Content-Type': 'application/json'}
    except Exception as e:
        print(f"⚠️ [Tracker Error] api_tracker_files failed: {e}")
        return jsonify({"error": str(e)}), 500
@tracker_bp.worker("restore_metadata_task")
def _background_restore_metadata(ctx, **kwargs):
    ctx.jobs.update_progress("Scanning Git history for wiped ticket metadata...")
    restored_count = restore_ticket_metadata_from_git(workspace_id=ctx.workspace_id)
    return f"Restored metadata for {restored_count} tickets from Git history."

@tracker_bp.route('restore_metadata', methods=['POST'])
def api_tracker_restore_metadata(ctx):
    job_id = ctx.jobs.submit("restore_metadata_task")
    return jsonify({"status": "accepted", "job_id": job_id}), 202
def restore_ticket_metadata_from_git(workspace_id=None):
    from insetu.core.topology.engine_topology import get_topology_files_for_repo
    from insetu.extensions.git.engine_git import execute_git
    from insetu.core.utils_core import parse_frontmatter, update_frontmatter, clean_date_str, parse_list_field, parse_string_enum, get_earlier_date
    ctx = tracker_bp.get_context(workspace_id)
    repos = [r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")]
    restored_count = 0

    for current_repo in repos:
        repo_path = ctx.get_repo_path(current_repo)
        if not os.path.exists(repo_path): continue

        repo_files = get_topology_files_for_repo(workspace_id, current_repo, strip_prefix=False)
        tracker_files = [f for f in repo_files if '.tracker/' in f and f.endswith('.md')]

        for ws_rel_path in tracker_files:
            try:
                content = ctx.vfs.read(ws_rel_path)
                if not content: continue

                yaml_data, body, _ = parse_frontmatter(content)
                rel_to_repo = ws_rel_path.split('.tracker/', 1)[1]
                git_file_path = f".tracker/{rel_to_repo}"

                modified = False
                curr_repo_yaml = yaml_data.get('repo')
                canon_repo = _canonicalize_repo(ctx, curr_repo_yaml or current_repo)
                if curr_repo_yaml != canon_repo:
                    yaml_data['repo'] = canon_repo
                    modified = True
                curr_created = clean_date_str(yaml_data.get('created_at'))
                curr_closed = clean_date_str(yaml_data.get('closed_at'))
                curr_delivery = clean_date_str(yaml_data.get('delivery_date'))
                curr_status = _normalize_status(yaml_data.get('status'), fallback='open')
                curr_parent = yaml_data.get('parent_id') or yaml_data.get('parent')
                if str(curr_parent).lower() in ('null', 'none', ''): curr_parent = None
                curr_deps = json.loads(parse_list_field(yaml_data.get('depends_on', '[]')))
                curr_prio = parse_string_enum(yaml_data.get('priority'))
                curr_size = parse_string_enum(yaml_data.get('size'))
                curr_tags = json.loads(parse_list_field(yaml_data.get('tags', '[]')))
                curr_sub = yaml_data.get('sub_bucket', 'None')
                curr_tier = yaml_data.get('tier')

                earliest_created = curr_created
                earliest_closed = curr_closed
                earliest_delivery = curr_delivery

                try:
                    log_res = execute_git(repo_path, ['log', '-p', '--follow', '--', git_file_path], check=False)
                    git_log_text = log_res.stdout if log_res.returncode == 0 else ""

                    matches = re.findall(r'---\s*\n([\s\S]*?)\n---', git_log_text)
                    for raw_fm in matches:
                        old_meta, _, _ = parse_frontmatter(f"---\n{raw_fm}\n---")
                        old_created = clean_date_str(old_meta.get('created_at'))
                        if old_created:
                            earliest_created = get_earlier_date(earliest_created, old_created)

                        old_closed = clean_date_str(old_meta.get('closed_at'))
                        if old_closed:
                            earliest_closed = get_earlier_date(earliest_closed, old_closed)

                        old_delivery = clean_date_str(old_meta.get('delivery_date'))
                        if old_delivery:
                            earliest_delivery = get_earlier_date(earliest_delivery, old_delivery)

                        old_parent = old_meta.get('parent_id') or old_meta.get('parent')
                        if not curr_parent and old_parent and str(old_parent).lower() not in ('null', 'none', ''):
                            yaml_data['parent_id'] = str(old_parent)
                            curr_parent = str(old_parent)
                            modified = True

                        old_deps = json.loads(parse_list_field(old_meta.get('depends_on', '[]')))
                        if not curr_deps and old_deps:
                            yaml_data['depends_on'] = old_deps
                            curr_deps = old_deps
                            modified = True

                        old_prio = parse_string_enum(old_meta.get('priority'))
                        if not curr_prio and old_prio:
                            yaml_data['priority'] = old_prio
                            curr_prio = old_prio
                            modified = True

                        old_size = parse_string_enum(old_meta.get('size'))
                        if not curr_size and old_size:
                            yaml_data['size'] = old_size
                            curr_size = old_size
                            modified = True

                        old_sub = old_meta.get('sub_bucket')
                        if (not curr_sub or curr_sub == 'None') and old_sub and old_sub != 'None':
                            yaml_data['sub_bucket'] = old_sub
                            curr_sub = old_sub
                            modified = True

                        old_tags = json.loads(parse_list_field(old_meta.get('tags', '[]')))
                        if old_tags:
                            for ot in old_tags:
                                if ot not in curr_tags:
                                    curr_tags.append(ot)
                                    modified = True
                            yaml_data['tags'] = curr_tags

                        old_tier = old_meta.get('tier')
                        if not curr_tier and old_tier:
                            yaml_data['tier'] = int(old_tier)
                            curr_tier = int(old_tier)
                            modified = True

                except Exception as ge:
                    print(f"Git log parse warning for {ws_rel_path}: {ge}")
                try:
                    date_res = execute_git(repo_path, ['log', '--format=%aI', '--reverse', '--', git_file_path], check=False)
                    first_commit_date = clean_date_str(date_res.stdout.strip().splitlines()[0]) if date_res.returncode == 0 and date_res.stdout.strip() else None
                    if first_commit_date:
                        earliest_created = get_earlier_date(earliest_created, first_commit_date)
                except Exception:
                    pass

                if curr_status in ('closed', 'logged', 'archived') and not earliest_closed:
                    try:
                        date_res = execute_git(repo_path, ['log', '-1', '--format=%aI', '--', git_file_path], check=False)
                        last_commit_date = clean_date_str(date_res.stdout.strip().splitlines()[0]) if date_res.returncode == 0 and date_res.stdout.strip() else None
                        if last_commit_date:
                            earliest_closed = last_commit_date
                    except Exception:
                        pass

                if earliest_created and earliest_created != curr_created:
                    yaml_data['created_at'] = earliest_created
                    modified = True

                if curr_status in ('closed', 'logged', 'archived') and earliest_closed and earliest_closed != curr_closed:
                    yaml_data['closed_at'] = earliest_closed
                    modified = True

                if earliest_delivery and earliest_delivery != curr_delivery:
                    yaml_data['delivery_date'] = earliest_delivery
                    modified = True

                if modified:
                    new_content = update_frontmatter(content, yaml_data)
                    ctx.vfs.save(ws_rel_path, new_content)
                    _parse_and_upsert_ticket(ctx.resolve_path(ws_rel_path), ws_rel_path, workspace_id)
                    restored_count += 1

            except Exception as e:
                print(f"Error restoring metadata for {ws_rel_path}: {e}")

    ctx.db.commit()
    return restored_count

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