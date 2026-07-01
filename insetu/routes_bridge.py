import os
import io
import random
import datetime
from contextlib import redirect_stdout
from flask import Blueprint, request
from insetu.utils_core import resolve_workspace_path, get_sister_repos, get_workspace_physics, load_config
from insetu.engine_bridge import parse_blocks, apply_block_in_memory

bridge_bp = Blueprint('bridge', __name__)

@bridge_bp.route('/api/bridge/sync', methods=['POST'])
def bridge_sync():
    workspace_id = request.headers.get('X-Workspace-ID')
    data = request.json
    out = io.StringIO()
    sister_repos = get_sister_repos(workspace_id)
    cfg_path, ws_root, _ = get_workspace_physics(workspace_id)
    
    with redirect_stdout(out):
        try:
            raw_text, active_files, dry_run = data.get("text", ""), data.get("active_files", []), data.get("dry_run", False)
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
                    print(f"  [!] TRANSACTION ABORTED: '{target_file}' is hardware-locked. The bootloader and lifeboat must be edited manually.")
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
                                                print(f"  [⚡] Auto-Resolved: '{explicit_repo}' exists physically. Allowing genesis patch.")
                                elif len(allowed_repos) == 1:
                                                target_file = f"{allowed_repos[0]}/{norm_target}"

                                                norm_target = target_file.replace('\\', '/')
                                                explicit_repo = allowed_repos[0]

                                                resolved_path = resolve_workspace_path(target_file, workspace_id)
                                                print(f"  [⚡] Auto-Resolved: Genesis patch missing repo anchor. Defaulting to '{explicit_repo}'.")
                                else:
                                                bad_anchor = explicit_repo or target_file
               
                                                print(f"  [!] TRANSACTION ERROR: Genesis patch missing valid repository anchor.")
                                                print(f"  [!] TRANSACTION ABORTED: '{bad_anchor}' is not a recognized repository. Please prepend the repository name (e.g., repo-name/path/to/file).")
                                                print("." * 30)
                                          
                                                continue
                # Smart Resolution Engine
                if not is_genesis:
                    basename = os.path.basename(target_file)
                    # Anchor to the absolute instance directory, bypassing volatile OS working directories
                    search_roots = [os.path.dirname(cfg_path)]
                    for repo in allowed_repos:
                        repo_path = os.path.join(ws_root, repo)
                        if os.path.exists(repo_path):
                            search_roots.append(repo_path)

                    search_roots = list(set(os.path.abspath(r) for r in search_roots))
                    live_cfg = load_config(workspace_id)

                    ignore_dirs = tuple(live_cfg.get("ignore_dirs", ['node_modules', '__pycache__', 'venv', '.venv', '.insetu', '.git']))

                    candidates = []
                    for s_root in search_roots:
                        for root, dirs, files in os.walk(s_root):
                            # Explicitly allow .tracker while blocking other hidden/system folders
                            dirs[:] = [d for d in dirs if (not d.startswith('.') or d == '.tracker') and d not in ignore_dirs]

                            if basename in files:
                                cand_abs = os.path.abspath(os.path.join(root, basename)).replace('\\', '/')
                                cand_rel = os.path.relpath(cand_abs, ws_root).replace('\\', '/')
              
                                if cand_rel not in candidates:
                                    candidates.append(cand_rel)

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
                                print(f"  [⚡] Auto-Resolved: Only 1 repo pinned. Seamlessly routing '{target_file}' to '{best_alt}'.")
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
                    else: # <--- Fixed: Bound checking strictly inside the active iteration track
                        if not dry_run:
                            print(f"  [!] TRANSACTION ERROR: Chunk {idx + 1} failed.")
                            print(f"  [ACTION_REQUIRED: COPY_STATE | {target_file} ]")
                        file_success = False
                        break
                # --- PRE-FLIGHT SYNTAX VALIDATION ---
                if file_success:
           
                    ext = os.path.splitext(target_file)[1].lower()
                    try:
                        if ext == '.py':
                            import ast
             
                            ast.parse(working_content)
                        elif ext == '.json':
                            import json
                            json.loads(working_content)
 
                        elif ext == '.js':
                            # Leverage local V8 engine for native JS parsing (bypassing execution)
                            import subprocess
       
                            import base64
                            try:
                                # Use --input-type=module to correctly parse ES6 imports
           
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
                                    print(f"  [ACTION_REQUIRED: COPY_ERROR | {err_b64} ]")
                                    print(f"  [ACTION_REQUIRED: COPY_STATE | {target_file} ]")
                                    file_success = False
                   
                            except FileNotFoundError:
                                print(f"  [~] Warning: Node.js not found in PATH. Skipping JS syntax validation for {target_file}.")
                    except SyntaxError as e:
                     
                        import base64
                        err_str = f"Line {e.lineno}: {e.msg}"
                        err_b64 = base64.b64encode(err_str.encode('utf-8')).decode('utf-8')
                        print(f"  [!] SYNTAX ERROR: Patch introduces invalid Python syntax in {target_file}.")
       
                        print(f"      {err_str}")
                        print(f"  [ACTION_REQUIRED: COPY_ERROR | {err_b64} ]")
                        print(f"  [ACTION_REQUIRED: COPY_STATE | {target_file} ]")
                 
                        file_success = False
                    except ValueError as e:
                        import base64
                        err_str = str(e)
                 
                        err_b64 = base64.b64encode(err_str.encode('utf-8')).decode('utf-8')
                        print(f"  [!] SYNTAX ERROR: Patch introduces invalid JSON syntax in {target_file}.")
                        print(f"      Details: {err_str}")
                        print(f"  [ACTION_REQUIRED: COPY_ERROR | {err_b64} ]")
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
       
                    hooks.emit('post_file_save', filepath=target_file)
                elif file_success and dry_run:
                    print(f"  [✓] [DRY RUN] Verified perfectly for {target_file}.")
                print("." * 30)
            print(f"=== PULSE {pid} COMPLETE ===\n")
     
        except Exception as e: print(f"  [!] System processing fault: {str(e)}")
        
    return out.getvalue(), 200, {'Content-Type': 'text/plain; charset=utf-8'}

@bridge_bp.route('/api/bridge/fetch', methods=['GET'])
def bridge_fetch():
    resolved_path = resolve_workspace_path(request.args.get('file', ''))
    if resolved_path and os.path.exists(resolved_path):
        with open(resolved_path, 'r', encoding='utf-8') as f: return f.read(), 200, {'Content-Type': 'text/plain; charset=utf-8'}
    return "File not found.", 404