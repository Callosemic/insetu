"""
insetu.core.gather.context_assemble
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
The Unified RAG Funnel (context.assemble):
- Resolves context payloads via deterministic "blast_radius" (0 tokens) or "llm_scout".
- Enforces the 12,000 soft token ceiling via AST interface slicing.
- Maintains the persistent Hebbian affinity graph (affinity_edges) with exponential time decay.
- Evaluates bounded single-hop <<<<<<< QUERY_CONTEXT read directives.
"""

import hashlib
import json
import os
import re
import secrets
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, TypedDict

from insetu.core.sdk import InSetuURI
from insetu.core.topology.engine_topology import clamp_uris_to_topology, discover_constitution_files, get_topology_files_for_repo
from insetu.core.utils_core import BucketAddress, compute_vfs_sha256, get_tenant_control_dir, load_json_config
from insetu.core.languages import get_language_provider
from .rag_proximity import (
    DECAY_LAMBDA,
    get_affinity_neighbors,
    prune_stale_affinity_edges,
    record_affinity_interaction,
    slice_code_index_for_blast_radius,
)

SOFT_TOKEN_CEILING = 12000
MAX_RAG_FILES_PER_HOP = 15


# --- Security Scrubbing ---

_FERNET_CIPHERTEXT_RE = re.compile(r'\bv1:[A-Za-z0-9_-]{32,}\b')


def scrub_outbound_secrets(text: str, secret_values: List[str]) -> str:
    """Scrubs Fernet ciphertext tokens, boot tokens, and workspace secrets from outbound context strings."""
    if not text:
        return ""
    scrubbed = _FERNET_CIPHERTEXT_RE.sub("[REDACTED_FERNET_CIPHERTEXT]", text)
    for env_key in ("AKASA_BOOT_TOKEN", "INSETU_BOOT_TOKEN"):
        env_tok = os.environ.get(env_key, "").strip()
        if env_tok and len(env_tok) >= 8 and env_tok in scrubbed:
            scrubbed = scrubbed.replace(env_tok, "[REDACTED_BOOT_TOKEN]")
    for sec in (secret_values or []):
        if sec and sec in scrubbed:
            scrubbed = scrubbed.replace(sec, "[REDACTED_WORKSPACE_SECRET]")
    return scrubbed


def collect_workspace_secrets(ctx) -> List[str]:
    """Collects decrypted/raw secret values from the tenant secrets.json vault for outbound scrubbing."""
    if ctx is None:
        return []
    secrets_list: List[str] = []
    try:
        sec_path = Path(get_tenant_control_dir(ctx.workspace_id)) / "secrets.json"
        if sec_path.exists():
            data = load_json_config(sec_path.as_posix(), {})
            for ext_vals in (data or {}).values():
                if isinstance(ext_vals, dict):
                    for v in ext_vals.values():
                        if isinstance(v, str) and len(v.strip()) >= 8:
                            secrets_list.append(v.strip())
    except Exception:
        pass
    return secrets_list


# --- Blast Radius Deterministic RAG ---

