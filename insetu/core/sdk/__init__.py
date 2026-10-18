# inSetu Extension SDK
import datetime
import uuid
from typing import Optional, List, Dict, Any, Tuple
from akasa.extension import AkasaExtension as InSetuExtension, ExtensionContext
from akasa.utils import slugify
from akasa.workers import ChainStepSchema, ChainStepArtifact, resolve_dag_chain
from insetu.core.utils_core import InSetuURI, update_frontmatter
def _sdk_resolve_path(self, filepath: str, is_absolute_artifact: bool = False, must_exist: bool = False) -> Optional[str]:
    if not filepath:
        return None
    uri = InSetuURI(filepath)
    if must_exist:
        return uri.resolve_if_exists(self.workspace_id)
    return uri.resolve(self.workspace_id, is_absolute_artifact=is_absolute_artifact)


def _sdk_is_context_on_disk(self, base_uri: str, entry: Optional[Dict[str, Any]] = None) -> bool:
    """Verifies that all constituent chunk files for a context entry physically exist on disk."""
    if entry is None:
        entry = self.manifest.get("ctx", {}).get(base_uri)
    if not entry or not isinstance(entry, dict):
        return False
    chunks = entry.get("chunks") or [base_uri]
    return all(bool(self.resolve_path(c, must_exist=True)) for c in chunks)


def _sdk_compile_context(
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


def _sdk_reconcile_domain(
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
def _sdk_create_entity_file(
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
def _sdk_update_frontmatter(self, content: str, new_data: Dict[str, Any]) -> str:
    return update_frontmatter(content, new_data)


ExtensionContext.resolve_path = _sdk_resolve_path
ExtensionContext.is_context_on_disk = _sdk_is_context_on_disk
ExtensionContext.compile_context = _sdk_compile_context
ExtensionContext.reconcile_domain = _sdk_reconcile_domain
ExtensionContext.create_entity_file = _sdk_create_entity_file
ExtensionContext.update_frontmatter = _sdk_update_frontmatter