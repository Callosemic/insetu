"""
The attestation store (S8): one place for every grant a person makes that stays in force.

Each record is a person's approval of one exact thing, for good or for a limited time:
- a command a repository may run (test or preview), per workspace;
- a workspace extension's exact files;
- a preview server's LAN exposure (a lease);
- later, a repository's directives (P13).

One-shot confirmations, such as a confirmed protected change, are events and belong in the audit log, not here.

The store lives in <control dir>/attestations.json beside host.json. It is a protected VFS target, so it is written
only through the kernel's confirmed-write path, and only from code that runs for a person (attest refuses machine
origins). The digest ties a grant to exactly what the person saw, so a grant lapses when that thing changes.

Every grant is sealed to this install (#28). The control directory sits inside the workspace, so a repository can carry
an attestations.json (or a host.json with legacy approvals) into a clone. A record counts only if its seal was made with
this install's key, which lives in the home control directory beside akasa's master key (~/.insetu/), outside every
workspace, and never enters the VFS. A
store copied from another machine, or written by hand, holds no valid seal and grants nothing. Records from before
seals existed count as absent too, so people approve those things once more after upgrading.
"""
import hashlib
import hmac
import json
import os
import secrets
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from insetu.core.sdk import (
    execute_confirmed_protected_write,
    get_current_origin,
    get_daemon_host_config_path,
    load_json_config,
    save_json_config,
)

ATTESTATIONS_FILENAME = "attestations.json"
ATTESTATION_KINDS = frozenset({"command", "workspace_extension", "lan_lease", "repo_directive"})
# Only origins in HUMAN_ORIGINS may record an approval; calls with no execution frame (None) or machine origins are refused.
HUMAN_ORIGINS = frozenset({"ui", "cli"})
# Kept as an informational constant for callers checking known machine origins.
NON_HUMAN_ORIGINS = frozenset({"mcp", "routine", "agent"})
# Identifies this daemon process. A grant made "until restart" is valid only in the run that made it.
DAEMON_RUN_ID = uuid.uuid4().hex

_STORE_LOCK = threading.RLock()
INSTALL_KEY_FILENAME = "install.key"
# Overrides where the install key lives (tests, containers with a read-only home).
INSTALL_KEY_DIR_ENV = "INSETU_INSTALL_KEY_DIR"


class AttestationRefused(PermissionError):
    """Raised when code running for a model, an MCP client or a routine tries to record an approval."""


def _host_config_path() -> str:
    """The daemon's host.json, which held approvals before the store existed."""
    return get_daemon_host_config_path()


def control_dir_path() -> Path:
    """The daemon's control directory, which holds host.json, this store, pending protected changes and the audit log."""
    return Path(_host_config_path()).parent


def attestations_path() -> Path:
    """<control dir>/attestations.json, beside host.json."""
    return control_dir_path() / ATTESTATIONS_FILENAME


def install_key_dir() -> Path:
    """
    Where the install key lives: the home control directory (~/.insetu/), beside akasa's master_key.txt, so the
    install's secrets sit in one place. Decided 2026-11-19; where machine secrets live in general is left to the
    data-placement model.
    """
    override = os.environ.get(INSTALL_KEY_DIR_ENV)
    if override:
        return Path(override).expanduser().resolve()
    return (Path.home() / control_dir_path().name).resolve()


def _install_key(create: bool) -> Optional[bytes]:
    """
    This install's sealing key, made on first use (owner-only file). None when it doesn't exist and create is False.

    Read from disk on every check, not cached: the file is 64 bytes, and deleting it withdraws every grant at once.
    """
    key_path = install_key_dir() / INSTALL_KEY_FILENAME
    with _STORE_LOCK:
        try:
            key = bytes.fromhex(key_path.read_text(encoding="ascii").strip())
        except FileNotFoundError:
            if not create:
                return None
            key_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            key = secrets.token_bytes(32)
            try:
                fd = os.open(key_path.as_posix(), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            except FileExistsError:
                key = bytes.fromhex(key_path.read_text(encoding="ascii").strip())
            else:
                with os.fdopen(fd, "w", encoding="ascii") as handle:
                    handle.write(key.hex())
        except (OSError, ValueError):
            return None
        return key if len(key) >= 32 else None


def _seal_of(record: Dict[str, Any], key: bytes) -> str:
    """HMAC over every field of the record except the seal itself."""
    body = {k: v for k, v in record.items() if k != "seal"}
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), default=str)
    return hmac.new(key, canonical.encode("utf-8"), hashlib.sha256).hexdigest()


