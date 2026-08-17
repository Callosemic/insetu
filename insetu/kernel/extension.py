import functools
from typing import TYPE_CHECKING, Optional, Dict, Any
from flask import Blueprint, request, jsonify

if TYPE_CHECKING:
    from insetu.kernel.types import WorkspaceID, FilePath, VFSStorageEngine, WorkspacePathsDict
import os
from insetu.kernel.db import get_connection, register_schema
from insetu.kernel.utils import extension_auth, load_config
from insetu.kernel.vfs import VFSTransaction
class JobManager:
    def __init__(self, ext_name, workspace_id, job_id=None):
        self.ext_name = ext_name
        self.workspace_id = workspace_id
        self.current_job_id = job_id
    def submit(self, task_name, coalesce=False, **kwargs):
        import uuid, json
        from insetu.kernel.workers import submit_immediate_job
        job_prefix = self.ext_name[:3].lower()
        job_id = f"{job_prefix}_{uuid.uuid4().hex[:8]}"
        args_json = json.dumps(kwargs)
        return submit_immediate_job(
            job_id, self.ext_name, task_name, args_json, self.workspace_id, coalesce=coalesce
        )

    def is_in_flight(self, task_name):
        """SDK Helper: Checks if a specific background worker task is currently queued or processing."""
        from insetu.kernel.db import get_connection
        conn = get_connection("workers", workspace_id=self.workspace_id)
        row = conn.execute(
            "SELECT id FROM immediate_jobs WHERE ext_name=? AND callback_name=? AND status IN ('pending', 'processing')",
            (self.ext_name, task_name)
        ).fetchone()
        return bool(row)
    def update_progress(self, message, artifact=None):
        if self.current_job_id:
            from insetu.kernel.workers import update_immediate_job_status
            update_immediate_job_status(self.current_job_id, 'processing', message, artifact, workspace_id=self.workspace_id)

    def update_meta(self, meta_dict):
        if self.current_job_id:
            from insetu.kernel.workers import update_immediate_job_meta
            update_immediate_job_meta(self.current_job_id, meta_dict, workspace_id=self.workspace_id)
