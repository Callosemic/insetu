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
from insetu.utils_core import resolve_workspace_path, get_sister_repos, get_workspace_physics, load_config, get_omniscient_workspace_files

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
    search_lines, replace_lines = [], []
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
    content = content.replace('\r\n', '\n').replace('\xa0', ' ')
    file_lines = content.split('\n')
    search_str = expand_macros(block["search"]).replace('\xa0', ' ')
    replace_str = expand_macros(block["replace"]).replace('\xa0', ' ')

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
        s_stripped = [l.strip() for l in search_lines if l.strip()]
        f_stripped = [l.strip() for l in file_lines if l.strip()]
        if r_stripped:
            n = len(r_stripped)
            # To prevent false positives on deletions, only trust idempotency if the REPLACE block has >= 3 lines,
            # OR if it's strictly larger than the SEARCH block (a pure addition).
            if n >= 3 or n > len(s_stripped):
                for i in range(len(f_stripped) - n + 1):
                    if f_stripped[i:i+n] == r_stripped:
                        if not silent: print("  └─ ℹ️  Idempotency: REPLACE block already present in target. Skipping chunk.")
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

            best_f_idx = match.a
            actual_lines = file_lines[best_f_idx : best_f_idx + len(search_lines)]

            diff = list(difflib.ndiff(actual_lines, search_lines))
            diff_str = "\n".join(diff)

            err_b64 = base64.b64encode(diff_str.encode('utf-8')).decode('utf-8')
            print("  └─ 🔍 DIFF ANALYSIS: The closest block on disk differed from your SEARCH block.")
            print(f"  [ACTION_REQUIRED: COPY_ERROR | {err_b64} ]")

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
def execute_bridge_sync(workspace_id, data):
    out = io.StringIO()
    sister_repos = get_sister_repos(workspace_id)
    _, ws_root, _ = get_workspace_physics(workspace_id)

    with redirect_stdout(out):
        try:
            raw_text = data.get("text", "")
            active_files = data.get("active_files", [])
            dry_run = data.get("dry_run", False)
            pinned_repos_raw = data.get("pinned_repos", ["ALL"])
            allowed_repos = sister_repos if "ALL" in pinned_repos_raw else [r for r in sister_repos if r in pinned_repos_raw]

            parsed_structure = parse_blocks(raw_text)
            pid = f"{random.getrandbits(16):04x}".upper()
            print(f"\n=== SYNC TRANSACTION PULSE [{datetime.datetime.now().strftime('%H:%M:%S')}] ID: {pid} ===")

            for target_file, blocks in parsed_structure.items():
                if target_file not in active_files or not blocks: continue

                # Hardware Lock: Protect Bootloader and Lifeboat
                norm_target = target_file.replace('\\', '/')
                if norm_target.endswith('cli.py') or norm_target.endswith('fallback_bridge.py'):
                    print(f"  [!] TRANSACTION ABORTED: '{target_file}' is hardware-locked.\nThe bootloader and lifeboat must be edited manually.")
                    print("." * 30)
                    continue

                # Execution Lock Containment Check
                explicit_repo = norm_target.split('/')[0] if '/' in norm_target else None
                if explicit_repo in sister_repos and explicit_repo not in allowed_repos:
                    print(f"  [!] TRANSACTION ABORTED: Target repository '{explicit_repo}' is not pinned. Skipping {target_file}.")
                    print("." * 30)
                    continue

                resolved_path = resolve_workspace_path(target_file, workspace_id)
                is_genesis = all(not b["search"].strip() for b in blocks)
                if is_genesis and explicit_repo not in sister_repos:
                    all_known = [r.get("repo_dir") for r in load_config(workspace_id).get("target_repos", []) if r.get("repo_dir")]
                    if explicit_repo in all_known:
                        pass
                    elif explicit_repo and os.path.isdir(os.path.join(ws_root, explicit_repo)):
                        print(f"  [⚡] Auto-Resolved: '{explicit_repo}' exists physically.\nAllowing genesis patch.")
                    elif len(allowed_repos) == 1:
                        target_file = f"{allowed_repos[0]}/{norm_target}"
                        norm_target = target_file.replace('\\', '/')
                        explicit_repo = allowed_repos[0]
                        resolved_path = resolve_workspace_path(target_file, workspace_id)
                        print(f"  [⚡] Auto-Resolved: Genesis patch missing repo anchor. Defaulting to '{explicit_repo}'.")
                    else:
                        bad_anchor = explicit_repo or target_file
                        print(f"  [!] TRANSACTION ERROR: Genesis patch missing valid repository anchor.")
                        print(f"  [!] TRANSACTION ABORTED: '{bad_anchor}' is not a recognized repository.\nPlease prepend the repository name (e.g., repo-name/path/to/file).")
                        print("." * 30)
                        continue

                # Smart Resolution Engine
                if not is_genesis:
                    basename = os.path.basename(target_file)
                    all_files = get_omniscient_workspace_files(workspace_id, allowed_repos)
                    candidates = [cand_rel for f, cand_rel in all_files if f == basename]
                    target_norm = target_file.replace('\\', '/')

                    def grade_candidate(c):
                        if c == target_norm or c.endswith("/" + target_norm):
                            return (0, len(c))
                        return (1, len(c))
                    candidates.sort(key=grade_candidate)
                    exact_match_passed = False
                    verified_alts = []
                    failed_diff_cands = []

                    for cand in candidates:
                        cand_abs = os.path.join(ws_root, cand)
                        try:
                            with open(cand_abs, 'r', encoding='utf-8') as cf:
                                temp_content = cf.read()
                            cand_success = True
                            for b in blocks:
                                success, _ = apply_block_in_memory(temp_content, b, silent=True)
                                if not success:
                                    cand_success = False
                                    break
                            if cand_success:
                                verified_alts.append(cand)
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
                                resolved_path = resolve_workspace_path(target_file, workspace_id)
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
                display_path = os.path.relpath(abs_target, ws_root).replace('\\', '/')
                print(f"Targeting: {display_path} ({len(blocks)} chunks mapped)")

                if os.path.exists(resolved_path):
                    with open(resolved_path, 'r', encoding='utf-8') as f: working_content = f.read()
                else:
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
                    else:
                        if not dry_run:
                            print(f"  [!] TRANSACTION ERROR: Chunk {idx + 1} failed.")
                            print(f"  [ACTION_REQUIRED: COPY_STATE |\n{target_file} ]")
                        file_success = False
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
                                    text=True
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
                    if os.path.dirname(resolved_path):
                        os.makedirs(os.path.dirname(resolved_path), exist_ok=True)
                    with open(resolved_path, 'w', encoding='utf-8') as f: f.write(working_content)
                    print(f"  [✓] Transaction complete: In-memory composition committed cleanly for {target_file}.")
                    from insetu.hooks import hooks
                    hooks.emit('post_file_save', filepath=target_file, workspace_id=workspace_id)
                elif file_success and dry_run:
                    print(f"  [✓] [DRY RUN] Verified perfectly for {target_file}.")
                print("." * 30)
            print(f"=== PULSE {pid} COMPLETE ===\n")
        except Exception as e: 
            print(f"  [!] System processing fault: {str(e)}")

    return out.getvalue()