from typing import TypedDict
from insetu.core.sdk import InSetuExtension


class OfflineRepoTogglePayload(TypedDict):
    repo: str
    enabled: bool


OFFLINE_SETTINGS_SCHEMA = [
    {
        "id": "offline_capable",
        "label": "Offline Capable (IndexedDB Sync)",
        "type": "boolean",
        "scope": "repo",
        "default": False,
        "description": "Mirror and warm this repository's tracked VFS files in browser IndexedDB for offline access.",
    }
]

offline_bp = InSetuExtension(
    "offline",
    __name__,
    title="Offline Engine",
    description="Core Tier 0 offline caching and IndexedDB synchronization.",
    settings_schema=OFFLINE_SETTINGS_SCHEMA,
)

__depends__ = []


@offline_bp.route(
    "repo_toggle",
    methods=["POST"],
    request_schema=OfflineRepoTogglePayload,
    docstring="[sync] Toggles offline IndexedDB caching participation for a mounted repository.",
)
def api_toggle_repo_offline(ctx):
    """Toggles offline IndexedDB caching participation for a mounted repository."""
    repo_dir = str((ctx.payload or {}).get("repo") or "").strip()
    enabled = bool((ctx.payload or {}).get("enabled"))
    if not repo_dir:
        return {"error": "Repository identifier 'repo' is required."}, 400

    ctx.settings.set("offline_capable", enabled, repo=repo_dir)
    return {"status": "success", "repo": repo_dir, "offline_capable": enabled}