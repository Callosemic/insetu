import re
import json
import difflib
import base64
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from insetu.core.utils_core import (
    _get_base_step_and_diffs,
    load_yaml_string,
    dump_yaml_string,
    parse_frontmatter,
    update_frontmatter,
)
# ==============================================================================
# CHATBOT & LLM TRANSPORT ARTIFACT HEALERS
# ==============================================================================

def heal_chevron_meltdown(text):
    """Trims conversational garbage or broken markdown fences trailing the final REPLACE block."""
    match = list(re.finditer(r'>>>>>>> REPLACE', text))
    if match:
        last_idx = match[-1].end()
        trailing = text[last_idx:]
        if not re.search(r'[a-zA-Z0-9]', trailing.replace('```', '')):
            return text[:last_idx]
    return text


# Backward-compatible alias
clean_chevron_meltdown = heal_chevron_meltdown


def heal_latex_vert(text):
    """Replaces Gemini LaTeX math-mode pipe escapes (\\vert{}) back into '|' strictly when bounded by $ ... $."""
    if "\\vert" not in text or text.count("$") < 2:
        return text
    first_dollar = text.find("$")
    last_dollar = text.rfind("$")
    if first_dollar >= last_dollar:
        return text
    middle = text[first_dollar + 1:last_dollar].replace("\\vert{}", "|").replace("\\vert", "|")
    return text[:first_dollar + 1] + middle + text[last_dollar:]


def heal_citation_artifacts(text):
    """Strips leaked LLM citation markers (,, [cite_start], [cite_end])."""
    if "[" not in text:
        return text
    text = re.sub(r'\+\]', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\[cite:\s*[\d\s,]+\]', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\[cite_(?:start|end)\]', '', text, flags=re.IGNORECASE)
    return text


def heal_llm_block_artifacts(text, reference_content=""):
    """
    Unified chatbot artifact healing pipeline for SEARCH and REPLACE blocks.
    Normalizes non-breaking spaces, heals $ ... \\vert{} ... $ escapes, and strips
    leaked citation tags unless those tokens legitimately exist in reference_content.
    """
    if not text:
        return text
    healed = text.replace('\r\n', '\n').replace('\xa0', ' ')
    if "\\vert" in healed and "\\vert" not in (reference_content or ""):
        healed = heal_latex_vert(healed)
    if ("[cite" in healed or "[source:" in healed) and "[cite" not in (reference_content or ""):
        healed = heal_citation_artifacts(healed)
    return healed
def expand_macros(text, reference_content=""):
    """Expands intentional Yomama transport escape macros unless the raw token exists in reference_content."""
    ref = reference_content or ""
    text = re.sub(
        r'\{\{\s*ymm:(.)[x*](\d+)\s*\}\}',
        lambda m: m.group(0) if (ref and m.group(0) in ref) else m.group(1) * int(m.group(2)),
        text,
    )
    text = re.sub(
        r'\{\{\s*(.)\s*\*\s*(\d+)\s*\}\}',
        lambda m: m.group(0) if (ref and m.group(0) in ref) else m.group(1) * int(m.group(2)),
        text,
    )
    text = re.sub(
        r'\{\{\s*triple(.)\s*\}\}',
        lambda m: m.group(0) if (ref and m.group(0) in ref) else m.group(1) * 3,
        text,
    )
    return text

def is_effectively_identical(lines_a, lines_b):
    """
    Externalized comparison logic used to skip no-op SEARCH/REPLACE pairs.
    Pass 1: Compare line by line with surrounding whitespace stripped. Blank lines are significant,
            so a REPLACE that only adds or removes blank lines is a real change, not a no-op.
    Pass 2: If stripped lines match, compare relative indentation of non-blank lines.
    Returns True only if both text and relative indentation structure are completely identical.
    """
    a_lines = [l for l in lines_a if l.strip().upper() != '{{UNTIL}}']
    b_lines = [l for l in lines_b if l.strip().upper() != '{{UNTIL}}']

    if len(a_lines) != len(b_lines):
        return False

    # Pass 1: Stripped comparison (blank lines must line up too)
    for a, b in zip(a_lines, b_lines):
        if a.strip() != b.strip():
            return False

    a_clean = [l for l in a_lines if l.strip()]
    b_clean = [l for l in b_lines if l.strip()]
    # Pass 2: Relative Indentation check
    a_base = len(a_clean[0]) - len(a_clean[0].lstrip()) if a_clean else 0
    b_base = len(b_clean[0]) - len(b_clean[0].lstrip()) if b_clean else 0

    for a, b in zip(a_clean, b_clean):
        a_rel = (len(a) - len(a.lstrip())) - a_base
        b_rel = (len(b) - len(b.lstrip())) - b_base
        if a_rel != b_rel:
            return False

    return True
