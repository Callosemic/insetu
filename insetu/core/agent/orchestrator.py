import ast
import io
import json
import re
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple
from insetu.core.utils_core import InSetuURI, parse_blocks, load_yaml_string

SCRATCH_VAULT_THRESHOLD_BYTES = 256 * 1024


_BUILTIN_ROUTINES: Dict[str, Dict[str, Any]] = {
    "workspace_turn": {
        "id": "workspace_turn",
        "name": "/auto (Smart Router)",
        "slash_command": "/auto",
        "description": "Classifies user intent (or detects raw Yomama patches) and hands off execution to the matching /code, /plan, /ask, or /yomama DAG routine.",
        "default_mode": "auto",
        "modes": {
            "auto": {
                "label": "/auto (Smart Router)",
                "routine": "workspace_turn",
                "description": "Classifies whether to edit code, draft a plan, answer a question, or heal pasted Yomama patches.",
            },
            "code": {
                "label": "/code (Edit Code)",
                "routine": "code",
                "effective_intent": "EDIT_CODE",
                "description": "Runs the code DAG to generate and verify Yomama patches.",
            },
            "plan": {
                "label": "/plan (Draft Plan / Blueprint)",
                "routine": "plan",
                "effective_intent": "EDIT_PLAN",
                "description": "Runs the plan DAG to draft or refine an architectural plan.",
            },
            "ask": {
                "label": "/ask (Read-Only Q&A)",
                "routine": "ask",
                "effective_intent": "CHAT_ONLY",
                "description": "Runs the ask DAG for read-only codebase Q&A.",
            },
            "yomama": {
                "label": "/yomama (Apply & Heal Patches)",
                "routine": "yomama",
                "effective_intent": "APPLY_PATCH",
                "description": "Runs the yomama DAG to apply raw patch blocks and self-heal any anchor/syntax errors.",
            },
        },
        "nodes": [
            {
                "id": "classify_intent",
                "type": "llm",
                "tier": "fast",
                "when": "$global.has_raw_patches == False",
                "system": "Classify the user's workspace intent. Return JSON {'intent': 'EDIT_CODE' | 'EDIT_PLAN' | 'CHAT_ONLY'}.",
                "prompt": (
                    "Analyze the user prompt: $global.user_prompt\n"
                    "Determine if the user wishes to:\n"
                    "1. EDIT_CODE (modify existing source code files)\n"
                    "2. EDIT_PLAN (create or update a markdown blueprint/design doc)\n"
                    "3. CHAT_ONLY (answer a question without modifying files)\n"
                    "Respond with JSON: {\"intent\": \"EDIT_CODE\" | \"EDIT_PLAN\" | \"CHAT_ONLY\"}"
                ),
                "output_schema": "intent_classification",
                "sets_global": {"effective_intent": "$classify_intent.intent"},
            },
            {
                "id": "dispatch_routine",
                "type": "routine",
                "parents": ["classify_intent"],
                "routine_key": "$global.effective_intent",
                "routine_map": {
                    "EDIT_CODE": "code",
                    "EDIT_PLAN": "plan",
                    "CHAT_ONLY": "ask",
                    "APPLY_PATCH": "yomama",
                },
            },
        ],
    },
    "code": {
        "id": "code",
        "name": "/code (Edit Code)",
        "slash_command": "/code",
        "description": "Assembles context, generates Yomama patches in the thinking tier, and commits with AST verification and self-healing.",
        "default_mode": "code",
        "nodes": [
            {"id": "fetch_context", "type": "exec", "action": "gather.pack_selection"},
            {
                "id": "generate_patch",
                "type": "llm",
                "tier": "thinking",
                "parents": ["fetch_context"],
                "use_history": True,
                "prompt": "Apply the user instruction ($global.user_prompt) to the workspace codebase.\nContext:\n$fetch_context.content",
                "output_schema": "yomama_patch",
            },
            {"id": "apply_and_verify", "type": "exec", "action": "bridge.sync", "parents": ["generate_patch"]},
        ],
    },
    "plan": {
        "id": "plan",
        "name": "/plan (Draft Plan / Blueprint)",
        "slash_command": "/plan",
        "description": "Assembles workspace context and drafts or refines an architectural blueprint in the thinking tier without modifying source files.",
        "default_mode": "plan",
        "nodes": [
            {"id": "fetch_context", "type": "exec", "action": "gather.pack_selection"},
            {
                "id": "generate_plan",
                "type": "llm",
                "tier": "thinking",
                "parents": ["fetch_context"],
                "use_history": True,
                "system": "You are the inSetu AI Developer OS Architect. Produce a structured, grounded implementation plan or blueprint.",
                "prompt": "Draft or refine the architectural plan for: $global.user_prompt\nContext:\n$fetch_context.content",
            },
        ],
    },
    "ask": {
        "id": "ask",
        "name": "/ask (Read-Only Q&A)",
        "slash_command": "/ask",
        "description": "Assembles workspace context and answers questions in the standard tier without modifying files.",
        "default_mode": "ask",
        "nodes": [
            {"id": "fetch_context", "type": "exec", "action": "gather.pack_selection"},
            {
                "id": "answer_question",
                "type": "llm",
                "tier": "standard",
                "parents": ["fetch_context"],
                "use_history": True,
                "system": "You are the inSetu AI Developer OS Assistant. Answer the user's question clearly without modifying files.",
                "prompt": "Answer the user's question: $global.user_prompt\nContext:\n$fetch_context.content",
            },
        ],
    },
    "yomama": {
        "id": "yomama",
        "name": "/yomama (Apply & Heal Patches)",
        "slash_command": "/yomama",
        "description": "Applies raw Yomama SEARCH/REPLACE, RELOCATE, or RENAME patch blocks directly to the VFS, automatically healing failed anchors or syntax errors against live disk state.",
        "default_mode": "yomama",
        "nodes": [
            {"id": "apply_and_verify", "type": "exec", "action": "bridge.sync"},
        ],
    },
    "map_reduce_audit": {
        "id": "map_reduce_audit",
        "name": "Map-Reduce Multi-File Audit",
        "slash_command": "/map_reduce_audit",
        "description": "Audits each attached file in parallel using the fast tier and synthesizes a unified architectural report in the thinking tier.",
        "default_mode": "ask",
        "nodes": [
            {
                "id": "map_file_audits",
                "type": "llm",
                "tier": "fast",
                "map_over": "$global.all_context_files",
                "system": "You are a concise code auditor. Summarize key findings, risks, or anti-patterns for the given file.",
                "prompt": "Audit target file '$item' against instruction: $global.user_prompt",
            },
            {
                "id": "reduce_audit_summary",
                "type": "llm",
                "tier": "thinking",
                "parents": ["map_file_audits"],
                "system": "Synthesize individual file audit notes into a single prioritized architectural report.",
                "prompt": "User Goal: $global.user_prompt\n\nPer-File Audit Findings:\n$map_file_audits.text",
            },
        ],
    },
    "symbol_refactor": {
        "id": "symbol_refactor",
        "name": "Surgical AST Refactor",
        "slash_command": "/symbol_refactor",
        "description": "Packs target context, generates a Yomama v4 patch or AST RELOCATE/RENAME directive, and verifies syntax via the Bridge.",
        "default_mode": "code",
        "nodes": [
            {"id": "fetch_context", "type": "exec", "action": "gather.pack_selection"},
            {
                "id": "generate_patch",
                "type": "llm",
                "tier": "thinking",
                "parents": ["fetch_context"],
                "use_history": True,
                "prompt": "Execute the following surgical refactor using Yomama SEARCH/REPLACE, RELOCATE, or RENAME blocks:\n$global.user_prompt\n\nContext:\n$fetch_context.content",
                "output_schema": "yomama_patch",
            },
            {"id": "apply_and_verify", "type": "exec", "action": "bridge.sync", "parents": ["generate_patch"]},
        ],
    },
}


