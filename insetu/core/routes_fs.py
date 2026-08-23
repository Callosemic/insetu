from flask import Blueprint, request, jsonify, send_file
import os
import json
import uuid
import datetime
from pathlib import Path
from insetu.kernel.vfs import execute_vfs_move, execute_vfs_archive, execute_vfs_delete, execute_vfs_save
from insetu.kernel.workers import submit_immediate_job, update_immediate_job_status, register_callback

fs_bp = Blueprint('fs', __name__)
def resolve_vfs_file(workspace_id, filename):
    """Universal path resolver for workspace files, ctx URIs, and artifact contexts."""
    if not filename:
        return None, False
    filename = filename.strip()
    if filename.startswith("system://"):
        filename = filename.replace("system://", "ctx://", 1)

    check_name = filename.replace("vfs://", "", 1) if filename.startswith("vfs://") else filename

    is_artifact = check_name.startswith("ctx://") or check_name.startswith("contexts/") or check_name.startswith("diffs/") or check_name.startswith("workflows/")
    if not is_artifact:
        from insetu.kernel.hooks import hooks
        manifest_res = hooks.emit('request_manifest', workspace_id=workspace_id)
        manifest = next((m for m in manifest_res if m), {})
        base_name = Path(filename).name
        if base_name in manifest:
            is_artifact = True
        else:
            for entry in manifest.values():
                if base_name in entry.get("chunks", []):
                    is_artifact = True
                    meta_type = entry.get("meta", {}).get("type", "")
                    if meta_type == "diff":
                        filename = f"ctx://diffs/{filename}"
                    elif meta_type == "flow":
                        filename = f"ctx://workflows/{filename}"
                    else:
                        filename = f"ctx://contexts/{filename}"
                    break

    from insetu.kernel.hooks import hooks
    overrides = hooks.emit('vfs_resolve_file', filename=filename, workspace_id=workspace_id)
    for res in overrides:
        if res and isinstance(res, tuple) and len(res) == 2:
            if os.path.exists(res[0]):
                return res
    from insetu.kernel.utils import resolve_sandbox_path
    resolved = resolve_sandbox_path(check_name, workspace_id)
    if os.path.exists(resolved):
        return resolved, False

    return None, False
@fs_bp.route('/api/<workspace_id>/fs/exists', methods=['GET'])
def api_fs_exists(workspace_id):
    """Silent validation route that verifies file existence for the UI."""
    filename = request.args.get('file', '').strip()
    if not filename:
        return jsonify({"exists": False, "path": filename})
    resolved_path, _ = resolve_vfs_file(workspace_id, filename)
    exists = bool(resolved_path and os.path.exists(resolved_path))
    return jsonify({"exists": exists, "path": filename})

@fs_bp.route('/api/<workspace_id>/fs/fetch', methods=['GET'])
def api_fs_fetch(workspace_id):
    """Fetches raw content of a target VFS path for frontend viewing."""
    filename = request.args.get('file', '').strip()
    is_absolute_artifact = request.args.get('is_absolute_artifact', 'false').lower() == 'true'
    if not filename:
        return jsonify({"error": "Filepath required"}), 400

    from insetu.kernel.vfs import VFSTransaction
    with VFSTransaction(workspace_id) as vfs:
        content = vfs.read(filename, is_absolute_artifact=is_absolute_artifact)
        if content is None:
            resolved_path, is_artifact = resolve_vfs_file(workspace_id, filename)
            if resolved_path:
                content = vfs.read(resolved_path, is_absolute_artifact=is_artifact or is_absolute_artifact)

    if content is not None:
        return content, 200, {'Content-Type': 'text/plain; charset=utf-8'}
    return "File not found.", 404

@fs_bp.route('/download/<path:filename>')
def download_file(filename):
    """Universal download gateway for contexts, artifacts, and vault files."""
    from insetu.kernel.utils import sniff_tenant_id
    workspace_id = sniff_tenant_id()

    resolved_path, _ = resolve_vfs_file(workspace_id, filename)
    if not resolved_path or not os.path.exists(resolved_path):
        return jsonify({"error": "File object not found"}), 404

    safe_basename = Path(resolved_path).name
    base, ext = os.path.splitext(safe_basename)
    dl_name = f"{base}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}{ext}"

    if request.args.get('inline') == '1':
        return send_file(resolved_path, as_attachment=False)

    return send_file(resolved_path, as_attachment=True, download_name=dl_name, mimetype='application/octet-stream')
