import functools
from flask import Blueprint, request, jsonify
import os
from insetu.db import get_connection, register_schema
from insetu.utils_core import extension_auth, get_gather_paths, load_config, resolve_workspace_path
from insetu.vfs import VFSTransaction
class JobManager:
    def __init__(self, ext_name, workspace_id, job_id=None):
        self.ext_name = ext_name
        self.workspace_id = workspace_id
        self.current_job_id = job_id

    def submit(self, task_name, **kwargs):
        import uuid, json
        from insetu.workers import submit_immediate_job
        job_prefix = self.ext_name[:3].lower()
        job_id = f"{job_prefix}_{uuid.uuid4().hex[:8]}"
        args_json = json.dumps(kwargs)
        submit_immediate_job(job_id, self.ext_name, task_name, args_json, self.workspace_id)
        return job_id
    def update_progress(self, message, artifact=None):
        if self.current_job_id:
            from insetu.workers import update_immediate_job_status
            update_immediate_job_status(self.current_job_id, 'processing', message, artifact, workspace_id=self.workspace_id)

    def update_meta(self, meta_dict):
        if self.current_job_id:
            from insetu.workers import update_immediate_job_meta
            update_immediate_job_meta(self.current_job_id, meta_dict, workspace_id=self.workspace_id)
_REGISTERED_SETTINGS_SCHEMAS = {}
class SettingsManager:
    def __init__(self, ext_name, workspace_id, schema=None):
        self.ext_name = ext_name
        self.workspace_id = workspace_id
        self.filename = f"{ext_name}.settings.json"
        self.schema = schema(workspace_id) if callable(schema) else (schema or [])
    def get(self, key, default=None):
        from insetu.utils_core import load_json_file, get_tenant_control_dir
        from pathlib import Path
        control_dir = get_tenant_control_dir(self.workspace_id)
        filepath = Path(control_dir).joinpath(self.filename).as_posix()
        data = load_json_file(filepath, {})

        if key in data:
            return data[key]

        for field in self.schema:
            if field.get('id') == key and 'default' in field:
                return field['default']

        return default
    def set(self, key, value):
        from insetu.utils_core import load_json_file, save_json_file, get_tenant_control_dir
        from pathlib import Path
        control_dir = get_tenant_control_dir(self.workspace_id)
        filepath = Path(control_dir).joinpath(self.filename).as_posix()
        data = load_json_file(filepath, {})
        data[key] = value
        save_json_file(filepath, data, self.workspace_id)
    def get_all(self):
        from insetu.utils_core import load_json_file, get_tenant_control_dir
        from pathlib import Path
        control_dir = get_tenant_control_dir(self.workspace_id)
        filepath = Path(control_dir).joinpath(self.filename).as_posix()
        data = load_json_file(filepath, {})

        for field in self.schema:
            fid = field.get('id')
            if fid and fid not in data and 'default' in field:
                data[fid] = field['default']

        return data
    def update(self, payload_dict):
        from insetu.utils_core import load_json_file, save_json_file, get_tenant_control_dir
        from pathlib import Path
        control_dir = get_tenant_control_dir(self.workspace_id)
        filepath = Path(control_dir).joinpath(self.filename).as_posix()
        data = load_json_file(filepath, {})
        valid_keys = {f.get('id') for f in self.schema} if self.schema else None
        for k, v in payload_dict.items():
            if valid_keys is None or k in valid_keys:
                data[k] = v
        save_json_file(filepath, data, self.workspace_id)
