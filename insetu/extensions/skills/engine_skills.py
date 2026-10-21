import os
import re
import json
import uuid
import datetime
from pathlib import Path
from typing import TypedDict, Optional, Any
from flask import request, jsonify
from insetu.core.sdk import InSetuExtension
from insetu.core.utils_core import parse_frontmatter, InSetuURI, slugify
SKILLS_SCHEMA = {
    "skills_ledger": {
        "id": "TEXT PRIMARY KEY",
        "domain": "TEXT NOT NULL",
        "tags": "TEXT DEFAULT ''",
        "group_name": "TEXT DEFAULT ''",
        "name": "TEXT NOT NULL",
        "status": "TEXT NOT NULL",
        "last_practiced": "TEXT",
        "interval_days": "INTEGER DEFAULT 1",
        "next_review": "TEXT",
        "filepath": "TEXT NOT NULL",
        "metrics_json": "TEXT DEFAULT '{}'"
    }
}
SKILLS_SETTINGS_SCHEMA = [
    {
        "id": "domains",
        "label": "Practice Domains & Metrics Schema",
        "type": "object",
        "scope": "workspace",
        "description": "JSON map defining metric tracking schemas and mastery steps for different practice domains.",
        "default": {
            "musical_repertoire": {
                "label": "Musical Repertoire",
                "metrics": {
                    "tempo": { "type": "integer", "label": "Current Tempo", "unit": "BPM", "target": "target_tempo" },
                    "intonation": { "type": "rating", "min": 1, "max": 10, "label": "Intonation Accuracy" }
                },
                "step_labels": [
                    { "key": "untouched", "label": "Untouched (Not Started)" },
                    { "key": "memorizing", "label": "Memorizing" },
                    { "key": "memorized", "label": "Memorized" },
                    { "key": "improvising", "label": "Improvising Over Structure" },
                    { "key": "mastered", "label": "Mastered (Performance Ready)" }
                ]
            }
        }
    }
]
skills_bp = InSetuExtension(
    'skills',
    __name__,
    title="Skills Tracker",
    description="Spaced-repetition tracking for musical and technical skills.",
    schema=SKILLS_SCHEMA,
    settings_schema=SKILLS_SETTINGS_SCHEMA,
    volumes={
        "skills": {
            "scheme": "ctx",
            "tier": "data",
            "path_key": "skills_dir",
            "legacy_dirs": ["ext/skills/data/skills", "ext/skills/data"],
        }
    },
)
__depends__ = []
@skills_bp.on('topology_boot_complete')
def hydrate_skills_on_boot(ctx, workspace_id=None, **kwargs):
    try:
        _ensure_skills_hydrated(ctx)
    except Exception:
        pass

def _canonical_skill_uri(filepath_or_name: str) -> str:
    if not filepath_or_name:
        return ""
    if filepath_or_name.startswith("ctx://skills/"):
        return filepath_or_name
    base = InSetuURI(filepath_or_name).basename if "://" in filepath_or_name else Path(filepath_or_name).name
    return f"ctx://skills/{base}"
def _ensure_skills_hydrated(ctx):
    ctx.db.heal_uri_column("skills_ledger", "filepath", "ctx://skills/")
    count = ctx.db.execute("SELECT count(*) FROM skills_ledger").fetchone()[0]
    if count == 0:
        for skill_uri in ctx.vfs.walk("ctx://skills", exts=['.md']):
            _parse_and_upsert_skill(skill_uri, workspace_id=ctx.workspace_id)

