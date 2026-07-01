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
                execute_vfs_save_physical(workspace_id, filepath, content, data)
            except Exception as e:
                print(f"❌ [VFS Pipeline] Background commit failed for {filepath}: {e}")
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
def execute_vfs_move(workspace_id, filepath, dest_path):
    resolved_src = resolve_workspace_path(filepath, workspace_id)
    resolved_dest = resolve_workspace_path(dest_path, workspace_id)

    if not os.path.exists(resolved_src):
            return {"error": "Source file not found"}, 404

    os.makedirs(os.path.dirname(resolved_dest), exist_ok=True)
    import shutil
    try:
            shutil.move(resolved_src, resolved_dest)
    except Exception as e:
            return {"error": f"OS Move Failed: {str(e)}"}, 500

    try:
            from insetu.cartographer import map_repositories
            map_repositories(workspace_id)
    except Exception as e:
            print(f"Warning: Cartographer failed during move: {str(e)}")

    hooks.emit('post_file_delete', filepath=filepath, workspace_id=workspace_id)
    hooks.emit('post_file_save', filepath=dest_path, workspace_id=workspace_id)
    return {"status": "success", "new_filepath": dest_path}, 200


def execute_vfs_archive(workspace_id, filepath):
    resolved_path = resolve_workspace_path(filepath, workspace_id)
    if not os.path.exists(resolved_path):
            return {"error": "File not found"}, 404

    archive_dir = os.path.join(os.path.dirname(resolved_path), "archived")
    os.makedirs(archive_dir, exist_ok=True)
    new_path = os.path.join(archive_dir, os.path.basename(resolved_path))
    import shutil
    try:
            shutil.move(resolved_path, new_path)
    except Exception as e:
            return {"error": f"OS Move Failed: {str(e)}"}, 500

    try:
            from insetu.cartographer import map_repositories
            map_repositories(workspace_id)
    except Exception as e:
            print(f"Warning: Cartographer failed during archive: {str(e)}")

    hooks.emit('post_file_delete', filepath=filepath, workspace_id=workspace_id)
    return {"status": "success"}, 200


def execute_vfs_delete(workspace_id, filepath):
    resolved_path = resolve_workspace_path(filepath, workspace_id)
    if not os.path.exists(resolved_path):
            return {"error": "File not found"}, 404
    try:
            os.remove(resolved_path)
    except Exception as e:
            return {"error": f"OS Remove Failed: {str(e)}"}, 500

    try:
            from insetu.cartographer import map_repositories
            map_repositories(workspace_id)
    except Exception as e:
            print(f"Warning: Cartographer failed during delete: {str(e)}")

    hooks.emit('post_file_delete', filepath=filepath, workspace_id=workspace_id)
    return {"status": "success"}, 200


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


@fs_bp.route('/api/<workspace_id>/fs/search', methods=['GET'])
def api_fs_search(workspace_id):
    query = request.args.get('q', '').lower()
    if not query: return jsonify({"results": []})

    terms = [t for t in query.split() if t]
    if not terms: return jsonify({"results": []})

    import json
    from insetu.utils_core import get_gather_paths
    paths = get_gather_paths(workspace_id)
    manifest_path = os.path.join(paths["contexts_dir"], "manifest.json")
    md_files = set()
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r', encoding='utf-8') as f:
            try:
                manifest = json.load(f)
                for file_list in manifest.values():
                    for filepath in file_list:
                        if filepath.lower().endswith('.md'):
                            md_files.add(filepath)
            except Exception:
                pass
    results = []
    for filepath in md_files:
        abs_path = resolve_workspace_path(filepath, workspace_id)
        if not os.path.exists(abs_path): continue

        try:
            with open(abs_path, 'r', encoding='utf-8') as f:
                content = f.read()

            content_lower = content.lower()
            score = 0
            snippet = ""

            file_lower = filepath.lower()
            for term in terms:
                if term in file_lower:
                    score += 2
                if term in content_lower:
                    score += 1

            if score > 0:
                first_term = next((t for t in terms if t in content_lower), None)
                if first_term:
                    idx = content_lower.find(first_term)
                    start = max(0, idx - 30)
                    end = min(len(content), idx + 70)
                    snippet = content[start:end].replace('\n', ' ').strip()

                results.append({
                    "path": filepath,
                    "score": score,
                    "snippet": snippet
                })
        except Exception:
            pass
            
    results.sort(key=lambda x: x["score"], reverse=True)
    return jsonify({"results": results[:50]})
