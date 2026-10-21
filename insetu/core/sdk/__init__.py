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
from akasa.utils import slugify, thread_safe_cache, register_core_module
from insetu.core.utils_core import CORE_MODULES_TUPLE

hooks.register_trusted_namespace("insetu.core.")
hooks.register_extension_namespace("insetu.extensions.")
for _core_mod in CORE_MODULES_TUPLE:
    register_core_module(_core_mod)
from akasa.vfs import mount_volume, register_driver, DefaultVFSDriver, set_mount_authorizer
from akasa.workers import ChainStepSchema, ChainStepArtifact, resolve_dag_chain, run_parallel
from insetu.core.utils_core import (
    InSetuURI,
    update_frontmatter,
    get_tenant_control_dir,
    get_domain_cache_path,
    get_domain_data_path,
    heal_sqlite_uri_column,
    sniff_tenant_id,
)

set_workspace_router = hooks.set_workspace_router


class InSetuContext(_BaseExtensionContext):
    """Tier 2 Developer OS Extension Context with dual-root Manifest, RAG compilation, and Frontmatter helpers."""

    @property
    def db(self):
        db_wrapper = super().db
        if db_wrapper is not None and not hasattr(db_wrapper, "heal_uri_column"):
            db_wrapper.heal_uri_column = lambda table, column="filepath", default_prefix="vfs://": heal_sqlite_uri_column(
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
    def resolve_path(self, filepath: str, is_absolute_artifact: bool = False, must_exist: bool = False, allow_heal: bool = True) -> Optional[str]:
        if not filepath:
            return None
        uri = InSetuURI(filepath)
        if must_exist:
            return uri.resolve_if_exists(self.workspace_id, allow_heal=allow_heal)
        return uri.resolve(self.workspace_id, is_absolute_artifact=is_absolute_artifact)

    def is_context_on_disk(self, base_uri: str, entry: Optional[Dict[str, Any]] = None) -> bool:
        """Verifies that all constituent chunk files for a context entry physically exist on disk in the same volume as base_uri."""
        if entry is None:
            entry = self.manifest.get("ctx", {}).get(base_uri)
        if not entry or not isinstance(entry, dict):
            return False
        base_vol = InSetuURI(base_uri).volume
        chunks = entry.get("chunks") or [base_uri]
        if not chunks:
            return False
        for c in chunks:
            if InSetuURI(c).volume != base_vol:
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
            is_sys = InSetuURI(c).scheme == 'ctx'
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
        logical_path = str(InSetuURI(raw_target))

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
        file_content = update_frontmatter(body, full_yaml)

        self.vfs.save(logical_path, file_content)
        return logical_path, full_yaml

    def update_frontmatter(self, content: str, new_data: Dict[str, Any]) -> str:
        return update_frontmatter(content, new_data)


# Export ExtensionContext alias pointing to InSetuContext for backward compatibility
ExtensionContext = InSetuContext


class InSetuExtension(AkasaExtension):
    """Tier 2 Developer OS Blueprint wrapper supporting declarative VFS volume mounts and InSetuContext injection."""
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
            get_domain_cache_path(workspace_id, self.name)
            if tier == "cache"
            else get_domain_data_path(workspace_id, self.name)
        )
        subdir = str(vol_spec.get("subdir") or "").strip("/")
        if not subdir:
            return base
        target = Path(base).joinpath(*Path(subdir).parts)
        os.makedirs(target.as_posix(), exist_ok=True)
        return target.as_posix()
    def get_context(self, workspace_id: Optional[str] = None, job_id: Optional[str] = None) -> InSetuContext:
        wid = workspace_id or sniff_tenant_id() or "default"
        if self.volumes:
            self.mount_volumes(wid)
        return super().get_context(wid, job_id=job_id)

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
            legacy_dirs = vol_spec.get("legacy_dirs") or []

            if driver is not None:
                drv_instance = driver() if isinstance(driver, type) else driver
                register_driver(scheme, drv_instance, volume=vol_name)
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