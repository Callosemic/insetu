import os
import json
import uuid
import time
import hashlib
import datetime
import traceback
from pathlib import Path
from typing import TypedDict, Optional, List, Dict, Any
import werkzeug.utils
from flask import request, jsonify, send_file
from insetu.core.sdk import InSetuExtension
from akasa.db import get_connection
from akasa.hooks import hooks
from akasa.utils import sniff_tenant_id
from akasa.vfs import execute_vfs_move, execute_vfs_delete, execute_vfs_save, execute_vfs_bulk, _cache_evict
from insetu.core.utils_core import InSetuURI, get_repo_path, execute_binary
fs_bp = InSetuExtension(
    'fs', 
    __name__, 
    title="Virtual File System", 
    description="Core VFS access and mutation routes.", 
    core=True
)
__depends__ = []
def _is_readonly_template_path(filepath: str) -> bool:
    if not filepath:
        return False
    norm = str(filepath).replace('\\', '/')
    if '/.templates/user/' in norm or norm.endswith('/.templates/user') or norm.startswith(('.templates/user/', 'ctx://prompts/.templates/user/')):
        return False
    return '/.templates/' in norm or norm.startswith(('.templates/', 'ctx://prompts/.templates/'))
class FileTargetPayload(TypedDict):
    file: str
@fs_bp.route('exists', methods=['GET'], request_schema=FileTargetPayload, docstring="Verifies if a file exists on the Virtual File System.")
def api_fs_exists(ctx):
    """Silent validation route that verifies file existence for the UI."""
    workspace_id = ctx.workspace_id
    filename = ctx.req.args.get('file', '').strip()
    if not filename:
        return jsonify({"exists": False, "path": filename})
    uri = InSetuURI(filename)
    return jsonify({"exists": uri.exists(workspace_id), "path": str(uri)})
@fs_bp.route('fetch', methods=['GET'], request_schema=FileTargetPayload, docstring="Fetches or downloads the content of a target canonical VFS/CTX/WS URI.")
def api_fs_fetch(ctx):
    """Unified URI read and download gateway for vfs://, ctx://, and ws:// resources."""
    workspace_id = ctx.workspace_id
    filename = ctx.req.args.get('file', '').strip()

    if not filename:
        return jsonify({"error": "Filepath required"}), 400

    uri = InSetuURI(filename)
    as_download = ctx.req.args.get('download') == '1'

    if as_download:
        resolved_path = uri.resolve_if_exists(workspace_id)
        if not resolved_path:
            return jsonify({"error": "File object not found"}), 404
        safe_basename = Path(resolved_path).name
        base, ext = os.path.splitext(safe_basename)
        dl_name = f"{base}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}{ext}"
        res = send_file(resolved_path, as_attachment=True, download_name=dl_name, mimetype='application/octet-stream')
        res.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return res

    content = uri.read(workspace_id)
    if content is not None:
        return content, 200, {'Content-Type': 'text/plain; charset=utf-8'}
    return "File not found.", 404

class FileGitDiffResponse(TypedDict):
    filepath: str
    repo: str
    head_content: str
    working_content: str
    is_untracked: bool
    is_modified: bool
@fs_bp.route('git_diff', methods=['GET'], request_schema=FileTargetPayload, response_schema=FileGitDiffResponse, docstring="[sync] Returns the git HEAD content and current working tree content for a target VFS file.")
def api_fs_git_diff(ctx):
    """Retrieves the Git HEAD baseline and current working tree text for a file."""
    workspace_id = ctx.workspace_id
    filename = ctx.req.args.get('file', '').strip()
    if not filename:
        return jsonify({"error": "Filepath required"}), 400

    uri = InSetuURI(filename)
    repo_dir = uri.repo
    rel_path = uri.path

    working_content = uri.read(workspace_id)
    if working_content is None:
        working_content = ""

    head_content = ""
    is_untracked = False

    if repo_dir:
        repo_path = get_repo_path(repo_dir, workspace_id)
        if repo_path and os.path.exists(repo_path):
            try:
                res = execute_binary(['git', 'show', f'HEAD:{rel_path}'], capture_output=True, text=True, cwd=repo_path)
                if res.returncode == 0:
                    head_content = res.stdout
                else:
                    is_untracked = True
            except Exception:
                is_untracked = True

    return jsonify({
        "filepath": str(uri),
        "repo": repo_dir,
        "head_content": head_content,
        "working_content": working_content,
        "is_untracked": is_untracked,
        "is_modified": head_content != working_content
    })
