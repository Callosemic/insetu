# inSetu Extension SDK (The Tier 2 SDK Membrane)
import os
import datetime
import uuid

os.environ.setdefault("AKASA_CONTROL_DIR", ".insetu")
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from akasa.extension import (
    AkasaExtension,
    ExtensionContext as _BaseExtensionContext,
    SettingsManager,
    StoreManager,
    DatabaseWrapper,
    MASKED_SECRET_SENTINEL,
    get_registered_settings_schemas,
    get_registered_capabilities,
)
from akasa.db import (
    get_connection,
    register_schema,
    apply_declarative_schema,
    provision_workspace_schemas,
    recover_corrupt_databases,
    migrate_legacy_sqlite_paths,
)
from akasa.events import sse_bus
from akasa.hooks import hooks
from akasa.sync import get_system_deltas, get_active_pipeline_modules
from akasa.types import (
    WorkspaceID,
    FilePath,
    TenantPath,
    FileMutationPayload,
    JobProgressPayload,
    JobSchedulePayload,
    JobChainStep,
    JobChainPayload,
    WorkspacePathsDict,
    VFSStorageEngine,
)
import akasa as _akasa
from akasa.auth import (
    ensure_master_key_on_disk,
    encrypt_secret,
    decrypt_secret,
    rotate_master_key,
)
from akasa.process import execute_binary
from akasa.auth.peer import (
    PeerInfo,
    classify_peer,
    register_proxy_header,
    register_allowed_host,
)
from akasa.uri import AkasaURI
from akasa.utils import (
    slugify,
    thread_safe_cache,
    register_core_module,
    load_config,
    save_json_config,
    load_json_config,
    get_workspace_physics,
    get_all_workspace_ids,
    get_tenant_control_dir,
    get_daemon_cwd,
    set_daemon_cwd,
    heal_daemon_config_files,
    get_system_index_path,
    get_daemon_host_config_path,
    get_core_modules,
    is_core_module,
    is_extension_enabled,
    get_active_modules,
    set_tenant_resolver,
    resolve_active_tenant,
    sniff_tenant_id,
    is_subpath,
    resolve_system_artifact_path,
    build_tree_dict,
    generate_ascii_tree,
    fold_vfs_events,
    reclaim_process_memory,
    get_kernel_memory_telemetry,
    typeddict_to_openapi,
    parse_uri,
    is_port_listening,
    can_bind_port,
    allocate_ephemeral_port,
    register_trusted_host_suffix,
    get_trusted_host_suffixes,
    atomic_write_bytes,
    atomic_write_text,
    CycleError,
    resolve_dag_wavefronts,
    extract_template_variables,
    interpolate_template_variables,
)
from akasa.vfs import (
    VFSTransaction,
    DefaultVFSDriver,
    InterWorkspaceVFSDriver,
    register_driver,
    register_protected_vfs_targets,
    mount_volume,
    set_mount_authorizer,
    resolve_physical_path,
    sync_vfs_barrier,
    execute_vfs_save,
    execute_vfs_delete,
    execute_vfs_move,
    execute_vfs_bulk,
    evict_vfs_cache,
    compute_vfs_sha256,
    record_vfs_ancestor,
    lookup_vfs_ancestor,
    three_way_merge_text,
    has_pending_vfs_write,
)
from akasa.workers import ChainStepSchema, ChainStepArtifact, resolve_dag_chain, run_parallel

CORE_MODULES_TUPLE = (
    "bridge", "gather", "cartographer", "config", "editor", "fs",
    "system", "workers", "auth", "security", "topology", "offline",
    "llm", "agent", "prompts", "mcp", "remote"
)

configure_kernel = _akasa.configure
init_kernel_app = _akasa.init_app
boot_kernel = _akasa.boot
reset_kernel_state = _akasa.reset_state

