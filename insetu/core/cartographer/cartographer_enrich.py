"""Fast-tier LLM symbol enrichment and [stale?] description review for Cartographer."""
import json
import re
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from insetu.core.languages import (
    extract_file_symbols,
    first_sentence as _first_sentence,
    get_language_provider,
)
from insetu.core.topology.engine_topology import (
    get_topology_files_for_repo,
    resolve_repo_code_index_uri,
)
from insetu.core.utils_core import InSetuURI, get_repo_path

ENRICH_BATCH_SIZE = 25
MAX_ENRICH_BATCHES_PER_REPO = 8
ENRICH_KEEP = "KEEP"
ENRICH_SYSTEM_PROMPT = (
    "You maintain the descriptions in a code index. Reply with ONLY a JSON object (no markdown fences) mapping each KEY "
    "to its answer.\n"
    "- DESCRIBE items: a one-sentence description (under 110 characters) of the symbol's responsibility.\n"
    "- REVIEW items: the code changed since its description was written. If the description is still accurate, answer "
    "exactly \"KEEP\". Otherwise answer a revised one-line description that keeps every statement that is still true, "
    "including intent, constraints and context the code does not show, and changes only what the code made wrong."
)


def build_enrich_symbol_context(rel_p: str, f_content: str, sym: Dict[str, Any], file_desc: str = "") -> str:
    """
    Builds a high-signal source excerpt for Cartographer symbol enrichment and [stale?] review:
    - Prepends the enclosing file's 1-sentence description when known.
    - For functions <= 65 lines: includes the full function source so bottom-of-function edits are visible.
    - For classes > 65 lines: delegates to `provider.slice_interface` so all method signatures/docstrings remain visible.
    - For functions > 65 lines: includes the first 35 lines + '...' + the last 25 lines.
    """
    lines = (f_content or "").splitlines()
    s_line = max(1, int(sym.get("start_line") or 1))
    e_line = min(len(lines), int(sym.get("end_line") or s_line))
    span_lines = lines[s_line - 1:e_line]
    header_prefix = f"# File: {rel_p} — {file_desc}\n" if file_desc else f"# File: {rel_p}\n"

    if len(span_lines) <= 65:
        body = "\n".join(span_lines) if span_lines else (sym.get("snippet") or "")
        return f"{header_prefix}{body}"

    if sym.get("kind") == "class":
        provider = get_language_provider(rel_p)
        span_text = "\n".join(span_lines)
        sliced = provider.slice_interface(rel_p, span_text) if provider else span_text
        sliced_lines = sliced.splitlines()
        if len(sliced_lines) > 70:
            sliced = "\n".join(sliced_lines[:70]) + "\n    # ... [remaining methods omitted] ..."
        return f"{header_prefix}{sliced}"

    head_part = "\n".join(span_lines[:35])
    tail_part = "\n".join(span_lines[-25:])
    omitted_count = len(span_lines) - 60
    return f"{header_prefix}{head_part}\n    # ... [{omitted_count} lines omitted] ...\n{tail_part}"


def parse_enrich_reply_map(llm_res: Any) -> Dict[str, Any]:
    """Extracts and parses the JSON key->description map from an llm.complete response."""
    if isinstance(llm_res, dict) and isinstance(llm_res.get("parsed"), dict):
        return llm_res["parsed"]
    raw_reply = llm_res.get("text", "") if isinstance(llm_res, dict) else str(llm_res or "")
    fence_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', raw_reply)
    cleaned = (fence_match.group(1) if fence_match else raw_reply).strip()
    if not cleaned.startswith("{") and "{" in cleaned:
        cleaned = cleaned[cleaned.find("{"):]
    cleaned = re.sub(r',\s*([}\]])', r'\1', cleaned)
    if not cleaned.startswith("{"):
        return {}
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        try:
            parsed, _ = json.JSONDecoder().raw_decode(cleaned)
        except Exception:
            return {}
    return parsed if isinstance(parsed, dict) else {}


