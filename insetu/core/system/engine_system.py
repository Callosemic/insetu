from pathlib import Path
import ast
import os
import gc
import re
import sys
import copy
import json
import shutil
import tracemalloc
import importlib
import importlib.util
import threading
import time
import traceback
from typing import TypedDict, Optional, List, Dict, Any
from flask import jsonify
from insetu.core.sdk import (
    InSetuExtension,
    SettingsManager,
    get_mountable_data_domains,
    get_registered_settings_schemas,
    hooks,
    set_mount_authorizer,
    get_system_deltas,
    provision_workspace_schemas,
    resolve_external_dependency_spec,
)
from insetu.core.directives import (
    DIRECTIVE_TIERS,
    ensure_local_settings_gitignored,
    get_directives,
    resolve_directive_tier_uri,
)
from insetu.core.utils_core import (
    load_config,
    parse_frontmatter,
    save_json_config,
    load_json_config,
    get_workspace_physics,
    get_tenant_control_dir,
    get_daemon_cwd,
    get_system_index_path,
    get_core_modules,
    sniff_tenant_id,
    reclaim_process_memory,
    get_kernel_memory_telemetry,
    typeddict_to_openapi,
    execute_vfs_delete,
    normalize_repo_domains,
    heal_manifest_entry_domain,
    get_repeater_secret,
    set_repeater_secret,
    slugify,
    scan_workspace_extensions,
    approve_workspace_extension,
    revoke_workspace_extension,
    snapshot_workspace_extension,
)
import insetu.core.attestations as _attestations
import insetu.core.system.legacy as _system_legacy  # noqa: F401 - Mounts one-off boot migration hooks
import insetu.core.protected_changes as _protected_changes


def _authorize_inter_workspace_mount(target_ws: str, subscriber_ws: str, domain: str, rel_path: str = "") -> bool:
    """Tier 2 Policy Evaluator for ws:// virtual mounts."""
    if target_ws == "default" and rel_path.startswith(("prompts/.templates/user", "settings/.templates/user")):
        return True
    sub_settings = SettingsManager('system', subscriber_ws)
    mounts = sub_settings.get("shared_mounts") or []
    if not any(m.get("workspace_id") == target_ws and m.get("domain") in (domain, "*") for m in mounts):
        return False
    pub_settings = SettingsManager('system', target_ws)
    exports = pub_settings.get("export_shared_domains") or {}
    domain_export = exports.get(domain) or exports.get("*")
    if not domain_export:
        return False

    allowed = domain_export.get("allowed") or []
    return "*" in allowed or subscriber_ws in allowed


set_mount_authorizer(_authorize_inter_workspace_mount)

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
def vault_repeater_secrets_for_schema(ext_name: str, workspace_id: Optional[str] = None) -> None:
    """
    Universal Repeater Secret Vaulting:
    Scans any registered settings schema for `type: 'repeater'` fields that contain `secure: True`
    subfields in `item_schema`. Extracts plaintext secrets into `.insetu/secrets.json` under
    `secrets[ext_name][f"{repeater_id}__{item_id}__{subfield_id}"]` and masks them as `'********'` in config files.
    """
    wid = workspace_id or "default"
    all_schemas = get_registered_settings_schemas(wid)
    ext_schema = all_schemas.get(ext_name) or []
    repeater_fields = [f for f in ext_schema if isinstance(f, dict) and f.get("type") == "repeater"]
    if not repeater_fields:
        return

    settings = SettingsManager(ext_name, wid)
    for rep in repeater_fields:
        rep_id = rep.get("id")
        item_schema = rep.get("item_schema") or []
        secure_subfields = [sf.get("id") for sf in item_schema if isinstance(sf, dict) and sf.get("secure") and sf.get("id")]
        if not rep_id or not secure_subfields:
            continue

        items = settings.get(rep_id, [])
        if not isinstance(items, list) or not items:
            continue

        rep_scope = str(rep.get("scope") or "workspace")
        mutated = False
        clean_items = []
        title_key = rep.get("item_title_key") or "title"

        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            item_copy = dict(item)
            item_id = slugify(str(item_copy.get("id") or item_copy.get(title_key) or f"item_{idx + 1}"))
            item_copy["id"] = item_id
            for sf_id in secure_subfields:
                raw_val = str(item_copy.get(sf_id) or "").strip()
                if raw_val and not raw_val.startswith("****"):
                    set_repeater_secret(ext_name, wid, rep_id, item_id, sf_id, raw_val, scope=rep_scope)
                    item_copy[sf_id] = "********"
                    item_copy[f"has_{sf_id}"] = True
                    mutated = True
                elif get_repeater_secret(ext_name, wid, rep_id, item_id, sf_id, scope=rep_scope):
                    if item_copy.get(sf_id) != "********":
                        item_copy[sf_id] = "********"
                        mutated = True
                    item_copy[f"has_{sf_id}"] = True
            clean_items.append(item_copy)

        if mutated:
            settings.update({rep_id: clean_items})


@system_bp.on('system_settings_updated')
def core_system_settings_updated(workspace_id=None, **kwargs):
    vault_repeater_secrets_for_schema('system', workspace_id)
    # Core OS settings (ports, titles, watchdogs) mandate an environment refresh
    return {"requires_refresh": True}
