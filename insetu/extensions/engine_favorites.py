from pathlib import Path
import os
import json
import uuid
import datetime
from flask import Blueprint, request, jsonify
from insetu.db import get_connection
from insetu.hooks import hooks

favorites_bp = Blueprint('favorites', __name__)
__depends__ = []

@hooks.on('system_boot')
def init_favorites_db():
    """Initializes the multi-tenant localized SQLite schema for favorite items."""
    from insetu.utils_core import get_all_workspace_ids
    for ws_id in get_all_workspace_ids():
        conn = get_connection("favorites", workspace_id=ws_id)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS favorites (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
@favorites_bp.route('/api/<workspace_id>/favorites', methods=['GET'])
def list_favorites(workspace_id):
    try:
        conn = get_connection("favorites", workspace_id=workspace_id)
        cursor = conn.execute("SELECT * FROM favorites ORDER BY created_at DESC")
        items = [dict(row) for row in cursor.fetchall()]
        return jsonify({"favorites": items})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@favorites_bp.route('/api/<workspace_id>/favorites/add', methods=['POST'])
def add_favorite(workspace_id):
    data = request.json or {}
    path = data.get('path', '').strip()
    fav_type = data.get('type', 'file').strip()
    name = data.get('name', '').strip() or path.split('/')[-1]

    if not path:
        return jsonify({"error": "Path is required"}), 400

    try:
        conn = get_connection("favorites", workspace_id=workspace_id)
        # Prevent duplication entries
        exists = conn.execute("SELECT id FROM favorites WHERE path = ?", (path,)).fetchone()
        if exists:
            return jsonify({"status": "success", "message": "Already favorited", "id": exists['id']})

        fav_id = f"fav_{uuid.uuid4().hex[:8]}"
        now = datetime.datetime.now().isoformat()
        conn.execute(
            "INSERT INTO favorites (id, path, type, name, created_at) VALUES (?, ?, ?, ?, ?)",
            (fav_id, path, fav_type, name, now)
        )
        conn.commit()
        return jsonify({"status": "success", "id": fav_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@favorites_bp.route('/api/<workspace_id>/favorites/<fav_id>', methods=['DELETE'])
def delete_favorite(workspace_id, fav_id):
    try:
        conn = get_connection("favorites", workspace_id=workspace_id)
        conn.execute("DELETE FROM favorites WHERE id = ?", (fav_id,))
        conn.commit()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500