_REGISTERED_SETTINGS_SCHEMAS = {}
class SettingsManager:
    def __init__(self, ext_name, workspace_id, schema=None):
        self.ext_name = ext_name
        self.workspace_id = workspace_id
        self.secrets_filename = "secrets.json"
        self.workspace_filename = "workspace.settings.json"
        self.repo_filename = "repo.settings.json"
        if schema is None:
            schema = _REGISTERED_SETTINGS_SCHEMAS.get(ext_name)
        self.schema = schema(workspace_id) if callable(schema) else (schema or [])
        self._migrate_workspaces_to_system()

    def _migrate_workspaces_to_system(self):
        from insetu.kernel.utils import _cwd, load_json_file, save_json_file
        from pathlib import Path
        import os

        system_path = Path(_cwd).joinpath(".insetu", "system.json").as_posix()
        legacy_ws_path = Path(_cwd).joinpath(".insetu", "workspaces.json").as_posix()

        if os.path.exists(legacy_ws_path):
            legacy_data = load_json_file(legacy_ws_path, {})
            if not legacy_data.get("_deprecated"):
                system_data = load_json_file(system_path, {})

                if "workspaces" in legacy_data:
                    system_data["workspaces"] = legacy_data["workspaces"]
                if "active_workspace" in legacy_data:
                    system_data["active_workspace"] = legacy_data["active_workspace"]

                save_json_file(system_path, system_data, workspace_id="default")

                # Quietly deprecate the legacy file
                save_json_file(legacy_ws_path, {"_deprecated": True, "message": "Routing index migrated to system.json natively per Tier 1 hierarchy."}, workspace_id="default")

    def _get_field_meta(self, key):
        for field in self.schema:
            if field.get('id') == key:
                return field
        return None

    def _resolve_filepath(self, scope):
        from insetu.kernel.utils import get_tenant_control_dir, _cwd
        from pathlib import Path
        if scope == 'daemon':
            return Path(_cwd).joinpath(".insetu", "system.json").as_posix()

        control_dir = get_tenant_control_dir(self.workspace_id)
        if scope == 'repo':
            return Path(control_dir).joinpath(self.repo_filename).as_posix()
        else:
            return Path(control_dir).joinpath(self.workspace_filename).as_posix()

    def get(self, key, default=None, repo=None):
        from insetu.kernel.utils import load_json_file, get_tenant_control_dir
        from pathlib import Path

        field = self._get_field_meta(key)
        if not field:
            return default

        scope = field.get('scope', 'workspace')
        is_secure = field.get('secure', False)

        if is_secure:
            control_dir = get_tenant_control_dir(self.workspace_id)
            filepath = Path(control_dir).joinpath(self.secrets_filename).as_posix()
            data = load_json_file(filepath, {})

            ext_secrets = data.get(self.ext_name, {})
            if scope == 'repo' and repo:
                ext_secrets = ext_secrets.get(repo, {})

            if key in ext_secrets:
                val = ext_secrets[key]
                if isinstance(val, str) and val.startswith("v1:"):
                    from insetu.kernel.auth import decrypt_secret
                    return decrypt_secret(val)
                elif val:
                    self.set(key, val, repo=repo)
                    return val
                return val
        else:
            filepath = self._resolve_filepath(scope)
            data = load_json_file(filepath, {})

            if scope == 'daemon':
                if self.ext_name == 'core_system' and key in data:
                    return data[key]
                elif key in data.get(self.ext_name, {}):
                    return data[self.ext_name][key]
            elif scope == 'repo':
                if repo and key in data.get(repo, {}).get(self.ext_name, {}):
                    return data[repo][self.ext_name][key]
            else:
                if key in data.get(self.ext_name, {}):
                    return data[self.ext_name][key]

        return field.get('default', default)

    def set(self, key, value, repo=None):
        from insetu.kernel.utils import load_json_file, save_json_file, get_tenant_control_dir, _MUTATED_CONFIG_CACHE, _MUTATED_CONFIG_MTIME
        from pathlib import Path

        field = self._get_field_meta(key)
        if not field: return

        scope = field.get('scope', 'workspace')
        is_secure = field.get('secure', False)

        if is_secure:
            if value:
                from insetu.kernel.auth import encrypt_secret
                value = encrypt_secret(value)
            control_dir = get_tenant_control_dir(self.workspace_id)
            filepath = Path(control_dir).joinpath(self.secrets_filename).as_posix()
            data = load_json_file(filepath, {})
            if self.ext_name not in data:
                data[self.ext_name] = {}

            if scope == 'repo' and repo:
                if repo not in data[self.ext_name]:
                    data[self.ext_name][repo] = {}
                data[self.ext_name][repo][key] = value
            else:
                data[self.ext_name][key] = value

            save_json_file(filepath, data, self.workspace_id)
        else:
            filepath = self._resolve_filepath(scope)
            data = load_json_file(filepath, {})

            if scope == 'daemon':
                if self.ext_name == 'core_system':
                    data[key] = value
                else:
                    if self.ext_name not in data: data[self.ext_name] = {}
                    data[self.ext_name][key] = value
            elif scope == 'repo':
                if repo:
                    if repo not in data: data[repo] = {}
                    if self.ext_name not in data[repo]: data[repo][self.ext_name] = {}
                    data[repo][self.ext_name][key] = value
            else:
                if self.ext_name not in data: data[self.ext_name] = {}
                data[self.ext_name][key] = value

            save_json_file(filepath, data, self.workspace_id)

        _MUTATED_CONFIG_CACHE.clear()
        _MUTATED_CONFIG_MTIME.clear()
        self._sync_vfs_barrier()

    def get_all(self, repo=None):
        result = {}
        for field in self.schema:
            fid = field.get('id')
            if not fid: continue
            result[fid] = self.get(fid, repo=repo)
        return result
    def update(self, payload_dict, repo=None):
        from insetu.kernel.utils import load_json_file, save_json_file, get_tenant_control_dir, _MUTATED_CONFIG_CACHE, _MUTATED_CONFIG_MTIME
        from pathlib import Path

        control_dir = get_tenant_control_dir(self.workspace_id)
        daemon_path = self._resolve_filepath('daemon')
        ws_path = self._resolve_filepath('workspace')
        repo_path = self._resolve_filepath('repo')
        secrets_path = Path(control_dir).joinpath(self.secrets_filename).as_posix()

        # Load memory buffers
        buffers = {
            'daemon': load_json_file(daemon_path, {}),
            'workspace': load_json_file(ws_path, {}),
            'repo': load_json_file(repo_path, {}),
            'secure': load_json_file(secrets_path, {})
        }
        dirty = set()

        for field in self.schema:
            k = field.get('id')
            if not k or k not in payload_dict: continue

            val = payload_dict[k]
            scope = field.get('scope', 'workspace')
            is_secure = field.get('secure', False)

            if is_secure:
                if val:
                    from insetu.kernel.auth import encrypt_secret
                    val = encrypt_secret(val)
                if self.ext_name not in buffers['secure']: buffers['secure'][self.ext_name] = {}
                if scope == 'repo' and repo:
                    if repo not in buffers['secure'][self.ext_name]: buffers['secure'][self.ext_name][repo] = {}
                    buffers['secure'][self.ext_name][repo][k] = val
                else:
                    buffers['secure'][self.ext_name][k] = val
                dirty.add('secure')
            else:
                target = buffers[scope]
                if scope == 'daemon':
                    if self.ext_name == 'core_system': target[k] = val
                    else:
                        if self.ext_name not in target: target[self.ext_name] = {}
                        target[self.ext_name][k] = val
                elif scope == 'repo':
                    if repo:
                        if repo not in target: target[repo] = {}
                        if self.ext_name not in target[repo]: target[repo][self.ext_name] = {}
                        target[repo][self.ext_name][k] = val
                else:
                    if self.ext_name not in target: target[self.ext_name] = {}
                    target[self.ext_name][k] = val
                dirty.add(scope)

        # Commit dirty buffers exactly once
        if 'daemon' in dirty: save_json_file(daemon_path, buffers['daemon'], self.workspace_id)
        if 'workspace' in dirty: save_json_file(ws_path, buffers['workspace'], self.workspace_id)
        if 'repo' in dirty: save_json_file(repo_path, buffers['repo'], self.workspace_id)
        if 'secure' in dirty: save_json_file(secrets_path, buffers['secure'], self.workspace_id)
        if dirty:
            _MUTATED_CONFIG_CACHE.clear()
            _MUTATED_CONFIG_MTIME.clear()
            self._sync_vfs_barrier()

    def _sync_vfs_barrier(self):
        """Internal barrier to guarantee read-after-write consistency for settings."""
        from insetu.kernel.vfs import _VFS_WRITE_QUEUE, _VFS_SHUTDOWN_SIGNAL
        import time
        while _VFS_WRITE_QUEUE.unfinished_tasks > 0:
            if _VFS_SHUTDOWN_SIGNAL.is_set():
                break
            time.sleep(0.1)