@system_bp.on('mutate_workspace_config', priority=1)
def hydrate_and_migrate_cascade_settings(cfg, workspace_id=None, **kwargs):
    """
    Transparent 3-Tier Cascade Bridge:
    1. Lazily migrates legacy `extensions`, `instance_title`, `instance_emoji`, and `port`
        from `config.json` into `workspace.settings.json` / `host.json` if not yet present.
    2. Hydrates the in-memory `cfg` dictionary so all runtime consumers (`is_extension_enabled`,
        hooks, and UI config endpoints) see the authoritative settings without polluting `config.json`.
    """
    wid = workspace_id or "default"
    settings = SettingsManager('system', wid)
    ws_filepath = settings._resolve_filepath('workspace')
    ws_data = load_json_config(ws_filepath, {})
    sys_ws_block = ws_data.get('system', {}) if isinstance(ws_data.get('system'), dict) else {}

    daemon_filepath = settings._resolve_filepath('daemon')
    daemon_data = load_json_config(daemon_filepath, {})
    sys_daemon_block = daemon_data.get('system', {}) if isinstance(daemon_data.get('system'), dict) else {}
    ws_dirty = False
    if "extensions" not in sys_ws_block and "extensions" in cfg and isinstance(cfg["extensions"], list):
        ext_list = list(cfg["extensions"])
        if "config" not in ext_list:
            ext_list.insert(0, "config")
        sys_ws_block["extensions"] = ext_list
        ws_dirty = True

    if "instance_title" not in sys_ws_block and "instance_title" in cfg and cfg["instance_title"]:
        sys_ws_block["instance_title"] = cfg["instance_title"]
        ws_dirty = True

    if "instance_emoji" not in sys_ws_block and "instance_emoji" in cfg and cfg["instance_emoji"]:
        sys_ws_block["instance_emoji"] = cfg["instance_emoji"]
        ws_dirty = True
    if ws_dirty and ws_filepath:
        ws_data["system"] = sys_ws_block
        save_json_config(ws_filepath, ws_data, workspace_id=wid)

    if "port" not in daemon_data and "port" not in sys_daemon_block and "port" in cfg and cfg["port"] is not None:
        daemon_data["port"] = cfg["port"]
        if daemon_filepath:
            save_json_config(daemon_filepath, daemon_data, workspace_id="default")
    raw_exts = sys_ws_block.get("extensions") or settings.get("extensions", ["config"]) or ["config"]
    resolved_exts = list(raw_exts)
    if "config" not in resolved_exts:
        resolved_exts.insert(0, "config")
    cfg["extensions"] = resolved_exts
    cfg["instance_title"] = sys_ws_block.get("instance_title") or settings.get("instance_title", "inSetu Workbench")
    cfg["instance_emoji"] = sys_ws_block.get("instance_emoji") or settings.get("instance_emoji", "⚙️")
    cfg["port"] = daemon_data.get("port") or sys_daemon_block.get("port") or settings.get("port", 5005)
    # Auto-heal blank domain strings ("") on target_repos and sub_buckets so they inherit parent repo domain
    normalize_repo_domains(cfg.get("target_repos"))


@system_bp.on('request_vfs_ignore_dirs')
def provide_vfs_ignores(workspace_id=None, **kwargs):
    """Host application declaration of directories the VFS should never traverse natively."""
    return ['.git', 'node_modules', '__pycache__', 'venv']
@system_bp.bp.route('/api/system/openapi.json', methods=['GET'])
def api_system_openapi():
    """Phase 3 Tool Calling: Generates a real-time OpenAPI 3.0 specification from mounted SDK routes."""
    from flask import current_app as _current_app

    paths = {}
    # 1. Manually inject the bootstrap route since it lives outside the standard extension SDK
    paths["/auth/bootstrap"] = {
        "post": {
            "summary": "Authenticate and retrieve runtime token",
            "description": "Exchanges a Tailscale identity or static config token for an active execution token.",
            "security": [],
            "requestBody": {
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "properties": {"token": {"type": "string", "description": "Optional static auth token from config.json"}}
                        }
                    }
                }
            },
            "responses": {
                "200": {
                    "description": "Returns the active token.",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "status": {"type": "string"},
                                    "token": {"type": "string", "description": "The X-InSetu-Token to use in subsequent requests."}
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    paths["/api/system/stream"] = {
        "get": {
            "summary": "Server-Sent Events (SSE) Telemetry",
            "description": "Zero-latency UI updates for job progress and VFS mutations.",
            "parameters": [
                {"name": "token", "in": "query", "required": True, "schema": {"type": "string"}}
            ],
            "responses": {
                "200": {
                    "description": "Returns a text/event-stream.",
                    "content": {"text/event-stream": {"schema": {"type": "string"}}}
                }
            }
        }
    }

    paths["/api/system/panic"] = {
        "post": {
            "summary": "Simulate Kernel Panic",
            "description": "Hard reboot of the OS process, setting the simulated panic flag.",
            "responses": {
                "200": {
                    "description": "Initiating kernel panic.",
                    "content": {"application/json": {"schema": {"type": "object", "properties": {"status": {"type": "string"}, "message": {"type": "string"}}}}}
                }
            }
        }
    }
    # 2. Iterate through all registered Blueprints looking for our Akasa SDK 'route_schemas'
    for bp_name, bp in _current_app.blueprints.items():
        if not hasattr(bp, 'route_schemas'):
            continue
        for url_rule, method_schemas in bp.route_schemas.items():
            path_item = {}
            # Extract path parameters from Werkzeug rule string (e.g. /api/<workspace_id>/...)
            path_vars = re.findall(r'<([^>:]+:)?([^>]+)>', url_rule)
            openapi_url = re.sub(r'<([^>:]+:)?([^>]+)>', r'{\2}', url_rule)
            for method, meta in method_schemas.items():
                method_lower = method.lower()
                if method_lower == "options": continue
                raw_doc = meta.get("docstring") or f"Endpoint for {bp_name}"
                is_async_mutation = "[sync]" not in raw_doc
                clean_doc = raw_doc.replace("[sync]", "").strip()

                url_base_name = url_rule.rsplit('/', 1)[1] if '/' in url_rule else url_rule
                op_data = {
                    "summary": f"{bp_name} {url_base_name.replace('<', '').replace('>', '').replace(':', '_')}",
                    "description": clean_doc,
                    "responses": {}
                }

                # Hydrate 200 OK Response
                if meta.get("response_schema"):
                    op_data["responses"]["200"] = {
                        "description": "Successful operation.",
                        "content": {
                            "application/json": {
                                "schema": typeddict_to_openapi(meta["response_schema"])
                            }
                        }
                    }
                elif method_lower == "get" and url_base_name in ["fetch", "resolve"]:
                    # Prevent JSON parse crashes for raw text endpoints
                    op_data["responses"]["200"] = {
                        "description": "Returns raw text/markdown content.",
                        "content": {
                            "text/plain": {"schema": {"type": "string"}}
                        }
                    }
                else:
                    op_data["responses"]["200"] = {
                        "description": "Successful operation.",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "additionalProperties": True,
                                    "properties": {
                                        "status": {"type": "string"},
                                        "message": {"type": "string"},
                                        "error": {"type": "string"}
                                    }
                                }
                            }
                        }
                    }

                # Only attach 202 Background Job schemas to POST/PUT/DELETE mutations if not explicitly disabled
                if method_lower in ["post", "put", "delete"] and is_async_mutation:
                    op_data["responses"]["202"] = {
                        "description": "Asynchronous job accepted. You MUST poll /api/{workspace_id}/system/jobs/{job_id} until the 'status' is 'completed' or 'failed'.",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "status": {"type": "string"},
                                        "job_id": {"type": "string"}
                                    },
                                    "required": ["status", "job_id"]
                                }
                            }
                        }
                    }

                parameters = []
                # Inject Path Parameters automatically
                for _, var_name in path_vars:
                    parameters.append({
                        "name": var_name,
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"}
                    })
                # Hydrate Request Schema if bound
                if meta.get("request_schema"):
                    schema_dict = typeddict_to_openapi(meta["request_schema"])
                    if method_lower == "get":
                        for prop_name, prop_details in schema_dict.get("properties", {}).items():
                            parameters.append({
                                "name": prop_name,
                                "in": "query",
                                "required": prop_name in schema_dict.get("required", []),
                                "schema": prop_details
                            })
                    else:
                        content_type = "application/json"
                        def has_binary(schema):
                            if schema.get("format") == "binary": return True
                            for prop in schema.get("properties", {}).values():
                                if prop.get("format") == "binary": return True
                                if prop.get("type") == "array" and prop.get("items", {}).get("format") == "binary": return True
                            return False

                        if has_binary(schema_dict):
                            content_type = "multipart/form-data"

                        op_data["requestBody"] = {
                            "content": {
                                content_type: {
                                    "schema": schema_dict
                                }
                            }
                        }

                if parameters:
                    op_data["parameters"] = parameters

                path_item[method_lower] = op_data

            paths[openapi_url] = path_item
    spec = {
        "openapi": "3.0.0",
        "info": {
            "title": "inSetu Workbench API",
            "version": "1.0.0",
            "description": "Automated LLM Tool Calling Specification"
        },
        "paths": paths,
        "components": {
            "securitySchemes": {
                "InSetuToken": {
                    "type": "apiKey",
                    "in": "header",
                    "name": "X-InSetu-Token",
                    "description": "Execution credential required for API access."
                }
            }
        },
        "security": [
            {
                "InSetuToken": []
            }
        ]
    }

    return jsonify(spec)
