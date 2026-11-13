"""Measures the running inSetu app against the response-time budgets in budgets.json.

    python tests/performance/perf_check.py                 # the app on this machine, its active workspace
    python tests/performance/perf_check.py --workspace demo --port 5006
    python tests/performance/perf_check.py --dir ~/work    # the folder that holds .insetu, when it is not the current one

It talks to the app the way the CLI does (a local handshake for the token), so it measures the workspace a
person actually uses: a test workspace with three built-in routines would pass any budget. Each check is
requested once to warm it up, then several times; the median of each part is compared to its budget.
Exit status: 0 within budget, 1 over budget, 2 the app could not be reached. Standard library only.
"""
import argparse
import json
import os
import statistics
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

BUDGETS_PATH = Path(__file__).resolve().parent / "budgets.json"
DEFAULT_PORT = 5005
TOTAL = "total"  # the budget key for the whole request, measured here; every other key is a part the app reports


def _read_json(path: Path) -> Dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def find_port(control_dir: Path, explicit: Optional[int] = None) -> int:
    """The app's port: the one given, else INSETU_PORT, else host.json, else the default."""
    if explicit:
        return int(explicit)
    env_port = os.environ.get("INSETU_PORT", "")
    if env_port.isdigit():
        return int(env_port)
    return int(_read_json(control_dir / "host.json").get("port") or DEFAULT_PORT)


def find_workspace(control_dir: Path, explicit: Optional[str] = None) -> str:
    """The workspace to measure: the one given, else the active one in workspaces.json, else 'default'."""
    return explicit or str(_read_json(control_dir / "workspaces.json").get("active_workspace") or "default")


def find_token(control_dir: Path, port: int, explicit: Optional[str] = None) -> str:
    """The session token: the one given, else INSETU_TOKEN, else the local handshake the CLI uses, else the saved file."""
    if explicit or os.environ.get("INSETU_TOKEN"):
        return explicit or os.environ["INSETU_TOKEN"]
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}/auth/bootstrap", headers={"Content-Type": "application/json"}, data=b"{}", method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            token = str(json.loads(response.read().decode("utf-8")).get("token") or "")
            if token:
                return token
    except (OSError, ValueError):
        pass
    try:
        return (control_dir / "auth" / "session_token").read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def fetch(port: int, workspace: str, path: str, token: str) -> Tuple[float, Dict[str, Any]]:
    """Requests one API path and returns (milliseconds it took, the JSON it returned)."""
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}/api/{workspace}/{path.lstrip('/')}",
        headers={"X-InSetu-Token": token, "X-Workspace-ID": workspace},
    )
    started = time.perf_counter()
    with urllib.request.urlopen(request, timeout=60) as response:
        body = response.read()
    elapsed_ms = (time.perf_counter() - started) * 1000
    payload = json.loads(body.decode("utf-8"))
    return elapsed_ms, payload if isinstance(payload, dict) else {}


def summarize(samples: List[Tuple[float, Dict[str, Any]]]) -> Dict[str, float]:
    """The median of the whole-request time and of each part the app reported in timings_ms, across the samples."""
    measured = {TOTAL: round(statistics.median(elapsed for elapsed, _ in samples), 1)}
    parts = set()
    for _, payload in samples:
        parts.update(k for k, v in (payload.get("timings_ms") or {}).items() if isinstance(v, (int, float)))
    for part in sorted(parts):
        values = [payload["timings_ms"][part] for _, payload in samples if part in (payload.get("timings_ms") or {})]
        measured[part] = round(statistics.median(values), 1)
    return measured


def over_budget(measured: Dict[str, float], budget: Dict[str, float]) -> List[str]:
    """One line per budgeted part that ran over, or that the app no longer reports (so a budget cannot go quiet)."""
    problems = []
    for part, limit in budget.items():
        if part not in measured:
            problems.append(f"{part}: budgeted at {limit} ms, but the app did not report it")
        elif measured[part] > limit:
            problems.append(f"{part}: {measured[part]} ms, over its budget of {limit} ms")
    return problems


def run_check(check: Dict[str, Any], fetch_path: Callable[[str], Tuple[float, Dict[str, Any]]]) -> Tuple[Dict[str, float], List[str]]:
    """Warms a check up, samples it, and returns (medians, the parts over budget)."""
    for _ in range(int(check.get("warmups", 1))):
        fetch_path(check["path"])
    samples = [fetch_path(check["path"]) for _ in range(max(1, int(check.get("samples", 3))))]
    measured = summarize(samples)
    return measured, over_budget(measured, check.get("budget_ms") or {})


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Measure the running inSetu app against its response-time budgets.")
    parser.add_argument("--dir", default=".", help="the folder that holds .insetu (default: the current folder)")
    parser.add_argument("--port", type=int, help="the app's port (default: INSETU_PORT, host.json, then 5005)")
    parser.add_argument("--workspace", help="the workspace to measure (default: the active one)")
    parser.add_argument("--token", help="the session token (default: INSETU_TOKEN, then a local handshake)")
    parser.add_argument("--budgets", default=BUDGETS_PATH.as_posix(), help="the budgets file")
    args = parser.parse_args(argv)

    control_dir = Path(args.dir).expanduser().resolve() / ".insetu"
    port = find_port(control_dir, args.port)
    workspace = find_workspace(control_dir, args.workspace)
    token = find_token(control_dir, port, args.token)
    checks = _read_json(Path(args.budgets)).get("checks") or []
    if not checks:
        print(f"perf_check: no checks found in {args.budgets}.")
        return 2
    if not token:
        print(f"perf_check: could not get a session token from the app on port {port}. Is it running? (--port, --token)")
        return 2

    print(f"Measuring workspace '{workspace}' on port {port}.")
    failed = False
    for check in checks:
        try:
            measured, problems = run_check(check, lambda path: fetch(port, workspace, path, token))
        except (OSError, ValueError) as exc:
            print(f"\nperf_check: '{check.get('name')}' could not be measured: {exc}")
            return 2
        budget = check.get("budget_ms") or {}
        print(f"\n{check.get('name')}  ({check['path']}, median of {max(1, int(check.get('samples', 3)))})")
        for part in [TOTAL] + sorted(k for k in set(measured) | set(budget) if k != TOTAL):
            took = f"{measured[part]:>8.1f} ms" if part in measured else "    not reported"
            limit = f"budget {budget[part]:>6} ms" if part in budget else "no budget"
            flag = "  OVER" if any(p.startswith(f"{part}:") for p in problems) else ""
            print(f"  {part:<18}{took}   {limit}{flag}")
        failed = failed or bool(problems)
    print("\nOver budget: see the lines marked OVER." if failed else "\nWithin budget.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
