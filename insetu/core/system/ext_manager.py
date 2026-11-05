"""Workspace extension discovery, SHA-256 fingerprinting, human approval routes, and dependency installation workers."""
import ast
import hashlib
import importlib
import importlib.util
import os
from pathlib import Path
import re
import sys
import threading
from typing import Any, Dict, List, Optional, Tuple, TypedDict

import insetu.core.attestations as _attestations
from insetu.core.sdk import (
    CORE_MODULES_TUPLE,
    resolve_external_dependency_spec,
)
from insetu.core.system.blueprint import system_bp
from insetu.core.utils_core import get_workspace_physics

WORKSPACE_EXTENSION_NAME_PATTERN = re.compile(r"^[a-z0-9_]+$")
WORKSPACE_EXTENSION_MAX_BYTES = 20 * 1024 * 1024
_WORKSPACE_EXTENSION_SNAPSHOT_CACHE: Dict[str, Tuple[tuple, Dict[str, Any]]] = {}
_WORKSPACE_EXTENSION_SNAPSHOT_LOCK = threading.Lock()


def get_workspace_extension_reserved_names() -> frozenset:
    """Names a workspace extension cannot take: every bundled extension and core module, plus config, sdk, languages."""
    package_dir = Path(__file__).resolve().parent.parent.parent
    names = {"config", "sdk", "languages", *CORE_MODULES_TUPLE}
    for sub in ("extensions", "core"):
        folder = package_dir / sub
        if folder.is_dir():
            names.update(item for item in os.listdir(folder) if not item.startswith("__") and (folder / item).is_dir())
    return frozenset(names)


def get_workspace_extensions_root() -> Path:
    """The one folder workspace extensions load from: .insetu/extensions/ under the default workspace root.

    Always the default workspace, never the tenant of the current request: extensions belong to the daemon.
    """
    _, ws_root = get_workspace_physics("default")
    return Path(ws_root).joinpath(".insetu", "extensions")


def snapshot_workspace_extension(ext_dir: Path, with_contents: bool = False) -> Dict[str, Any]:
    """Hashes every file of one workspace extension.

    Returns {"fingerprint", "files": {relative path: sha256}, "error"} and, with with_contents, the bytes that were
    hashed under "contents", so a caller can run exactly what it checked. A symbolic link anywhere in the folder makes
    the extension invalid (its target could change without changing the fingerprint), as does going over
    WORKSPACE_EXTENSION_MAX_BYTES. __pycache__ folders and .pyc files are build output and are skipped.
    """
    ext_dir = Path(ext_dir)
    files: Dict[str, str] = {}
    contents: Dict[str, bytes] = {}
    total = 0
    if ext_dir.is_symlink() or not ext_dir.is_dir():
        return {"fingerprint": None, "files": {}, "error": "Not a folder (or a symbolic link)."}
    for dirpath, dirnames, filenames in os.walk(ext_dir, followlinks=False):
        dirnames[:] = sorted(d for d in dirnames if d != "__pycache__")
        for d in dirnames:
            if Path(dirpath, d).is_symlink():
                rel = Path(dirpath, d).relative_to(ext_dir).as_posix()
                return {"fingerprint": None, "files": {}, "error": f"Contains a symbolic link: {rel}"}
        for name in sorted(filenames):
            full = Path(dirpath, name)
            rel = full.relative_to(ext_dir).as_posix()
            if full.is_symlink():
                return {"fingerprint": None, "files": {}, "error": f"Contains a symbolic link: {rel}"}
            if name.endswith(".pyc"):
                continue
            data = full.read_bytes()
            total += len(data)
            if total > WORKSPACE_EXTENSION_MAX_BYTES:
                return {"fingerprint": None, "files": {}, "error": f"Larger than {WORKSPACE_EXTENSION_MAX_BYTES // (1024 * 1024)} MB."}
            files[rel] = hashlib.sha256(data).hexdigest()
            if with_contents:
                contents[rel] = data
    digest = hashlib.sha256()
    for rel in sorted(files):
        digest.update(f"{rel}\0{files[rel]}\n".encode("utf-8"))
    result: Dict[str, Any] = {"fingerprint": digest.hexdigest(), "files": files, "error": None}
    if with_contents:
        result["contents"] = contents
    return result