def assemble_blast_radius(
    ctx,
    edit_targets: List[str],
    user_message: str = "",
    history_summary: str = "",
) -> Tuple[List[str], List[Dict[str, Any]]]:
    """
    4-Layer Deterministic Blast Radius:
    1. Seed resolution (explicit edit_targets).
    2. Upstream callees (exact imported symbol definitions).
    3. Downstream callers (export impact radius via Cartographer / search).
    4. Topological bucket siblings & Hebbian affinity edges.
    """
    clean_edits = clamp_uris_to_topology(
        ctx.workspace_id,
        list(dict.fromkeys(str(InSetuURI(f)) for f in edit_targets if f)),
        expand_dirs=True,
    )
    reference_map: Dict[str, Set[str]] = {}

    # Layer 2: Upstream Callees (AST imports)
    for ef in clean_edits:
        content = ctx.vfs.read(ef)
        if not content:
            continue
        provider = get_language_provider(ef)
        if not provider:
            continue
        for imp in provider.imports(ef, content):
            mod_path = imp.get("module") or ""
            names = imp.get("names") or []
            if not mod_path or mod_path.startswith("."):
                uri_obj = InSetuURI(ef)
                cand_uri = uri_obj.parent_uri.join(mod_path.lstrip("./"))
                trials = [str(cand_uri)] + [f"{cand_uri}{ext}" for ext in (".py", ".js", ".ts", ".rs")]
                matched_trials = clamp_uris_to_topology(ctx.workspace_id, trials, expand_dirs=False)
                if matched_trials:
                    target_str = matched_trials[0]
                    if target_str not in clean_edits:
                        reference_map.setdefault(target_str, set()).update(names)

    # Layer 3: Downstream Callers (Export impact radius)
    for ef in clean_edits:
        uri_obj = InSetuURI(ef)
        provider = get_language_provider(ef)
        content = ctx.vfs.read(ef)
        if provider and content:
            for exp in provider.exports(ef, content):
                exp_name = exp.get("name")
                if not exp_name:
                    continue
                hits = ctx.emit_merge_list("vfs_search", query=exp_name)
                for hit in hits[:3]:
                    hit_path = str(InSetuURI(hit.get("path") or ""))
                    if hit_path and hit_path not in clean_edits and hit_path != ef:
                        reference_map.setdefault(hit_path, set()).add(exp_name)

    # Layer 4: Bucket Siblings & Affinity Edges
    for ef in clean_edits:
        b_addr = BucketAddress.from_vfs_path(ef, ctx.workspace_id)
        if b_addr and b_addr.repo:
            for sib in get_topology_files_for_repo(ctx.workspace_id, b_addr.repo)[:4]:
                if sib not in clean_edits and sib not in reference_map:
                    reference_map.setdefault(sib, set())

    # Add Hebbian affinity peers
    for peer in get_affinity_neighbors(ctx, clean_edits, top_k=4):
        if peer not in clean_edits and peer not in reference_map:
            reference_map.setdefault(peer, set())

    valid_ref_uris = set(clamp_uris_to_topology(ctx.workspace_id, list(reference_map.keys()), expand_dirs=False))
    ref_targets = [
        {"filepath": fp, "symbols": sorted(syms)}
        for fp, syms in reference_map.items()
        if fp in valid_ref_uris and ctx.vfs.read(fp) is not None
    ][:MAX_RAG_FILES_PER_HOP]

    return clean_edits, ref_targets


def parse_message_uri(raw_uri: str) -> Tuple[str, str, bool]:
    """
    Canonicalizes any session message reference (`msg://<id>`, `msg://<session_id>/<id>`,
    or bare `msg_<id>`, with optional `[raw]` / `[full]` qualifiers) into
    `(canonical_uri, message_id, want_raw)` where `canonical_uri` is `msg://<message_id>`.
    """
    raw = str(raw_uri or "").strip()
    want_raw = bool(re.search(r'\[raw\]', raw, flags=re.IGNORECASE))
    cleaned = re.sub(r'\[(?:raw|full)\]', '', raw, flags=re.IGNORECASE).strip()
    if cleaned.startswith("msg://"):
        msg_id = cleaned[len("msg://"):].strip().strip("/").rsplit("/", 1)[-1].strip()
    else:
        msg_id = cleaned.strip()
    if not msg_id:
        return "msg://", "", want_raw
    return f"msg://{msg_id}", msg_id, want_raw