# The recovery path (S8): the CLI that boots the lifeboat, the lifeboat itself, and the stdlib-only
# credential store the lifeboat loads by path. The kernel also refuses anything that would shadow
# them at import time (a same-named package directory, compiled variants, __pycache__ entries).
INSETU_PROTECTED_VFS_TARGETS = (
    ("insetu", "cli.py"),
    ("insetu", "fallback_bridge.py"),
    ("akasa/auth", "credentials.py"),
)

hooks.register_trusted_namespace("insetu.core.")
hooks.register_extension_namespace("insetu.extensions.")
register_protected_vfs_targets(*INSETU_PROTECTED_VFS_TARGETS)
for _core_mod in CORE_MODULES_TUPLE:
    register_core_module(_core_mod)

# Import the module object, not names from it. utils_core imports this SDK at its top, so when
# utils_core is imported first it is still partially initialized here; a `from ... import name`
# would fail, while a module reference resolves its attributes when they are used.
import insetu.core.utils_core as _utils_core

_UTILS_CORE_REEXPORTS = frozenset({
    "InSetuURI",
    "update_frontmatter",
    "dump_yaml_string",
    "get_domain_cache_path",
    "get_domain_data_path",
    "heal_sqlite_uri_column",
})


def __getattr__(name: str):
    """PEP 562 lazy re-export: keeps `from insetu.core.sdk import InSetuURI` working for user-space extensions."""
    if name in _UTILS_CORE_REEXPORTS:
        return getattr(_utils_core, name)
    raise AttributeError(f"module 'insetu.core.sdk' has no attribute '{name}'")


set_workspace_router = hooks.set_workspace_router


class TemplateOverlayVFSDriver(DefaultVFSDriver):
        """
        Unified Tier 2 Template Overlay VFS Driver for ctx://prompts and ctx://routines:
        - Routes ctx://<vol>/.templates/user/... via ws://default/<vol>/.templates/user/...
        - Routes ctx://<vol>/.templates/<mod>/... across active Core and Domain modules (<mod_dir>/<module_subdir>/),
            evaluating the 3-Tier Same-Name Override Cascade:
            1. Workspace Override (<workspace_control_dir>/data/<vol>/<rel>)
            2. Global User Template (ws://default/<vol>/.templates/user/<rel>)
            3. Built-in Module Template (<mod_dir>/<module_subdir>/<rel>)
        """

        def __init__(self, module_subdir: str = "prompts"):
                super().__init__()
                self.module_subdir = str(module_subdir or "prompts").strip("/")

        def ensure_global_user_templates_dir(self, workspace_id: str = "default") -> Path:
                ws_uri = f"ws://default/{self.module_subdir}/.templates/user"
                resolved = resolve_physical_path(ws_uri, workspace_id)
                user_dir = (
                        Path(resolved)
                        if resolved
                        else Path(get_tenant_control_dir("default")).joinpath("data", self.module_subdir, ".templates", "user").resolve()
                )
                os.makedirs(user_dir.as_posix(), exist_ok=True)
                return user_dir

        def resolve_module_dir(self, mod_name: str, workspace_id: Optional[str] = None) -> Optional[Path]:
                if mod_name == "user":
                        return self.ensure_global_user_templates_dir(workspace_id or "default")
                if not mod_name or not is_extension_enabled(mod_name, workspace_id):
                        return None
                insetu_root = Path(__file__).resolve().parent.parent.parent
                if is_core_module(mod_name):
                        cand = insetu_root.joinpath("core", mod_name, self.module_subdir)
                        if cand.exists() and cand.is_dir():
                                return cand.resolve()
                cand_ext = insetu_root.joinpath("extensions", mod_name, self.module_subdir)
                if cand_ext.exists() and cand_ext.is_dir():
                        return cand_ext.resolve()
                try:
                        _, ws_root = get_workspace_physics(workspace_id)
                        local_cand = Path(ws_root).joinpath(".insetu", "extensions", mod_name, self.module_subdir)
                        if local_cand.exists() and local_cand.is_dir():
                                return local_cand.resolve()
                except Exception:
                        pass
                return None

        def resolve(self, uri_obj, workspace_id, physical_target):
                rel_path = (uri_obj.path or "").lstrip("/")
                if rel_path == ".templates" or rel_path.startswith(".templates/"):
                        sub = rel_path[len(".templates"):].lstrip("/")
                        if not sub:
                                return None
                        parts = sub.split("/", 1)
                        mod_name = parts[0]
                        mod_rel = parts[1] if len(parts) > 1 else ""
                        if mod_name == "user":
                                self.ensure_global_user_templates_dir(workspace_id or "default")
                                ws_uri = f"ws://default/{self.module_subdir}/.templates/user/{mod_rel}".rstrip("/")
                                return resolve_physical_path(ws_uri, workspace_id)

                        mod_dir = self.resolve_module_dir(mod_name, workspace_id)
                        if not mod_dir:
                                return None
                        if not mod_rel:
                                return mod_dir.as_posix()

                        # 3-Tier Same-Name Override Cascade when resolving a specific template file
                        if physical_target:
                                ws_override = Path(physical_target).resolve().joinpath(mod_rel).resolve()
                                if is_subpath(ws_override, Path(physical_target).resolve()) and ws_override.is_file():
                                        return ws_override.as_posix()

                        user_dir = self.ensure_global_user_templates_dir(workspace_id or "default")
                        user_override = user_dir.joinpath(mod_rel).resolve()
                        if is_subpath(user_override, user_dir) and user_override.is_file():
                                return user_override.as_posix()

                        resolved = mod_dir.joinpath(mod_rel).resolve()
                        if not is_subpath(resolved, mod_dir):
                                return None
                        return resolved.as_posix()
                return super().resolve(uri_obj, workspace_id, physical_target)