def _parse_and_upsert_skill(skill_uri, workspace_id=None):
    try:
        ctx = skills_bp.get_context(workspace_id)
        canon_uri = _canonical_skill_uri(skill_uri)
        content = ctx.vfs.read(canon_uri) or ""
        yaml_data, _, _ = parse_frontmatter(content)

        filename = InSetuURI(canon_uri).basename
        s_id = yaml_data.get('id', "SKL-" + uuid.uuid4().hex[:8].upper())
        domain = yaml_data.get('domain', "general")
        tags = yaml_data.get('tags', "")
        group_name = yaml_data.get('group', "")
        name = yaml_data.get('name', filename.replace(".md", ""))
        status = yaml_data.get('status', "untouched")
        last_practiced = yaml_data.get('last_practiced') if str(yaml_data.get('last_practiced')).lower() != 'null' else None
        interval_days = int(yaml_data.get('interval_days', 1))
        next_review = yaml_data.get('next_review', datetime.date.today().isoformat())
        if str(next_review).lower() == 'null': next_review = datetime.date.today().isoformat()
        metrics = {}
        for k, v in yaml_data.items():
            if k not in ['id', 'domain', 'tags', 'group', 'name', 'status', 'last_practiced', 'interval_days', 'next_review']:
                try:
                    metrics[k] = int(v)
                except (ValueError, TypeError):
                    try:
                        metrics[k] = float(v)
                    except (ValueError, TypeError):
                        metrics[k] = v

        conn = ctx.db
        conn.execute("""
            INSERT OR REPLACE INTO skills_ledger  
            (id, domain, tags, group_name, name, status, last_practiced, interval_days, next_review, filepath, metrics_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (s_id, domain, tags, group_name, name, status, last_practiced, interval_days, next_review, canon_uri, json.dumps(metrics)))
        conn.commit()
    except Exception as e:
        print(f"Error parsing global skill file {skill_uri}: {e}")
@skills_bp.route('playlist', methods=['GET'], docstring="Compiles a unified practice batch across all domains based on SM-2 spacing.")
def get_practice_playlist(ctx):
    """Compiles a unified practice batch across all domains sorted globally."""
    try:
        _ensure_skills_hydrated(ctx)
        conn = ctx.db
        today_str = datetime.date.today().isoformat()
        cursor = conn.execute("""
            SELECT * FROM skills_ledger 
            WHERE next_review <= ? OR next_review IS NULL 
            ORDER BY interval_days ASC, id ASC
        """, (today_str,))
        items = []
        for row in cursor.fetchall():
            d = dict(row)
            d['metrics'] = json.loads(d['metrics_json'])
            items.append(d)
        return jsonify({"playlist": items})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
class LogSkillPayload(TypedDict, total=False):
    filepath: str
    score: int
    metrics: dict
    name: str
    tags: str
    group: str
    status: str

@skills_bp.route('log', methods=['POST'], request_schema=LogSkillPayload, docstring="Logs a practice session and updates the SM-2 spaced repetition clocks.")
def log_skill_practice(ctx):
    """Logs a practice run against the user's global profile tracking framework."""
    data = ctx.req.json or {}
    filename = data.get('filepath')  # Maps strictly to user space base filename
    score = int(data.get('score', 3))
    updates = data.get('metrics', {})
    if not filename:
        return jsonify({"error": "Filename tracking reference required"}), 400
    try:
        canon_uri = _canonical_skill_uri(filename)
        conn = ctx.db
        row = conn.execute("SELECT * FROM skills_ledger WHERE filepath = ?", (canon_uri,)).fetchone()
        if not row:
            return jsonify({"error": "Global user skill record not found"}), 404
        current_interval = row['interval_days'] or 1
        if score >= 3:
            if current_interval == 1: next_interval = 3
            elif current_interval == 3: next_interval = 7
            else: next_interval = int(current_interval * 1.5)
        else:
            next_interval = 1
        today = datetime.date.today()
        next_review_date = today + datetime.timedelta(days=next_interval)
        content = ctx.vfs.read(canon_uri) or ""

        existing_metrics = json.loads(row['metrics_json']) if row['metrics_json'] else {}
        existing_metrics.update(updates)
        name = data.get('name', row['name']).strip()
        tags = data.get('tags', row['tags'] if 'tags' in row.keys() else '').strip()
        group_name = data.get('group', row['group_name'] if 'group_name' in row.keys() else '').strip()

        yaml_data = {
            "id": row["id"],
            "domain": row["domain"],
            "tags": tags,
            "group": group_name,
            "name": name,
            "status": data.get("status", row["status"]),
            "last_practiced": today.isoformat(),
            "interval_days": next_interval,
            "next_review": next_review_date.isoformat(),
            **existing_metrics
        }
        final_content = ctx.update_frontmatter(content, yaml_data)
        final_uri = canon_uri
        if name.lower() != row['name'].lower():
            final_uri = f"ctx://skills/{slugify(name)}.md"
            ctx.vfs.delete(canon_uri)
            conn.execute("DELETE FROM skills_ledger WHERE filepath = ?", (canon_uri,))
            conn.commit()

        ctx.vfs.save(final_uri, final_content)
        ctx.sync_vfs_barrier()

        _parse_and_upsert_skill(final_uri, workspace_id=ctx.workspace_id)
        return jsonify({"status": "success", "interval_days": next_interval, "next_review": next_review_date.isoformat(), "filepath": final_uri})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
class UpdateSkillPayload(TypedDict, total=False):
    filepath: str
    name: str
    tags: str
    group: str
    status: str
    parts: str
    custom_steps: str

@skills_bp.route('update', methods=['POST'], request_schema=UpdateSkillPayload, docstring="Updates structural properties of a skill item without affecting practice clocks.")
def update_skill_structure(ctx):
    """Updates structural track properties without affecting the SM-2 spaced repetition clocks."""
    data = ctx.req.json or {}
    filename = data.get('filepath')
    if not filename:
        return jsonify({"error": "Filename tracking reference required"}), 400
    try:
        canon_uri = _canonical_skill_uri(filename)
        conn = ctx.db
        row = conn.execute("SELECT * FROM skills_ledger WHERE filepath = ?", (canon_uri,)).fetchone()
        if not row:
            return jsonify({"error": "Global user skill record not found"}), 404
        content = ctx.vfs.read(canon_uri) or ""

        existing_metrics = json.loads(row['metrics_json']) if row['metrics_json'] else {}
        name = data.get('name', row['name']).strip()
        tags = data.get('tags', row['tags'] if 'tags' in row.keys() else '').strip()
        group_name = data.get('group', row['group_name'] if 'group_name' in row.keys() else '').strip()
        status = data.get('status', row['status']).strip()
        if 'parts' in data: existing_metrics['parts'] = data['parts'].strip()
        if 'custom_steps' in data: existing_metrics['custom_steps'] = data['custom_steps'].strip()

        yaml_data = {
            "id": row["id"],
            "domain": row["domain"],
            "tags": tags,
            "group": group_name,
            "name": name,
            "status": status,
            "last_practiced": row["last_practiced"] or "null",
            "interval_days": row["interval_days"] or 1,
            "next_review": row["next_review"] or datetime.date.today().isoformat(),
            **existing_metrics
        }
        final_content = ctx.update_frontmatter(content, yaml_data)
        final_uri = canon_uri
        if name.lower() != row['name'].lower():
            final_uri = f"ctx://skills/{slugify(name)}.md"
            ctx.vfs.delete(canon_uri)
            conn.execute("DELETE FROM skills_ledger WHERE filepath = ?", (canon_uri,))
            conn.commit()

        ctx.vfs.save(final_uri, final_content)
        ctx.sync_vfs_barrier()

        _parse_and_upsert_skill(final_uri, workspace_id=ctx.workspace_id)
        return jsonify({"status": "success", "filepath": final_uri})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
class DeleteSkillPayload(TypedDict):
    filepath: str

@skills_bp.route('delete', methods=['POST'], request_schema=DeleteSkillPayload, docstring="Permanently deletes a skill tracking record and its associated physical markdown file.")
def delete_skill_item(ctx):
    """Permanently purges a skill markdown asset from user space disk and index ledger."""
    data = ctx.req.json or {}
    filename = data.get('filepath')
    if not filename:
        return jsonify({"error": "Filename tracking reference required"}), 400
    try:
        canon_uri = _canonical_skill_uri(filename)
        conn = ctx.db
        ctx.vfs.delete(canon_uri)
        conn.execute("DELETE FROM skills_ledger WHERE filepath = ?", (canon_uri,))
        conn.commit()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@skills_bp.route('list', methods=['GET'], docstring="Retrieves all registered skill items across the entire user profile.")
def get_all_skills(ctx):
    """Returns every tracking item registered across the user profile layout."""
    try:
        _ensure_skills_hydrated(ctx)
        conn = ctx.db
        cursor = conn.execute("SELECT * FROM skills_ledger ORDER BY name ASC")
        items = []
        for row in cursor.fetchall():
            d = dict(row)
            d['metrics'] = json.loads(d['metrics_json'])
            items.append(d)
        return jsonify({"skills": items})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
class CreateSkillPayload(TypedDict, total=False):
    name: str
    domain: str
    tags: str
    group: str
    status: str
    custom_steps: str
    parts: str
    metrics: dict

@skills_bp.route('create', methods=['POST'], request_schema=CreateSkillPayload, docstring="Generates a new skill tracking physical markdown file and inserts it into the index.")
def create_new_skill(ctx):
    """Generates a physical markdown file structure inside global user space."""
    data = ctx.req.json or {}
    name = data.get('name', '').strip()
    domain = data.get('domain', 'musical_repertoire').strip()
    tags = data.get('tags', '').strip()
    group_name = data.get('group', '').strip()
    status = data.get('status', 'untouched').strip()
    custom_steps = data.get('custom_steps', '').strip()
    parts = data.get('parts', '').strip()
    initial_metrics = data.get('metrics', {})
    if not name:
        return jsonify({"error": "Name required"}), 400
    try:
        filename = f"{slugify(name)}.md"
        s_id = "SKL-" + uuid.uuid4().hex[:8].upper()

        yaml_data = {
            "id": s_id,
            "domain": domain,
            "tags": tags,
            "group": group_name,
            "name": name,
            "status": status,
            "last_practiced": "null",
            "interval_days": 1,
            "next_review": datetime.date.today().isoformat(),
            **initial_metrics
        }
        if custom_steps: yaml_data["custom_steps"] = custom_steps
        if parts:
            yaml_data["parts"] = parts
            yaml_data["completed_parts"] = ""
        canon_uri, _ = ctx.create_entity_file(
            folder="ctx://skills",
            title=name,
            yaml_data=yaml_data,
            body_content=f"## {name}\n\nPractice Logs: {name}\n",
            prefix="SKL",
            filename=filename
        )
        ctx.sync_vfs_barrier()

        _parse_and_upsert_skill(canon_uri, workspace_id=ctx.workspace_id)
        return jsonify({"status": "success", "filepath": canon_uri})
    except Exception as e:
        return jsonify({"error": str(e)}), 500