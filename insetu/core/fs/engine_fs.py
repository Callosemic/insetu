import os
import json
import uuid
import time
import datetime
import mimetypes
import tempfile
import traceback
import zipfile
from pathlib import Path
from typing import TypedDict, Optional, List, Dict, Any, Tuple, Union
import werkzeug.utils
from flask import request, send_file
from insetu.core.sdk import InSetuExtension, hooks, is_protected_vfs_target
from insetu.core.protected_changes import EDITOR_SOURCE, PROTECTED_FILE_NOTICE, SOURCE_KEY
from insetu.core.utils_core import (
    InSetuURI,
    get_repo_path,
    execute_binary,
    compute_vfs_sha256 as _compute_sha256,
    record_vfs_ancestor as _record_ancestor,
    lookup_vfs_ancestor as _lookup_ancestor,
    three_way_merge_text as _three_way_merge_text,
    has_pending_vfs_write,
)
fs_bp = InSetuExtension(
    'fs', 
    __name__, 
    title="Virtual File System", 
    description="Core VFS access and mutation routes.", 
    core=True
)
__depends__ = []


class FileTargetPayload(TypedDict):
    file: str


class FileDownloadZipPayload(TypedDict, total=False):
    items: List[Union[str, Dict[str, Any]]]
    archive_name: Optional[str]


