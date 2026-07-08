import os
import re
import json
import uuid
import datetime
from flask import Blueprint, request, jsonify
from insetu.db import get_connection
from insetu.hooks import hooks
from insetu.utils_core import resolve_workspace_path, load_config
from insetu.routes_fs import execute_vfs_save

skills_bp = Blueprint('skills', __name__)
__depends__ = []
def _get_user_skills_dir():
    """Resolves and commands the global system user space directory structure."""
    base_dir = os.path.expanduser('~/.insetu/skills')
    os.makedirs(base_dir, exist_ok=True)
    return base_dir
@hooks.on('system_boot')
def init_skills_db():
    """Initializes a unified global user-level SQLite cache schema for cross-workspace tracking."""
    conn = get_connection("skills", workspace_id=None)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS skills_ledger (
            id TEXT PRIMARY KEY,
            domain TEXT NOT NULL,
            tags TEXT DEFAULT '',
            group_name TEXT DEFAULT '',
            name TEXT NOT NULL,
            status TEXT NOT NULL,
            last_practiced TEXT,
            interval_days INTEGER DEFAULT 1,
            next_review TEXT,
            filepath TEXT NOT NULL,
            metrics_json TEXT DEFAULT '{}'
        )
    """)
    conn.commit()

    # Safe Schema Migration Check: Inject columns if table predates updates
    try:
        cursor = conn.execute("PRAGMA table_info(skills_ledger)")
        columns = [row[1] for row in cursor.fetchall()]
        if 'tags' not in columns:
            conn.execute("ALTER TABLE skills_ledger ADD COLUMN tags TEXT DEFAULT ''")
            conn.commit()
        if 'group_name' not in columns:
            conn.execute("ALTER TABLE skills_ledger ADD COLUMN group_name TEXT DEFAULT ''")
            conn.commit()
    except Exception as migration_err:
        print(f"Skills migration safety bypassed: {migration_err}")

    # Sync filesystem entries to database cache on system spin-up
    skills_dir = _get_user_skills_dir()
    for filename in os.listdir(skills_dir):
        if filename.endswith(".md"):
            abs_path = os.path.join(skills_dir, filename)
            _parse_and_upsert_skill(abs_path, filename)

def _parse_and_upsert_skill(abs_path, filename):
    try:
        with open(abs_path, 'r', encoding='utf-8') as f:
            content = f.read()
        yaml_match = re.search(r'^\s*---\n([\s\S]*?)\n\s*---', content)
        s_id = "SKL-" + uuid.uuid4().hex[:8].upper()
        domain = "general"
        tags = ""
        group_name = ""
        name = filename.replace(".md", "")
        status = "untouched"
        last_practiced = None
        interval_days = 1
        next_review = datetime.date.today().isoformat()
        metrics = {}

        if yaml_match:
            lines = yaml_match.group(1).split('\n')
            for line in lines:
                if ':' in line:
                    k, v = line.split(':', 1)
                    k = k.strip()
                    v = v.strip().strip('\'"')
                    if k == 'id': s_id = v
                    elif k == 'domain': domain = v
                    elif k == 'tags': tags = v
                    elif k == 'group': group_name = v
                    elif k == 'name': name = v
                    elif k == 'status': status = v
                    elif k == 'last_practiced': last_practiced = v if v.lower() != 'null' else None
                    elif k == 'interval_days': interval_days = int(v)
                    elif k == 'next_review': next_review = v if v.lower() != 'null' else next_review
                    else:
                        try:
                            metrics[k] = int(v)
                        except ValueError:
                            try:
                                metrics[k] = float(v)
                            except ValueError:
                                metrics[k] = v
        conn = get_connection("skills", workspace_id=None)
        conn.execute("""
            INSERT OR REPLACE INTO skills_ledger 
            (id, domain, tags, group_name, name, status, last_practiced, interval_days, next_review, filepath, metrics_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (s_id, domain, tags, group_name, name, status, last_practiced, interval_days, next_review, filename, json.dumps(metrics)))
        conn.commit()
    except Exception as e:
        print(f"Error parsing global skill file {filename}: {e}")