def _format_routine_summary(rid: str, loaded: Dict[str, Any]) -> Dict[str, Any]:
    modes_dict = loaded.get("modes") or {}
    modes_list = [
        {
            "id": m_id,
            "label": m_cfg.get("label") or f"/{m_id}",
            "routine": m_cfg.get("routine") or rid,
            "description": m_cfg.get("description") or "",
            "effective_intent": m_cfg.get("effective_intent"),
        }
        for m_id, m_cfg in modes_dict.items()
        if isinstance(m_cfg, dict)
    ]
    return {
        "id": loaded.get("id") or rid,
        "name": loaded.get("name") or rid.replace("_", " ").title(),
        "slash_command": loaded.get("slash_command") or f"/{rid}",
        "description": loaded.get("description") or "",
        "default_mode": loaded.get("default_mode") or "auto",
        "modes": modes_list,
        "node_count": len(loaded.get("nodes") or []),
    }


def list_available_routines(ctx) -> List[Dict[str, Any]]:
    """Discovers all declarative YAML routines across workspace .insetu/routines/*.yaml and built-in defaults."""
    builtin_dir = Path(__file__).resolve().parent.joinpath("routines")
    ws_dir = Path(ctx.paths["control_dir"]).joinpath("routines")
    seen_ids = set()
    routines: List[Dict[str, Any]] = []

    for search_dir in (ws_dir, builtin_dir):
        if not search_dir.exists() or not search_dir.is_dir():
            continue
        for yml_path in sorted(search_dir.glob("*.yaml")):
            rid = yml_path.stem
            if rid in seen_ids:
                continue
            try:
                loaded = load_routine_definition(ctx, rid)
                seen_ids.add(rid)
                routines.append(_format_routine_summary(rid, loaded))
            except Exception:
                continue

    for rid, builtin_def in _BUILTIN_ROUTINES.items():
        if rid not in seen_ids:
            seen_ids.add(rid)
            routines.append(_format_routine_summary(rid, builtin_def))

    return routines
