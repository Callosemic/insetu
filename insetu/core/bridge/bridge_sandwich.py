"""
insetu.core.bridge.bridge_sandwich
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Tier 2 Deterministic Sandwich-Weighted Anchor Healer (`find_sandwich_fuzzy_anchor`)
and 3-Way Overlapping Chunk Rebaser (`rebase_overlapping_block_in_memory`).
"""

import difflib
from typing import Any, Callable, Dict, List, Optional, Tuple

from insetu.core.utils_core import three_way_merge_text

_TRIVIAL_BOUNDARY_LINES = frozenset({
    "{", "}", "};", ");", "});", "]);", "]", ")", "else:", "try:", "finally:", "pass", "break", "continue", "return",
})


def _is_nontrivial_anchor_line(stripped_line: str) -> bool:
    clean = stripped_line.strip()
    if not clean or clean in _TRIVIAL_BOUNDARY_LINES:
        return False
    return len(clean) >= 8 or any(tok in clean for tok in ("def ", "class ", "function ", "export ", "return ", "="))


def find_sandwich_fuzzy_anchor(file_lines: List[str], block_lines: List[str]) -> Optional[Dict[str, Any]]:
    """
    Tier 2 Deterministic Sandwich-Weighted Anchor Healer:
    Locates candidate windows in `file_lines` where the top k_top and bottom k_bot lines of `block_lines`
    match verbatim (the 'sandwich bread') and the interior lines have minor whitespace/comment/token drift.
    """
    s_non_empty = [
        (idx, l.strip())
        for idx, l in enumerate(block_lines)
        if l.strip() and l.strip().upper() != "{{UNTIL}}"
    ]
    if len(s_non_empty) < 2 or any(l.strip().upper() == "{{UNTIL}}" for l in block_lines):
        return None

    f_non_empty = [(idx, l.strip()) for idx, l in enumerate(file_lines) if l.strip()]
    if len(f_non_empty) < len(s_non_empty):
        return None

    m_len = len(s_non_empty)
    s_texts = [t for _, t in s_non_empty]
    s_joined = "\n".join(s_texts)
    first_s_text = s_texts[0]
    last_s_text = s_texts[-1]
    max_span_delta = max(3, int(round(m_len * 0.25)))
    min_w_len = max(2, m_len - max_span_delta)
    max_w_len = m_len + max_span_delta

    top_positions = [pos for pos, (_, txt) in enumerate(f_non_empty) if txt == first_s_text]
    bot_positions = [pos for pos, (_, txt) in enumerate(f_non_empty) if txt == last_s_text]

    candidate_windows: List[Tuple[int, int]] = []
    seen_win = set()
    for t_pos in top_positions:
        for b_pos in bot_positions:
            w_len = b_pos - t_pos + 1
            if min_w_len <= w_len <= max_w_len and (t_pos, b_pos) not in seen_win:
                seen_win.add((t_pos, b_pos))
                candidate_windows.append((t_pos, b_pos))

    if m_len >= 3:
        for t_pos in top_positions:
            if t_pos + 1 < len(f_non_empty) and f_non_empty[t_pos + 1][1] == s_texts[1]:
                b_est = min(len(f_non_empty) - 1, t_pos + m_len - 1)
                if (t_pos, b_est) not in seen_win and (b_est - t_pos + 1) >= min_w_len:
                    seen_win.add((t_pos, b_est))
                    candidate_windows.append((t_pos, b_est))
        for b_pos in bot_positions:
            if b_pos - 1 >= 0 and f_non_empty[b_pos - 1][1] == s_texts[-2]:
                t_est = max(0, b_pos - m_len + 1)
                if (t_est, b_pos) not in seen_win and (b_pos - t_est + 1) >= min_w_len:
                    seen_win.add((t_est, b_pos))
                    candidate_windows.append((t_est, b_pos))

    if not candidate_windows or len(candidate_windows) > 60:
        return None

    scored_candidates: List[Dict[str, Any]] = []
    for t_pos, b_pos in candidate_windows:
        w_slice = f_non_empty[t_pos : b_pos + 1]
        w_texts = [t for _, t in w_slice]
        w_len = len(w_texts)

        k_top = 0
        while k_top < min(w_len, m_len) and w_texts[k_top] == s_texts[k_top]:
            k_top += 1

        k_bot = 0
        while k_bot < min(w_len - k_top, m_len - k_top) and w_texts[w_len - 1 - k_bot] == s_texts[m_len - 1 - k_bot]:
            k_bot += 1

        both_ends = (k_top >= 1 and k_bot >= 1)
        one_strong_end = (k_top >= 2 or k_bot >= 2)
        if not both_ends and not one_strong_end:
            continue

        matched_boundary_lines = s_texts[:k_top] + (s_texts[m_len - k_bot :] if k_bot > 0 else [])
        if not any(_is_nontrivial_anchor_line(l) for l in matched_boundary_lines):
            continue

        boundary_score = min(
            1.0,
            (0.35 if both_ends else 0.15)
            + 0.15 * min(k_top, 3)
            + 0.15 * min(k_bot, 3),
        )
        line_ratio = difflib.SequenceMatcher(None, s_texts, w_texts).ratio()
        char_ratio = difflib.SequenceMatcher(None, s_joined, "\n".join(w_texts)).ratio()
        interior_score = 0.5 * line_ratio + 0.5 * char_ratio
        composite_score = 0.45 * boundary_score + 0.55 * interior_score

        if char_ratio < 0.85:
            continue
        if both_ends and composite_score < 0.90:
            continue
        if not both_ends and (composite_score < 0.93 or char_ratio < 0.92):
            continue

        start_f_idx = w_slice[0][0]
        end_f_idx = w_slice[-1][0]
        scored_candidates.append({
            "match_idx": start_f_idx,
            "actual_span": (end_f_idx - start_f_idx) + 1,
            "matched_baseline_f_idx": start_f_idx,
            "matched_last_content_f_idx": end_f_idx,
            "baseline_s_idx": s_non_empty[0][0],
            "last_content_s_idx": s_non_empty[-1][0],
            "unmatched_first_prefix": "",
            "unmatched_last_suffix": "",
            "tier": 2,
            "sandwich_score": round(composite_score, 4),
            "k_top": k_top,
            "k_bot": k_bot,
        })

    if not scored_candidates:
        return None

    scored_candidates.sort(key=lambda c: (c["sandwich_score"], c["k_top"] + c["k_bot"]), reverse=True)
    best = scored_candidates[0]
    best_start = best["match_idx"]
    best_end = best_start + best["actual_span"]

    for other in scored_candidates[1:]:
        o_start = other["match_idx"]
        o_end = o_start + other["actual_span"]
        overlaps = not (o_end <= best_start or o_start >= best_end)
        if not overlaps and (best["sandwich_score"] - other["sandwich_score"]) < 0.15:
            return None

    return best