@skills_bp.route('/api/skills/playlist', methods=['GET'])
def get_practice_playlist():
    """Compiles a unified practice batch across all domains sorted globally."""
    try:
        conn = get_connection("skills", workspace_id=None)
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

@skills_bp.route('/api/skills/log', methods=['POST'])
def log_skill_practice():
    """Logs a practice run against the user's global profile tracking framework."""
    data = request.json or {}
    filename = data.get('filepath')  # Maps strictly to user space base filename
    score = int(data.get('score', 3))
    updates = data.get('metrics', {})

    if not filename:
        return jsonify({"error": "Filename tracking reference required"}), 400

    try:
        conn = get_connection("skills", workspace_id=None)
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

        abs_path = os.path.join(_get_user_skills_dir(), filename)
        with open(abs_path, 'r', encoding='utf-8') as f:
            content = f.read()

        yaml_match = re.search(r'^\s*---\n([\s\S]*?)\n\s*---', content)
        body_content = content.replace(yaml_match.group(0), '').strip() if yaml_match else content

        existing_metrics = json.loads(row['metrics_json']) if row['metrics_json'] else {}
        existing_metrics.update(updates)
        name = data.get('name', row['name']).strip()
        tags = data.get('tags', row['tags'] if 'tags' in row.keys() else '').strip()
        group_name = data.get('group', row['group_name'] if 'group_name' in row.keys() else '').strip()
        new_yaml = [
            "---",
            f'id: "{row["id"]}"',
            f'domain: "{row["domain"]}"',
            f'tags: "{tags}"',
            f'group: "{group_name}"',
            f'name: "{name}"',
            f'status: "{data.get("status", row["status"])}"',
            f'last_practiced: "{today.isoformat()}"',
            f'interval_days: {next_interval}',
            f'next_review: "{next_review_date.isoformat()}"'
        ]
        for k, v in existing_metrics.items():
            if isinstance(v, str): new_yaml.append(f'{k}: "{v}"')
            else: new_yaml.append(f'{k}: {v}')
        new_yaml.append("---\n")

        with open(abs_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(new_yaml) + "\n" + body_content)
        # Rename physical file if track title is systematically edited
        final_filename = filename
        if name.lower() != row['name'].lower():
            from insetu.utils_core import slugify
            new_filename = f"{slugify(name)}.md"
            new_abs_path = os.path.join(_get_user_skills_dir(), new_filename)
            os.rename(abs_path, new_abs_path)
            abs_path = new_abs_path
            final_filename = new_filename
            conn.execute("DELETE FROM skills_ledger WHERE filepath = ?", (filename,))
            conn.commit()
        _parse_and_upsert_skill(abs_path, final_filename)
        return jsonify({"status": "success", "interval_days": next_interval, "next_review": next_review_date.isoformat()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@skills_bp.route('/api/skills/update', methods=['POST'])
def update_skill_structure():
    """Updates structural track properties without affecting the SM-2 spaced repetition clocks."""
    data = request.json or {}
    filename = data.get('filepath')
    if not filename:
        return jsonify({"error": "Filename tracking reference required"}), 400

    try:
        conn = get_connection("skills", workspace_id=None)
        row = conn.execute("SELECT * FROM skills_ledger WHERE filepath = ?", (filename,)).fetchone()
        if not row:
            return jsonify({"error": "Global user skill record not found"}), 404

        abs_path = os.path.join(_get_user_skills_dir(), filename)
        with open(abs_path, 'r', encoding='utf-8') as f:
            content = f.read()

        yaml_match = re.search(r'^\s*---\n([\s\S]*?)\n\s*---', content)
        body_content = content.replace(yaml_match.group(0), '').strip() if yaml_match else content
        existing_metrics = json.loads(row['metrics_json']) if row['metrics_json'] else {}

        name = data.get('name', row['name']).strip()
        tags = data.get('tags', row['tags'] if 'tags' in row.keys() else '').strip()
        group_name = data.get('group', row['group_name'] if 'group_name' in row.keys() else '').strip()
        status = data.get('status', row['status']).strip()
        if 'parts' in data: existing_metrics['parts'] = data['parts'].strip()
        if 'custom_steps' in data: existing_metrics['custom_steps'] = data['custom_steps'].strip()

        new_yaml = [
            "---",
            f'id: "{row["id"]}"',
            f'domain: "{row["domain"]}"',
            f'tags: "{tags}"',
            f'group: "{group_name}"',
            f'name: "{name}"',
            f'status: "{status}"',
            f'last_practiced: "{row["last_practiced"] or "null"}"',
            f'interval_days: {row["interval_days"] or 1}',
            f'next_review: "{row["next_review"] or datetime.date.today().isoformat()}"'
        ]

        for k, v in existing_metrics.items():
            if k not in ['id', 'domain', 'tags', 'group', 'name', 'status', 'last_practiced', 'interval_days', 'next_review']:
                if isinstance(v, str): new_yaml.append(f'{k}: "{v}"')
                else: new_yaml.append(f'{k}: {v}')
        new_yaml.append("---\n")

        with open(abs_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(new_yaml) + "\n" + body_content)

        final_filename = filename
        if name.lower() != row['name'].lower():
            from insetu.utils_core import slugify
            new_filename = f"{slugify(name)}.md"
            new_abs_path = os.path.join(_get_user_skills_dir(), new_filename)
            os.rename(abs_path, new_abs_path)
            abs_path = new_abs_path
            final_filename = new_filename
            conn.execute("DELETE FROM skills_ledger WHERE filepath = ?", (filename,))
            conn.commit()
        _parse_and_upsert_skill(abs_path, final_filename)
        return jsonify({"status": "success", "filepath": final_filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@skills_bp.route('/api/skills/delete', methods=['POST'])
def delete_skill_item():
    """Permanently purges a skill markdown asset from user space disk and index ledger."""
    data = request.json or {}
    filename = data.get('filepath')
    if not filename:
        return jsonify({"error": "Filename tracking reference required"}), 400

    try:
        conn = get_connection("skills", workspace_id=None)
        abs_path = os.path.join(_get_user_skills_dir(), filename)

        if os.path.exists(abs_path):
            os.remove(abs_path)

        conn.execute("DELETE FROM skills_ledger WHERE filepath = ?", (filename,))
        conn.commit()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@skills_bp.route('/api/skills/list', methods=['GET'])
def get_all_skills():
    """Returns every tracking item registered across the user profile layout."""
    try:
        conn = get_connection("skills", workspace_id=None)
        cursor = conn.execute("SELECT * FROM skills_ledger ORDER BY name ASC")
        items = []
        for row in cursor.fetchall():
            d = dict(row)
            d['metrics'] = json.loads(d['metrics_json'])
            items.append(d)
        return jsonify({"skills": items})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@skills_bp.route('/api/skills/create', methods=['POST'])
def create_new_skill():
    """Generates a physical markdown file structure inside global user space."""
    data = request.json or {}
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
        from insetu.utils_core import slugify
        filename = f"{slugify(name)}.md"
        abs_path = os.path.join(_get_user_skills_dir(), filename)
        s_id = "SKL-" + uuid.uuid4().hex[:8].upper()
        new_yaml = [
            "---",
            f'id: "{s_id}"',
            f'domain: "{domain}"',
            f'tags: "{tags}"',
            f'group: "{group_name}"',
            f'name: "{name}"',
            f'status: "{status}"',
            f'last_practiced: "null"',
            f'interval_days: 1',
            f'next_review: "{datetime.date.today().isoformat()}"'
        ]
        if custom_steps: new_yaml.append(f'custom_steps: "{custom_steps}"')
        if parts:
            new_yaml.append(f'parts: "{parts}"')
            new_yaml.append('completed_parts: ""')

        for k, v in initial_metrics.items():
            if isinstance(v, str): new_yaml.append(f'{k}: "{v}"')
            else: new_yaml.append(f'{k}: {v}')

        new_yaml.append("---\n")
        new_yaml.append(f"## Practice Logs: {name}\n")

        with open(abs_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(new_yaml))

        _parse_and_upsert_skill(abs_path, filename)
        return jsonify({"status": "success", "filepath": filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500