def _seal(record: Dict[str, Any]) -> Dict[str, Any]:
    key = _install_key(create=True)
    if key is None:
        raise OSError(f"Could not create the install key in {install_key_dir()}; set {INSTALL_KEY_DIR_ENV} to a writable directory.")
    record["seal"] = _seal_of(record, key)
    return record


def _is_sealed_here(record: Dict[str, Any]) -> bool:
    """True only when this install sealed the record. Copied, hand-written and pre-seal records are not."""
    seal = record.get("seal")
    if not isinstance(seal, str):
        return False
    key = _install_key(create=False)
    return key is not None and hmac.compare_digest(seal, _seal_of(record, key))


def digest_of(*parts: Any) -> str:
    """Stable digest of the exact thing a person approved (a command, a launch configuration)."""
    joined = "\x1f".join(str(p) for p in parts)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


def _read_store() -> Dict[str, Any]:
    data = load_json_config(attestations_path().as_posix(), {})
    if not isinstance(data, dict) or not isinstance(data.get("records"), list):
        data = {"version": 1, "records": []}
    return data


def _write_store(data: Dict[str, Any]) -> None:
    body, status = execute_confirmed_protected_write(
        "default",
        attestations_path().as_posix(),
        json.dumps(data, indent=2),
        {"is_absolute_artifact": True, "ignore_ledger": True},
    )
    if status >= 400:
        raise OSError(f"Could not write the attestation store: {body}")


def _is_active(record: Dict[str, Any], now: Optional[float] = None) -> bool:
    if not _is_sealed_here(record):
        return False
    expires_at = record.get("expires_at")
    if expires_at is not None and float(expires_at) <= (now if now is not None else time.time()):
        return False
    run_id = record.get("run_id")
    return run_id is None or run_id == DAEMON_RUN_ID


def describe_actor() -> Dict[str, Any]:
    """Who is acting, as far as insetu can tell: the call's origin and, for HTTP, the client. Used for grants and audit entries."""
    who: Dict[str, Any] = {"origin": get_current_origin() or "cli"}
    try:
        from flask import has_request_context as _has_request_context, request as _request

        if _has_request_context():
            who["client"] = _request.remote_addr
            who["user_agent"] = (_request.headers.get("User-Agent") or "")[:200]
    except Exception:
        pass
    return who


def _migrate_legacy_host_approvals(data: Dict[str, Any]) -> bool:
    """
    Moves command, hook and workspace-extension approvals out of host.json (insetu 0.32 and earlier). Idempotent.

    The moved records are left unsealed: host.json sits in the workspace too, so nothing in it proves this install made
    those approvals. They show as absent until a person approves again.
    """
    host_path = _host_config_path()
    host_data = load_json_config(host_path, {})
    legacy_commands = host_data.get("approved_test_commands")
    legacy_extensions = host_data.get("approved_workspace_extensions")
    legacy_hooks = host_data.get("approved_hooks")
    if not legacy_commands and not legacy_extensions and not legacy_hooks:
        return False
    existing = {(r.get("kind"), r.get("subject")) for r in data["records"]}
    migrated_by = {"origin": "migration", "source": "legacy_host_config"}
    for workspace_id, signatures in (legacy_commands or {}).items():
        for signature in signatures or []:
            subject = f"{workspace_id}|{signature}"
            if ("command", subject) not in existing:
                data["records"].append(_new_record("command", subject, signature, {}, None, None, migrated_by))
    for workspace_id, signatures in (legacy_hooks or {}).items():
        for signature in signatures or []:
            subject = f"{workspace_id}|hook:{str(signature).split(':', 1)[0]}"
            if ("command", subject) not in existing:
                data["records"].append(_new_record("command", subject, signature, {"kind": "hook"}, None, None, migrated_by))
    for name, approval in (legacy_extensions or {}).items():
        if ("workspace_extension", name) not in existing and isinstance(approval, dict) and approval.get("fingerprint"):
            record = _new_record(
                "workspace_extension", name, approval["fingerprint"], {"files": dict(approval.get("files") or {})},
                None, None, migrated_by,
            )
            record["approved_at"] = approval.get("approved_at") or record["approved_at"]
            data["records"].append(record)
    _write_store(data)
    host_data.pop("approved_test_commands", None)
    host_data.pop("approved_workspace_extensions", None)
    host_data.pop("approved_hooks", None)
    save_json_config(host_path, host_data, workspace_id="default")
    return True


