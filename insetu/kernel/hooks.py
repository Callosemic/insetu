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
class HookPayload_VFSMutated(TypedDict, total=False):
    mutations: List[Dict[str, Any]]
    workspace_id: Optional[str]
class HookPayload_WorkspaceScoped(TypedDict, total=False):
    workspace_id: Optional[str]

class HookPayload_WorkspaceShutdown(TypedDict, total=False):
    workspace_id: Optional[str]
_event_thread_local = threading.local()

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
        mod = cb.__module__ or ""

        # Extensions are strictly banned from system_boot
        if event_name == 'system_boot' and mod.startswith('insetu.extensions.'):
            print(f"⚠️ [Event Bus] Banned hook: Extension '{mod}' attempted to subscribe to 'system_boot'. Use 'workspace_boot' instead.")
            return False

        # System lifecycle events always bypass tenant authorization
        if event_name in ['system_boot', 'system_shutdown', 'mutate_workspace_config']:
            return True

        if not mod: return True

        # Core system modules (Tier 1 & Tier 2) are always authorized
        if mod.startswith('insetu.core.') or mod.startswith('insetu.kernel.'):
            return True

        mod_name = mod.split('.')[-1]

        # Cross-reference extension engines against the central SSOT
        if mod_name.startswith('engine_'):
            ext_name = mod_name.replace('engine_', '')
            from insetu.kernel.utils import is_extension_enabled
            return is_extension_enabled(ext_name, workspace_id)

        return True
    def emit(self, event_name, *args, **kwargs):
        """Core OS trigger to broadcast payloads to all subscribed extensions."""
        import time

        # Re-entrancy Guard: Prevent infinite recursion loops on the same thread
        if not hasattr(_event_thread_local, 'active_events'):
            _event_thread_local.active_events = set()
        if event_name in _event_thread_local.active_events:
            print(f"🛡️ [Event Bus Guardrail] Blocked recursive loop on event: '{event_name}'")
            return []

        _event_thread_local.active_events.add(event_name)

        try:
            workspace_id = kwargs.get('workspace_id')
            with self._lock:
                callbacks = [cb for _, cb in self._hooks.get(event_name, [])]
            results = []
            for cb in callbacks:
                if not self._is_authorized(cb, event_name, workspace_id):
                    continue
                try:
                    t0 = time.time()
                    results.append(cb(*args, **kwargs))
                    t1 = time.time()
                    if t1 - t0 > 1.0:
                        print(f"🐌 [Event Bus Telemetry] Hook '{event_name}' -> {cb.__module__}.{cb.__name__} took {t1 - t0:.2f}s")
                except Exception as e:
                    print(f"⚠️ [Event Bus] Error in '{event_name}' callback {cb.__name__}: {e}")
            return results
        finally:
            _event_thread_local.active_events.remove(event_name)

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