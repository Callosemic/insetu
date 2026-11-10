"""
Pending protected changes (S8): a change to a protected file waits here until a person confirms or discards it.

insetu registers handle_protected_write with the kernel (install). From then on, every save or delete that touches a
protected target (the CLI, the lifeboat, the credential store, and anything else registered with
register_protected_vfs_targets) is staged in <control dir>/pending_changes/<id>.json instead of being written:
the path, the hash of the file as it was and as it would become, the new content (or a delete), who proposed it and
when. Pending changes do not expire.

A person confirms one through a human-only route, naming the change and the hash of the content they were shown.
The confirmation is refused when that hash differs, when the file changed after the proposal, or when the call comes
from a model, an MCP client or a routine. Moves of protected files are refused outright, and so are proposals to
change insetu's own records (the attestation store, this folder, the audit log, the last-good copies).

Recovery files (the CLI, the lifeboat, the credential store) get two more guards before any write: a smoke test of
the new version in a subprocess (insetu/recovery_check.py), and, for the lifeboat and the credential store, a
last-good copy of the current version in <control dir>/recovery/last_good/, kept only if it passes the same test.
The panic path in cli.py boots that copy when the current lifeboat will not import. A recovery file is never
deleted through this flow.

A person's own save from the Files editor (origin 'ui') is not held: it is written at once, behind the same smoke
test and last-good copy. Saves from anywhere else, including MCP calls to the same route, are held.

Every step is a line in <control dir>/audit/protected_changes.jsonl, which only this module writes.
"""
import hashlib
import json
import os
import re
import sys
import tempfile
import threading
import time
import uuid
from pathlib import Path, PurePosixPath
from typing import Any, Dict, List, Optional, Tuple

import insetu.core.attestations as _attestations
import insetu.recovery_check as _recovery_check
from insetu.core.sdk import (
    INSETU_CONTROL_STORE_NAMES,
    VFSTransaction,
    execute_binary,
    execute_confirmed_protected_write,
    get_current_origin,
    load_json_config,
    resolve_physical_path,
    set_protected_write_handler,
    sse_bus,
    sync_vfs_barrier,
)
from insetu.core.system.security_io import child_env

PENDING_DIRNAME = "pending_changes"
AUDIT_DIRNAME = "audit"
AUDIT_FILENAME = "protected_changes.jsonl"
# Keys a caller puts in a VFS mutation's data to say where it came from. The Files editor's save route sets
# SOURCE_KEY to EDITOR_SOURCE; the bridge sets it to "bridge" and REFERENCE_KEY to its transaction id.
SOURCE_KEY = "_insetu_source"
REFERENCE_KEY = "_insetu_reference"
EDITOR_SOURCE = "files_editor"
# Hash values for a file that does not exist yet and for a proposed delete.
ABSENT = "absent"
DELETE = "delete"
MAX_PENDING = 100
SSE_EVENT = "protected_changes"
LAST_GOOD_PARTS = ("recovery", "last_good")
# Recovery files whose previous version is kept as the last-good copy. The CLI is the entry point that would boot
# the copy, so it has no copy of its own; its smoke test is its guard.
LAST_GOOD_KINDS = frozenset({"lifeboat", "credentials"})
SMOKE_TEST_TIMEOUT = 60

PROTECTED_FILE_NOTICE = (
    "Protected recovery file. Saving here runs a smoke test first and keeps the previous version as the last-good "
    "copy. Changes from agents and the bridge are held until you confirm them (Review Changes in the banner)."
)
_CHANGE_ID = re.compile(r"^pc_[0-9a-f]{12}$")
_LOCK = threading.RLock()


def install() -> None:
    """Makes this module the kernel's policy for protected writes. Called once at boot."""
    set_protected_write_handler(handle_protected_write)


def pending_dir() -> Path:
    """<control dir>/pending_changes/, one JSON record per pending change."""
    return _attestations.control_dir_path() / PENDING_DIRNAME


def audit_log_path() -> Path:
    """<control dir>/audit/protected_changes.jsonl, the append-only audit log only this module writes."""
    return _attestations.control_dir_path() / AUDIT_DIRNAME / AUDIT_FILENAME


def last_good_dir() -> Path:
    """<control dir>/recovery/last_good/: the most recent version of each recovery file that passed its smoke test."""
    return _attestations.control_dir_path().joinpath(*LAST_GOOD_PARTS)


def _file_name(filepath: str) -> str:
    """The last path segment of a VFS URI or a physical path (either separator)."""
    return PurePosixPath(str(filepath).replace("\\", "/")).name


def recovery_kind(filepath: str) -> Optional[str]:
    """'cli', 'lifeboat' or 'credentials' for a protected recovery file, else None (other protected paths)."""
    return _recovery_check.KIND_BY_FILENAME.get(_file_name(filepath))


