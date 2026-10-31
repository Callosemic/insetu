import os
import re
import json
from pathlib import Path
from typing import TypedDict, Optional
from flask import send_file
from insetu.core.sdk import InSetuExtension

DB_SCHEMA = {
    "file_preferences": {
        "filepath": "TEXT PRIMARY KEY",
        "writing_mode": "INTEGER DEFAULT 0",
        "doc_type": "TEXT"
    }
}

EDITOR_SCHEMA = [
    {
        "id": "insetu_md_links",
        "label": "Enable Interactive MD Links",
        "type": "boolean",
        "scope": "daemon",
        "default": True,
        "description": "Renders Markdown links as clickable icons in the editor."
    }
]
# Language packs shipped with insetu, served as static files (built by scripts/vendor_codemirror.sh).
BUNDLED_CODEMIRROR_DIR = Path(__file__).resolve().parent.parent.parent.joinpath("static", "vendor", "codemirror")
BUNDLED_CODEMIRROR_ROUTE = "/static/vendor/codemirror"
_LANGUAGE_MODE_RE = re.compile(r"^[a-z0-9][a-z0-9_+-]{0,39}$")

editor_bp = InSetuExtension(
    'editor', 
    __name__,
    title="Editor Preferences",
    description="Global code and text editor preferences.",
    schema=DB_SCHEMA,
    settings_schema=EDITOR_SCHEMA,
    core=True
)
__depends__ = []


@editor_bp.on('pre_compile_document')
def _provide_editor_ephemeral_macros(workspace_id=None, **kwargs):
    """Declares editor-specific ephemeral macros (such as wordcount markers) to strip prior to document compilation."""
    return {
        "strip_macros": [r'\{\{wordcount_(?:start|stop|all|sum)\}\}']
    }


def _ensure_editor_prefs_hydrated(ctx):
    count = ctx.db.execute("SELECT count(*) FROM file_preferences").fetchone()[0]
    saved = ctx.store.get("preferences.json", "items", None)
    if count == 0 and saved:
        for pref in saved:
            if pref.get("filepath"):
                fp = pref["filepath"]
                canon_fp = fp if "://" in fp else f"vfs://{fp.lstrip('/')}"
                ctx.db.insert_or_replace("file_preferences", {
                    "filepath": canon_fp,
                    "writing_mode": 1 if pref.get("writing_mode") else 0,
                    "doc_type": pref.get("doc_type")
                })
    elif count > 0:
        ctx.db.execute("UPDATE file_preferences SET filepath = 'vfs://' || filepath WHERE filepath NOT LIKE '%://%'")
        ctx.db.commit()
        if saved is None:
            all_rows = ctx.db.get_all("file_preferences")
            ctx.store.set("preferences.json", "items", all_rows)
@editor_bp.route('preference', methods=['GET'])
def get_preference(ctx):
    filepath = str(ctx.payload.get('file') or '').strip()
    if not filepath:
        return {"writing_mode": False, "doc_type": None}
    _ensure_editor_prefs_hydrated(ctx)
    row = ctx.db.get_by_id("file_preferences", filepath, id_col="filepath")
    if not row:
        return {"writing_mode": False, "doc_type": None}
    return {
        "writing_mode": bool(row.get('writing_mode')),
        "doc_type": row.get('doc_type')
    }

@editor_bp.route('preference', methods=['POST'], docstring="[sync] Updates the editor writing mode and document type for a specific file.")
def set_preference(ctx):
    data = ctx.payload or {}
    filepath = str(data.get("filepath") or "").strip()
    if not filepath:
        return {"error": "filepath required"}, 400

    _ensure_editor_prefs_hydrated(ctx)
    writing_mode = 1 if data.get("writing_mode") else 0
    doc_type = data.get("doc_type")
    ctx.db.insert_or_replace("file_preferences", {
        "filepath": filepath,
        "writing_mode": writing_mode,
        "doc_type": doc_type
    })
    all_rows = ctx.db.get_all("file_preferences")
    ctx.store.set("preferences.json", "items", all_rows)
    return {"status": "success"}

class VendorizePayload(TypedDict):
    mode: str

class VendorizeResponse(TypedDict):
    status: str
    path: str

@editor_bp.route('vendor/<filename>', methods=['GET'], docstring="[sync] Serves workspace-isolated CodeMirror vendor modules from .insetu/.")
def serve_vendor_asset(ctx, filename):
    vendor_dir = Path(ctx.paths["artifacts_base"]).joinpath("vendor", "codemirror")
    target_path = vendor_dir.joinpath(filename).resolve()

    try:
        target_path.relative_to(vendor_dir.resolve())
    except ValueError:
        return "403 Forbidden: Invalid vendor asset path.", 403

    if target_path.exists() and target_path.is_file():
        return send_file(target_path.as_posix(), mimetype='application/javascript')

    return "Vendor asset not found.", 404
@editor_bp.route('vendorize', methods=['POST'], request_schema=VendorizePayload, response_schema=VendorizeResponse, docstring="[sync] Resolves a CodeMirror 6 language pack from the packs bundled with insetu, then from the workspace's local vendor folder (.insetu/vendor/codemirror/lang-<mode>.js). Never downloads code (S4).")
def vendorize_language(ctx):
    """Resolves a language pack locally: bundled packs first, then a pack a person placed in the local vendor folder."""
    data = ctx.payload or {}
    mode = str(data.get("mode") or "").strip().lower()
    if not mode:
        return {"error": "mode parameter is required"}, 400
    if not _LANGUAGE_MODE_RE.match(mode):
        return {"error": f"'{mode}' is not a valid language name."}, 400

    filename = f"lang-{mode}.js"
    if BUNDLED_CODEMIRROR_DIR.joinpath(filename).is_file():
        return {"status": "success", "path": f"{BUNDLED_CODEMIRROR_ROUTE}/{filename}"}

    local_dir = Path(ctx.paths["artifacts_base"]).joinpath("vendor", "codemirror")
    if local_dir.joinpath(filename).is_file():
        return {"status": "success", "path": f"/api/{ctx.workspace_id}/editor/vendor/{filename}"}

    return {
        "error": f"No language pack for '{mode}'. insetu does not download code at runtime; to add one, place a built ESM module at {local_dir.joinpath(filename).as_posix()}.",
    }, 404
