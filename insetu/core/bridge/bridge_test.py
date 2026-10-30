"""
insetu.core.bridge.bridge_test
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Post-syntax test runner diagnostic adapter for the Yomama Bridge.
Executes repository test commands, ingests JUnit XML reports, and extracts
compact test diagnostic schemas without log pollution.
"""

import os
import shlex
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, TypedDict

from insetu.core.agent.schemas.diagnostics import (
    TestDiagnosticSchema,
    parse_junit_xml,
    parse_test_tail_output,
)
from insetu.core.utils_core import get_repo_path, is_test_command_approved


def run_repo_test_diagnostics(
    ctx,
    repo: str,
    command_override: Optional[str] = None,
    target_files: Optional[List[str]] = None,
    timeout: int = 120,
) -> Dict[str, Any]:
    """
    Executes the configured test runner for repo and extracts compact diagnostics.
    A custom command_override runs only if a person approved it beforehand through
    bridge.test.approve (P5): callers cannot approve their own commands. Attempts JUnit XML
    report parsing first, and falls back to exit-code/regex tail slicing.
    """
    repo_cfg = next((c for c in ctx.config.get("target_repos", []) if c.get("repo_dir") == repo), None)
    repo_path = get_repo_path(repo, ctx.workspace_id) if repo_cfg else ctx.paths["workspace_root"]

    default_res = ctx.call("agent.resolve_test_command", repo=repo, target=" ".join(target_files or []))
    default_cmd = default_res.get("command") or "pytest -q"
    base_cmd = (command_override or "").strip() or default_cmd

    if not is_test_command_approved(ctx.workspace_id, repo, base_cmd, default_cmd):
        return {
            "status": "needs_approval",
            "error": f"Custom test command '{base_cmd}' has not been approved. A person must approve it (bridge.test.approve) before it can run.",
            "exit_code": -1,
            "returncode": -1,
            "elapsed_seconds": 0.0,
            "command": base_cmd,
            "repo": repo,
            "passed_count": 0,
            "failed_count": 0,
            "error_count": 0,
            "total_count": 0,
            "failures": [],
            "failure_batch": [],
            "failure_count": 0,
            "runner_type": "exit_code",
            "raw_tail": "",
        }

    # Ephemeral JUnit XML artifact inside the tenant cache directory
    cache_dir = Path(ctx.paths["cache_dir"])
    cache_dir.mkdir(parents=True, exist_ok=True)
    tmp_junit_path = cache_dir / f"junit_{uuid.uuid4().hex[:8]}.xml"
    tmp_junit = tmp_junit_path.as_posix()

    cmd = base_cmd
    supports_junit = False
    if "pytest" in cmd and "--junitxml" not in cmd:
        cmd = f"{cmd} --junitxml={tmp_junit}"
        supports_junit = True
    elif "cargo" in cmd and "nextest" in cmd:
        cmd = f"{cmd} --junit-path={tmp_junit}"
        supports_junit = True

    cmd_args = shlex.split(cmd)
    t0 = time.time()
    try:
        proc = ctx.exec.run(cmd_args, cwd=repo_path, timeout=timeout, check=False)
        stdout_txt = proc.stdout or ""
        stderr_txt = proc.stderr or ""
        exit_code = proc.returncode
    except Exception as e:
        stdout_txt = ""
        stderr_txt = str(e)
        exit_code = -1

    elapsed = round(time.time() - t0, 2)
    diag: Optional[TestDiagnosticSchema] = None

    if supports_junit and tmp_junit_path.exists() and tmp_junit_path.stat().st_size > 0:
        try:
            xml_text = tmp_junit_path.read_text(encoding="utf-8")
            ok, parsed_diag, _ = parse_junit_xml(xml_text, exit_code=exit_code)
            if ok and parsed_diag:
                diag = parsed_diag
        except Exception:
            pass
    if tmp_junit_path.exists():
        ctx.vfs.delete(tmp_junit, data={"is_absolute_artifact": True, "ignore_ledger": True})

    if diag is None:
        combined = f"{stdout_txt}\n{stderr_txt}".strip()
        diag = parse_test_tail_output(combined, exit_code=exit_code)

    failure_Dicts = [f.to_dict() for f in diag.failures]
    failure_lines = [f.get("message") or f.get("test_id") or "" for f in failure_Dicts if f]
    return {
        "status": diag.status,
        "exit_code": exit_code,
        "returncode": exit_code,
        "elapsed_seconds": elapsed,
        "command": base_cmd,
        "repo": repo,
        "passed_count": diag.passed_count,
        "failed_count": diag.failed_count,
        "error_count": diag.error_count,
        "total_count": diag.total_count,
        "failures": failure_Dicts,
        "failure_batch": failure_lines[:35],
        "failure_count": len(failure_lines),
        "runner_type": diag.runner_type,
        "raw_tail": diag.raw_tail,
        "stdout": stdout_txt[-16000:],
        "stderr": stderr_txt[-16000:],
        "combined_output": f"{stdout_txt[-16000:]}\n{stderr_txt[-16000:]}".strip(),
    }