class DeltasQueryPayload(TypedDict):
    since: float
class SystemDeltasResponse(TypedDict):
    timestamp: float
    backend_boot_ts: float
    is_pipeline_active: bool
    active_modules: List[str]
    pending_modules: List[str]
    mutations: List[Dict[str, Any]]
    signatures: Dict[str, Any]
@system_bp.route('deltas', methods=['GET'], request_schema=DeltasQueryPayload, response_schema=SystemDeltasResponse, docstring="Returns real-time file mutation logs, active/pending background compilation modules, and domain signatures modified since the 'since' timestamp.")
def api_system_deltas(ctx):
    since = float(ctx.payload.get('since', 0.0))
    return get_system_deltas(ctx.workspace_id, since_ts=since)

class PipelineSubmitPayload(TypedDict, total=False):
    force_full: bool
    target_repos: List[str]
    start_step: str
@system_bp.route('pipeline/submit', methods=['POST'], request_schema=PipelineSubmitPayload, docstring="Triggers the background context compilation sequence. Handles differential deltas or full sweeps via the Akasa DAG Orchestrator.")
def api_system_pipeline_submit(ctx):
    try:
        data = ctx.payload or {}
        force_full = bool(data.get("force_full", False))
        # Reattach check: Attach to any active stage of the compilation pipeline to prevent concurrent chain collisions.
        ordered_steps = ctx.resolve_dag_chain('register_compilation_steps')

        start_step = data.get("start_step")
        upstream_worker_names = []

        if start_step:
            try:
                start_idx = next(i for i, s in enumerate(ordered_steps) if s['id'] == start_step)
                # Filter to upstream workers (including the start_step itself) that cascade down to our target
                upstream_worker_names = [s.get('worker_name') for s in ordered_steps[:start_idx + 1] if s.get('worker_name')]
                ordered_steps = ordered_steps[start_idx:]
            except StopIteration:
                upstream_worker_names = [s.get('worker_name') for s in ordered_steps if s.get('worker_name')]
        else:
            upstream_worker_names = [s.get('worker_name') for s in ordered_steps if s.get('worker_name')]
        active_job_id = ctx.jobs.find_active_pipeline_job(
            upstream_worker_names,
            predicate=lambda job_args: bool(job_args.get("force_full") or not force_full),
        )
        if active_job_id:
            return {"status": "accepted", "job_id": active_job_id, "message": "Reattached to active compilation."}, 202
        if not ordered_steps:
            return {"error": "No compilation steps registered."}, 400

        payload = {"force_full": force_full}
        if "target_repos" in data:
            payload["target_repos"] = data["target_repos"]

        job_id = ctx.jobs.submit_chain(
            ordered_steps, 
            on_complete_hook="compilation_sequence_complete", 
            job_category="ui_blocking", 
            **payload
        )

        return {"status": "accepted", "job_id": job_id}, 202
    except Exception as e:
        traceback.print_exc()
        return {"status": "error", "error": f"Pipeline Dispatch Error ({type(e).__name__}): {str(e)}"}, 500
@system_bp.on('pre_file_save')
def handle_config_pre_save(workspace_id=None, filepath=None, content=None, data=None, **kwargs):
    if data and data.get("is_new_repo") and data.get("repo_dir"):
        repo_dir = data.get("repo_dir")
        from insetu.core.utils_core import sanitize_workspace_config as _sanitize_workspace_config, get_default_repo_template as _get_default_repo_template
        cfg_path, _ = get_workspace_physics(workspace_id)
        cfg = load_json_config(cfg_path, {})
        cfg = _sanitize_workspace_config(cfg)

        targets = cfg.get("target_repos", [])
        if not any(r.get("repo_dir") == repo_dir for r in targets):
            ext_str = data.get("repo_exts", "")
            exts = [e.strip() for e in ext_str.split(",") if e.strip()] if ext_str else None

            new_repo = _get_default_repo_template(
                repo_dir=repo_dir,
                title=data.get("repo_title"),
                domain=data.get("repo_domain"),
                description=data.get("repo_desc"),
                exts=exts
            )
            targets.append(new_repo)
            cfg["target_repos"] = targets
            save_json_config(cfg_path, cfg, workspace_id)
