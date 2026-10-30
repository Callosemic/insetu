"""
insetu.core.agent.schemas.plan
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Pure standard-library Hierarchical Plan Protocol schema and markdown parser.
Enforces the Epic -> Sprint -> Task + Test Contract invariant for multi-turn plans.
"""

import json
import re
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Literal, Optional, Tuple

from insetu.core.utils_core import parse_frontmatter, update_frontmatter

PLAN_TIERS = ("epic", "sprint")


@dataclass
class PlanTask:
    """Atomic executable task with mandatory targets and test verification contract."""
    id: str
    description: str
    completed: bool = False
    transaction_id: Optional[str] = None
    targets: List[str] = field(default_factory=list)
    test_contract: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PlanSprint:
    """Sequential grouping of atomic tasks within an epic."""
    id: str
    title: str
    tasks: List[PlanTask] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PlanDocument:
    """Top-level structured representation of an active plan artifact."""
    tier: Literal["epic", "sprint"]
    title: str
    description: str = ""
    sprints: List[PlanSprint] = field(default_factory=list)
    tasks: List[PlanTask] = field(default_factory=list)
    active_task_id: Optional[str] = None
    raw_markdown: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


_TASK_LINE_RE = re.compile(
    r'^\s*-\s+\[(?P<checked>[ xX])\]\s+\[(?P<id>[a-zA-Z0-9_.-]+)\]\s+(?P<desc>[^<\n]+)(?:<!--\s*(?P<meta>.*?)\s*-->)?',
    re.MULTILINE,
)
_SPRINT_HEADING_RE = re.compile(
    r'^##\s+(?:Sprint\s+(?P<sprint_idx>\d+):\s*)?(?P<title>.+)$',
    re.MULTILINE,
)


def _parse_task_metadata(meta_str: str) -> Tuple[List[str], Optional[str], Optional[str]]:
    targets: List[str] = []
    test_contract: Optional[str] = None
    tx_id: Optional[str] = None
    if not meta_str:
        return targets, test_contract, tx_id

    for pair in meta_str.split(","):
        if ":" not in pair:
            continue
        key, val = pair.split(":", 1)
        k = key.strip().lower()
        v = val.strip()
        if k == "targets":
            targets = [t.strip() for t in v.split() if t.strip()]
        elif k in ("test_contract", "test"):
            test_contract = v
        elif k in ("tx", "tx_id", "transaction_id"):
            tx_id = v
    return targets, test_contract, tx_id


def parse_plan_markdown(raw_text: str) -> Tuple[bool, Optional[PlanDocument], str]:
    """Parses plan.md YAML frontmatter and markdown task checklists into a PlanDocument."""
    if not raw_text or not raw_text.strip():
        return False, None, "Plan content is empty."

    meta, body, _ = parse_frontmatter(raw_text)
    tier_val = str(meta.get("tier") or "sprint").strip().lower()
    if tier_val not in PLAN_TIERS:
        tier_val = "sprint"

    title_val = str(meta.get("title") or "Architectural Plan").strip()
    desc_val = str(meta.get("description") or "").strip()

    sprints: List[PlanSprint] = []
    flat_tasks: List[PlanTask] = []
    current_sprint: Optional[PlanSprint] = None

    lines = body.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        sprint_m = _SPRINT_HEADING_RE.match(line)
        if sprint_m and tier_val == "epic":
            s_idx = sprint_m.group("sprint_idx") or str(len(sprints) + 1)
            s_title = sprint_m.group("title").strip()
            current_sprint = PlanSprint(id=f"S{s_idx}", title=s_title)
            sprints.append(current_sprint)
            i += 1
            continue

        task_m = _TASK_LINE_RE.match(line)
        if task_m:
            checked = task_m.group("checked").lower() == "x"
            t_id = task_m.group("id").strip()
            desc = task_m.group("desc").strip()
            meta_tag = task_m.group("meta") or ""
            targets, test_contract, tx_id = _parse_task_metadata(meta_tag)

            tx_match = re.search(r'\(tx_([a-f0-9]+)\)', desc)
            if tx_match and not tx_id:
                tx_id = f"tx_{tx_match.group(1)}"

            task = PlanTask(
                id=t_id,
                description=desc,
                completed=checked,
                transaction_id=tx_id,
                targets=targets,
                test_contract=test_contract,
            )
            if current_sprint is not None and tier_val == "epic":
                current_sprint.tasks.append(task)
            else:
                flat_tasks.append(task)
        i += 1

    all_tasks = [t for s in sprints for t in s.tasks] if tier_val == "epic" else flat_tasks
    active_id = next((t.id for t in all_tasks if not t.completed), None)

    plan_doc = PlanDocument(
        tier=tier_val,  # type: ignore[arg-type]
        title=title_val,
        description=desc_val,
        sprints=sprints,
        tasks=flat_tasks,
        active_task_id=active_id,
        raw_markdown=raw_text,
    )
    return True, plan_doc, ""