@fs_bp.route('/api/<workspace_id>/fs/compile-document', methods=['POST'])
def api_fs_compile_document(workspace_id):
    data = request.json
    filepath = data.get('filepath')
    target_format = data.get('format', 'pdf')

    if not filepath: return jsonify({"error": "Filepath required"}), 400

    resolved_path = resolve_workspace_path(filepath, workspace_id)
    if not os.path.exists(resolved_path): return jsonify({"error": "File not found"}), 404

    with open(resolved_path, 'r', encoding='utf-8') as f:
        content = f.read()

    import re
    import tempfile
    import subprocess
    import json
    import sqlite3
    import shutil
    import io
    from insetu.utils_core import get_gather_paths
    paths = get_gather_paths(workspace_id)

    backmatter_match = re.search(r'\n+---\n+citations:\n([\s\S]*?)\n---$', content)

    true_ids = []
    if backmatter_match:
        lines = backmatter_match.group(1).splitlines()
        for line in lines:
            parts = line.split(':')
            if len(parts) >= 2:
                true_ids.append(parts[1].replace('"', '').replace("'", "").strip())

    csl_items = []
    if true_ids:
        db_path = os.path.join(paths["artifacts_base"], "citations.db")
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            placeholders = ','.join(['?'] * len(true_ids))
            try:
                cursor = conn.execute(f"SELECT raw_json FROM citations WHERE id IN ({placeholders})", tuple(true_ids))
                for row in cursor.fetchall():
                    csl_items.append(json.loads(row['raw_json']))
            except Exception:
                pass
            finally:
                conn.close()

    temp_dir = tempfile.mkdtemp()
    try:
        bib_path = os.path.join(temp_dir, 'bibliography.json')
        with open(bib_path, 'w', encoding='utf-8') as f:
            json.dump(csl_items, f)

        out_filename = f"compiled_output.{target_format}"
        out_path = os.path.join(temp_dir, out_filename)

        cmd = ['pandoc', resolved_path, '-o', out_path]
        if csl_items:
            cmd.extend(['--citeproc', '--bibliography', bib_path])

        try:
            res = subprocess.run(cmd, capture_output=True, text=True)
        except FileNotFoundError:
            return jsonify({"error": "Pandoc is not installed or not in PATH."}), 500

        if res.returncode != 0:
            err_msg = res.stderr.strip()
            if "pdflatex not found" in err_msg.lower():
                err_msg += " (Please install a LaTeX engine like MacTeX, MiKTeX, or TeX Live to generate PDFs)."
            return jsonify({"error": f"Pandoc failed: {err_msg}"}), 500

        with open(out_path, 'rb') as f:
            file_data = f.read()

        mem_file = io.BytesIO(file_data)
        mem_file.seek(0)

        safe_basename = os.path.basename(resolved_path).rsplit('.', 1)[0]
        return send_file(mem_file, as_attachment=True, download_name=f"{safe_basename}.{target_format}")

    except Exception as e:
        return jsonify({"error": f"Compilation error: {str(e)}"}), 500
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
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
        if "sotu/sotu_" in filepath.lower() and filepath.lower().endswith(".md"):
                engine_gather.rotate_sotus()

        if data.get("is_new_repo"):
                from insetu.utils_core import get_workspace_physics
                _, ws_root, _ = get_workspace_physics(workspace_id)
                resolved_path = os.path.join(ws_root, filepath)
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
                                if f.startswith(prefix) and os.path.isfile(os.path.join(resolved_target_dir, f)):
                                        shutil.move(os.path.join(resolved_target_dir, f), os.path.join(resolved_archive, f))

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
        if is_new:
                try:
                        from insetu.cartographer import map_repositories
                        map_repositories(workspace_id)
                except Exception as e:
                        print(f"Warning: Cartographer failed during save: {str(e)}")

        hooks.emit('post_file_save', filepath=filepath, workspace_id=workspace_id)
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