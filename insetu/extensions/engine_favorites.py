from pathlib import Path
import os
import json
import uuid
import datetime
from flask import jsonify
from insetu.sdk import InSetuExtension

FAVORITES_SCHEMA = {
    "favorites": {
        "id": "TEXT PRIMARY KEY",
        "path": "TEXT NOT NULL",
        "type": "TEXT NOT NULL",
        "name": "TEXT NOT NULL",
        "created_at": "TEXT NOT NULL"
    }
}

favorites_bp = InSetuExtension('favorites', __name__, schema=FAVORITES_SCHEMA)
__depends__ = []
@favorites_bp.route('list', methods=['GET'])
def list_favorites(ctx):
    try:
        items = ctx.db.get_all(table="favorites", order_by="created_at DESC")
        return jsonify({"favorites": items})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@favorites_bp.route('add', methods=['POST'])
def add_favorite(ctx):
    data = ctx.req.json or {}
    path = data.get('path', '').strip()
    fav_type = data.get('type', 'file').strip()
    name = data.get('name', '').strip() or path.split('/')[-1]

    if not path:
        return jsonify({"error": "Path is required"}), 400

    try:
        # Prevent duplication entries
        exists = ctx.db.execute("SELECT id FROM favorites WHERE path = ?", (path,)).fetchone()
        if exists:
            return jsonify({"status": "success", "message": "Already favorited", "id": exists['id']})
        fav_id = f"fav_{uuid.uuid4().hex[:8]}"
        now = datetime.datetime.now().isoformat()
        ctx.db.insert_or_replace("favorites", {
            "id": fav_id, "path": path, "type": fav_type, "name": name, "created_at": now
        })
        return jsonify({"status": "success", "id": fav_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@favorites_bp.route('delete/<fav_id>', methods=['DELETE', 'POST'])
def delete_favorite(ctx, fav_id):
    try:
        ctx.db.delete("favorites", "id", fav_id)
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500