class StoreManager:
    def __init__(self, workspace_id):
        self.workspace_id = workspace_id
    def get(self, filename, key, default=None):
        from insetu.kernel.utils import load_json_file, get_tenant_control_dir
        from pathlib import Path
        control_dir = get_tenant_control_dir(self.workspace_id)
        filepath = Path(control_dir).joinpath(filename).as_posix()
        data = load_json_file(filepath, {})
        return data.get(key, default)
    def set(self, filename, key, value):
        from insetu.kernel.utils import load_json_file, save_json_file, get_tenant_control_dir, _MUTATED_CONFIG_CACHE, _MUTATED_CONFIG_MTIME
        from pathlib import Path
        control_dir = get_tenant_control_dir(self.workspace_id)
        filepath = Path(control_dir).joinpath(filename).as_posix()
        data = load_json_file(filepath, {})
        data[key] = value
        save_json_file(filepath, data, self.workspace_id)
        _MUTATED_CONFIG_CACHE.clear()
        _MUTATED_CONFIG_MTIME.clear()
class DatabaseWrapper:
    """Lightweight ORM/CRUD wrapper for centralized SQLite access."""
    def __init__(self, conn):
        self._conn = conn

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def get_all(self, table, order_by=None):
        query = f"SELECT * FROM {table}"
        if order_by:
            query += f" ORDER BY {order_by}"
        cursor = self._conn.execute(query)
        return [dict(row) for row in cursor.fetchall()]
    def insert_or_replace(self, table, data):
        keys = list(data.keys())
        values = tuple(data[k] for k in keys)
        placeholders = ", ".join(["?"] * len(keys))
        cols = ", ".join(keys)
        self._conn.execute(f"INSERT OR REPLACE INTO {table} ({cols}) VALUES ({placeholders})", values)
        self._conn.commit()

    def update(self, table, data, where_col, where_val):
        keys = list(data.keys())
        values = tuple(data[k] for k in keys) + (where_val,)
        set_clause = ", ".join([f"{k} = ?" for k in keys])
        self._conn.execute(f"UPDATE {table} SET {set_clause} WHERE {where_col} = ?", values)
        self._conn.commit()

    def get_by_id(self, table, id_val, id_col="id"):
        cursor = self._conn.execute(f"SELECT * FROM {table} WHERE {id_col} = ?", (id_val,))
        row = cursor.fetchone()
        return dict(row) if row else None

    def delete(self, table, where_col, where_val):
        self._conn.execute(f"DELETE FROM {table} WHERE {where_col} = ?", (where_val,))
        self._conn.commit()