def find_all_block_anchors(file_lines: List[str], block_lines: List[str], allow_boundary_partial: bool = False) -> List[Dict[str, Any]]:
        """
        Two-Tier Contiguous Block Anchor Scanner:
        - Tier 0 (Strict Full-Line Scan): Requires every non-empty line in block_lines to match
            file_lines via exact stripped equality (or adjacent soft-wrap line stitching).
        - Tier 1 (Boundary Prefix/Suffix Fallback, only if Tier 0 finds 0 hits and allow_boundary_partial=True):
            Allows the first line to match a line suffix (len >= 6) or the last line to match a line prefix (len >= 6),
            recording exact unmatched_first_prefix and unmatched_last_suffix strings so callers never slice lines in half.
        Returns all non-overlapping matches in the winning tier so callers can detect ambiguous anchors.
        """
        non_empty_indices = [idx for idx, l in enumerate(block_lines) if l.strip() and l.strip().upper() != "{{UNTIL}}"]
        if not non_empty_indices:
                return []
        baseline_s_idx = non_empty_indices[0]
        last_content_s_idx = non_empty_indices[-1]
        has_until_macro = any(l.strip().upper() == "{{UNTIL}}" for l in block_lines)

        def _scan_tier(permit_partial_bounds: bool) -> List[Dict[str, Any]]:
                matches: List[Dict[str, Any]] = []
                i = 0
                while i < len(file_lines):
                        match_meta = {
                                "last_content_f_idx": -1,
                                "unmatched_first_prefix": "",
                                "unmatched_last_suffix": "",
                        }

                        def match_from(f_idx: int, s_idx: int) -> Tuple[bool, int, int]:
                                local_baseline_f_idx = -1
                                while s_idx < len(block_lines):
                                        if block_lines[s_idx].strip().upper() == "{{UNTIL}}":
                                                s_idx += 1
                                                if s_idx >= len(block_lines):
                                                        return True, len(file_lines) - i, local_baseline_f_idx
                                                while f_idx < len(file_lines):
                                                        ok, span, b_f_idx = match_from(f_idx, s_idx)
                                                        if ok:
                                                                return True, span, (local_baseline_f_idx if local_baseline_f_idx != -1 else b_f_idx)
                                                        f_idx += 1
                                                return False, 0, -1
                                        else:
                                                if f_idx >= len(file_lines):
                                                        return False, 0, -1
                                                f_stripped = file_lines[f_idx].strip()
                                                s_stripped = block_lines[s_idx].strip()

                                                if not s_stripped and f_stripped:
                                                        s_idx += 1
                                                        continue
                                                if not f_stripped and s_stripped:
                                                        f_idx += 1
                                                        continue

                                                if s_idx == last_content_s_idx:
                                                        match_meta["last_content_f_idx"] = f_idx

                                                if f_stripped == s_stripped:
                                                        pass
                                                elif (
                                                        permit_partial_bounds
                                                        and s_idx == baseline_s_idx
                                                        and len(s_stripped) >= 6
                                                        and f_stripped.endswith(s_stripped)
                                                ):
                                                        prefix_len = len(f_stripped) - len(s_stripped)
                                                        match_meta["unmatched_first_prefix"] = f_stripped[:prefix_len]
                                                elif (
                                                        permit_partial_bounds
                                                        and s_idx == last_content_s_idx
                                                        and len(s_stripped) >= 6
                                                        and f_stripped.startswith(s_stripped)
                                                ):
                                                        match_meta["unmatched_last_suffix"] = f_stripped[len(s_stripped):]
                                                else:
                                                        next_f = file_lines[f_idx + 1].strip() if f_idx + 1 < len(file_lines) else None
                                                        next_s = block_lines[s_idx + 1].strip() if s_idx + 1 < len(block_lines) else None

                                                        def stitch_match(f1, f2, s1, s2):
                                                                f_opts = [f1 + " " + f2, f1 + f2] if f2 is not None else [f1]
                                                                s_opts = [s1 + " " + s2, s1 + s2] if s2 is not None else [s1]
                                                                return any(f == s for f in f_opts for s in s_opts)

                                                        if next_f is not None and stitch_match(f_stripped, next_f, s_stripped, None):
                                                                f_idx += 1
                                                        elif next_s is not None and stitch_match(f_stripped, None, s_stripped, next_s):
                                                                s_idx += 1
                                                        elif next_f is not None and next_s is not None and stitch_match(f_stripped, next_f, s_stripped, next_s):
                                                                f_idx += 1
                                                                s_idx += 1
                                                        else:
                                                                return False, 0, -1

                                                if s_idx == baseline_s_idx:
                                                        local_baseline_f_idx = f_idx
                                                f_idx += 1
                                                s_idx += 1
                                return True, f_idx - i, local_baseline_f_idx

                        ok, span, b_f_idx = match_from(i, 0)
                        if ok and b_f_idx != -1:
                                # Blank file lines are skipped softly while matching, so a scan starting on a
                                # blank line just above the target also succeeds and would swallow that line.
                                # Pin the start: consume at most as many leading blank lines as the SEARCH has.
                                pinned_idx = max(i, b_f_idx - baseline_s_idx)
                                span -= pinned_idx - i
                                if not matches or matches[-1]["matched_baseline_f_idx"] != b_f_idx:
                                        matches.append({
                                                "match_idx": pinned_idx,
                                                "actual_span": span,
                                                "matched_baseline_f_idx": b_f_idx,
                                                "matched_last_content_f_idx": match_meta["last_content_f_idx"],
                                                "baseline_s_idx": baseline_s_idx,
                                                "last_content_s_idx": last_content_s_idx,
                                                "unmatched_first_prefix": match_meta["unmatched_first_prefix"],
                                                "unmatched_last_suffix": match_meta["unmatched_last_suffix"],
                                                "tier": 1 if permit_partial_bounds else 0,
                                        })
                                if has_until_macro:
                                        break
                                i = max(i + 1, b_f_idx + 1)
                                continue
                        i += 1
                return matches

        strict_matches = _scan_tier(False)
        if strict_matches or not allow_boundary_partial:
                return strict_matches
        return _scan_tier(True)


