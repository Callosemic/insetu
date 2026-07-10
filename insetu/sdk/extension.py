import functools
from flask import Blueprint, request
import os
from insetu.db import get_connection, register_schema
from insetu.routes_fs import execute_vfs_save
from insetu.utils_core import extension_auth, get_gather_paths, load_config, resolve_workspace_path

class VFSTransaction:
    """Provides atomic-style batching and async queue dispatch for file mutations."""
    def __init__(self, workspace_id):
        self.workspace_id = workspace_id
        self._buffer = []
        self._in_transaction = False
    def save(self, filepath, content, data=None):
        if self._in_transaction:
            self._buffer.append((filepath, content, data or {}))
        else:
            execute_vfs_save(self.workspace_id, filepath, content, data)

    def read(self, filepath):
        """Safely resolves and reads a file's contents, returning None if missing."""
        resolved = resolve_workspace_path(filepath, self.workspace_id)
        if not os.path.exists(resolved):
            return None
        with open(resolved, 'r', encoding='utf-8') as f:
            return f.read()

    def __enter__(self):
        self._in_transaction = True
        self._buffer = []
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._in_transaction = False
        if exc_type is None and self._buffer:
            for filepath, content, data in self._buffer:
                execute_vfs_save(self.workspace_id, filepath, content, data)
        self._buffer = []

    def walk(self, directory_path, exts=None):
        """Safely sweeps a directory within the workspace bounds, yielding files that match the extension array."""
        resolved_dir = resolve_workspace_path(directory_path, self.workspace_id)
        if not os.path.exists(resolved_dir):
            return

        for root, _, files in os.walk(resolved_dir):
            for f in files:
                if exts and not any(f.endswith(ext) for ext in exts):
                    continue
                yield os.path.relpath(os.path.join(root, f), resolved_dir)

class ExtensionContext:
    """Pre-scoped context object injected into all SDK routes."""
    def __init__(self, ext_name, workspace_id):
        self.ext_name = ext_name
        self.workspace_id = workspace_id
        self.vfs = VFSTransaction(workspace_id)
        self.req = request
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
    def __init__(self, name, module_name, schema=None):
        self.name = name
        self.bp = Blueprint(name, module_name)
        self.schema = schema or {}
        
        if self.schema:
            register_schema(self.name, self.schema)

    def route(self, rule, **options):
        # Auto-Routing: Enforce strict stateless multi-tenant boundaries natively
        clean_rule = rule.lstrip('/')
        full_rule = f'/api/<workspace_id>/{self.name}/{clean_rule}'

        def decorator(f):
            @functools.wraps(f)
            @extension_auth(self.name)
            def wrapper(workspace_id, *args, **kwargs):
                ctx = ExtensionContext(self.name, workspace_id)
                # Inject the pre-scoped context object in place of the raw workspace_id parameter
                return f(ctx, *args, **kwargs)
            
            # Register with the underlying Flask Blueprint
            self.bp.route(full_rule, **options)(wrapper)
            return wrapper
        return decorator