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
    kind: Literal["explore", "edit", "verify"] = "edit"

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


def should_recommend_file_upgrade(tasks: List[Dict[str, Any]], is_ephemeral: bool = True) -> bool:
    """Returns True when an ephemeral plan is complex enough (>= 4 tasks or >= 6 target files or multi-repo) to suggest promoting to a file."""
    if not is_ephemeral or not tasks:
        return False
    if len(tasks) >= 4:
        return True
    all_targets = [t for task in tasks for t in (task.get("targets") or []) if isinstance(t, str)]
    if len(set(all_targets)) >= 6:
        return True
    repos = {t.split("/")[2] for t in all_targets if t.startswith("vfs://") and len(t.split("/")) > 3}
    return len(repos) > 1 and len(tasks) >= 3


def normalize_active_plan_dict(
    raw_tasks: List[Dict[str, Any]],
    *,
    title: str = "Execution Plan",
    source_uri: str = "",
    plan_filepath: str = "",
    is_ephemeral: bool = True,
    existing_plan: Optional[Dict[str, Any]] = None,
    clamp_fn=None,
) -> Optional[Dict[str, Any]]:
    """Normalizes raw LLM or markdown task dicts into a canonical active_plan ledger, preserving completed tasks from existing_plan."""
    if not raw_tasks or not isinstance(raw_tasks, list):
        return existing_plan if isinstance(existing_plan, dict) and existing_plan.get("tasks") else None

    completed_by_id: Dict[str, Dict[str, Any]] = {}
    if isinstance(existing_plan, dict):
        for et in (existing_plan.get("tasks") or []):
            if isinstance(et, dict) and et.get("id") and et.get("completed"):
                completed_by_id[str(et["id"])] = et

    norm_tasks: List[Dict[str, Any]] = []
    seen_ids = set()
    for idx, rt in enumerate(raw_tasks):
        if not isinstance(rt, dict):
            continue
        desc = str(rt.get("description") or rt.get("title") or "").strip()
        if not desc:
            continue
        raw_id = str(rt.get("id") or rt.get("step_id") or f"T{idx + 1}").strip()
        t_id = raw_id if raw_id not in seen_ids else f"T{idx + 1}"
        seen_ids.add(t_id)
        if t_id in completed_by_id:
            norm_tasks.append(dict(completed_by_id[t_id]))
            continue
        raw_kind = str(rt.get("kind") or "edit").strip().lower()
        kind_val: Literal["explore", "edit", "verify"] = (
            raw_kind if raw_kind in ("explore", "edit", "verify") else "edit"  # type: ignore[assignment]
        )
        raw_targets = list(rt.get("targets") or rt.get("target_files") or rt.get("files") or [])
        targets = clamp_fn(raw_targets) if callable(clamp_fn) and raw_targets else [str(x) for x in raw_targets if x]
        test_c = str(rt.get("test_contract") or "").strip() or None
        norm_tasks.append(
            PlanTask(
                id=t_id,
                description=desc,
                completed=bool(rt.get("completed", False)),
                transaction_id=rt.get("transaction_id"),
                targets=targets,
                test_contract=test_c,
                kind=kind_val,
            ).to_dict()
        )

    for cid, ctask in completed_by_id.items():
        if cid not in seen_ids:
            norm_tasks.insert(0, dict(ctask))

    if not norm_tasks:
        return None

    active_id = next((t["id"] for t in norm_tasks if not t.get("completed")), None)
    return {
        "title": title or (existing_plan.get("title") if isinstance(existing_plan, dict) else "Execution Plan"),
        "source_uri": source_uri or (existing_plan.get("source_uri", "") if isinstance(existing_plan, dict) else ""),
        "plan_filepath": plan_filepath or (existing_plan.get("plan_filepath", "") if isinstance(existing_plan, dict) else ""),
        "is_ephemeral": bool(is_ephemeral and not plan_filepath),
        "recommend_file_upgrade": should_recommend_file_upgrade(norm_tasks, is_ephemeral=bool(is_ephemeral and not plan_filepath)),
        "active_task_id": active_id,
        "pending_commit_tx": (existing_plan.get("pending_commit_tx") if isinstance(existing_plan, dict) else None),
        "pending_commit_task_id": (existing_plan.get("pending_commit_task_id") if isinstance(existing_plan, dict) else None),
        "tasks": norm_tasks,
    }


