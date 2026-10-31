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
import math
import os
import re
import secrets
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, TypedDict

from insetu.core.sdk import InSetuURI
from insetu.core.topology.engine_topology import (
    discover_constitution_files,
    get_topology_files_for_repo,
)
from insetu.core.utils_core import (
    BucketAddress,
    compute_vfs_sha256,
    get_tenant_control_dir,
    load_json_config,
)
from insetu.core.languages import get_language_provider

SOFT_TOKEN_CEILING = 12000
MAX_RAG_FILES_PER_HOP = 15
DECAY_LAMBDA = 0.00001  # Half-life of ~19 hours


# --- Hebbian Affinity Graph Helpers ---

def record_affinity_interaction(
    ctx,
    file_list: List[str],
    interaction_type: str = "chat",
    weight: float = 1.0,
) -> None:
    """Updates co-occurrence weights in the persistent SQLite affinity_edges table."""
    valid_files = sorted(list(dict.fromkeys(str(InSetuURI(f)) for f in file_list if f and "://" in str(f))))
    if len(valid_files) < 2:
        return

    now_ts = time.time()
    conn = ctx.get_db("vfs_index")
    updates = []

    for i in range(len(valid_files)):
        for j in range(i + 1, len(valid_files)):
            fa, fb = valid_files[i], valid_files[j]
            edge_id = f"{fa}::{fb}"
            c_commit = weight if interaction_type == "commit" else 0.0
            c_pin = weight if interaction_type == "pin" else 0.0
            c_chat = weight if interaction_type == "chat" else 0.0
            c_miss = weight if interaction_type == "miss" else 0.0
            updates.append((edge_id, fa, fb, c_commit, c_pin, c_chat, c_miss, now_ts))

    conn.executemany("""
        INSERT INTO affinity_edges (edge_id, file_a, file_b, commit_co_count, pin_co_count, chat_co_count, scout_miss_count, last_updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(edge_id) DO UPDATE SET
            commit_co_count = commit_co_count + excluded.commit_co_count,
            pin_co_count = pin_co_count + excluded.pin_co_count,
            chat_co_count = chat_co_count + excluded.chat_co_count,
            scout_miss_count = scout_miss_count + excluded.scout_miss_count,
            last_updated_at = excluded.last_updated_at
    """, updates)
    conn.commit()


def get_affinity_neighbors(ctx, seed_files: List[str], top_k: int = 5) -> List[str]:
    """Calculates time-decayed Hebbian affinity scores to return top correlated peer files."""
    if not seed_files:
        return []
    conn = ctx.get_db("vfs_index")
    now_ts = time.time()
    seed_set = {str(InSetuURI(s)) for s in seed_files}
    placeholders = ",".join(["?"] * len(seed_set))

    rows = conn.execute(f"""
        SELECT file_a, file_b, commit_co_count, pin_co_count, chat_co_count, scout_miss_count, last_updated_at
        FROM affinity_edges
        WHERE file_a IN ({placeholders}) OR file_b IN ({placeholders})
    """, tuple(seed_set) + tuple(seed_set)).fetchall()

    scores: Dict[str, float] = {}
    for r in rows:
        fa, fb = r["file_a"], r["file_b"]
        peer = fb if fa in seed_set else fa
        if peer in seed_set:
            continue
        dt = max(0.0, now_ts - float(r["last_updated_at"]))
        decay = math.exp(-DECAY_LAMBDA * dt)
        raw_w = (
            3.0 * float(r["commit_co_count"])
            + 2.0 * float(r["pin_co_count"])
            + 1.0 * float(r["chat_co_count"])
            - 0.5 * float(r["scout_miss_count"])
        )
        effective = raw_w * decay
        if effective > 0.0:
            scores[peer] = scores.get(peer, 0.0) + effective

    sorted_peers = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [p[0] for p in sorted_peers[:top_k]]


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
    clean_edits = list(dict.fromkeys(str(InSetuURI(f)) for f in edit_targets if f))
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
                if not cand_uri.exists(ctx.workspace_id):
                    for ext in (".py", ".js", ".ts", ".rs"):
                        trial = InSetuURI(f"{cand_uri}{ext}")
                        if trial.exists(ctx.workspace_id):
                            cand_uri = trial
                            break
                if cand_uri.exists(ctx.workspace_id):
                    target_str = str(cand_uri)
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

    ref_targets = [
        {"filepath": fp, "symbols": sorted(syms)}
        for fp, syms in reference_map.items()
        if ctx.vfs.read(fp) is not None
    ][:MAX_RAG_FILES_PER_HOP]

    return clean_edits, ref_targets


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





class ContextAssemblePayload(TypedDict, total=False):
    edit_targets: List[str]
    reference_files: Optional[List[str]]
    constitution_files: Optional[List[str]]
    user_message: str
    strategy: Optional[str]
    session_id: Optional[str]
    history_summary: Optional[str]


class ContextAssembleResponse(TypedDict):
    context_uri: str
    content: str
    constitution_files: List[str]
    edit_targets: List[str]
    reference_targets: List[Dict[str, Any]]
    external_edit_notices: List[str]
    total_tokens_estimated: int
    saved_by_slicing_tokens: int
    sliced: bool


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

    # Merge explicit reference_files into ref_targets
    existing_refs = {r["filepath"] for r in ref_targets}
    for exp_ref in (reference_files or []):
        norm_ref = str(InSetuURI(exp_ref))
        if norm_ref not in clean_edits and norm_ref not in existing_refs and ctx.vfs.read(norm_ref) is not None:
            ref_targets.append({"filepath": norm_ref, "symbols": []})
            existing_refs.add(norm_ref)
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
    ctx.vfs.save(context_uri, envelope, data={"ignore_ledger": True})
    ctx.jobs.register_ephemeral(ctx.resolve_path(context_uri), ttl_seconds=3600, owner="agent_turn")

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


# --- Bounded Read Directive Resolver (<<<<<<< QUERY_CONTEXT) ---

def resolve_query_context(ctx, query_text: str) -> Dict[str, Any]:
    """
    Resolves single-hop symbolic read directives (symbol_def, file_slice, symbol_search).
    Enforces max_query_hops = 1.
    """
    clean = query_text.strip()
    if clean.startswith("<<<<<<< QUERY_CONTEXT"):
        clean = clean[len("<<<<<<< QUERY_CONTEXT"):].strip()
    if clean.endswith(">>>>>>> EXECUTE") or clean.endswith(">>>>>>> REPLACE"):
        clean = clean.rsplit(">>>>>>>", 1)[0].strip()

    try:
        req = json.loads(clean)
    except Exception:
        req = {"type": "symbol_search", "query": clean}

    q_type = req.get("type", "symbol_search")
    if q_type == "symbol_def":
        target = str(req.get("target") or req.get("symbol") or "").strip()
        sep = "#" if "#" in target else ("::" if "::" in target else ":")
        fp, _, sym = target.partition(sep)
        if not fp or not sym:
            return {"error": "symbol_def requires target formatted with filepath and symbol (e.g. 'filepath#SymbolName')."}
        extracted = ctx.call("cartographer.extract", filepath=fp, symbol=sym)
        return {"type": "symbol_def", "result": extracted}

    if q_type == "file_slice":
        fp = req.get("filepath") or req.get("file") or ""
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
