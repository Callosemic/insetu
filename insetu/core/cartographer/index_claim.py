"""Decides which workspace writes a clone's CODE_INDEX.md when several workspaces mount that clone.

Each workspace renders CODE_INDEX.md from its own index rules: the mount name, title, file sieve, managed
directories and symbol setting. Two workspaces (or two insetu instances) that mount one clone with different
rules each read the other's render as an edit and write their own back, without end (issue #22). The clone is
the only thing they all share, so the claim lives in its git directory: never committed, local to this
machine, removed with the clone.

A workspace writes the index when it holds the claim, when no live workspace holds it, or when its rules match
the holder's (the two renders agree). Otherwise it leaves the index alone and says so once. A person moves the
claim with the cartographer's claim_index route. When index rules move into the repository (P13), every
workspace renders the same index and the claim only ever sees matching rules.
"""
import hashlib
import json
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from insetu.core.utils_core import atomic_write_text, get_tenant_control_dir

CLAIM_FILENAME = "insetu-index-claim.json"
# The configuration that shapes a CODE_INDEX.md render, per repository and workspace-wide.
INDEX_RULE_REPO_KEYS = (
    "repo_dir", "title", "index_path", "exts", "force_include", "apply_ignore", "ignore_exceptions",
    "repo_ignore_dirs", "repo_ignore_files", "repo_ignore_patterns", "repo_managed_dirs",
)
INDEX_RULE_WORKSPACE_KEYS = ("managed_dirs", "include_extensions")

_WARNED: set = set()
_WARNED_LOCK = threading.Lock()


def index_rules_fingerprint(repo_cfg: Dict[str, Any], workspace_cfg: Dict[str, Any], include_symbols: bool) -> str:
    """Hashes the configuration that shapes a CODE_INDEX.md render, so two workspaces can tell whether their renders agree."""
    rules = {key: repo_cfg.get(key) for key in INDEX_RULE_REPO_KEYS}
    rules.update({f"workspace.{key}": workspace_cfg.get(key) for key in INDEX_RULE_WORKSPACE_KEYS})
    rules["include_symbols"] = bool(include_symbols)
    return hashlib.sha256(json.dumps(rules, sort_keys=True, default=str).encode("utf-8")).hexdigest()[:16]


def _git_dir(repo_path: Path) -> Optional[Path]:
    """Returns the clone's git directory (a linked worktree's own one included), or None when it is not a git clone."""
    dot_git = repo_path / ".git"
    if dot_git.is_dir():
        return dot_git
    if dot_git.is_file():
        try:
            text = dot_git.read_text(encoding="utf-8").strip()
        except OSError:
            return None
        if text.startswith("gitdir:"):
            target = Path(text[len("gitdir:"):].strip())
            target = target if target.is_absolute() else repo_path / target
            return target.resolve() if target.is_dir() else None
    return None


def _read_claim(claim_path: Path) -> Dict[str, Any]:
    try:
        data = json.loads(claim_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _write_claim(claim_path: Path, workspace: str, rules: str) -> None:
    # The git directory sits outside every VFS mount and is never committed, like git's own files there, so this
    # small file is written directly rather than through the VFS ledger.
    payload = {"workspace": workspace, "rules": rules, "claimed_at": time.time()}
    atomic_write_text(claim_path.as_posix(), json.dumps(payload, indent=2) + "\n")


def may_write_index(repo_path, workspace_id: Optional[str], rules: str, take_over: bool = False) -> Tuple[bool, Optional[str]]:
    """Returns (allowed, holder): whether this workspace may write the clone's CODE_INDEX.md, and which workspace holds the claim.

    Claims the index when it is unclaimed, when its holder's control directory no longer exists, or when take_over
    is set (a person asked). A clone without a git directory has nothing to share a claim through and is always allowed.
    """
    git_dir = _git_dir(Path(repo_path))
    if git_dir is None:
        return True, None
    try:
        me = Path(get_tenant_control_dir(workspace_id)).resolve().as_posix()
    except Exception as exc:
        print(f"⚠️ [Cartographer] Could not identify this workspace for the CODE_INDEX.md claim; writing as before: {exc}")
        return True, None
    claim_path = git_dir / CLAIM_FILENAME
    claim = _read_claim(claim_path)
    holder = claim.get("workspace")
    if take_over or not holder or holder == me or not Path(str(holder)).is_dir():
        if holder != me or claim.get("rules") != rules:
            _write_claim(claim_path, me, rules)
        return True, me
    return claim.get("rules") == rules, str(holder)


def warn_index_owned_elsewhere(repo_dir: str, workspace_id: Optional[str], holder: Optional[str]) -> None:
    """Says once per process that this workspace is leaving a repository's CODE_INDEX.md to the workspace that holds it."""
    key = (repo_dir, workspace_id, holder)
    with _WARNED_LOCK:
        if key in _WARNED:
            return
        _WARNED.add(key)
    print(
        f"⚠️ [Cartographer] CODE_INDEX.md for '{repo_dir}' is written by another workspace that mounts the same clone "
        f"with different index settings ({holder}). This workspace leaves it alone. Make the settings match, or use "
        f"cartographer/claim_index to make this workspace the writer."
    )