def get_system_config(workspace_id):
    data = load_config(workspace_id)
    script_dir = Path(__file__).resolve().parent.as_posix()
    core_modules_set = get_core_modules()
    available_ids = set()
    available = []
    extensions_dir = Path(script_dir).parent.parent.joinpath("extensions").as_posix()
    if os.path.exists(extensions_dir):
            for item in os.listdir(extensions_dir):
                    item_path = Path(extensions_dir).joinpath(item).as_posix()

                    ext_name = None
                    if os.path.isdir(item_path):
                            # Bundled topology (ADR 0012)
                            if os.path.exists(Path(item_path).joinpath(f"engine_{item}.py").as_posix()):
                                    ext_name = item
                    elif item.startswith("engine_") and item.endswith(".py"):
                            # Legacy flat topology
                            ext_name = item.replace("engine_", "").replace(".py", "")
                    if ext_name and ext_name not in core_modules_set and ext_name not in available_ids:
                            available_ids.add(ext_name)
                            title = ext_name.replace('_', ' ').title()
                            desc = ""
                            mod, bp_obj, err = _inspect_or_resolve_extension_meta(ext_name, item_path)
                            missing_exts = []
                            missing_bins = []
                            if err:
                                    title = f"⚠️ {title} (Broken)"
                                    desc = f"Failed to load: {err}"
                            elif bp_obj:
                                    title = getattr(bp_obj, 'title', None) or title
                                    desc = getattr(bp_obj, 'description', None) or desc
                                    raw_deps = list(getattr(bp_obj, 'external_dependencies', None) or [])
                                    seen_pkgs = set()
                                    for dep in raw_deps:
                                            import_spec, pypi_pkg = resolve_external_dependency_spec(dep)
                                            if not import_spec or pypi_pkg in seen_pkgs:
                                                    continue
                                            seen_pkgs.add(pypi_pkg)
                                            if importlib.util.find_spec(import_spec) is None:
                                                    missing_exts.append(pypi_pkg)

                                    raw_bins = list(getattr(bp_obj, 'external_binaries', None) or [])
                                    seen_bins = set()
                                    for binary in raw_bins:
                                            if not binary or binary in seen_bins:
                                                    continue
                                            seen_bins.add(binary)
                                            if not shutil.which(binary):
                                                    missing_bins.append(binary)
                            available.append({"id": ext_name, "title": title, "description": desc, "missing_externals": missing_exts, "missing_binaries": missing_bins})
    from flask import current_app as _current_app
    # Approved workspace extensions that are running can be enabled per workspace like bundled ones.
    for ws_ext in sorted(getattr(_current_app, "_loaded_workspace_extensions", {})):
        if ws_ext in available_ids:
            continue
        ws_bp = getattr(sys.modules.get(f"insetu.extensions.{ws_ext}.engine_{ws_ext}"), f"{ws_ext}_bp", None)
        available_ids.add(ws_ext)
        available.append({
            "id": ws_ext,
            "title": f"{getattr(ws_bp, 'title', None) or ws_ext.replace('_', ' ').title()} (workspace)",
            "description": getattr(ws_bp, 'description', None) or "Approved extension from .insetu/extensions/.",
            "missing_externals": [],
            "missing_binaries": [],
        })
    # akasa materializes callable schemas, options and defaults with the workspace id (akasa >= 0.7).
    evaluated_schemas = get_registered_settings_schemas(workspace_id)
    mounted_extensions = [ext for ext in data.get("extensions", []) if ext == "config" or ext in _current_app.blueprints]

    quarantined_modules = getattr(_current_app, "_quarantined_modules", {})
    return {
        "config": data,
        "meta": {
            "mounted_extensions": mounted_extensions,
            "available_extensions": sorted(available, key=lambda x: x.get('title') or ""),
            "settings_schemas": evaluated_schemas,
            "core_modules": list(core_modules_set),
            "quarantined_modules": quarantined_modules,
            "degraded_core": bool(getattr(_current_app, "_degraded_core", False)),
        }
    }
def save_system_config(workspace_id, payload):
    cfg_path, _ = get_workspace_physics(workspace_id)
    existing_cfg = load_json_config(cfg_path, {})
    merged_cfg = {**existing_cfg, **payload}

    settings = SettingsManager('system', workspace_id)
    settings_updates = {}

    if "extensions" in payload and isinstance(payload["extensions"], list):
        ext_list = list(payload["extensions"])
        if "config" not in ext_list:
            ext_list.insert(0, "config")
        settings_updates["extensions"] = ext_list

    for ws_key in ("instance_title", "instance_emoji", "port"):
        if ws_key in payload and payload[ws_key] is not None:
            settings_updates[ws_key] = payload[ws_key]

    if settings_updates:
        settings.update(settings_updates)

    from insetu.core.utils_core import sanitize_workspace_config as _sanitize_workspace_config

    merged_cfg = _sanitize_workspace_config(merged_cfg)
    save_json_config(cfg_path, merged_cfg, workspace_id)

    # Emits a globally decoupled config invalidation event
    hooks.emit('config_mutated', workspace_id=workspace_id)
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


class ExtensionInstallDepsPayload(TypedDict):
    ext_name: str
@system_bp.route('extensions/install_deps', methods=['POST'], request_schema=ExtensionInstallDepsPayload, docstring="Installs declared external Python dependencies for a target extension into the active daemon environment.")
def api_system_install_extension_deps(ctx):
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


class WorkspaceExtensionApprovePayload(TypedDict):
    name: str
    fingerprint: str


class WorkspaceExtensionRevokePayload(TypedDict):
    name: str


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


