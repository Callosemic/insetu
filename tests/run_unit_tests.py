import os
import sys
import unittest
from pathlib import Path

# Configure module search paths for isolated multi-package execution
INSETU_REPO_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = INSETU_REPO_ROOT.parent
AKASA_DIR = WORKSPACE_ROOT / "akasa"

for target_dir in [WORKSPACE_ROOT, AKASA_DIR, INSETU_REPO_ROOT]:
    if target_dir.exists():
        posix_path = target_dir.as_posix()
        if posix_path not in sys.path:
            sys.path.insert(0, posix_path)

if __name__ == "__main__":
    print("============================================================")
    print("         inSetu Developer OS & Akasa Unit Test Suite        ")
    print("============================================================\n")

    loader = unittest.TestLoader()
    start_dir = (Path(__file__).resolve().parent / "unit").as_posix()
    suite = loader.discover(start_dir=start_dir, pattern="test_*.py")

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("\n============================================================")
    if result.wasSuccessful():
        print(f"✅ SUCCESS: All {result.testsRun} unit test(s) passed.")
        sys.exit(0)
    else:
        failures = len(result.failures)
        errors = len(result.errors)
        print(f"❌ FAILED: {failures} failure(s), {errors} error(s) out of {result.testsRun} test(s).")
        sys.exit(1)