# Bypass the InSetuExtension wrapper to retain the global /download/ path for absolute URLs
@fs_bp.bp.route('/download/<path:filename>')
def download_file(filename):
    """Universal download gateway for contexts, artifacts, and vault files."""
    workspace_id = sniff_tenant_id()
    uri = InSetuURI.from_external_input(filename)
    resolved_path = uri.resolve_if_exists(workspace_id)
    if not resolved_path:
        return jsonify({"error": "File object not found"}), 404

    safe_basename = Path(resolved_path).name
    base, ext = os.path.splitext(safe_basename)
    dl_name = f"{base}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}{ext}"
    res = send_file(resolved_path, as_attachment=(request.args.get('inline') != '1'), download_name=dl_name, mimetype='application/octet-stream')
    res.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    res.headers['Pragma'] = 'no-cache'
    res.headers['Expires'] = '0'
    return res
@fs_bp.worker("search_task")
def _background_fs_search(ctx, query="", **kwargs):
    ctx.jobs.update_progress("Searching workspace files...")
    results = []
    search_responses = ctx.emit('vfs_search', query=query)
    for res in search_responses:
        if res: results.extend(res)
    results.sort(key=lambda x: x["score"], reverse=True)
    results = results[:50]
    return {"message": "Search complete.", "artifact": {"results": results}}

class FileSearchPayload(TypedDict):
    q: str

@fs_bp.route('search', methods=['POST'], request_schema=FileSearchPayload, docstring="Fuzzy search across workspace files.")
def api_fs_search(ctx):
    try:
        data = ctx.req.get_json(silent=True) or {}
        query = data.get('q', '').lower()
        if not query: return jsonify({"results": []})
        job_id = ctx.jobs.submit("search_task", job_category="system_background", query=query)
        return jsonify({"status": "accepted", "job_id": job_id}), 202
    except Exception as e:
        return jsonify({"error": f"Search dispatch failed: {str(e)}"}), 500

class FileMovePayload(TypedDict):
    filepath: str
    dest_path: str
@fs_bp.route('move', methods=['POST'], request_schema=FileMovePayload, docstring="[sync] Moves or renames a file within the Virtual File System.")
def api_fs_move(ctx):
    workspace_id = ctx.workspace_id
    try:
        data = ctx.req.get_json(silent=True) or {}
        filepath = data.get("filepath", "").strip()
        dest_path = data.get("dest_path", "").strip()
        if not filepath or not dest_path:
                return jsonify({"error": "Filepath and destination required"}), 400
        if _is_readonly_template_path(filepath) or _is_readonly_template_path(dest_path):
                return jsonify({"error": "403 Forbidden: Built-in module templates are read-only. Fork the template to your workspace prompts to edit it."}), 403
        src_uri = str(InSetuURI(filepath))
        dst_uri = str(InSetuURI(dest_path))
        res, code = execute_vfs_move(workspace_id, src_uri, dst_uri)
        return jsonify(res), code
    except Exception as e:
        try:
            hooks.emit_background('system_error', source="VFS:Move", error_type=type(e).__name__, message=str(e), traceback=traceback.format_exc(), payload=json.dumps(ctx.req.get_json(silent=True) or {}), workspace_id=workspace_id)
        except Exception: pass
        return jsonify({"error": f"VFS Move Error: {str(e)}"}), 500

class FileActionPayload(TypedDict):
    filepath: str
@fs_bp.route('archive', methods=['POST'], request_schema=FileActionPayload, docstring="[sync] Archives a file by moving it to an archived/ subdirectory.")
def api_fs_archive(ctx):
    workspace_id = ctx.workspace_id
    try:
        data = ctx.req.get_json(silent=True) or {}
        filepath = data.get("filepath", "").strip()
        if not filepath:
                return jsonify({"error": "Filepath required"}), 400
        if _is_readonly_template_path(filepath):
                return jsonify({"error": "403 Forbidden: Built-in module templates are read-only."}), 403
        uri = InSetuURI(filepath)

        parent_path = uri.path.rpartition('/')[0] if '/' in uri.path else ''

        if not parent_path or parent_path == '.':
            new_path = f"archived/{uri.basename}"
        else:
            new_path = f"{parent_path}/archived/{uri.basename}"
        scheme = uri.scheme or "vfs"
        rel_dest = f"{scheme}://{uri.repo}/{new_path}" if uri.repo else f"{scheme}://{new_path}"

        res, code = execute_vfs_move(workspace_id, str(uri), rel_dest)
        # Retain payload signature compatibility for the frontend
        res["new_path"] = rel_dest
        res["message"] = "File archive queued."
        return jsonify(res), code
    except Exception as e:
        try:
            hooks.emit_background('system_error', source="VFS:Archive", error_type=type(e).__name__, message=str(e), traceback=traceback.format_exc(), payload=json.dumps(ctx.req.get_json(silent=True) or {}), workspace_id=workspace_id)
        except Exception: pass
        return jsonify({"error": f"VFS Archive Error: {str(e)}"}), 500