class ExtensionContext:
    """Pre-scoped context object injected into all SDK routes."""
    def __init__(self, ext_name, workspace_id, settings_schema=None, job_id=None):
        self.ext_name = ext_name
        self.workspace_id = workspace_id
        self.vfs = VFSTransaction(workspace_id)
        self.req = request
        self.jobs = JobManager(ext_name, workspace_id, job_id=job_id)
        self.store = StoreManager(workspace_id)
        self.settings = SettingsManager(ext_name, workspace_id, schema=settings_schema)
    @property
    def db(self):
        """Returns an SQLite connection automatically keyed to the active tenant workspace."""
        conn = get_connection(self.ext_name, self.workspace_id)
        return DatabaseWrapper(conn)
    @property
    def paths(self):
        """Returns the active tenant's structural path dictionary."""
        from insetu.kernel.utils import get_workspace_physics
        from insetu.kernel.hooks import hooks
        from pathlib import Path

        cfg_path, ws_root, wf_path = get_workspace_physics(self.workspace_id)
        workspace_dir = Path(cfg_path).parent.as_posix()
        artifacts_base = Path(workspace_dir).joinpath("data").as_posix()
        base_paths = {
            "config_path": cfg_path,
            "control_dir": workspace_dir,
            "workspace_root": ws_root,
            "workflows_path": wf_path,
            "artifacts_base": artifacts_base
        }

        # Agnostically merge domain-specific paths injected by Tier 2 engines
        path_extensions = hooks.emit('request_paths', workspace_id=self.workspace_id)
        for p_dict in path_extensions:
            if p_dict:
                base_paths.update(p_dict)

        return base_paths

    @property
    def config(self):
        """Lazily fetches the active tenant's workspace configuration."""
        return load_config(self.workspace_id)
    def resolve_path(self, filepath):
        """Safely anchors a relative path to the physical workspace bounds."""
        from insetu.kernel.hooks import hooks
        from insetu.kernel.utils import resolve_sandbox_path
        overrides = hooks.emit('vfs_resolve_path', filepath=filepath, workspace_id=self.workspace_id)
        resolved = next((r for r in overrides if r), None)
        return resolved or resolve_sandbox_path(filepath, self.workspace_id)

    def get_repo_path(self, repo_dir):
        """SSOT for resolving a repository's physical override or logical path."""
        import os
        for c in self.config.get("target_repos", []):
            if c.get("repo_dir") == repo_dir and c.get("physical_path"):
                return os.path.abspath(os.path.expanduser(c.get("physical_path")))
        return self.resolve_path(repo_dir)

    @property
    def manifest(self):
        """Reads the centralized context manifest statelessly."""
        from insetu.kernel.hooks import hooks
        manifests = hooks.emit('request_manifest', workspace_id=self.workspace_id)
        return next((m for m in manifests if m), {})

    def get_manifest_files(self, target_key=None):
        """SSOT Helper to extract polymorphic lists of files or chunks from the manifest."""
        from insetu.kernel.hooks import hooks
        chunks = hooks.emit('request_manifest_chunks', target_key=target_key, workspace_id=self.workspace_id)
        return next((c for c in chunks if c), [])
    def expand_selection(self, items):
        """
        SSOT: Expands polymorphic frontend selection items into a flat, 
        deduplicated, and stable-sorted list of physical or logical filepaths.
        Handles folder traversal and manifest chunk expansion.
        """
        from insetu.kernel.vfs import VFSTransaction

        files = []
        with VFSTransaction(self.workspace_id) as vfs:
            for item in items:
                if 'filepath' in item:
                    filepath = item['filepath']
                    if filepath.startswith("ctx://"):
                        from insetu.kernel.hooks import hooks
                        responses = hooks.emit('resolve_payload_chunks', uri=filepath, workspace_id=self.workspace_id)
                        chunks = next((r for r in responses if r), [filepath])
                        files.extend(chunks)
                    else:
                        files.append(filepath)
                elif 'folderpath' in item:
                    for f in vfs.walk(item['folderpath']):
                        files.append(f)

        unique_files = []
        seen = set()
        for f in files:
            if f not in seen:
                seen.add(f)
                unique_files.append(f)
        return unique_files
    def save_manifest(self, manifest_data, is_full_compile=False):
        """Writes updates to the centralized context manifest."""
        from insetu.kernel.hooks import hooks
        hooks.emit('save_manifest', manifest_data=manifest_data, is_full_compile=is_full_compile, workspace_id=self.workspace_id)
    def sync_vfs_barrier(self):
        """Halts the current thread until all pending VFS writes are physically flushed to disk."""
        from insetu.kernel.vfs import _VFS_WRITE_QUEUE, _VFS_SHUTDOWN_SIGNAL
        import time
        while _VFS_WRITE_QUEUE.unfinished_tasks > 0:
            if _VFS_SHUTDOWN_SIGNAL.is_set():
                raise RuntimeError("Transaction aborted mid-flight due to system shutdown or workspace context swap.")
            time.sleep(0.1)

    def emit(self, event_name, *args, **kwargs):
        """Emits a synchronous event, automatically injecting the tenant's workspace ID."""
        from insetu.kernel.hooks import hooks
        kwargs['workspace_id'] = self.workspace_id
        return hooks.emit(event_name, *args, **kwargs)

    def emit_background(self, event_name, *args, **kwargs):
        """Emits a background event, automatically injecting the tenant's workspace ID."""
        from insetu.kernel.hooks import hooks
        kwargs['workspace_id'] = self.workspace_id
        return hooks.emit_background(event_name, *args, **kwargs)

