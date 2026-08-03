from pathlib import Path
import os
import json
import uuid
from datetime import datetime
from flask import jsonify
from insetu.core.sdk import InSetuExtension, ExtensionContext
from insetu.kernel.hooks import hooks

NOTES_SCHEMA = {
    "notes_ledger": {
        "id": "TEXT PRIMARY KEY",
        "repo": "TEXT",
        "title": "TEXT",
        "tags": "TEXT",
        "sub_bucket": "TEXT",
        "filepath": "TEXT",
        "created_at": "TEXT",
        "updated_at": "TEXT"
    }
}

notes_bp = InSetuExtension(
    'notes', 
    __name__, 
    title="Notes Library", 
    description="Workspace-level markdown notes managed via YAML frontmatter.", 
    schema=NOTES_SCHEMA
)

__depends__ = []

def _parse_and_upsert_note(abs_path, rel_path, workspace_id):
    """Parses frontmatter and upserts the note into the SQLite ledger."""
    ctx = ExtensionContext('notes', workspace_id)
    content = ctx.vfs.read(abs_path, is_absolute_artifact=True)
    if content is None: return
    
    from insetu.core.utils_core import parse_frontmatter
    yaml_data, body, match = parse_frontmatter(content)
    
    note_id = yaml_data.get('id', uuid.uuid4().hex[:8])
    repo = yaml_data.get('repo', 'global')
    title = yaml_data.get('title', Path(rel_path).name)
    tags_raw = yaml_data.get('tags', '[]')
    
    try:
        if isinstance(tags_raw, str) and tags_raw.startswith('['):
            tags = tags_raw
        else:
            tags = json.dumps([t.strip() for t in str(tags_raw).split(',') if t.strip()])
    except Exception:
        tags = '[]'
        
    sub_bucket = yaml_data.get('sub_bucket', 'None')
    created_at = yaml_data.get('created_at', datetime.now().isoformat())
    updated_at = yaml_data.get('updated_at', datetime.now().isoformat())

    ctx.db.insert_or_replace("notes_ledger", {
        "id": note_id, "repo": repo, "title": title, "tags": tags,
        "sub_bucket": sub_bucket, "filepath": rel_path,
        "created_at": created_at, "updated_at": updated_at
    })

@hooks.on('vfs_mutated')
def handle_notes_vfs_mutations(mutations=None, workspace_id=None, **kwargs):
    """Event Bus hook: Keeps the Notes DB perfectly synced with disk changes."""
    if not mutations: return
    ctx = ExtensionContext('notes', workspace_id)
    for m in mutations:
        filepath = m.get("filepath", "")
        if ".insetu/notes/" in filepath and filepath.endswith(".md"):
            if m.get("operation") == "save":
                abs_path = ctx.resolve_path(filepath)
                if os.path.exists(abs_path):
                    _parse_and_upsert_note(abs_path, filepath, workspace_id)
            elif m.get("operation") == "delete":
                ctx.db.delete("notes_ledger", "filepath", filepath)
@notes_bp.route('list', methods=['GET'])
def api_notes_list(ctx):
    """CQRS read-path: Fetches notes from DB, executing a disk-walk only if the DB is blank."""
    count_check = ctx.db.execute("SELECT count(*) FROM notes_ledger").fetchone()[0]
    if count_check == 0:
        notes_dir = Path(ctx.paths["control_dir"]).joinpath("notes").as_posix()
        if os.path.exists(notes_dir):
            for rel_path in ctx.vfs.walk(".insetu/notes", exts=['.md']):
                abs_path = ctx.resolve_path(rel_path)
                _parse_and_upsert_note(abs_path, rel_path, ctx.workspace_id)
    
    rows = ctx.db.get_all("notes_ledger", order_by="updated_at DESC")
    notes = []
    for r in rows:
        d = dict(r)
        d['tags'] = json.loads(d['tags'])
        notes.append(d)
    return jsonify({"notes": notes})

@notes_bp.route('new', methods=['POST'])
def api_notes_new(ctx):
    """Generates a new note file with managed YAML frontmatter."""
    data = ctx.req.json or {}
    from insetu.kernel.utils import slugify
    from insetu.core.utils_core import update_frontmatter
    
    note_id = f"note-{uuid.uuid4().hex[:8]}"
    title = data.get("title", "Untitled Note")
    filename = f"{slugify(title)}-{note_id}.md"
    filepath = f".insetu/notes/{filename}"
    
    yaml_data = {
        "id": note_id,
        "title": title.replace('"', "'"),
        "repo": data.get("repo", "global"),
        "sub_bucket": data.get("sub_bucket", "None"),
        "created_at": datetime.now().isoformat(timespec='seconds'),
        "updated_at": datetime.now().isoformat(timespec='seconds')
    }
    
    tags = data.get("tags", "")
    if tags:
        yaml_data["tags"] = json.dumps([t.strip() for t in tags.split(',') if t.strip()])
    raw_content = f"## {title}\n\n"
    content = update_frontmatter(raw_content, yaml_data)

    # Save via VFS to trigger the Cartographer and Event Ledger
    ctx.vfs.save(filepath, content)
    return jsonify({"status": "success", "filepath": filepath})

@hooks.on('compile_contexts')
def inject_notes_context(manifest, workspace_id=None, **kwargs):
    """Injects the notes library into the RAG manifest dynamically."""
    ctx = ExtensionContext('notes', workspace_id)
    notes = ctx.db.get_all("notes_ledger")
    if notes:
        files = [n['filepath'] for n in notes]
        manifest["notes_context.txt"] = {
            "files": files,
            "meta": {
                "type": "note",
                "title": "Notes Library",
                "domain": "Documentation & Notes",
                "desc": "User generated notes and documentation."
            }
        }