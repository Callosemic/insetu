import os
import re
from insetu.utils_core import resolve_workspace_path, WORKSPACE_ROOT, get_sister_repos
def expand_macros(text):
    # Semantic Multiplier Macro: e.g., {{ ` * 3 }} or {{ = * 7 }}
    text = re.sub(r'\{\{\s*(.)\s*\*\s*(\d+)\s*\}\}', lambda m: m.group(1) * int(m.group(2)), text)
    text = re.sub(r'\{\{\s*triple(.)\s*\}\}', lambda m: m.group(1) * 3, text)
    text = re.sub(r'_(?:[^_\n]_){3,}', lambda m: m.group(0).replace('_', ''), text)
    text = re.sub(r'\x5b\x73\x6f\x75\x72\x63\x65\x3a\x5c\x73\x2a\x5c\x64\x2b\x5d', '', text)
    text = re.sub(r'\x5b\x63\x69\x74\x65\x3a\x5c\x73\x2a\x5b\x5c\x64\x5c\x73\x2c\x5d\x2b\x5d', '', text)
    return text

def parse_blocks(text):
    files = {}
    current_file = None
    state = "OUTSIDE"
    search_lines, replace_lines = [], []
    lines = text.replace('\r\n', '\n').split('\n')
    for line in lines:
        if line.startswith("<<<<<<< FILE:"):
            current_file = line.replace("<<<<<<< FILE:", "").strip()
            if current_file not in files: files[current_file] = []
            state = "OUTSIDE"
        elif line.startswith("<<<<<<< SEARCH"):
            state = "SEARCH"
            search_lines = []
        elif line.startswith("======="):
            if state == "SEARCH":
                state = "REPLACE"
                replace_lines = []
        elif line.startswith(">>>>>>> REPLACE"):
            if state == "REPLACE" and current_file:
                files[current_file].append({
                    "search": "\n".join(search_lines),
                    "replace": "\n".join(replace_lines)
                })
            state = "OUTSIDE"
        else:
            if state == "SEARCH": search_lines.append(line)
            elif state == "REPLACE": replace_lines.append(line)
    return files
def _get_base_step_and_diffs(lines):
    """Analyzes a block of code to find its true structural base indentation unit (LCD > 1)."""
    indents = sorted(list(set(len(line) - len(line.lstrip()) for line in lines if line.strip())))
    if len(indents) > 1:
        diffs = [indents[k+1] - indents[k] for k in range(len(indents)-1)]
        valid_diffs = [d for d in diffs if d > 1]

        if valid_diffs:
            best_step = 4
            min_error = float('inf')

            # Test against standard software indent sizes (ordered by preference)
            for S in [4, 2, 3, 8]:
                error = 0
                has_base_jump = False

                for d in valid_diffs:
                    # Determine implied nesting level (e.g., 12 spaces at S=4 is level 3)
                    k = max(1, int(round(d / S)))
                    if k == 1:
                        has_base_jump = True

                    # Accumulate deviation from perfect grid
                    error += abs(d - (k * S))

                # A valid step size MUST have at least one single-level jump (k=1)
                if not has_base_jump:
                    error += 1000 

                if error < min_error:
                    min_error = error
                    best_step = S

            return best_step, diffs
    return 4, []

def apply_block_in_memory(content, block, silent=False):
    content = content.replace('\r\n', '\n')
    file_lines = content.split('\n')
    search_str = expand_macros(block["search"])
    replace_str = expand_macros(block["replace"])

    if not search_str.strip(): return True, replace_str
    
    search_lines = search_str.split('\n')
    replace_lines = replace_str.split('\n')

    for r_line in replace_lines:
        if r_line.strip().upper() == "{{UNTIL}}":
            if not silent: print(f"  └─ 🚨 TRANSACTION ERROR: LLM hallucinated {{{{UNTIL}}}} in the REPLACE block. Aborting chunk.")
            return False, content

    baseline_s_idx = next((idx for idx, l in enumerate(search_lines) if l.strip() and l.strip().upper() != "{{UNTIL}}"), -1)
    last_content_s_idx = next((idx for idx in reversed(range(len(search_lines))) if search_lines[idx].strip() and search_lines[idx].strip().upper() != "{{UNTIL}}"), -1)

    match_idx, actual_span, matched_baseline_f_idx, matched_last_content_f_idx = -1, 0, -1, -1

    for i in range(len(file_lines)):
        match_meta = {"last_content_f_idx": -1}
        def match_from(f_idx, s_idx):
            local_baseline_f_idx = -1
            while s_idx < len(search_lines):
                if search_lines[s_idx].strip().upper() == "{{UNTIL}}":
                    s_idx += 1
                    if s_idx >= len(search_lines): return True, len(file_lines) - i, local_baseline_f_idx
                    while f_idx < len(file_lines):
                        ok, span, b_f_idx = match_from(f_idx, s_idx)
                        if ok: return True, span, (local_baseline_f_idx if local_baseline_f_idx != -1 else b_f_idx)
                        f_idx += 1
                    return False, 0, -1
                else:
                    if f_idx >= len(file_lines): return False, 0, -1
                    f_stripped, s_stripped = file_lines[f_idx].strip(), search_lines[s_idx].strip()

                    if not s_stripped and f_stripped: s_idx += 1; continue
                    if not f_stripped and s_stripped: f_idx += 1; continue

                    if s_idx == last_content_s_idx:
                        match_meta["last_content_f_idx"] = f_idx
                        if not f_stripped.startswith(s_stripped): return False, 0, -1
                    else:
                        is_first_line = (s_idx == baseline_s_idx)
                        if is_first_line and f_stripped.endswith(s_stripped): pass
                        elif f_stripped != s_stripped:
                            # Symmetric Line Stitching: Survive token-wrapping regardless of which side wrapped.
                            next_f = file_lines[f_idx + 1].strip() if f_idx + 1 < len(file_lines) else None
                            next_s = search_lines[s_idx + 1].strip() if s_idx + 1 < len(search_lines) else None

                            # Helper to check combinations with and without a space
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
            s_non_empty = [l.strip() for l in search_lines if l.strip() and l.strip().upper() != '{{UNTIL}}']
            r_non_empty = [l.strip() for l in replace_lines if l.strip() and l.strip().upper() != '{{UNTIL}}']

            is_already_patched = False
            if len(r_non_empty) >= len(s_non_empty) and len(r_non_empty) > 0:
                f_subset = [file_lines[f_idx].strip() for f_idx in range(i, len(file_lines)) if file_lines[f_idx].strip()][:len(r_non_empty)]
                if len(f_subset) == len(r_non_empty) and f_subset == r_non_empty: is_already_patched = True

            if is_already_patched: continue

            match_idx, actual_span, matched_baseline_f_idx, matched_last_content_f_idx = i, span, b_f_idx, match_meta["last_content_f_idx"]
            break

    if match_idx == -1:
        r_stripped = [l.strip() for l in replace_lines if l.strip()]
        f_stripped = [l.strip() for l in file_lines if l.strip()]
        if r_stripped:
            n = len(r_stripped)
            for i in range(len(f_stripped) - n + 1):
                if f_stripped[i:i+n] == r_stripped:
                    if not silent: print("  └─ ℹ️  Idempotency: REPLACE block already present in target. Skipping chunk.")
                    return True, content
        return False, content
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
        
    return True, "\n".join(file_lines[:match_idx] + new_replace_lines + file_lines[match_idx + actual_span:])