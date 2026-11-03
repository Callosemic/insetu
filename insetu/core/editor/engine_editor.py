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
_EXPORT_IDENT_RE = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]{0,63}$")
_VALID_KINDS = frozenset({"builtin", "lezer", "stream"})


def _local_vendor_dir(ctx) -> Path:
    """The workspace folder for person-placed language packs: <control dir>/vendor/codemirror/ (.insetu/vendor/codemirror/ by default).

    Kept beside the workspace configuration, never under cache/, because a person put this code here on purpose.
    """
    return Path(ctx.paths["control_dir"]).joinpath("vendor", "codemirror")


def _safe_local_rel_file(local_dir: Path, rel_file: str) -> Optional[str]:
    """Validates a relative JS file path inside .insetu/vendor/codemirror/ and returns its clean POSIX path if it exists."""
    clean = str(rel_file or "").strip().replace("\\", "/").lstrip("/")
    if not clean or not clean.endswith(".js") or ".." in clean.split("/"):
        return None
    base = local_dir.resolve()
    target = base.joinpath(clean).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        return None
    return clean if target.is_file() else None


def _load_bundled_languages() -> dict:
    """Loads the bundled static/vendor/codemirror/languages.json manifest."""
    manifest_path = BUNDLED_CODEMIRROR_DIR.joinpath("languages.json")
    if not manifest_path.is_file():
        return {}
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        langs = data.get("languages")
        return dict(langs) if isinstance(langs, dict) else {}
    except (OSError, ValueError):
        return {}


def _load_local_languages(local_dir: Path) -> dict:
    """Loads valid person-placed language entries from .insetu/vendor/codemirror/languages.json and bare lang-<id>.js files."""
    if not local_dir.is_dir():
        return {}
    local_entries = {}
    local_manifest = local_dir.joinpath("languages.json")
    if local_manifest.is_file():
        try:
            raw = json.loads(local_manifest.read_text(encoding="utf-8"))
            raw_langs = raw.get("languages") if isinstance(raw, dict) else None
            if isinstance(raw_langs, dict):
                for raw_id, spec in raw_langs.items():
                    lang_id = str(raw_id or "").strip().lower()
                    if not _LANGUAGE_MODE_RE.match(lang_id) or not isinstance(spec, dict):
                        continue
                    kind = str(spec.get("kind") or "lezer").strip().lower()
                    if kind not in ("lezer", "stream"):
                        continue
                    export_name = str(spec.get("export") or lang_id).strip()
                    if not _EXPORT_IDENT_RE.match(export_name):
                        continue
                    safe_rel = _safe_local_rel_file(local_dir, spec.get("file") or f"lang-{lang_id}.js")
                    if not safe_rel:
                        continue
                    entry = {
                        "label": str(spec.get("label") or lang_id.title()),
                        "kind": kind,
                        "file": safe_rel,
                        "export": export_name,
                        "source": "local",
                    }
                    if isinstance(spec.get("options"), dict):
                        entry["options"] = spec["options"]
                    if isinstance(spec.get("extensions"), list):
                        entry["extensions"] = [
                            str(e).strip().lstrip(".").lower()
                            for e in spec["extensions"]
                            if str(e).strip()
                        ]
                    if isinstance(spec.get("filenames"), list):
                        entry["filenames"] = [
                            str(f).strip()
                            for f in spec["filenames"]
                            if str(f).strip()
                        ]
                    local_entries[lang_id] = entry
        except (OSError, ValueError):
            pass

    for bare_pack in sorted(local_dir.glob("lang-*.js")):
        if not bare_pack.is_file():
            continue
        lang_id = bare_pack.name[len("lang-"):-len(".js")].lower()
        if not _LANGUAGE_MODE_RE.match(lang_id) or not _EXPORT_IDENT_RE.match(lang_id):
            continue
        if lang_id in local_entries:
            continue
        local_entries[lang_id] = {
            "label": lang_id.title(),
            "kind": "lezer",
            "file": bare_pack.name,
            "export": lang_id,
            "extensions": [lang_id],
            "source": "local",
        }
    return local_entries


