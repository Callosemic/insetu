"""
insetu.kernel.types
~~~~~~~~~~~~~~~~~~~
Central Tier 1 Kernel type definitions and contracts for static analysis and IDE intellisense.
"""

from typing import TypedDict, Protocol, TypeAlias, Optional, Any, List, Dict, Union
from dataclasses import dataclass

# Primitive Type Aliases
WorkspaceID: TypeAlias = str
FilePath: TypeAlias = str
TenantPath: TypeAlias = str

class FileMutationPayload(TypedDict):
    """Payload emitted by VFS mutation events."""
    filepath: FilePath
    operation: str  # 'save' | 'delete' | 'move'
    ignore_ledger: bool

class JobProgressPayload(TypedDict, total=False):
    """Payload tracking background worker progress."""
    job_id: str
    status: str  # 'pending' | 'processing' | 'completed' | 'failed'
    status_message: Optional[str]
    artifact_json: Optional[str]

class WorkspacePathsDict(TypedDict):
    """Spatial path mappings for an active tenant workspace."""
    workspace_root: TenantPath
    control_dir: TenantPath
    config_path: TenantPath
    data_dir: TenantPath
    contexts_dir: TenantPath
    diffs_dir: TenantPath

class VFSStorageEngine(Protocol):
    """Structural interface contract for VFS operations."""
    def save(self, filepath: FilePath, content: str, data: Optional[dict] = None) -> bool: ...
    def read(self, filepath: FilePath, is_absolute_artifact: bool = False) -> Optional[str]: ...
    def walk(self, directory: FilePath, exts: Optional[List[str]] = None) -> List[FilePath]: ...