def find_block_anchor(file_lines, block_lines, allow_boundary_partial: bool = False):
        """
        Backward-compatible single-anchor wrapper around find_all_block_anchors.
        Returns the single match dict when unambiguous, or None if 0 matches exist.
        Attaches 'ambiguous_matches' metadata if multiple locations matched.
        """
        matches = find_all_block_anchors(file_lines, block_lines, allow_boundary_partial=allow_boundary_partial)
        if not matches:
                return None
        primary = dict(matches[0])
        if len(matches) > 1:
                primary["ambiguous_matches"] = [m["matched_baseline_f_idx"] + 1 for m in matches]
        return primary
def normalize_patch_payload(text: str, reference_content: str = "") -> str:
    """
    Single Source of Truth normalizer for Yomama SEARCH, REPLACE, TEXTEDIT, and JSON_PATCH payloads.
    Expands transport escape macros and heals LLM artifacts unless those tokens literally exist in reference_content.
    """
    if not text:
        return ""
    expanded = expand_macros(text, reference_content=reference_content)
    return heal_llm_block_artifacts(expanded, reference_content=reference_content)


def apply_block_in_memory(content, block, silent=False):
    content = content.replace('\r\n', '\n').replace('\xa0', ' ')
    file_lines = content.split('\n')
    if block.get("_pre_normalized"):
        raw_search = (block.get("search") or "").replace('\r\n', '\n').replace('\xa0', ' ')
        raw_replace = (block.get("replace") or "").replace('\r\n', '\n').replace('\xa0', ' ')
        search_str = raw_search
        replace_str = raw_replace
    else:
        raw_search = expand_macros(block["search"], reference_content=content).replace('\xa0', ' ')
        raw_replace = expand_macros(block["replace"], reference_content=content).replace('\xa0', ' ')
        search_str = raw_search
        replace_str = heal_llm_block_artifacts(raw_replace, reference_content=content)
    if replace_str != raw_replace:
        block["replace"] = replace_str
        if not silent:
            print("  └─ 🛡️  Artifact Heal: Auto-repaired chatbot artifacts in REPLACE block.")
    if not search_str.strip():
        if replace_str and not replace_str.endswith("\n"):
            replace_str += "\n"
        return True, replace_str, "genesis"

    search_lines = search_str.split('\n')
    replace_lines = replace_str.split('\n')

    # Scaffolding: Skip No-Ops (INS-TODO-20260708_0940)
    if is_effectively_identical(search_lines, replace_lines):
        if not silent: print("  └─ [ℹ️] No-Op: SEARCH and REPLACE blocks are identical. Skipping chunk.")
        return True, content, "no_op"
    for r_line in replace_lines:
        if r_line.strip().upper() == "{{UNTIL}}":
            if not silent: print(f"  └─ 🚨 TRANSACTION ERROR: LLM hallucinated {{{{UNTIL}}}} in the REPLACE block. Aborting chunk.")
            return False, content, "error"
    # Abstracted Two-Tier Anchor Search on SEARCH Block (Tier 0 strict -> Artifact Heal -> Tier 1 boundary partial)
    search_match = find_block_anchor(file_lines, search_lines, allow_boundary_partial=False)
    if not search_match:
        healed_search_str = heal_llm_block_artifacts(search_str, reference_content=content)
        if healed_search_str != search_str:
            healed_search_lines = healed_search_str.split('\n')
            healed_match = find_block_anchor(file_lines, healed_search_lines, allow_boundary_partial=False)
            if healed_match:
                search_match = healed_match
                search_str = healed_search_str
                search_lines = healed_search_lines
                block["search"] = search_str
                if not silent:
                    print("  └─ 🛡️  Artifact Heal: Auto-repaired chatbot artifacts in SEARCH block.")
    if not search_match:
        search_match = find_block_anchor(file_lines, search_lines, allow_boundary_partial=True)

    if search_match and search_match.get("ambiguous_matches"):
        amb_lines = ", ".join(str(ln) for ln in search_match["ambiguous_matches"][:5])
        if not silent:
            print(f"  └─ 🚨 AMBIGUOUS ANCHOR: SEARCH block matched {len(search_match['ambiguous_matches'])} locations (lines {amb_lines}).")
        return False, content, f"ambiguous:{amb_lines}"

    if not search_match:
        # Check if REPLACE block matches 100% contiguously in file (Idempotency Check)
        if replace_lines and any(l.strip() for l in replace_lines if l.strip().upper() != '{{UNTIL}}'):
            search_str_clean = "\n".join([l.strip() for l in search_lines if l.strip()])
            replace_str_clean = "\n".join([l.strip() for l in replace_lines if l.strip()])

            # Guardrail: If the REPLACE block is just a strict subset of the SEARCH block (e.g., a pure deletion where only the surrounding context remains), 
            # finding it in the file doesn't guarantee the deletion occurred, as that context might just exist natively.
            is_subset_deletion = replace_str_clean and (replace_str_clean in search_str_clean)

            if not is_subset_deletion:
                replace_match = find_block_anchor(file_lines, replace_lines)
                if replace_match:
                    if not silent: print("  └─ [ℹ️] Idempotency: Target file 100% matches REPLACE block. Skipping chunk.")
                    return True, content, "idempotent"
        # Fallback: Regex extraction for edge-case grid desyncs
        if "{{UNTIL}}" in search_str:
            try:
                top, bottom = search_str.split("{{UNTIL}}", 1)
                t_pat = r'\s*'.join(re.escape(line.strip()) for line in top.strip().split('\n') if line.strip())
                b_pat = r'\s*'.join(re.escape(line.strip()) for line in bottom.strip().split('\n') if line.strip())
                match = re.search(t_pat + r'[\s\S]*?' + b_pat, content)
                if match:
                    start_idx = match.start()
                    # Backtrack to the start of the line to prevent double-indentation
                    while start_idx > 0 and content[start_idx - 1] in ' \t':
                        start_idx -= 1
                    if not silent: print("  └─ ⚠️  Grid desync detected. Rescued chunk via Regex Fallback.")
                    return True, content[:start_idx] + replace_str.lstrip('\n') + content[match.end():], "success"
            except Exception:
                pass
        if not silent:
            # Heuristic Error Analysis: Find the closest matching window via optimized SequenceMatcher
            matcher = difflib.SequenceMatcher(None, file_lines, search_lines)
            match = matcher.find_longest_match(0, len(file_lines), 0, len(search_lines))

            # Align the comparison window by offsetting the match starting points
            start_idx = max(0, match.a - match.b)
            end_idx = min(len(file_lines), start_idx + len(search_lines))
            actual_lines = file_lines[start_idx:end_idx]
            # Use ndiff to show exact character-level discrepancies (indicated by ? and ^)
            diff = list(difflib.ndiff(search_lines, actual_lines))
            diff_str = "\n".join(diff)

            err_b64 = base64.b64encode(diff_str.encode('utf-8')).decode('utf-8')
            print("  └─ 🔍 DIFF ANALYSIS: The closest block on disk differed from your SEARCH block.")
            print(f"  [ACTION_REQUIRED: COPY_ERROR | {err_b64} ]")

        return False, content, "error"

    match_idx = search_match["match_idx"]
    actual_span = search_match["actual_span"]
    matched_baseline_f_idx = search_match["matched_baseline_f_idx"]
    matched_last_content_f_idx = search_match["matched_last_content_f_idx"]
    baseline_s_idx = search_match["baseline_s_idx"]
    last_content_s_idx = search_match["last_content_s_idx"]

    # --- ATOMIC S/R HEALER (Duplication Prevention) ---
    # Look ahead in the file to see if the REPLACE block contains trailing context
    # that already exists in the file. If so, absorb it into the SEARCH block 
    # to make the transaction deterministic and atomic.
    tail_f_idx = match_idx + actual_span
    r_non_empty = [l.strip() for l in replace_lines if l.strip() and l.strip().upper() != '{{UNTIL}}']
    f_tail_non_empty = [l.strip() for l in file_lines[tail_f_idx:] if l.strip()]

    best_overlap = 0
    max_check = min(15, len(r_non_empty), len(f_tail_non_empty))

    for i in range(1, max_check + 1):
        if r_non_empty[-i:] == f_tail_non_empty[:i]:
            s_non_empty = [l.strip() for l in search_lines if l.strip() and l.strip().upper() != '{{UNTIL}}']
            if r_non_empty[-i:] != s_non_empty[-i:]:
                best_overlap = i

    if best_overlap > 0:
        matched_f = 0
        f_absorb_idx = tail_f_idx
        while matched_f < best_overlap and f_absorb_idx < len(file_lines):
            if file_lines[f_absorb_idx].strip():
                matched_f += 1
            f_absorb_idx += 1

        search_lines.extend(file_lines[tail_f_idx:f_absorb_idx])
        actual_span += (f_absorb_idx - tail_f_idx)
        block["search"] = "\n".join(search_lines)
        if not silent: 
            print(f"  └─ 🛡️  Atomic Heal: Expanded SEARCH block to absorb {best_overlap} hallucinated trailing lines.")

    llm_base_indent = len(search_lines[baseline_s_idx]) - len(search_lines[baseline_s_idx].lstrip()) if baseline_s_idx != -1 else 0
    actual_base_indent = len(file_lines[matched_baseline_f_idx]) - len(file_lines[matched_baseline_f_idx].lstrip()) if matched_baseline_f_idx != -1 else 0
    # 1. Calculate File Step (Source of Truth)
    file_step, _ = _get_base_step_and_diffs(file_lines)

    # 2. Evaluate LLM Step against File Step
    all_llm_lines = search_lines + replace_lines
    llm_raw_step, llm_diffs = _get_base_step_and_diffs(all_llm_lines)

    if llm_diffs and all(d % file_step == 0 for d in llm_diffs):
        # If all LLM indentation jumps are perfect multiples of the file's step size, it's correctly aligned
        llm_step = file_step
    else:
        # If not, assume the LLM hallucinated a different base ratio. Fall back to its raw step.
        llm_step = llm_raw_step if llm_diffs else file_step
    unmatched_first_prefix = search_match.get("unmatched_first_prefix") or ""
    unmatched_last_suffix = search_match.get("unmatched_last_suffix") or ""
    if unmatched_first_prefix and replace_lines:
        first_r_idx = next((idx for idx, l in enumerate(replace_lines) if l.strip()), -1)
        if first_r_idx != -1 and not replace_lines[first_r_idx].strip().startswith(unmatched_first_prefix.strip()):
            r_lead_ws = replace_lines[first_r_idx][:len(replace_lines[first_r_idx]) - len(replace_lines[first_r_idx].lstrip())]
            replace_lines[first_r_idx] = r_lead_ws + unmatched_first_prefix + replace_lines[first_r_idx].lstrip()
    if unmatched_last_suffix and replace_lines:
        last_r_idx = next((idx for idx in range(len(replace_lines) - 1, -1, -1) if replace_lines[idx].strip()), -1)
        if last_r_idx != -1 and not replace_lines[last_r_idx].rstrip().endswith(unmatched_last_suffix.rstrip()):
            replace_lines[last_r_idx] = replace_lines[last_r_idx].rstrip() + unmatched_last_suffix
    new_replace_lines = []
    for r_line in replace_lines:
        if not r_line.strip():
            new_replace_lines.append("")
            continue

        r_indent = len(r_line) - len(r_line.lstrip())
        # Absolute root-escape: if LLM provides 0 spaces, force it to the module root
        if r_indent == 0 and llm_base_indent > 0:
            target_indent = 0
        else:
            # THE HYBRID ACCORDION:
            # Re-enable the ratio math to translate LLM 4-space hallucinations into 2-space files.
            # Add a strict circuit breaker: if the file's step size is chaotic (> 8 spaces),
            # or the LLM step is 0, fall back to the safe 1:1 absolute shift to prevent math explosions.
            if file_step > 8 or llm_step <= 0:
                indent_delta = actual_base_indent - llm_base_indent
                target_indent = max(0, r_indent + indent_delta)
            else:
                nesting_levels = (r_indent - llm_base_indent) / llm_step
                # Snap to the discrete grid: round the tier FIRST, then multiply by the physical step
                target_indent = max(0, actual_base_indent + (int(round(nesting_levels)) * file_step))
        new_replace_lines.append((" " * target_indent) + r_line.lstrip())

    final_content = "\n".join(file_lines[:match_idx] + new_replace_lines + file_lines[match_idx + actual_span:])
    if final_content == content:
        if not silent: print("  └─ [ℹ️] Idempotency: Patch resulted in no changes to the file. Skipping chunk.")
        return True, content, "idempotent"
    return True, final_content, "success"


