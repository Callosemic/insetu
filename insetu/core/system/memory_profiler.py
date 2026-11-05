"""Process memory telemetry, garbage collection object profiling, and tracemalloc snapshot helpers."""
import gc
import os
import sys
import threading
import tracemalloc
from typing import Any, Dict, Optional

from insetu.core.utils_core import (
    get_kernel_memory_telemetry,
    reclaim_process_memory,
)


def collect_process_memory_telemetry(action: Optional[str] = None) -> Dict[str, Any]:
    """Inspects backend RAM usage, internal caches, top Python object types, and optionally triggers GC/malloc_trim or tracemalloc."""
    if action == 'trim':
        reclaim_process_memory()
    elif action == 'tracemalloc_start':
        if not tracemalloc.is_tracing():
            tracemalloc.start(10)
    elif action == 'tracemalloc_stop':
        if tracemalloc.is_tracing():
            tracemalloc.stop()

    # 1. OS Process Memory (/proc/self/status)
    proc_mem = {}
    if os.path.exists('/proc/self/status'):
        try:
            with open('/proc/self/status', 'r', encoding='utf-8') as f:
                for line in f:
                    if line.startswith(('VmRSS:', 'VmSize:', 'VmData:', 'VmPeak:', 'Threads:')):
                        k, v = line.split(':', 1)
                        proc_mem[k.strip()] = v.strip()
        except Exception:
            pass
    # 2. Internal Kernel Cache Telemetry
    caches_info = get_kernel_memory_telemetry()

    # 3. Top Python Object Types in GC
    type_counts: Dict[str, int] = {}
    type_bytes: Dict[str, int] = {}
    for obj in gc.get_objects():
        t_name = type(obj).__name__
        type_counts[t_name] = type_counts.get(t_name, 0) + 1
        try:
            type_bytes[t_name] = type_bytes.get(t_name, 0) + sys.getsizeof(obj)
        except Exception:
            pass

    top_by_size = sorted(type_bytes.items(), key=lambda x: x[1], reverse=True)[:15]
    top_objects = [
        {"type": t, "count": type_counts.get(t, 0), "shallow_mb": round(b / (1024 * 1024), 2)}
        for t, b in top_by_size
    ]

    # 4. Tracemalloc Snapshot (if enabled)
    trace_top = []
    if tracemalloc.is_tracing():
        snap = tracemalloc.take_snapshot()
        for stat in snap.statistics('lineno')[:15]:
            trace_top.append({
                "location": str(stat.traceback),
                "size_mb": round(stat.size / (1024 * 1024), 2),
                "count": stat.count
            })

    # 5. Live Thread Breakdown
    thread_groups: Dict[str, int] = {}
    for t in threading.enumerate():
        t_label = f"{type(t).__name__}:{t.name.split('-')[0].split('_')[0]}"
        thread_groups[t_label] = thread_groups.get(t_label, 0) + 1
    threads_summary = [
        {"group": k, "count": v}
        for k, v in sorted(thread_groups.items(), key=lambda x: x[1], reverse=True)
    ]
    return {
        "process": proc_mem,
        "caches": caches_info,
        "threads": threads_summary,
        "top_object_types": top_objects,
        "tracemalloc_active": tracemalloc.is_tracing(),
        "tracemalloc_top": trace_top
    }
