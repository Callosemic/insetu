# inSetu Extension SDK
from typing import Optional
from akasa.extension import AkasaExtension as InSetuExtension, ExtensionContext
from akasa.workers import ChainStepSchema, ChainStepArtifact, resolve_dag_chain

def _sdk_resolve_path(self, filepath: str, is_absolute_artifact: bool = False, must_exist: bool = False) -> Optional[str]:
    if not filepath:
        return None
    from insetu.core.utils_core import InSetuURI
    uri = InSetuURI.from_any(filepath)
    if must_exist:
        return uri.resolve_if_exists(self.workspace_id)
    return uri.resolve(self.workspace_id, is_absolute_artifact=is_absolute_artifact)

ExtensionContext.resolve_path = _sdk_resolve_path