def rebase_overlapping_block(
    original_content: Optional[str],
    current_content: str,
    block: Dict[str, Any],
    *,
    apply_block_fn: Callable[..., Tuple[bool, str, str]],
    normalize_payload_fn: Callable[..., str],
    find_anchors_fn: Callable[..., List[Dict[str, Any]]],
    silent: bool = True,
) -> Tuple[bool, str, str]:
    """
    Tier 2 Deterministic Overlap Rebaser:
    1. Context-Edge Shrinking: Trims unchanged top/bottom sandwich padding lines (search == replace)
       if the core mutated hunk + surviving context still anchors uniquely in `current_content`.
    2. In-Memory 3-Way Rebase (O -> A vs. O -> B): Applies the block to `original_content` (O) to produce (B),
       and runs `three_way_merge_text(O, A, B)`.
    """
    if not original_content or original_content == current_content:
        return False, current_content, "error"

    orig_norm = original_content.replace("\r\n", "\n").replace("\xa0", " ")
    curr_norm = current_content.replace("\r\n", "\n").replace("\xa0", " ")

    ok_orig, target_b_content, orig_status = apply_block_fn(orig_norm, dict(block), silent=True)
    if not ok_orig or orig_status in ("genesis", "error") or str(orig_status).startswith("ambiguous:"):
        return False, current_content, "error"
    if orig_status in ("no_op", "idempotent"):
        return True, current_content, orig_status

    search_str = normalize_payload_fn(block.get("search", ""), reference_content=orig_norm)
    replace_str = normalize_payload_fn(block.get("replace", ""), reference_content=orig_norm)
    s_lines = search_str.split("\n")
    r_lines = replace_str.split("\n")

    prefix_len = 0
    while (
        prefix_len < len(s_lines)
        and prefix_len < len(r_lines)
        and s_lines[prefix_len].strip() == r_lines[prefix_len].strip()
    ):
        prefix_len += 1

    suffix_len = 0
    while (
        suffix_len < (len(s_lines) - prefix_len)
        and suffix_len < (len(r_lines) - prefix_len)
        and s_lines[len(s_lines) - 1 - suffix_len].strip() == r_lines[len(r_lines) - 1 - suffix_len].strip()
    ):
        suffix_len += 1

    if prefix_len > 0 or suffix_len > 0:
        curr_lines = curr_norm.split("\n")
        for trim_top in range(0, prefix_len + 1):
            for trim_bot in range(0, suffix_len + 1):
                if trim_top == 0 and trim_bot == 0:
                    continue
                s_end = len(s_lines) - trim_bot if trim_bot > 0 else len(s_lines)
                r_end = len(r_lines) - trim_bot if trim_bot > 0 else len(r_lines)
                shrunk_s = s_lines[trim_top:s_end]
                shrunk_r = r_lines[trim_top:r_end]
                non_empty_s = [l for l in shrunk_s if l.strip()]
                if len(non_empty_s) < 2 and sum(len(l.strip()) for l in non_empty_s) < 18:
                    continue
                matches = find_anchors_fn(curr_lines, shrunk_s, allow_boundary_partial=False)
                if len(matches) == 1:
                    shrunk_block = {
                        **block,
                        "search": "\n".join(shrunk_s),
                        "replace": "\n".join(shrunk_r),
                        "_pre_normalized": True,
                    }
                    ok_shrunk, shrunk_out, shrunk_stat = apply_block_fn(curr_norm, shrunk_block, silent=True)
                    if ok_shrunk and shrunk_stat == "success":
                        if not silent:
                            print("  └─ 🛡️  Overlap Rebase: Trimmed overlapped sandwich padding and anchored cleanly.")
                        return True, shrunk_out, "overlap_rebased"

    merge_res = three_way_merge_text(orig_norm, curr_norm, target_b_content)
    if isinstance(merge_res, tuple):
        merged_ok, merged_text = merge_res
    elif isinstance(merge_res, dict):
        merged_ok = bool(merge_res.get("clean"))
        merged_text = str(merge_res.get("merged") or "")
    else:
        merged_ok, merged_text = False, ""
    if merged_ok and merged_text != curr_norm:
        if not silent:
            print("  └─ 🛡️  Overlap Rebase: Merged concurrent patch hunks via 3-way buffer rebase.")
        return True, merged_text, "overlap_rebased"

    return False, current_content, "overlapping_conflict"