def _load() -> Dict[str, Any]:
    data = _read_store()
    _migrate_legacy_host_approvals(data)
    return data


def _new_record(kind, subject, digest, detail, expires_at, run_id, approved_by) -> Dict[str, Any]:
    return {
        "id": uuid.uuid4().hex,
        "kind": kind,
        "subject": subject,
        "digest": digest,
        "approved_at": time.time(),
        "approved_by": approved_by,
        "expires_at": expires_at,
        "run_id": run_id,
        "detail": dict(detail or {}),
    }


def attest(
    kind: str,
    subject: str,
    digest: str,
    detail: Optional[Dict[str, Any]] = None,
    expires_at: Optional[float] = None,
    until_restart: bool = False,
) -> Dict[str, Any]:
    """
    Records a person's approval of `subject` as it is now (`digest`), replacing any earlier grant for it.

    expires_at ends a timed grant; until_restart ends it when this daemon process exits. Call only from human-only
    routes; code running for a model, an MCP client or a routine is refused (AttestationRefused).
    """
    if kind not in ATTESTATION_KINDS:
        raise ValueError(f"Unknown attestation kind '{kind}'.")
    if not subject or not digest:
        raise ValueError("An attestation needs a subject and a digest.")
    origin = get_current_origin()
    if origin not in HUMAN_ORIGINS:
        raise AttestationRefused(f"Approvals are made by a person; this call came from '{origin}'.")
    with _STORE_LOCK:
        data = _load()
        data["records"] = [r for r in data["records"] if not (r.get("kind") == kind and r.get("subject") == subject)]
        record = _seal(_new_record(kind, subject, digest, detail, expires_at, DAEMON_RUN_ID if until_restart else None, describe_actor()))
        data["records"].append(record)
        _write_store(data)
    return dict(record)


def get_attestation(kind: str, subject: str) -> Optional[Dict[str, Any]]:
    """The active grant for subject, or None (unsealed, expired and earlier-run grants count as absent)."""
    with _STORE_LOCK:
        for record in _load()["records"]:
            if record.get("kind") == kind and record.get("subject") == subject and _is_active(record):
                return dict(record)
    return None


def is_attested(kind: str, subject: str, digest: Optional[str] = None) -> bool:
    """True when an active grant exists for subject and, if a digest is given, it covers exactly that digest."""
    record = get_attestation(kind, subject)
    return record is not None and (digest is None or record.get("digest") == digest)


def list_attestations(kind: Optional[str] = None) -> List[Dict[str, Any]]:
    """Active grants, optionally of one kind."""
    with _STORE_LOCK:
        return [dict(r) for r in _load()["records"] if (kind is None or r.get("kind") == kind) and _is_active(r)]


def revoke(kind: str, subject: str) -> bool:
    """Removes the grant for subject. Revoking is always allowed: it can only take a permission away."""
    with _STORE_LOCK:
        data = _load()
        kept = [r for r in data["records"] if not (r.get("kind") == kind and r.get("subject") == subject)]
        if len(kept) == len(data["records"]):
            return False
        data["records"] = kept
        _write_store(data)
        return True


def prune() -> int:
    """Drops unsealed and expired grants and grants from earlier runs. Returns how many were removed."""
    with _STORE_LOCK:
        data = _load()
        now = time.time()
        kept = [r for r in data["records"] if _is_active(r, now)]
        removed = len(data["records"]) - len(kept)
        if removed:
            data["records"] = kept
            _write_store(data)
        return removed
