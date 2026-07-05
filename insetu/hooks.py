import threading

class HookRegistry:
    """The central Event Bus for the inSetu Micro-Kernel."""
    
    def __init__(self):
        self._hooks = {}
        self._lock = threading.Lock()

    def on(self, event_name):
        """Decorator for extensions to subscribe to OS lifecycle events."""
        def decorator(func):
            with self._lock:
                if event_name not in self._hooks:
                    self._hooks[event_name] = []
                self._hooks[event_name].append(func)
            return func
        return decorator

    def emit(self, event_name, *args, **kwargs):
        """Core OS trigger to broadcast payloads to all subscribed extensions."""
        with self._lock:
            callbacks = self._hooks.get(event_name, []).copy()
        results = []
        for cb in callbacks:
            try:
                results.append(cb(*args, **kwargs))
            except Exception as e:
                print(f"⚠️ [Event Bus] Error in '{event_name}' callback {cb.__name__}: {e}")
        return results

    def emit_background(self, event_name, *args, **kwargs):
        """Dispatches long-running hooks to a background thread to prevent blocking."""
        with self._lock:
            callbacks = self._hooks.get(event_name, []).copy()

        def _run_hooks():
            for cb in callbacks:
                try:
                    cb(*args, **kwargs)
                except Exception as e:
                    print(f"⚠️ [Event Bus] Error in async '{event_name}' callback {cb.__name__}: {e}")

        if callbacks:
            threading.Thread(target=_run_hooks, daemon=True).start()

# The Singleton Event Bus
hooks = HookRegistry()