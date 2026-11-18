"""
insetu.core.gather.context_assemble
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
The Unified RAG Funnel (context.assemble):
- Resolves context payloads via deterministic "blast_radius" (0 tokens) or "llm_scout".
- Enforces the 12,000 soft token ceiling via AST interface slicing.
- Maintains the persistent Hebbian affinity graph (affinity_edges) with exponential time decay.
- Evaluates bounded single-hop <<<<<<< QUERY_CONTEXT read directives.
"""

import hashlib, json, os, re, secrets, time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, TypedDict

from insetu.core.sdk import InSetuURI
from insetu.core.system.security_io import collect_workspace_secrets, scrub_outbound_secrets
from insetu.core.topology.engine_topology import clamp_uris_to_topology, discover_constitution_files, get_topology_files_for_repo
from insetu.core.utils_core import BucketAddress, compute_vfs_sha256, generate_ascii_tree
from insetu.core.languages import get_language_provider
from insetu.core.agent.envelope import RoutineEnvelope
from insetu.core.agent.expressions import vault_if_oversized
from insetu.core.agent.routine_loader import is_prose_document_uri
from .msg_lens import parse_message_uri, project_session_msg_lens as _project_session_msg_lens, project_turn_dossier as _project_turn_dossier
from .rag_proximity import (
    DECAY_LAMBDA, assemble_blast_radius, clamp_rag_files_to_topology, describe_unresolved_rag_path,
    get_affinity_neighbors, prune_stale_affinity_edges, record_affinity_interaction, slice_code_index_for_blast_radius,
)

SOFT_TOKEN_CEILING = 12000
MAX_RAG_FILES_PER_HOP = 15


