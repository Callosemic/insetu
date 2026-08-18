import os
from pathlib import Path
def collect_unique_files(directories, extensions):
    seen = set()
    for directory in directories:
        for root, dirs, files in os.walk(directory):
            if "vendor" in dirs: dirs.remove("vendor")
            if "node_modules" in dirs: dirs.remove("node_modules")
            for file in files:
                if any(file.endswith(ext) for ext in extensions):
                    fp = (Path(root) / file).resolve()
                    if fp not in seen:
                        seen.add(fp)
                        yield fp

# --- CONFIGURATION ---
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "insetu"
FRONTEND_DIR = BACKEND_DIR / "static" / "js"
# Whitelists for legitimate use-cases to prevent false positives
VFS_WRITE_WHITELIST = ["routes_fs.py", "fallback_bridge.py", "utils_core.py", "engine_format.py", "engine_git.py", "engine_gather.py", "cli.py", "workers.py", "engine_tracker.py", "engine_research.py", "vfs.py", "app.py", "auth.py", "engine_update.py", "engine_publish.py"]
SQLITE_WHITELIST = ["db.py", "workers.py"]  
SUBPROCESS_WHITELIST = ["engine_git.py", "engine_format.py", "cartographer.py", "cli.py", "engine_bridge.py", "bridge_vfs.py", "utils_core.py", "engine_term.py", "engine_hooks.py", "engine_topology.py", "engine_tailscale.py", "engine_update.py", "engine_publish.py"]
HEX_COLOR_WHITELIST = ["style.css"]    

class FitnessState:
    violations_found = 0
def report_violation(rule_name, filepath, line_num, message):
    FitnessState.violations_found += 1
    try:
        # Sanitize absolute local system paths to prevent environmental leakage
        rel_path = Path(filepath).resolve().relative_to(PROJECT_ROOT.resolve())
        display_path = f"[workspace]/insetu/{rel_path.as_posix()}"
    except ValueError:
        display_path = Path(filepath).as_posix()

    print(f"❌ [VIOLATION: {rule_name}] {display_path}:{line_num}")
    print(f"   ↳ {message}\n")