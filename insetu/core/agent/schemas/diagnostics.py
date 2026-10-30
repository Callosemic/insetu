"""
insetu.core.agent.schemas.diagnostics
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Unified test diagnostic contracts, JUnit XML parser, and exit-code tail slicer.
Eliminates test suite log noise and isolates failures for autonomous triage.
"""

import json
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Literal, Optional, Tuple

from insetu.core.agent.schemas.rag import strip_markdown_fences

TestStatus = Literal["PASSED", "FAILED", "ERROR", "SKIPPED"]


@dataclass
class TestFailureItem:
    """Structured record of a single failing test assertion or error."""
    test_id: str
    failure_type: str
    message: str
    traceback: str
    file: Optional[str] = None
    line: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TestDiagnosticSchema:
    """Unified test run diagnostic emitted by bridge.test and ingested by test.md."""
    status: TestStatus
    passed_count: int = 0
    failed_count: int = 0
    error_count: int = 0
    skipped_count: int = 0
    total_count: int = 0
    failures: List[TestFailureItem] = field(default_factory=list)
    raw_tail: str = ""
    runner_type: Literal["junit_xml", "tail_slice", "exit_code"] = "exit_code"
    exit_code: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def parse_junit_xml(xml_content: str, exit_code: int = 0) -> Tuple[bool, Optional[TestDiagnosticSchema], str]:
    """Parses JUnit XML output, extracting failure nodes while stripping all passing noise."""
    if not xml_content or not xml_content.strip():
        return False, None, "JUnit XML content is empty."

    try:
        root = ET.fromstring(xml_content.strip())
    except ET.ParseError as e:
        return False, None, f"Malformed JUnit XML: {e}"

    passed = 0
    failed = 0
    errors = 0
    skipped = 0
    failures: List[TestFailureItem] = []

    for tc in root.iter("testcase"):
        cname = tc.get("classname") or ""
        name = tc.get("name") or "unknown_test"
        test_id = f"{cname}.{name}" if cname else name

        fail_node = tc.find("failure")
        err_node = tc.find("error")
        skip_node = tc.find("skipped")

        if fail_node is not None:
            failed += 1
            failures.append(
                TestFailureItem(
                    test_id=test_id,
                    failure_type=fail_node.get("type") or "AssertionError",
                    message=fail_node.get("message") or "",
                    traceback=(fail_node.text or "").strip(),
                    file=tc.get("file"),
                    line=int(tc.get("line")) if tc.get("line") and tc.get("line").isdigit() else None,
                )
            )
        elif err_node is not None:
            errors += 1
            failures.append(
                TestFailureItem(
                    test_id=test_id,
                    failure_type=err_node.get("type") or "Error",
                    message=err_node.get("message") or "",
                    traceback=(err_node.text or "").strip(),
                    file=tc.get("file"),
                    line=int(tc.get("line")) if tc.get("line") and tc.get("line").isdigit() else None,
                )
            )
        elif skip_node is not None:
            skipped += 1
        else:
            passed += 1

    total = passed + failed + errors + skipped
    if failed > 0 or errors > 0:
        overall_status: TestStatus = "FAILED" if failed > 0 else "ERROR"
    else:
        overall_status = "PASSED"

    diag = TestDiagnosticSchema(
        status=overall_status,
        passed_count=passed,
        failed_count=failed,
        error_count=errors,
        skipped_count=skipped,
        total_count=total,
        failures=failures,
        runner_type="junit_xml",
        exit_code=exit_code,
    )
    return True, diag, ""


def parse_test_tail_output(output_text: str, exit_code: int = 0) -> TestDiagnosticSchema:
    """Fallback parser extracting failure slices from raw stdout/stderr when JUnit XML is absent."""
    lines = (output_text or "").splitlines()
    tail_slice = "\n".join(lines[-40:]) if len(lines) > 40 else "\n".join(lines)

    failure_lines = [
        line.strip()
        for line in lines
        if any(tok in line for tok in ("FAIL:", "ERROR:", "FAILED ", "AssertionError:", "❌ [VIOLATION:"))
    ]

    failures: List[TestFailureItem] = []
    for f_line in failure_lines[:25]:
        failures.append(
            TestFailureItem(
                test_id=f_line[:80],
                failure_type="CommandFailure" if exit_code != 0 else "Assertion",
                message=f_line,
                traceback=tail_slice[:1000],
            )
        )

    status: TestStatus = "PASSED" if exit_code == 0 and not failures else "FAILED"
    return TestDiagnosticSchema(
        status=status,
        passed_count=0 if status != "PASSED" else 1,
        failed_count=len(failures),
        error_count=0,
        skipped_count=0,
        total_count=max(1, len(failures)),
        failures=failures,
        raw_tail=tail_slice,
        runner_type="tail_slice",
        exit_code=exit_code,
    )


def get_test_diagnostic_directive() -> str:
    """Returns the prompt directive for test diagnostic responses."""
    return (
        "Respond ONLY with a valid test_diagnostic JSON object:\n"
        "{\n"
        '  "status": "PASSED" | "FAILED" | "ERROR",\n'
        '  "passed_count": 10,\n'
        '  "failed_count": 0,\n'
        '  "failures": []\n'
        "}"
    )


def validate_test_diagnostic_response(raw_text: str) -> Tuple[bool, Any, str]:
    """Validates an LLM output against the TestDiagnosticSchema contract."""
    cleaned = strip_markdown_fences(raw_text)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        return False, None, f"Invalid JSON in test diagnostic: {e}"

    if not isinstance(data, dict):
        return False, None, "Test diagnostic must be a JSON object."

    status = str(data.get("status") or "").upper()
    if status not in ("PASSED", "FAILED", "ERROR", "SKIPPED"):
        return False, None, f"Invalid test diagnostic status '{status}'."

    raw_failures = data.get("failures", [])
    failures: List[TestFailureItem] = []
    if isinstance(raw_failures, list):
        for f in raw_failures:
            if isinstance(f, dict):
                failures.append(
                    TestFailureItem(
                        test_id=str(f.get("test_id") or "test"),
                        failure_type=str(f.get("failure_type") or "Failure"),
                        message=str(f.get("message") or ""),
                        traceback=str(f.get("traceback") or ""),
                        file=f.get("file"),
                        line=f.get("line"),
                    )
                )

    result = TestDiagnosticSchema(
        status=status,  # type: ignore[arg-type]
        passed_count=int(data.get("passed_count") or 0),
        failed_count=int(data.get("failed_count") or len(failures)),
        error_count=int(data.get("error_count") or 0),
        skipped_count=int(data.get("skipped_count") or 0),
        total_count=int(data.get("total_count") or len(failures)),
        failures=failures,
        raw_tail=str(data.get("raw_tail") or ""),
        runner_type="exit_code",
        exit_code=int(data.get("exit_code") or (0 if status == "PASSED" else 1)),
    )
    return True, result.to_dict(), ""
