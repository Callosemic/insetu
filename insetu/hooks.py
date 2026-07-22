import threading
from typing import TypedDict, Optional, List, Dict, Any, Union

# --- EVENT BUS PAYLOAD CONTRACTS ---
# These TypedDicts serve as machine-readable documentation for extension authors (and LLMs)
# to guarantee exact kwarg keys when hooking into OS lifecycle events.

class HookPayload_MutateWorkspaceConfig(TypedDict, total=False):
    cfg: Dict[str, Any]
    workspace_id: Optional[str]

class HookPayload_CompileContexts(TypedDict, total=False):
    manifest: Dict[str, Any]
    workspace_id: Optional[str]
    target_repos: Optional[List[str]]
    touched_buckets: Optional[List[str]]
    is_full_sweep: Optional[Union[bool, List[str]]]

class HookPayload_PreCompileDocument(TypedDict, total=False):
    filepath: str
    text: str
    workspace_id: Optional[str]

class HookPayload_RequestChangelogSuggestions(TypedDict, total=False):
    repo: str
    workspace_id: Optional[str]

class HookPayload_VFSTransactionCommitted(TypedDict, total=False):
    files: List[str]
    workspace_id: Optional[str]

class HookPayload_FileMutation(TypedDict, total=False):
    filepath: str
    workspace_id: Optional[str]

class HookPayload_WorkspaceScoped(TypedDict, total=False):
    workspace_id: Optional[str]


class HookRegistry:
    """The central Event Bus for the inSetu Micro-Kernel."""
    
    def __init__(self):
        self._hooks = {}
        self._lock = threading.Lock()
    def on(self, event_name, priority=50):
        """Decorator for extensions to subscribe to OS lifecycle events."""
        def decorator(func):
            with self._lock:
                if event_name not in self._hooks:
                    self._hooks[event_name] = []
                self._hooks[event_name].append((priority, func))
                self._hooks[event_name].sort(key=lambda item: item[0])
            return func
        return decorator

    def _is_authorized(self, cb, event_name, workspace_id):
        """Boundary filter: checks if the callback's module is enabled in the active tenant scope."""
        # Prevent blocking OS boot/shutdown or the config generation loop itself
        if event_name in ['system_boot', 'system_shutdown', 'mutate_workspace_config']:
            return True

        mod = cb.__module__
        if not mod: return True

        mod_name = mod.split('.')[-1]

        # Cross-reference extension engines with the tenant's configuration
        if mod_name.startswith('engine_'):
            ext_name = mod_name.replace('engine_', '')

            # Whitelist core OS engines that are not optional extensions
            if ext_name in ['bridge', 'gather']:
                return True
            # Utilize the central utility to evaluate extension clearance statelessly
            from insetu.utils_core import is_extension_enabled
            return is_extension_enabled(ext_name, workspace_id)

        return True
    def emit(self, event_name, *args, **kwargs):
        """Core OS trigger to broadcast payloads to all subscribed extensions."""
        workspace_id = kwargs.get('workspace_id')
        with self._lock:
            callbacks = [cb for _, cb in self._hooks.get(event_name, [])]
        results = []
        for cb in callbacks:
            if not self._is_authorized(cb, event_name, workspace_id):
                continue
            try:
                results.append(cb(*args, **kwargs))
            except Exception as e:
                print(f"⚠️ [Event Bus] Error in '{event_name}' callback {cb.__name__}: {e}")
        return results

    def emit_background(self, event_name, *args, **kwargs):
        """Dispatches long-running hooks to a background thread to prevent blocking."""
        workspace_id = kwargs.get('workspace_id')
        with self._lock:
            callbacks = [cb for _, cb in self._hooks.get(event_name, [])]

        def _run_hooks():
            for cb in callbacks:
                if not self._is_authorized(cb, event_name, workspace_id):
                    continue
                try:
                    cb(*args, **kwargs)
                except Exception as e:
                    print(f"⚠️ [Event Bus] Error in async '{event_name}' callback {cb.__name__}: {e}")

        if callbacks:
            threading.Thread(target=_run_hooks, daemon=True).start()

# The Singleton Event Bus
hooks = HookRegistry()