def serialize_plan_markdown(plan: PlanDocument) -> str:
    """Serializes a PlanDocument back to canonical markdown with frontmatter."""
    fm_meta = {
        "tier": plan.tier,
        "title": plan.title,
    }
    if plan.description:
        fm_meta["description"] = plan.description
    if plan.active_task_id:
        fm_meta["active_task_id"] = plan.active_task_id

    body_lines = [f"# {plan.title}\n"]
    if plan.description:
        body_lines.append(f"{plan.description}\n")

    def _render_task_line(t: PlanTask) -> str:
        box = "x" if t.completed else " "
        tx_str = f" ({t.transaction_id})" if (t.completed and t.transaction_id) else ""
        meta_pairs = []
        if t.targets:
            meta_pairs.append(f"targets: {' '.join(t.targets)}")
        if t.test_contract:
            meta_pairs.append(f"test_contract: {t.test_contract}")
        meta_comment = f" <!-- {', '.join(meta_pairs)} -->" if meta_pairs else ""
        return f"- [{box}] [{t.id}] {t.description}{tx_str}{meta_comment}"

    if plan.tier == "epic" and plan.sprints:
        for s in plan.sprints:
            body_lines.append(f"\n## Sprint {s.id.lstrip('S')}: {s.title}\n")
            for t in s.tasks:
                body_lines.append(_render_task_line(t))
    else:
        for t in plan.tasks:
            body_lines.append(_render_task_line(t))

    return update_frontmatter("\n".join(body_lines) + "\n", fm_meta)


def get_plan_schema_directive() -> str:
    """Returns the prompt instruction directive for hierarchical plan generation."""
    return (
        "Respond with a valid inSetu Architectural Plan using markdown and YAML frontmatter:\n"
        "```markdown\n"
        "---\n"
        "tier: \"epic\" | \"sprint\"\n"
        "title: \"Title of Initiative\"\n"
        "---\n\n"
        "# Title\n\n"
        "## Sprint 1: Focus Area Title\n"
        "- [ ] [S1.T1] Task description <!-- targets: vfs://repo/file.py, test_contract: vfs://repo/tests/test_file.py::test_case -->\n"
        "```\n"
        "Every task MUST declare `targets:` (candidate vfs:// files) and `test_contract:` (unit test to verify the change)."
    )


def validate_plan_response(raw_text: str) -> Tuple[bool, Any, str]:
    """Validates an LLM output against the hierarchical plan contract."""
    ok, plan_doc, err = parse_plan_markdown(raw_text)
    if not ok or plan_doc is None:
        return False, None, err
    tasks = [t for s in plan_doc.sprints for t in s.tasks] if plan_doc.tier == "epic" else plan_doc.tasks
    if not tasks:
        return False, None, "Plan must contain at least one task item matching '- [ ] [ID] Description'."
    missing_contracts = [t.id for t in tasks if not t.targets or not t.test_contract]
    if missing_contracts:
        return (
            False,
            None,
            f"Tasks missing mandatory targets or test_contract metadata: {', '.join(missing_contracts)}",
        )
    return True, plan_doc.to_dict(), ""