def _find_soft_wrap_span(content: str, needle: str) -> Optional[Tuple[int, int]]:
    """
    Finds `needle` inside `content` where any run of horizontal whitespace or a single
    soft-wrap newline in `needle` matches any run of horizontal whitespace or a single
    newline in `content`.
    """
    if not needle:
        return None
    if needle in content:
        idx = content.find(needle)
        return idx, idx + len(needle)

    tokens = [re.escape(tok) for tok in re.split(r'[ \t]*\r?\n[ \t]*|[ \t]+', needle.strip()) if tok]
    if not tokens:
        return None
    pattern = r'(?:[ \t]*\r?\n[ \t]*|[ \t]+)'.join(tokens)
    m = re.search(pattern, content)
    if m:
        return m.start(), m.end()
    return None
def apply_textedit_in_memory(content: str, block: Dict[str, Any], silent: bool = False) -> Tuple[bool, str, str]:
    """
    Applies a <<<<<<< TEXTEDIT inline prose diff block ({-delete}} / {{+insert}})
    using exact or soft-wrap-normalized character span matching.
    """
    content_norm = (content or "").replace('\r\n', '\n')
    search_str = normalize_patch_payload(block.get("search", ""), reference_content=content_norm)
    replace_str = normalize_patch_payload(block.get("replace", ""), reference_content=content_norm)

    if not search_str.strip():
        return True, replace_str, "genesis"
    if search_str == replace_str:
        return True, content_norm, "no_op"

    span = _find_soft_wrap_span(content_norm, search_str)
    if span:
        s_idx, e_idx = span
        updated = content_norm[:s_idx] + replace_str + content_norm[e_idx:]
        if updated == content_norm:
            return True, content_norm, "idempotent"
        return True, updated, "success"

    # Idempotency check: if replace_str already exists contiguously
    if replace_str.strip() and _find_soft_wrap_span(content_norm, replace_str):
        return True, content_norm, "idempotent"

    # Fallback to line-based apply_block_in_memory (marked _pre_normalized so macros are not expanded twice)
    return apply_block_in_memory(
        content_norm,
        {"search": search_str, "replace": replace_str, "_pre_normalized": True},
        silent=silent,
    )


