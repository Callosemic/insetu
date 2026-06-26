import os
import re
from insetu.utils_core import resolve_workspace_path, WORKSPACE_ROOT, get_sister_repos

def expand_macros(text):
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
                            if f_idx + 1 < len(file_lines) and f_stripped and f_stripped[-1] in ".,;:-([{":
                                combined_f = f_stripped + " " + file_lines[f_idx + 1].strip()
                                if combined_f == s_stripped: f_idx += 1
                                elif s_idx + 1 < len(search_lines) and combined_f == s_stripped + " " + search_lines[s_idx+1].strip():
                                    f_idx += 1; s_idx += 1
                                else: return False, 0, -1
                            else: return False, 0, -1

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
    sample_start, sample_end = max(0, match_idx - 20), min(len(file_lines), match_idx + 20)
    file_indents = sorted(list(set(len(file_lines[k]) - len(file_lines[k].lstrip()) for k in range(sample_start, sample_end) if file_lines[k].strip())))
    if len(file_indents) > 1:
        file_diffs = [file_indents[k+1] - file_indents[k] for k in range(len(file_indents)-1)]
        file_step = max(set(file_diffs), key=file_diffs.count)
    else:
        file_step = 4

    # 2. Evaluate LLM Step against File Step
    all_llm_lines = search_lines + replace_lines
    llm_indents = sorted(list(set(len(l) - len(l.lstrip()) for l in all_llm_lines if l.strip())))
    if len(llm_indents) > 1:
        llm_diffs = [llm_indents[k+1] - llm_indents[k] for k in range(len(llm_indents)-1)]

        # If all LLM indentation jumps are perfect multiples of the file's step size, it's correctly aligned
        if all(d % file_step == 0 for d in llm_diffs):
            llm_step = file_step
        else:
            # If not, assume the LLM hallucinated a different base ratio (e.g., 2 spaces). Find its smallest jump.
            llm_step = min([d for d in llm_diffs if d > 0], default=4)
    else:
        llm_step = file_step

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
        elif llm_step == file_step:
            # GRACEFUL FIX: If the LLM matched the file's step size, bypass the ratio math
            # and use a strict absolute delta. This perfectly preserves irregular unindents.
            indent_delta = actual_base_indent - llm_base_indent
            target_indent = max(0, r_indent + indent_delta)
        else:
            # Fallback: The LLM hallucinated a different step size (e.g. 2 spaces vs 4). 
            # Calculate the ratio to force it to match the target file.
            nesting_levels = (r_indent - llm_base_indent) / llm_step
            target_indent = max(0, actual_base_indent + int(round(nesting_levels * file_step)))

        new_replace_lines.append((" " * target_indent) + r_line.lstrip())
        
    return True, "\n".join(file_lines[:match_idx] + new_replace_lines + file_lines[match_idx + actual_span:])