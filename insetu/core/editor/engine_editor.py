import os
import json
import urllib.request
from pathlib import Path
from typing import TypedDict, Optional
from flask import jsonify, send_file
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
    filepath = ctx.req.args.get('file', '').strip()
    if not filepath:
        return jsonify({"writing_mode": False, "doc_type": None})
    _ensure_editor_prefs_hydrated(ctx)
    row = ctx.db.get_by_id("file_preferences", filepath, id_col="filepath")
    if not row:
        return jsonify({"writing_mode": False, "doc_type": None})
    return jsonify({
        "writing_mode": bool(row.get('writing_mode')),
        "doc_type": row.get('doc_type')
    })

@editor_bp.route('preference', methods=['POST'], docstring="[sync] Updates the editor writing mode and document type for a specific file.")
def set_preference(ctx):
    data = ctx.req.json or {}
    filepath = data.get("filepath", "").strip()
    if not filepath:
        return jsonify({"error": "filepath required"}), 400

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
    return jsonify({"status": "success"})

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

@editor_bp.route('vendorize', methods=['POST'], request_schema=VendorizePayload, response_schema=VendorizeResponse, docstring="[sync] Dynamically fetches and vendorizes a missing CodeMirror 6 language pack into .insetu/ per ADR 0032.")
def vendorize_language(ctx):
    data = ctx.req.json or {}
    mode = (data.get("mode") or "").strip().lower()
    if not mode:
        return jsonify({"error": "mode parameter is required"}), 400

    vendor_dir = Path(ctx.paths["artifacts_base"]).joinpath("vendor", "codemirror")
    filename = f"lang-{mode}.js"
    target_path = vendor_dir.joinpath(filename)
    public_route = f"/api/{ctx.workspace_id}/editor/vendor/{filename}"

    if not target_path.exists():
        esm_url = f"https://esm.sh/@codemirror/lang-{mode}?bundle&external=@codemirror/state,@codemirror/view,@codemirror/language,@codemirror/autocomplete,@codemirror/commands,@codemirror/lint,codemirror"
        try:
            req = urllib.request.Request(esm_url, headers={"User-Agent": "inSetu-Vendorizer/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                code_bytes = resp.read()
            code_str = code_bytes.decode('utf-8')

            # Synchronous write guarantees Read-After-Write consistency for the frontend import
            vendor_dir.mkdir(parents=True, exist_ok=True)
            target_path.write_text(code_str, encoding='utf-8')
        except Exception as e:
            return jsonify({"error": f"Failed to fetch language bundle for '{mode}': {str(e)}"}), 500

    return jsonify({"status": "success", "path": public_route})