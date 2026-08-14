from flask import jsonify
from insetu.kernel.extension import InSetuExtension

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

@editor_bp.route('preference', methods=['GET'])
def get_preference(ctx):
    filepath = ctx.req.args.get('file', '').strip()
    if not filepath:
        return jsonify({"writing_mode": False, "doc_type": None})
    row = ctx.db.get_by_id("file_preferences", filepath, id_col="filepath")
    if not row:
        return jsonify({"writing_mode": False, "doc_type": None})
    return jsonify({
        "writing_mode": bool(row.get('writing_mode')),
        "doc_type": row.get('doc_type')
    })

@editor_bp.route('preference', methods=['POST'])
def set_preference(ctx):
    data = ctx.req.json or {}
    filepath = data.get("filepath", "").strip()
    if not filepath:
        return jsonify({"error": "filepath required"}), 400

    writing_mode = 1 if data.get("writing_mode") else 0
    doc_type = data.get("doc_type")

    ctx.db.insert_or_replace("file_preferences", {
        "filepath": filepath,
        "writing_mode": writing_mode,
        "doc_type": doc_type
    })
    return jsonify({"status": "success"})