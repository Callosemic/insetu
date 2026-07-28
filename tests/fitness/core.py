from pathlib import Path

# --- CONFIGURATION ---
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "insetu"
FRONTEND_DIR = BACKEND_DIR / "static" / "js"

# Whitelists for legitimate use-cases to prevent false positives
VFS_WRITE_WHITELIST = ["routes_fs.py", "fallback_bridge.py", "utils_core.py", "engine_format.py", "engine_git.py", "engine_gather.py", "cli.py", "workers.py", "engine_tracker.py", "engine_research.py"]
SQLITE_WHITELIST = ["db.py", "workers.py"] 
SUBPROCESS_WHITELIST = ["engine_git.py", "engine_format.py", "cartographer.py", "cli.py", "engine_bridge.py", "bridge_vfs.py", "utils_core.py", "engine_term.py", "engine_hooks.py"]
HEX_COLOR_WHITELIST = ["style.css"] 

class FitnessState:
    violations_found = 0

def report_violation(rule_name, filepath, line_num, message):
    FitnessState.violations_found += 1
    print(f"❌ [VIOLATION: {rule_name}] {filepath}:{line_num}")
    print(f"   ↳ {message}\n")