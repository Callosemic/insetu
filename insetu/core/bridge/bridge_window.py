"""Stripped-line SequenceMatcher and declaration/symbol window locator for failed Yomama Bridge anchors."""
import difflib
import re
from typing import Any, Dict, List, Optional, Tuple

_DECL_ANCHOR_RE = re.compile(
    r'^(?:async\s+def|def|class|function|export\s+(?:async\s+)?(?:function|class|const))\s+([A-Za-z_][A-Za-z0-9_]*)'
)


def has_distinctive_anchor_line(content: str, search_str: str) -> bool:
    """
    Fast pre-check before running multi-tier apply_block_in_memory on fuzzy candidate files:
    Returns True if `search_str` is empty (genesis) or if at least one non-trivial stripped line
    from `search_str` appears in `content`.
    """
    if not search_str or not search_str.strip():
        return True
    if not content:
        return False
    s_lines = [l.strip() for l in search_str.splitlines() if l.strip() and l.strip().upper() != "{{UNTIL}}"]
    if not s_lines:
        return True
    distinctive = [l for l in s_lines if len(l) >= 6] or s_lines
    return any(l in content for l in distinctive)


def locate_closest_window(
    file_lines: List[str],
    search_lines: List[str],
    replace_lines: Optional[List[str]] = None,
    symbol_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Single Source of Truth window locator for failed SEARCH blocks:
    1. Matches stripped lines via SequenceMatcher (plus contiguous head/tail probes) so indentation
       differences (e.g. 8 spaces vs 4 spaces on >400-line files) never blind the locator.
    2. Falls back to declaration/symbol matching (`def <name>`, `class <name>`, `symbol_hint`, or
       distinctive lines >= 16 chars) when multi-line edits break contiguous runs.
    Returns {start_idx, end_idx, actual_lines, similarity_ratio, has_meaningful_line, candidate_spans}.
    """
    total_lines = len(file_lines)
    if total_lines == 0:
        return {
            "start_idx": 0,
            "end_idx": 0,
            "actual_lines": [],
            "similarity_ratio": 0.0,
            "has_meaningful_line": False,
            "candidate_spans": [],
        }

    stripped_file = [l.strip() for l in file_lines]
    stripped_search = [l.strip() for l in search_lines]
    search_len = max(1, len(search_lines))

    matcher = difflib.SequenceMatcher(None, stripped_file, stripped_search)
    match = matcher.find_longest_match(0, total_lines, 0, len(stripped_search))
    has_meaningful_line = any(
        len(stripped_search[match.b + k]) > 3 for k in range(match.size)
    )

    candidate_spans: List[Tuple[int, int]] = []
    if has_meaningful_line:
        start_idx = max(0, match.a - match.b)
        end_idx = min(total_lines, start_idx + search_len)
        candidate_spans.append((start_idx, end_idx))
    else:
        start_idx = 0
        end_idx = min(total_lines, search_len)

    # Probe contiguous head and tail slices (preserving blank lines so SequenceMatcher aligns across blank lines)
    probe_len = min(5, len(stripped_search))
    if probe_len > 0:
        head_probe = stripped_search[:probe_len]
        tail_offset = max(0, len(stripped_search) - probe_len)
        tail_probe = stripped_search[tail_offset:]
        for orig_offset, probe_lines in ((0, head_probe), (tail_offset, tail_probe)):
            if not any(len(l) > 3 for l in probe_lines):
                continue
            p_match = difflib.SequenceMatcher(None, stripped_file, probe_lines).find_longest_match(
                0, total_lines, 0, len(probe_lines)
            )
            if p_match.size > 0 and any(len(probe_lines[p_match.b + k]) > 3 for k in range(p_match.size)):
                p_start = max(0, p_match.a - (orig_offset + p_match.b))
                p_end = min(total_lines, p_start + search_len)
                candidate_spans.append((p_start, p_end))
                if not has_meaningful_line:
                    start_idx, end_idx = p_start, p_end
                    has_meaningful_line = True

    needles: List[str] = []
    for raw_l in list(search_lines) + list(replace_lines or []):
        clean_l = raw_l.strip()
        m_decl = _DECL_ANCHOR_RE.match(clean_l)
        if m_decl:
            needles.append(m_decl.group(1))
    if symbol_hint:
        needles.append(str(symbol_hint))
    for clean_l in stripped_search:
        if len(clean_l) >= 16 and clean_l.upper() != "{{UNTIL}}":
            needles.append(clean_l)

    seen_needles = set()
    for needle in needles:
        if not needle or needle in seen_needles:
            continue
        seen_needles.add(needle)
        for idx_line, fl in enumerate(file_lines):
            if needle in fl:
                n_start = max(0, idx_line - 2)
                n_end = min(total_lines, n_start + search_len + 4)
                candidate_spans.append((n_start, n_end))
                if not has_meaningful_line:
                    start_idx = max(0, idx_line)
                    end_idx = min(total_lines, start_idx + search_len)
                    has_meaningful_line = True

    actual_lines = file_lines[start_idx:end_idx]
    norm_s_text = "\n".join(l for l in stripped_search if l)
    norm_a_text = "\n".join(l.strip() for l in actual_lines if l.strip())
    sim_ratio = (
        difflib.SequenceMatcher(None, norm_s_text, norm_a_text).ratio()
        if (norm_s_text and norm_a_text and has_meaningful_line)
        else 0.0
    )

    return {
        "start_idx": start_idx,
        "end_idx": end_idx,
        "actual_lines": actual_lines,
        "similarity_ratio": sim_ratio,
        "has_meaningful_line": has_meaningful_line,
        "candidate_spans": candidate_spans,
    }


def extract_windowed_buffer_context(
    filepath: str,
    buffer_text: str,
    failed_blocks: List[Dict[str, Any]],
    window_radius: int = 60,
    full_file_threshold_lines: int = 400,
    extra_focus_lines: Optional[List[int]] = None,
) -> str:
    """
    Extracts high-signal windowed slices from `buffer_text` for the AI patch healer:
    - Always includes the top module header (`Lines 1..40`) on large files so imports/globals are visible.
    - Delegates window discovery to `locate_closest_window` so indentation mismatches on >400-line files
      always locate the target function.
    """
    file_lines = buffer_text.splitlines()
    total_lines = len(file_lines)
    if total_lines <= full_file_threshold_lines:
        return f"=== FILE STATE AFTER APPLYING VALID PATCHES: {filepath} (Lines 1-{total_lines}) ===\n{buffer_text}"

    spans: List[Tuple[int, int]] = [(0, min(total_lines, 40))]
    for focus_ln in (extra_focus_lines or []):
        if isinstance(focus_ln, int) and focus_ln > 0:
            idx0 = max(0, min(total_lines - 1, focus_ln - 1))
            spans.append((max(0, idx0 - 25), min(total_lines, idx0 + 25)))

    for fb in failed_blocks:
        s_lines = (fb.get("search") or "").splitlines()
        r_lines = (fb.get("replace") or "").splitlines()
        if not any(l.strip() for l in s_lines):
            spans.append((0, min(total_lines, window_radius * 2)))
            continue
        win = locate_closest_window(
            file_lines,
            s_lines,
            replace_lines=r_lines,
            symbol_hint=fb.get("symbol") or fb.get("target_symbol"),
        )
        for c_start, c_end in (win.get("candidate_spans") or [(win["start_idx"], win["end_idx"])]):
            spans.append((max(0, c_start - window_radius), min(total_lines, c_end + window_radius)))

    spans.sort(key=lambda x: x[0])
    merged_spans: List[Tuple[int, int]] = []
    for s_start, s_end in spans:
        if merged_spans and s_start <= merged_spans[-1][1] + 10:
            merged_spans[-1] = (merged_spans[-1][0], max(merged_spans[-1][1], s_end))
        else:
            merged_spans.append((s_start, s_end))

    window_strs = [f"=== FILE STATE AFTER APPLYING VALID PATCHES: {filepath} (Windowed Excerpts of {total_lines} lines) ==="]
    for w_start, w_end in merged_spans:
        excerpt = "\n".join(file_lines[w_start:w_end])
        window_strs.append(f"--- Lines {w_start + 1}..{w_end} of {filepath} ---\n{excerpt}")
    return "\n\n".join(window_strs)
