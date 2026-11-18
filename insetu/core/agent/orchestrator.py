import json
import re
import secrets
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple
from insetu.core.sdk import (
    execution_frame,
    get_dynamic_read_only_capabilities,
    get_dynamic_routine_banned_capabilities,
    is_read_only_safe_capability,
    is_routine_banned_capability,
)
from insetu.core.utils_core import (
    InSetuURI, get_sister_repos,
    interpolate_mustache_chain as _interpolate_all_syntax,
    resolve_context_var_path as _resolve_var_path,
)
from insetu.core.bridge.parser import parse_blocks, strip_yomama_blocks_keep_prose
from insetu.core.topology.engine_topology import build_sys_landmarks_context, clamp_uris_to_topology
from insetu.core.gather.context_assemble import (
    assemble_context_payload, collect_workspace_secrets as _collect_secret_values_for_scrubbing,
    discover_constitution_files, pack_envelope_working_set,
)
from insetu.core.gather.rag_proximity import (
    clamp_rag_files_to_topology,
    expand_scouted_working_set_targets,
    prioritize_document_sections as _prioritize_document_sections,
)
from insetu.core.agent.envelope import RoutineEnvelope, record_trace_step
from insetu.core.agent.expressions import (
    evaluate_when_condition,
    vault_if_oversized as _vault_if_oversized,
)
from insetu.core.agent.llm_contract import (
    build_paused_for_user_response,
    build_web_chat_handoff_branch,
    collect_wavefront_handoff_branches,
    execute_llm_dag_node,
)
from insetu.core.agent.plan_ledger import execute_bridge_sync_and_test_gate
from insetu.core.agent.routine_loader import (
    compile_node_wavefronts as _compile_node_wavefronts,
    is_prose_document_uri, load_routine_definition, persist_routine_response as _persist_routine_response,
    resolve_routine_mode,
)
from insetu.core.llm.llm_telemetry import (
    DEFAULT_SESSION_BUDGET_STEP_USD,
    DEFAULT_SESSION_BUDGET_USD,
    DEFAULT_STEP_BUDGET,
    DEFAULT_TOKEN_BUDGET,
    estimate_call_cost_usd,
)

ROUTINE_BANNED_CAPABILITIES = get_dynamic_routine_banned_capabilities()
READ_ONLY_MODE_ALLOWED_CAPABILITIES = get_dynamic_read_only_capabilities()



def execute_declarative_routine(ctx, **kwargs) -> Dict[str, Any]:
    """
    Runs a declarative routine with origin 'routine' (S8): every tool call, file write and job it starts is marked as
    machine work, so protected files are held for a person and approvals are refused, whoever started the turn.
    Arguments are those of _execute_declarative_routine_body.
    """
    with execution_frame(origin="routine"):
        return _execute_declarative_routine_body(ctx, **kwargs)