def current_workspace_extension_fingerprint(ext_dir: Path) -> Optional[str]:
    """The extension's fingerprint now, rehashed only when a file's size or mtime changed (for per-request checks)."""
    ext_dir = Path(ext_dir)
    try:
        stat_key = []
        for dirpath, dirnames, filenames in os.walk(ext_dir, followlinks=False):
            dirnames[:] = sorted(d for d in dirnames if d != "__pycache__")
            for name in sorted(filenames + [d for d in dirnames if Path(dirpath, d).is_symlink()]):
                entry = Path(dirpath, name)
                st = entry.lstat()
                stat_key.append((entry.relative_to(ext_dir).as_posix(), st.st_size, st.st_mtime_ns, st.st_mode))
        key = tuple(stat_key)
    except OSError:
        return None
    cache_id = ext_dir.as_posix()
    with _WORKSPACE_EXTENSION_SNAPSHOT_LOCK:
        cached = _WORKSPACE_EXTENSION_SNAPSHOT_CACHE.get(cache_id)
        if cached and cached[0] == key:
            return cached[1].get("fingerprint")
    snap = snapshot_workspace_extension(ext_dir)
    with _WORKSPACE_EXTENSION_SNAPSHOT_LOCK:
        _WORKSPACE_EXTENSION_SNAPSHOT_CACHE[cache_id] = (key, snap)
    return snap.get("fingerprint")


def get_workspace_extension_approvals() -> Dict[str, Dict[str, Any]]:
    """Approved workspace extensions from the attestation store: {name: {"fingerprint", "files", "approved_at"}}."""
    return {
        r["subject"]: {"fingerprint": r["digest"], "files": dict((r.get("detail") or {}).get("files") or {}), "approved_at": r.get("approved_at")}
        for r in _attestations.list_attestations("workspace_extension")
    }


def approve_workspace_extension(name: str, snapshot: Dict[str, Any]) -> str:
    """Records a person's approval of one extension's exact files. Call only from human-only routes."""
    if not WORKSPACE_EXTENSION_NAME_PATTERN.match(name or "") or not snapshot.get("fingerprint"):
        raise ValueError("A valid extension name and fingerprint are required.")
    _attestations.attest("workspace_extension", name, snapshot["fingerprint"], {"files": dict(snapshot.get("files") or {})})
    return snapshot["fingerprint"]


def revoke_workspace_extension(name: str) -> bool:
    """Removes a person's approval for one extension; it stops loading at the next restart."""
    return _attestations.revoke("workspace_extension", name)


def describe_workspace_extension(name: str, snapshot: Dict[str, Any], approval: Optional[Dict[str, Any]], reserved: bool = False) -> Dict[str, Any]:
    """Status of one workspace extension for the review screen: approved, changed, unapproved, or invalid.

    file_changes lists what differs from the approved files (added, changed, removed), so a person reviews only that.
    """
    entry: Dict[str, Any] = {"id": name, "fingerprint": snapshot.get("fingerprint"), "files": sorted((snapshot.get("files") or {}).keys())}
    if reserved:
        entry.update(status="invalid", reason=f"'{name}' is the name of a built-in module or extension, which a workspace extension cannot replace.")
        return entry
    if snapshot.get("error"):
        entry.update(status="invalid", reason=snapshot["error"])
        return entry
    if f"engine_{name}.py" not in (snapshot.get("files") or {}):
        entry.update(status="invalid", reason=f"Missing engine_{name}.py.")
        return entry
    approved_files = dict((approval or {}).get("files") or {})
    current_files = snapshot.get("files") or {}
    changes = []
    for rel in sorted(set(approved_files) | set(current_files)):
        if rel not in approved_files:
            changes.append({"path": rel, "change": "added"})
        elif rel not in current_files:
            changes.append({"path": rel, "change": "removed"})
        elif approved_files[rel] != current_files[rel]:
            changes.append({"path": rel, "change": "changed"})
    if not approval:
        entry.update(status="unapproved", reason="Not approved yet.", file_changes=changes)
    elif approval.get("fingerprint") == snapshot.get("fingerprint"):
        entry.update(status="approved", file_changes=[])
    else:
        entry.update(status="changed", reason="Files changed since they were approved.", file_changes=changes)
    return entry


