from pathlib import Path
import os
import json
import uuid
import shutil
from typing import TypedDict, Optional
from datetime import datetime
from flask import jsonify
from insetu.core.sdk import InSetuExtension, ExtensionContext, DefaultVFSDriver
from insetu.core.utils_core import parse_frontmatter, InSetuURI

_SYNCED_NOTES_WORKSPACES = set()

class NotesVFSDriver(DefaultVFSDriver):
    """VFS Driver for ctx://notes that transparently resolves notes relocated to <repo>/.insetu-data/notes/."""
    def resolve(self, uri_obj, workspace_id, physical_target):
        primary_path = super().resolve(uri_obj, workspace_id, physical_target)
        if primary_path and os.path.exists(primary_path):
            return primary_path

        rel_name = Path(uri_obj.path).name if uri_obj.path else ""
        if rel_name and rel_name.endswith(".md"):
            try:
                ctx = notes_bp.get_context(workspace_id)
                for repo_cfg in ctx.config.get("target_repos", []):
                    r_dir = repo_cfg.get("repo_dir")
                    if r_dir:
                        cand_uri = f"vfs://{r_dir}/.insetu-data/notes/{rel_name}"
                        cand_phys = ctx.resolve_path(cand_uri, must_exist=True)
                        if cand_phys:
                            return cand_phys
            except Exception:
                pass
        return primary_path

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
    schema=NOTES_SCHEMA,
    volumes={
        "notes": {
            "scheme": "ctx",
            "tier": "data",
            "path_key": "notes_dir",
            "driver": NotesVFSDriver,
            "legacy_dirs": ["notes", "ext/notes/data/notes", "ext/notes/data"],
        }
    },
)
__depends__ = []
def _is_note_path(filepath: str) -> bool:
    if not filepath or not filepath.endswith(".md"):
        return False
    return filepath.startswith("ctx://notes/") or "/.insetu-data/notes/" in filepath or filepath.startswith(".insetu-data/notes/")

def _resolve_intended_note_uri(repo: str, filename: str, valid_repos: set) -> str:
    if repo and repo != "global" and repo in valid_repos:
        return f"vfs://{repo}/.insetu-data/notes/{filename}"
    return f"ctx://notes/{filename}"