@system_bp.route('extensions/workspace', methods=['GET'], docstring="[sync] Lists the extensions in .insetu/extensions/ with their approval status and the files changed since approval.")
def api_workspace_extensions(ctx):
    return {"status": "success", "extensions": _workspace_extensions_report()}


@system_bp.route('extensions/workspace/approve', methods=['POST'], request_schema=WorkspaceExtensionApprovePayload, mcp_expose=False, docstring="[sync] Records a person's approval of a workspace extension's exact files; it loads at the next restart. Human-only: hidden from MCP and banned in routines (S8).")
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


@system_bp.route('extensions/workspace/revoke', methods=['POST'], request_schema=WorkspaceExtensionRevokePayload, mcp_expose=False, docstring="[sync] Removes a person's approval of a workspace extension; it stops loading at the next restart. Human-only (S8).")
def api_workspace_extension_revoke(ctx):
    name = str((ctx.payload or {}).get("name") or "").strip()
    if not revoke_workspace_extension(name):
        return {"status": "error", "error": f"'{name}' is not approved."}, 404
    return {"status": "revoked", "name": name, "requires_reboot": True}


class ProtectedChangeConfirmPayload(TypedDict):
    change_id: str
    result_hash: str


class ProtectedChangeDiscardPayload(TypedDict):
    change_id: str


@system_bp.route('protected/pending', methods=['GET'], docstring="[sync] Lists changes to protected files that wait for a person's confirmation, each with the file as it is now and whether it changed since the proposal (S8).")
def api_protected_pending(ctx):
    return {"status": "success", "changes": _protected_changes.list_pending()}


@system_bp.route('protected/confirm', methods=['POST'], request_schema=ProtectedChangeConfirmPayload, mcp_expose=False, docstring="[sync] Writes a pending protected change. result_hash must be the hash of the content the person reviewed, and the file must be unchanged since the proposal. Human-only: hidden from MCP and banned in routines (S8).")
def api_protected_confirm(ctx):
    data = ctx.payload or {}
    return _protected_changes.confirm(str(data.get("change_id") or ""), str(data.get("result_hash") or ""))


@system_bp.route('protected/discard', methods=['POST'], request_schema=ProtectedChangeDiscardPayload, mcp_expose=False, docstring="[sync] Drops a pending protected change without writing it. Human-only (S8).")
def api_protected_discard(ctx):
    return _protected_changes.discard(str((ctx.payload or {}).get("change_id") or ""))


class DirectivesQueryPayload(TypedDict, total=False):
    repo: str


class DirectivesAcceptPayload(TypedDict):
    repo: str
    digest: str


class DirectivesRevokePayload(TypedDict):
    repo: str


class DirectivesSavePayload(TypedDict, total=False):
    tier: str
    repo: str
    content: str


@system_bp.route('directives', methods=['GET'], request_schema=DirectivesQueryPayload, docstring="[sync] Returns the four directive tiers (user, workspace, repo_shared, repo_local), their acceptance status, and any diff against accepted text.")
def api_directives_get(ctx):
    """Returns the four directive tiers for a repository (or the first mounted repository when omitted)."""
    repo = str((ctx.payload or {}).get("repo") or "").strip() or None
    return get_directives(ctx, repo=repo)


@system_bp.route('directives/save', methods=['POST'], request_schema=DirectivesSavePayload, mcp_expose=False, docstring="[sync] Human-only editor save for a directive tier ('user', 'workspace', 'repo_shared', 'repo_local'). Marks the write as an editor save so a person's own edit writes immediately.")
def api_directives_save(ctx):
    """Saves a directive tier document from the Settings Hub with EDITOR_SOURCE so UI saves write directly."""
    data = ctx.payload or {}
    tier = str(data.get("tier") or "").strip().lower()
    repo = str(data.get("repo") or "").strip() or None
    content = str(data.get("content") if data.get("content") is not None else "")
    if tier not in DIRECTIVE_TIERS:
        return {"error": f"Invalid directive tier '{tier}'. Expected one of {', '.join(DIRECTIVE_TIERS)}."}, 400
    target_uri = resolve_directive_tier_uri(tier, repo=repo)
    if not target_uri:
        return {"error": f"Tier '{tier}' requires a valid repository name."}, 400
    if tier == "repo_local" and repo:
        ensure_local_settings_gitignored(ctx, repo)
    res = ctx.vfs.save(target_uri, content, data={_protected_changes.SOURCE_KEY: _protected_changes.EDITOR_SOURCE})
    if isinstance(res, dict) and res.get("protected") and res.get("status") != "accepted":
        code = 202 if res.get("status") == "pending_confirmation" else int(res.get("status_code") or 403)
        return res, code
    return {"status": "success", "uri": target_uri, "directives": get_directives(ctx, repo=repo)}


@system_bp.route('directives/accept', methods=['POST'], request_schema=DirectivesAcceptPayload, mcp_expose=False, docstring="[sync] Human-only: accepts a shared repository's directives by exact content digest. Refuses stale digests (409) and machine origins (403).")
def api_directives_accept(ctx):
    """Records a person's acceptance of `vfs://<repo>/.insetu-data/settings/agent.md` at the reviewed digest."""
    data = ctx.payload or {}
    repo = str(data.get("repo") or "").strip()
    digest = str(data.get("digest") or "").strip()
    if not repo or not digest:
        return {"error": "Both 'repo' and 'digest' are required."}, 400

    uri = resolve_directive_tier_uri("repo_shared", repo=repo)
    raw_content = ctx.vfs.read(uri) if uri else None
    if raw_content is None:
        return {"error": f"No shared repository directives file found at {uri}."}, 404

    _, body, _ = parse_frontmatter(raw_content)
    clean_body = (body or "").strip()
    actual_digest = _attestations.digest_of(clean_body)
    if actual_digest != digest:
        return {
            "error": "The repository directives file changed after you reviewed it. Review the updated text before accepting.",
            "expected_digest": actual_digest,
        }, 409

    subject = f"{ctx.workspace_id}|{repo}"
    try:
        _attestations.attest("repo_directive", subject, digest, detail={"repo": repo, "body": clean_body})
    except _attestations.AttestationRefused as exc:
        return {"error": str(exc)}, 403
    return {"status": "accepted", "repo": repo, "digest": digest, "directives": get_directives(ctx, repo=repo)}