class InSetuExtension:
    """
    Blueprint wrapper that strictly enforces ADR 0002 and ADR 0016 API contracts,
    abstracting away tenant tracking, authorization, and SQLite schema migrations.
    """
    def __init__(self, name, module_name, title=None, description="", schema=None, virtual_contexts=None, target_repos=None, core=False, settings_schema=None):
        self.name = name
        self.title = title or name.replace('_', ' ').title()
        self.description = description
        self.bp = Blueprint(name, module_name)
        self.schema = schema or {}
        self.virtual_contexts = virtual_contexts or []
        self.target_repos = target_repos or []
        self.core = core
        self.settings_schema = settings_schema or []

        if self.settings_schema:
            _REGISTERED_SETTINGS_SCHEMAS[self.name] = self.settings_schema

        if self.schema:
            register_schema(self.name, self.schema)
        # Universal REST endpoints for extension settings management
        @self.route('settings', methods=['GET'])
        def get_settings(ctx):
            repo = ctx.req.args.get('repo')
            return jsonify(ctx.settings.get_all(repo=repo))
        @self.route('settings', methods=['POST'])
        def update_settings(ctx):
            try:
                repo = ctx.req.args.get('repo') or (ctx.req.json.get('_repo') if ctx.req.json else None)
                ctx.settings.update(ctx.req.json or {}, repo=repo)
            except Exception as e:
                import traceback
                print(f"Settings Save Error: {traceback.format_exc()}")
                return jsonify({"status": "error", "error": f"Internal save error: {str(e)}"}), 500
            # Emit a strictly scoped event for this specific extension
            results = ctx.emit(f'{self.name}_settings_updated')

            job_id = None
            requires_refresh = False
            for res in results:
                if isinstance(res, dict):
                    if "job_id" in res:
                        job_id = res["job_id"]
                    if res.get("requires_refresh"):
                        requires_refresh = True

            payload = {"status": "success", "requires_refresh": requires_refresh}
            if job_id:
                payload["job_id"] = job_id
            return jsonify(payload)

        @self.route('settings/schema', methods=['GET'])
        def get_settings_schema(ctx):
            return jsonify(self.settings_schema)
        if self.virtual_contexts or self.target_repos:
            from insetu.kernel.hooks import hooks
            @hooks.on('mutate_workspace_config')
            def _inject_declarative_config(cfg, workspace_id=None, **kwargs):
                if self.name not in cfg.get("extensions", []): return

                if self.target_repos:
                    targets = cfg.get("target_repos", [])
                    for tr in self.target_repos:
                        if not any(r.get("repo_dir") == tr.get("repo_dir") for r in targets):
                            targets.append(tr)
                    cfg["target_repos"] = targets

                if self.virtual_contexts:
                    if "virtual_contexts" not in cfg:
                        cfg["virtual_contexts"] = []
                    for vc in self.virtual_contexts:
                        if not any(v.get("out_file") == vc.get("out_file") for v in cfg["virtual_contexts"]):
                            cfg["virtual_contexts"].append(vc)

    def get_context(self, workspace_id, job_id=None):
        """SDK Factory: Returns a fully hydrated context inherently bound to this extension's schema."""
        return ExtensionContext(self.name, workspace_id, settings_schema=self.settings_schema, job_id=job_id)

    def worker(self, task_name):
        """
        SDK Decorator: Automatically wraps a background worker in a safe execution block.
        Injects the ExtensionContext, catches exceptions, and updates the immediate_jobs ledger.
        """
        def decorator(f):
            from insetu.kernel.workers import register_callback, update_immediate_job_status
            import inspect

            # Do not use functools.wraps here. The metronome relies on inspect.signature
            # to dynamically inject job_id and workspace_id based on the wrapper's exact kwargs.
            def wrapper(job_id=None, workspace_id=None, **kwargs):
                ctx = ExtensionContext(self.name, workspace_id, settings_schema=self.settings_schema, job_id=job_id)
                update_immediate_job_status(job_id, 'processing', "Initializing task...", workspace_id=workspace_id)
                try:
                    # Execute the domain logic
                    _chain = kwargs.pop('_chain', None)
                    if 'job_id' in inspect.signature(f).parameters:
                        kwargs['job_id'] = job_id
                    result = f(ctx, **kwargs)

                    # Evaluate final completion payload
                    msg = "Task complete."
                    artifact = {}
                    if isinstance(result, str):
                        msg = result
                    elif isinstance(result, dict):
                        msg = result.get('message', msg)
                        artifact = result.get('artifact', {})
                    # --- AUTOPILOT BATON PASS (Agnostic Job Chain) ---
                    if _chain:
                        steps = _chain.get('steps', [])
                        if steps:
                            next_step = steps.pop(0)
                            _chain['steps'] = steps
                            import json
                            import uuid
                            from insetu.kernel.workers import submit_immediate_job
                            clean_kwargs = {k: v for k, v in kwargs.items() if k not in ['job_id', 'workspace_id']}
                            clean_kwargs['_chain'] = _chain

                            # Fork the chain into a new background job so the current step can complete and unlock its UI
                            next_job_id = f"chn_{uuid.uuid4().hex[:8]}"
                            submit_immediate_job(next_job_id, next_step["ext_name"], next_step["worker_name"], json.dumps(clean_kwargs), workspace_id=workspace_id, coalesce=False)
                            # Deliberately fall through to mark the current job_id as 'completed'
                        else:
                            on_complete = _chain.get('on_complete_hook')
                            if on_complete:
                                from insetu.kernel.hooks import hooks
                                hooks.emit_background(on_complete, workspace_id=workspace_id)

                    update_immediate_job_status(job_id, 'completed', msg, artifact=artifact, workspace_id=workspace_id)
                except Exception as e:
                    import traceback
                    err_trace = traceback.format_exc()
                    print(f"❌ [Worker: {self.name}:{task_name}] Failed:\n{err_trace}")
                    update_immediate_job_status(job_id, 'failed', str(e), workspace_id=workspace_id)

            register_callback(self.name, task_name, wrapper)
            return wrapper
        return decorator

    def route(self, rule, **options):
        # SDK Guardrail: Ban empty routes to prevent 308 Mixed Content redirect traps behind reverse proxies
        if rule in ['', '/']:
            raise ValueError(f"SDK Exception in '{self.name}': Empty root routes ('' or '/') are banned. Please use an explicit endpoint name like 'list' or 'index'.")

        # Auto-Routing: Enforce strict stateless multi-tenant boundaries natively
        clean_rule = rule.lstrip('/')
        full_rule = f'/api/<workspace_id>/{self.name}/{clean_rule}'
        def decorator(f):
            @functools.wraps(f)
            def wrapper(workspace_id, *args, **kwargs):
                ctx = ExtensionContext(self.name, workspace_id, settings_schema=self.settings_schema)
                return f(ctx, *args, **kwargs)

            # Use getattr to safely bypass the auth gate for core OS engines
            if not getattr(self, 'core', False):
                wrapper = extension_auth(self.name)(wrapper)

            self.bp.route(full_rule, **options)(wrapper)
            return wrapper
        return decorator