def scan_workspace_extensions(reserved_names=None, with_contents: bool = False) -> Dict[str, Dict[str, Any]]:
    """Every folder in .insetu/extensions/ with its status; with_contents adds the "snapshot" for approved ones."""
    if reserved_names is None:
        reserved_names = get_workspace_extension_reserved_names()
    root = get_workspace_extensions_root()
    found: Dict[str, Dict[str, Any]] = {}
    if not root.is_dir():
        return found
    approvals = get_workspace_extension_approvals()
    for item in sorted(os.listdir(root)):
        cand = root / item
        if item.startswith((".", "__")) or not WORKSPACE_EXTENSION_NAME_PATTERN.match(item) or not (cand.is_dir() or cand.is_symlink()):
            continue
        snap = snapshot_workspace_extension(cand, with_contents=with_contents)
        entry = describe_workspace_extension(item, snap, approvals.get(item), reserved=item in reserved_names)
        entry["dir"] = cand.as_posix()
        if with_contents and entry["status"] == "approved":
            entry["snapshot"] = snap
        found[item] = entry
    return found


class _StaticExtMeta:
    def __init__(self, title=None, description="", external_dependencies=None, external_binaries=None):
        self.title = title
        self.description = description
        self.external_dependencies = external_dependencies or []
        self.external_binaries = external_binaries or []


def _inspect_or_resolve_extension_meta(ext_name: str, item_path: str):
    """Returns (mod, bp_or_meta, err) using sys.modules if already loaded, or side-effect-free AST inspection if unmounted."""
    mod = (
        sys.modules.get(f"insetu.extensions.{ext_name}.engine_{ext_name}")
        or sys.modules.get(f"insetu.extensions.engine_{ext_name}")
        or sys.modules.get(f"insetu.engine_{ext_name}")
    )
    if mod is not None:
        return mod, getattr(mod, f"{ext_name}_bp", None), None

    engine_py = Path(item_path) / f"engine_{ext_name}.py" if os.path.isdir(item_path) else Path(item_path)
    if not engine_py.is_file():
        return None, None, None
    try:
        tree = ast.parse(engine_py.read_text(encoding="utf-8"), filename=engine_py.as_posix())
        title = None
        description = ""
        ext_deps = []
        ext_bins = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and getattr(node.func, "id", getattr(node.func, "attr", "")) == "InSetuExtension":
                for kw in node.keywords:
                    if kw.arg == "title" and isinstance(kw.value, ast.Constant):
                        title = kw.value.value
                    elif kw.arg == "description" and isinstance(kw.value, ast.Constant):
                        description = kw.value.value
                    elif kw.arg == "external_dependencies" and isinstance(kw.value, (ast.List, ast.Tuple)):
                        ext_deps = [e.value for e in kw.value.elts if isinstance(e, ast.Constant) and isinstance(e.value, str)]
                    elif kw.arg == "external_binaries" and isinstance(kw.value, (ast.List, ast.Tuple)):
                        ext_bins = [e.value for e in kw.value.elts if isinstance(e, ast.Constant) and isinstance(e.value, str)]
                break
        return None, _StaticExtMeta(title=title, description=description, external_dependencies=ext_deps, external_binaries=ext_bins), None
    except Exception as e:
        return None, None, str(e)


