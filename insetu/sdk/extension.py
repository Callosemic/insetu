import functools
from flask import Blueprint, request
import os
from insetu.db import get_connection, register_schema
from insetu.utils_core import extension_auth, get_gather_paths, load_config, resolve_workspace_path
from insetu.context import VFSTransaction
class JobManager:
    def __init__(self, ext_name, workspace_id):
        self.ext_name = ext_name
        self.workspace_id = workspace_id

    def submit(self, task_name, **kwargs):
        import uuid, json
        from insetu.workers import submit_immediate_job
        job_prefix = self.ext_name[:3].lower()
        job_id = f"{job_prefix}_{uuid.uuid4().hex[:8]}"
        args_json = json.dumps(kwargs)
        submit_immediate_job(job_id, self.ext_name, task_name, args_json, self.workspace_id)
        return job_id

class StoreManager:
    def __init__(self, workspace_id):
        self.workspace_id = workspace_id

    def get(self, filename, key, default=None):
        from insetu.utils_core import load_json_file, get_workspace_physics
        import os
        from pathlib import Path
        cfg_path, _, _ = get_workspace_physics(self.workspace_id)
        filepath = Path(os.path.dirname(cfg_path)).joinpath(filename).as_posix()
        data = load_json_file(filepath, {})
        return data.get(key, default)

    def set(self, filename, key, value):
        from insetu.utils_core import load_json_file, save_json_file, get_workspace_physics
        import os
        from pathlib import Path
        cfg_path, _, _ = get_workspace_physics(self.workspace_id)
        filepath = Path(os.path.dirname(cfg_path)).joinpath(filename).as_posix()
        data = load_json_file(filepath, {})
        data[key] = value
        save_json_file(filepath, data, self.workspace_id)

class ExtensionContext:
    """Pre-scoped context object injected into all SDK routes."""
    def __init__(self, ext_name, workspace_id):
        self.ext_name = ext_name
        self.workspace_id = workspace_id
        self.vfs = VFSTransaction(workspace_id)
        self.req = request
        self.jobs = JobManager(ext_name, workspace_id)
        self.store = StoreManager(workspace_id)
    @property
    def db(self):
        """Returns an SQLite connection automatically keyed to the active tenant workspace."""
        return get_connection(self.ext_name, self.workspace_id)

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
class InSetuExtension:
    """
    Blueprint wrapper that strictly enforces ADR 0002 and ADR 0016 API contracts,
    abstracting away tenant tracking, authorization, and SQLite schema migrations.
    """
    def __init__(self, name, module_name, schema=None, virtual_contexts=None, target_repos=None, core=False):
        self.name = name
        self.bp = Blueprint(name, module_name)
        self.schema = schema or {}
        self.virtual_contexts = virtual_contexts or []
        self.target_repos = target_repos or []
        self.core = core

        if self.schema:
            register_schema(self.name, self.schema)

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
                ctx = ExtensionContext(self.name, workspace_id)
                return f(ctx, *args, **kwargs)

            # Use getattr to safely bypass the auth gate for core OS engines
            if not getattr(self, 'core', False):
                wrapper = extension_auth(self.name)(wrapper)

            self.bp.route(full_rule, **options)(wrapper)
            return wrapper
        return decorator