import re
import difflib
import base64
from insetu.kernel.utils import _get_base_step_and_diffs
def clean_chevron_meltdown(text):
    """Phase B: Explicit Chevron Healing Loop. Trims conversational garbage trailing the final patch."""
    import re
    # Find the last valid REPLACE block
    match = list(re.finditer(r'>>>>>>> REPLACE', text))
    if match:
        last_idx = match[-1].end()
        # Trim any trailing text that lacks alphanumeric characters (conversational/markdown decay)
        trailing = text[last_idx:]
        if not re.search(r'[a-zA-Z0-9]', trailing.replace('```', '')):
            return text[:last_idx]
    return text

def expand_macros(text):
    # Semantic Multiplier Macro: e.g., ``` or =======
    text = re.sub(r'\{\{\s*(.)\s*\*\s*(\d+)\s*\}\}', lambda m: m.group(1) * int(m.group(2)), text)
    text = re.sub(r'\{\{\s*triple(.)\s*\}\}', lambda m: m.group(1) * 3, text)
    text = re.sub(r'_(?:[^_\n]_){3,}', lambda m: m.group(0).replace('_', ''), text)
    text = re.sub(r'\x5b\x73\x6f\x75\x72\x63\x65\x3a\x5c\x73\x2a\x5c\x64\x2b\x5d', '', text)
    text = re.sub(r'\x5b\x63\x69\x74\x65\x3a\x5c\x73\x2a\x5b\x5c\x64\x5c\x73\x2c\x5d\x2b\x5d', '', text)
    text = re.sub(r'\x5b\x63\x69\x74\x65\x5f\x73\x74\x61\x72\x74\x5d', '', text)
    text = re.sub(r'\x5b\x63\x69\x74\x65\x5f\x65\x6e\x64\x5d', '', text)
    text = re.sub(r'\x5b\x63\x69\x74\x65\x5d', '', text)
    return text

def is_effectively_identical(lines_a, lines_b):
    """
    Externalized comparison logic.
    Pass 1: Strip whitespace. If they don't match, return False.
    Pass 2: If stripped strings match, calculate relative indents. If they differ, return False.
    Returns True only if both text and relative indentation structure are completely identical.
    """
    a_clean = [l for l in lines_a if l.strip() and l.strip().upper() != '{{UNTIL}}']
    b_clean = [l for l in lines_b if l.strip() and l.strip().upper() != '{{UNTIL}}']

    if len(a_clean) != len(b_clean):
        return False

    # Pass 1: Stripped comparison
    for a, b in zip(a_clean, b_clean):
        if a.strip() != b.strip():
            return False
    # Pass 2: Relative Indentation check
    a_base = len(a_clean[0]) - len(a_clean[0].lstrip()) if a_clean else 0
    b_base = len(b_clean[0]) - len(b_clean[0].lstrip()) if b_clean else 0

    for a, b in zip(a_clean, b_clean):
        a_rel = (len(a) - len(a.lstrip())) - a_base
        b_rel = (len(b) - len(b.lstrip())) - b_base
        if a_rel != b_rel:
            return False

    return True


def find_block_anchor(file_lines, block_lines):
    """
    Abstracted 100% contiguous block search engine.
    Searches file_lines for a 100% contiguous match of block_lines.
    Allows whitespace trimming and symmetric line-stitching, but requires
    every non-empty line in block_lines to match sequentially.
    """
    non_empty_indices = [idx for idx, l in enumerate(block_lines) if l.strip() and l.strip().upper() != "{{UNTIL}}"]
    if not non_empty_indices:
        return None

    baseline_s_idx = non_empty_indices[0]
    last_content_s_idx = non_empty_indices[-1]

    for i in range(len(file_lines)):
        match_meta = {"last_content_f_idx": -1}
        def match_from(f_idx, s_idx):
            local_baseline_f_idx = -1
            while s_idx < len(block_lines):
                if block_lines[s_idx].strip().upper() == "{{UNTIL}}":
                    s_idx += 1
                    if s_idx >= len(block_lines): return True, len(file_lines) - i, local_baseline_f_idx
                    while f_idx < len(file_lines):
                        ok, span, b_f_idx = match_from(f_idx, s_idx)
                        if ok: return True, span, (local_baseline_f_idx if local_baseline_f_idx != -1 else b_f_idx)
                        f_idx += 1
                    return False, 0, -1
                else:
                    if f_idx >= len(file_lines): return False, 0, -1
                    f_stripped, s_stripped = file_lines[f_idx].strip(), block_lines[s_idx].strip()

                    if not s_stripped and f_stripped: s_idx += 1; continue
                    if not f_stripped and s_stripped: f_idx += 1; continue

                    if s_idx == last_content_s_idx:
                        match_meta["last_content_f_idx"] = f_idx
                        if not f_stripped.startswith(s_stripped): return False, 0, -1
                    else:
                        is_first_line = (s_idx == baseline_s_idx)
                        if is_first_line and f_stripped.endswith(s_stripped): pass
                        elif f_stripped != s_stripped:
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
                                f_idx += 1; s_idx += 1
                            else:
                                return False, 0, -1

                    if s_idx == baseline_s_idx: local_baseline_f_idx = f_idx
                    f_idx += 1; s_idx += 1
            return True, f_idx - i, local_baseline_f_idx

        ok, span, b_f_idx = match_from(i, 0)
        if ok:
            return {
                "match_idx": i,
                "actual_span": span,
                "matched_baseline_f_idx": b_f_idx,
                "matched_last_content_f_idx": match_meta["last_content_f_idx"],
                "baseline_s_idx": baseline_s_idx,
                "last_content_s_idx": last_content_s_idx
            }
    return None


def apply_block_in_memory(content, block, silent=False):
    content = content.replace('\r\n', '\n').replace('\xa0', ' ')
    file_lines = content.split('\n')
    search_str = expand_macros(block["search"]).replace('\xa0', ' ')
    replace_str = expand_macros(block["replace"]).replace('\xa0', ' ')
    if not search_str.strip(): return True, replace_str, "genesis"

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

    # Abstracted Anchor Search on SEARCH Block
    search_match = find_block_anchor(file_lines, search_lines)

    if not search_match:
        # Check if REPLACE block matches 100% contiguously in file (Idempotency Check)
        if replace_lines and any(l.strip() for l in replace_lines if l.strip().upper() != '{{UNTIL}}'):
            replace_match = find_block_anchor(file_lines, replace_lines)
            if replace_match:
                if not silent: print("  └─ [ℹ️] Idempotency: Target file 100% matches REPLACE block. Skipping chunk.")
                return True, content, "idempotent"

        # Fallback: Regex extraction for edge-case grid desyncs
        if "{{UNTIL}}" in search_str:
            import re
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
            diff = list(difflib.ndiff(actual_lines, search_lines))
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

    if last_content_s_idx != -1 and matched_last_content_f_idx != -1:
        if replace_lines and replace_lines[-1].strip() == search_lines[last_content_s_idx].strip():
            lstrip_line = file_lines[matched_last_content_f_idx].lstrip()
            s_line_stripped = search_lines[last_content_s_idx].strip()
            if lstrip_line.startswith(s_line_stripped): replace_lines[-1] += lstrip_line[len(s_line_stripped):]
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
    return True, "\n".join(file_lines[:match_idx] + new_replace_lines + file_lines[match_idx + actual_span:]), "success"