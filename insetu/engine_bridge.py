from pathlib import Path
import os
import re
import io
import random
import datetime
import ast
import json
import subprocess
import base64
import difflib
from contextlib import redirect_stdout
from insetu.utils_core import get_sister_repos, get_workspace_physics, get_omniscient_workspace_files

__depends__ = []

def expand_macros(text):
    # Semantic Multiplier Macro: e.g., {{ ` * 3 }} or {{ = * 7 }}
    text = re.sub(r'\{\{\s*(.)\s*\*\s*(\d+)\s*\}\}', lambda m: m.group(1) * int(m.group(2)), text)
    text = re.sub(r'\{\{\s*triple(.)\s*\}\}', lambda m: m.group(1) * 3, text)
    text = re.sub(r'_(?:[^_\n]_){3,}', lambda m: m.group(0).replace('_', ''), text)
    text = re.sub(r'\x5b\x73\x6f\x75\x72\x63\x65\x3a\x5c\x73\x2a\x5c\x64\x2b\x5d', '', text)
    text = re.sub(r'\x5b\x63\x69\x74\x65\x3a\x5c\x73\x2a\x5b\x5c\x64\x5c\x73\x2c\x5d\x2b\x5d', '', text)
    text = re.sub(r'\x5b\x63\x69\x74\x65\x5f\x73\x74\x61\x72\x74\x5d', '', text)
    text = re.sub(r'\x5b\x63\x69\x74\x65\x5f\x65\x6e\x64\x5d', '', text)
    text = re.sub(r'\x5b\x63\x69\x74\x65\x5d', '', text)
    return text
def parse_blocks(text):
    files = {}
    current_file = None
    state = "OUTSIDE"
    current_type = "exact"
    search_lines, replace_lines = [], []

    # Scaffolding: Strip conversational fluff before the first FILE block (INS-TODO-20260709_1032)
    if "<<<<<<< FILE:" in text:
        text = "<<<<<<< FILE:" + text.split("<<<<<<< FILE:", 1)[1]

    # Sanitize invisible non-breaking spaces (NBSP) that break strict matching
    lines = text.replace('\r\n', '\n').replace('\xa0', ' ').split('\n')
    for line in lines:
        if line.startswith("<<<<<<< FILE:"):
            current_file = line.replace("<<<<<<< FILE:", "").strip()
            if current_file not in files: files[current_file] = []
            state = "OUTSIDE"
        elif line.startswith("<<<<<<< SEARCH"):
            state = "SEARCH"
            search_lines = []
            # Scaffolding: Support Regex Anchoring (INSETU-QUEUE-20260702_0907_06)
            current_type = "regex" if "REGEX" in line else "exact"
        elif line.startswith("======="):
            if state == "SEARCH":
                state = "REPLACE"
                replace_lines = []
            elif state == "OUTSIDE" and current_file:
                print(f"  [~] Warning: Missing '<<<<<<< SEARCH' tag detected for {current_file}. Auto-healing as a genesis patch.")
                state = "REPLACE"
                search_lines = []
                replace_lines = []
        elif line.startswith(">>>>>>> REPLACE"):
            if state == "REPLACE" and current_file:
                files[current_file].append({
                    "type": current_type,
                    "search": "\n".join(search_lines),
                    "replace": "\n".join(replace_lines)
                })
            state = "OUTSIDE"
        else:
            if state == "SEARCH": search_lines.append(line)
            elif state == "REPLACE": replace_lines.append(line)
    return files
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
    content = content.replace('\r\n', '\n').replace('\xa0', ' ')
    file_lines = content.split('\n')
    search_str = expand_macros(block["search"]).replace('\xa0', ' ')
    replace_str = expand_macros(block["replace"]).replace('\xa0', ' ')
    if not search_str.strip(): return True, replace_str

    search_lines = search_str.split('\n')
    replace_lines = replace_str.split('\n')

    # Scaffolding: Skip No-Ops (INS-TODO-20260708_0940)
    if is_effectively_identical(search_lines, replace_lines):
        if not silent: print("  └─ [ℹ️] No-Op: SEARCH and REPLACE blocks are identical. Skipping chunk.")
        return True, content

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
                f_subset_raw = [file_lines[f_idx] for f_idx in range(i, len(file_lines)) if file_lines[f_idx].strip()][:len(r_non_empty)]
                if is_effectively_identical(f_subset_raw, replace_lines):
                    is_already_patched = True

            if is_already_patched: continue

            match_idx, actual_span, matched_baseline_f_idx, matched_last_content_f_idx = i, span, b_f_idx, match_meta["last_content_f_idx"]
            break
    if match_idx == -1:
        r_stripped = [l.strip() for l in replace_lines if l.strip()]
        s_stripped = [l.strip() for l in search_lines if l.strip()]
        f_stripped = [l.strip() for l in file_lines if l.strip()]

        f_raw_non_empty = [l for l in file_lines if l.strip()]
        r_raw_non_empty = [l for l in replace_lines if l.strip()]

        added_lines = [l for l in r_stripped if l not in s_stripped]
        deleted_lines = [l for l in s_stripped if l not in r_stripped]

        is_pure_deletion = len(deleted_lines) > 0 and len(added_lines) == 0
        is_pure_addition = len(added_lines) > 0 and len(deleted_lines) == 0

        is_idempotent = False

        if is_pure_deletion:
            if not any(dl in f_stripped for dl in deleted_lines):
                is_idempotent = True
        elif is_pure_addition:
            if any(is_effectively_identical(f_raw_non_empty[i:i+len(r_raw_non_empty)], r_raw_non_empty) for i in range(len(f_raw_non_empty) - len(r_raw_non_empty) + 1)):
                is_idempotent = True
        else:
            if r_raw_non_empty and any(is_effectively_identical(f_raw_non_empty[i:i+len(r_raw_non_empty)], r_raw_non_empty) for i in range(len(f_raw_non_empty) - len(r_raw_non_empty) + 1)):
                if not any(dl in f_stripped for dl in deleted_lines):
                    is_idempotent = True
        if is_idempotent:
            if not silent: print("  └─ [ℹ️] Idempotency: Patch state already matches target. Skipping chunk.")
            return True, content

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
                    return True, content[:start_idx] + replace_str.lstrip('\n') + content[match.end():]
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

        return False, content

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

    return True, "\n".join(file_lines[:match_idx] + new_replace_lines + file_lines[match_idx + actual_span:])
