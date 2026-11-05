from pathlib import Path
import sys

INSETU_REPO_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = INSETU_REPO_ROOT.parent
AKASA_DIR = WORKSPACE_ROOT / "akasa"

for target_dir in (WORKSPACE_ROOT, AKASA_DIR, INSETU_REPO_ROOT):
    if target_dir.exists():
        posix_path = target_dir.as_posix()
        if posix_path not in sys.path:
            sys.path.insert(0, posix_path)

from fitness import run_all
from fitness.core import FitnessState

if __name__ == "__main__":
    print("============================================================")
    print("      inSetu Architectural Fitness Functions Validator      ")
    print("============================================================\n")

    run_all()

    print("============================================================")
    if FitnessState.violations_found == 0:
        print("✅ SUCCESS: Codebase complies with all engineering standards.")
        sys.exit(0)
    else:
        print(f"❌ FAILED: Found {FitnessState.violations_found} architectural violations.")
        sys.exit(1)