def _sync_all_notes_to_db(ctx):
    valid_repos = {r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")}
    seen_ids = set()
    for rel_path in ctx.vfs.walk("ctx://notes", exts=['.md']):
        abs_path = ctx.resolve_path(rel_path, must_exist=True)
        if abs_path:
            nid = _parse_and_upsert_note(abs_path, rel_path, ctx.workspace_id, valid_repos=valid_repos)
            if nid:
                seen_ids.add(nid)
    for r_dir in valid_repos:
        repo_notes_uri = f"vfs://{r_dir}/.insetu-data/notes"
        for rel_path in ctx.vfs.walk(repo_notes_uri, exts=['.md']):
            abs_path = ctx.resolve_path(rel_path, must_exist=True)
            if abs_path:
                nid = _parse_and_upsert_note(abs_path, rel_path, ctx.workspace_id, valid_repos=valid_repos)
                if nid:
                    seen_ids.add(nid)
    _SYNCED_NOTES_WORKSPACES.add(ctx.workspace_id)
@notes_bp.on('mutate_workspace_config')
def inject_notes_config(cfg, workspace_id=None, **kwargs):
    if "notes" not in cfg.get("extensions", []): return
    for repo_cfg in cfg.get("target_repos", []):
        if "sub_buckets" not in repo_cfg:
            repo_cfg["sub_buckets"] = []
        if not any(b.get("id") == "notes_omitted" for b in repo_cfg["sub_buckets"]):
            repo_cfg["sub_buckets"].append({
                "id": "notes_omitted",
                "title": f"REPO NOTES ({repo_cfg.get('repo_dir', '').upper()})",
                "domain": "Hidden Context",
                "match_prefixes": [".insetu-data/notes/"],
                "exclude_from_diffs": True,
                "is_system": True
            })
@notes_bp.on('topology_boot_complete')
def hydrate_notes_on_boot(ctx, workspace_id=None, **kwargs):
    try:
        ctx.db.execute("DELETE FROM notes_ledger")
        ctx.db.commit()
        _sync_all_notes_to_db(ctx)
    except Exception:
        pass

def _parse_and_upsert_note(abs_path, rel_path, workspace_id, valid_repos=None):
    """Parses frontmatter, relocates across global/repo boundaries if repo changed, and upserts into SQLite."""
    ctx = notes_bp.get_context(workspace_id)
    if valid_repos is None:
        valid_repos = {r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")}
    content = ctx.vfs.read(rel_path)
    if content is None and abs_path and os.path.exists(abs_path):
        content = ctx.vfs.read(abs_path, is_absolute_artifact=True)
    if content is None:
        return
    yaml_data, body, match = parse_frontmatter(content)
    uri = InSetuURI(rel_path)
    inferred_repo = uri.repo if (uri.scheme == 'vfs' and uri.repo in valid_repos) else 'global'

    note_id = yaml_data.get('id', uuid.uuid4().hex[:8])
    repo = yaml_data.get('repo', inferred_repo)
    if repo != 'global' and repo not in valid_repos:
        repo = inferred_repo
    filename = Path(rel_path).name
    intended_uri = _resolve_intended_note_uri(repo, filename, valid_repos)
    if str(uri) != intended_uri:
        old_uri_str = str(uri)
        ctx.vfs.save(intended_uri, content, data={"delete_source": old_uri_str})
        ctx.db.delete("notes_ledger", "filepath", old_uri_str)
        rel_path = intended_uri

    title = yaml_data.get('title', filename)
    tags_raw = yaml_data.get('tags', [])

    try:
        if isinstance(tags_raw, list):
            tags = json.dumps([str(t).strip() for t in tags_raw if str(t).strip()])
        elif isinstance(tags_raw, str) and tags_raw.startswith('['):
            tags = json.dumps(json.loads(tags_raw))
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
    return note_id
@notes_bp.on('vfs_mutated')
def handle_notes_vfs_mutations(ctx, mutations=None, workspace_id=None, **kwargs):
    """Event Bus hook: Keeps the Notes DB synced with both global and repo-scoped disk changes."""
    if not mutations: return
    valid_repos = {r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")}
    for m in mutations:
        filepath = m.get("filepath", "")
        if _is_note_path(filepath):
            norm_fp = str(InSetuURI(filepath))
            if m.get("operation") in ("save", "added", "modified", "create", "created"):
                abs_path = ctx.resolve_path(norm_fp, must_exist=True)
                if abs_path:
                    _parse_and_upsert_note(abs_path, norm_fp, workspace_id, valid_repos=valid_repos)
            elif m.get("operation") in ("delete", "deleted", "remove", "removed"):
                ctx.db.delete("notes_ledger", "filepath", norm_fp)
                ctx.db.delete("notes_ledger", "filepath", filepath)
def _discover_mounted_notes(ctx) -> list:
    """Traverses peer workspaces mounted for the 'notes' domain and returns virtual ws:// note entries."""
    mounted_notes = []
    for target_ws, ws_uri in ctx.iter_shared_mount_files(domain="notes", exts=['.md']):
        content = ctx.vfs.read(ws_uri)
        if not content:
            continue
        yaml_data, _, _ = parse_frontmatter(content)
        fname = Path(ws_uri).name
        tags_raw = yaml_data.get('tags', [])
        if isinstance(tags_raw, str):
            tags_list = [t.strip() for t in tags_raw.split(',') if t.strip()]
        elif isinstance(tags_raw, list):
            tags_list = [str(t).strip() for t in tags_raw if str(t).strip()]
        else:
            tags_list = []
        mounted_notes.append({
            "id": yaml_data.get('id', f"ws-{target_ws}-{fname}"),
            "repo": f"🌐 {target_ws}",
            "title": yaml_data.get('title', fname),
            "tags": tags_list,
            "sub_bucket": yaml_data.get('sub_bucket', 'None'),
            "filepath": ws_uri,
            "created_at": str(yaml_data.get('created_at', '')),
            "updated_at": str(yaml_data.get('updated_at', '')),
            "is_shared": True,
            "source_workspace": target_ws
        })
    return mounted_notes


@notes_bp.route('list', methods=['GET'], docstring="Fetches the library of markdown notes including mounted ws:// notes.")
def api_notes_list(ctx):
    """CQRS read-path: Fetches notes from DB, ensuring post-migration paths are synchronized."""
    count_check = ctx.db.execute("SELECT count(*) FROM notes_ledger").fetchone()[0]
    if count_check == 0 or ctx.workspace_id not in _SYNCED_NOTES_WORKSPACES:
        ctx.db.execute("DELETE FROM notes_ledger")
        ctx.db.commit()
        _sync_all_notes_to_db(ctx)

    rows = ctx.db.get_all("notes_ledger", order_by="updated_at DESC")
    notes = []
    for r in rows:
        d = dict(r)
        d['tags'] = json.loads(d['tags'])
        notes.append(d)
    notes.extend(_discover_mounted_notes(ctx))
    return jsonify({"notes": notes})
class NoteNewPayload(TypedDict, total=False):
    title: str
    repo: Optional[str]
    sub_bucket: Optional[str]
    tags: Optional[str]
@notes_bp.route('new', methods=['POST'], request_schema=NoteNewPayload, docstring="Generates a new markdown note file with managed YAML frontmatter.")
def api_notes_new(ctx):
    """Generates a new note file with managed YAML frontmatter."""
    data = ctx.req.json or {}
    title = data.get("title", "Untitled Note")
    repo = data.get("repo", "global")
    valid_repos = {r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")}
    folder = f"vfs://{repo}/.insetu-data/notes" if (repo != "global" and repo in valid_repos) else "ctx://notes"

    yaml_data = {
        "repo": repo,
        "sub_bucket": data.get("sub_bucket", "None"),
    }
    tags = data.get("tags", "")
    if tags:
        yaml_data["tags"] = [t.strip() for t in tags.split(',') if t.strip()]

    filepath, _ = ctx.create_entity_file(folder, title, yaml_data, prefix="note")
    return jsonify({"status": "success", "filepath": filepath})
@notes_bp.on('gather_declare_topology')
def declare_notes_topology(ctx, target_repos=None, ledger_events=None, workspace_id=None, **kwargs):
    """Declares the notes library to the Gather engine for centralized chunking and context compilation."""
    notes = ctx.db.get_all("notes_ledger")
    if not notes: 
        return []

    def gen_cb():
        header_str = "============================================================\n"
        header_str += "INSETU TOPOLOGY (Notes Library)\n"
        header_str += "============================================================\n\n"

        text_blocks = []
        files = []
        for n in notes:
            content = ctx.vfs.read(n['filepath'])
            if content:
                text_blocks.append(f"============================================================\n>>> FILE: {n['filepath']}\n============================================================\n\n{content}\n\n")
                files.append(n['filepath'])

        return {"header": header_str, "blocks": text_blocks, "files": files}
    def rec_cb(events):
        # Differential RAG triggers if any event touches global or repo-scoped notes
        for e in events:
            if _is_note_path(e.get('filepath', '')):
                return gen_cb()
        return None
    return [{
        "filename": "ctx://contexts/notes_context.txt",
        "meta": {
            "type": "note",
            "title": "Notes Library",
            "domain": "Documentation & Notes",
            "desc": "User generated notes and documentation."
        },
        "generator_callback": gen_cb,
        "recall_callback": rec_cb
    }]