MAX_ZIP_FILE_COUNT = 5000
MAX_ZIP_TOTAL_BYTES = 500 * 1024 * 1024  # 500 MB
_TEXT_MIME_PREFIXES = ('text/', 'application/json', 'application/javascript', 'application/xml', 'application/x-yaml', 'application/toml')
_TEXT_EXTENSIONS = {'.py', '.js', '.ts', '.tsx', '.jsx', '.json', '.md', '.txt', '.html', '.htm', '.css', '.sh', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.sql', '.rs', '.go', '.c', '.cpp', '.h', '.java', '.rb', '.gitignore', '.gitkeep', '.env'}


def _is_binary_file(resolved_path: str, guessed_mime: Optional[str]) -> bool:
    ext = Path(resolved_path).suffix.lower()
    if ext in _TEXT_EXTENSIONS:
        return False
    if guessed_mime:
        if any(guessed_mime.startswith(p) for p in _TEXT_MIME_PREFIXES):
            return False
        return True
    return False


def _compute_zip_arcnames(expanded_uris: List[str], raw_items: List[Any]) -> Tuple[List[Tuple[str, str]], str]:
    """
    Computes ([(canonical_uri, arcname_in_zip), ...], archive_filename) for a list of expanded VFS/CTX URIs.
    If a single folder was requested, roots archive paths inside that folder's basename; otherwise preserves
    repo/relative_path structure and deduplicates any colliding archive paths.
    """
    single_dir_prefix = ""
    single_dir_name = ""
    if len(raw_items) == 1:
        item0 = raw_items[0]
        raw_p = (
            item0.get("folderpath") or item0.get("filepath") or item0.get("id") or ""
            if isinstance(item0, dict)
            else str(item0 or "")
        ).strip()
        is_dir0 = (isinstance(item0, dict) and bool(item0.get("isDir") or item0.get("folderpath"))) or raw_p.endswith("/")
        if raw_p and is_dir0:
            u0 = InSetuURI.from_external_input(raw_p.rstrip("/"))
            full_rel0 = u0.logical_path
            single_dir_name = u0.basename or u0.root_segment or "folder"
            if full_rel0:
                parent_rel = full_rel0.rpartition("/")[0]
                single_dir_prefix = f"{parent_rel}/" if parent_rel else ""

    entries: List[Tuple[str, str]] = []
    seen_arcnames = set()
    repos_seen = set()

    for uri_str in expanded_uris:
        u = InSetuURI(uri_str)
        if u.basename in (".gitkeep", ".keep") and len(expanded_uris) > 1:
            continue
        if u.repo:
            repos_seen.add(u.repo)
        full_rel = u.logical_path
        if single_dir_prefix and full_rel.startswith(single_dir_prefix):
            arcname = full_rel[len(single_dir_prefix):]
        else:
            arcname = full_rel or u.basename or "file"
        arcname = arcname.lstrip("/") or "file"
        if arcname in seen_arcnames:
            stem = Path(arcname).stem
            suffix = Path(arcname).suffix
            parent = Path(arcname).parent.as_posix()
            idx = 2
            while True:
                cand = f"{stem}_{idx}{suffix}" if parent == "." else f"{parent}/{stem}_{idx}{suffix}"
                if cand not in seen_arcnames:
                    arcname = cand
                    break
                idx += 1
        seen_arcnames.add(arcname)
        entries.append((uri_str, arcname))

    if single_dir_name:
        zip_name = f"{single_dir_name}.zip"
    elif len(entries) == 1:
        zip_name = f"{Path(entries[0][1]).stem}.zip"
    elif len(repos_seen) == 1:
        zip_name = f"{next(iter(repos_seen))}_selection.zip"
    else:
        zip_name = "workspace_selection.zip"
    return entries, zip_name


@fs_bp.route('download_zip', methods=['POST'], request_schema=FileDownloadZipPayload, mcp_expose=False, docstring="[sync] Compresses any selection of VFS/CTX files and folders into a downloadable .zip archive while preserving directory structure. Human-only: hidden from MCP and banned in routines.")
def api_fs_download_zip(ctx):
    """Expands selected files and folders through the Topology Sieve and streams a deflated .zip archive, capped by file count and total size."""
    data = ctx.payload or {}
    raw_items = data.get("items") or []
    if not raw_items or not isinstance(raw_items, list):
        return {"error": "A non-empty 'items' list is required."}, 400

    expanded = ctx.expand_selection(raw_items, gather_only=False)
    if not expanded:
        return {"error": "No valid files matched the selection."}, 404

    entries, default_zip_name = _compute_zip_arcnames(expanded, raw_items)
    if not entries:
        return {"error": "No downloadable files found in selection."}, 404
    if len(entries) > MAX_ZIP_FILE_COUNT:
        return {
            "error": f"Selection contains {len(entries):,} files, exceeding the {MAX_ZIP_FILE_COUNT:,}-file ZIP export limit. Narrow your selection to a smaller folder."
        }, 413

    total_bytes = 0
    resolved_entries: List[Tuple[str, str, Optional[str]]] = []
    for uri_str, arcname in entries:
        uri_obj = InSetuURI(uri_str)
        phys_path = uri_obj.resolve_if_exists(ctx.workspace_id)
        if phys_path and Path(phys_path).is_file():
            try:
                total_bytes += Path(phys_path).stat().st_size
            except OSError:
                pass
            resolved_entries.append((uri_str, arcname, phys_path))
        else:
            resolved_entries.append((uri_str, arcname, None))
        if total_bytes > MAX_ZIP_TOTAL_BYTES:
            limit_mb = MAX_ZIP_TOTAL_BYTES // (1024 * 1024)
            return {
                "error": f"Selection exceeds the {limit_mb} MB uncompressed ZIP export limit. Narrow your selection."
            }, 413

    custom_name = str(data.get("archive_name") or "").strip()
    if custom_name:
        safe_custom = werkzeug.utils.secure_filename(custom_name)
        if safe_custom:
            default_zip_name = safe_custom if safe_custom.lower().endswith(".zip") else f"{safe_custom}.zip"

    spool = tempfile.SpooledTemporaryFile(max_size=16 * 1024 * 1024, mode="w+b")
    written_count = 0
    with zipfile.ZipFile(spool, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for uri_str, arcname, phys_path in resolved_entries:
            if phys_path:
                zf.write(phys_path, arcname=arcname)
                written_count += 1
                continue
            uri_obj = InSetuURI(uri_str)
            content = ctx.vfs.read(str(uri_obj))
            if content is not None:
                raw_bytes = content.encode("utf-8") if isinstance(content, str) else content
                total_bytes += len(raw_bytes)
                if total_bytes > MAX_ZIP_TOTAL_BYTES:
                    spool.close()
                    limit_mb = MAX_ZIP_TOTAL_BYTES // (1024 * 1024)
                    return {
                        "error": f"Selection exceeds the {limit_mb} MB uncompressed ZIP export limit. Narrow your selection."
                    }, 413
                zf.writestr(arcname, raw_bytes)
                written_count += 1

    if written_count == 0:
        spool.close()
        return {"error": "Selected files could not be read from disk."}, 404

    spool.seek(0)
    res = send_file(
        spool,
        mimetype="application/zip",
        as_attachment=True,
        download_name=default_zip_name,
    )
    res.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return res


@fs_bp.route('exists', methods=['GET'], request_schema=FileTargetPayload, docstring="[sync] Verifies if a file exists on the Virtual File System.")
def api_fs_exists(ctx):
    """Silent validation route that verifies file existence for the UI."""
    workspace_id = ctx.workspace_id
    filename = str(ctx.payload.get('file') or '').strip()
    if not filename:
        return {"exists": False, "path": filename}
    uri = InSetuURI.from_external_input(filename)
    return {"exists": uri.exists(workspace_id), "path": str(uri)}


@fs_bp.route('fetch', methods=['GET'], request_schema=FileTargetPayload, docstring="Fetches or streams the content of a target canonical VFS/CTX/WS URI or workspace artifact.")
def api_fs_fetch(ctx):
    """Unified authenticated URI read, binary streaming, and attachment download gateway."""
    workspace_id = ctx.workspace_id
    filename = str(ctx.payload.get('file') or '').strip()

    if not filename:
        return {"error": "Filepath required"}, 400

    resolved_path = None
    uri = None
    if "://" not in filename and "/" not in filename.replace("\\", "/"):
        hook_res = hooks.emit_first(
            'vfs_resolve_file',
            filename=filename,
            workspace_id=workspace_id,
            predicate=lambda r: bool(r and Path(r[0] if isinstance(r, tuple) else r).exists())
        )
        if hook_res:
            resolved_path = hook_res[0] if isinstance(hook_res, tuple) else hook_res

    if not resolved_path:
        uri = InSetuURI.from_external_input(filename)
        resolved_path = uri.resolve_if_exists(workspace_id)

    dl_param = str(ctx.payload.get('download') or '').lower()
    as_download = dl_param in ('1', 'true', 'yes')
    inline_param = str(ctx.payload.get('inline') or '').lower() in ('1', 'true')

    if resolved_path and Path(resolved_path).is_file():
        guessed_mime, _ = mimetypes.guess_type(resolved_path)
        is_binary = _is_binary_file(resolved_path, guessed_mime)
        if as_download or is_binary:
            res_p = Path(resolved_path)
            dl_name = (
                f"{res_p.stem}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}{res_p.suffix}"
                if as_download
                else res_p.name
            )
            effective_mime = 'application/octet-stream' if (as_download and not inline_param) else (guessed_mime or 'application/octet-stream')
            res = send_file(
                resolved_path,
                as_attachment=(as_download and not inline_param),
                download_name=dl_name,
                mimetype=effective_mime
            )
            res.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            return res

    if uri is None:
        uri = InSetuURI.from_external_input(filename)
    content = uri.read(workspace_id)
    if content is None and resolved_path and Path(resolved_path).exists():
        content = ctx.vfs.read(resolved_path, is_absolute_artifact=True)
    if content is not None:
        ctx.vfs.record_ancestor(str(uri), content)
        return content, 200, {'Content-Type': 'text/plain; charset=utf-8'}
    resolved = resolved_path or uri.resolve(workspace_id)
    return {
        "error": "File not found.",
        "uri": str(uri),
        "resolved_path": resolved,
        "exists_on_disk": bool(resolved and Path(resolved).exists()),
        "pending_write": has_pending_vfs_write(resolved) if resolved else False
    }, 404

class FileGitDiffResponse(TypedDict):
    filepath: str
    repo: str
    head_content: str
    working_content: str
    is_untracked: bool
    is_modified: bool
class FileProtectionResponse(TypedDict):
    file: str
    protected: bool
    message: str


@fs_bp.route('protected', methods=['GET'], request_schema=FileTargetPayload, response_schema=FileProtectionResponse, docstring="[sync] Reports whether a file is a protected recovery file: agents' changes to it wait for a person's confirmation, and editor saves run a smoke test first (S8).")
def api_fs_protected(ctx):
    filename = str(ctx.payload.get('file') or '').strip()
    if not filename:
        return {"error": "Filepath required"}, 400
    uri = str(InSetuURI.from_external_input(filename))
    protected = is_protected_vfs_target(uri, ctx.workspace_id)
    return {"file": uri, "protected": protected, "message": PROTECTED_FILE_NOTICE if protected else ""}


@fs_bp.route('git_diff', methods=['GET'], request_schema=FileTargetPayload, response_schema=FileGitDiffResponse, docstring="[sync] Returns the git HEAD content and current working tree content for a target VFS file.")
def api_fs_git_diff(ctx):
    """Retrieves the Git HEAD baseline and current working tree text for a file."""
    workspace_id = ctx.workspace_id
    filename = str(ctx.payload.get('file') or '').strip()
    if not filename:
        return {"error": "Filepath required"}, 400

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
    return {
        "filepath": str(uri),
        "repo": repo_dir,
        "head_content": head_content,
        "working_content": working_content,
        "is_untracked": is_untracked,
        "is_modified": head_content != working_content
    }
@fs_bp.worker("search_task")
def _background_fs_search(ctx, query: str = ""):
    ctx.jobs.update_progress("Searching workspace files...")
    results = ctx.emit_merge_list('vfs_search', query=query)
    results.sort(key=lambda x: x["score"], reverse=True)
    results = results[:50]
    return {"message": "Search complete.", "artifact": {"results": results}}

class FileSearchPayload(TypedDict):
    q: str
@fs_bp.route('search', methods=['POST'], request_schema=FileSearchPayload, docstring="Fuzzy search across workspace files.")
def api_fs_search(ctx):
    try:
        data = ctx.payload
        query = str(data.get('q') or '').lower()
        if not query:
            return {"results": []}
        job_id = ctx.jobs.submit("search_task", job_category="ui_blocking", query=query)
        return {"status": "accepted", "job_id": job_id}, 202
    except Exception as e:
        return {"error": f"Search dispatch failed: {str(e)}"}, 500

class FileMovePayload(TypedDict):
    filepath: str
    dest_path: str
@fs_bp.route('move', methods=['POST'], request_schema=FileMovePayload, docstring="[sync] Moves or renames a file within the Virtual File System.")
def api_fs_move(ctx):
    workspace_id = ctx.workspace_id
    try:
        data = ctx.payload
        filepath = str(data.get("filepath") or "").strip()
        dest_path = str(data.get("dest_path") or "").strip()
        if not filepath or not dest_path:
                return {"error": "Filepath and destination required"}, 400
        src_uri_obj = InSetuURI.from_external_input(filepath)
        dst_uri_obj = InSetuURI.from_external_input(dest_path)
        if src_uri_obj.is_readonly_template or dst_uri_obj.is_readonly_template:
                return {"error": "403 Forbidden: Built-in module templates are read-only. Fork the template to your workspace prompts to edit it."}, 403
        src_uri = str(InSetuURI(filepath))
        dst_uri = str(InSetuURI(dest_path))
        res, code = ctx.vfs.move(src_uri, dst_uri)
        if isinstance(res, dict) and code < 400:
            res.setdefault("mutations", [
                {"filepath": src_uri, "operation": "delete", "relocated_to": dst_uri},
                {"filepath": dst_uri, "operation": "save", "relocated_from": src_uri},
            ])
        return res, code
    except Exception as e:
        try:
            hooks.emit_background('system_error', source="VFS:Move", error_type=type(e).__name__, message=str(e), traceback=traceback.format_exc(), payload=json.dumps(ctx.payload or {}), workspace_id=workspace_id)
        except Exception: pass
        return {"error": f"VFS Move Error: {str(e)}"}, 500

class FileActionPayload(TypedDict):
    filepath: str
@fs_bp.route('archive', methods=['POST'], request_schema=FileActionPayload, docstring="[sync] Archives a file by moving it to an archived/ subdirectory.")
def api_fs_archive(ctx):
    workspace_id = ctx.workspace_id
    try:
        data = ctx.payload
        filepath = str(data.get("filepath") or "").strip()
        if not filepath:
                return {"error": "Filepath required"}, 400
        if InSetuURI.from_external_input(filepath).is_readonly_template:
                return {"error": "403 Forbidden: Built-in module templates are read-only."}, 403
        uri = InSetuURI(filepath)

        parent_path = uri.path.rpartition('/')[0] if '/' in uri.path else ''

        if not parent_path or parent_path == '.':
            new_path = f"archived/{uri.basename}"
        else:
            new_path = f"{parent_path}/archived/{uri.basename}"
        scheme = uri.scheme or "vfs"
        rel_dest = f"{scheme}://{uri.repo}/{new_path}" if uri.repo else f"{scheme}://{new_path}"
        src_uri = str(uri)
        res, code = ctx.vfs.move(src_uri, rel_dest)
        # Retain payload signature compatibility for the frontend
        res["new_path"] = rel_dest
        res["message"] = "File archive queued."
        if code < 400:
            res.setdefault("mutations", [
                {"filepath": src_uri, "operation": "delete", "relocated_to": rel_dest},
                {"filepath": rel_dest, "operation": "save", "relocated_from": src_uri},
            ])
        return res, code
    except Exception as e:
        try:
            hooks.emit_background('system_error', source="VFS:Archive", error_type=type(e).__name__, message=str(e), traceback=traceback.format_exc(), payload=json.dumps(ctx.payload or {}), workspace_id=workspace_id)
        except Exception: pass
        return {"error": f"VFS Archive Error: {str(e)}"}, 500
@fs_bp.route('delete', methods=['POST'], request_schema=FileActionPayload, docstring="[sync] Permanently deletes a file from the Virtual File System.")
def api_fs_delete(ctx):
    workspace_id = ctx.workspace_id
    try:
        data = ctx.payload
        filepath = str(data.get("filepath") or "").strip()
        if not filepath:
                return {"error": "Filepath required"}, 400
        if InSetuURI.from_external_input(filepath).is_readonly_template:
                return {"error": "403 Forbidden: Built-in module templates are read-only."}, 403
        target_uri = str(InSetuURI(filepath))
        res, code = ctx.vfs.delete(target_uri)
        if isinstance(res, dict) and code < 400:
            res.setdefault("mutations", [{"filepath": target_uri, "operation": "delete"}])
        return res, code
    except Exception as e:
        try:
            hooks.emit_background('system_error', source="VFS:Delete", error_type=type(e).__name__, message=str(e), traceback=traceback.format_exc(), payload=json.dumps(ctx.payload or {}), workspace_id=workspace_id)
        except Exception: pass
        return {"error": f"VFS Delete Error: {str(e)}"}, 500

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
        data = ctx.payload
        raw_ops = data.get("operations", [])
        if not raw_ops or not isinstance(raw_ops, list):
            return {"error": "A non-empty 'operations' list is required"}, 400

        normalized_ops = []
        for item in raw_ops:
            act = (item.get("action") or "").strip().lower()
            fp = (item.get("filepath") or "").strip()
            if not fp or act not in ("move", "archive", "delete"):
                continue
            dest_cand = item.get("dest_path", "")
            if InSetuURI.from_external_input(fp).is_readonly_template or (dest_cand and InSetuURI.from_external_input(dest_cand).is_readonly_template):
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
            return {"error": "No valid bulk operations provided"}, 400
        res, code = ctx.vfs.bulk(normalized_ops)
        if isinstance(res, dict) and code < 400:
            receipt_mutations = []
            for op in normalized_ops:
                suffix = "/" if op.get("is_dir") else ""
                if op["action"] == "delete":
                    receipt_mutations.append({"filepath": op["filepath"] + suffix, "operation": "delete"})
                elif op["action"] == "move" and op.get("dest_path"):
                    receipt_mutations.append({
                        "filepath": op["filepath"] + suffix,
                        "operation": "delete",
                        "relocated_to": op["dest_path"]
                    })
                    receipt_mutations.append({
                        "filepath": op["dest_path"] + suffix,
                        "operation": "save",
                        "relocated_from": op["filepath"]
                    })
            res.setdefault("mutations", receipt_mutations)
        return res, code
    except Exception as e:
        try:
            hooks.emit_background('system_error', source="VFS:Bulk", error_type=type(e).__name__, message=str(e), traceback=traceback.format_exc(), payload=json.dumps(ctx.payload or {}), workspace_id=workspace_id)
        except Exception:
            pass
        return {"error": f"VFS Bulk Error: {str(e)}"}, 500
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
    if 'file' not in request.files:
            return {"error": "No files provided"}, 400
    files = request.files.getlist('file')
    dest_dir = str(ctx.payload.get('dest_dir') or '').strip()

    db_conn = ctx.get_db("workers")
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

            ctx.vfs.evict_cache(resolved_path)
            file.save(resolved_path)
            uploaded_paths.append(filepath)
            mutations.append({"filepath": filepath, "operation": "save", "ignore_ledger": False})
            # Trigger VFS Event Ledger sync
            db_conn.execute(
                    "INSERT OR REPLACE INTO vfs_event_log (filepath, mutation_type, timestamp) VALUES (?, ?, ?)",
                    (filepath, 'modified' if not is_new else 'added', time.time())
            )
    hooks.emit_background('vfs_mutated', workspace_id=workspace_id, mutations=mutations)
    db_conn.commit()
    if not uploaded_paths:
            return {"error": "No valid files uploaded"}, 400
    return {
        "status": "success",
        "message": f"{len(uploaded_paths)} file(s) uploaded successfully.",
        "filepaths": uploaded_paths,
        "mutations": mutations
    }
class FileSavePayload(TypedDict, total=False):
    filepath: str
    content: str
    base_hash: Optional[str]
    base_content: Optional[str]
@fs_bp.route('save', methods=['POST'], request_schema=FileSavePayload, docstring="[sync] Saves text content securely to the VFS. Performs a deterministic 3-way merge when base_hash diverges before falling back to conflict file creation.")
def api_fs_save(ctx):
    """Universal save-back endpoint with 3-way OCC merge and explicit path routing guardrails."""
    workspace_id = ctx.workspace_id
    try:
        data = dict(ctx.payload) if ctx.payload else None
        if not data:
                return {"error": "Invalid or missing JSON payload"}, 400

        # Protect VFS sandbox and ledger parity from malicious API injections
        if "is_absolute_artifact" in data:
                del data["is_absolute_artifact"]
        if "ignore_ledger" in data:
                del data["ignore_ledger"]
        # S8: tells the protected-write handler this is a person's save from an editor (written after a smoke test), not an agent's write (held).
        data[SOURCE_KEY] = EDITOR_SOURCE
        filepath, content = str(data.get("filepath") or "").strip(), data.get("content", "")
        if not filepath: 
                return {"error": "Filepath is required"}, 400
        if InSetuURI.from_external_input(filepath).is_readonly_template:
                return {"error": "403 Forbidden: Built-in module templates are read-only. Fork the template to your workspace prompts to edit it."}, 403
        filepath = str(InSetuURI(filepath))
        base_hash = data.get("base_hash")
        base_content_fallback = data.get("base_content")
        data.pop("base_content", None)

        was_merged = False
        current_disk_content = ctx.vfs.read(filepath)
        if current_disk_content is not None:
            current_hash = ctx.vfs.compute_sha256(current_disk_content)
            ctx.vfs.record_ancestor(filepath, current_disk_content, current_hash)
            if base_hash and current_hash != base_hash and current_disk_content != content:
                ancestor_text = ctx.vfs.lookup_ancestor(filepath, base_hash, base_content_fallback)
                merged_ok = False
                if ancestor_text is not None:
                    merged_ok, merged_text = ctx.vfs.three_way_merge(ancestor_text, current_disk_content, content)
                    if merged_ok:
                        content = merged_text
                        was_merged = (merged_text != data.get("content", ""))

                if not merged_ok:
                    uri_obj = InSetuURI(filepath)
                    filename = uri_obj.basename
                    conflict_name = f"{Path(filename).stem}.conflict_{int(time.time())}{Path(filename).suffix}"
                    parent_prefix = filepath.rpartition('/')[0]
                    conflict_path = f"{parent_prefix}/{conflict_name}" if parent_prefix else f"vfs://{conflict_name}"
                    ctx.vfs.save(conflict_path, content, data={})
                    reason = (
                        f"OCC Conflict: Overlapping edits on the same line could not be auto-merged. Changes saved to {conflict_name}"
                        if ancestor_text is not None
                        else f"OCC Conflict: File was modified externally. Offline changes saved to {conflict_name}"
                    )
                    return {"error": reason}, 409
        result = ctx.vfs.save(filepath, content, data)
        if isinstance(result, dict) and result.get("protected") and result.get("status") != "accepted":
            # Held for confirmation (202), or refused: a failed smoke test (422) or a forbidden change (403).
            return result, (202 if result.get("status") == "pending_confirmation" else int(result.get("status_code") or 403))
        saved_hash = ctx.vfs.record_ancestor(filepath, content)
        if isinstance(result, dict):
            result["base_hash"] = saved_hash
            result.setdefault("mutations", [{"filepath": filepath, "operation": "save", "base_hash": saved_hash}])
            if was_merged:
                result["status"] = "merged"
                result["merged_content"] = content
                result["message"] = "Merged concurrent edits cleanly."
        return result
    except Exception as e:
        try:
            # Masking content string to prevent payload blowout in the ledger
            safe_payload = {"filepath": data.get("filepath")} if isinstance(data, dict) else {}
            hooks.emit_background('system_error', source="VFS:Save", error_type=type(e).__name__, message=str(e), traceback=traceback.format_exc(), payload=json.dumps(safe_payload), workspace_id=workspace_id)
        except Exception: pass
        return {"error": f"File System Error: {str(e)}"}, 500