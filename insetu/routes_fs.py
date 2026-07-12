from pathlib import Path
import os
import queue
import threading
from flask import Blueprint, request, jsonify, send_file
from insetu.utils_core import resolve_workspace_path
from insetu.hooks import hooks
import insetu.engine_gather as engine_gather

fs_bp = Blueprint('fs', __name__)

# --- VFS ASYNCHRONOUS COMMIT PIPELINE ---
_VFS_WRITE_QUEUE = queue.Queue()
_VFS_WORKER_THREAD = None
_VFS_SHUTDOWN_SIGNAL = threading.Event()
def _vfs_commit_worker():
    """Consumes write payloads sequentially off-thread to guard the Flask event loop."""
    while not _VFS_SHUTDOWN_SIGNAL.is_set():
        try:
            # Short timeout allows the loop to periodically check for shutdown signals
            task = _VFS_WRITE_QUEUE.get(timeout=1.0)

            if task is None:
                _VFS_WRITE_QUEUE.task_done()
                break

            workspace_id, filepath, content, data = task
            try:
                action = data.get("action", "save")
                if action == "delete":
                    resolved_path = resolve_workspace_path(filepath, workspace_id)
                    if os.path.exists(resolved_path):
                        os.remove(resolved_path)
                    _trigger_post_mutation_hooks(workspace_id, filepath)
                elif action == "move":
                    dest_path = data.get("dest_path")
                    resolved_src = resolve_workspace_path(filepath, workspace_id)
                    resolved_dest = resolve_workspace_path(dest_path, workspace_id)
                    if os.path.exists(resolved_src):
                        os.makedirs(os.path.dirname(resolved_dest), exist_ok=True)
                        import shutil
                        shutil.move(resolved_src, resolved_dest)
                    _trigger_post_mutation_hooks(workspace_id, filepath, dest_path)
                else:
                    execute_vfs_save_physical(workspace_id, filepath, content, data)
            except Exception as e:
                print(f"❌ [VFS Pipeline] Background operation failed for {filepath}: {e}")
            finally:
                _VFS_WRITE_QUEUE.task_done()
        except queue.Empty:
            continue

@hooks.on('system_boot')
def start_vfs_pipeline():
    global _VFS_WORKER_THREAD
    _VFS_SHUTDOWN_SIGNAL.clear()
    _VFS_WORKER_THREAD = threading.Thread(target=_vfs_commit_worker, name="VFS-Commit-Pipeline", daemon=True)
    _VFS_WORKER_THREAD.start()
    print("🚀 Asynchronous VFS Commit Pipeline Online.")

@hooks.on('system_shutdown')
def stop_vfs_pipeline():
    print("🛑 Draining VFS Commit Pipeline...")
    _VFS_SHUTDOWN_SIGNAL.set()
    _VFS_WRITE_QUEUE.put(None) # Poison pill to break blocking lookups
    if _VFS_WORKER_THREAD:
        _VFS_WORKER_THREAD.join(timeout=5.0)
def _trigger_post_mutation_hooks(workspace_id, old_filepath, new_filepath=None):
    """DRY helper for triggering event bus updates after a VFS mutation."""
    hooks.emit_background('post_file_delete', filepath=old_filepath, workspace_id=workspace_id)
    if new_filepath:
        hooks.emit_background('post_file_save', filepath=new_filepath, workspace_id=workspace_id)
def execute_vfs_move(workspace_id, filepath, dest_path):
    _VFS_WRITE_QUEUE.put((workspace_id, filepath, "", {"action": "move", "dest_path": dest_path}))
    return {"status": "accepted", "message": f"File move queued."}, 202
def execute_vfs_archive(workspace_id, filepath):
    from pathlib import Path
    resolved_path = resolve_workspace_path(filepath, workspace_id)
    archive_dir = Path(resolved_path).parent / "archived"
    new_path = archive_dir / Path(resolved_path).name

    # Determine relative path for the new destination
    from insetu.utils_core import get_workspace_physics
    _, ws_root, _ = get_workspace_physics(workspace_id)
    try:
        rel_dest = os.path.relpath(new_path, ws_root).replace('\\', '/')
    except ValueError:
        rel_dest = new_path.as_posix()

    _VFS_WRITE_QUEUE.put((workspace_id, filepath, "", {"action": "move", "dest_path": rel_dest}))
    return {"status": "accepted", "message": f"File archive queued.", "new_path": rel_dest}, 202