_PATH_SEG_RE = re.compile(r'^([^\[\]]+)(?:\[([^=\]]+)=([^\]]+)\]|\[(\d+)\])?$')


def _apply_dotted_selector_mutation(root: Any, path_expr: str, value: Any) -> None:
    """
    Mutates `root` in-place using a dotted path with optional array selectors:
    e.g. "nodes[id=generate_patch].tier" or "imports.lit.version".
    Setting value to None deletes the target key (RFC 7396 Merge Patch semantics).
    """
    segments = [s for s in str(path_expr).split(".") if s]
    if not segments:
        return

    cur = root
    for idx, seg in enumerate(segments):
        is_last = (idx == len(segments) - 1)
        m = _PATH_SEG_RE.match(seg)
        if not m:
            if is_last and isinstance(cur, dict):
                if value is None:
                    cur.pop(seg, None)
                else:
                    cur[seg] = value
            return

        key_name, sel_field, sel_val, sel_idx = m.group(1), m.group(2), m.group(3), m.group(4)
        has_selector = (sel_field is not None) or (sel_idx is not None)

        if not has_selector:
            if is_last:
                if isinstance(cur, dict):
                    if value is None:
                        cur.pop(key_name, None)
                    else:
                        if isinstance(value, dict) and isinstance(cur.get(key_name), dict):
                            _deep_merge_rfc7396(cur[key_name], value)
                        else:
                            cur[key_name] = value
                return
            if isinstance(cur, dict):
                if key_name not in cur or not isinstance(cur[key_name], (dict, list)):
                    cur[key_name] = {}
                cur = cur[key_name]
            else:
                return
        else:
            if not isinstance(cur, dict) or not isinstance(cur.get(key_name), list):
                return
            arr = cur[key_name]
            target_elem = None
            target_pos = -1
            if sel_idx is not None:
                pos = int(sel_idx)
                if 0 <= pos < len(arr):
                    target_elem = arr[pos]
                    target_pos = pos
            elif sel_field is not None:
                clean_sel_val = sel_val.strip('\'"')
                for pos, item in enumerate(arr):
                    if isinstance(item, dict) and str(item.get(sel_field)) == clean_sel_val:
                        target_elem = item
                        target_pos = pos
                        break
            if target_pos == -1:
                return
            if is_last:
                if value is None:
                    arr.pop(target_pos)
                elif isinstance(value, dict) and isinstance(target_elem, dict):
                    _deep_merge_rfc7396(target_elem, value)
                else:
                    arr[target_pos] = value
                return
            cur = target_elem