def format_active_plan_meta_projection(active_plan: Optional[Dict[str, Any]]) -> str:
    """
    Projects `active_plan` for Bucket 3 (`meta`) and node prompts using Foveated Lens Decay:
    - The active task (`active_task_id`) is projected at `full` lens (complete description, targets, and test contract).
    - Completed tasks (`[x]`) and deferred future tasks (`[ ]`) are projected at `outline` lens (1-line coordinates),
      explicitly instructing the model to execute ONLY the active step in this turn.
    """
    if not isinstance(active_plan, dict) or not active_plan.get("tasks"):
        return ""
    tasks = active_plan["tasks"]
    if len(tasks) <= 1 and tasks[0].get("kind") != "explore":
        return ""
    active_id = active_plan.get("active_task_id")
    active_task = next((t for t in tasks if t.get("id") == active_id), None) or next((t for t in tasks if not t.get("completed")), None)
    if not active_task:
        return ""

    total = len(tasks)
    active_idx = next((i + 1 for i, t in enumerate(tasks) if t.get("id") == active_task.get("id")), 1)
    lines = [
        "============================================================",
        f"ACTIVE MULTI-STEP EXECUTION PLAN ({active_plan.get('title') or 'Plan'} — Step {active_idx} of {total})",
        "============================================================",
        f"🎯 CURRENT ACTIVE STEP [{active_task['id']}] (kind: {active_task.get('kind', 'edit')} — EXECUTE ONLY THIS STEP IN THIS TURN):",
        f"   Description: {active_task.get('description')}",
    ]
    if active_task.get("targets"):
        lines.append(f"   Target Files (Full Lens): {', '.join(active_task['targets'])}")
    if active_task.get("test_contract"):
        lines.append(f"   Verification Contract: {active_task['test_contract']}")
    if active_task.get("kind") == "explore":
        lines.append(
            "   Exploratory Output Note: After inspecting the codebase, include any newly discovered implementation steps "
            "or refined target files in your response so the plan can be updated for the next turn."
        )

    other_lines = []
    for t in tasks:
        tid = t.get("id")
        if tid == active_task.get("id"):
            continue
        status_mark = f"[x] (Done: {t.get('transaction_id')})" if t.get("completed") else "[ ] (DEFERRED — Do NOT implement in this turn)"
        other_lines.append(f"  - {status_mark} [{tid}] {t.get('description')}")
    if other_lines:
        lines.append("\nOTHER PLAN STEPS (Outline Lens — Context Only, Do NOT Implement in This Turn):")
        lines.extend(other_lines)
    lines.append("============================================================\n")
    return "\n".join(lines)


_TASK_MANAGE_BLOCK_RE = re.compile(
    r'(?:```(?:text|markdown|md)?[ \t]*\r?\n)?'
    r'(?:<<<<<<<[ \t]*FILE:[ \t]*(?P<file>[^\r\n]+)\r?\n)?'
    r'(?:<<<<<<<[ \t]*ID:[ \t]*[^\r\n]+\r?\n)?'
    r'(?:<<<<<<<[ \t]*COMMENT\r?\n[\s\S]*?\r?\n)?'
    r'<<<<<<<[ \t]*TASK_?MANAGE[ \t]*\r?\n'
    r'(?P<body>[\s\S]*?)\r?\n'
    r'>>>>>>>[ \t]*(?:EXECUTE|REPLACE)[ \t]*'
    r'(?:\r?\n```)?',
    re.IGNORECASE,
)

_CHECKBOX_ONLY_SEARCH_REPLACE_RE = re.compile(
    r'<<<<<<<[ \t]*FILE:[ \t]*(?P<file>[^\r\n]+\.md)\r?\n'
    r'(?:<<<<<<<[ \t]*ID:[ \t]*[^\r\n]+\r?\n)?'
    r'(?:<<<<<<<[ \t]*COMMENT\r?\n[\s\S]*?\r?\n)?'
    r'<<<<<<<[ \t]*SEARCH\r?\n'
    r'(?P<search>[\s\S]*?)\r?\n'
    r'=======\r?\n'
    r'(?P<replace>[\s\S]*?)\r?\n'
    r'>>>>>>>[ \t]*REPLACE',
    re.IGNORECASE,
)


