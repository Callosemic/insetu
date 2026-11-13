"""Times the named steps of one request, so a slow response can say which part was slow."""
import time
from typing import Any, Dict


class StepTimer:
    """Records how long each step took, in milliseconds, measured from the previous mark (or from creation).

    `mark` returns the value it is given, so a step can be timed where it is assigned:
    `rows = timer.mark("load_rows", load_rows())`. Nested calls are marked inside out, in the order they finish.
    """

    def __init__(self) -> None:
        self.ms: Dict[str, float] = {}
        self._last = time.perf_counter()

    def mark(self, step: str, value: Any = None) -> Any:
        now = time.perf_counter()
        self.ms[step] = round(self.ms.get(step, 0.0) + (now - self._last) * 1000, 1)
        self._last = now
        return value
