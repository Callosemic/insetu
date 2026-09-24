from pathlib import Path
import os
import sys
import json
import threading
import time
from typing import TypedDict, Optional, List, Dict, Any
from flask import request, jsonify
from akasa.utils import load_config, save_json_config, load_json_config, get_workspace_physics, sniff_tenant_id
import akasa.utils as utils
from akasa.hooks import hooks
from akasa.sync import get_system_deltas
from insetu.core.sdk import InSetuExtension
import insetu.core.system.legacy  # Mount one-off migration hooks

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
        "default": "inSetu Developer OS",
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
        "id": "offline_cache_limit_mb",
        "label": "Offline Cache Limit (MB)",
        "type": "number",
        "scope": "daemon",
        "default": 250,
        "description": "Maximum IndexedDB storage quota for VFS cache warming."
    }
]
system_bp = InSetuExtension(
    'system', __name__,
    title="Core OS",
    description="Core OS daemon and workspace environment configurations.",
    core=True,
    settings_schema=SYSTEM_SETTINGS_SCHEMA
)
@hooks.on('system_settings_updated')
def core_system_settings_updated(workspace_id=None, **kwargs):
    # Core OS settings (ports, titles, watchdogs) mandate an environment refresh
    return {"requires_refresh": True}
@hooks.on('execute_identity_handshake')
def host_identity_handshake(request=None, client_ip=None, config=None, **kwargs):
    """Tier 2 Core OS: Evaluates daemon-level host identity protocols (e.g., Tailscale WHOIS)."""
    if not request or not client_ip or not config: return None
    import os, socket, json

    user_email = request.headers.get('Tailscale-User-Login')

    if not user_email:
        # Fallback to Unix socket WHOIS for direct Tailnet IP connections
        sock_path = "/var/run/tailscale/tailscaled.sock"
        if os.path.exists(sock_path):
            try:
                payload = f"GET /localapi/v0/whois?ip={client_ip} HTTP/1.1\r\nHost: local-tailscaled.sock\r\n\r\n"
                s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                s.settimeout(0.5)
                s.connect(sock_path)
                s.sendall(payload.encode('utf-8'))

                response = b""
                while True:
                    chunk = s.recv(4096)
                    if not chunk: break
                    response += chunk
                s.close()

                if b"\r\n\r\n" in response:
                    body = response.split(b"\r\n\r\n", 1)[1]
                    profile = json.loads(body.decode('utf-8'))
                    user_email = profile.get("UserProfile", {}).get("LoginName")
            except Exception:
                pass

    if user_email:
        allowed_emails = config.get("allowed_dev_emails", [])
        # Trust On First Use (TOFU)
        if not allowed_emails:
            from akasa.utils import get_workspace_physics, load_json_config, save_json_config
            cfg_path, _ = get_workspace_physics()
            raw_cfg = load_json_config(cfg_path, {})
            raw_cfg["allowed_dev_emails"] = [user_email]
            save_json_config(cfg_path, raw_cfg)
            return {"status": "authenticated", "method": "tailscale_tofu", "user": user_email}
        elif user_email in allowed_emails:
            return {"status": "authenticated", "method": "tailscale", "user": user_email}

    return None
@hooks.on('request_vfs_ignore_dirs')
def provide_vfs_ignores(workspace_id=None, **kwargs):
    """Host application declaration of directories the VFS should never traverse natively."""
    return ['.git', 'node_modules', '__pycache__', 'venv']