def _deep_merge_rfc7396(target: Dict[str, Any], patch: Dict[str, Any]) -> None:
    for k, v in patch.items():
        if "." in str(k) or "[" in str(k):
            _apply_dotted_selector_mutation(target, str(k), v)
        elif v is None:
            target.pop(k, None)
        elif isinstance(v, dict) and isinstance(target.get(k), dict):
            _deep_merge_rfc7396(target[k], v)
        else:
            target[k] = v


def _resolve_json_pointer_parent(root: Any, pointer: str) -> Tuple[Any, Union[str, int]]:
    parts = [p.replace("~1", "/").replace("~0", "~") for p in pointer.lstrip("/").split("/") if p != ""]
    if not parts:
        raise ValueError("Empty JSON Pointer path.")
    cur = root
    for seg in parts[:-1]:
        if isinstance(cur, list):
            cur = cur[int(seg)]
        elif isinstance(cur, dict):
            if seg not in cur or not isinstance(cur[seg], (dict, list)):
                cur[seg] = {}
            cur = cur[seg]
        else:
            raise ValueError(f"Cannot traverse segment '{seg}' in JSON Pointer '{pointer}'.")
    last = parts[-1]
    if isinstance(cur, list):
        return cur, (len(cur) if last == "-" else int(last))
    return cur, last