def _build_projection_dict(uri: str, requested_lens: str, served_lens: str, text: str, truncated: bool = False, **extra) -> Dict[str, Any]:
    body = text or ""
    return {
        "uri": uri, "lens": requested_lens, "served_lens": served_lens, "content": body, "text": body,
        "tokens": max(1, len(body) // 4) if body else 0, "sha256": compute_vfs_sha256(body) if body else "",
        "truncated": bool(truncated), **extra,
    }


def _project_code_index_filename_tree(ctx, canon_uri: str) -> str:
    """Renders a compact filename-only directory tree for a repository's CODE_INDEX.md (stripping AST symbol leaves and comments)."""
    repo = InSetuURI(canon_uri).repo
    if repo:
        try:
            repo_files = get_topology_files_for_repo(ctx.workspace_id, repo)
            if repo_files:
                rel_paths = sorted(InSetuURI(f).path.strip("/") for f in repo_files if InSetuURI(f).path)
                return f"=== {canon_uri} (FILENAME-ONLY OUTLINE TREE — {len(rel_paths)} files) ===\n{repo}/\n{generate_ascii_tree(rel_paths)}\n"
        except Exception:
            pass
    raw_idx = ctx.vfs.read(canon_uri) or ""
    if not raw_idx:
        return ""
    entry_re = re.compile(r'^([│ \t]*(?:├──|└──)\s+[^\s#]+)')
    symbol_re = re.compile(r'(?:├──|└──)\s+(?:async\s+)?(?:def|class|function|const|let|var|export|interface|type|struct|enum|fn)\b')
    file_lines = [m.group(1).rstrip() for ln in raw_idx.splitlines() if not symbol_re.search(ln) for m in (entry_re.match(ln),) if m]
    return f"=== {canon_uri} (FILENAME-ONLY OUTLINE TREE) ===\n" + "\n".join(file_lines) + "\n"


def project_resource_lens(ctx, uri: str, lens: str = "full", **params) -> Dict[str, Any]:
    """Projects any URI-addressed context artifact (`vfs://`, `ctx://`, `msg://`, `mddb://`) through `full`, `diff`, `slice`, `outline`, or `genesis`."""
    clean_uri = str(uri or "").strip()
    clean_lens = str(lens or "full").strip().lower()
    if clean_lens not in ("full", "diff", "slice", "outline", "genesis"):
        clean_lens = "full"

    if clean_uri.startswith(("msg://", "msg_")):
        has_telemetry_frag = "#telemetry" in clean_uri or bool(params.get("include_telemetry"))
        canon_msg_uri, target_id, uri_wants_raw = parse_message_uri(clean_uri)
        try:
            agent_db = ctx.get_db("agent")
            s_row = agent_db.execute("SELECT * FROM chat_sessions WHERE session_id=?", (target_id,)).fetchone()
            if s_row:
                return _project_session_msg_lens(
                    ctx, target_id, dict(s_row), clean_lens,
                    scrub_fn=scrub_outbound_secrets, collect_secrets_fn=collect_workspace_secrets,
                    build_proj_fn=_build_projection_dict,
                )
            row = agent_db.execute(
                "SELECT message_id, session_id, seq, role, content, raw_content, receipt, transaction_id, timestamp, compacted_into_id, context_hashes_json FROM chat_messages WHERE message_id=?",
                (target_id,),
            ).fetchone()
            if not row:
                return _build_projection_dict(canon_msg_uri, clean_lens, clean_lens, "")
            rk, served = dict(row), clean_lens
            if clean_lens == "outline":
                text_out = f"[Turn #{rk.get('seq')} · {rk['message_id']} ({rk.get('role')})]"
            elif clean_lens == "slice":
                text_out = f"[Turn #{rk.get('seq')} · {rk['message_id']} ({rk.get('role')})]: {rk.get('receipt') or (rk.get('content') or '')[:180]}"
            elif clean_lens == "diff" and rk.get("transaction_id"):
                diff_res = ctx.call("bridge.turn_diff", transaction_ids=[t for t in str(rk["transaction_id"]).split(",") if t], wait=True)
                text_out = diff_res.get("diff_text", "") if isinstance(diff_res, dict) else str(diff_res or "")
            else:
                served = "full"
                want_raw = bool(params.get("raw")) or uri_wants_raw
                text_out = _project_turn_dossier(
                    ctx, rk, want_raw=want_raw, include_telemetry=has_telemetry_frag,
                    scrub_fn=scrub_outbound_secrets, collect_secrets_fn=collect_workspace_secrets,
                )
            return _build_projection_dict(canon_msg_uri, clean_lens, served, text_out)
        except Exception as exc:
            return _build_projection_dict(canon_msg_uri, clean_lens, clean_lens, "", error=str(exc))

    if clean_uri.startswith("mddb://") and hasattr(ctx, "mddb"):
        db_scope, _, rec_id = clean_uri[len("mddb://"):].strip().partition("/")
        try:
            rec = ctx.mddb.get_record(rec_id or db_scope, db_scope=db_scope if rec_id else None, include_body=(clean_lens == "full"))
            if not rec:
                return _build_projection_dict(clean_uri, clean_lens, clean_lens, "")
            text_out = f"[{rec.get('id')}] {rec.get('title')} ({rec.get('status')})" if clean_lens == "outline" else json.dumps(rec, indent=2)
            return _build_projection_dict(clean_uri, clean_lens, clean_lens, text_out)
        except Exception:
            return _build_projection_dict(clean_uri, clean_lens, clean_lens, "")

    canon_uri = InSetuURI.canonicalize(clean_uri)
    if InSetuURI(canon_uri).basename == "CODE_INDEX.md":
        tree_txt = _project_code_index_filename_tree(ctx, canon_uri)
        return _build_projection_dict(canon_uri, clean_lens, "outline", tree_txt)
    if clean_lens == "outline":
        outline_txt = slice_code_index_for_blast_radius(ctx, [canon_uri], max_chars=int(params.get("max_chars", 4000)))
        return _build_projection_dict(canon_uri, "outline", "outline", outline_txt, truncated=("truncated]" in outline_txt))

    raw_text = ctx.vfs.read(canon_uri)
    if raw_text is None:
        uri_obj = InSetuURI(canon_uri)
        sib_notes: List[str] = []
        if uri_obj.scheme == "vfs" and uri_obj.repo:
            parent_dir = str(uri_obj.parent_uri).rstrip("/") + "/"
            for sib in clamp_uris_to_topology(ctx.workspace_id, [parent_dir], expand_dirs=True)[:3]:
                sib_txt = ctx.vfs.read(sib)
                if sib_txt:
                    prov = get_language_provider(sib)
                    sib_notes.append(f"--- Sibling Interface ({sib}) ---\n{prov.slice_interface(sib, sib_txt) if prov else sib_txt[:600]}")
        genesis_body = (
            f"[NEW FILE TO CREATE — GENESIS TARGET: {canon_uri}]\n"
            f"(Emit a Yomama Genesis patch with an empty SEARCH block `<<<<<<< FILE: {canon_uri}\\n<<<<<<< COMMENT\\nOne-sentence module summary.\\n<<<<<<< SEARCH\\n=======\\n...\\n>>>>>>> REPLACE` to create this file.)"
        )
        if sib_notes:
            genesis_body += "\n\n" + "\n\n".join(sib_notes)
        return _build_projection_dict(canon_uri, clean_lens, "genesis", genesis_body)

    if clean_lens == "genesis":
        return _build_projection_dict(canon_uri, "genesis", "full", raw_text)

    if clean_lens == "slice":
        prov, req_syms, truncated = get_language_provider(canon_uri), params.get("requested_symbols"), False
        if prov:
            try:
                sliced = prov.slice_interface(canon_uri, raw_text, requested_symbols=req_syms) if req_syms else prov.slice_interface(canon_uri, raw_text)
            except TypeError:
                sliced = prov.slice_interface(canon_uri, raw_text)
        else:
            sliced, truncated = raw_text[:2000], len(raw_text) > 2000
        return _build_projection_dict(canon_uri, "slice", "slice", sliced, truncated=truncated)

    if clean_lens == "diff" and params.get("base_text") is not None:
        from insetu.core.languages import format_interleaved_file_diff as _fmt_diff
        return _build_projection_dict(canon_uri, "diff", "diff", _fmt_diff(canon_uri, str(params["base_text"]), raw_text))

    return _build_projection_dict(canon_uri, clean_lens, "full", raw_text)


# --- Main Assembler Capability ---

def detect_external_edits(ctx, filepaths: List[str]) -> List[str]:
    """Compares live disk SHA-256 of working_set files against the latest bridge_ledger post_patch_hash."""
    notices: List[str] = []
    if not filepaths:
        return notices
    try:
        bridge_db = ctx.get_db("bridge")
        for fp in filepaths:
            norm_fp = str(InSetuURI(fp))
            content = ctx.vfs.read(norm_fp)
            if content is None:
                continue
            row = bridge_db.execute(
                "SELECT post_patch_hash FROM bridge_ledger WHERE filepath=? ORDER BY timestamp DESC LIMIT 1",
                (norm_fp,),
            ).fetchone()
            if row and row["post_patch_hash"] and row["post_patch_hash"] != compute_vfs_sha256(content):
                notices.append(f"[System Note: User manually edited {norm_fp} in editor since last turn]")
    except Exception:
        return notices
    return notices


ContextAssemblePayload = TypedDict("ContextAssemblePayload", {
    "edit_targets": List[str], "reference_files": Optional[List[str]], "constitution_files": Optional[List[str]],
    "user_message": str, "strategy": Optional[str], "session_id": Optional[str], "history_summary": Optional[str],
}, total=False)

ContextAssembleResponse = TypedDict("ContextAssembleResponse", {
    "context_uri": str, "content": str, "constitution_files": List[str], "edit_targets": List[str],
    "reference_targets": List[Dict[str, Any]], "external_edit_notices": List[str],
    "total_tokens_estimated": int, "saved_by_slicing_tokens": int, "sliced": bool,
})


def assemble_context_payload(
    ctx,
    edit_targets: List[str],
    user_message: str = "",
    strategy: Optional[str] = None,
    session_id: Optional[str] = None,
    history_summary: str = "",
    reference_files: Optional[List[str]] = None,
    constitution_files: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Main entry point for context.assemble:
    Resolves targets, applies soft-budget interface slicing, and wraps in a secured nonce envelope.
    """
    clean_strategy = (strategy or ctx.settings.get("rag_strategy", "blast_radius") or "blast_radius").strip().lower()
    clean_edits = [str(InSetuURI(f)) for f in edit_targets if f]

    if clean_strategy == "llm_scout" and clean_edits:
        res = ctx.call(
            "llm.complete",
            messages=[{"role": "user", "content": f"Select relevant interface references for: {user_message}\nPinned: {clean_edits}"}],
            tier="fast",
            output_schema="context_slice",
            wait=True,
        )
        parsed = res.get("parsed") if isinstance(res, dict) else {}
        if isinstance(parsed, dict) and parsed.get("reference_targets"):
            ref_targets = parsed["reference_targets"]
        else:
            _, ref_targets = assemble_blast_radius(ctx, clean_edits, user_message, history_summary)
    else:
        clean_edits, ref_targets = assemble_blast_radius(ctx, clean_edits, user_message, history_summary)

    # Merge explicit reference_files into ref_targets (clamped strictly to tracked topology_ledger files)
    clean_edits = clamp_uris_to_topology(ctx.workspace_id, clean_edits, expand_dirs=True)
    clamped_explicit_refs = clamp_uris_to_topology(
        ctx.workspace_id,
        [str(InSetuURI(r)) for r in (reference_files or []) if r],
        expand_dirs=True,
    )
    existing_refs = {r["filepath"] for r in ref_targets}
    for norm_ref in clamped_explicit_refs:
        if norm_ref not in clean_edits and norm_ref not in existing_refs and ctx.vfs.read(norm_ref) is not None:
            ref_targets.append({"filepath": norm_ref, "symbols": []})
            existing_refs.add(norm_ref)
    valid_ref_set = set(clamp_uris_to_topology(ctx.workspace_id, [r["filepath"] for r in ref_targets], expand_dirs=False))
    ref_targets = [r for r in ref_targets if r["filepath"] in valid_ref_set]
    ref_targets.sort(key=lambda r: r["filepath"])

    tier0_constitution = (
        [str(InSetuURI(c)) for c in constitution_files if c]
        if constitution_files is not None
        else discover_constitution_files(ctx)
    )

    env = RoutineEnvelope(session_id=session_id or "default", user_prompt=user_message, context_soft_ceiling=SOFT_TOKEN_CEILING)
    env.apply_working_set_delta(add=tier0_constitution, source="constitution")
    env.apply_working_set_delta(
        add=clean_edits,
        slice_uris=[r["filepath"] for r in ref_targets],
        slice_symbols_map={r["filepath"]: list(r["symbols"]) for r in ref_targets if r.get("symbols")},
        source="user_pinned",
    )
    full_projections: Dict[str, Dict[str, Any]] = {
        u: project_resource_lens(ctx, u, lens="full")
        for u in env.all_context_files
    }
    est_tokens = sum(int(p.get("tokens") or 0) for p in full_projections.values())
    should_slice = est_tokens > SOFT_TOKEN_CEILING
    sliced, saved_chars = False, 0
    blocks: List[str] = [
        f"=== TIER 0 CONSTITUTION (Engineering Standard): {cf} ===\n{full_projections[cf]['content']}\n"
        for cf in tier0_constitution if full_projections.get(cf, {}).get("content")
    ]
    for rf in ref_targets:
        fp = rf["filepath"]
        full_txt = full_projections.get(fp, {}).get("content") or ""
        if should_slice and get_language_provider(fp) is not None:
            s_proj = project_resource_lens(ctx, fp, lens="slice", requested_symbols=rf.get("symbols"))
            packed = s_proj.get("content") or full_txt
            sliced = True
            saved_chars += max(0, len(full_txt) - len(packed))
            blocks.append(f"=== TIER 1 REFERENCE INTERFACE (AST Sliced): {fp} ===\n{packed}\n")
        else:
            blocks.append(f"=== TIER 1 REFERENCE TARGET: {fp} ===\n{full_txt}\n")

    outline_block = slice_code_index_for_blast_radius(ctx, clean_edits + [r["filepath"] for r in ref_targets])
    if outline_block:
        blocks.append(outline_block)
    for ef in clean_edits:
        blocks.append(f"=== TIER 2 EDIT TARGET (Full Source): {ef} ===\n{full_projections.get(ef, {}).get('content') or ''}\n")
    external_notices = detect_external_edits(ctx, clean_edits + [r["filepath"] for r in ref_targets])
    if external_notices:
        blocks.append("\n".join(external_notices) + "\n")

    scrubbed_body = scrub_outbound_secrets("\n".join(blocks), collect_workspace_secrets(ctx))
    nonce = secrets.token_hex(4)
    envelope = f"<workspace_context_{nonce}>\n{scrubbed_body}\n</workspace_context_{nonce}>\n"

    bundle_hash = hashlib.sha256(envelope.encode("utf-8")).hexdigest()[:12]
    context_uri = f"ctx://contexts/turn_{bundle_hash}_context.txt"
    all_turn_files = env.all_context_files
    _compile_ephemeral_quickpack(
        ctx, context_uri, "INSETU ASSEMBLED TURN CONTEXT\n", [envelope],
        all_turn_files, "Turn Context", "Assembled turn context payload.",
        ttl_seconds=3600, owner="agent_turn",
    )
    return {
        "context_uri": context_uri, "content": envelope, "constitution_files": tier0_constitution,
        "edit_targets": clean_edits, "reference_targets": ref_targets, "external_edit_notices": external_notices,
        "total_tokens_estimated": len(envelope) // 4, "saved_by_slicing_tokens": saved_chars // 4, "sliced": sliced,
    }


def _compile_ephemeral_quickpack(
    ctx, base_uri: str, header_block: str, text_blocks: List[str],
    files: List[str], title: str, desc: str, ttl_seconds: int = 86400, owner: str = "quick_pack",
) -> Dict[str, Any]:
    """Compiles an ephemeral Quickpack context artifact, flushes the VFS barrier, and registers its chunks."""
    entry = ctx.compile_context(
        base_uri=base_uri, header_block=header_block, text_blocks=text_blocks, files=list(files),
        meta={"type": "gather", "title": title, "domain": "Quickpacks", "desc": desc}, is_ephemeral=True,
    )
    ctx.sync_vfs_barrier()
    ctx.save_manifest({base_uri: entry}, is_full_compile=False)
    for ch in entry.get("chunks", [base_uri]):
        out_p = ctx.resolve_path(ch)
        if out_p:
            ctx.jobs.register_ephemeral(out_p, ttl_seconds=ttl_seconds, owner=owner)
    return entry


def pack_envelope_working_set(
    ctx,
    envelope,
    ordered_nodes: List[Dict[str, Any]],
    history_messages: Optional[List[Dict[str, str]]] = None,
    target_nid: str = "fetch_context",
) -> Tuple[Optional[str], str]:
    """
    Single-Seam Working-Set Context Packer:
    Projects all working-set artifacts on `envelope` in bucket volatility order, records `served_lens`,
    `tokens`, and `sha256` on each `ContextArtifact`, and compiles both Full Context and Same-Window Delta Quickpacks.
    """
    cur_all_files = envelope.all_context_files
    if not cur_all_files:
        return None, ""
    cur_editable = envelope.editable_files
    cur_readonly = envelope.readonly_files
    outline_sub = slice_code_index_for_blast_radius(ctx, cur_editable or cur_all_files)

    rendered_blocks: List[Tuple[str, str, str]] = []
    routine_uses_history = any(bool(n.get("use_history")) for n in (ordered_nodes or []) if isinstance(n, dict))
    if routine_uses_history and history_messages and len(history_messages) > 1:
        hist_lines = [
            f"--- {hm.get('role', 'user').upper()} ---\n{hm.get('content', '')}"
            for hm in history_messages[:-1]
            if hm.get("content")
        ]
        if hist_lines:
            hist_block = (
                "============================================================\n"
                "SESSION TRANSCRIPT (Compacted History & Recallable Receipts)\n"
                "============================================================\n\n"
                + "\n\n".join(hist_lines)
            )
            rendered_blocks.append(("ctx://contexts/session_transcript.txt", "full", hist_block))

    recalled_txt = envelope.recalled_messages_text or envelope.holding.get("recalled_messages_text")
    if recalled_txt:
        rendered_blocks.append(("ctx://contexts/recalled_session_messages.txt", "full", str(recalled_txt)))

    plan_blk_str = envelope.render_active_plan_block()
    if plan_blk_str:
        rendered_blocks.append(("ctx://contexts/active_execution_plan.txt", "full", plan_blk_str))

    soft_tok_ceiling = int(envelope.context_soft_ceiling or 150000)
    file_projections: List[Tuple[str, str, str, int]] = []
    running_tokens = sum(len(b_txt) // 4 for _, _, b_txt in rendered_blocks) + (len(outline_sub) // 4 if outline_sub else 0)
    for f_uri in cur_all_files:
        art_obj = envelope.artifacts.get(f_uri)
        lens_u = art_obj.lens if art_obj else ("slice" if f_uri in cur_readonly and f_uri not in cur_editable else "full")
        req_syms = art_obj.symbols if (art_obj and art_obj.symbols) else None
        proj = project_resource_lens(
            ctx, f_uri, lens="full" if f_uri.startswith("ctx://") else lens_u, requested_symbols=req_syms
        )
        served_l = proj.get("served_lens") or lens_u
        content_str = proj.get("content") or ""
        tok_cnt = int(proj.get("tokens") or (len(content_str) // 4))
        if art_obj is not None:
            art_obj.served_lens = served_l
            art_obj.tokens = tok_cnt
            art_obj.sha256 = str(proj.get("sha256") or "")
        file_projections.append((f_uri, served_l, content_str, tok_cnt))
        running_tokens += tok_cnt

    if running_tokens > soft_tok_ceiling:
        for idx_p in range(len(file_projections) - 1, -1, -1):
            if running_tokens <= soft_tok_ceiling:
                break
            f_uri, served_l, content_str, tok_cnt = file_projections[idx_p]
            art_obj = envelope.artifacts.get(f_uri)
            if served_l == "full" and art_obj and art_obj.source not in ("user_pinned", "constitution") and not is_prose_document_uri(f_uri):
                sliced_proj = project_resource_lens(ctx, f_uri, lens="slice")
                s_content = sliced_proj.get("content") or ""
                s_tok = int(sliced_proj.get("tokens") or (len(s_content) // 4))
                if s_tok < tok_cnt:
                    running_tokens -= (tok_cnt - s_tok)
                    file_projections[idx_p] = (f_uri, "slice", s_content, s_tok)
                    art_obj.lens = "slice"
                    art_obj.served_lens = "slice"
                    art_obj.tokens = s_tok
                    art_obj.sha256 = str(sliced_proj.get("sha256") or "")

    for f_uri, served_l, content_str, _ in file_projections:
        if content_str:
            block_str = f"{'=' * 60}\n>>>NEW FILE :: {f_uri} | Lens: {served_l.upper()}\n{'=' * 60}\n\n{content_str}\n"
            rendered_blocks.append((f_uri, served_l, block_str))

    if outline_sub:
        rendered_blocks.append(("ctx://contexts/neighborhood_code_index_outline.txt", "outline", outline_sub))
    ext_notices = detect_external_edits(ctx, cur_editable + cur_readonly)
    if ext_notices:
        rendered_blocks.append(("ctx://contexts/external_edit_notices.txt", "full", "\n".join(ext_notices)))

    full_text, delta_text, next_hashes, delta_meta = envelope.partition_full_vs_delta_blocks(rendered_blocks)
    ro_for_header = list(dict.fromkeys(cur_readonly + [f for f in cur_all_files if f not in cur_editable]))
    ro_header = (
        "READ-ONLY REFERENCE FILES (Do NOT generate patches for these files):\n"
        + "\n".join(f"- {f}" for f in ro_for_header)
        + "\n\n"
        if ro_for_header
        else ""
    )
    packed_text = ro_header + full_text
    clean_tree_paths = [
        f"{InSetuURI(f).volume}/{InSetuURI(f).path}".strip("/") if InSetuURI(f).volume else InSetuURI(f).path
        for f in cur_all_files
    ]
    header_block = (
        "============================================================\n"
        "INSETU AD-HOC CONTEXT PAYLOAD (Selection)\n"
        "============================================================\n\n"
        + generate_ascii_tree(clean_tree_paths)
        + "\n\n"
        + ro_header
    )
    base_filename = f"ctx://contexts/quickpack_{int(time.time())}_context.txt"
    _compile_ephemeral_quickpack(
        ctx, base_filename, header_block, [b_txt for _, _, b_txt in rendered_blocks],
        list(cur_all_files), "Quickpack", "Ad-hoc context export.",
    )

    envelope.staged_sent_hashes = dict(next_hashes)
    envelope.web_chat_delta_meta = dict(delta_meta)

    delta_base_filename = base_filename
    if base_filename and delta_meta.get("unchanged_count", 0) > 0 and delta_text:
        try:
            delta_uri = re.sub(r'_context\.txt$', '_delta_context.txt', base_filename)
            _compile_ephemeral_quickpack(
                ctx, delta_uri, "SAME-WINDOW INCREMENTAL DELTA CONTEXT\n", [delta_text],
                list(delta_meta.get("changed_uris") or cur_all_files),
                "Quickpack (Delta)", "Same-window incremental delta context.",
            )
            delta_base_filename = delta_uri
        except Exception:
            delta_base_filename = base_filename

    node_out = {
        "status": "completed",
        "base_filename": base_filename,
        "delta_base_filename": delta_base_filename,
        "delta_meta": delta_meta,
        "content": packed_text,
        "delta_content": delta_text,
        "total_tokens_estimated": len(packed_text) // 4,
    }
    vaulted_out = vault_if_oversized(ctx, target_nid, node_out)
    envelope.set_node(target_nid, vaulted_out)
    return base_filename, packed_text


def resolve_envelope_query_directives(
    ctx,
    envelope,
    directives: List[str],
    clamp_fn=None,
) -> Tuple[List[str], Set[str]]:
    """
    Parses `<<<<<<< QUERY_CONTEXT` lines (`+ vfs://...`, `- vfs://...`, `msg://<id>`)
    into `(clamped_add_uris, clamped_drop_uris)`, materializing any recalled `msg://`
    session messages onto `envelope.recalled_messages_text`.
    """
    raw_add_uris: List[str] = []
    raw_drop_uris: List[str] = []
    recalled_msgs: List[str] = []
    for q_item in (directives or [])[:12]:
        for raw_ln in str(q_item).splitlines():
            s_ln = raw_ln.strip().strip("`'")
            if not s_ln:
                continue
            is_drop = s_ln.startswith("-") or s_ln.lower().startswith("drop:")
            clean_ln = re.sub(r'^(?:[-+*]|drop:|add:)\s*', '', s_ln, flags=re.IGNORECASE).strip()
            if clean_ln.startswith(("msg://", "msg_")):
                recalled = resolve_query_context(ctx, clean_ln)
                if isinstance(recalled, dict) and recalled.get("content"):
                    recalled_msgs.append(
                        f"=== RECALLED MESSAGE {recalled.get('message_id')} (Turn #{recalled.get('seq')} · {recalled.get('role')}) ===\n"
                        f"{recalled.get('content')}"
                    )
                continue
            found_uris = re.findall(r'(?:vfs|ctx)://[A-Za-z0-9_./-]+', clean_ln)
            target_list = raw_drop_uris if is_drop else raw_add_uris
            if found_uris:
                target_list.extend(found_uris)
            elif clean_ln:
                target_list.append(clean_ln)

    if recalled_msgs:
        joined_recalled = "\n\n".join(recalled_msgs)
        envelope.recalled_messages_text = joined_recalled
        envelope.holding["recalled_messages_text"] = joined_recalled

    allowed = None if (not envelope.pinned_repos or "ALL" in envelope.pinned_repos) else list(envelope.pinned_repos)
    effective_clamp = (
        clamp_fn
        if callable(clamp_fn)
        else (lambda c, uris: clamp_rag_files_to_topology(c, uris, allowed_repos=allowed, allow_genesis=False))
    )
    clamped_add: List[str] = []
    unresolved_q_notes: List[str] = []
    for raw_u in raw_add_uris:
        resolved_one = effective_clamp(ctx, [raw_u])
        if resolved_one:
            for r_u in resolved_one:
                if r_u not in clamped_add:
                    clamped_add.append(r_u)
        else:
            unresolved_q_notes.append(
                describe_unresolved_rag_path(ctx, raw_u, allowed_repos=allowed, prefix_label="QUERY_CONTEXT path")
            )
    if unresolved_q_notes:
        err_block = "=== QUERY_CONTEXT RESOLUTION FEEDBACK ===\n" + "\n".join(unresolved_q_notes)
        recalled_msgs.append(err_block)
        joined_recalled = "\n\n".join(recalled_msgs)
        envelope.recalled_messages_text = joined_recalled
        envelope.holding["recalled_messages_text"] = joined_recalled
    clamped_drop = set(effective_clamp(ctx, raw_drop_uris)) if raw_drop_uris else set()
    envelope.apply_working_set_delta(add=clamped_add, drop=list(clamped_drop), source="probe")
    return clamped_add, clamped_drop


def _readable_by_query(ctx, uri: str) -> bool:
    """True when a QUERY_CONTEXT directive may read `uri`: any ctx:// volume, or a vfs:// file inside the workspace topology."""
    if str(uri or "").startswith("ctx://"):
        return True
    return bool(clamp_uris_to_topology(ctx.workspace_id, [uri], expand_dirs=False))


# --- Bounded Read Directive Resolver (<<<<<<< QUERY_CONTEXT) ---

def resolve_query_context(ctx, query_text: str) -> Dict[str, Any]:
    """
    Resolves single-hop symbolic or file read directives (bare vfs:///ctx:// URIs,
    filepath#SymbolName slices, JSON symbol_def/file_slice specs, or symbol_search).
    Enforces max_query_hops = 1.
    """
    clean = (query_text or "").strip()
    if clean.startswith("<<<<<<< QUERY_CONTEXT"):
        clean = clean[len("<<<<<<< QUERY_CONTEXT"):].strip()
    if clean.endswith((">>>>>>> EXECUTE", ">>>>>>> REPLACE", ">>>>>>> QUERY_CONTEXT")):
        clean = clean.rsplit(">>>>>>>", 1)[0].strip()
    clean = clean.strip("`'\"").strip()

    if clean.startswith(("msg://", "msg_")):
        canon_msg_uri, msg_id_clean, want_raw = parse_message_uri(clean)
        proj = project_resource_lens(ctx, canon_msg_uri, lens="full", raw=want_raw)
        if proj.get("content"):
            return {
                "type": "message_recall",
                "uri": canon_msg_uri,
                "message_id": msg_id_clean,
                "content": proj["content"],
            }
        return {"error": proj.get("error") or f"Message '{msg_id_clean}' not found in chat_messages."}

    # 1. Direct URI or filepath#SymbolName shorthand
    if not clean.startswith("{") and (clean.startswith(("vfs://", "ctx://")) or "/" in clean):
        fp_part, hash_sep, sym_part = clean.partition("#")
        fp_candidate = fp_part.strip()
        clamped_matches = clamp_rag_files_to_topology(ctx, [fp_candidate], max_files=1, allow_genesis=False)
        resolved_fp = clamped_matches[0] if clamped_matches else ""
        if not resolved_fp or not _readable_by_query(ctx, resolved_fp):
            return {"error": f"'{fp_candidate}' is outside this workspace's topology; QUERY_CONTEXT reads topology files only."}
        if hash_sep and sym_part.strip():
            extracted = ctx.call("cartographer.extract", filepath=resolved_fp, symbol=sym_part.strip())
            return {"type": "symbol_def", "filepath": resolved_fp, "symbol": sym_part.strip(), "result": extracted}
        if InSetuURI(resolved_fp).basename == "CODE_INDEX.md":
            return {"type": "file_read", "filepath": resolved_fp, "lens": "outline", "content": _project_code_index_filename_tree(ctx, resolved_fp)}
        content = ctx.vfs.read(resolved_fp) or ""
        if len(content) > SOFT_TOKEN_CEILING * 4:
            provider = get_language_provider(resolved_fp)
            if provider:
                content = provider.slice_interface(resolved_fp, content)
        return {"type": "file_read", "filepath": resolved_fp, "content": content}

    try:
        req = json.loads(clean)
    except Exception:
        req = {"type": "symbol_search", "query": clean}

    q_type = req.get("type", "symbol_search")
    if q_type == "symbol_def":
        target = str(req.get("target") or req.get("symbol") or "").strip()
        sep = "#" if "#" in target else ("::" if "::" in target else ":")
        raw_fp, _, sym = target.partition(sep)
        if not raw_fp or not sym:
            return {"error": "symbol_def requires target formatted with filepath and symbol (e.g. 'filepath#SymbolName')."}
        try:
            fp = InSetuURI.canonicalize(raw_fp)
        except Exception:
            return {"error": f"Invalid file URI '{raw_fp}'."}
        if not _readable_by_query(ctx, fp):
            return {"error": f"'{fp}' is outside this workspace's topology; QUERY_CONTEXT reads topology files only."}
        extracted = ctx.call("cartographer.extract", filepath=fp, symbol=sym)
        return {"type": "symbol_def", "result": extracted}

    if q_type == "file_slice":
        raw_fp = str(req.get("filepath") or req.get("file") or "").strip()
        try:
            fp = InSetuURI.canonicalize(raw_fp)
        except Exception:
            return {"error": f"Invalid file URI '{raw_fp}'."}
        if not _readable_by_query(ctx, fp):
            return {"error": f"'{fp}' is outside this workspace's topology; QUERY_CONTEXT reads topology files only."}
        s_line = int(req.get("start_line", 1))
        e_line = int(req.get("end_line", 100))
        content = ctx.vfs.read(fp)
        if content is None:
            return {"error": f"File '{fp}' not found."}
        lines = content.splitlines()
        slice_text = "\n".join(lines[max(0, s_line - 1):min(len(lines), e_line)])
        return {"type": "file_slice", "filepath": fp, "lines": f"{s_line}-{e_line}", "content": slice_text}

    # symbol_search fallback
    q = req.get("query") or req.get("symbol") or clean
    results = ctx.emit_merge_list("vfs_search", query=q)
    return {"type": "symbol_search", "query": q, "results": results[:10]}


def heal_missing_ephemeral_quickpack(ctx, base_uri: str, parsed_entry: Dict[str, Any]) -> bool:
    """Re-materializes a missing `quickpack_*` / `turn_*` context artifact from active session checkpoints or manifest file lists."""
    entry_meta = (parsed_entry.get("meta") or {}) if isinstance(parsed_entry, dict) else {}
    try:
        agent_conn = ctx.get_db("agent")
        cp_rows = agent_conn.execute(
            "SELECT checkpoint_json FROM chat_sessions WHERE checkpoint_json IS NOT NULL AND checkpoint_json != 'null' ORDER BY updated_at DESC LIMIT 10"
        ).fetchall()
        for cp_r in cp_rows:
            cp_str = cp_r["checkpoint_json"] or ""
            if base_uri not in cp_str:
                continue
            cp_obj = json.loads(cp_str)
            fc_node = (cp_obj.get("nodes") or {}).get("fetch_context") or {}
            is_delta = (fc_node.get("delta_base_filename") == base_uri or base_uri.endswith("_delta_context.txt"))
            raw_txt = fc_node.get("delta_content") if is_delta else fc_node.get("content")
            if not raw_txt and fc_node.get("_uri"):
                raw_txt = ctx.vfs.read(fc_node["_uri"], is_absolute_artifact=True)
            if not raw_txt:
                env_re = RoutineEnvelope.from_checkpoint(cp_obj)
                _, raw_txt = pack_envelope_working_set(ctx, env_re, [])
                if is_delta:
                    raw_txt = (env_re.get_node("fetch_context") or {}).get("delta_content") or raw_txt
            if raw_txt:
                cp_files = [u for u in (cp_obj.get("artifacts") or {}).keys() if isinstance(u, str) and u.startswith(("vfs://", "ctx://"))]
                hdr = "SAME-WINDOW INCREMENTAL DELTA CONTEXT\n" if is_delta else "INSETU ASSEMBLED HANDOFF CONTEXT\n"
                _compile_ephemeral_quickpack(
                    ctx, base_uri, hdr, [raw_txt], cp_files,
                    str(entry_meta.get("title") or "Quickpack"),
                    str(entry_meta.get("desc") or "Restored handoff context."),
                )
                return True
    except Exception:
        pass

    qp_files = [
        str(InSetuURI(f))
        for f in ((parsed_entry.get("files") or []) if isinstance(parsed_entry, dict) else [])
        if isinstance(f, str) and "://" in f
    ]
    if not qp_files:
        return False
    clean_tree = [f"{InSetuURI(f).volume}/{InSetuURI(f).path}".strip("/") if InSetuURI(f).volume else InSetuURI(f).path for f in qp_files]
    hdr = "============================================================\nINSETU AD-HOC CONTEXT PAYLOAD (Selection)\n============================================================\n\n" + generate_ascii_tree(clean_tree) + "\n\n"
    blks = [f"{'='*60}\n>>>NEW FILE :: {fp} | Selection\n{'='*60}\n\n{ctx.vfs.read(fp) or '[Error reading file: Not found]'}\n\n" for fp in qp_files]
    _compile_ephemeral_quickpack(
        ctx, base_uri, hdr, blks, qp_files,
        str(entry_meta.get("title") or "Quickpack"),
        str(entry_meta.get("desc") or "Ad-hoc context export."),
    )
    return True


def compile_query_quickpack(ctx, raw_text: str) -> Optional[Dict[str, Any]]:
    """Compiles a standalone Quickpack (`ctx://contexts/quickpack_*_context.txt`) from any `<<<<<<< QUERY_CONTEXT` blocks in `raw_text`."""
    from insetu.core.agent.schemas import extract_query_context_directives as _extract_q
    directives = _extract_q(raw_text)
    if not directives:
        return None
    candidate_uris: List[str] = []
    for q_block in directives[:25]:
        for raw_ln in str(q_block).splitlines():
            s_ln = raw_ln.strip().strip("`'")
            if not s_ln or s_ln.startswith("-") or s_ln.lower().startswith("drop:"):
                continue
            clean_ln = re.sub(r'^(?:[+*]|add:)\s*', '', s_ln, flags=re.IGNORECASE).strip().split("#", 1)[0].strip()
            if not clean_ln or clean_ln.startswith(("msg://", "msg_", "{")):
                continue
            found_uris = re.findall(r'(?:vfs|ctx)://[A-Za-z0-9_./-]+', clean_ln)
            candidate_uris.extend(found_uris if found_uris else [clean_ln])
    pack_files = [
        fp for fp in clamp_rag_files_to_topology(ctx, candidate_uris, max_files=50, allow_genesis=False)
        if _readable_by_query(ctx, fp)
    ]
    if not pack_files:
        return None
    clean_tree = [
        f"{InSetuURI(f).volume}/{InSetuURI(f).path}".strip("/") if InSetuURI(f).volume else InSetuURI(f).path
        for f in pack_files
    ]
    header_block = (
        "============================================================\n"
        "INSETU AD-HOC CONTEXT PAYLOAD (Selection)\n"
        "============================================================\n\n"
        + generate_ascii_tree(clean_tree)
        + "\n\n"
    )
    text_blocks: List[str] = []
    for fp in pack_files:
        proj = project_resource_lens(ctx, fp, lens="full")
        served_lens = (proj.get("served_lens") or "full").upper()
        body_txt = proj.get("content") or "[Error reading file: Not found]"
        text_blocks.append(f"{'=' * 60}\n>>>NEW FILE :: {fp} | Lens: {served_lens}\n{'=' * 60}\n\n{body_txt}\n\n")
    base_filename = f"ctx://contexts/quickpack_{int(time.time())}_context.txt"
    compiled_entry = _compile_ephemeral_quickpack(
        ctx, base_filename, header_block, text_blocks, pack_files,
        "Query Quickpack", "Epistemic QUERY_CONTEXT export.",
    )
    return {
        "base_filename": base_filename,
        "chunks": compiled_entry.get("chunks") or [base_filename],
        "files": pack_files,
        "file_count": len(pack_files),
    }