@system_bp.route('directives/revoke', methods=['POST'], request_schema=DirectivesRevokePayload, mcp_expose=False, docstring="[sync] Human-only: revokes acceptance of a shared repository's directives.")
def api_directives_revoke(ctx):
    """Revokes a person's acceptance of a repository's shared directives."""
    repo = str((ctx.payload or {}).get("repo") or "").strip()
    if not repo:
        return {"error": "repo is required."}, 400
    subject = f"{ctx.workspace_id}|{repo}"
    revoked = _attestations.revoke("repo_directive", subject)
    return {"status": "revoked" if revoked else "noop", "repo": repo, "directives": get_directives(ctx, repo=repo)}


@system_bp.route('reboot', methods=['POST'], docstring="[sync] Clean in-place process replacement to restart the OS daemon.")
def api_system_reboot(ctx):
    """Clean in-place process replacement to restart the OS daemon."""
    def restart():
        try: hooks.emit('system_shutdown')
        except Exception: pass
        time.sleep(0.5)
        os.environ["MALLOC_ARENA_MAX"] = "2"
        os.environ.pop("WERKZEUG_RUN_MAIN", None)
        os.environ.pop("WERKZEUG_SERVER_FD", None)
        python_exe = sys.executable
        os.execv(python_exe, [python_exe] + sys.argv)

    threading.Thread(target=restart, daemon=True).start()
    return {"status": "success", "message": "Rebooting inSetu OS..."}
class SystemConfigPayload(TypedDict, total=False):
    extensions: List[str]
    target_repos: List[Dict[str, Any]]
@system_bp.route('config', methods=['GET', 'POST'], request_schema={"POST": SystemConfigPayload}, docstring="[sync] Retrieves or updates the global workspace configuration.")
def api_system_config(ctx):
    try:
        is_post = ctx.method == 'POST' or bool(ctx.payload and ("extensions" in ctx.payload or "target_repos" in ctx.payload))
        if not is_post:
            return get_system_config(ctx.workspace_id)
        else:
            payload = ctx.payload or {}

            from flask import current_app as _current_app
            requires_reboot = False
            for ext in payload.get("extensions", []):
                if ext != "config" and ext not in _current_app.blueprints:
                    requires_reboot = True

            save_system_config(ctx.workspace_id, payload)
            return {
                "status": "success", 
                "message": "Configuration saved successfully.", 
                "requires_reboot": requires_reboot
            }
    except Exception as e:
        print(f"Config Route Error: {traceback.format_exc()}")
        return {"error": f"Server Error: {str(e)}"}, 500
class TopologyResponse(TypedDict):
    repos: List[str]
    port: int
    term_port: int
    target_repos: List[Dict[str, Any]]
    virtual_contexts: List[Dict[str, Any]]
    category_order: List[str]
    tab_order: List[str]
    hidden_outputs: List[str]
    config_missing: bool
@system_bp.route('topology', methods=['GET'], response_schema=TopologyResponse, docstring="Retrieves current workspace bounds, registered repository paths, UI category ordering, and active ports.")
def api_system_topology(ctx):
    try:
        from insetu.core.utils_core import get_sister_repos as _get_sister_repos
        cfg = load_config(ctx.workspace_id)
        target_repos = copy.deepcopy(cfg.get("target_repos", []) or [])
        cfg_path, ws_root = get_workspace_physics(ctx.workspace_id)

        for c in target_repos:
            if not c: continue
            r_dir = c.get("repo_dir", "")
            for b in (c.get("sub_buckets") or []):
                if b and b.get("dynamic_split_prefix"):
                    if "meta_map" not in b:
                        b["meta_map"] = {}
                    dyn_dir = Path(ws_root).joinpath(r_dir, b["dynamic_split_prefix"]).as_posix()
                    if os.path.exists(dyn_dir):
                        for module in os.listdir(dyn_dir):
                            if os.path.isdir(Path(dyn_dir).joinpath(module).as_posix()) and not module.startswith('.'):
                                if module not in b["meta_map"]:
                                    b["meta_map"][module] = {"title": module.replace('_', ' ').title()}
        from flask import current_app as _current_app
        quarantined_modules = getattr(_current_app, "_quarantined_modules", {})
        return {
            "repos": _get_sister_repos(ctx.workspace_id),
            "port": int(os.environ.get("INSETU_PORT", cfg.get("port", 5005))),
            "term_port": cfg.get("term_port", 8181),
            "target_repos": target_repos or [],
            "virtual_contexts": cfg.get("virtual_contexts", []),
            "category_order": cfg.get("category_order", []),
            "tab_order": cfg.get("tab_order", ["context", "edit", "tasks", "ctrl", "library"]),
            "hidden_outputs": cfg.get("hidden_outputs", ["ctx://contexts/context_prompt.md", "ctx://diffs/context_prompt_diffs.txt"]),
            "config_missing": not os.path.exists(cfg_path),
            "quarantined_modules": quarantined_modules,
            "degraded_core": bool(getattr(_current_app, "_degraded_core", False)),
            "workspace_extensions": {
                name: {k: entry.get(k) for k in ("id", "status", "reason", "loaded")}
                for name, entry in getattr(_current_app, "_workspace_extensions", {}).items()
            },
            "protected_changes_pending": _protected_changes.count_pending(),
        }
    except Exception as e:
        print(f"Topology Route Error: {traceback.format_exc()}")
        return {"error": f"Server Error: {str(e)}"}, 500
class ManifestResponse(TypedDict):
    vfs: Dict[str, Any]
    ctx: Dict[str, Any]
@system_bp.route('manifest', methods=['GET'], response_schema=ManifestResponse, docstring="Returns the twin single-source-of-truth manifests: 'vfs' (physical file bucket mapping) and 'ctx' (compiled context tree mapping).")
def api_system_manifest(ctx):
    headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
    ctx_manifest = ctx.emit_first('request_manifest', default={})
    vfs_manifest = ctx.emit_first('request_vfs_manifest', default={})
    # Heal any cached manifest entries whose meta.domain was stored as an empty string ("")
    target_repos = load_config(ctx.workspace_id).get("target_repos") or []
    for entry in (ctx_manifest or {}).values():
        heal_manifest_entry_domain(entry, target_repos=target_repos)

    return {"vfs": vfs_manifest, "ctx": ctx_manifest}, 200, headers