class InSetuContext(_BaseExtensionContext):
    """Tier 2 Developer OS Extension Context with dual-root Manifest, RAG compilation, and Frontmatter helpers."""

    @property
    def db(self):
        db_wrapper = super().db
        if db_wrapper is not None and not hasattr(db_wrapper, "heal_uri_column"):
            db_wrapper.heal_uri_column = lambda table, column="filepath", default_prefix="vfs://": _utils_core.heal_sqlite_uri_column(
                db_wrapper, table, column=column, default_prefix=default_prefix
            )
        return db_wrapper

    @property
    def manifest(self) -> Dict[str, Any]:
        """Reads the centralized dual-root (vfs / ctx) manifest statelessly."""
        if not hasattr(self, '_manifest_cache'):
            ctx_manifest = self.emit_first('request_manifest', default={})
            vfs_manifest = self.emit_first('request_vfs_manifest', default={})
            self._manifest_cache = {"vfs": vfs_manifest, "ctx": ctx_manifest}
        return self._manifest_cache

    def get_manifest_files(self, target_key: Optional[str] = None) -> List[str]:
        """SSOT Helper to extract polymorphic lists of files or chunks from the manifest."""
        return self.emit_first('request_manifest_chunks', target_key=target_key, default=[])

    def save_manifest(self, manifest_data: Dict[str, Any], is_full_compile: bool = False) -> None:
        """Writes updates to the centralized context manifest."""
        self.emit('save_manifest', manifest_data=manifest_data, is_full_compile=is_full_compile)
        if hasattr(self, '_manifest_cache'):
            del self._manifest_cache
    def resolve_path(self, filepath: str, is_absolute_artifact: bool = False, must_exist: bool = False, allow_heal: bool = False) -> Optional[str]:
        if not filepath:
            return None
        uri = _utils_core.InSetuURI(filepath)
        if must_exist:
            return uri.resolve_if_exists(self.workspace_id, allow_heal=allow_heal)
        return uri.resolve(self.workspace_id, is_absolute_artifact=is_absolute_artifact)

    def is_context_on_disk(self, base_uri: str, entry: Optional[Dict[str, Any]] = None) -> bool:
        """Verifies that all constituent chunk files for a context entry physically exist on disk in the same volume as base_uri."""
        if entry is None:
            entry = self.manifest.get("ctx", {}).get(base_uri)
        if not entry or not isinstance(entry, dict):
            return False
        base_vol = _utils_core.InSetuURI(base_uri).volume
        chunks = entry.get("chunks") or [base_uri]
        if not chunks:
            return False
        for c in chunks:
            if _utils_core.InSetuURI(c).volume != base_vol:
                return False
            if not self.resolve_path(c, must_exist=True, allow_heal=False):
                return False
        return True

    def read_compiled_context(self, uri: str, manifest: Optional[Dict[str, Any]] = None) -> str:
        """Reads and concatenates all chunks of a compiled ctx:// artifact (or single VFS file) seamlessly."""
        if not uri:
            return ""
        chunks = self.emit_first('resolve_payload_chunks', uri=uri, manifest=manifest, default=[uri])
        parts = []
        for c in (chunks or [uri]):
            is_sys = _utils_core.InSetuURI(c).scheme == 'ctx'
            c_text = self.vfs.read(c, is_absolute_artifact=is_sys)
            if c_text:
                parts.append(c_text)
        return "\n\n".join(parts) if len(parts) > 1 else (parts[0] if parts else "")

    def has_missing_domain_artifacts(self, domain_type: str) -> bool:
        """Returns True if any manifest entry matching domain_type is missing its physical chunk files on disk."""
        for k, v in (self.manifest.get("ctx", {}) or {}).items():
            if isinstance(v, dict) and v.get("meta", {}).get("type") == domain_type:
                if not self.is_context_on_disk(k, v):
                    return True
        return False

    def compile_context(
        self,
        base_uri: str,
        header_block: str,
        text_blocks: List[str],
        files: List[str],
        meta: Dict[str, Any],
        max_kb: Optional[int] = None,
        is_ephemeral: bool = False
    ) -> Dict[str, Any]:
        """SDK Gateway: Compiles and chunks a RAG context payload via the core Gather engine."""
        from insetu.core.gather.engine_gather import compile_context_payload as _compile_context_payload
        return _compile_context_payload(
            self.workspace_id,
            None,
            base_uri,
            header_block,
            text_blocks,
            files,
            meta,
            max_kb=max_kb,
            is_ephemeral=is_ephemeral
        )

    def reconcile_domain(
        self,
        domain_uri_prefix: str,
        manifest_deltas: Dict[str, Any],
        domain_dir: str,
        filename_suffix: str = "_context.txt",
        target_repos: Optional[List[str]] = None
    ) -> None:
        """SDK Gateway: Flushes VFS barrier and reconciles domain manifest entries."""
        from insetu.core.utils_core import reconcile_and_vacuum_domain as _reconcile_and_vacuum_domain
        _reconcile_and_vacuum_domain(
            self,
            domain_uri_prefix=domain_uri_prefix,
            manifest_deltas=manifest_deltas,
            domain_dir=domain_dir,
            filename_suffix=filename_suffix,
            target_repos=target_repos
        )

    def create_entity_file(
        self,
        folder: str,
        title: str,
        yaml_data: Dict[str, Any],
        body_content: str = "",
        prefix: Optional[str] = None,
        filename: Optional[str] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Standardized entity generator. Creates a Markdown file with structured
        YAML frontmatter and commits it to the active tenant's VFS.
        """
        ext_id = prefix or self.ext_name[:3].lower()
        entity_id = yaml_data.get('id') or f"{ext_id}-{uuid.uuid4().hex[:8]}"
        slug = slugify(title or "untitled")
        final_filename = filename or f"{slug}-{entity_id}.md"
        clean_folder = folder.rstrip('/')
        raw_target = f"{clean_folder}/{final_filename}" if clean_folder else final_filename
        logical_path = str(_utils_core.InSetuURI(raw_target))

        now_iso = datetime.datetime.now().isoformat(timespec='seconds')
        full_yaml = {
            "id": entity_id,
            "title": title,
            "created_at": now_iso,
            "updated_at": now_iso,
            **yaml_data
        }
        if body_content and (body_content.strip().startswith("#") or not title):
            body = body_content.strip()
        else:
            body = f"## {title}\n\n{body_content}".strip()
        file_content = _utils_core.update_frontmatter(body, full_yaml)

        self.vfs.save(logical_path, file_content)
        return logical_path, full_yaml

    def update_frontmatter(self, content: str, new_data: Dict[str, Any]) -> str:
        return _utils_core.update_frontmatter(content, new_data)
# Export ExtensionContext alias pointing to InSetuContext for backward compatibility
ExtensionContext = InSetuContext

# Canonical bidirectional map between Python import specifiers and PyPI package names
EXTERNAL_DEP_SPEC_MAP: Dict[str, Tuple[str, str]] = {
    "bs4": ("bs4", "beautifulsoup4"),
    "beautifulsoup4": ("bs4", "beautifulsoup4"),
    "flask_sock": ("flask_sock", "flask-sock"),
    "flask-sock": ("flask_sock", "flask-sock"),
    "semantic_release": ("semantic_release", "python-semantic-release"),
    "python-semantic-release": ("semantic_release", "python-semantic-release"),
}


def resolve_external_dependency_spec(dep_str: str) -> Tuple[str, str]:
    """
    Normalizes an external dependency declaration into (import_specifier, pypi_package_name).
    Prevents importlib.util.find_spec() false negatives on hyphenated or aliased packages.
    """
    clean = str(dep_str or "").strip()
    if not clean:
        return "", ""
    if clean in EXTERNAL_DEP_SPEC_MAP:
        return EXTERNAL_DEP_SPEC_MAP[clean]
    return clean.replace("-", "_"), clean


class InSetuExtension(AkasaExtension):
    """Tier 2 Developer OS Blueprint wrapper supporting declarative VFS volume mounts, dependency contracts, and InSetuContext injection."""
    context_class = InSetuContext

    def __init__(
        self,
        name,
        module_name,
        title=None,
        description="",
        schema=None,
        core=False,
        settings_schema=None,
        extra_schemas=None,
        volumes: Optional[Dict[str, Dict[str, Any]]] = None,
        external_dependencies: Optional[List[str]] = None,
        external_binaries: Optional[List[str]] = None,
        post_install_commands: Optional[List[List[str]]] = None,
        requires_reboot_on_install: bool = False,
    ):
        super().__init__(
            name,
            module_name,
            title=title,
            description=description,
            schema=schema,
            core=core,
            settings_schema=settings_schema,
            extra_schemas=extra_schemas,
        )
        self.volumes = volumes or {}
        self.external_dependencies = list(external_dependencies or [])
        self.external_binaries = list(external_binaries or [])
        self.post_install_commands = list(post_install_commands or [])
        self.requires_reboot_on_install = bool(requires_reboot_on_install)
        self._mounted_workspaces = set()
        if self.volumes:
            self._validate_volume_layout()
            self._register_declarative_volumes()

    def _validate_volume_layout(self) -> None:
        """Ensures no two declared volumes resolve to the same <tier>/<ext_name>[/<subdir>] directory."""
        seen: Dict[Tuple[str, str], str] = {}
        for vol_name, vol_spec in self.volumes.items():
            key = (vol_spec.get("tier", "data"), str(vol_spec.get("subdir") or "").strip("/"))
            if key in seen:
                raise ValueError(
                    f"Extension '{self.name}': volumes '{seen[key]}' and '{vol_name}' resolve to the same "
                    f"{key[0]}/{self.name}/ directory. Declare a distinct 'subdir' for one of them."
                )
            seen[key] = vol_name
    def _resolve_volume_dir(self, workspace_id: str, vol_name: str, vol_spec: Dict[str, Any]) -> str:
        """SSOT for volume placement: <control>/<tier>/<ext_name>[/<subdir>]."""
        tier = vol_spec.get("tier", "data")
        base = (
            _utils_core.get_domain_cache_path(workspace_id, self.name)
            if tier == "cache"
            else _utils_core.get_domain_data_path(workspace_id, self.name)
        )
        subdir = str(vol_spec.get("subdir") or "").strip("/")
        if not subdir:
            return base
        target = Path(base).joinpath(*Path(subdir).parts)
        os.makedirs(target.as_posix(), exist_ok=True)
        return target.as_posix()
    def get_context(self, workspace_id: Optional[str] = None, job_id: Optional[str] = None, payload: Optional[Dict[str, Any]] = None, **kwargs) -> InSetuContext:
        wid = workspace_id or sniff_tenant_id() or "default"
        if self.volumes:
            self.mount_volumes(wid)
        return super().get_context(wid, job_id=job_id, payload=payload, **kwargs)

    def mount_volumes(self, workspace_id: Optional[str] = None, force: bool = False) -> None:
        """Mounts all declarative VFS volumes and migrates legacy directories once per workspace."""
        if not self.volumes:
            return
        wid = workspace_id or "default"
        already_migrated = (not force) and (wid in self._mounted_workspaces)
        from insetu.core.system.legacy import move_tree_contents as _move_tree_contents
        control_dir = Path(get_tenant_control_dir(wid))
        for vol_name, vol_spec in self.volumes.items():
            scheme = vol_spec.get("scheme", "ctx")
            driver = vol_spec.get("driver")
            module_subdir = vol_spec.get("module_subdir")
            legacy_dirs = vol_spec.get("legacy_dirs") or []

            if driver is not None:
                drv_instance = driver() if isinstance(driver, type) else driver
                register_driver(scheme, drv_instance, volume=vol_name)
            elif module_subdir:
                register_driver(scheme, TemplateOverlayVFSDriver(module_subdir=module_subdir), volume=vol_name)
            else:
                register_driver(scheme, DefaultVFSDriver())
            target_dir = Path(self._resolve_volume_dir(wid, vol_name, vol_spec)).resolve()
            if not already_migrated:
                for rel_legacy in legacy_dirs:
                    src_dir = control_dir.joinpath(*Path(rel_legacy).parts).resolve()
                    if src_dir != target_dir:
                        _move_tree_contents(src_dir, target_dir)

            mount_volume(wid, scheme, vol_name, target_dir.as_posix())
        self._mounted_workspaces.add(wid)

    def _register_declarative_volumes(self) -> None:
        def _declarative_request_paths(workspace_id=None, **kwargs):
            wid = workspace_id or "default"
            paths_map = {}
            for vol_name, vol_spec in self.volumes.items():
                path_key = vol_spec.get("path_key", f"{vol_name}_dir")
                paths_map[path_key] = self._resolve_volume_dir(wid, vol_name, vol_spec)
            return paths_map

        _declarative_request_paths.__name__ = f"_declarative_request_paths_{self.name}"
        self.on('request_paths')(_declarative_request_paths)

        def _declarative_workspace_boot(workspace_id=None, **kwargs):
            self.mount_volumes(workspace_id=workspace_id, force=True)

        _declarative_workspace_boot.__name__ = f"_declarative_workspace_boot_{self.name}"
        self.on('workspace_boot', priority=10)(_declarative_workspace_boot)

        def _declarative_workspace_shutdown(workspace_id=None, **kwargs):
            if workspace_id:
                self._mounted_workspaces.discard(workspace_id)

        _declarative_workspace_shutdown.__name__ = f"_declarative_workspace_shutdown_{self.name}"
        self.on('workspace_shutdown')(_declarative_workspace_shutdown)