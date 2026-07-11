import os
import re
import json
import uuid
import datetime
from pathlib import Path
from flask import request, jsonify
from insetu.sdk import InSetuExtension
from insetu.hooks import hooks

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

skills_bp = InSetuExtension('skills', __name__, schema=SKILLS_SCHEMA)
__depends__ = []

def _get_user_skills_dir(workspace_id=None):
    """Resolves and commands the localized workspace skills directory structure."""
    from insetu.utils_core import get_workspace_physics
    cfg_path, _, _ = get_workspace_physics(workspace_id)
    base_dir = Path(cfg_path).parent.joinpath("data", "skills").as_posix()
    os.makedirs(base_dir, exist_ok=True)
    return base_dir
def _parse_and_upsert_skill(abs_path, filename, workspace_id=None):
    try:
        from insetu.utils_core import parse_frontmatter
        from insetu.sdk import ExtensionContext
        ctx = ExtensionContext('skills', workspace_id)
        content = ctx.vfs.read(abs_path) or ""
        yaml_data, _, _ = parse_frontmatter(content)

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

        from insetu.db import get_connection
        conn = get_connection("skills", workspace_id=workspace_id)
        conn.execute("""
            INSERT OR REPLACE INTO skills_ledger  
            (id, domain, tags, group_name, name, status, last_practiced, interval_days, next_review, filepath, metrics_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (s_id, domain, tags, group_name, name, status, last_practiced, interval_days, next_review, filename, json.dumps(metrics)))
        conn.commit()
    except Exception as e:
        print(f"Error parsing global skill file {filename}: {e}")
@skills_bp.route('playlist', methods=['GET'])
def get_practice_playlist(ctx):
    """Compiles a unified practice batch across all domains sorted globally."""
    try:
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
@skills_bp.route('log', methods=['POST'])
def log_skill_practice(ctx):
    """Logs a practice run against the user's global profile tracking framework."""
    data = ctx.req.json or {}
    filename = data.get('filepath')  # Maps strictly to user space base filename
    score = int(data.get('score', 3))
    updates = data.get('metrics', {})

    if not filename:
        return jsonify({"error": "Filename tracking reference required"}), 400

    try:
        conn = ctx.db
        row = conn.execute("SELECT * FROM skills_ledger WHERE filepath = ?", (filename,)).fetchone()
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
        from insetu.utils_core import update_frontmatter, slugify
        abs_path = Path(_get_user_skills_dir(ctx.workspace_id)).joinpath(filename).as_posix()
        content = ctx.vfs.read(abs_path) or ""

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

        final_content = update_frontmatter(content, yaml_data)
        final_filename = filename

        if name.lower() != row['name'].lower():
            new_filename = f"{slugify(name)}.md"
            new_abs_path = Path(_get_user_skills_dir(ctx.workspace_id)).joinpath(new_filename).as_posix()
            if os.path.exists(abs_path):
                from insetu.routes_fs import execute_vfs_delete
                execute_vfs_delete(ctx.workspace_id, abs_path)
            abs_path = new_abs_path
            final_filename = new_filename
            conn.execute("DELETE FROM skills_ledger WHERE filepath = ?", (filename,))
            conn.commit()

        from insetu.routes_fs import execute_vfs_save
        execute_vfs_save(ctx.workspace_id, abs_path, final_content, data={"is_absolute_artifact": True})

        _parse_and_upsert_skill(abs_path, final_filename, workspace_id=ctx.workspace_id)
        return jsonify({"status": "success", "interval_days": next_interval, "next_review": next_review_date.isoformat()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@skills_bp.route('update', methods=['POST'])
def update_skill_structure(ctx):
    """Updates structural track properties without affecting the SM-2 spaced repetition clocks."""
    data = ctx.req.json or {}
    filename = data.get('filepath')
    if not filename:
        return jsonify({"error": "Filename tracking reference required"}), 400
    try:
        conn = ctx.db
        row = conn.execute("SELECT * FROM skills_ledger WHERE filepath = ?", (filename,)).fetchone()
        if not row:
            return jsonify({"error": "Global user skill record not found"}), 404
        from insetu.utils_core import update_frontmatter, slugify
        abs_path = Path(_get_user_skills_dir(ctx.workspace_id)).joinpath(filename).as_posix()
        content = ctx.vfs.read(abs_path) or ""

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

        final_content = update_frontmatter(content, yaml_data)
        final_filename = filename

        if name.lower() != row['name'].lower():
            new_filename = f"{slugify(name)}.md"
            new_abs_path = Path(_get_user_skills_dir(ctx.workspace_id)).joinpath(new_filename).as_posix()
            if os.path.exists(abs_path):
                from insetu.routes_fs import execute_vfs_delete
                execute_vfs_delete(ctx.workspace_id, abs_path)
            abs_path = new_abs_path
            final_filename = new_filename
            conn.execute("DELETE FROM skills_ledger WHERE filepath = ?", (filename,))
            conn.commit()

        from insetu.routes_fs import execute_vfs_save
        execute_vfs_save(ctx.workspace_id, abs_path, final_content, data={"is_absolute_artifact": True})

        _parse_and_upsert_skill(abs_path, final_filename, workspace_id=ctx.workspace_id)
        return jsonify({"status": "success", "filepath": final_filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@skills_bp.route('delete', methods=['POST'])
def delete_skill_item(ctx):
    """Permanently purges a skill markdown asset from user space disk and index ledger."""
    data = ctx.req.json or {}
    filename = data.get('filepath')
    if not filename:
        return jsonify({"error": "Filename tracking reference required"}), 400
    try:
        conn = ctx.db
        abs_path = Path(_get_user_skills_dir(ctx.workspace_id)).joinpath(filename).as_posix()

        if os.path.exists(abs_path):
            from insetu.routes_fs import execute_vfs_delete
            execute_vfs_delete(ctx.workspace_id, abs_path)

        conn.execute("DELETE FROM skills_ledger WHERE filepath = ?", (filename,))
        conn.commit()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@skills_bp.route('list', methods=['GET'])
def get_all_skills(ctx):
    """Returns every tracking item registered across the user profile layout."""
    try:
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
@skills_bp.route('create', methods=['POST'])
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
        from insetu.utils_core import slugify, update_frontmatter
        filename = f"{slugify(name)}.md"
        abs_path = Path(_get_user_skills_dir(ctx.workspace_id)).joinpath(filename).as_posix()
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

        raw_content = f"## Practice Logs: {name}\n"
        final_content = update_frontmatter(raw_content, yaml_data)

        from insetu.routes_fs import execute_vfs_save
        execute_vfs_save(ctx.workspace_id, abs_path, final_content, data={"is_absolute_artifact": True})

        _parse_and_upsert_skill(abs_path, filename, workspace_id=ctx.workspace_id)
        return jsonify({"status": "success", "filepath": filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500