def execute_vfs_delete(workspace_id, filepath):
    _VFS_WRITE_QUEUE.put((workspace_id, filepath, "", {"action": "delete"}))
    return {"status": "accepted", "message": f"File deletion queued."}, 202


@fs_bp.route('/api/<workspace_id>/fs/move', methods=['POST'])
def api_fs_move(workspace_id):
    data = request.json
    filepath = data.get("filepath", "").strip()
    dest_path = data.get("dest_path", "").strip()
    if not filepath or not dest_path:
            return jsonify({"error": "Filepath and destination required"}), 400
    res, code = execute_vfs_move(workspace_id, filepath, dest_path)
    return jsonify(res), code


@fs_bp.route('/api/<workspace_id>/fs/archive', methods=['POST'])
def api_fs_archive(workspace_id):
    data = request.json
    filepath = data.get("filepath", "").strip()
    if not filepath:
            return jsonify({"error": "Filepath required"}), 400
    res, code = execute_vfs_archive(workspace_id, filepath)
    return jsonify(res), code


@fs_bp.route('/api/<workspace_id>/fs/delete', methods=['POST'])
def api_fs_delete(workspace_id):
    data = request.json
    filepath = data.get("filepath", "").strip()
    if not filepath:
            return jsonify({"error": "Filepath required"}), 400
    res, code = execute_vfs_delete(workspace_id, filepath)
    return jsonify(res), code
@fs_bp.route('/api/<workspace_id>/fs/exists', methods=['GET'])
def api_fs_exists(workspace_id):
    """Silent validation route that returns 200 OK to keep the browser console clean."""
    filename = request.args.get('file', '').strip()
    resolved_path = resolve_workspace_path(filename, workspace_id)
    exists = bool(resolved_path and os.path.exists(resolved_path))
    return jsonify({"exists": exists, "path": filename})
from insetu.workers import submit_immediate_job, update_immediate_job_status, register_callback
import json

def _background_fs_search(job_id, workspace_id, query):
    try:
        update_immediate_job_status(job_id, 'processing', "Searching workspace files...", workspace_id=workspace_id)
        from insetu.utils_core import search_workspace_files
        results = search_workspace_files(workspace_id, query)
        update_immediate_job_status(job_id, 'completed', "Search complete.", artifact={"results": results}, workspace_id=workspace_id)
    except Exception as e:
        update_immediate_job_status(job_id, 'failed', f"Search failed: {str(e)}", workspace_id=workspace_id)

register_callback("fs", "search_task", _background_fs_search)

@fs_bp.route('/api/<workspace_id>/fs/search', methods=['POST'])
def api_fs_search(workspace_id):
    data = request.json or {}
    query = data.get('q', '').lower()
    if not query: return jsonify({"results": []})

    import uuid
    job_id = f"sch_{uuid.uuid4().hex[:8]}"
    submit_immediate_job(job_id, "fs", "search_task", json.dumps({"query": query}), workspace_id=workspace_id)
    return jsonify({"status": "accepted", "job_id": job_id}), 202
def execute_vfs_save(workspace_id, filepath, content, data=None):
        """Enqueues file mutations asynchronously to unlock the HTTP thread instantly."""
        if data is None:
                data = {}

        # Pre-flight syntax and schema validation must remain fast and synchronous on the HTTP thread
        if filepath.lower().endswith('.json'):
                import json
                json.loads(content)

        # Push to the background commit pipeline worker
        _VFS_WRITE_QUEUE.put((workspace_id, filepath, content, data))
        return {"status": "accepted", "message": f"File {filepath} queued for atomic background commit."}