def _resolve_extension_module_and_bp(ext_name: str, include_error: bool = False):
    """Resolves (module, InSetuExtension_instance[, error_str]) for a given extension name without hardcoding domain names."""
    if not ext_name or not re.match(r'^[a-z0-9_]+$', ext_name):
        return (None, None, None) if include_error else (None, None)
    mod = (
        sys.modules.get(f"insetu.extensions.{ext_name}.engine_{ext_name}")
        or sys.modules.get(f"insetu.extensions.engine_{ext_name}")
        or sys.modules.get(f"insetu.engine_{ext_name}")
    )
    err = None
    if not mod:
        for target in (
            f"insetu.extensions.{ext_name}.engine_{ext_name}",
            f"insetu.extensions.engine_{ext_name}",
            f"insetu.engine_{ext_name}",
        ):
            try:
                mod = importlib.import_module(target)
                if mod:
                    break
            except ModuleNotFoundError as e:
                if e.name == target.split('.')[-1] or e.name == target or (e.name and target.startswith(f"{e.name}.")):
                    continue
                err = f"Missing dependency: {e.name}"
                break
            except Exception as e:
                err = str(e)
                break
    bp_obj = getattr(mod, f"{ext_name}_bp", None) if mod else None
    if include_error:
        return mod, bp_obj, err
    return mod, bp_obj


def _get_whitelisted_extension_packages(ext_name: str) -> List[str]:
    """Returns the canonical list of PyPI packages declared by an extension, preventing arbitrary package installation."""
    mod, bp_obj = _resolve_extension_module_and_bp(ext_name)
    if not mod or not bp_obj:
        return []
    raw_deps = list(getattr(bp_obj, 'external_dependencies', None) or [])
    packages: List[str] = []
    for dep in raw_deps:
        _, pypi_pkg = resolve_external_dependency_spec(dep)
        if pypi_pkg and pypi_pkg not in packages:
            packages.append(pypi_pkg)
    return packages


class ExtensionInstallDepsPayload(TypedDict):
    """Request payload naming the extension whose declared Python dependencies should be installed."""
    ext_name: str


class WorkspaceExtensionApprovePayload(TypedDict):
    """Request payload naming a workspace extension and the SHA-256 fingerprint the person reviewed."""
    name: str
    fingerprint: str


class WorkspaceExtensionRevokePayload(TypedDict):
    """Request payload naming a workspace extension whose approval should be revoked."""
    name: str


@system_bp.worker("install_extension_deps_task")
def _background_install_extension_deps(ctx, ext_name: str = ""):
    clean_ext = (ext_name or "").strip().lower()
    allowed_packages = _get_whitelisted_extension_packages(clean_ext)
    if not allowed_packages:
        raise ValueError(f"No installable Python dependencies declared for extension '{clean_ext}'.")

    missing_packages = []
    for pkg in allowed_packages:
        import_spec, pypi_pkg = resolve_external_dependency_spec(pkg)
        if importlib.util.find_spec(import_spec) is None:
            missing_packages.append(pypi_pkg)

    target_packages = missing_packages if missing_packages else allowed_packages
    ctx.jobs.update_progress(f"Installing {', '.join(target_packages)} for [{clean_ext}]...")

    cmd = [sys.executable, "-m", "pip", "install", *target_packages]
    res = ctx.exec.run(cmd, timeout=300)
    output_log = ((res.stdout or "") + "\n" + (res.stderr or "")).strip()
    if res.returncode != 0:
        raise RuntimeError(f"pip install failed (exit {res.returncode}):\n{output_log[-1000:]}")

    importlib.invalidate_caches()
    _, bp_obj = _resolve_extension_module_and_bp(clean_ext)
    post_cmds = list(getattr(bp_obj, "post_install_commands", None) or [])
    for cmd_args in post_cmds:
        if not cmd_args:
            continue
        resolved_cmd = [sys.executable if token == "$PYTHON" else token for token in cmd_args]
        ctx.jobs.update_progress(f"Running post-install step for [{clean_ext}]: {' '.join(cmd_args)}...")
        post_res = ctx.exec.run(resolved_cmd, timeout=300)
        output_log += "\n" + ((post_res.stdout or "") + "\n" + (post_res.stderr or "")).strip()

    ctx.emit(f"{clean_ext}_dependencies_installed", installed=target_packages)
    requires_reboot = bool(getattr(bp_obj, "requires_reboot_on_install", False))
    return {
        "message": f"Installed {', '.join(target_packages)} for '{clean_ext}'.",
        "artifact": {
            "ext_name": clean_ext,
            "installed": target_packages,
            "requires_reboot": requires_reboot,
            "output": output_log[-2000:],
        },
    }


