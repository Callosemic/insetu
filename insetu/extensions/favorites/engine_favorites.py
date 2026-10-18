from pathlib import Path
import os
import json
import uuid
import datetime
from typing import TypedDict, Optional
from flask import jsonify
from insetu.core.sdk import InSetuExtension
from insetu.core.utils_core import InSetuURI

FAVORITES_SCHEMA = {
    "favorites": {
        "id": "TEXT PRIMARY KEY",
        "path": "TEXT NOT NULL",
        "type": "TEXT NOT NULL",
        "name": "TEXT NOT NULL",
        "created_at": "TEXT NOT NULL"
    }
}
favorites_bp = InSetuExtension('favorites', __name__, title="Favorites Bar", description="Pin files and folders for quick access.", schema=FAVORITES_SCHEMA)
__depends__ = []
def _ensure_favorites_hydrated(ctx):
    count = ctx.db.execute("SELECT count(*) FROM favorites").fetchone()[0]
    saved = ctx.store.get("bookmarks.json", "favorites", None)
    if count == 0 and saved:
        for item in saved:
            if item.get("id") and item.get("path"):
                norm_item = dict(item)
                p = norm_item["path"]
                norm_item["path"] = str(InSetuURI(p if "://" in p else f"vfs://{p.lstrip('/')}"))
                ctx.db.insert_or_replace("favorites", norm_item)
    elif count > 0:
        ctx.db.execute("UPDATE favorites SET path = 'vfs://' || path WHERE path NOT LIKE '%://%'")
        ctx.db.commit()
        if saved is None:
            _flush_favorites_to_json(ctx)

def _flush_favorites_to_json(ctx):
    items = ctx.db.get_all(table="favorites", order_by="created_at DESC")
    ctx.store.set("bookmarks.json", "favorites", items)

@favorites_bp.route('list', methods=['GET'], docstring="Lists all favorited files, folders, and resources.")
def list_favorites(ctx):
    """Lists all favorited files, folders, and resources."""
    try:
        _ensure_favorites_hydrated(ctx)
        items = ctx.db.get_all(table="favorites", order_by="created_at DESC")
        return jsonify({"favorites": items})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
class FavoriteAddPayload(TypedDict, total=False):
    folderpath: str
    filepath: str
    path: str
    type: str
    name: str
@favorites_bp.route('add', methods=['POST'], request_schema=FavoriteAddPayload, docstring="Pins a new file or folder to the favorites bar.")
def add_favorite(ctx):
    """Pins a new file or folder to the favorites bar."""
    data = ctx.req.json or {}
    # Support both legacy paths and the new explicit folderpath/filepath paradigm
    folderpath = data.get('folderpath', '').strip()
    filepath = data.get('filepath', '').strip()
    raw_path = folderpath if folderpath else (filepath or data.get('path', '').strip())
    if not raw_path:
        return jsonify({"error": "Filepath or folderpath is required"}), 400
    uri = InSetuURI(raw_path)
    path = str(uri)
    fav_type = 'folder' if folderpath else data.get('type', 'file').strip()
    name = data.get('name', '').strip() or uri.basename
    try:
        _ensure_favorites_hydrated(ctx)
        # Prevent duplication entries
        exists = ctx.db.execute("SELECT id FROM favorites WHERE path = ?", (path,)).fetchone()
        if exists:
            return jsonify({"status": "success", "message": "Already favorited", "id": exists['id']})
        fav_id = f"fav_{uuid.uuid4().hex[:8]}"
        now = datetime.datetime.now().isoformat()
        ctx.db.insert_or_replace("favorites", {
            "id": fav_id, "path": path, "type": fav_type, "name": name, "created_at": now
        })
        _flush_favorites_to_json(ctx)
        return jsonify({"status": "success", "id": fav_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
class FavoriteDeletePayload(TypedDict, total=False):
    pass
@favorites_bp.route('delete/<fav_id>', methods=['DELETE', 'POST'], request_schema=FavoriteDeletePayload, docstring="Removes a pinned item from the favorites bar.")
def delete_favorite(ctx, fav_id):
    """Removes a pinned item from the favorites bar."""
    try:
        _ensure_favorites_hydrated(ctx)
        ctx.db.delete("favorites", "id", fav_id)
        _flush_favorites_to_json(ctx)
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500