def smoke_test(kind: str, workspace_id: str, filepath: str, content: str, is_absolute: bool = False) -> Tuple[bool, str]:
    """Checks a version of a recovery file in a subprocess, in an empty temporary directory. Returns (passed, detail)."""
    physical = resolve_physical_path(filepath, workspace_id, is_absolute) or str(filepath)
    package_root = Path(_recovery_check.__file__).resolve().parent.parent.as_posix()
    python_path = os.pathsep.join(p for p in (package_root, os.environ.get("PYTHONPATH", "")) if p)
    with tempfile.TemporaryDirectory(prefix="insetu_smoke_") as scratch:
        try:
            result = execute_binary(
                [sys.executable, "-m", "insetu.recovery_check", kind, physical],
                cwd=scratch,
                env=child_env("tool", extra={"PYTHONPATH": python_path}),
                input=content,
                capture_output=True,
                text=True,
                timeout=SMOKE_TEST_TIMEOUT,
            )
        except Exception as exc:
            return False, f"The smoke test could not run: {type(exc).__name__}: {exc}"
    detail = "\n".join(part.strip() for part in (result.stderr or "", result.stdout or "") if part and part.strip())
    return result.returncode == 0, detail


def _keep_last_good(kind: str, workspace_id: str, filepath: str, is_absolute: bool, change: Dict[str, Any]) -> None:
    """Copies the current version to last_good/ before it is replaced, if it passes its own smoke test."""
    current = _read_text(workspace_id, filepath, is_absolute)
    if current is None:
        return
    passed, detail = smoke_test(kind, workspace_id, filepath, current, is_absolute)
    if not passed:
        # The version being replaced is already broken, so the copy from before it stays the last good one.
        _audit("last_good_kept", change, reason=detail[-2000:])
        return
    _write_control_file(last_good_dir() / _file_name(filepath), current)
    _audit("last_good_saved", change, last_good_hash=content_hash(current))


def _guarded_write(change: Dict[str, Any]) -> Optional[Tuple[Dict[str, Any], int]]:
    """Writes a change past the protected guard: smoke test and last-good copy first for recovery files. None on success."""
    workspace_id, filepath = change["workspace_id"], change["filepath"]
    is_absolute = bool(change.get("is_absolute"))
    content = change.get("content")
    kind = recovery_kind(filepath)
    if kind and content is None:
        _audit("write_refused", change, reason="recovery files are not deleted through this flow")
        return {"status": "error", "error": f"'{filepath}' is on the recovery path and cannot be deleted here."}, 409
    if kind:
        passed, detail = smoke_test(kind, workspace_id, filepath, content, is_absolute)
        if not passed:
            _audit("smoke_failed", change, reason=detail[-2000:])
            return {"status": "error", "error": f"Not written: the {kind} smoke test failed.\n{detail}"}, 422
        if kind in LAST_GOOD_KINDS:
            _keep_last_good(kind, workspace_id, filepath, is_absolute, change)
    body, status = execute_confirmed_protected_write(workspace_id, filepath, content, {"is_absolute_artifact": is_absolute})
    if status >= 400:
        _audit("write_failed", change, reason=str(body.get("message") if isinstance(body, dict) else body))
        return {"status": "error", "error": f"The write failed: {body}"}, 500
    return None


def content_hash(content: Optional[str]) -> str:
    """The hash a person confirms: SHA-256 of the UTF-8 text, or DELETE for a delete."""
    return DELETE if content is None else hashlib.sha256(content.encode("utf-8")).hexdigest()


def _refusal(message: str, status: int = 403) -> Tuple[Dict[str, Any], int]:
    # status_code travels in the body because the kernel's save path returns the body alone.
    return {"status": "error", "protected": True, "message": message, "error": message, "status_code": status}, status


def _names_control_store(*paths: Optional[str]) -> bool:
    """True when a path points into insetu's own records (.insetu/<store>), which are never staged for confirmation."""
    for path in paths:
        if not path:
            continue
        parts = [p.lower() for p in str(path).replace("\\", "/").split("/") if p]
        for idx, part in enumerate(parts[:-1]):
            if part == ".insetu" and parts[idx + 1] in INSETU_CONTROL_STORE_NAMES:
                return True
    return False


def _write_control_file(path: Path, content: Optional[str]) -> None:
    body, status = execute_confirmed_protected_write(
        "default", path.as_posix(), content, {"is_absolute_artifact": True, "ignore_ledger": True}
    )
    if status >= 400:
        raise OSError(f"Could not write {path.name}: {body}")


def _read_text(workspace_id: str, filepath: str, is_absolute: bool) -> Optional[str]:
    try:
        return VFSTransaction(workspace_id).read(filepath, is_absolute_artifact=is_absolute)
    except ValueError:
        return None