def _process_sync_transaction(vfs, workspace_id, data, sister_repos, ws_root):
    """Core transaction loop extracted to reduce cyclomatic complexity and deep nesting."""
    from insetu.sdk import ExtensionContext
    ctx = ExtensionContext('bridge', workspace_id)
    raw_text = data.get("text", "")
    active_files = data.get("active_files", [])
    dry_run = data.get("dry_run", False)
    pinned_repos_raw = data.get("pinned_repos", ["ALL"])
    allowed_repos = sister_repos if "ALL" in pinned_repos_raw else [r for r in sister_repos if r in pinned_repos_raw]

    parsed_structure = parse_blocks(raw_text)
    pid = f"{random.getrandbits(16):04x}".upper()
    print(f"\n=== SYNC TRANSACTION PULSE [{datetime.datetime.now().strftime('%H:%M:%S')}] ID: {pid} ===")
    omniscient_cache = None

    for target_file, blocks in parsed_structure.items():
        if target_file not in active_files or not blocks: continue
        # Hardware Lock: Protect Bootloader and Lifeboat
        norm_target = target_file
        if norm_target.endswith('insetu/cli.py') or norm_target.endswith('fallback_bridge.py'):
            print(f"  [!] TRANSACTION ABORTED: '{target_file}' is hardware-locked.\nThe bootloader and lifeboat must be edited manually.")
            print("." * 30)
            continue

        # Execution Lock Containment Check
        explicit_repo = norm_target.split('/')[0] if '/' in norm_target else None
        if explicit_repo in sister_repos and explicit_repo not in allowed_repos:
            print(f"  [!] TRANSACTION ABORTED: Target repository '{explicit_repo}' is not pinned. Skipping {target_file}.")
            print("." * 30)
            continue
        resolved_path = ctx.resolve_path(target_file)
        is_genesis = all(not b["search"].strip() for b in blocks)
        if is_genesis and explicit_repo not in sister_repos:
            all_known = [r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")]
            if explicit_repo in all_known:
                pass
            elif explicit_repo and os.path.isdir(Path(ws_root).joinpath(explicit_repo).as_posix()):
                print(f"  [⚡] Auto-Resolved: '{explicit_repo}' exists physically.\nAllowing genesis patch.")
            elif len(allowed_repos) == 1:
                target_file = f"{allowed_repos[0]}/{norm_target}"
                norm_target = target_file
                explicit_repo = allowed_repos[0]
                resolved_path = ctx.resolve_path(target_file)
                print(f"  [⚡] Auto-Resolved: Genesis patch missing repo anchor. Defaulting to '{explicit_repo}'.")
            else:
                bad_anchor = explicit_repo or target_file
                print(f"  [!] TRANSACTION ERROR: Genesis patch missing valid repository anchor.")
                print(f"  [!] TRANSACTION ABORTED: '{bad_anchor}' is not a recognized repository.\nPlease prepend the repository name (e.g., repo-name/path/to/file).")
                print("." * 30)
                continue
        # Smart Resolution Engine
        if not is_genesis:
            basename = Path(target_file).name
            if omniscient_cache is None:
                omniscient_cache = get_omniscient_workspace_files(workspace_id, allowed_repos)
            candidates = [cand_rel for f, cand_rel in omniscient_cache if f == basename]
            target_norm = target_file

            def grade_candidate(c):
                if c == target_norm or c.endswith("/" + target_norm):
                    return (0, len(c))
                return (1, len(c))
            candidates.sort(key=grade_candidate)
            exact_match_passed = False
            verified_alts = []
            failed_diff_cands = []
            for cand in candidates:
                try:
                    temp_content = vfs.read(cand)
                    if temp_content is None: continue
                    cand_success = True
                    for b in blocks:
                        success, _ = apply_block_in_memory(temp_content, b, silent=True)
                        if not success:
                            cand_success = False
                            break
                    if cand_success:
                        verified_alts.append(cand)
                        cand_abs = Path(ws_root).joinpath(cand).as_posix()
                        if os.path.abspath(resolved_path) == os.path.abspath(cand_abs):
                            exact_match_passed = True
                            break
                    else:
                        failed_diff_cands.append(cand)
                except Exception:
                    pass

            if not exact_match_passed:
                if verified_alts:
                    best_alt = verified_alts[0]
                    if len(allowed_repos) == 1:
                        print(f"  [⚡] Auto-Resolved: Only 1 repo pinned.\nSeamlessly routing '{target_file}' to '{best_alt}'.")
                        target_file = best_alt
                        resolved_path = ctx.resolve_path(target_file)
                    else:
                        print(f"  [?] Smart Resolution: Anchors failed or file missing for '{target_file}'.")
                        print(f"  [✓] Confirmed Match: Found '{best_alt}' which perfectly matches your SEARCH anchors.")
                        if len(verified_alts) > 1:
                            print(f"  [i] (Note: Also verified {len(verified_alts)-1} other valid matches).")
                        print(f"  [ACTION_REQUIRED: UPDATE_PATH | {target_file} | {best_alt} ]")
                        print("  [!] Halting execution for this file.")
                        print("." * 30)
                        continue
                else:
                    if not os.path.exists(resolved_path):
                        if failed_diff_cands:
                            print(f"  [!] TRANSACTION ERROR: Found {len(failed_diff_cands)} matching path candidate(s), but your SEARCH block failed the diff test.")
                            for fc in failed_diff_cands:
                                print(f"      - {fc}")
                            print("  [!] TRANSACTION ABORTED: Check your SEARCH block for hallucinated padding or mismatched context.")
                        else:
                            print(f"  [!] TRANSACTION ERROR: Target file not found at path: {resolved_path}")
                        print(f"  [!] TRANSACTION ABORTED: Check your directory context or cross-repo prefix.")
                        print("." * 30)
                        continue
        abs_target = os.path.abspath(resolved_path)
        display_path = os.path.relpath(abs_target, ws_root)
        print(f"Targeting: {display_path} ({len(blocks)} chunks mapped)")

        working_content = vfs.read(target_file)
        if working_content is None:
            if blocks and blocks[0]["search"].strip():
                print(f"  [!] TRANSACTION ERROR: Target file not found at path: {resolved_path}")
                print(f"  [!] TRANSACTION ABORTED: Check your directory context or cross-repo prefix.")
                print("." * 30)
                continue
            working_content = ""
        original_content = working_content
        file_success = True
        for idx, b in enumerate(blocks):
            success, updated_content = apply_block_in_memory(working_content, b)
            if success: 
                working_content = updated_content
                print(f"  [✓] Chunk {idx + 1}/{len(blocks)} integrated successfully.")
            else:
                if not dry_run:
                    print(f"  [!] TRANSACTION ERROR: Chunk {idx + 1}/{len(blocks)} failed.")
                    print(f"  [ACTION_REQUIRED: COPY_STATE |\n{target_file} ]")
                file_success = False
                if idx + 1 < len(blocks):
                    print(f"  [⏭️] Skipped chunks {idx + 2} through {len(blocks)} due to error.")
                break
        # --- PRE-FLIGHT SYNTAX VALIDATION ---
        if file_success:
            ext = os.path.splitext(target_file)[1].lower()
            try:
                if ext == '.py':
                    ast.parse(working_content)
                elif ext == '.json':
                    json.loads(working_content)
                elif ext == '.js':
                    try:
                        res = subprocess.run(
                            ['node', '--input-type=module', '-c'], 
                            input=working_content, 
                            capture_output=True, 
                            text=True,
                            encoding='utf-8'
                        )
                        if res.returncode != 0:
                            err_str = res.stderr.strip()
                            err_b64 = base64.b64encode(err_str.encode('utf-8')).decode('utf-8')
                            print(f"  [!] SYNTAX ERROR: Patch introduces invalid JavaScript in {target_file}.")
                            print(f"      {err_str}")
                            print(f"  [ACTION_REQUIRED: COPY_ERROR |\n{err_b64} ]")
                            print(f"  [ACTION_REQUIRED: COPY_STATE | {target_file} ]")
                            file_success = False
                    except FileNotFoundError:
                        print(f"  [~] Warning: Node.js not found in PATH. Skipping JS syntax validation for {target_file}.")
            except SyntaxError as e:
                err_str = f"Line {e.lineno}: {e.msg}"
                err_b64 = base64.b64encode(err_str.encode('utf-8')).decode('utf-8')
                print(f"  [!] SYNTAX ERROR: Patch introduces invalid Python syntax in {target_file}.")
                print(f"      {err_str}")
                print(f"  [ACTION_REQUIRED: COPY_ERROR | {err_b64}\n]")
                print(f"  [ACTION_REQUIRED: COPY_STATE | {target_file} ]")
                file_success = False
            except ValueError as e:
                err_str = str(e)
                err_b64 = base64.b64encode(err_str.encode('utf-8')).decode('utf-8')
                print(f"  [!] SYNTAX ERROR: Patch introduces invalid JSON syntax in {target_file}.")
                print(f"      Details: {err_str}")
                print(f"  [ACTION_REQUIRED: COPY_ERROR |\n{err_b64} ]")
                print(f"  [ACTION_REQUIRED: COPY_STATE | {target_file} ]")
                file_success = False
            except Exception as e:
                print(f"  [!] SYNTAX ERROR: Validation failed for {target_file}. Details: {str(e)}")
                file_success = False
        if file_success and working_content != original_content and not dry_run:
            vfs.save(target_file, working_content)
            print(f"  [✓] In-memory composition successful for {target_file}. Staged in transaction buffer.")
        elif file_success and dry_run:
            print(f"  [✓] [DRY RUN] Verified perfectly for {target_file}.")
        elif not file_success and not dry_run:
            # Halt the execution loop instantly. The rollback clears the buffer.
            raise RuntimeError(f"Syntax or patching validation failed on {target_file}. Rolling back entire transaction.")
        print("." * 30)

    if not dry_run:
        print(f"  [🚀] ALL FILES VALIDATED. Atomic VFS commit executed.")
    print(f"=== PULSE {pid} COMPLETE ===\n")

def execute_bridge_sync(workspace_id, data):
    out = io.StringIO()
    sister_repos = get_sister_repos(workspace_id)
    _, ws_root, _ = get_workspace_physics(workspace_id)
    from insetu.context import VFSTransaction

    with redirect_stdout(out):
        try:
            with VFSTransaction(workspace_id) as vfs:
                _process_sync_transaction(vfs, workspace_id, data, sister_repos, ws_root)
        except Exception as e: 
            print(f"  [!] System processing fault: {str(e)}")

    return out.getvalue()

# --- ASYNCHRONOUS LEDGER DELEGATION ---
from insetu.workers import update_immediate_job_status, register_callback

def _background_bridge_sync(job_id, workspace_id, **kwargs):
    """Executes the bridge matrix off-thread and enforces the VFS synchronization barrier."""
    try:
        update_immediate_job_status(job_id, 'processing', "Analyzing patch matrices and running AST validation...", workspace_id=workspace_id)
        # Execute the pure operational logic
        sync_output = execute_bridge_sync(workspace_id, kwargs)

        # VFS BARRIER: Block the completion signal until physical disk writes settle
        from insetu.routes_fs import _VFS_WRITE_QUEUE, _VFS_SHUTDOWN_SIGNAL
        import time

        # Replace blocking .join() with an abortable polling lock
        while _VFS_WRITE_QUEUE.unfinished_tasks > 0:
            if _VFS_SHUTDOWN_SIGNAL.is_set():
                update_immediate_job_status(job_id, 'failed', "Transaction aborted mid-flight due to system shutdown or workspace context swap.", workspace_id=workspace_id)
                return
            time.sleep(0.1)

        update_immediate_job_status(job_id, 'completed', sync_output, workspace_id=workspace_id)
    except Exception as e:
        import traceback
        err = traceback.format_exc()
        update_immediate_job_status(job_id, 'failed', f"Bridge Fatal Error: {str(e)}\n\n{err}", workspace_id=workspace_id)

register_callback("bridge", "sync_task", _background_bridge_sync)