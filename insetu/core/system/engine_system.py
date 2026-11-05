from pathlib import Path
import importlib.util
import os
import shutil
import sys
import copy
import threading
import time
import traceback
from typing import TypedDict, Optional, List, Dict, Any
from flask import jsonify
from insetu.core.sdk import (
    SettingsManager,
    get_core_modules,
    get_registered_settings_schemas,
    hooks,
    resolve_external_dependency_spec,
    set_mount_authorizer,
    get_system_deltas,
    provision_workspace_schemas,
    slugify,
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
    get_daemon_cwd,
    get_system_index_path,
    sniff_tenant_id,
    execute_vfs_delete,
    heal_manifest_entry_domain,
    normalize_repo_domains,
    sanitize_workspace_config,
    get_repeater_secret,
    set_repeater_secret,
)
from insetu.core.system.blueprint import SYSTEM_SETTINGS_SCHEMA, system_bp
import insetu.core.system.ext_manager as _ext_manager  # noqa: F401 - Registers extension routes and worker on system_bp
from insetu.core.system.ext_manager import _inspect_or_resolve_extension_meta
from insetu.core.system.memory_profiler import collect_process_memory_telemetry
from insetu.core.system.openapi import build_system_openapi_spec
import insetu.core.attestations as _attestations
import insetu.core.system.legacy as _system_legacy  # noqa: F401 - Mounts one-off boot migration hooks
import insetu.core.system.watchdog as _system_watchdog  # noqa: F401 - Mounts filesystem watchdog lifecycle hooks
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
def hydrate_and_migrate_cascade_settings(cfg: Dict[str, Any], workspace_id: Optional[str] = None, **kwargs) -> None:
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
    return jsonify(build_system_openapi_spec(_current_app))
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
        from insetu.core.utils_core import get_default_repo_template as _get_default_repo_template
        cfg_path, _ = get_workspace_physics(workspace_id)
        cfg = load_json_config(cfg_path, {})
        cfg = sanitize_workspace_config(cfg)

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
    return collect_process_memory_telemetry(ctx.payload.get('action'))


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

    merged_cfg = sanitize_workspace_config(merged_cfg)
    save_json_config(cfg_path, merged_cfg, workspace_id)

    # Emits a globally decoupled config invalidation event
    hooks.emit('config_mutated', workspace_id=workspace_id)