def _merged_languages_manifest(ctx) -> dict:
    """Merges bundled languages with valid local entries; bundled language IDs always take precedence."""
    bundled = _load_bundled_languages()
    local_dir = _local_vendor_dir(ctx)
    local_langs = _load_local_languages(local_dir)
    merged = {}
    for lang_id, spec in local_langs.items():
        if lang_id not in bundled:
            merged[lang_id] = spec
    for lang_id, spec in bundled.items():
        merged[lang_id] = spec
    return {"schema": 1, "languages": merged}


def _language_entry_url(ctx, entry: dict, local_dir: Path) -> Optional[str]:
    """The URL a manifest entry loads from: core for built-ins, the workspace route for local packs, static files otherwise."""
    if entry.get("kind") == "builtin":
        return f"{BUNDLED_CODEMIRROR_ROUTE}/codemirror-core.js"
    rel_file = str(entry.get("file") or "")
    if entry.get("source") == "local":
        safe_rel = _safe_local_rel_file(local_dir, rel_file)
        return f"/api/{ctx.workspace_id}/editor/vendor/{safe_rel}" if safe_rel else None
    bundled_root = BUNDLED_CODEMIRROR_DIR.resolve()
    target = bundled_root.joinpath(rel_file).resolve()
    try:
        target.relative_to(bundled_root)
    except ValueError:
        return None
    return f"{BUNDLED_CODEMIRROR_ROUTE}/{rel_file}" if rel_file and target.is_file() else None


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

class VendorizeResponse(TypedDict, total=False):
    status: str
    path: str
    url: str
    kind: str
    export: str
    options: dict


@editor_bp.route('languages', methods=['GET'], docstring="[sync] Returns the merged CodeMirror language manifest (bundled static/vendor/codemirror/languages.json plus valid local .insetu/vendor/codemirror/ packs).")
def get_editor_languages(ctx):
    """Returns the merged language manifest; bundled language IDs always take precedence over local entries."""
    return _merged_languages_manifest(ctx)


@editor_bp.route('vendor/<path:filename>', methods=['GET'], docstring="[sync] Serves workspace-isolated CodeMirror vendor modules from .insetu/.")
def serve_vendor_asset(ctx, filename):
    vendor_dir = _local_vendor_dir(ctx)
    safe_rel = _safe_local_rel_file(vendor_dir, filename)
    if not safe_rel:
        clean = str(filename or "").replace("\\", "/")
        if ".." in clean.split("/") or clean.startswith("/"):
            return "403 Forbidden: Invalid vendor asset path.", 403
        return "Vendor asset not found.", 404

    target_path = vendor_dir.joinpath(safe_rel).resolve()
    return send_file(target_path.as_posix(), mimetype='application/javascript')


@editor_bp.route('vendorize', methods=['POST'], request_schema=VendorizePayload, response_schema=VendorizeResponse, docstring="[sync] Resolves a CodeMirror 6 language descriptor from the packs bundled with insetu, then from the workspace's local vendor folder (.insetu/vendor/codemirror/). Never downloads code (S4).")
def vendorize_language(ctx):
    """Resolves a language pack descriptor locally: bundled manifest entries first, then local packs."""
    data = ctx.payload or {}
    mode = str(data.get("mode") or "").strip().lower()
    if not mode:
        return {"error": "mode parameter is required"}, 400
    if not _LANGUAGE_MODE_RE.match(mode):
        return {"error": f"'{mode}' is not a valid language name."}, 400

    entry = _merged_languages_manifest(ctx).get("languages", {}).get(mode)
    local_dir = _local_vendor_dir(ctx)
    url = _language_entry_url(ctx, entry, local_dir) if isinstance(entry, dict) else None
    if url:
        return {
            "status": "success",
            "path": url,
            "url": url,
            "kind": entry.get("kind") if entry.get("kind") in _VALID_KINDS else "lezer",
            "export": entry.get("export") or mode,
            "options": entry.get("options") if isinstance(entry.get("options"), dict) else {},
        }

    return {
        "error": f"No language pack for '{mode}'. insetu does not download code at runtime; to add one, place a built ESM module at {local_dir.joinpath(f'lang-{mode}.js').as_posix()} or list it in {local_dir.joinpath('languages.json').as_posix()}.",
    }, 404