class StoreManager:
    def __init__(self, workspace_id):
        self.workspace_id = workspace_id

    def get(self, filename, key, default=None):
        from insetu.utils_core import load_json_file, get_tenant_control_dir
        from pathlib import Path
        control_dir = get_tenant_control_dir(self.workspace_id)
        filepath = Path(control_dir).joinpath(filename).as_posix()
        data = load_json_file(filepath, {})
        return data.get(key, default)

    def set(self, filename, key, value):
        from insetu.utils_core import load_json_file, save_json_file, get_tenant_control_dir
        from pathlib import Path
        control_dir = get_tenant_control_dir(self.workspace_id)
        filepath = Path(control_dir).joinpath(filename).as_posix()
        data = load_json_file(filepath, {})
        data[key] = value
        save_json_file(filepath, data, self.workspace_id)
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
        return get_gather_paths(self.workspace_id)

    @property
    def config(self):
        """Lazily fetches the active tenant's workspace configuration."""
        return load_config(self.workspace_id)
    def resolve_path(self, filepath):
        """Safely anchors a relative path to the physical workspace bounds."""
        return resolve_workspace_path(filepath, self.workspace_id)
    @property
    def manifest(self):
        """Reads the centralized context manifest statelessly."""
        from insetu.utils_core import load_json_file
        from pathlib import Path
        manifest_path = Path(self.paths["contexts_dir"]).joinpath("manifest.json").as_posix()
        return load_json_file(manifest_path, {})

    def get_manifest_files(self, target_key=None):
        """SSOT Helper to extract polymorphic lists of files or chunks from the manifest."""
        from insetu.utils_core import extract_manifest_files
        return extract_manifest_files(self.manifest, target_key)
    def expand_selection(self, items):
        """
        SSOT: Expands polymorphic frontend selection items into a flat, 
        deduplicated, and stable-sorted list of physical or logical filepaths.
        Handles folder traversal and manifest chunk expansion.
        """
        from insetu.vfs import VFSTransaction

        files = []
        with VFSTransaction(self.workspace_id) as vfs:
            for item in items:
                if 'filepath' in item:
                    filepath = item['filepath']
                    if filepath.startswith("system://contexts/"):
                        base_filename = filepath.replace("system://contexts/", "")
                        chunks = self.get_manifest_files(target_key=base_filename)
                        if chunks and len(chunks) > 0:
                            for chunk in chunks:
                                files.append(f"system://contexts/{chunk}")
                        else:
                            files.append(filepath)
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
        from insetu.utils_core import save_json_file, load_json_file
        from pathlib import Path
        import time
        manifest_path = Path(self.paths["contexts_dir"]).joinpath("manifest.json").as_posix()
        save_json_file(manifest_path, manifest_data, self.workspace_id)

        cache_path = Path(self.paths["contexts_dir"]).joinpath("manifest_cache.json").as_posix()
        cache_data = {"manifest": manifest_data}
        if is_full_compile:
            cache_data["last_full_compile_time"] = time.time()
        else:
            old_cache = load_json_file(cache_path, {})
            cache_data["last_full_compile_time"] = old_cache.get("last_full_compile_time", 0)

        save_json_file(cache_path, cache_data, self.workspace_id)
    def sync_vfs_barrier(self):
        """Halts the current thread until all pending VFS writes are physically flushed to disk."""
        from insetu.routes_fs import _VFS_WRITE_QUEUE
        _VFS_WRITE_QUEUE.join()

    def emit(self, event_name, *args, **kwargs):
        """Emits a synchronous event, automatically injecting the tenant's workspace ID."""
        from insetu.hooks import hooks
        kwargs['workspace_id'] = self.workspace_id
        return hooks.emit(event_name, *args, **kwargs)

    def emit_background(self, event_name, *args, **kwargs):
        """Emits a background event, automatically injecting the tenant's workspace ID."""
        from insetu.hooks import hooks
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
            return jsonify(ctx.settings.get_all())

        @self.route('settings', methods=['POST'])
        def update_settings(ctx):
            ctx.settings.update(ctx.req.json or {})
            return jsonify({"status": "success"})

        @self.route('settings/schema', methods=['GET'])
        def get_settings_schema(ctx):
            return jsonify(self.settings_schema)
    def worker(self, task_name):
        """
        SDK Decorator: Automatically wraps a background worker in a safe execution block.
        Injects the ExtensionContext, catches exceptions, and updates the immediate_jobs ledger.
        """
        def decorator(f):
            from insetu.workers import register_callback, update_immediate_job_status
            import inspect

            # Do not use functools.wraps here. The metronome relies on inspect.signature
            # to dynamically inject job_id and workspace_id based on the wrapper's exact kwargs.
            def wrapper(job_id=None, workspace_id=None, **kwargs):
                ctx = ExtensionContext(self.name, workspace_id, settings_schema=self.settings_schema, job_id=job_id)
                update_immediate_job_status(job_id, 'processing', "Initializing task...", workspace_id=workspace_id)
                try:
                    # Execute the domain logic
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

                    update_immediate_job_status(job_id, 'completed', msg, artifact=artifact, workspace_id=workspace_id)
                except Exception as e:
                    import traceback
                    err_trace = traceback.format_exc()
                    print(f"❌ [Worker: {self.name}:{task_name}] Failed:\n{err_trace}")
                    update_immediate_job_status(job_id, 'failed', str(e), workspace_id=workspace_id)

            register_callback(self.name, task_name, wrapper)
            return wrapper
        return decorator

        if self.virtual_contexts or self.target_repos:
            from insetu.hooks import hooks
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