def _workspace_extensions_report():
    from flask import current_app as _current_app
    loaded = getattr(_current_app, "_loaded_workspace_extensions", {})
    quarantined = getattr(_current_app, "_quarantined_modules", {})
    report = []
    for name, entry in scan_workspace_extensions().items():
        entry.pop("dir", None)
        entry["loaded"] = name in loaded
        entry["running_fingerprint"] = loaded.get(name)
        entry["restart_needed"] = (entry["status"] == "approved") != entry["loaded"] or (
            entry["loaded"] and loaded.get(name) != entry.get("fingerprint")
        )
        if name in quarantined:
            entry["quarantine_reason"] = quarantined[name].get("reason")
        report.append(entry)
    return report


@system_bp.route(
    'extensions/install_deps',
    methods=['POST'],
    request_schema=ExtensionInstallDepsPayload,
    docstring="Installs declared external Python dependencies for a target extension into the active daemon environment.",
)
def api_system_install_extension_deps(ctx):
    """Dispatches a background job to install whitelisted PyPI dependencies for an extension."""
    data = ctx.payload or {}
    ext_name = str(data.get("ext_name") or "").strip().lower()
    if not ext_name:
        return {"error": "ext_name is required."}, 400
    allowed = _get_whitelisted_extension_packages(ext_name)
    if not allowed:
        return {"error": f"Extension '{ext_name}' has no declared external Python dependencies."}, 400
    job_id = ctx.jobs.submit(
        "install_extension_deps_task",
        coalesce="args",
        job_category="ui_blocking",
        ext_name=ext_name,
    )
    return {"status": "accepted", "job_id": job_id, "packages": allowed}, 202


@system_bp.route(
    'extensions/workspace',
    methods=['GET'],
    docstring="[sync] Lists the extensions in .insetu/extensions/ with their approval status and the files changed since approval.",
)
def api_workspace_extensions(ctx):
    """Lists .insetu/extensions/ folders with approval status, changed files, and whether each is running."""
    return {"status": "success", "extensions": _workspace_extensions_report()}


@system_bp.route(
    'extensions/workspace/approve',
    methods=['POST'],
    request_schema=WorkspaceExtensionApprovePayload,
    mcp_expose=False,
    docstring="[sync] Records a person's approval of a workspace extension's exact files; it loads at the next restart. Human-only: hidden from MCP and banned in routines (S8).",
)
def api_workspace_extension_approve(ctx):
    """Approves the files a person reviewed: the fingerprint they saw must still match the folder, or nothing is approved."""
    data = ctx.payload or {}
    name = str(data.get("name") or "").strip()
    seen = str(data.get("fingerprint") or "").strip()
    entry = scan_workspace_extensions().get(name)
    if not entry:
        return {"status": "error", "error": f"No workspace extension named '{name}'."}, 404
    if entry["status"] == "invalid":
        return {"status": "error", "error": entry.get("reason") or "This extension cannot be loaded."}, 400
    snapshot = snapshot_workspace_extension(Path(entry["dir"]))
    if not seen or snapshot.get("fingerprint") != seen:
        return {"status": "error", "error": "The extension's files changed after you reviewed them. Review them again before approving."}, 409
    approve_workspace_extension(name, snapshot)
    return {"status": "approved", "name": name, "fingerprint": snapshot["fingerprint"], "requires_reboot": True}


@system_bp.route(
    'extensions/workspace/revoke',
    methods=['POST'],
    request_schema=WorkspaceExtensionRevokePayload,
    mcp_expose=False,
    docstring="[sync] Removes a person's approval of a workspace extension; it stops loading at the next restart. Human-only (S8).",
)
def api_workspace_extension_revoke(ctx):
    """Human-only: removes a workspace extension's approval; it stops loading at the next restart."""
    name = str((ctx.payload or {}).get("name") or "").strip()
    if not revoke_workspace_extension(name):
        return {"status": "error", "error": f"'{name}' is not approved."}, 404
    return {"status": "revoked", "name": name, "requires_reboot": True}