def resolve_routine_mode(routine: Dict[str, Any], requested_mode: Optional[str] = None) -> Tuple[str, str, Optional[str]]:
    """
    Resolves a requested slash mode against the YAML routine's declarative `modes:` block.
    Returns (canonical_mode_id, initial_effective_intent, handoff_routine_id).
    """
    modes_map = routine.get("modes") or {}
    default_mode = str(routine.get("default_mode") or "auto").strip().lower()
    raw = str(requested_mode or default_mode).strip().lower().lstrip("/")

    if raw in modes_map and isinstance(modes_map[raw], dict):
        m_cfg = modes_map[raw]
        target_routine = m_cfg.get("routine")
        return raw, str(m_cfg.get("effective_intent") or "EDIT_CODE"), target_routine

    if default_mode in modes_map and isinstance(modes_map[default_mode], dict):
        m_cfg = modes_map[default_mode]
        return default_mode, str(m_cfg.get("effective_intent") or "EDIT_CODE"), m_cfg.get("routine")
    return raw or "auto", "EDIT_CODE", None


def load_routine_definition(ctx, routine_id: str = "workspace_turn") -> Dict[str, Any]:
    """Loads a declarative YAML routine from workspace .insetu/routines/<id>.yaml or built-in defaults."""
    clean_id = re.sub(r'[^a-zA-Z0-9_-]', '', str(routine_id or "workspace_turn"))
    ws_routine_path = Path(ctx.paths["control_dir"]).joinpath("routines", f"{clean_id}.yaml")
    builtin_routine_path = Path(__file__).resolve().parent.joinpath("routines", f"{clean_id}.yaml")

    raw_yaml = None
    if ws_routine_path.exists():
        raw_yaml = ctx.vfs.read(ws_routine_path.as_posix(), is_absolute_artifact=True)
    if not raw_yaml and builtin_routine_path.exists():
        raw_yaml = builtin_routine_path.read_text(encoding="utf-8")
    if not raw_yaml:
        if clean_id in _BUILTIN_ROUTINES:
            return json.loads(json.dumps(_BUILTIN_ROUTINES[clean_id]))
        raise FileNotFoundError(f"Agent routine '{clean_id}' not found.")
    loaded = load_yaml_string(raw_yaml)
    if not isinstance(loaded, dict) or not isinstance(loaded.get("nodes"), list):
        raise ValueError(f"Invalid routine schema in '{clean_id}.yaml': missing 'nodes' list.")
    return loaded