def execute_cartographer_enrich(
    ctx,
    repo_configs: List[Dict[str, Any]],
    extract_existing_comments_fn: Callable[..., Dict[str, str]],
    map_repositories_fn: Callable[..., Any],
    sig_cache: Dict[Tuple[str, str], Any],
    cache_lock: Any,
) -> Dict[str, Any]:
    """
    Describes '[comment required]' symbols and reviews '[stale?]' ones across batched fast-tier calls.
    A reviewed description the LLM keeps stays word for word and is verified at the current code;
    a revised one replaces it only if the index still holds the text the LLM reviewed.
    """
    totals = {"described": 0, "kept": 0, "revised": 0}
    max_symbols_per_repo = ENRICH_BATCH_SIZE * MAX_ENRICH_BATCHES_PER_REPO

    for r_cfg in repo_configs:
        r_dir = r_cfg.get("repo_dir")
        if not r_dir:
            continue
        with cache_lock:
            is_cold = (ctx.workspace_id or "default", r_dir) not in sig_cache
        if is_cold:
            map_repositories_fn(ctx.workspace_id, silent=True, target_repos=[r_dir])
            ctx.sync_vfs_barrier()

        logical_index_path = resolve_repo_code_index_uri(ctx, r_dir, r_cfg)
        index_text = ctx.vfs.read(logical_index_path) or ""
        repo_path = Path(get_repo_path(r_dir, ctx.workspace_id)).resolve()
        index_phys = repo_path / InSetuURI(logical_index_path).path
        comments = extract_existing_comments_fn(index_phys, repo_path, vfs_content=index_text)

        to_describe: Dict[str, str] = {}
        to_review: Dict[str, Tuple[str, str, str]] = {}
        ledger_keys: Dict[str, str] = {}
        for f_uri in get_topology_files_for_repo(ctx.workspace_id, r_dir):
            rel_p = InSetuURI(f_uri).path
            f_content = ctx.vfs.read(f_uri)
            if not f_content:
                continue
            file_desc = str(comments.get(rel_p) or "").strip()
            for s in extract_file_symbols(rel_p, f_content) or []:
                sig = s["signature"]
                key = f"{rel_p}/{sig}"
                existing = str(comments.get(key) or comments.get(sig) or s.get("docstring") or "").strip()
                if not existing:
                    to_describe[key] = build_enrich_symbol_context(rel_p, f_content, s, file_desc)
                elif existing.startswith("[stale?]"):
                    description = re.sub(r'^\[stale\?\]\s*', '', existing).strip()
                    to_review[key] = (existing, description, build_enrich_symbol_context(rel_p, f_content, s, file_desc))
                    ledger_keys[key] = f"{f_uri}::{sig}"
                if len(to_describe) + len(to_review) >= max_symbols_per_repo:
                    break
            if len(to_describe) + len(to_review) >= max_symbols_per_repo:
                break
        if not to_describe and not to_review:
            continue

        all_items: List[Tuple[str, str]] = [
            (k, f"DESCRIBE\nKEY: {k}\n```Code\n{snip}\n```") for k, snip in to_describe.items()
        ] + [
            (k, f"REVIEW\nKEY: {k}\nCURRENT DESCRIPTION: {desc}\n```Code\n{snip}\n```")
            for k, (_seen, desc, snip) in to_review.items()
        ]
        batches = [all_items[i:i + ENRICH_BATCH_SIZE] for i in range(0, len(all_items), ENRICH_BATCH_SIZE)]
        generated: Dict[str, Any] = {}
        keep_keys: List[str] = []

        for b_idx, batch in enumerate(batches, start=1):
            ctx.jobs.update_progress(
                f"Describing and reviewing symbols for {r_dir} (batch {b_idx}/{len(batches)})..."
            )
            sections = [prompt_sec for _, prompt_sec in batch]
            try:
                llm_res = ctx.call(
                    "llm.complete",
                    messages=[{"role": "user", "content": "\n\n".join(sections)}],
                    system=ENRICH_SYSTEM_PROMPT,
                    tier="fast",
                    output_schema="json",
                    max_retries=2,
                    wait=True,
                )
                reply = parse_enrich_reply_map(llm_res)
            except Exception as e:
                print(f"⚠️ [Cartographer Enrich] LLM batch {b_idx}/{len(batches)} failed for {r_dir}: {e}")
                continue

            for key, answer in reply.items():
                raw_ans = " ".join(str(answer or "").split()).lstrip("#").strip()
                raw_ans = re.sub(r'^\[stale\?\]\s*', '', raw_ans).strip()
                if not raw_ans:
                    continue
                if key in to_describe:
                    clean_desc = _first_sentence(raw_ans)
                    if clean_desc:
                        generated[key] = clean_desc
                        totals["described"] += 1
                elif key in to_review:
                    seen, description, _snip = to_review[key]
                    if raw_ans.strip('"').upper() == ENRICH_KEEP or raw_ans == description:
                        keep_keys.append(ledger_keys[key])
                        totals["kept"] += 1
                    else:
                        generated[key] = {"text": raw_ans, "replaces": seen}
                        totals["revised"] += 1

        if keep_keys:
            now_ts = time.time()
            ctx.db.executemany(
                "UPDATE symbol_ledger SET verified_hash = body_hash, status = 'verified', updated_at = ? WHERE symbol_key = ?",
                [(now_ts, k) for k in keep_keys],
            )
            ctx.db.commit()

        if generated or keep_keys:
            with cache_lock:
                sig_cache.pop((ctx.workspace_id or "default", r_dir), None)
            map_repositories_fn(ctx.workspace_id, target_repos=[r_dir], extra_comments={r_dir: generated})

    ctx.sync_vfs_barrier()
    enriched_total = sum(totals.values())
    return {
        "message": f"Described {totals['described']}, kept {totals['kept']} and revised {totals['revised']} symbol description(s).",
        "artifact": {"enriched_count": enriched_total, **totals},
    }