def _build_projection_dict(
    uri: str,
    requested_lens: str,
    served_lens: str,
    text: str,
    truncated: bool = False,
    **extra,
) -> Dict[str, Any]:
    body = text or ""
    tok = max(1, len(body) // 4) if body else 0
    sha = compute_vfs_sha256(body) if body else ""
    return {
        "uri": uri,
        "lens": requested_lens,
        "served_lens": served_lens,
        "content": body,
        "text": body,
        "tokens": tok,
        "sha256": sha,
        "truncated": bool(truncated),
        **extra,
    }


def project_resource_lens(
    ctx,
    uri: str,
    lens: str = "full",
    **params,
) -> Dict[str, Any]:
    """
    Universal Representational Lens Projector (`Project(URI, lens, params) -> representation`):
    Projects any URI-addressed context artifact (`vfs://`, `ctx://`, `msg://`, `mddb://`, `tel://`)
    through one of the 5 canonical lenses (`full`, `diff`, `slice`, `outline`, `genesis`).
    """
    clean_uri = str(uri or "").strip()
    clean_lens = str(lens or "full").strip().lower()
    if clean_lens not in ("full", "diff", "slice", "outline", "genesis"):
        clean_lens = "full"

    # 1. Session Message Artifacts (canonical: msg://<message_id>)
    if clean_uri.startswith(("msg://", "msg_")):
        canon_msg_uri, msg_id, uri_wants_raw = parse_message_uri(clean_uri)
        try:
            agent_conn = ctx.get_db("agent")
            row = agent_conn.execute(
                "SELECT message_id, session_id, seq, role, content, raw_content, receipt, transaction_id, compacted_into_id FROM chat_messages WHERE message_id=?",
                (msg_id,),
            ).fetchone()
            if not row:
                return _build_projection_dict(canon_msg_uri, clean_lens, clean_lens, "")
            rk = dict(row)
            served = clean_lens
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
                body = rk.get("raw_content") if (want_raw and rk.get("raw_content")) else rk.get("content")
                text_out = f"=== MESSAGE {rk['message_id']} (Turn #{rk.get('seq')} · {rk.get('role')}) ===\n{body or ''}"
            return _build_projection_dict(canon_msg_uri, clean_lens, served, text_out)
        except Exception as exc:
            return _build_projection_dict(canon_msg_uri, clean_lens, clean_lens, "", error=str(exc))

    # 2. Markdown Database Record Artifacts (mddb://<scope>/<record_id>)
    if clean_uri.startswith("mddb://") and hasattr(ctx, "mddb"):
        rec_path = clean_uri[len("mddb://"):].strip()
        db_scope, _, rec_id = rec_path.partition("/")
        try:
            rec = ctx.mddb.get_record(rec_id or db_scope, db_scope=db_scope if rec_id else None, include_body=(clean_lens == "full"))
            if not rec:
                return _build_projection_dict(clean_uri, clean_lens, clean_lens, "")
            if clean_lens == "outline":
                text_out = f"[{rec.get('id')}] {rec.get('title')} ({rec.get('status')})"
            else:
                text_out = json.dumps(rec, indent=2)
            return _build_projection_dict(clean_uri, clean_lens, clean_lens, text_out)
        except Exception:
            return _build_projection_dict(clean_uri, clean_lens, clean_lens, "")

    # 3. VFS / Context File Artifacts (vfs://, ctx://, ws://)
    canon_uri = InSetuURI.canonicalize(clean_uri)
    if clean_lens == "outline":
        max_c = int(params.get("max_chars", 4000))
        outline_txt = slice_code_index_for_blast_radius(ctx, [canon_uri], max_chars=max_c)
        return _build_projection_dict(canon_uri, "outline", "outline", outline_txt, truncated=("truncated]" in outline_txt))

    raw_text = ctx.vfs.read(canon_uri)
    if raw_text is None:
        # Day-0 / Genesis Target Projection: File does not exist on disk yet
        uri_obj = InSetuURI(canon_uri)
        sib_Notes: List[str] = []
        if uri_obj.scheme == "vfs" and uri_obj.repo:
            parent_dir = str(uri_obj.parent_uri).rstrip("/") + "/"
            siblings = clamp_uris_to_topology(ctx.workspace_id, [parent_dir], expand_dirs=True)[:3]
            for sib in siblings:
                sib_txt = ctx.vfs.read(sib)
                if sib_txt:
                    prov = get_language_provider(sib)
                    sib_slice = prov.slice_interface(sib, sib_txt) if prov else sib_txt[:600]
                    sib_Notes.append(f"--- Sibling Interface ({sib}) ---\n{sib_slice}")
        genesis_body = (
            f"[NEW FILE TO CREATE — GENESIS TARGET: {canon_uri}]\n"
            f"(Emit a Yomama Genesis patch with an empty SEARCH block `<<<<<<< FILE: {canon_uri}\\n<<<<<<< COMMENT\\nOne-sentence module summary.\\n<<<<<<< SEARCH\\n=======\\n...\\n>>>>>>> REPLACE` to create this file.)"
        )
        if sib_Notes:
            genesis_body += "\n\n" + "\n\n".join(sib_Notes)
        return _build_projection_dict(canon_uri, clean_lens, "genesis", genesis_body)

    if clean_lens == "genesis":
        # File already exists on disk; serve full content
        return _build_projection_dict(canon_uri, "genesis", "full", raw_text)

    if clean_lens == "slice":
        prov = get_language_provider(canon_uri)
        req_syms = params.get("requested_symbols")
        truncated = False
        if prov:
            try:
                sliced = (
                    prov.slice_interface(canon_uri, raw_text, requested_symbols=req_syms)
                    if req_syms
                    else prov.slice_interface(canon_uri, raw_text)
                )
            except TypeError:
                sliced = prov.slice_interface(canon_uri, raw_text)
        else:
            sliced = raw_text[:2000]
            truncated = len(raw_text) > 2000
        return _build_projection_dict(canon_uri, "slice", "slice", sliced, truncated=truncated)

    if clean_lens == "diff":
        base_text = params.get("base_text")
        if base_text is not None:
            from insetu.core.languages import format_interleaved_file_diff as _fmt_diff
            diff_str = _fmt_diff(canon_uri, str(base_text), raw_text)
            return _build_projection_dict(canon_uri, "diff", "diff", diff_str)

    return _build_projection_dict(canon_uri, clean_lens, "full", raw_text)


# --- Main Assembler Capability ---

def detect_external_edits(ctx, filepaths: List[str]) -> List[str]:
    """
    SHA-256 External Edit Detection (Section 3.1):
    Compares live disk SHA-256 of working_set files against the latest bridge_ledger post_patch_hash.
    Returns a list of 1-line system notices for files manually edited outside the bridge.
    """
    notices: List[str] = []
    if not filepaths:
        return notices
    try:
        bridge_db = ctx.get_db("bridge")
    except Exception:
        return notices

    for fp in filepaths:
        norm_fp = str(InSetuURI(fp))
        content = ctx.vfs.read(norm_fp)
        if content is None:
            continue
        live_hash = compute_vfs_sha256(content)
        row = bridge_db.execute(
            "SELECT post_patch_hash FROM bridge_ledger WHERE filepath=? ORDER BY timestamp DESC LIMIT 1",
            (norm_fp,),
        ).fetchone()
        if row and row["post_patch_hash"] and row["post_patch_hash"] != live_hash:
            notices.append(f"[System Note: User manually edited {norm_fp} in editor since last turn]")
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

    # Read and estimate total tokens across all 3 tiers
    raw_files: Dict[str, str] = {}
    total_chars = 0
    for cf in tier0_constitution:
        c = ctx.vfs.read(cf) or ""
        raw_files[cf] = c
        total_chars += len(c)

    for ef in clean_edits:
        c = ctx.vfs.read(ef) or ""
        raw_files[ef] = c
        total_chars += len(c)

    for rf in ref_targets:
        fp = rf["filepath"]
        c = ctx.vfs.read(fp) or ""
        raw_files[fp] = c
        total_chars += len(c)

    est_tokens = total_chars // 4
    sliced = False
    saved_chars = 0
    blocks: List[str] = []

    # 3-Tier KV-Cache Prefix Ordering (Section 3.1):
    # Tier 0: Constitution Files (100% Static Prefix)
    for cf in tier0_constitution:
        if raw_files.get(cf):
            blocks.append(f"=== TIER 0 CONSTITUTION (Engineering Standard): {cf} ===\n{raw_files[cf]}\n")

    # Tier 1: Reference Interface Context (Semi-Static AST Slices)
    should_slice = est_tokens > SOFT_TOKEN_CEILING
    for rf in ref_targets:
        fp = rf["filepath"]
        full_text = raw_files.get(fp) or ""
        if should_slice:
            provider = get_language_provider(fp)
            if provider:
                packed = provider.slice_interface(fp, full_text, requested_symbols=rf.get("symbols"))
                sliced = True
                saved_chars += max(0, len(full_text) - len(packed))
            else:
                packed = full_text
            blocks.append(f"=== TIER 1 REFERENCE INTERFACE (AST Sliced): {fp} ===\n{packed}\n")
        else:
            blocks.append(f"=== TIER 1 REFERENCE TARGET: {fp} ===\n{full_text}\n")

    # Tier 1b: Neighborhood CODE_INDEX.md Subset (Outline Lens around working set)
    outline_Seeds = clean_edits + [r["filepath"] for r in ref_targets]
    outline_block = slice_code_index_for_blast_radius(ctx, outline_Seeds)
    if outline_block:
        blocks.append(outline_block)

    # Tier 2: Pinned Edit Targets (Volatile Full Source Tail)
    for ef in clean_edits:
        blocks.append(f"=== TIER 2 EDIT TARGET (Full Source): {ef} ===\n{raw_files.get(ef, '')}\n")

    external_notices = detect_external_edits(ctx, clean_edits + [r["filepath"] for r in ref_targets])
    if external_notices:
        blocks.append("\n".join(external_notices) + "\n")

    assembled_body = "\n".join(blocks)
    secrets_list = collect_workspace_secrets(ctx)
    scrubbed_body = scrub_outbound_secrets(assembled_body, secrets_list)

    nonce = secrets.token_hex(4)
    envelope = (
        f"<workspace_context_{nonce}>\n"
        f"{scrubbed_body}\n"
        f"</workspace_context_{nonce}>\n"
    )

    bundle_hash = hashlib.sha256(envelope.encode("utf-8")).hexdigest()[:12]
    context_uri = f"ctx://contexts/turn_{bundle_hash}_context.txt"
    all_turn_files = list(dict.fromkeys(tier0_constitution + [r["filepath"] for r in ref_targets] + clean_edits))
    compiled_entry = ctx.compile_context(
        base_uri=context_uri,
        header_block="INSETU ASSEMBLED TURN CONTEXT\n",
        text_blocks=[envelope],
        files=all_turn_files,
        meta={"type": "gather", "title": "Turn Context", "domain": "Quickpacks", "desc": "Assembled turn context payload."},
        is_ephemeral=True,
    )
    ctx.sync_vfs_barrier()
    ctx.save_manifest({context_uri: compiled_entry}, is_full_compile=False)
    for ch_uri in compiled_entry.get("chunks", [context_uri]):
        phys_ch = ctx.resolve_path(ch_uri)
        if phys_ch:
            ctx.jobs.register_ephemeral(phys_ch, ttl_seconds=3600, owner="agent_turn")

    return {
        "context_uri": context_uri,
        "content": envelope,
        "constitution_files": tier0_constitution,
        "edit_targets": clean_edits,
        "reference_targets": ref_targets,
        "external_edit_notices": external_notices,
        "total_tokens_estimated": len(envelope) // 4,
        "saved_by_slicing_tokens": saved_chars // 4,
        "sliced": sliced,
    }


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

    # 0. Canonical Chat Message Recall (msg://<message_id> or msg_<id>)
    if clean.startswith(("msg://", "msg_")):
        canon_msg_uri, msg_id_clean, want_raw = parse_message_uri(clean)
        try:
            agent_conn = ctx.get_db("agent")
            row = agent_conn.execute(
                "SELECT message_id, session_id, seq, role, content, raw_content, receipt, transaction_id, timestamp FROM chat_messages WHERE message_id=?",
                (msg_id_clean,),
            ).fetchone()
            if row:
                rk = dict(row)
                body = rk.get("raw_content") if want_raw and rk.get("raw_content") else rk.get("content")
                return {
                    "type": "message_recall",
                    "uri": canon_msg_uri,
                    "message_id": rk["message_id"],
                    "seq": rk.get("seq"),
                    "role": rk.get("role"),
                    "transaction_id": rk.get("transaction_id"),
                    "content": body,
                }
            return {"error": f"Message '{msg_id_clean}' not found in chat_messages."}
        except Exception as exc:
            return {"error": f"Failed to recall message '{msg_id_clean}': {exc}"}

    # 1. Direct URI or filepath#SymbolName shorthand
    if not clean.startswith("{") and (clean.startswith(("vfs://", "ctx://")) or "/" in clean):
        fp_part, hash_sep, sym_part = clean.partition("#")
        fp_candidate = fp_part.strip()
        try:
            canon_uri = InSetuURI.canonicalize(fp_candidate)
        except Exception:
            canon_uri = ""
        resolved_fp = ""
        if canon_uri and ctx.vfs.read(canon_uri) is not None:
            resolved_fp = canon_uri
        else:
            cands = ctx.find_path_candidates(fp_candidate)
            if cands and cands[0].get("score", 0) >= 0.75:
                resolved_fp = cands[0]["filepath"]
        if resolved_fp and not _readable_by_query(ctx, resolved_fp):
            return {"error": f"'{resolved_fp}' is outside this workspace's topology; QUERY_CONTEXT reads topology files only."}
        if resolved_fp:
            if hash_sep and sym_part.strip():
                extracted = ctx.call("cartographer.extract", filepath=resolved_fp, symbol=sym_part.strip())
                return {"type": "symbol_def", "filepath": resolved_fp, "symbol": sym_part.strip(), "result": extracted}
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
    pack_files = clamp_uris_to_topology(ctx.workspace_id, candidate_uris, expand_dirs=False)[:50]
    if not pack_files:
        for cand in candidate_uris:
            matches = ctx.find_path_candidates(cand)
            if matches and matches[0].get("score", 0) >= 0.75:
                fp = matches[0]["filepath"]
                if fp not in pack_files and _readable_by_query(ctx, fp):
                    pack_files.append(fp)
    if not pack_files:
        return None
    packed = ctx.call("gather.pack_selection", items=[{"filepath": f} for f in pack_files], gather_only=False, wait=True)
    if not isinstance(packed, dict) or not packed.get("base_filename"):
        return None
    return {
        "base_filename": packed["base_filename"],
        "chunks": packed.get("chunks") or [packed["base_filename"]],
        "files": pack_files,
        "file_count": len(pack_files),
    }