def _resolve_var_path(path_expr: str, chain_context: Dict[str, Any]) -> Any:
    """Resolves a dotted variable reference like 'global.mode' or 'classify_intent.intent' against chain_context."""
    parts = [p for p in str(path_expr).strip().lstrip("$").split(".") if p]
    cur: Any = chain_context
    for p in parts:
        if isinstance(cur, dict):
            cur = cur.get(p)
        else:
            return None
    return cur


def interpolate_template(template_str: str, chain_context: Dict[str, Any]) -> str:
    """Interpolates $node_id.field and ${node_id.field} placeholders from chain_context."""
    if not template_str or "$" not in template_str:
        return template_str or ""

    def _repl(match):
        expr = match.group(1) or match.group(2) or ""
        val = _resolve_var_path(expr, chain_context)
        if val is None:
            return ""
        if isinstance(val, (dict, list)):
            return json.dumps(val)
        return str(val)

    return re.sub(r'\$\{([a-zA-Z0-9_.]+)\}|\$([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)', _repl, template_str)


def evaluate_when_condition(when_expr: Optional[str], chain_context: Dict[str, Any]) -> bool:
    """
    AST-restricted, zero-eval conditional evaluator for YAML 'when' expressions.
    Supports ==, !=, in, not in, and, or, not over $var references and string/number/boolean literals.
    """
    if not when_expr or not str(when_expr).strip():
        return True

    # Replace $node.field tokens with valid Python identifiers __var_0__, __var_1__ and bind their values
    var_bindings: Dict[str, Any] = {}
    counter = 0

    def _sub_var(m):
        nonlocal counter
        expr = m.group(1)
        key = f"__var_{counter}__"
        counter += 1
        var_bindings[key] = _resolve_var_path(expr, chain_context)
        return key

    sanitized_expr = re.sub(r'\$([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)', _sub_var, str(when_expr).strip())
    try:
        tree = ast.parse(sanitized_expr, mode="eval")
    except SyntaxError:
        return False

    def _eval_node(node: ast.AST) -> Any:
        if isinstance(node, ast.Expression):
            return _eval_node(node.body)
        if isinstance(node, ast.Constant):
            return node.value
        if isinstance(node, ast.Name):
            if node.id in var_bindings:
                return var_bindings[node.id]
            if node.id == "true":
                return True
            if node.id == "false":
                return False
            if node.id == "null":
                return None
            return node.id
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            return not bool(_eval_node(node.operand))
        if isinstance(node, ast.BoolOp):
            if isinstance(node.op, ast.And):
                return all(bool(_eval_node(v)) for v in node.values)
            if isinstance(node.op, ast.Or):
                return any(bool(_eval_node(v)) for v in node.values)
        if isinstance(node, ast.List):
            return [_eval_node(elt) for elt in node.elts]
        if isinstance(node, ast.Tuple):
            return tuple(_eval_node(elt) for elt in node.elts)
        if isinstance(node, ast.Compare):
            left = _eval_node(node.left)
            for op, comp in zip(node.ops, node.comparators):
                right = _eval_node(comp)
                if isinstance(op, ast.Eq) and not (left == right):
                    return False
                elif isinstance(op, ast.NotEq) and not (left != right):
                    return False
                elif isinstance(op, ast.In) and not (right is not None and left in right):
                    return False
                elif isinstance(op, ast.NotIn) and not (right is None or left not in right):
                    return False
                left = right
            return True
        return False

    return bool(_eval_node(tree))