def _execute_declarative_routine_body(
    ctx,
    session_id: str = "default",
    user_prompt: str = "",
    mode: str = "auto",
    attached_files: Optional[List[str]] = None,
    read_only_files: Optional[List[str]] = None,
    history_messages: Optional[List[Dict[str, str]]] = None,
    routine_id: str = "workspace_turn",
    inputs: Optional[Dict[str, Any]] = None,
    envelope: Optional[RoutineEnvelope] = None,
    progress_callback: Optional[Callable[[str], None]] = None,
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
            inputs=inputs,
            envelope=envelope.fork_sub_routine(handoff_routine) if envelope is not None else None,
            progress_callback=progress_callback,
            is_cancelled_fn=is_cancelled_fn,
            _depth=_depth,
        )
    extra_inputs = dict(inputs or {})
    if not user_prompt and extra_inputs.get("user_message"):
        user_prompt = str(extra_inputs["user_message"])
    elif not user_prompt and extra_inputs.get("user_prompt"):
        user_prompt = str(extra_inputs["user_prompt"])
    if (user_prompt or "").strip() in ("Resume Routine Handoff", "Resume from budget checkpoint"):
        if envelope is not None and envelope.user_prompt:
            user_prompt = str(envelope.user_prompt)
    routine_id_variants = {
        str(routine.get("id") or "").strip().lstrip("/").lower(),
        str(routine_id or "").strip().lstrip("/").lower(),
        str(routine.get("slash_command") or "").strip().lstrip("/").lower(),
    }
    if (user_prompt or "").strip().lstrip("/").lower() in routine_id_variants:
        user_prompt = ""

    raw_Sister = get_sister_repos(ctx.workspace_id)
    pinned_repos_in = extra_inputs.get("pinned_repos") or (envelope.pinned_repos if envelope is not None and envelope.pinned_repos else ["ALL"])
    all_sister_repos = (
        raw_Sister
        if ("ALL" in pinned_repos_in or not pinned_repos_in)
        else [r for r in raw_Sister if r in pinned_repos_in]
    ) or raw_Sister

    wavefronts = _compile_node_wavefronts(routine.get("nodes", []))
    ordered_nodes = [n for wave in wavefronts for n in wave]
    seed_editable = clamp_uris_to_topology(
        ctx.workspace_id,
        list(attached_files or extra_inputs.get("attached_files") or (envelope.editable_files if envelope is not None else []) or []),
        expand_dirs=True,
    )
    seed_readonly = clamp_uris_to_topology(
        ctx.workspace_id,
        list(read_only_files or extra_inputs.get("read_only_files") or (envelope.readonly_files if envelope is not None else []) or []),
        expand_dirs=True,
    )
    routine_includes = clamp_uris_to_topology(
        ctx.workspace_id,
        list(routine.get("includes") or []),
        expand_dirs=True,
    )
    prompt_mentioned_uris = re.findall(r'vfs://[A-Za-z0-9_./-]+', user_prompt or "")
    if prompt_mentioned_uris:
        for p_uri in clamp_rag_files_to_topology(ctx, prompt_mentioned_uris, allowed_repos=all_sister_repos, allow_genesis=True):
            if p_uri not in seed_editable and p_uri not in seed_readonly:
                seed_editable.append(p_uri)
    prompt_file_names = re.findall(
        r'(?<![A-Za-z0-9_./:-])[A-Za-z][A-Za-z0-9_.-]*\.(?:md|markdown|txt)\b',
        user_prompt or "",
        flags=re.IGNORECASE,
    )
    if prompt_file_names:
        for file_cand in clamp_rag_files_to_topology(ctx, prompt_file_names, allowed_repos=all_sister_repos):
            if file_cand not in seed_editable and file_cand not in seed_readonly:
                seed_editable.append(file_cand)

    handoff_responses = dict(extra_inputs.get("handoff_responses") or {})
    prior_sent_hashes: Dict[str, str] = dict(
        extra_inputs.get("web_chat_sent_hashes")
        or (envelope.sent_hashes if envelope is not None else {})
        or {}
    )
    if handoff_responses and envelope is not None and envelope.staged_sent_hashes:
        prior_sent_hashes.update(envelope.staged_sent_hashes)

    web_chat_window_mode = str(
        extra_inputs.get("web_chat_window_mode")
        or (envelope.web_chat_window_mode if envelope is not None else "")
        or (ctx.settings.get("web_chat_window_mode", "same_window") if hasattr(ctx, "settings") else "same_window")
        or "same_window"
    ).strip().lower()
    if web_chat_window_mode not in ("same_window", "new_window"):
        web_chat_window_mode = "same_window"

    if envelope is not None:
        envelope.routine_id = routine.get("id", routine_id)
        envelope.sent_hashes.update(prior_sent_hashes)
    else:
        envelope = RoutineEnvelope(
            session_id=session_id,
            routine_id=routine.get("id", routine_id),
            user_prompt=user_prompt,
            pinned_repos=list(all_sister_repos),
            web_chat_window_mode="same_window" if web_chat_window_mode == "same_window" else "new_window",
            sent_hashes=prior_sent_hashes,
        )
    envelope.user_prompt = user_prompt
    envelope.mode = clean_mode
    envelope.pinned_repos = list(all_sister_repos)
    if extra_inputs.get("profile_id"):
        envelope.profile_id = str(extra_inputs["profile_id"])
    envelope.apply_working_set_delta(
        add=seed_editable,
        slice_uris=seed_readonly,
        source="user_pinned",
    )
    if routine_includes:
        envelope.apply_working_set_delta(add=routine_includes, source="routine_include")

    def _pack_working_set_selection(target_nid: str = "fetch_context") -> Tuple[Optional[str], str]:
        return pack_envelope_working_set(ctx, envelope, ordered_nodes, history_messages, target_nid)

    active_profile_id = str(extra_inputs.get("profile_id") or "").strip() or None
    has_raw_patches = bool(parse_blocks(user_prompt or ""))
    if clean_mode == "auto" and has_raw_patches:
        initial_intent = "APPLY_PATCH"
    has_code_targets = any(
        not is_prose_document_uri(f)
        for f in envelope.editable_files
    )
    attached_docs_snippets = []
    for doc_fp in envelope.all_context_files:
        if is_prose_document_uri(doc_fp):
            doc_txt = ctx.vfs.read(doc_fp)
            if doc_txt:
                focused_doc_txt = _prioritize_document_sections(user_prompt, doc_txt)
                attached_docs_snippets.append(f"=== ATTACHED DOCUMENT: {doc_fp} ===\n{focused_doc_txt[:24000]}")
    attached_docs_content = "\n\n".join(attached_docs_snippets)
    envelope.attached_docs_content = attached_docs_content
    if isinstance(extra_inputs.get("active_plan"), dict):
        envelope.active_plan = extra_inputs["active_plan"]
        envelope.active_plan_prompt_block = str(extra_inputs.get("active_plan_prompt_block") or "")
    context_nonce = extra_inputs.get("_context_nonce") or envelope.context_nonce or secrets.token_hex(4)
    secret_values = _collect_secret_values_for_scrubbing(ctx)
    is_manual_transport = (
        str(routine.get("transport") or "auto").lower() == "manual"
        or extra_inputs.get("transport") == "manual"
        or extra_inputs.get("execution_mode") == "web_chat"
    )

    candidate_repo_uris = (
        list(routine.get("includes") or [])
        + ([routine["include_prompt"]] if routine.get("include_prompt") else [])
        + [n.get("prompt_uri") for n in ordered_nodes if isinstance(n, dict) and n.get("prompt_uri")]
        + list(attached_files or [])
    )
    sys_landmarks = build_sys_landmarks_context(
        ctx,
        repo_hint=str(extra_inputs.get("repo") or "").strip() or None,
        candidate_uris=candidate_repo_uris,
        extra_inputs=extra_inputs,
        prior_sys=envelope.sys if envelope.sys else None,
    )
    primary_repo_name = sys_landmarks.get("repo_name") or "workspace"

    raw_helper_mode = str(ctx.settings.get("helper_mode", "ai_assisted") if hasattr(ctx, "settings") else "ai_assisted").strip().lower()
    is_ai_assisted = (raw_helper_mode != "deterministic")
    rag_strategy_val = "llm_scout" if is_ai_assisted else "blast_radius"
    strict_test_val = bool(ctx.settings.get("strict_test_enforcement", False) if hasattr(ctx, "settings") else False)
    run_tests_val = bool(ctx.settings.get("run_tests_on_code", False) if hasattr(ctx, "settings") else False)

    envelope.effective_intent = str(envelope.effective_intent if envelope.effective_intent != "EDIT_CODE" else initial_intent)
    envelope.has_raw_patches = has_raw_patches
    envelope.has_code_targets = has_code_targets
    envelope.context_nonce = str(context_nonce)
    envelope.inputs = {
        **extra_inputs,
        "user_prompt": user_prompt,
        "user_message": user_prompt,
    }
    envelope.sys = {
        **envelope.sys,
        **sys_landmarks,
        "routine_name": routine.get("id", routine_id),
        "helper_mode": "ai_assisted" if is_ai_assisted else "deterministic",
        "rag_strategy": rag_strategy_val,
        "strict_test_enforcement": False if is_manual_transport else strict_test_val,
        "run_tests_on_code": run_tests_val,
        "affected_test_files": [],
        "junit_report_path": "",
        "last_exit_code": 0,
        "test_failure_count": 0,
    }

    total_nodes = len(ordered_nodes)
    final_response_text = ""
    conversational_prose_text = ""
    last_transaction_id = None
    turn_transaction_ids: List[str] = []
    committed_files: List[str] = []
    context_lock = threading.RLock()
    step_counter = [0]

    def _set_node_state(nid_key: str, val: Dict[str, Any]) -> Dict[str, Any]:
        return envelope.set_node(nid_key, val)

    def _run_single_dag_node(node: Dict[str, Any]) -> None:
        nonlocal final_response_text, conversational_prose_text, last_transaction_id
        if callable(is_cancelled_fn) and is_cancelled_fn():
            raise RuntimeError("Agent turn cancelled by user.")
        nid = node["id"]
        cur_node_state = envelope.get_node(nid)
        if isinstance(cur_node_state, dict) and cur_node_state.get("status") == "completed":
            return
        ntype = str(node.get("type", "llm")).lower()
        when_clause = node.get("when") or node.get("condition")
        if not evaluate_when_condition(when_clause, envelope.to_scope_dict(ctx)):
            with context_lock:
                _set_node_state(nid, {"status": "skipped"})
            return

        with context_lock:
            step_counter[0] += 1
            cur_step = step_counter[0]
        node_t0 = time.time()
        node_cap = str(node.get("action") or node.get("capability") or "").strip()
        node_tier_hint = str(node.get("tier") or "") if ntype == "llm" else ""
        record_trace_step(
            envelope, context_lock, nid,
            node_type=ntype, tier=node_tier_hint, capability=node_cap, status="running",
        )
        step_msg = f"Step {cur_step}/{total_nodes} [{nid}]: Running..."
        ctx.jobs.update_progress(step_msg)
        if callable(progress_callback):
            progress_callback(step_msg)
        # --- 0. ROUTINE HANDOFF NODE (Modular Sub-DAG Delegation) ---
        if ntype == "routine":
            scope_now = envelope.to_scope_dict(ctx)
            routine_key_expr = str(node.get("routine_key") or "{{ global.effective_intent }}").strip()
            resolved_key = (
                _interpolate_all_syntax(routine_key_expr, scope_now)
                if "{{" in routine_key_expr
                else (_resolve_var_path(routine_key_expr, scope_now) or routine_key_expr)
            )
            routine_map = node.get("routine_map") or {}
            target_sub_routine = (
                routine_map.get(str(resolved_key))
                or node.get("routine")
                or (routine_map.get("EDIT_CODE") if routine_map else None)
            )
            if not target_sub_routine:
                with context_lock:
                    _set_node_state(nid, {"status": "skipped", "reason": f"No sub-routine mapped for key '{resolved_key}'"})
                return

            ctx.jobs.update_progress(f"Step {cur_step}/{total_nodes} [{nid}]: Handing off to '{target_sub_routine}' DAG...")
            child_env = envelope.fork_sub_routine(target_sub_routine)
            sub_res = execute_declarative_routine(
                ctx,
                session_id=session_id,
                user_prompt=user_prompt,
                mode=clean_mode,
                attached_files=envelope.editable_files,
                read_only_files=envelope.readonly_files,
                history_messages=history_messages,
                routine_id=target_sub_routine,
                inputs=extra_inputs,
                envelope=child_env,
                progress_callback=progress_callback,
                is_cancelled_fn=is_cancelled_fn,
                _depth=_depth + 1,
            )
            with context_lock:
                envelope.merge_sub_routine_result(child_env)
                if sub_res.get("status") == "paused_for_user":
                    _set_node_state(nid, {"status": "paused_for_user", "sub_routine": target_sub_routine, "paused_result": sub_res})
                    return
                final_response_text = sub_res.get("raw_response") or sub_res.get("response") or final_response_text
                if sub_res.get("transaction_id"):
                    last_transaction_id = sub_res["transaction_id"]
                    if last_transaction_id not in turn_transaction_ids:
                        turn_transaction_ids.append(last_transaction_id)
                for cf in (sub_res.get("committed_files") or []):
                    if cf not in committed_files:
                        committed_files.append(cf)
                _set_node_state(nid, {
                    "status": "completed",
                    "sub_routine": target_sub_routine,
                    "response": final_response_text,
                    "transaction_id": last_transaction_id,
                })
            return
        # --- 1. EXEC NODE (Deterministic Capability Invocation via ctx.call) ---
        if ntype == "exec":
            action = str(node.get("action") or node.get("capability") or "").strip()
            if is_routine_banned_capability(action, extra_banned=ROUTINE_BANNED_CAPABILITIES, ctx=ctx):
                raise PermissionError(
                    f"Security Guardrail: Capability '{action}' in node '{nid}' is restricted and cannot be invoked by a declarative routine."
                )
            if clean_mode == "ask" and not is_read_only_safe_capability(action, extra_allowed=READ_ONLY_MODE_ALLOWED_CAPABILITIES):
                raise PermissionError(
                    f"Security Guardrail: Mutating capability '{action}' in node '{nid}' is not permitted in read-only '{clean_mode}' mode."
                )
            if action in ("context.assemble", "gather.context.assemble", "gather.pack_selection"):
                expand_scouted_working_set_targets(
                    ctx, envelope, user_prompt=user_prompt,
                    all_sister_repos=all_sister_repos, primary_repo_name=primary_repo_name,
                    is_prose_fn=is_prose_document_uri, discover_const_fn=discover_constitution_files,
                )

            if action in ("context.assemble", "gather.context.assemble"):
                assembled = assemble_context_payload(
                    ctx,
                    edit_targets=envelope.editable_files,
                    reference_files=envelope.readonly_files,
                    user_message=user_prompt,
                    strategy=rag_strategy_val,
                    session_id=session_id,
                )
                with context_lock:
                    fc_val = _vault_if_oversized(ctx, "fetch_context", {
                        "status": "completed",
                        "base_filename": assembled.get("context_uri"),
                        "content": assembled.get("content", ""),
                        **assembled,
                    })
                    _set_node_state("fetch_context", fc_val)
                    _set_node_state(nid, fc_val)
                return
            if action == "gather.pack_selection":
                if not envelope.all_context_files:
                    with context_lock:
                        _set_node_state(nid, {"status": "completed", "content": "", "base_filename": None})
                    return
                _, packed_text = _pack_working_set_selection(nid)
                record_trace_step(
                    envelope, context_lock, nid,
                    node_type="exec", capability=action, status="completed",
                    elapsed_ms=int((time.time() - node_t0) * 1000),
                    summary=f"Packed {len(envelope.all_context_files)} file(s) + neighborhood index (~{len(packed_text) // 4:,} tok)",
                )
            elif action == "bridge.sync":
                final_response_text, last_transaction_id = execute_bridge_sync_and_test_gate(
                    ctx, node, routine, routine_id, envelope, context_lock,
                    cur_step=cur_step, total_nodes=total_nodes, user_prompt=user_prompt,
                    has_raw_patches=has_raw_patches, is_ai_assisted=is_ai_assisted,
                    active_profile_id=active_profile_id, primary_repo_name=primary_repo_name,
                    run_tests_val=run_tests_val, strict_test_val=strict_test_val,
                    history_messages=history_messages, final_response_text=final_response_text,
                    last_transaction_id=last_transaction_id, turn_transaction_ids=turn_transaction_ids,
                    committed_files=committed_files, is_cancelled_fn=is_cancelled_fn,
                    set_node_state_fn=_set_node_state,
                )
            else:
                scope_now = envelope.to_scope_dict(ctx)
                raw_args = node.get("args") or node.get("payload") or {}
                resolved_args = {
                    k: (_interpolate_all_syntax(v, scope_now) if isinstance(v, str) else v)
                    for k, v in raw_args.items()
                }
                if action == "topology.overview" and "repos" not in resolved_args:
                    resolved_args["repos"] = list(all_sister_repos)
                exec_res = ctx.call(action, wait=True, **resolved_args)
                _set_node_state(
                    nid,
                    {"status": "completed", **exec_res, "result": exec_res} if isinstance(exec_res, dict) else {"status": "completed", "result": exec_res},
                )
                record_trace_step(
                    envelope, context_lock, nid,
                    node_type="exec", capability=action, status="completed",
                    elapsed_ms=int((time.time() - node_t0) * 1000),
                    summary=f"Executed {action}",
                )
        # --- 1.5 LOOP NODE (Bounded Iterative Convergence Sub-DAG) ---
        elif ntype == "loop":
            max_iters = min(int(node.get("max_iterations", 3) or 3), 10)
            until_expr = str(node.get("until") or "")
            body_nodes = [b for b in (node.get("body") or node.get("nodes") or []) if isinstance(b, dict) and b.get("id")]
            body_waves = _compile_node_wavefronts(body_nodes) if body_nodes else []
            loop_status = "max_iterations_reached"
            it_idx = 0
            for it_idx in range(1, max_iters + 1):
                with context_lock:
                    prev_snapshot = {
                        bnode["id"]: dict(envelope.nodes[bnode["id"]])
                        for bnode in body_nodes
                        if isinstance(envelope.nodes.get(bnode["id"]), dict)
                    }
                    envelope.loop = {
                        "iteration": it_idx,
                        "max_iterations": max_iters,
                        "prev": prev_snapshot,
                    }
                    for bnode in body_nodes:
                        envelope.nodes.pop(bnode["id"], None)
                for b_wave in body_waves:
                    if len(b_wave) == 1:
                        _run_single_dag_node(b_wave[0])
                    else:
                        ctx.jobs.map_parallel(_run_single_dag_node, b_wave)
                if until_expr and evaluate_when_condition(until_expr, envelope.to_scope_dict(ctx)):
                    loop_status = "converged"
                    break
            with context_lock:
                _set_node_state(nid, {"status": "completed" if loop_status == "converged" else loop_status, "iterations": it_idx})
            record_trace_step(
                envelope, context_lock, nid,
                node_type="loop", status="completed",
                elapsed_ms=int((time.time() - node_t0) * 1000),
                summary=f"Converged in {it_idx}/{max_iters} cycle(s) ({len(envelope.scouted_candidate_files or [])} file(s), {len(envelope.scouted_tasks or [])} task(s))",
            )
        # --- 2. LLM NODE (Unified Ingress & Egress Compute Contract via llm_contract.py) ---
        elif ntype == "llm":
            out_final, out_prose = execute_llm_dag_node(
                ctx, node, routine, routine_id, envelope, context_lock,
                node_t0=node_t0, user_prompt=user_prompt, history_messages=history_messages,
                handoff_responses=handoff_responses, active_profile_id=active_profile_id,
                session_id=session_id, all_sister_repos=all_sister_repos,
                primary_repo_name=primary_repo_name, routine_includes=routine_includes,
                context_nonce=context_nonce, secret_values=secret_values,
                extra_inputs=extra_inputs, pack_ws_fn=_pack_working_set_selection,
                set_node_state_fn=_set_node_state,
            )
            if out_final is not None:
                final_response_text = out_final
            if out_prose is not None:
                conversational_prose_text = out_prose

    # Execute wavefront-by-wavefront with Two-Level Budget Tracking:
    session_cost_usd = float(extra_inputs.get("session_cost_usd") or envelope.session_cost_usd or 0.0)
    budget_step_usd = float(
        extra_inputs.get("budget_step_usd")
        or envelope.budget_step_usd
        or (ctx.settings.get("budget_step_usd", DEFAULT_SESSION_BUDGET_STEP_USD) if hasattr(ctx, "settings") else DEFAULT_SESSION_BUDGET_STEP_USD)
        or DEFAULT_SESSION_BUDGET_STEP_USD
    )
    budget_limit_usd = float(
        extra_inputs.get("budget_limit_usd")
        or envelope.budget_limit_usd
        or (ctx.settings.get("budget_limit_usd", DEFAULT_SESSION_BUDGET_USD) if hasattr(ctx, "settings") else DEFAULT_SESSION_BUDGET_USD)
        or DEFAULT_SESSION_BUDGET_USD
    )
    if (extra_inputs.get("resume_checkpoint") or handoff_responses) and "budget_limit_usd" not in extra_inputs:
        while session_cost_usd >= budget_limit_usd:
            budget_limit_usd = round(budget_limit_usd + budget_step_usd, 4)
    envelope.budget_limit_usd = budget_limit_usd
    envelope.budget_step_usd = budget_step_usd
    envelope.session_cost_usd = round(session_cost_usd, 6)

    accumulated_tokens = 0
    total_steps_executed = 0
    min_handoff_wave_idx = 0
    if handoff_responses:
        matched_waves = [
            idx_w for idx_w, w_nodes in enumerate(wavefronts)
            if any(nd.get("id") in handoff_responses for nd in w_nodes)
        ]
        if matched_waves:
            min_handoff_wave_idx = min(matched_waves)

    for w_idx, wave in enumerate(wavefronts):
        if w_idx < min_handoff_wave_idx:
            continue
        active_wave_nodes = []
        scope_wave = envelope.to_scope_dict(ctx)
        for n in wave:
            nid = n["id"]
            n_cur = envelope.get_node(nid)
            if isinstance(n_cur, dict) and n_cur.get("status") == "completed":
                continue
            w_clause = n.get("when") or n.get("condition")
            if not evaluate_when_condition(w_clause, scope_wave):
                _set_node_state(nid, {"status": "skipped"})
                continue
            active_wave_nodes.append(n)

        if not active_wave_nodes:
            continue
        pending_handoff_branches, has_api_thinking_llm_node, api_context_overflow_msg = collect_wavefront_handoff_branches(
            ctx, active_wave_nodes, handoff_responses, routine, routine_id, w_idx, envelope,
            context_lock, user_prompt=user_prompt, routine_includes=routine_includes,
            context_nonce=context_nonce, secret_values=secret_values, extra_inputs=extra_inputs,
            is_manual_transport=is_manual_transport, active_profile_id=active_profile_id,
            rag_strategy_val=rag_strategy_val, session_id=session_id, session_cost_usd=session_cost_usd,
            budget_limit_usd=budget_limit_usd, budget_step_usd=budget_step_usd,
        )

        if pending_handoff_branches:
            for pb in pending_handoff_branches:
                record_trace_step(
                    envelope, context_lock, pb["node_id"],
                    node_type="llm", tier=pb.get("tier") or "thinking",
                    wavefront_index=w_idx, status="paused",
                    summary="Paused for Web-Chat Handoff",
                )
            return build_paused_for_user_response(
                pending_handoff_branches, routine, routine_id, w_idx, wavefronts, envelope,
                clean_mode, last_transaction_id, turn_transaction_ids, committed_files,
            )

        # Level 1 & Level 2 Gate for automated API nodes (never fires on web_chat handoffs or fast scouts under step limit)
        is_step_exhausted = total_steps_executed >= DEFAULT_STEP_BUDGET
        is_cost_exhausted = has_api_thinking_llm_node and (
            session_cost_usd >= budget_limit_usd or accumulated_tokens >= DEFAULT_TOKEN_BUDGET
        )
        if is_step_exhausted or is_cost_exhausted or api_context_overflow_msg:
            pause_reason = (
                api_context_overflow_msg
                or (
                    f"Session spend (~${session_cost_usd:.2f}) reached budget ceiling (${budget_limit_usd:.2f}). "
                    f"Resume to increase budget by +${budget_step_usd:.2f} (to ${budget_limit_usd + budget_step_usd:.2f})."
                    if is_cost_exhausted
                    else f"Execution step budget reached ({total_steps_executed} steps). Checkpoint saved."
                )
            )
            return {
                "status": "paused_for_budget",
                "routine_id": routine.get("id", routine_id),
                "wavefront_index": w_idx,
                "message": pause_reason,
                "checkpoint": envelope.to_checkpoint(
                    "paused_for_budget",
                    wavefront_index=w_idx,
                    wavefronts=[[n["id"] for n in w] for w in wavefronts],
                    reason=pause_reason,
                ),
                "envelope": envelope,
            }

        total_steps_executed += len(active_wave_nodes)
        pre_wave_uris = envelope.snapshot_wavefront_uris() if len(active_wave_nodes) > 1 else None
        if len(active_wave_nodes) == 1:
            _run_single_dag_node(active_wave_nodes[0])
        else:
            ctx.jobs.map_parallel(_run_single_dag_node, active_wave_nodes)
            if pre_wave_uris is not None:
                envelope.settle_wavefront_uris(pre_wave_uris)

        for n in active_wave_nodes:
            n_state = envelope.get_node(n["id"])
            if isinstance(n_state, dict):
                if n_state.get("status") == "paused_for_query_hop":
                    handoff_responses.pop(n["id"], None)
                    envelope.nodes.pop(n["id"], None)
                    hop_b = build_web_chat_handoff_branch(
                        ctx, n, routine, routine_id, w_idx, envelope, context_lock,
                        user_prompt=user_prompt, routine_includes=routine_includes, context_nonce=context_nonce,
                        secret_values=secret_values, extra_inputs=extra_inputs,
                        is_manual_transport=is_manual_transport,
                        session_id=session_id, session_cost_usd=session_cost_usd,
                        budget_limit_usd=budget_limit_usd, budget_step_usd=budget_step_usd,
                    )
                    return build_paused_for_user_response(
                        [hop_b], routine, routine_id, w_idx, wavefronts, envelope,
                        clean_mode, last_transaction_id, turn_transaction_ids, committed_files,
                    )
                if n_state.get("status") == "paused_for_user" and n_state.get("paused_result"):
                    return n_state["paused_result"]
                if str(n.get("type", "llm")).lower() == "llm" and isinstance(n_state.get("text"), str):
                    out_tok = len(n_state["text"]) // 4
                    in_tok = int((envelope.get_node("fetch_context") or {}).get("total_tokens_estimated") or 0)
                    n_tier = str(n.get("tier") or "standard").lower()
                    if n_tier not in ("fast", "decision"):
                        accumulated_tokens += out_tok
                    session_cost_usd += estimate_call_cost_usd(
                        ctx.workspace_id, n_tier, "", in_tok, out_tok, is_web_chat=False
                    )
                    envelope.session_cost_usd = round(session_cost_usd, 6)

    if routine.get("output"):
        declared_out = _interpolate_all_syntax(str(routine["output"]), envelope.to_scope_dict(ctx)).strip()
        if declared_out:
            final_response_text = declared_out

    resolved_resp_uri = _persist_routine_response(ctx, routine, final_response_text)
    if resolved_resp_uri and resolved_resp_uri not in committed_files:
        committed_files.append(resolved_resp_uri)

    # Root-Boundary Reply Splitting: Separate conversational prose from raw Yomama patch blocks
    # strictly at the root egress (_depth == 0) so nested sub-routines always compose raw text.
    unapplied_patches = ""
    display_response_text = final_response_text
    parsed_final_blocks = parse_blocks(final_response_text) if (_depth == 0 and final_response_text and "<<<<<<<" in final_response_text) else {}
    if parsed_final_blocks:
        prose_only = strip_yomama_blocks_keep_prose(final_response_text)
        total_chunks = sum(len(blks) for blks in parsed_final_blocks.values())
        file_count = len(parsed_final_blocks)
        if committed_files:
            receipt_summary = f"✅ Applied {total_chunks} patch(es) across {len(committed_files)} file(s)."
            display_response_text = f"{prose_only}\n\n{receipt_summary}".strip() if prose_only else receipt_summary
        else:
            unapplied_patches = final_response_text
            staged_summary = f"📦 Staged {total_chunks} patch(es) across {file_count} file(s) for review. Check and confirm the patch stacks below to commit."
            display_response_text = f"{prose_only}\n\n{staged_summary}".strip() if prose_only else staged_summary
    elif _depth == 0 and not display_response_text.strip() and envelope.staged_task_actions:
        tm_cnt = len(envelope.staged_task_actions)
        display_response_text = f"📋 Updated execution plan ({tm_cnt} task directive(s))."

    return {
        "status": "completed", "routine_id": routine.get("id", routine_id),
        "wavefronts": [[n["id"] for n in w] for w in wavefronts],
        "response": display_response_text, "raw_response": final_response_text,
        "unapplied_patches": unapplied_patches, "output": display_response_text,
        "effective_intent": envelope.effective_intent, "mode": clean_mode,
        "transaction_id": last_transaction_id, "transaction_ids": turn_transaction_ids,
        "committed_files": committed_files, "envelope": envelope,
    }