class WorkspaceCreatePayload(TypedDict):
    id: str
    workspace_root: str
@system_bp.route('workspaces/create', methods=['POST'], request_schema=WorkspaceCreatePayload, docstring="[sync] Provisions and mounts an isolated workspace.")
def api_create_workspace(ctx):
    try:
        data = ctx.payload or {}
        ws_id = str(data.get('id') or '').strip().lower()
        if not ws_id or ws_id in ['default', 'none']:
            return {"error": "A unique, valid alphanumeric workspace ID is required"}, 400
        index_path = get_system_index_path()

        w_data = load_json_config(index_path, {"workspaces": {"default": {"config_path": "config.json"}}})
        if "workspaces" not in w_data:
            w_data["workspaces"] = {"default": {"config_path": "config.json"}}

        if ws_id in w_data.get("workspaces", {}):
            return {"error": f"Workspace '{ws_id}' already exists"}, 400
        custom_root = str(data.get('workspace_root') or '').strip()
        if not custom_root:
            return {"error": "Workspace Root Directory Path is strictly required to ensure absolute codebase isolation."}, 400
        resolved_root = os.path.abspath(os.path.expanduser(custom_root))

        ws_insetu_dir = Path(resolved_root).joinpath(".insetu")
        os.makedirs(ws_insetu_dir.joinpath("data").as_posix(), exist_ok=True)
        config_abs_path = ws_insetu_dir.joinpath("config.json").as_posix()
        config_rel_path = config_abs_path
        starter_config = {
            "workspace_root": resolved_root,
            "ignore_dirs": ["node_modules", "__pycache__", "venv", ".git", ".insetu"]
        }
        os.makedirs(starter_config["workspace_root"], exist_ok=True)

        # 1. Register workspace in system.json FIRST to satisfy get_workspace_physics bounds checking
        if "workspaces" not in w_data:
            w_data["workspaces"] = {}
        w_data["workspaces"][ws_id] = {"title": ws_id.title(), "config_path": config_rel_path}

        # Use save_json_config to ensure _JSON_CACHE is updated synchronously for immediate reads
        save_json_config(index_path, w_data, workspace_id="default")
        # 2. Save the pure topology mapping
        save_json_config(config_abs_path, starter_config, workspace_id=ws_id)
        # 3. Seed the Tier 2 Workspace Settings safely
        settings = SettingsManager('system', ws_id)
        settings.update({
            "instance_title": f"inSetu Workspace: {ws_id}",
            "instance_emoji": "⚙️",
            "extensions": ["config"]
        })
        # 4. Provision databases and trigger the boot sequence for the new workspace
        provision_workspace_schemas(ws_id)
        hooks.emit('workspace_boot', workspace_id=ws_id)

        return {"status": "success", "workspaces": w_data["workspaces"]}
    except Exception as e:
        print(f"Workspace Create Error: {traceback.format_exc()}")
        return {"error": f"Server Error: {str(e)}"}, 500
class WorkspaceDeletePayload(TypedDict):
    id: str
@system_bp.route('workspaces/delete', methods=['POST'], request_schema=WorkspaceDeletePayload, docstring="[sync] Permanently deletes a workspace and its tracking metadata.")
def api_delete_workspace(ctx):
    try:
        data = ctx.payload or {}
        ws_id = str(data.get('id') or '').strip().lower()
        if ws_id == 'default':
            return {"error": "The root system default workspace framework cannot be deleted."}, 400
        index_path = get_system_index_path()

        w_data = load_json_config(index_path, {"workspaces": {"default": {"config_path": "config.json"}}})
        if "workspaces" not in w_data:
            w_data["workspaces"] = {"default": {"config_path": "config.json"}}

        if ws_id not in w_data.get("workspaces", {}):
            return {"error": "Target workspace not found."}, 404
        del w_data["workspaces"][ws_id]
        hooks.emit('workspace_shutdown', workspace_id=ws_id)
        local_insetu_dir = Path(get_daemon_cwd()).joinpath(".insetu").as_posix()
        ws_dir = Path(local_insetu_dir).joinpath("workspaces", ws_id)
        if os.path.exists(ws_dir.as_posix()):
            execute_vfs_delete("default", ws_dir.as_posix())

        save_json_config(index_path, w_data, workspace_id="default")

        return {"status": "success", "workspaces": w_data["workspaces"]}
    except Exception as e:
        print(f"Workspace Delete Error: {traceback.format_exc()}")
        return {"error": f"Server Error: {str(e)}"}, 500
class JobStatusResponse(TypedDict):
    id: str
    ext_name: str
    status: str
    message: str
    artifact: Dict[str, Any]
@system_bp.route('jobs/<job_id>', methods=['GET'], response_schema=JobStatusResponse, docstring="Polls the status of an asynchronous background job using the job_id returned by a 202 Accepted response. Status will be 'pending', 'processing', 'completed', or 'failed'.")
def api_job_status(ctx, job_id):
    try:
        status_payload = ctx.jobs.get_status(job_id)
        if not status_payload:
            return {"error": "Job not found in active workspace context."}, 404
        return status_payload
    except Exception as e:
        return {"error": str(e)}, 500
class WorkspacesResponse(TypedDict):
    workspaces: Dict[str, Dict[str, str]]

class WorkspacesSwitchPayload(TypedDict):
    active_workspace: str