@fs_bp.route('delete', methods=['POST'], request_schema=FileActionPayload, docstring="[sync] Permanently deletes a file from the Virtual File System.")
def api_fs_delete(ctx):
    workspace_id = ctx.workspace_id
    try:
        data = ctx.req.get_json(silent=True) or {}
        filepath = data.get("filepath", "").strip()
        if not filepath:
                return jsonify({"error": "Filepath required"}), 400
        if _is_readonly_template_path(filepath):
                return jsonify({"error": "403 Forbidden: Built-in module templates are read-only."}), 403
        target_uri = str(InSetuURI(filepath))
        res, code = execute_vfs_delete(workspace_id, target_uri)
        return jsonify(res), code
    except Exception as e:
        try:
            hooks.emit_background('system_error', source="VFS:Delete", error_type=type(e).__name__, message=str(e), traceback=traceback.format_exc(), payload=json.dumps(ctx.req.get_json(silent=True) or {}), workspace_id=workspace_id)
        except Exception: pass
        return jsonify({"error": f"VFS Delete Error: {str(e)}"}), 500

class BulkMutationItem(TypedDict, total=False):
    action: str  # 'move' | 'archive' | 'delete'
    filepath: str
    dest_path: Optional[str]
    is_dir: Optional[bool]

class FileBulkPayload(TypedDict):
    operations: List[BulkMutationItem]

@fs_bp.route('bulk', methods=['POST'], request_schema=FileBulkPayload, docstring="[sync] Executes a batch of VFS file or directory mutations (move, archive, delete) in a single atomic operation.")
def api_fs_bulk(ctx):
    workspace_id = ctx.workspace_id
    try:
        data = ctx.req.get_json(silent=True) or {}
        raw_ops = data.get("operations", [])
        if not raw_ops or not isinstance(raw_ops, list):
            return jsonify({"error": "A non-empty 'operations' list is required"}), 400

        normalized_ops = []
        for item in raw_ops:
            act = (item.get("action") or "").strip().lower()
            fp = (item.get("filepath") or "").strip()
            if not fp or act not in ("move", "archive", "delete"):
                continue
            if _is_readonly_template_path(fp) or _is_readonly_template_path(item.get("dest_path", "")):
                continue
            src_uri_obj = InSetuURI(fp)
            src_uri = str(src_uri_obj)
            if act == "delete":
                normalized_ops.append({
                    "action": "delete",
                    "filepath": src_uri,
                    "is_dir": bool(item.get("is_dir"))
                })
            elif act == "move":
                dest = (item.get("dest_path") or "").strip()
                if dest:
                    dst_uri = str(InSetuURI(dest))
                    if dst_uri != src_uri:
                        normalized_ops.append({
                            "action": "move",
                            "filepath": src_uri,
                            "dest_path": dst_uri,
                            "is_dir": bool(item.get("is_dir"))
                        })
            elif act == "archive":
                parent_path = src_uri_obj.path.rpartition('/')[0] if '/' in src_uri_obj.path else ''
                if not parent_path or parent_path == '.':
                    new_path = f"archived/{src_uri_obj.basename}"
                else:
                    new_path = f"{parent_path}/archived/{src_uri_obj.basename}"
                scheme = src_uri_obj.scheme or "vfs"
                rel_dest = f"{scheme}://{src_uri_obj.repo}/{new_path}" if src_uri_obj.repo else f"{scheme}://{new_path}"
                normalized_ops.append({
                    "action": "move",
                    "filepath": src_uri,
                    "dest_path": rel_dest,
                    "is_dir": bool(item.get("is_dir"))
                })

        if not normalized_ops:
            return jsonify({"error": "No valid bulk operations provided"}), 400

        res, code = execute_vfs_bulk(workspace_id, normalized_ops)
        return jsonify(res), code
    except Exception as e:
        try:
            hooks.emit_background('system_error', source="VFS:Bulk", error_type=type(e).__name__, message=str(e), traceback=traceback.format_exc(), payload=json.dumps(ctx.req.get_json(silent=True) or {}), workspace_id=workspace_id)
        except Exception:
            pass
        return jsonify({"error": f"VFS Bulk Error: {str(e)}"}), 500
class FileUploadRequest(TypedDict):
    file: List[bytes]
    dest_dir: str

class FileUploadResponse(TypedDict):
    status: str
    message: str
    filepaths: List[str]