def _apply_rfc6902_ops(root: Any, ops: List[Dict[str, Any]]) -> None:
    for op_item in ops:
        if not isinstance(op_item, dict):
            continue
        op = str(op_item.get("op") or "").lower()
        path = str(op_item.get("path") or "")
        if not op or not path:
            continue
        parent, key = _resolve_json_pointer_parent(root, path)
        if op == "add":
            val = op_item.get("value")
            if isinstance(parent, list):
                if key >= len(parent):
                    parent.append(val)
                else:
                    parent.insert(int(key), val)
            elif isinstance(parent, dict):
                parent[str(key)] = val
        elif op == "replace":
            val = op_item.get("value")
            if isinstance(parent, list):
                parent[int(key)] = val
            elif isinstance(parent, dict):
                parent[str(key)] = val
        elif op == "remove":
            if isinstance(parent, list):
                parent.pop(int(key))
            elif isinstance(parent, dict):
                parent.pop(str(key), None)
        elif op == "move":
            from_path = str(op_item.get("from") or "")
            if from_path:
                src_parent, src_key = _resolve_json_pointer_parent(root, from_path)
                moved_val = src_parent.pop(int(src_key)) if isinstance(src_parent, list) else src_parent.pop(str(src_key), None)
                if isinstance(parent, list):
                    if key >= len(parent):
                        parent.append(moved_val)
                    else:
                        parent.insert(int(key), moved_val)
                elif isinstance(parent, dict):
                    parent[str(key)] = moved_val