@system_bp.route('workspaces', methods=['GET', 'POST'], request_schema={"POST": WorkspacesSwitchPayload}, response_schema=WorkspacesResponse, docstring="[sync] GET lists all mounted tenant workspaces. POST validates and switches session context to a target 'active_workspace'.")
def api_workspaces(ctx):
    index_path = get_system_index_path()
    is_post = ctx.method == 'POST' or bool(ctx.payload and ("active_workspace" in ctx.payload or "workspace_id" in ctx.payload))

    if not is_post:
        data = load_json_config(index_path, {})
        if "workspaces" not in data:
            data["workspaces"] = {"default": {"config_path": "config.json"}}
        return data

    data = ctx.payload or {}
    new_active = data.get("active_workspace") or data.get("workspace_id")
    old_active = sniff_tenant_id()
    if not os.path.exists(index_path):
        return {"error": "workspaces.json not found."}, 404
    w_data = load_json_config(index_path, {})
    if new_active not in w_data.get("workspaces", {}) and new_active != "default":
        return {"error": "Workspace ID not found."}, 400

    if old_active and old_active != new_active:
        hooks.emit('workspace_shutdown', workspace_id=old_active)

    return {"status": "success", "message": f"Validated workspace {new_active}"}
@system_bp.route('config/test_bucketing', methods=['POST'], docstring="[sync] Dry-runs sub-bucket regex and folder matching for a repository.")
def api_system_config_test_bucketing(ctx):
    try:
        data = ctx.payload or {}
        repo_cfg = data.get("repo_cfg", {})

        cfg_path, ws_root = get_workspace_physics(ctx.workspace_id)
        repo_dir = repo_cfg.get("repo_dir")
        if not repo_dir:
            return {"error": "repo_dir missing"}, 400

        physical_path = repo_cfg.get("physical_path")
        repo_path = Path(physical_path).expanduser().resolve() if physical_path else Path(ws_root).joinpath(repo_dir).resolve()

        if not repo_path.exists():
            return {"error": f"Path not found: {repo_path}"}, 404

        from insetu.core.topology.engine_topology import get_valid_workspace_files as _get_valid_workspace_files, resolve_file_bucket as _resolve_file_bucket
        valid_files = _get_valid_workspace_files(repo_path.as_posix(), repo_cfg, ctx.workspace_id)

        sub_buckets = repo_cfg.get("sub_buckets", [])
        buckets_map = {}

        for f in valid_files:
            b, module = _resolve_file_bucket(f, sub_buckets, repo_dir=repo_dir)
            bucket_id = module if (b and module) else (b.get("id") if b else "main")

            if bucket_id not in buckets_map:
                buckets_map[bucket_id] = []
            buckets_map[bucket_id].append(f)

        return {"status": "success", "buckets": buckets_map}
    except Exception as e:
        print(f"Bucketing Test Error: {traceback.format_exc()}")
        return {"error": f"Server Error: {str(e)}"}, 500
class ListLocalResponse(TypedDict):
    current: str
    dirs: List[str]

@system_bp.route('fs/list_local', methods=['GET'], response_schema=ListLocalResponse, docstring="[sync] Stateless directory explorer that reads absolute host paths for workspace mounts.")
def api_list_local_host_dirs(ctx):
    """Stateless directory explorer that reads absolute host paths for workspace mounts."""
    target = str(ctx.payload.get('path') or '').strip()
    if not target:
        target = os.path.expanduser('~')
    else:
        target = os.path.abspath(os.path.expanduser(target))

    if not os.path.exists(target) or not os.path.isdir(target):
        target = os.path.expanduser('~')

    try:
        dirs = []
        for item in sorted(os.listdir(target)):
            if item.startswith('.') and item != '.insetu':
                continue
            if os.path.isdir(Path(target).joinpath(item).as_posix()):
                dirs.append(item)
        return {"current": target, "dirs": dirs}
    except Exception as e:
        return {"current": target, "dirs": [], "error": str(e)}, 500
@system_bp.route('memory', methods=['GET', 'POST'], docstring="[sync] Inspects backend RAM usage, internal caches, top Python object types, and optionally triggers GC + glibc malloc_trim or tracemalloc.")
def api_system_memory(ctx):
    action = ctx.payload.get('action')
    if action == 'trim':
        reclaim_process_memory()
    elif action == 'tracemalloc_start':
        if not tracemalloc.is_tracing():
            tracemalloc.start(10)
    elif action == 'tracemalloc_stop':
        if tracemalloc.is_tracing():
            tracemalloc.stop()

    # 1. OS Process Memory (/proc/self/status)
    proc_mem = {}
    if os.path.exists('/proc/self/status'):
        try:
            with open('/proc/self/status', 'r', encoding='utf-8') as f:
                for line in f:
                    if line.startswith(('VmRSS:', 'VmSize:', 'VmData:', 'VmPeak:', 'Threads:')):
                        k, v = line.split(':', 1)
                        proc_mem[k.strip()] = v.strip()
        except Exception:
            pass
    # 2. Internal Kernel Cache Telemetry
    caches_info = get_kernel_memory_telemetry()

    # 3. Top Python Object Types in GC
    type_counts = {}
    type_bytes = {}
    for obj in gc.get_objects():
        t_name = type(obj).__name__
        type_counts[t_name] = type_counts.get(t_name, 0) + 1
        try:
            type_bytes[t_name] = type_bytes.get(t_name, 0) + sys.getsizeof(obj)
        except Exception:
            pass

    top_by_size = sorted(type_bytes.items(), key=lambda x: x[1], reverse=True)[:15]
    top_objects = [
        {"type": t, "count": type_counts.get(t, 0), "shallow_mb": round(b / (1024 * 1024), 2)}
        for t, b in top_by_size
    ]

    # 4. Tracemalloc Snapshot (if enabled)
    trace_top = []
    if tracemalloc.is_tracing():
        snap = tracemalloc.take_snapshot()
        for stat in snap.statistics('lineno')[:15]:
            trace_top.append({
                "location": str(stat.traceback),
                "size_mb": round(stat.size / (1024 * 1024), 2),
                "count": stat.count
            })

    # 5. Live Thread Breakdown
    thread_groups = {}
    for t in threading.enumerate():
        t_label = f"{type(t).__name__}:{t.name.split('-')[0].split('_')[0]}"
        thread_groups[t_label] = thread_groups.get(t_label, 0) + 1
    threads_summary = [
        {"group": k, "count": v}
        for k, v in sorted(thread_groups.items(), key=lambda x: x[1], reverse=True)
    ]
    return {
        "process": proc_mem,
        "caches": caches_info,
        "threads": threads_summary,
        "top_object_types": top_objects,
        "tracemalloc_active": tracemalloc.is_tracing(),
        "tracemalloc_top": trace_top
    }