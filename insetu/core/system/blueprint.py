"""Shared `system_bp` InSetuExtension blueprint and `SYSTEM_SETTINGS_SCHEMA` for the `insetu.core.system` package."""
from insetu.core.sdk import (
    InSetuExtension,
    get_mountable_data_domains,
)

SYSTEM_SETTINGS_SCHEMA = [
    {
        "id": "port",
        "label": "Daemon Port",
        "type": "number",
        "scope": "daemon",
        "default": 5005,
        "description": "The port the inSetu daemon binds to. Requires reboot to take effect."
    },
    {
        "id": "enable_watchdog",
        "label": "Enable Native Filesystem Watchdog",
        "type": "boolean",
        "scope": "daemon",
        "default": True,
        "description": "Uses the Python watchdog library to detect external out-of-band edits and instantly sync the VFS."
    },
    {
        "id": "preload_all_extensions",
        "label": "Preload All Extensions on Boot",
        "type": "boolean",
        "scope": "daemon",
        "default": False,
        "description": "Aggressively loads all available extensions into RAM during boot, eliminating daemon reboots when activating new extensions later."
    },
    {
        "id": "instance_title",
        "label": "Workspace Title",
        "type": "text",
        "scope": "workspace",
        "default": "inSetu Workbench",
        "description": "The display title for this workspace."
    },
    {
        "id": "instance_emoji",
        "label": "Menu Emoji",
        "type": "text",
        "scope": "workspace",
        "default": "⚙️",
        "description": "The emoji used in the top-right application menu."
    },
    {
        "id": "extensions",
        "label": "Active Workspace Extensions",
        "type": "hidden",
        "scope": "workspace",
        "default": ["config"],
        "description": "List of enabled extension identifiers for this workspace."
    },
    {
        "id": "offline_cache_limit_mb",
        "label": "Offline Cache Limit (MB)",
        "type": "number",
        "scope": "daemon",
        "default": 250,
        "description": "Maximum IndexedDB storage quota for VFS cache warming."
    },
    {
        "id": "export_shared_domains",
        "label": "Exported Domains (Publisher)",
        "type": "hidden",
        "scope": "workspace",
        "default": {},
        "description": "Expose internal directories to other workspaces."
    },
    {
        "id": "shared_mounts",
        "label": "Virtual Mounts (Subscriber ws://)",
        "type": "repeater",
        "scope": "workspace",
        "min_items": 0,
        "max_items": 32,
        "item_label": "Mount",
        "item_title_key": "workspace_id",
        "item_subtitle_key": "domain",
        "add_label": "Add Virtual Mount",
        "empty_text": "No external workspace domains mounted in this workspace.",
        "default": [],
        "description": "Mount external workspace domains read-only into this workspace via ws://<workspace_id>/<domain>/ URIs.",
        "item_schema": [
            {
                "id": "workspace_id",
                "label": "Source Workspace ID",
                "type": "text",
                "default": "default",
                "placeholder": "e.g. default"
            },
            {
                "id": "domain",
                "label": "Target Domain",
                "type": "select",
                "default": "prompts",
                "options": get_mountable_data_domains,
            }
        ]
    },
    {
        "id": "child_env_passthrough",
        "label": "Allowed Credential Variables",
        "type": "comma_list",
        "scope": "repo",
        "default": [],
        "description": "Credential-like environment variables (names with KEY, TOKEN, SECRET, PASSWORD, AUTH) that this repository's preview servers and test runners may inherit from insetu's environment. Everything else of that kind is withheld. Stored in the workspace, never in the repository."
    }
]

system_bp = InSetuExtension(
    'system', __name__,
    title="Core OS",
    description="Core OS daemon and workspace environment configurations.",
    core=True,
    settings_schema=SYSTEM_SETTINGS_SCHEMA,
    volumes={
        'settings': {
            'tier': 'data',
            'scheme': 'ctx',
            'path_key': 'settings_dir',
            'module_subdir': 'settings',
            # Settings documents live in <control>/data/settings/, beside their user tier (.templates/user/). Until
            # P13 Sprint 3 the volume resolved to data/system/; the first mount moves anything written there.
            'domain': 'settings',
            'legacy_dirs': ['settings', 'data/system'],
        }
    },
)
__depends__ = []