def _audit(event: str, change: Optional[Dict[str, Any]] = None, **extra: Any) -> None:
    """Appends one line to the audit log. Never raises: a failed audit write is reported, not fatal."""
    change = change or {}
    entry = {
        "at": time.time(),
        "event": event,
        "change_id": change.get("id"),
        "filepath": change.get("filepath"),
        "action": change.get("action"),
        "base_hash": change.get("base_hash"),
        "result_hash": change.get("result_hash"),
        "proposed_by": change.get("proposed_by"),
        "actor": _attestations.describe_actor(),
    }
    entry.update(extra)
    path = audit_log_path()
    try:
        with _LOCK:
            existing = _read_text("default", path.as_posix(), True) or ""
            if existing and not existing.endswith("\n"):
                existing += "\n"
            _write_control_file(path, existing + json.dumps(entry, sort_keys=True) + "\n")
    except Exception as exc:
        print(f"❌ [Protected Changes] Could not write the audit log: {exc}")


def _notify() -> None:
    try:
        # The record was queued, not yet written; count once the write queue has drained.
        sync_vfs_barrier("default")
        sse_bus.emit_sse(SSE_EVENT, {"pending": count_pending()})
    except Exception:
        pass


def _record_path(change_id: str) -> Path:
    return pending_dir() / f"{change_id}.json"


def _load(change_id: str) -> Optional[Dict[str, Any]]:
    if not _CHANGE_ID.match(str(change_id or "")):
        return None
    record = load_json_config(_record_path(change_id).as_posix(), {})
    return record if record.get("id") == change_id else None


def _all_records() -> List[Dict[str, Any]]:
    sync_vfs_barrier("default")
    folder = pending_dir()
    if not folder.is_dir():
        return []
    records = []
    for path in folder.glob("pc_*.json"):
        record = _load(path.stem)
        if record:
            records.append(record)
    return sorted(records, key=lambda r: r.get("created_at") or 0)


def _current_hash(record: Dict[str, Any]) -> str:
    current = _read_text(record["workspace_id"], record["filepath"], bool(record.get("is_absolute")))
    return ABSENT if current is None else content_hash(current)


def count_pending() -> int:
    """Number of pending protected changes, read from disk without waiting for queued writes."""
    folder = pending_dir()
    return len(list(folder.glob("pc_*.json"))) if folder.is_dir() else 0


