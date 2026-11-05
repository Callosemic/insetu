import os
import sys
import unittest
import unittest.util
from pathlib import Path

# Prevent unittest from dumping entire source files into the terminal on assertion failures
unittest.util._MAX_LENGTH = 300

# Configure module search paths for isolated multi-package execution
INSETU_REPO_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = INSETU_REPO_ROOT.parent
AKASA_DIR = WORKSPACE_ROOT / "akasa"

for target_dir in [WORKSPACE_ROOT, AKASA_DIR, INSETU_REPO_ROOT]:
    if target_dir.exists():
        posix_path = target_dir.as_posix()
        if posix_path not in sys.path:
            sys.path.insert(0, posix_path)

LAST_FAILED_CACHE = INSETU_REPO_ROOT / ".insetu" / "cache" / "last_failed_tests.json"


def _iter_tests(suite):
    for item in suite:
        if isinstance(item, unittest.TestSuite):
            yield from _iter_tests(item)
        else:
            yield item


if __name__ == "__main__":
    import json as _json

    raw_args = sys.argv[1:]
    only_last_failed = any(a in ("--lf", "--failed", "--last-failed") for a in raw_args)
    quiet_mode = any(a in ("-q", "--quiet") for a in raw_args)
    patterns = []
    skip_next = False
    for idx, a in enumerate(raw_args):
        if skip_next:
            skip_next = False
            continue
        if a == "-k" and idx + 1 < len(raw_args):
            patterns.append(raw_args[idx + 1])
            skip_next = True
        elif not a.startswith("-"):
            patterns.append(a)

    if not quiet_mode:
        print("============================================================")
        print("         inSetu Developer OS & Akasa Unit Test Suite        ")
        print("============================================================\n")

    loader = unittest.TestLoader()
    start_dir = (Path(__file__).resolve().parent / "unit").as_posix()
    full_suite = loader.discover(start_dir=start_dir, pattern="test_*.py")

    if only_last_failed and LAST_FAILED_CACHE.is_file():
        try:
            failed_ids = set(_json.loads(LAST_FAILED_CACHE.read_text(encoding="utf-8")))
        except Exception:
            failed_ids = set()
        if failed_ids:
            filtered_suite = unittest.TestSuite(
                [t for t in _iter_tests(full_suite) if t.id() in failed_ids]
            )
            print(f"🔁 Re-running {filtered_suite.countTestCases()} previously failed test(s): {sorted(failed_ids)}\n")
            suite = filtered_suite
        else:
            print("ℹ️  No failed tests recorded in last run; running full suite.\n")
            suite = full_suite
    elif patterns:
        suite = unittest.TestSuite(
            [
                t for t in _iter_tests(full_suite)
                if any(p.lower() in t.id().lower() for p in patterns)
            ]
        )
        print(f"🎯 Running {suite.countTestCases()} test(s) matching {patterns}\n")
    else:
        suite = full_suite

    runner = unittest.TextTestRunner(
        stream=sys.stdout,
        verbosity=0 if quiet_mode else 2,
    )
    result = runner.run(suite)
    if quiet_mode and not result.wasSuccessful():
        runner.stream.writeln("")
        result.printErrors()

    new_failed_ids = sorted(
        {test.id() for test, _ in (list(result.failures) + list(result.errors)) if hasattr(test, "id")}
    )
    try:
        LAST_FAILED_CACHE.parent.mkdir(parents=True, exist_ok=True)
        LAST_FAILED_CACHE.write_text(_json.dumps(new_failed_ids, indent=2), encoding="utf-8")
    except Exception:
        pass

    print("\n============================================================")
    if result.wasSuccessful():
        print(f"✅ SUCCESS: All {result.testsRun} unit test(s) passed.")
        sys.exit(0)
    else:
        failures = len(result.failures)
        errors = len(result.errors)
        print(f"❌ FAILED: {failures} failure(s), {errors} error(s) out of {result.testsRun} test(s).")
        print("💡 Tip: Run `python3 tests/run_unit_tests.py --lf` to re-run only the failed test(s).")
        sys.exit(1)