@fs_bp.route('upload', methods=['POST'], request_schema=FileUploadRequest, response_schema=FileUploadResponse, docstring="[sync] Uploads multiple files via multipart/form-data to a specified directory.")
def api_fs_upload(ctx):
    """Native multipart/form-data uploader for robust binary handling."""
    workspace_id = ctx.workspace_id
    if 'file' not in ctx.req.files:
            return jsonify({"error": "No files provided"}), 400
    files = ctx.req.files.getlist('file')
    dest_dir = ctx.req.form.get('dest_dir', '').strip()

    db_conn = get_connection("workers", workspace_id=workspace_id)
    uploaded_paths = []
    mutations = []
    for file in files:
            if file.filename == '':
                    continue
            filename = werkzeug.utils.secure_filename(file.filename)
            target_path = f"{dest_dir.rstrip('/')}/{filename}" if dest_dir else f"vfs://{filename}"

            uri = InSetuURI(target_path)
            filepath = str(uri)

            resolved_path = ctx.resolve_path(filepath)
            if not resolved_path:
                continue
            is_new = not os.path.exists(resolved_path)
            os.makedirs(Path(resolved_path).parent, exist_ok=True)

            _cache_evict(resolved_path)
            file.save(resolved_path)
            uploaded_paths.append(filepath)
            mutations.append({"filepath": filepath, "operation": "save", "ignore_ledger": False})
            # Trigger VFS Event Ledger sync
            db_conn.execute(
                    "INSERT OR REPLACE INTO vfs_event_log (filepath, mutation_type, timestamp) VALUES (?, ?, ?)",
                    (filepath, 'modified' if not is_new else 'added', time.time())
            )

    hooks.emit('vfs_mutated', workspace_id=workspace_id, mutations=mutations)
    db_conn.commit()

    if not uploaded_paths:
            return jsonify({"error": "No valid files uploaded"}), 400
    return jsonify({"status": "success", "message": f"{len(uploaded_paths)} file(s) uploaded successfully.", "filepaths": uploaded_paths})

class FileSavePayload(TypedDict):
    filepath: str
    content: str
    base_hash: Optional[str]
@fs_bp.route('save', methods=['POST'], request_schema=FileSavePayload, docstring="[sync] Saves text content securely to the VFS. Creates directories if they don't exist.")
def api_fs_save(ctx):
    """Universal save-back endpoint with explicit path routing guardrails."""
    workspace_id = ctx.workspace_id
    try:
        data = ctx.req.get_json(silent=True)
        if not data:
                return jsonify({"error": "Invalid or missing JSON payload"}), 400

        # Protect VFS sandbox and ledger parity from malicious API injections
        if "is_absolute_artifact" in data:
                del data["is_absolute_artifact"]
        if "ignore_ledger" in data:
                del data["ignore_ledger"]
        filepath, content = data.get("filepath", "").strip(), data.get("content", "")
        if not filepath: 
                return jsonify({"error": "Filepath is required"}), 400
        if _is_readonly_template_path(filepath):
                return jsonify({"error": "403 Forbidden: Built-in module templates are read-only. Fork the template to your workspace prompts to edit it."}), 403
        filepath = str(InSetuURI(filepath))
        base_hash = data.get("base_hash")
        if base_hash:
            current_disk_content = ctx.vfs.read(filepath)
            if current_disk_content is not None:
                current_hash = hashlib.sha256(current_disk_content.encode('utf-8')).hexdigest()
                if current_hash != base_hash and current_disk_content != content:
                    # Preserve logical URI boundaries using pure string math to avoid Pathlib stripping '://'
                    parts = filepath.split('/')
                    filename = parts[-1]
                    conflict_name = f"{Path(filename).stem}.conflict_{int(time.time())}{Path(filename).suffix}"

                    parts[-1] = conflict_name
                    conflict_path = "/".join(parts)

                    execute_vfs_save(workspace_id, conflict_path, content, data={})
                    return jsonify({"error": f"OCC Conflict: File was modified externally. Offline changes saved to {conflict_name}"}), 409
        result = execute_vfs_save(workspace_id, filepath, content, data)
        return jsonify(result)
    except Exception as e:
        try:
            # Masking content string to prevent payload blowout in the ledger
            safe_payload = {"filepath": data.get("filepath")} if isinstance(data, dict) else {}
            hooks.emit_background('system_error', source="VFS:Save", error_type=type(e).__name__, message=str(e), traceback=traceback.format_exc(), payload=json.dumps(safe_payload), workspace_id=workspace_id)
        except Exception: pass
        return jsonify({"error": f"File System Error: {str(e)}"}), 500