def handle_protected_write(request: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    """
    The kernel's protected-write handler. A person's editor save is written after its checks; anything else is staged
    for confirmation. Moves, deletes of recovery files and changes to insetu's own records are refused.
    """
    action = request.get("action") or "save"
    filepath = str(request.get("filepath") or "")
    data = dict(request.get("data") or {})
    origin = request.get("origin")
    source = data.get(SOURCE_KEY)
    if _names_control_store(filepath, request.get("dest_path")):
        return _refusal("insetu's own records (approvals, pending changes, the audit log, last-good copies) are written only by insetu itself.")
    if action == "move":
        return _refusal("Protected files cannot be moved or renamed. Change them in place; the change waits for your confirmation.")
    if action == "delete" and recovery_kind(filepath):
        return _refusal(f"'{filepath}' is on the recovery path and cannot be deleted.")
    content = None if action == "delete" else str(request.get("content") or "")
    if origin == "ui" and source == EDITOR_SOURCE:
        return save_from_editor(request.get("workspace_id") or "default", filepath, content, bool(data.get("is_absolute_artifact")))
    return propose(
        request.get("workspace_id") or "default",
        filepath,
        content,
        is_absolute=bool(data.get("is_absolute_artifact")),
        origin=origin,
        source=source,
        reference=data.get(REFERENCE_KEY),
    )


def save_from_editor(workspace_id: str, filepath: str, content: Optional[str], is_absolute: bool = False) -> Tuple[Dict[str, Any], int]:
    """A person's own save from the Files editor: written at once, behind the smoke test and the last-good copy."""
    current = _read_text(workspace_id, filepath, is_absolute)
    if content is not None and content == current:
        return {"status": "accepted", "protected": True, "message": f"'{filepath}' is unchanged."}, 202
    change = {
        "workspace_id": workspace_id,
        "filepath": filepath,
        "is_absolute": is_absolute,
        "action": "delete" if content is None else "save",
        "base_hash": ABSENT if current is None else content_hash(current),
        "result_hash": content_hash(content),
        "content": content,
        "proposed_by": {"origin": "ui", "source": EDITOR_SOURCE},
    }
    with _LOCK:
        failure = _guarded_write(change)
        if failure:
            body, status = failure
            return {**body, "protected": True, "message": body.get("error"), "status_code": status}, status
        _audit("editor_saved", change)
    return {"status": "accepted", "protected": True, "message": f"Saved '{filepath}' after its checks passed."}, 202


def propose(
    workspace_id: str,
    filepath: str,
    content: Optional[str],
    is_absolute: bool = False,
    origin: Optional[str] = None,
    source: Optional[str] = None,
    reference: Optional[str] = None,
) -> Tuple[Dict[str, Any], int]:
    """Stages a change to a protected file (content None deletes it) and returns the answer the writer gets."""
    current = _read_text(workspace_id, filepath, is_absolute)
    if content is None and current is None:
        return _refusal(f"'{filepath}' does not exist.", 404)
    if content is not None and content == current:
        return {"status": "accepted", "protected": True, "message": f"'{filepath}' is unchanged."}, 202
    base_hash = ABSENT if current is None else content_hash(current)
    result_hash = content_hash(content)
    with _LOCK:
        records = _all_records()
        for existing in records:
            if (existing["filepath"], existing["base_hash"], existing["result_hash"]) == (filepath, base_hash, result_hash):
                return _pending_answer(existing), 202
        if len(records) >= MAX_PENDING:
            return _refusal(f"{MAX_PENDING} protected changes are already waiting. Review or discard them first.", 429)
        record = {
            "id": f"pc_{uuid.uuid4().hex[:12]}",
            "workspace_id": workspace_id,
            "filepath": filepath,
            "is_absolute": is_absolute,
            "action": "delete" if content is None else "save",
            "base_hash": base_hash,
            "result_hash": result_hash,
            "content": content,
            "proposed_by": {"origin": origin, "source": source, "reference": reference},
            "created_at": time.time(),
        }
        _write_control_file(_record_path(record["id"]), json.dumps(record, indent=2))
        _audit("proposed", record)
    print(f"🛡️ [Protected Changes] {record['action']} of '{filepath}' from '{origin}' waits for confirmation ({record['id']}).")
    _notify()
    return _pending_answer(record), 202


def _pending_answer(record: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "status": "pending_confirmation",
        "protected": True,
        "change_id": record["id"],
        "message": f"'{record['filepath']}' is a protected file. The change was not written; it waits for a person to confirm it.",
    }


def list_pending() -> List[Dict[str, Any]]:
    """Every pending change, oldest first, with the file as it is now and whether it changed since the proposal."""
    changes = []
    for record in _all_records():
        current = _read_text(record["workspace_id"], record["filepath"], bool(record.get("is_absolute")))
        current_hash = ABSENT if current is None else content_hash(current)
        changes.append({
            **record,
            "current_content": current,
            "current_hash": current_hash,
            "stale": current_hash != record["base_hash"],
        })
    return changes


def _refuse_machine_origin(change: Optional[Dict[str, Any]], verb: str) -> Optional[Tuple[Dict[str, Any], int]]:
    origin = get_current_origin()
    if origin not in _attestations.HUMAN_ORIGINS:
        _audit(f"{verb}_refused", change, reason=f"origin '{origin}'")
        return _refusal(f"Only a person can {verb} a protected change; this call came from '{origin}'.")
    return None


def confirm(change_id: str, result_hash: str) -> Tuple[Dict[str, Any], int]:
    """
    Writes a pending change, if the person saw exactly this result and the file is still as it was proposed against.
    Recovery files pass their smoke test first, and the lifeboat and credential store keep a last-good copy.
    """
    with _LOCK:
        change = _load(change_id)
        refused = _refuse_machine_origin(change, "confirm")
        if refused:
            return refused
        if not change:
            return {"status": "error", "error": f"No pending change '{change_id}'."}, 404
        if not result_hash or result_hash != change["result_hash"]:
            _audit("confirm_refused", change, reason="result hash differs from the proposal")
            return {"status": "error", "error": "This change differs from the one you reviewed. Review it again."}, 409
        if _current_hash(change) != change["base_hash"]:
            _audit("confirm_refused", change, reason="file changed since the proposal")
            return {
                "status": "error",
                "error": "The file changed after this was proposed, so it would overwrite newer work. Discard it and propose it again.",
            }, 409
        failure = _guarded_write(change)
        if failure:
            return failure
        _write_control_file(_record_path(change_id), None)
        _audit("confirmed", change)
    _notify()
    return {"status": "confirmed", "change_id": change_id, "filepath": change["filepath"], "action": change["action"]}, 200


def discard(change_id: str) -> Tuple[Dict[str, Any], int]:
    """Drops a pending change without writing it."""
    with _LOCK:
        change = _load(change_id)
        refused = _refuse_machine_origin(change, "discard")
        if refused:
            return refused
        if not change:
            return {"status": "error", "error": f"No pending change '{change_id}'."}, 404
        _write_control_file(_record_path(change_id), None)
        _audit("discarded", change)
    _notify()
    return {"status": "discarded", "change_id": change_id}, 200