def execute_vfs_save_physical(workspace_id, filepath, content, data):
        """Handles the synchronous physical I/O execution loop off-thread."""
        if data.get("is_absolute_artifact"):
                resolved_path = filepath
        elif data.get("is_new_repo"):
                from insetu.utils_core import get_workspace_physics
                _, ws_root, _ = get_workspace_physics(workspace_id)
                resolved_path = Path(ws_root).joinpath(filepath).as_posix()
        else:
                resolved_path = resolve_workspace_path(filepath, workspace_id)

        archive_path = data.get("archive_path")
        original_response_path = data.get("original_response_path")
        if archive_path and original_response_path and "{date}" in original_response_path:
                resolved_archive = resolve_workspace_path(archive_path, workspace_id)
                os.makedirs(resolved_archive, exist_ok=True)

                basename = os.path.basename(original_response_path)
                prefix = basename.split("{date}")[0]

                resolved_target_dir = os.path.dirname(resolved_path)
                if os.path.exists(resolved_target_dir):
                        import shutil
                        for f in os.listdir(resolved_target_dir):
                                if f.startswith(prefix) and os.path.isfile(Path(resolved_target_dir).joinpath(f).as_posix()):
                                        shutil.move(Path(resolved_target_dir).joinpath(f).as_posix(), Path(resolved_archive).joinpath(f).as_posix())

        is_new = not os.path.exists(resolved_path)

        target_dir = os.path.dirname(resolved_path)
        if target_dir:
                os.makedirs(target_dir, exist_ok=True)
        with open(resolved_path, 'w', encoding='utf-8') as f:
                f.write(content)
        delete_source = data.get("delete_source")
        if delete_source:
                old_abs_path = resolve_workspace_path(delete_source, workspace_id)
                if os.path.exists(old_abs_path) and os.path.abspath(old_abs_path) != os.path.abspath(resolved_path):
                        os.remove(old_abs_path)
                        hooks.emit_background('post_file_delete', filepath=delete_source, workspace_id=workspace_id)

                        # Clean up empty ghost directories left behind
                        try:
                            parent_dir = os.path.dirname(old_abs_path)
                            # Prune upwards until a directory is not empty
                            while parent_dir and os.path.isdir(parent_dir) and not os.listdir(parent_dir):
                                os.rmdir(parent_dir)
                                parent_dir = os.path.dirname(parent_dir)
                        except OSError:
                            pass

        if data.get("is_new_repo") and data.get("repo_dir"):
                repo_dir = data.get("repo_dir")
                from insetu.utils_core import load_config, get_workspace_physics
                import insetu.utils_core as utils_core
                cfg = load_config(workspace_id)
                targets = cfg.get("target_repos", [])
                if not any(r.get("repo_dir") == repo_dir for r in targets):
                        ext_str = data.get("repo_exts", ".py,.json,.md,.sh,.txt,.html,.css,.js")
                        exts = [e.strip() for e in ext_str.split(",") if e.strip()]

                        targets.append({
                                "repo_dir": repo_dir,
                                "title": data.get("repo_title") or repo_dir.replace("-", " ").replace("_", " ").title(),
                                "domain": data.get("repo_domain") or "Workspaces",
                                "description": data.get("repo_desc") or f"Auto-initialized repository: {repo_dir}",
                                "exts": exts,
                                "apply_ignore": True
                        })
                        cfg["target_repos"] = targets
                        cfg_path, _, _ = get_workspace_physics(workspace_id)
                        utils_core.save_json_file(cfg_path, cfg)
        hooks.emit_background('post_file_save', filepath=filepath, workspace_id=workspace_id)

@fs_bp.route('/api/<workspace_id>/fs/save', methods=['POST'])
def api_fs_save(workspace_id):
        """Universal save-back endpoint with explicit path routing guardrails."""
        data = request.json
        if not data:
                return jsonify({"error": "Invalid or missing JSON payload"}), 400

        filepath, content = data.get("filepath", "").strip(), data.get("content", "")
        if not filepath: 
                return jsonify({"error": "Filepath is required"}), 400

        try:
                result = execute_vfs_save(workspace_id, filepath, content, data)
                return jsonify(result)
        except Exception as e:
                return jsonify({"error": f"File System Error: {str(e)}"}), 500