@system_bp.bp.route('/api/system/openapi.json', methods=['GET'])
def api_system_openapi():
    """Phase 3 Tool Calling: Generates a real-time OpenAPI 3.0 specification from mounted SDK routes."""
    from flask import current_app
    from akasa.utils import typeddict_to_openapi
    import re

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
    paths["/download/{filename}"] = {
        "get": {
            "summary": "Universal Artifact Download Gateway",
            "description": "Downloads contexts, artifacts, and vault files from the physical workspace.",
            "parameters": [
                {
                    "name": "filename",
                    "in": "path",
                    "required": True,
                    "schema": {"type": "string"}
                }
            ],
            "responses": {
                "200": {
                    "description": "Returns the raw binary or text file.",
                    "content": {
                        "application/octet-stream": {"schema": {"type": "string", "format": "binary"}}
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
    for bp_name, bp in current_app.blueprints.items():
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

                op_data = {
                    "summary": f"{bp_name} {url_rule.split('/')[-1].replace('<', '').replace('>', '').replace(':', '_')}",
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
                elif method_lower == "get" and url_rule.split('/')[-1] in ["fetch", "resolve"]:
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
            "title": "inSetu Developer OS API",
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
    is_compiling: bool
    active_modules: List[str]
    pending_modules: List[str]
    mutations: List[Dict[str, Any]]
    signatures: Dict[str, Any]
@system_bp.route('deltas', methods=['GET'], request_schema=DeltasQueryPayload, response_schema=SystemDeltasResponse, docstring="Returns real-time file mutation logs, active/pending background compilation modules, and domain signatures modified since the 'since' timestamp.")
def api_system_deltas(ctx):
    since = float(ctx.req.args.get('since', 0.0))
    return jsonify(get_system_deltas(ctx.workspace_id, since_ts=since))

class PipelineSubmitPayload(TypedDict, total=False):
    force_full: bool
    target_repos: List[str]
    start_step: str

@system_bp.route('pipeline/submit', methods=['POST'], request_schema=PipelineSubmitPayload, docstring="Triggers the background context compilation sequence. Handles differential deltas or full sweeps via the Akasa DAG Orchestrator.")
def api_system_pipeline_submit(ctx):
    data = ctx.req.get_json(force=True, silent=True) or {}
    force_full = data.get("force_full", False)
    from akasa.db import get_connection
    w_conn = get_connection("workers", workspace_id=ctx.workspace_id)
    # Reattach check: Attach to any active stage of the compilation pipeline to prevent concurrent chain collisions.
    import time
    cutoff = time.time() - 300.0
    from akasa.workers import resolve_dag_chain
    ordered_steps = resolve_dag_chain(ctx, 'register_compilation_steps')

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

    if upstream_worker_names:
        placeholders = ", ".join(["?"] * len(upstream_worker_names))
        existing_job = w_conn.execute(
            f"SELECT id, args_json FROM immediate_jobs WHERE callback_name IN ({placeholders}) AND status IN ('pending', 'processing') AND updated_at > ?", 
            tuple(upstream_worker_names) + (cutoff,)
        ).fetchone()

        if existing_job:
            import json
            try:
                job_args = json.loads(existing_job['args_json'])
                # Safely merge if the active job satisfies our force_full requirement
                if job_args.get("force_full") or not force_full:
                    return jsonify({"status": "accepted", "job_id": existing_job['id'], "message": "Reattached to active compilation."}), 202
            except Exception:
                pass
    if not ordered_steps:
        return jsonify({"error": "No compilation steps registered."}), 400

    payload = {"force_full": force_full}
    if "target_repos" in data:
        payload["target_repos"] = data["target_repos"]

    job_id = ctx.jobs.submit_chain(
        ordered_steps, 
        on_complete_hook="compilation_sequence_complete", 
        job_category="ui_blocking", 
        **payload
    )

    return jsonify({"status": "accepted", "job_id": job_id}), 202
@hooks.on('pre_file_save')
def handle_config_pre_save(workspace_id=None, filepath=None, content=None, data=None, **kwargs):
    if data and data.get("is_new_repo") and data.get("repo_dir"):
        repo_dir = data.get("repo_dir")
        from akasa.utils import load_json_config, get_workspace_physics, save_json_config
        from insetu.core.utils_core import sanitize_workspace_config, get_default_repo_template
        cfg_path, _ = get_workspace_physics(workspace_id)
        cfg = load_json_config(cfg_path, {})
        cfg = sanitize_workspace_config(cfg)

        targets = cfg.get("target_repos", [])
        if not any(r.get("repo_dir") == repo_dir for r in targets):
            ext_str = data.get("repo_exts", "")
            exts = [e.strip() for e in ext_str.split(",") if e.strip()] if ext_str else None

            new_repo = get_default_repo_template(
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
    from akasa.utils import _CORE_MODULES as CORE_MODULES
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
                    if ext_name and ext_name not in CORE_MODULES and ext_name not in available_ids:
                            available_ids.add(ext_name)
                            title = ext_name.replace('_', ' ').title()
                            desc = ""
                            # Extract metadata from the mounted extension
                            import sys
                            err = None
                            mod = sys.modules.get(f"insetu.extensions.{ext_name}.engine_{ext_name}") or \
                                        sys.modules.get(f"insetu.extensions.engine_{ext_name}") or \
                                        sys.modules.get(f"insetu.engine_{ext_name}")

                            if not mod:
                                    import importlib
                                    def safe_import(target):
                                            try:
                                                    return importlib.import_module(target), None
                                            except ModuleNotFoundError as e:
                                                    if e.name == target.split('.')[-1] or e.name == target or (e.name and target.startswith(f"{e.name}.")):
                                                            return None, None
                                                    return None, f"Missing dependency: {e.name}"
                                            except Exception as e:
                                                    return None, str(e)

                                    for target in [
                                            f"insetu.extensions.{ext_name}.engine_{ext_name}",
                                            f"insetu.extensions.engine_{ext_name}",
                                            f"insetu.engine_{ext_name}"
                                    ]:
                                            mod, err = safe_import(target)
                                            if mod or err: break
                            missing_exts = []
                            if err:
                                    title = f"⚠️ {title} (Broken)"
                                    desc = f"Failed to load: {err}"
                            elif mod:
                                    bp_obj = getattr(mod, f"{ext_name}_bp", None)
                                    if bp_obj:
                                            title = getattr(bp_obj, 'title', title)
                                            desc = getattr(bp_obj, 'description', desc)
                                    for dep in getattr(mod, '__external_depends__', []):
                                            import importlib.util
                                            if importlib.util.find_spec(dep) is None:
                                                    missing_exts.append(dep)

                                    missing_bins = []
                                    for binary in getattr(mod, '__external_binaries__', []):
                                            import shutil
                                            if not shutil.which(binary):
                                                    missing_bins.append(binary)
                            available.append({"id": ext_name, "title": title, "description": desc, "missing_externals": missing_exts, "missing_binaries": missing_bins})
    from akasa.extension import _REGISTERED_SETTINGS_SCHEMAS

    evaluated_schemas = {}
    for ext_id, schema_spec in _REGISTERED_SETTINGS_SCHEMAS.items():
        if callable(schema_spec):
            try: evaluated_schemas[ext_id] = schema_spec(workspace_id)
            except Exception: evaluated_schemas[ext_id] = []
        else:
            evaluated_schemas[ext_id] = schema_spec
    return {
        "config": data,
        "meta": {
            "available_extensions": sorted(available, key=lambda x: x.get('title') or ""),
            "settings_schemas": evaluated_schemas,
            "core_modules": list(CORE_MODULES)
        }
    }
def save_system_config(workspace_id, payload):
    cfg_path, _ = get_workspace_physics(workspace_id)
    existing_cfg = load_json_config(cfg_path, {})
    merged_cfg = {**existing_cfg, **payload}

    # Security Guardrail: Enforce the core config UI is never locked out
    if "extensions" in merged_cfg and "config" not in merged_cfg["extensions"]:
        merged_cfg["extensions"].insert(0, "config")
    from insetu.core.utils_core import sanitize_workspace_config

    merged_cfg = sanitize_workspace_config(merged_cfg)
    save_json_config(cfg_path, merged_cfg, workspace_id)

    # Emits a globally decoupled config invalidation event
    from akasa.hooks import hooks
    hooks.emit('config_mutated', workspace_id=workspace_id)
@system_bp.route('reboot', methods=['POST'], docstring="[sync] Clean in-place process replacement to restart the OS daemon.")
def api_system_reboot(ctx):
    """Clean in-place process replacement to restart the OS daemon."""
    import os, sys, threading, time
    def restart():
        from akasa.hooks import hooks
        try: hooks.emit('system_shutdown')
        except Exception: pass
        time.sleep(0.5)
        python_exe = sys.executable
        os.execv(python_exe, [python_exe] + sys.argv)

    threading.Thread(target=restart, daemon=True).start()
    return jsonify({"status": "success", "message": "Rebooting inSetu OS..."})
class SystemConfigPayload(TypedDict, total=False):
    extensions: List[str]
    target_repos: List[Dict[str, Any]]

@system_bp.route('config', methods=['GET', 'POST'], request_schema={"POST": SystemConfigPayload}, docstring="[sync] Retrieves or updates the global workspace configuration.")
def api_system_config(ctx):
    try:
        if ctx.req.method == 'GET':
            data = get_system_config(ctx.workspace_id)
            return jsonify(data)
        else:
            payload = ctx.req.get_json(silent=True) or {}

            from flask import current_app
            requires_reboot = False
            for ext in payload.get("extensions", []):
                if ext != "config" and ext not in current_app.blueprints:
                    requires_reboot = True

            save_system_config(ctx.workspace_id, payload)
            return jsonify({
                "status": "success", 
                "message": "Configuration saved successfully.", 
                "requires_reboot": requires_reboot
            })
    except Exception as e:
        import traceback
        print(f"Config Route Error: {traceback.format_exc()}")
        return jsonify({"error": f"Server Error: {str(e)}"}), 500
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
        from insetu.core.utils_core import get_sister_repos
        import os
        from pathlib import Path
        cfg = load_config(ctx.workspace_id)
        target_repos = cfg.get("target_repos", [])
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
        return jsonify({
            "repos": get_sister_repos(ctx.workspace_id),
            "port": int(os.environ.get("INSETU_PORT", cfg.get("port", 5005))),
            "term_port": cfg.get("term_port", 8181),
            "target_repos": target_repos or [],
            "virtual_contexts": cfg.get("virtual_contexts", []),
            "category_order": cfg.get("category_order", []),
            "tab_order": cfg.get("tab_order", ["context", "edit", "tasks", "ctrl", "library"]),
            "hidden_outputs": cfg.get("hidden_outputs", ["context_prompt.md", "context_prompt_diffs.txt"]),
            "config_missing": not os.path.exists(cfg_path)
        })
    except Exception as e:
        import traceback
        print(f"Topology Route Error: {traceback.format_exc()}")
        return jsonify({"error": f"Server Error: {str(e)}"}), 500
class ManifestResponse(TypedDict):
    vfs: Dict[str, Any]
    ctx: Dict[str, Any]

@system_bp.route('manifest', methods=['GET'], response_schema=ManifestResponse, docstring="Returns the twin single-source-of-truth manifests: 'vfs' (physical file bucket mapping) and 'ctx' (compiled context tree mapping).")
def api_system_manifest(ctx):
    headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
    ctx_manifest = next((m for m in hooks.emit('request_manifest', workspace_id=ctx.workspace_id) if m), {})
    vfs_manifest = next((m for m in hooks.emit('request_vfs_manifest', workspace_id=ctx.workspace_id) if m), {})

    return jsonify({"vfs": vfs_manifest, "ctx": ctx_manifest}), 200, headers
class WorkspaceCreatePayload(TypedDict):
    id: str
    workspace_root: str
@system_bp.route('workspaces/create', methods=['POST'], request_schema=WorkspaceCreatePayload, docstring="[sync] Provisions and mounts an isolated workspace.")
def api_create_workspace(ctx):
    try:
        data = ctx.req.json or {}
        ws_id = data.get('id', '').strip().lower()
        if not ws_id or ws_id in ['default', 'none']:
            return jsonify({"error": "A unique, valid alphanumeric workspace ID is required"}), 400
        index_path = Path(utils._cwd).joinpath(".insetu", "system.json").as_posix()
        from akasa.utils import load_json_config, save_json_config

        w_data = load_json_config(index_path, {"workspaces": {"default": {"config_path": "config.json"}}})
        if "workspaces" not in w_data:
            w_data["workspaces"] = {"default": {"config_path": "config.json"}}

        if ws_id in w_data.get("workspaces", {}):
            return jsonify({"error": f"Workspace '{ws_id}' already exists"}), 400
        custom_root = data.get('workspace_root', '').strip()
        if not custom_root:
            return jsonify({"error": "Workspace Root Directory Path is strictly required to ensure absolute codebase isolation."}), 400
        resolved_root = os.path.abspath(os.path.expanduser(custom_root))

        ws_insetu_dir = Path(resolved_root).joinpath(".insetu")
        os.makedirs(ws_insetu_dir.joinpath("data").as_posix(), exist_ok=True)
        config_abs_path = ws_insetu_dir.joinpath("config.json").as_posix()
        config_rel_path = config_abs_path
        starter_config = {
            "workspace_root": resolved_root,
            "extensions": ["config"],
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
        from akasa.extension import SettingsManager
        settings = SettingsManager('system', ws_id)
        settings.set("instance_title", f"inSetu Workspace: {ws_id}")

        # 4. Provision databases and trigger the boot sequence for the new workspace
        from akasa.db import apply_declarative_schema, _REGISTERED_SCHEMAS
        from akasa.hooks import hooks
        for ext_name, schema in _REGISTERED_SCHEMAS.items():
            apply_declarative_schema(ext_name, schema, ws_id)
        hooks.emit('workspace_boot', workspace_id=ws_id)

        return jsonify({"status": "success", "workspaces": w_data["workspaces"]})
    except Exception as e:
        import traceback
        print(f"Workspace Create Error: {traceback.format_exc()}")
        return jsonify({"error": f"Server Error: {str(e)}"}), 500
class WorkspaceDeletePayload(TypedDict):
    id: str
@system_bp.route('workspaces/delete', methods=['POST'], request_schema=WorkspaceDeletePayload, docstring="[sync] Permanently deletes a workspace and its tracking metadata.")
def api_delete_workspace(ctx):
    try:
        data = ctx.req.json or {}
        ws_id = data.get('id', '').strip().lower()
        if ws_id == 'default':
            return jsonify({"error": "The root system default workspace framework cannot be deleted."}), 400
        index_path = Path(utils._cwd).joinpath(".insetu", "system.json").as_posix()
        from akasa.utils import load_json_config, save_json_config

        w_data = load_json_config(index_path, {"workspaces": {"default": {"config_path": "config.json"}}})
        if "workspaces" not in w_data:
            w_data["workspaces"] = {"default": {"config_path": "config.json"}}

        if ws_id not in w_data.get("workspaces", {}):
            return jsonify({"error": "Target workspace not found."}), 404
        del w_data["workspaces"][ws_id]
        hooks.emit('workspace_shutdown', workspace_id=ws_id)
        local_insetu_dir = Path(utils._cwd).joinpath(".insetu").as_posix()
        ws_dir = Path(local_insetu_dir).joinpath("workspaces", ws_id)
        if os.path.exists(ws_dir.as_posix()):
            from akasa.vfs import execute_vfs_delete
            execute_vfs_delete("default", ws_dir.as_posix())

        save_json_config(index_path, w_data, workspace_id="default")

        return jsonify({"status": "success", "workspaces": w_data["workspaces"]})
    except Exception as e:
        import traceback
        print(f"Workspace Delete Error: {traceback.format_exc()}")
        return jsonify({"error": f"Server Error: {str(e)}"}), 500
class JobStatusResponse(TypedDict):
    id: str
    ext_name: str
    status: str
    message: str
    artifact: Dict[str, Any]

@system_bp.route('jobs/<job_id>', methods=['GET'], response_schema=JobStatusResponse, docstring="Polls the status of an asynchronous background job using the job_id returned by a 202 Accepted response. Status will be 'pending', 'processing', 'completed', or 'failed'.")
def api_job_status(ctx, job_id):
    from akasa.db import get_connection
    try:
        conn = get_connection("workers", workspace_id=ctx.workspace_id)
        job = conn.execute("SELECT ext_name, status, status_message, artifact_json, created_at, updated_at FROM immediate_jobs WHERE id=?", (job_id,)).fetchone()
        if not job:
            return jsonify({"error": "Job not found in active workspace context."}), 404

        return jsonify({
            "id": job_id,
            "ext_name": job['ext_name'],
            "status": job['status'],
            "message": job['status_message'],
            "artifact": json.loads(job['artifact_json']) if job['artifact_json'] else {},
            "created_at": job['created_at'],
            "updated_at": job['updated_at']
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
class WorkspacesResponse(TypedDict):
    workspaces: Dict[str, Dict[str, str]]

class WorkspacesSwitchPayload(TypedDict):
    active_workspace: str

@system_bp.route('workspaces', methods=['GET', 'POST'], request_schema={"POST": WorkspacesSwitchPayload}, response_schema=WorkspacesResponse, docstring="[sync] GET lists all mounted tenant workspaces. POST validates and switches session context to a target 'active_workspace'.")
def api_workspaces(ctx):
    index_path = Path(utils._cwd).joinpath(".insetu", "system.json").as_posix()

    if ctx.req.method == 'GET':
        data = utils.load_json_config(index_path, {})
        if "workspaces" not in data:
            data["workspaces"] = {"default": {"config_path": "config.json"}}
        return jsonify(data)
    if ctx.req.method == 'POST':
        data = ctx.req.json or {}
        new_active = data.get("active_workspace") or data.get("workspace_id")
        old_active = sniff_tenant_id()
        if not os.path.exists(index_path):
            return jsonify({"error": "system.json not found."}), 404
        w_data = utils.load_json_config(index_path, {})
        if new_active not in w_data.get("workspaces", {}) and new_active != "default":
            return jsonify({"error": "Workspace ID not found."}), 400

        if old_active and old_active != new_active:
            hooks.emit('workspace_shutdown', workspace_id=old_active)

        # Stateless UDF: Session state managed by client
    return jsonify({"status": "success", "message": f"Validated workspace {new_active}"})
@system_bp.route('config/test_bucketing', methods=['POST'], docstring="[sync] Dry-runs sub-bucket regex and folder matching for a repository.")
def api_system_config_test_bucketing(ctx):
    try:
        data = ctx.req.get_json(silent=True) or {}
        repo_cfg = data.get("repo_cfg", {})

        from akasa.utils import get_workspace_physics
        cfg_path, ws_root, _ = get_workspace_physics(ctx.workspace_id)
        repo_dir = repo_cfg.get("repo_dir")
        if not repo_dir:
            return jsonify({"error": "repo_dir missing"}), 400

        physical_path = repo_cfg.get("physical_path")
        repo_path = Path(physical_path).expanduser().resolve() if physical_path else Path(ws_root).joinpath(repo_dir).resolve()

        if not repo_path.exists():
            return jsonify({"error": f"Path not found: {repo_path}"}), 404

        from insetu.core.topology.engine_topology import get_valid_workspace_files, resolve_file_bucket
        valid_files = get_valid_workspace_files(repo_path.as_posix(), repo_cfg, ctx.workspace_id)

        sub_buckets = repo_cfg.get("sub_buckets", [])
        buckets_map = {}

        for f in valid_files:
            b, module = resolve_file_bucket(f, sub_buckets, repo_dir=repo_dir)
            bucket_id = module if (b and module) else (b.get("id") if b else "main")

            if bucket_id not in buckets_map:
                buckets_map[bucket_id] = []
            buckets_map[bucket_id].append(f)

        return jsonify({"status": "success", "buckets": buckets_map})
    except Exception as e:
        import traceback
        print(f"Bucketing Test Error: {traceback.format_exc()}")
        return jsonify({"error": f"Server Error: {str(e)}"}), 500
class ListLocalResponse(TypedDict):
    current: str
    dirs: List[str]

@system_bp.route('fs/list_local', methods=['GET'], response_schema=ListLocalResponse, docstring="[sync] Stateless directory explorer that reads absolute host paths for workspace mounts.")
def api_list_local_host_dirs(ctx):
    """Stateless directory explorer that reads absolute host paths for workspace mounts."""
    target = ctx.req.args.get('path', '').strip()
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
        return jsonify({"current": target, "dirs": dirs})
    except Exception as e:
        return jsonify({"current": target, "dirs": [], "error": str(e)}), 500