def _background_fs_search(job_id, workspace_id, query):
    try:
        update_immediate_job_status(job_id, 'processing', "Searching workspace files...", workspace_id=workspace_id)
        from insetu.kernel.hooks import hooks
        results = []
        search_responses = hooks.emit('vfs_search', workspace_id=workspace_id, query=query)
        for res in search_responses:
            if res: results.extend(res)
        results.sort(key=lambda x: x["score"], reverse=True)
        results = results[:50]
        update_immediate_job_status(job_id, 'completed', "Search complete.", artifact={"results": results}, workspace_id=workspace_id)
    except Exception as e:
        update_immediate_job_status(job_id, 'failed', f"Search failed: {str(e)}", workspace_id=workspace_id)

register_callback("fs", "search_task", _background_fs_search)
@fs_bp.route('/api/<workspace_id>/fs/search', methods=['POST'])
def api_fs_search(workspace_id):
    try:
        data = request.get_json(silent=True) or {}
        query = data.get('q', '').lower()
        if not query: return jsonify({"results": []})

        job_id = f"sch_{uuid.uuid4().hex[:8]}"
        submit_immediate_job(job_id, "fs", "search_task", json.dumps({"query": query}), workspace_id=workspace_id)
        return jsonify({"status": "accepted", "job_id": job_id}), 202
    except Exception as e:
        return jsonify({"error": f"Search dispatch failed: {str(e)}"}), 500
@fs_bp.route('/api/<workspace_id>/fs/move', methods=['POST'])
def api_fs_move(workspace_id):
    try:
        data = request.get_json(silent=True) or {}
        filepath = data.get("filepath", "").strip()
        dest_path = data.get("dest_path", "").strip()
        if not filepath or not dest_path:
                return jsonify({"error": "Filepath and destination required"}), 400
        res, code = execute_vfs_move(workspace_id, filepath, dest_path)
        return jsonify(res), code
    except Exception as e:
        return jsonify({"error": f"VFS Move Error: {str(e)}"}), 500
@fs_bp.route('/api/<workspace_id>/fs/archive', methods=['POST'])
def api_fs_archive(workspace_id):
    try:
        data = request.get_json(silent=True) or {}
        filepath = data.get("filepath", "").strip()
        if not filepath:
                return jsonify({"error": "Filepath required"}), 400
        res, code = execute_vfs_archive(workspace_id, filepath)
        return jsonify(res), code
    except Exception as e:
        return jsonify({"error": f"VFS Archive Error: {str(e)}"}), 500
@fs_bp.route('/api/<workspace_id>/fs/delete', methods=['POST'])
def api_fs_delete(workspace_id):
    try:
        data = request.get_json(silent=True) or {}
        filepath = data.get("filepath", "").strip()
        if not filepath:
                return jsonify({"error": "Filepath required"}), 400
        res, code = execute_vfs_delete(workspace_id, filepath)
        return jsonify(res), code
    except Exception as e:
        return jsonify({"error": f"VFS Delete Error: {str(e)}"}), 500

@fs_bp.route('/api/<workspace_id>/fs/upload', methods=['POST'])
def api_fs_upload(workspace_id):
    """Native multipart/form-data uploader for robust binary handling."""
    if 'file' not in request.files:
            return jsonify({"error": "No files provided"}), 400

    files = request.files.getlist('file')
    dest_dir = request.form.get('dest_dir', '').strip()
    import werkzeug.utils
    import time
    from insetu.kernel.db import get_connection
    from insetu.kernel.hooks import hooks
    from pathlib import Path
    from insetu.kernel.utils import resolve_sandbox_path
    
    db_conn = get_connection("workers", workspace_id=workspace_id)
    uploaded_paths = []
    mutations = []
    for file in files:
            if file.filename == '':
                    continue

            filename = werkzeug.utils.secure_filename(file.filename)
            filepath = f"{dest_dir}/{filename}".strip('/') if dest_dir else filename
            
            overrides = hooks.emit('vfs_resolve_path', filepath=filepath, workspace_id=workspace_id)
            resolved_path = next((r for r in overrides if r), None) or resolve_sandbox_path(filepath, workspace_id)

            import os
            is_new = not os.path.exists(resolved_path)
            os.makedirs(Path(resolved_path).parent, exist_ok=True)

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
@fs_bp.route('/api/<workspace_id>/fs/save', methods=['POST'])
def api_fs_save(workspace_id):
    """Universal save-back endpoint with explicit path routing guardrails."""
    try:
        data = request.get_json(silent=True)
        if not data:
                return jsonify({"error": "Invalid or missing JSON payload"}), 400

        if "is_absolute_artifact" in data:
                del data["is_absolute_artifact"]

        filepath, content = data.get("filepath", "").strip(), data.get("content", "")
        if not filepath: 
                return jsonify({"error": "Filepath is required"}), 400

        result = execute_vfs_save(workspace_id, filepath, content, data)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": f"File System Error: {str(e)}"}), 500