def _vault_if_oversized(ctx, node_id: str, output_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    256KB Hybrid Memory Vaulting:
    Payloads < 256KB stay in-memory; strings >= 256KB are written to ephemeral scratch storage
    via ctx.vfs.save with ignore_ledger=True and referenced via _uri.
    """
    content_str = output_dict.get("content") or output_dict.get("text") or ""
    if not isinstance(content_str, str):
        return output_dict
    byte_len = len(content_str.encode("utf-8"))
    if byte_len < SCRATCH_VAULT_THRESHOLD_BYTES:
        return output_dict
    scratch_file = ctx.jobs.write_scratch(f"scratch_{node_id}.txt", content_str, ttl_seconds=3600, owner="agent_scratch")

    vaulted = dict(output_dict)
    vaulted["_uri"] = scratch_file
    vaulted["_vaulted_bytes"] = byte_len
    return vaulted


def _topological_sort_nodes(nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    step_map = {n["id"]: n for n in nodes if isinstance(n, dict) and n.get("id")}
    ordered: List[Dict[str, Any]] = []
    visited = set()
    visiting = set()

    def visit(nid: str):
        if nid in visited or nid not in step_map:
            return
        if nid in visiting:
            return
        visiting.add(nid)
        for p in (step_map[nid].get("parents") or []):
            visit(p)
        visiting.remove(nid)
        visited.add(nid)
        ordered.append(step_map[nid])

    for n in nodes:
        if isinstance(n, dict) and n.get("id"):
            visit(n["id"])
    return ordered
def _collect_live_files_for_patch_healing(ctx, parsed_blocks: Dict[str, Any], readonly_list: List[str]) -> str:
    """Reads current disk contents of files targeted by a failed Yomama patch so the healing LLM has exact anchors."""
    snippets: List[str] = []
    for raw_file in parsed_blocks.keys():
        if raw_file in readonly_list:
            continue
        try:
            canon_uri = str(InSetuURI(raw_file))
        except Exception:
            continue
        disk_text = ctx.vfs.read(canon_uri)
        if disk_text is None:
            candidates = ctx.find_path_candidates(canon_uri)
            if candidates:
                canon_uri = candidates[0]["filepath"]
                disk_text = ctx.vfs.read(canon_uri)
        if disk_text is not None:
            snippets.append(f"=== CURRENT FILE ON DISK: {canon_uri} ===\n{disk_text}")
    return "\n\n".join(snippets)


def execute_declarative_routine(
    ctx,
    session_id: str,
    user_prompt: str,
    mode: str = "auto",
    attached_files: Optional[List[str]] = None,
    read_only_files: Optional[List[str]] = None,
    history_messages: Optional[List[Dict[str, str]]] = None,
    routine_id: str = "workspace_turn",
    is_cancelled_fn: Optional[Callable[[], bool]] = None,
    _depth: int = 0,
) -> Dict[str, Any]:
    """
    Executes a declarative YAML routine DAG for an Agent turn.
    Supports modular routine handoff (type: routine), zero-token raw patch routing (/yomama),
    and routes all LLM calls through ctx.call('llm.complete', ...) and tool actions through ctx.call(action, ...).
    """
    if _depth > 4:
        raise RuntimeError("Maximum declarative routine handoff depth (4) exceeded.")

    routine = load_routine_definition(ctx, routine_id=routine_id)
    clean_mode, initial_intent, handoff_routine = resolve_routine_mode(routine, mode)

    # Direct Mode Handoff: If workspace_turn is invoked with an explicit mode (/code, /plan, /ask, /yomama)
    # that maps to a dedicated sub-routine, hand off immediately without running router nodes.
    if (
        _depth == 0
        and routine_id == "workspace_turn"
        and clean_mode != "auto"
        and handoff_routine
        and handoff_routine != routine_id
    ):
        return execute_declarative_routine(
            ctx,
            session_id=session_id,
            user_prompt=user_prompt,
            mode=clean_mode,
            attached_files=attached_files,
            read_only_files=read_only_files,
            history_messages=history_messages,
            routine_id=handoff_routine,
            is_cancelled_fn=is_cancelled_fn,
            _depth=_depth + 1,
        )

    ordered_nodes = _topological_sort_nodes(routine.get("nodes", []))
    editable_list = list(attached_files or [])
    readonly_list = list(read_only_files or [])
    all_context_files = list(dict.fromkeys(editable_list + readonly_list))

    has_raw_patches = bool(parse_blocks(user_prompt or ""))
    if clean_mode == "auto" and has_raw_patches:
        initial_intent = "APPLY_PATCH"

    chain_context: Dict[str, Any] = {
        "global": {
            "session_id": session_id,
            "user_prompt": user_prompt,
            "mode": clean_mode,
            "effective_intent": initial_intent,
            "has_raw_patches": has_raw_patches,
            "attached_files": editable_list,
            "read_only_files": readonly_list,
            "all_context_files": all_context_files,
        }
    }

    total_nodes = len(ordered_nodes)
    final_response_text = ""
    last_transaction_id = None

    for idx, node in enumerate(ordered_nodes, start=1):
        if callable(is_cancelled_fn) and is_cancelled_fn():
            raise RuntimeError("Agent turn cancelled by user.")

        nid = node["id"]
        ntype = node.get("type", "llm")
        when_clause = node.get("when")

        if not evaluate_when_condition(when_clause, chain_context):
            chain_context[nid] = {"status": "skipped"}
            continue

        ctx.jobs.update_progress(f"Step {idx}/{total_nodes} [{nid}]: Running...")
        # --- 0. ROUTINE HANDOFF NODE (Modular Sub-DAG Delegation) ---
        if ntype == "routine":
            routine_key_expr = node.get("routine_key") or "$global.effective_intent"
            resolved_key = (
                _resolve_var_path(routine_key_expr, chain_context)
                if isinstance(routine_key_expr, str) and routine_key_expr.startswith("$")
                else routine_key_expr
            )
            routine_map = node.get("routine_map") or {}
            target_sub_routine = routine_map.get(str(resolved_key)) or node.get("routine")
            if not target_sub_routine:
                chain_context[nid] = {"status": "skipped", "reason": f"No sub-routine mapped for key '{resolved_key}'"}
                continue

            ctx.jobs.update_progress(f"Step {idx}/{total_nodes} [{nid}]: Handing off to '{target_sub_routine}' DAG...")
            sub_res = execute_declarative_routine(
                ctx,
                session_id=session_id,
                user_prompt=user_prompt,
                mode=clean_mode,
                attached_files=editable_list,
                read_only_files=readonly_list,
                history_messages=history_messages,
                routine_id=target_sub_routine,
                is_cancelled_fn=is_cancelled_fn,
                _depth=_depth + 1,
            )
            final_response_text = sub_res.get("response") or final_response_text
            last_transaction_id = sub_res.get("transaction_id") or last_transaction_id
            chain_context[nid] = {
                "status": "completed",
                "sub_routine": target_sub_routine,
                "response": final_response_text,
                "transaction_id": last_transaction_id,
                "sub_context": sub_res.get("chain_context", {}),
            }
            continue

        # --- 1. EXEC NODE (Deterministic Capability Invocation via ctx.call) ---
        if ntype == "exec":
            action = node.get("action", "")
            if action == "gather.pack_selection":
                if not all_context_files:
                    chain_context[nid] = {"status": "completed", "content": "", "base_filename": None}
                    continue
                pack_artifact = ctx.call(
                    "gather.pack_selection",
                    items=[{"filepath": f} for f in all_context_files],
                    gather_only=True,
                    wait=True,
                )
                base_filename = pack_artifact.get("base_filename") if isinstance(pack_artifact, dict) else None
                packed_text = ctx.read_compiled_context(base_filename) if base_filename else ""
                if readonly_list:
                    ro_header = "READ-ONLY REFERENCE FILES (Do NOT generate patches for these files):\n" + "\n".join(f"- {f}" for f in readonly_list) + "\n\n"
                    packed_text = ro_header + packed_text
                node_out = {"status": "completed", "base_filename": base_filename, "content": packed_text}
                chain_context[nid] = _vault_if_oversized(ctx, nid, node_out)
            elif action == "bridge.sync":
                gen_out = chain_context.get("generate_patch") or {}
                patch_text = gen_out.get("text") or final_response_text or (user_prompt if has_raw_patches else "")
                if "<<<<<<< " not in patch_text:
                    chain_context[nid] = {"status": "skipped", "reason": "No patch blocks in payload"}
                    continue

                max_self_heal = 3
                for heal_attempt in range(max_self_heal):
                    if callable(is_cancelled_fn) and is_cancelled_fn():
                        raise RuntimeError("Agent turn cancelled by user.")

                    parsed_blocks = parse_blocks(patch_text)
                    target_files = [
                        f for f in parsed_blocks.keys()
                        if f not in readonly_list
                    ]
                    bridge_res = ctx.call(
                        "bridge.sync",
                        text=patch_text,
                        active_files=target_files,
                        dry_run=False,
                        wait=True,
                    )
                    if isinstance(bridge_res, dict) and bridge_res.get("can_commit"):
                        last_transaction_id = bridge_res.get("transaction_id")
                        resolved_count = bridge_res.get("summary", {}).get("resolved", 0)
                        if not final_response_text:
                            healed_note = f" (after {heal_attempt} self-heal pass(es))" if heal_attempt > 0 else ""
                            final_response_text = f"✅ Applied {resolved_count} patch(es) cleanly{healed_note} (`{last_transaction_id}`)."
                        chain_context[nid] = {
                            "status": "completed",
                            "transaction_id": last_transaction_id,
                            "bridge_telemetry": bridge_res,
                        }
                        break

                    err_details = "\n".join(
                        f"- {p.get('resolved_file') or p.get('original_file')}: {p.get('error_message', '')}"
                        for p in (bridge_res.get("patches", []) if isinstance(bridge_res, dict) else [])
                        if p.get("error_message")
                    ) or (bridge_res.get("message", "Patch failed verification.") if isinstance(bridge_res, dict) else "Patch failed.")

                    if heal_attempt + 1 < max_self_heal:
                        ctx.jobs.update_progress(f"Step {idx}/{total_nodes} [{nid}]: Self-healing patch ({heal_attempt + 1}/{max_self_heal})...")
                        live_disk_context = _collect_live_files_for_patch_healing(ctx, parsed_blocks, readonly_list)
                        feedback_body = (
                            f"[SYSTEM ERROR FEEDBACK]: The following Yomama patch failed verification:\n{err_details}\n\n"
                            f"{live_disk_context}\n\n"
                            "Please fix the SEARCH/REPLACE anchors or syntax errors so they match the exact file on disk and output the corrected Yomama patch block(s)."
                        )
                        heal_messages = list(history_messages or []) + [
                            {"role": "assistant", "content": patch_text},
                            {"role": "user", "content": feedback_body},
                        ]
                        heal_llm = ctx.call(
                            "llm.complete",
                            messages=heal_messages,
                            system="You are the inSetu Yomama Patch Healer. Repair the failed patch blocks against the exact disk content provided.",
                            tier="fast",
                            output_schema="yomama_patch",
                            wait=True,
                        )
                        patch_text = heal_llm.get("text", "") if isinstance(heal_llm, dict) else str(heal_llm)
                        final_response_text = patch_text
                        chain_context["generate_patch"] = {"status": "completed", "text": patch_text}
                    else:
                        final_response_text = (final_response_text or patch_text) + f"\n\n⚠️ **Patch Verification Failed After {max_self_heal} Attempts:**\n```\n{err_details}\n```"
                        chain_context[nid] = {"status": "failed", "error": err_details, "bridge_telemetry": bridge_res}
            else:
                raw_args = node.get("args") or {}
                resolved_args = {
                    k: (interpolate_template(v, chain_context) if isinstance(v, str) else v)
                    for k, v in raw_args.items()
                }
                exec_res = ctx.call(action, wait=True, **resolved_args)
                chain_context[nid] = {"status": "completed", "result": exec_res}

        # --- 2. LLM NODE (Probabilistic Reasoning via ctx.call('llm.complete')) ---
        elif ntype == "llm":
            tier = node.get("tier", "standard")
            output_schema = node.get("output_schema")
            map_over_expr = node.get("map_over")
            raw_prompt = node.get("prompt") or ""

            if map_over_expr:
                items_to_map = _resolve_var_path(map_over_expr, chain_context) or []
                if not isinstance(items_to_map, list):
                    items_to_map = [items_to_map]

                def _run_mapped_item(item):
                    local_ctx = {**chain_context, "item": item}
                    prompt_text = interpolate_template(raw_prompt, local_ctx)
                    res = ctx.call(
                        "llm.complete",
                        messages=[{"role": "user", "content": prompt_text}],
                        tier=tier,
                        output_schema=output_schema,
                        wait=True,
                    )
                    return res.get("text", "") if isinstance(res, dict) else str(res)

                provider = ctx.settings.get("provider", "anthropic")
                if provider == "claude_cli":
                    mapped_results = [_run_mapped_item(it) for it in items_to_map]
                else:
                    mapped_results = ctx.jobs.map_parallel(_run_mapped_item, items_to_map)
                chain_context[nid] = {"status": "completed", "items": mapped_results, "text": "\n\n".join(mapped_results)}
                continue
            rendered_prompt = interpolate_template(raw_prompt, chain_context)
            node_system = interpolate_template(node.get("system") or "", chain_context)
            if not node_system:
                node_system = (
                    "You are the inSetu AI Developer OS Agent.\n"
                    "When modifying files, provide structured Yomama patch blocks:\n\n"
                    "<<<<<<< FILE: vfs://repo/path/to/file.ext\n"
                    "<<<<<<< COMMENT\n"
                    "Brief intent for this change\n"
                    "<<<<<<< SEARCH\n"
                    "[exact lines to match]\n"
                    "=======\n"
                    "[replacement lines]\n"
                    ">>>>>>> REPLACE\n"
                )
            ctx_text = (chain_context.get("fetch_context") or {}).get("content") or ""
            if ctx_text and "$fetch_context.content" not in raw_prompt:
                node_system += f"\n\n--- WORKSPACE CONTEXT ---\n{ctx_text}"

            if node.get("use_history") and history_messages:
                msgs = list(history_messages)
                if rendered_prompt and msgs[-1].get("role") == "user":
                    msgs[-1] = {"role": "user", "content": rendered_prompt}
            else:
                msgs = [{"role": "user", "content": rendered_prompt or user_prompt}]

            llm_res = ctx.call(
                "llm.complete",
                messages=msgs,
                system=node_system,
                tier=tier,
                output_schema=output_schema,
                wait=True,
            )
            reply_text = llm_res.get("text", "") if isinstance(llm_res, dict) else str(llm_res)
            parsed_payload = llm_res.get("parsed") if isinstance(llm_res, dict) else None

            node_record: Dict[str, Any] = {"status": "completed", "text": reply_text}
            if isinstance(parsed_payload, dict):
                node_record.update(parsed_payload)
                node_record["parsed"] = parsed_payload

            chain_context[nid] = _vault_if_oversized(ctx, nid, node_record)

            sets_global = node.get("sets_global")
            if isinstance(sets_global, dict):
                for g_key, g_expr in sets_global.items():
                    resolved_val = _resolve_var_path(g_expr, chain_context) if isinstance(g_expr, str) and g_expr.startswith("$") else g_expr
                    if resolved_val is not None:
                        chain_context["global"][g_key] = resolved_val
            elif output_schema != "intent_classification":
                final_response_text = reply_text

    return {
        "response": final_response_text,
        "effective_intent": chain_context["global"].get("effective_intent"),
        "mode": clean_mode,
        "transaction_id": last_transaction_id,
        "chain_context": chain_context,
    }