def apply_json_patch_in_memory(filepath: str, content: str, block: Dict[str, Any], silent: bool = False) -> Tuple[bool, str, str]:
    """
    Applies a <<<<<<< JSON_PATCH block (either a dotted/selector key-path dict or RFC 6902 array)
    to .json, .yaml/.yml, or .md (YAML frontmatter) files.
    """
    raw_patch = normalize_patch_payload((block.get("patch_body") or block.get("replace") or "").strip(), reference_content=content or "")
    if not raw_patch:
        return False, content or "", "Empty JSON_PATCH payload."
    try:
        patch_obj = json.loads(raw_patch)
    except Exception:
        try:
            patch_obj = load_yaml_string(raw_patch)
        except Exception as e:
            return False, content or "", f"Invalid JSON_PATCH syntax: {e}"

    ext = Path(filepath).suffix.lower()
    try:
        if ext == ".md":
            yaml_data, body, _ = parse_frontmatter(content or "")
            working_tree = dict(yaml_data) if isinstance(yaml_data, dict) else {}
            if isinstance(patch_obj, list):
                _apply_rfc6902_ops(working_tree, patch_obj)
            elif isinstance(patch_obj, dict):
                _deep_merge_rfc7396(working_tree, patch_obj)
            else:
                return False, content or "", "JSON_PATCH root must be an object or array."
            updated = update_frontmatter(f"---\n---\n\n{body}", working_tree)
        elif ext in (".yaml", ".yml"):
            working_tree = load_yaml_string(content or "{}")
            if not isinstance(working_tree, (dict, list)):
                working_tree = {}
            if isinstance(patch_obj, list):
                _apply_rfc6902_ops(working_tree, patch_obj)
            elif isinstance(patch_obj, dict) and isinstance(working_tree, dict):
                _deep_merge_rfc7396(working_tree, patch_obj)
            else:
                return False, content or "", "JSON_PATCH root must be compatible with target YAML structure."
            updated = dump_yaml_string(working_tree)
        else:
            working_tree = json.loads(content) if (content and content.strip()) else {}
            if isinstance(patch_obj, list):
                _apply_rfc6902_ops(working_tree, patch_obj)
            elif isinstance(patch_obj, dict) and isinstance(working_tree, dict):
                _deep_merge_rfc7396(working_tree, patch_obj)
            else:
                return False, content or "", "JSON_PATCH root must be an object or array."
            updated = json.dumps(working_tree, indent=2) + "\n"
    except Exception as e:
        return False, content or "", f"JSON_PATCH evaluation error: {e}"

    if updated == (content or ""):
        return True, content or "", "idempotent"
    return True, updated, "success"