def extract_task_manage_directives(
    raw_text: str,
    *,
    allow_checkbox_search_replace: bool = True,
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Extracts explicit `<<<<<<< TASK_MANAGE` / `<<<<<<< TASKMANAGE` blocks AND (when
    `allow_checkbox_search_replace=True`) auto-detects `SEARCH/REPLACE` blocks on `.md` files
    whose sole change is flipping `- [ ] [ID]` to `- [x] [ID]`.
    Returns `(actions_list, remaining_text_without_task_blocks)`.
    """
    if not raw_text or "<<<<<<<" not in raw_text:
        return [], raw_text or ""

    actions: List[Dict[str, Any]] = []

    def _parse_task_manage_body(body_str: str, target_file: str = "") -> None:
        for raw_ln in (body_str or "").splitlines():
            ln = raw_ln.strip()
            if not ln or ln.startswith("#"):
                continue
            upper_ln = ln.upper()
            if upper_ln.startswith(("COMPLETE:", "DONE:", "CHECK:")):
                ids_part = ln.split(":", 1)[1].strip()
                for tid in re.split(r'[,\s]+', ids_part):
                    clean_id = tid.strip().strip("[]")
                    if clean_id:
                        actions.append({"op": "complete", "task_id": clean_id, "file": target_file})
            elif upper_ln.startswith(("REOPEN:", "UNCHECK:")):
                ids_part = ln.split(":", 1)[1].strip()
                for tid in re.split(r'[,\s]+', ids_part):
                    clean_id = tid.strip().strip("[]")
                    if clean_id:
                        actions.append({"op": "reopen", "task_id": clean_id, "file": target_file})
            elif upper_ln.startswith("ACTIVE:"):
                clean_id = ln.split(":", 1)[1].strip().strip("[]")
                if clean_id:
                    actions.append({"op": "set_active", "task_id": clean_id, "file": target_file})
            elif upper_ln.startswith("DROP:"):
                clean_id = ln.split(":", 1)[1].strip().strip("[]")
                if clean_id:
                    actions.append({"op": "drop", "task_id": clean_id, "file": target_file})
            elif upper_ln.startswith(("ADD:", "UPDATE:", "EDIT:")):
                op_name = "update" if upper_ln.startswith(("UPDATE:", "EDIT:")) else "add"
                spec_str = ln.split(":", 1)[1].strip()
                parts = [p.strip() for p in spec_str.split("|") if p.strip()]
                if not parts:
                    continue
                new_id = parts[0].strip("[]")
                kind_v: Optional[str] = None
                targets_v: Optional[List[str]] = None
                test_v: Optional[str] = None
                desc_parts: List[str] = []
                for seg in parts[1:]:
                    if seg.lower().startswith("kind:"):
                        kind_v = seg.split(":", 1)[1].strip().lower()
                    elif seg.lower().startswith("targets:"):
                        targets_v = [u.strip() for u in re.split(r'[,\s]+', seg.split(":", 1)[1].strip()) if u.strip()]
                    elif seg.lower().startswith(("test:", "test_contract:")):
                        test_v = seg.split(":", 1)[1].strip()
                    else:
                        desc_parts.append(seg)
                desc_v = " — ".join(desc_parts) if desc_parts else ("" if op_name == "update" else new_id)
                act_entry: Dict[str, Any] = {
                    "op": op_name,
                    "task_id": new_id,
                    "file": target_file,
                }
                if kind_v in ("explore", "edit", "verify"):
                    act_entry["kind"] = kind_v
                elif op_name == "add":
                    act_entry["kind"] = "edit"
                if desc_v:
                    act_entry["description"] = desc_v
                if targets_v is not None:
                    act_entry["targets"] = targets_v
                elif op_name == "add":
                    act_entry["targets"] = []
                if test_v is not None or op_name == "add":
                    act_entry["test_contract"] = test_v
                actions.append(act_entry)
            else:
                m_chk = _TASK_LINE_RE.match(ln)
                if m_chk:
                    is_done = m_chk.group("checked").lower() == "x"
                    tid = m_chk.group("id").strip()
                    if is_done:
                        actions.append({"op": "complete", "task_id": tid, "file": target_file})
                    else:
                        targets, test_c, _ = _parse_task_metadata(m_chk.group("meta") or "")
                        actions.append({
                            "op": "add",
                            "task_id": tid,
                            "kind": "edit",
                            "description": m_chk.group("desc").strip(),
                            "targets": targets,
                            "test_contract": test_c,
                            "file": target_file,
                        })

    cleaned = _TASK_MANAGE_BLOCK_RE.sub(
        lambda m: (_parse_task_manage_body(m.group("body"), (m.group("file") or "").strip()) or ""),
        raw_text,
    )

    def _check_if_pure_checkbox_flip(m: re.Match) -> str:
        s_txt = (m.group("search") or "").strip()
        r_txt = (m.group("replace") or "").strip()
        f_uri = (m.group("file") or "").strip()
        s_norm = re.sub(r'^\s*-\s+\[[ xX]\]\s+', '- [ ] ', s_txt, flags=re.MULTILINE)
        r_norm = re.sub(r'^\s*-\s+\[[ xX]\]\s+', '- [ ] ', r_txt, flags=re.MULTILINE)
        r_norm_no_tx = re.sub(r'\s*\(tx_[a-zA-Z0-9_,]+\)', '', r_norm)
        if s_norm != r_norm_no_tx or s_txt == r_txt:
            return m.group(0)
        s_tasks = {tm.group("id"): (tm.group("checked").lower() == "x") for tm in _TASK_LINE_RE.finditer(s_txt)}
        r_tasks = {tm.group("id"): (tm.group("checked").lower() == "x") for tm in _TASK_LINE_RE.finditer(r_txt)}
        if not r_tasks:
            return m.group(0)
        found_flips = 0
        for tid, r_done in r_tasks.items():
            if tid in s_tasks and s_tasks[tid] != r_done:
                actions.append({"op": "complete" if r_done else "reopen", "task_id": tid, "file": f_uri})
                found_flips += 1
        return "" if found_flips > 0 else m.group(0)

    if allow_checkbox_search_replace:
        cleaned = _CHECKBOX_ONLY_SEARCH_REPLACE_RE.sub(_check_if_pure_checkbox_flip, cleaned)
    cleaned = re.sub(r'```(?:text|markdown|md)?\s*```', '', cleaned)
    return actions, cleaned.strip()


def build_promoted_plan_markdown(plan_obj: Dict[str, Any], session_id: str) -> str:
    """Serializes an ephemeral `active_plan` dictionary into canonical `PlanDocument` Markdown."""
    title = str(plan_obj.get("title") or "Execution Plan").strip()
    src = f" (source: `{plan_obj.get('source_uri')}`)" if plan_obj.get("source_uri") else ""
    plan_doc = PlanDocument(
        tier="sprint",
        title=title,
        description=f"Promoted from session `{session_id}`{src}",
        tasks=[
            PlanTask(
                id=str(t.get("id") or f"T{i + 1}"),
                description=str(t.get("description") or ""),
                completed=bool(t.get("completed", False)),
                transaction_id=t.get("transaction_id"),
                targets=list(t.get("targets") or []),
                test_contract=t.get("test_contract"),
                kind=t.get("kind") or "edit",
            )
            for i, t in enumerate(plan_obj.get("tasks") or [])
            if isinstance(t, dict)
        ],
        active_task_id=plan_obj.get("active_task_id"),
    )
    return serialize_plan_markdown(plan_doc)


def tick_task_in_plan_markdown(raw_markdown: str, task_id: str, transaction_id: Optional[str] = None) -> str:
    """Marks `- [ ] [task_id]` as `- [x] [task_id] (tx_...)` in-place inside a Markdown plan document."""
    if not raw_markdown or not task_id:
        return raw_markdown
    tx_suffix = f" ({transaction_id})" if transaction_id else ""
    pattern = re.compile(
        rf'^(\s*-\s+\[)[ xX](\]\s+\[{re.escape(task_id)}\]\s+.+?)(\s*\(tx_[a-zA-Z0-9_,]+\))?(\s*<!--.*?-->)?\s*$',
        re.MULTILINE,
    )
    if pattern.search(raw_markdown):
        return pattern.sub(rf'\g<1>x\g<2>{tx_suffix}\g<4>', raw_markdown, count=1)
    return raw_markdown


def reduce_plan_actions(
    plan_obj: Optional[Dict[str, Any]],
    actions: List[Dict[str, Any]],
    *,
    default_tx_id: Optional[str] = None,
    fallback_filepath: str = "",
) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]], Optional[Dict[str, Any]], List[Tuple[str, str, Optional[str]]]]:
    """
    Pure in-memory reducer over `active_plan` dictionary state.
    Applies `complete`, `reopen`, `add`, `drop`, `set_active`, and `stage_commit` sequentially in memory
    without any database or VFS side effects, preventing nested read-modify-write clobbering.
    Returns `(updated_plan_dict, last_completed_task, next_active_task, files_to_tick_list)`.
    """
    state: Dict[str, Any] = dict(plan_obj or {})
    tasks: List[Dict[str, Any]] = [dict(t) for t in (state.get("tasks") or []) if isinstance(t, dict)]
    explicit_active_id: Optional[str] = None
    last_completed: Optional[Dict[str, Any]] = None
    files_to_tick: List[Tuple[str, str, Optional[str]]] = []
    default_file = str(state.get("plan_filepath") or fallback_filepath or "").strip()

    for act in (actions or []):
        if not isinstance(act, dict):
            continue
        op = str(act.get("op") or "").lower()
        tid = str(
            act.get("task_id")
            or state.get("pending_commit_task_id")
            or state.get("active_task_id")
            or ""
        ).strip()
        tx_val = str(act.get("transaction_id") or state.get("pending_commit_tx") or default_tx_id or "").strip() or None
        target_f = str(act.get("file") or default_file or "").strip()

        if op == "stage_commit" and tid and tx_val:
            state["pending_commit_tx"] = tx_val
            state["pending_commit_task_id"] = tid
            for t in tasks:
                if t.get("id") == tid:
                    t["transaction_id"] = tx_val
                    break
        elif op == "complete" and tid:
            for t in tasks:
                if t.get("id") == tid:
                    t["completed"] = True
                    if tx_val:
                        t["transaction_id"] = tx_val
                    last_completed = t
                    break
            state["pending_commit_tx"] = None
            state["pending_commit_task_id"] = None
            if target_f and target_f.startswith("vfs://"):
                files_to_tick.append((target_f, tid, tx_val))
        elif op == "reopen" and tid:
            for t in tasks:
                if t.get("id") == tid:
                    t["completed"] = False
        elif op == "drop" and tid:
            tasks = [t for t in tasks if not (t.get("id") == tid and not t.get("completed"))]
        elif op == "set_active" and tid:
            explicit_active_id = tid
        elif op in ("add", "update") and tid:
            existing_t = next((t for t in tasks if t.get("id") == tid), None)
            if existing_t is not None:
                if act.get("description"):
                    existing_t["description"] = str(act["description"])
                if act.get("targets") is not None:
                    existing_t["targets"] = list(act["targets"])
                if act.get("test_contract") is not None:
                    existing_t["test_contract"] = act["test_contract"]
                if act.get("kind") in ("explore", "edit", "verify"):
                    existing_t["kind"] = act["kind"]
            else:
                new_task_dict = PlanTask(
                    id=tid,
                    description=str(act.get("description") or tid),
                    completed=False,
                    targets=list(act.get("targets") or []),
                    test_contract=act.get("test_contract"),
                    kind=act.get("kind") or "edit",
                ).to_dict()
                cur_act_id = explicit_active_id or state.get("active_task_id")
                act_idx = next((i for i, t in enumerate(tasks) if t.get("id") == cur_act_id), -1)
                if act_idx != -1 and tid.startswith(str(cur_act_id)) and len(tid) > len(str(cur_act_id)):
                    insert_pos = act_idx + 1
                    while insert_pos < len(tasks) and str(tasks[insert_pos].get("id") or "").startswith(str(cur_act_id)):
                        insert_pos += 1
                    tasks.insert(insert_pos, new_task_dict)
                else:
                    tasks.append(new_task_dict)

    if not state.get("title"):
        state["title"] = "Execution Plan"
    if "is_ephemeral" not in state:
        state["is_ephemeral"] = not bool(default_file)
    state["tasks"] = tasks
    if explicit_active_id and any(t.get("id") == explicit_active_id for t in tasks):
        state["active_task_id"] = explicit_active_id
    elif not any(a.get("op") == "stage_commit" for a in (actions or [])):
        state["active_task_id"] = next((t["id"] for t in tasks if not t.get("completed")), None)
    state["recommend_file_upgrade"] = should_recommend_file_upgrade(
        tasks, is_ephemeral=bool(state.get("is_ephemeral", not default_file))
    )
    next_task = next((t for t in tasks if t.get("id") == state.get("active_task_id")), None)
    return state, last_completed, next_task, files_to_tick
