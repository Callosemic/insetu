import os
import io
import random
import datetime
import ast
import json
import subprocess
import base64
from pathlib import Path
from contextlib import redirect_stdout

from insetu.utils_core import get_sister_repos, get_workspace_physics, get_omniscient_workspace_files
from insetu.vfs import VFSTransaction
from .bridge_parser import parse_blocks
from .bridge_fuzzy import apply_block_in_memory

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
                        success, _, _ = apply_block_in_memory(temp_content, b, silent=True)
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
            success, updated_content, chunk_status = apply_block_in_memory(working_content, b)
            if success: 
                working_content = updated_content
                if chunk_status in ("success", "genesis"):
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

    with redirect_stdout(out):
        try:
            with VFSTransaction(workspace_id) as vfs:
                _process_sync_transaction(vfs, workspace_id, data, sister_repos, ws_root)
        except Exception as e: 
            print(f"  [!] System processing fault: {str(e)}")

    return out.getvalue()