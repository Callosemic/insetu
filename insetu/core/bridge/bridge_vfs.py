import os
import io
import random
import datetime
import ast
import json
import subprocess
import base64
import hashlib
import zlib
import time
import uuid
from pathlib import Path
from insetu.kernel.utils import get_workspace_physics, parse_blocks
from insetu.core.utils_core import get_sister_repos
from insetu.core.topology.engine_topology import get_omniscient_workspace_files
from insetu.kernel.vfs import VFSTransaction
from .bridge_fuzzy import apply_block_in_memory, clean_chevron_meltdown, expand_macros, is_effectively_identical
def _process_sync_transaction(vfs, workspace_id, data, sister_repos, ws_root):
    from insetu.core.bridge.engine_bridge import bridge_bp
    ctx = bridge_bp.get_context(workspace_id)
    raw_text = clean_chevron_meltdown(data.get("text", ""))
    active_files = data.get("active_files", [])
    dry_run = data.get("dry_run", False)
    pinned_repos_raw = data.get("pinned_repos", ["ALL"])
    allowed_repos = sister_repos if "ALL" in pinned_repos_raw else [r for r in sister_repos if r in pinned_repos_raw]

    parsed_structure = parse_blocks(raw_text)
    pid = f"tx_{random.getrandbits(32):08x}".lower()
    
    telemetry = {
        "transaction_id": pid,
        "mode": "dry_run" if dry_run else "live",
        "status": "action_required",
        "can_commit": True,
        "summary": {"total_patches": 0, "resolved": 0, "auto_skipped": 0, "action_required": 0, "failed": 0},
        "patches": []
    }
    memory_buffers = {}
    original_buffers = {}
    disk_hashes = {}
    omniscient_cache = None
    original_file_keys = {}

    def get_file_content(filepath):
        if filepath in memory_buffers: return memory_buffers[filepath]
        content = vfs.read(filepath)
        if content is not None:
            disk_hashes[filepath] = hashlib.sha256(content.encode('utf-8')).hexdigest()
            original_buffers[filepath] = content
            memory_buffers[filepath] = content
        return content
    patch_index = 0
    for raw_target_file, blocks in parsed_structure.items():
        if raw_target_file not in active_files or not blocks: continue

        # Enforce vfs:// logical boundary mapping directly
        target_file = raw_target_file.replace("vfs://", "", 1) if raw_target_file.startswith("vfs://") else raw_target_file
        norm_target = target_file

        if norm_target.endswith('insetu/cli.py') or norm_target.endswith('fallback_bridge.py'):
            telemetry["can_commit"] = False
            patch_tel = {
                "patch_index": patch_index,
                "original_file": target_file,
                "resolved_file": target_file,
                "status": "failed",
                "error_message": "Kernel Guardrail: Core CLI and Fallback Bridge files cannot be patched dynamically over the air.",
                "flags": ["banned_target"],
                "candidates": [],
                "available_actions": []
            }
            patch_index += 1
            telemetry["summary"]["total_patches"] += 1
            telemetry["summary"]["failed"] += 1
            telemetry["patches"].append(patch_tel)
            continue

        # Execution Lock Containment Check
        explicit_repo = norm_target.split('/')[0] if '/' in norm_target else None
        if explicit_repo in sister_repos and explicit_repo not in allowed_repos:
            telemetry["can_commit"] = False
            patch_tel = {
                "patch_index": patch_index,
                "original_file": target_file,
                "resolved_file": target_file,
                "status": "failed",
                "error_message": f"Execution Lock Triggered: Target repository '{explicit_repo}' is not currently pinned in your UI filters. Unpin the active repository or pin 'ALL' to authorize cross-boundary patching.",
                "flags": ["execution_locked"],
                "candidates": [],
                "available_actions": []
            }
            patch_index += 1
            telemetry["summary"]["total_patches"] += 1
            telemetry["summary"]["failed"] += 1
            telemetry["patches"].append(patch_tel)
            continue

        for b in blocks:
            patch_tel = {
                "patch_index": patch_index,
                "original_file": target_file,
                "resolved_file": None,
                "disk_hash": None,
                "status": "pending",
                "resolution_type": None,
                "flags": [],
                "candidates": [],
                "syntax_error": None,
                "error_message": None,
                "available_actions": []
            }
            patch_index += 1
            telemetry["summary"]["total_patches"] += 1
            
            search_str = expand_macros(b["search"])
            replace_str = expand_macros(b["replace"])
            is_genesis = not search_str.strip()
            # Step a.1: No-Op & Idempotency Filter
            if is_effectively_identical(search_str.split('\n'), replace_str.split('\n')):
                patch_tel["status"] = "auto_skipped"
                patch_tel["error_message"] = "No-Op: The SEARCH and REPLACE blocks are perfectly identical."
                telemetry["summary"]["auto_skipped"] += 1
                telemetry["patches"].append(patch_tel)
                continue

            resolved_path = None
            resolution_type = None
            content = get_file_content(target_file)
            # Step a.0: Genesis Patch Check
            if is_genesis:
                explicit_repo = norm_target.split('/')[0] if '/' in norm_target else None
                if explicit_repo in allowed_repos:
                    resolved_path = target_file
                    resolution_type = "genesis"
                elif len(allowed_repos) == 1:
                    cand_path = f"{allowed_repos[0]}/{norm_target}"
                    patch_tel["status"] = "needs_confirmation"
                    patch_tel["resolution_type"] = "genesis_pinned_shortcut"
                    patch_tel["candidates"] = [{"filepath": cand_path, "score": 1.0, "match_type": "genesis_pinned"}]
                    patch_tel["available_actions"].extend(["confirm_candidate", "deselect_patch"])
                    telemetry["can_commit"] = False
                    telemetry["summary"]["action_required"] += 1
                    telemetry["patches"].append(patch_tel)
                    continue
                else:
                    patch_tel["status"] = "failed"
                    patch_tel["error_message"] = "Genesis patch missing valid repository anchor."
                    telemetry["summary"]["failed"] += 1
                    telemetry["can_commit"] = False
                    telemetry["patches"].append(patch_tel)
                    continue
                if get_file_content(resolved_path) is not None:
                    if target_file in data.get("confirmed_candidates", {}):
                        pass # Overwrite explicitly authorized
                    else:
                        patch_tel["status"] = "needs_confirmation"
                        patch_tel["flags"].append("confirm-to-overwrite")
                        patch_tel["error_message"] = f"File '{resolved_path}' already exists on disk. Confirm to overwrite."
                        patch_tel["candidates"] = [{"filepath": resolved_path, "score": 1.0, "match_type": "overwrite"}]
                        patch_tel["available_actions"].append("confirm_candidate")
                        telemetry["can_commit"] = False
            # Step b: Direct Path Match
            elif content is not None:
                ok_search, _, s_status = apply_block_in_memory(content, b, silent=True)
                if ok_search and s_status == "idempotent":
                    patch_tel["status"] = "auto_skipped"
                    patch_tel["flags"].append("already_applied")
                    patch_tel["error_message"] = "Already Applied: The target file natively matches the desired state."
                    telemetry["summary"]["auto_skipped"] += 1
                    telemetry["patches"].append(patch_tel)
                    continue
                elif ok_search:
                    resolved_path = target_file
                    resolution_type = "direct_match"
            # Step c: Single Pinned Repo Shortcut
            if not resolved_path and len(allowed_repos) == 1:
                cand = f"{allowed_repos[0]}/{norm_target}"
                cand_content = get_file_content(cand)
                if cand_content is not None:
                    ok_search, _, s_status = apply_block_in_memory(cand_content, b, silent=True)
                    if ok_search and s_status == "idempotent":
                        patch_tel["status"] = "auto_skipped"
                        patch_tel["flags"].append("already_applied")
                        patch_tel["error_message"] = "Already Applied: The target file natively matches the desired state."
                        telemetry["summary"]["auto_skipped"] += 1
                        telemetry["patches"].append(patch_tel)
                        continue
                    elif ok_search:
                        resolved_path = cand
                        resolution_type = "pinned_shortcut"

            # Step d & e: Multi-Match Path Scoring
            if not resolved_path and not is_genesis:
                if omniscient_cache is None:
                    omniscient_cache = get_omniscient_workspace_files(workspace_id, allowed_repos)

                basename = Path(target_file).name
                candidates = [cand_rel for f, cand_rel in omniscient_cache if f == basename]

                best_search_cand = None
                best_replace_cand = None
                cand_list = []
                for cand in candidates:
                    cand_content = get_file_content(cand)
                    if cand_content is None: continue
                    ok_search, _, s_status = apply_block_in_memory(cand_content, b, silent=True)
                    if ok_search and s_status == "idempotent":
                        best_replace_cand = cand
                        cand_list.append({"filepath": cand, "score": 1.0, "match_type": "replace_block"})
                    elif ok_search:
                        best_search_cand = cand
                        cand_list.append({"filepath": cand, "score": 1.0, "match_type": "search_block"})

                if len(cand_list) == 1:
                    resolved_path = cand_list[0]["filepath"]
                    resolution_type = "scored_path_auto"

                    if cand_list[0]["match_type"] == "replace_block":
                        patch_tel["status"] = "auto_skipped"
                        patch_tel["flags"].append("already_applied")
                        patch_tel["error_message"] = "Already Applied: The target file natively matches the desired state (Fuzzy Resolved)."
                        telemetry["summary"]["auto_skipped"] += 1
                        telemetry["patches"].append(patch_tel)
                        continue
                elif best_search_cand:
                    confirmed = data.get("confirmed_candidates", {}).get(target_file)
                    if confirmed and any(c["filepath"] == confirmed for c in cand_list):
                        resolved_path = confirmed
                        resolution_type = "confirmed_candidate"
                    else:
                        patch_tel["status"] = "needs_confirmation"
                        patch_tel["resolution_type"] = "scored_path"
                        patch_tel["candidates"] = cand_list
                        patch_tel["available_actions"].extend(["confirm_candidate", "deselect_patch"])
                        telemetry["can_commit"] = False
                        telemetry["summary"]["action_required"] += 1
                        telemetry["patches"].append(patch_tel)
                        continue
                elif best_replace_cand:
                    confirmed = data.get("confirmed_candidates", {}).get(target_file)
                    if confirmed and any(c["filepath"] == confirmed for c in cand_list):
                        resolved_path = confirmed
                        resolution_type = "confirmed_candidate"
                    else:
                        patch_tel["status"] = "needs_confirmation"
                        patch_tel["resolution_type"] = "scored_path"
                        patch_tel["flags"].append("already_applied")
                        patch_tel["candidates"] = cand_list
                        patch_tel["available_actions"].extend(["confirm_candidate", "deselect_patch"])
                        telemetry["can_commit"] = False
                        telemetry["summary"]["action_required"] += 1
                        telemetry["patches"].append(patch_tel)
                        continue
            # Step e.5: Anchor Failure Diff Generation
            if not resolved_path and not is_genesis and content is not None:
                import difflib
                search_lines = expand_macros(b["search"]).replace('\r\n', '\n').replace('\xa0', ' ').split('\n')
                file_lines = content.replace('\r\n', '\n').replace('\xa0', ' ').split('\n')
                matcher = difflib.SequenceMatcher(None, file_lines, search_lines)
                match = matcher.find_longest_match(0, len(file_lines), 0, len(search_lines))
                start_idx = max(0, match.a - match.b)
                end_idx = min(len(file_lines), start_idx + len(search_lines))
                actual_lines = file_lines[start_idx:end_idx]
                diff = list(difflib.ndiff(actual_lines, search_lines))
                diff_str = "\n".join(diff)
                err_b64 = base64.b64encode(diff_str.encode('utf-8')).decode('utf-8')

                patch_tel["status"] = "needs_confirmation"
                patch_tel["resolution_type"] = "anchor_failed"
                patch_tel["error_message"] = "Search anchor failed to match existing file exactly."
                patch_tel["syntax_error"] = err_b64
                patch_tel["available_actions"].extend(["deselect_patch", "offer_deep_search"])
                telemetry["can_commit"] = False
                telemetry["summary"]["action_required"] += 1
                telemetry["patches"].append(patch_tel)
                continue

            # Step f: User-Authorized Deep Search
            if not resolved_path and not is_genesis:
                allow_deep_search = data.get("allow_deep_search", False)
                if not allow_deep_search:
                    patch_tel["status"] = "offer_deep_search"
                    patch_tel["available_actions"].extend(["offer_deep_search", "deselect_patch"])
                    telemetry["can_commit"] = False
                    telemetry["summary"]["action_required"] += 1
                    telemetry["patches"].append(patch_tel)
                    continue
                else:
                    # Execute the Deep Search Algorithm
                    s_lines = [l for l in search_str.split('\n') if len(l.strip()) > 5 and not l.strip().startswith(('import ', 'from ', '{', '}', 'return'))]
                    if s_lines:
                        longest_line = max(s_lines, key=len).strip()
                        if omniscient_cache is None:
                            omniscient_cache = get_omniscient_workspace_files(workspace_id, allowed_repos)

                        cand_list = []
                        for cand_basename, cand_rel in omniscient_cache:
                            cand_content = get_file_content(cand_rel)
                            if cand_content and longest_line in cand_content:
                                ok_search, _, s_status = apply_block_in_memory(cand_content, b, silent=True)
                                if ok_search and s_status != "idempotent":
                                    cand_list.append({"filepath": cand_rel, "score": 1.0, "match_type": "deep_search"})
                        if cand_list:
                            confirmed = data.get("confirmed_candidates", {}).get(target_file)
                            if confirmed and any(c["filepath"] == confirmed for c in cand_list):
                                resolved_path = confirmed
                                resolution_type = "confirmed_candidate"
                            else:
                                patch_tel["status"] = "needs_confirmation"
                                patch_tel["resolution_type"] = "deep_search"
                                patch_tel["candidates"] = cand_list
                                patch_tel["available_actions"].extend(["confirm_candidate", "deselect_patch"])
                                telemetry["can_commit"] = False
                                telemetry["summary"]["action_required"] += 1
                                telemetry["patches"].append(patch_tel)
                                continue

            if not resolved_path:
                patch_tel["status"] = "failed"
                patch_tel["error_message"] = "Resolution failed."
                telemetry["summary"]["failed"] += 1
                telemetry["can_commit"] = False
                telemetry["patches"].append(patch_tel)
                continue

            patch_tel["resolved_file"] = resolved_path
            patch_tel["resolution_type"] = resolution_type
            patch_tel["disk_hash"] = disk_hashes.get(resolved_path)
            
            content = get_file_content(resolved_path) or ""
            
            # Step h: Phase 2 - Patch Safety & Recursion
            if search_str and search_str in replace_str:
                if replace_str in content:
                    patch_tel["status"] = "needs_confirmation"
                    patch_tel["flags"].append("expansion_risk")
                    patch_tel["available_actions"].extend(["confirm_candidate", "deselect_patch"])
                    telemetry["can_commit"] = False
            elif replace_str and replace_str in search_str:
                patch_tel["flags"].append("code_removal")
                
            if patch_tel["status"] == "needs_confirmation":
                telemetry["summary"]["action_required"] += 1
                telemetry["patches"].append(patch_tel)
                continue
            # Apply patch to memory buffer
            ok, new_content, _ = apply_block_in_memory(content, b, silent=True)
            if not ok:
                patch_tel["status"] = "failed"
                patch_tel["error_message"] = "Failed to anchor patch block in memory."
                telemetry["can_commit"] = False
                telemetry["summary"]["failed"] += 1
                telemetry["patches"].append(patch_tel)
                from insetu.kernel.hooks import hooks
                hooks.emit_background('bridge_error', workspace_id=workspace_id, filepath=resolved_path, error_type='patch_failed', details="Failed to anchor patch block in memory.", file_content=content, patch_payload=json.dumps(b))
                continue

            # Step i: Phase 3 - Full-File AST Syntax Gate (Scoped to last chunk)
            ext = os.path.splitext(resolved_path)[1].lower()
            syntax_error = False
            err_str = ""
            is_last_block = (b == blocks[-1])
            if is_last_block and not data.get("ignore_syntax"):
                try:
                    if ext == '.py':
                        ast.parse(new_content)
                    elif ext == '.json':
                        json.loads(new_content)
                    elif ext in ['.js', '.ts']:
                        try:
                            res = subprocess.run(['node', '--input-type=module', '-c'], input=new_content, capture_output=True, text=True, encoding='utf-8')
                            if res.returncode != 0:
                                syntax_error = True
                                err_str = res.stderr.strip()
                        except FileNotFoundError:
                            pass
                except SyntaxError as e:
                    syntax_error = True
                    err_str = f"Line {e.lineno}: {e.msg}"
                except ValueError as e:
                    syntax_error = True
                    err_str = str(e)
                except Exception as e:
                    syntax_error = True
                    err_str = str(e)

                if syntax_error:
                    patch_tel["status"] = "syntax_error"
                    patch_tel["error_message"] = err_str

                    # Generate a clean unified diff of the failed AST block for the UI modal
                    import difflib
                    diff = list(difflib.unified_diff(content.splitlines(), new_content.splitlines(), lineterm=""))
                    diff_str = "\n".join(diff)
                    err_b64 = base64.b64encode(diff_str.encode('utf-8')).decode('utf-8')

                    patch_tel["syntax_error"] = err_b64
                    patch_tel["available_actions"].extend(["ignore_syntax_error", "deselect_patch"])
                    telemetry["can_commit"] = False
                    telemetry["summary"]["action_required"] += 1
                    telemetry["patches"].append(patch_tel)
                    from insetu.kernel.hooks import hooks
                    hooks.emit_background('bridge_error', workspace_id=workspace_id, filepath=resolved_path, error_type='syntax_error', details=err_str, file_content=new_content, patch_payload=json.dumps(b))
                    continue

            # Update memory buffer
            memory_buffers[resolved_path] = new_content
            original_file_keys[resolved_path] = target_file
            patch_tel["status"] = "resolved"
            telemetry["summary"]["resolved"] += 1
            telemetry["patches"].append(patch_tel)
    # Zero-Patch Validation
    if telemetry["summary"]["total_patches"] == 0:
        telemetry["can_commit"] = False
        telemetry["status"] = "failed"
        telemetry["message"] = "No valid or active patches detected in transaction payload."

    # Phase 4 Concurrency Lock: Re-verify physical disk hashes before commit
    if not dry_run and telemetry["can_commit"]:
        for filepath in memory_buffers.keys():
            if original_buffers.get(filepath, "") == memory_buffers.get(filepath, ""):
                continue
            current_on_disk = vfs.read(filepath)
            if current_on_disk is not None:
                current_hash = hashlib.sha256(current_on_disk.encode('utf-8')).hexdigest()
                eval_hash = disk_hashes.get(filepath, "")
                if current_hash != eval_hash:
                    telemetry["can_commit"] = False
                    telemetry["status"] = "failed"
                    telemetry["message"] = f"Concurrency Guard Triggered: '{filepath}' was modified on disk during transaction evaluation."
                    break
    # Phase 4 & 5: Settlement and Ledger Staging
    if not dry_run and telemetry["can_commit"]:
        db_conn = ctx.db
        now_ts = time.time()
        ttl_48h = now_ts + 172800.0  # 48-hour TTL for metronome housekeeping
        mutations = []

        for filepath, final_content in memory_buffers.items():
            orig_content = original_buffers.get(filepath, "")
            if final_content == orig_content:
                continue

            disk_hash = disk_hashes.get(filepath, "")
            post_patch_hash = hashlib.sha256(final_content.encode('utf-8')).hexdigest()
            last_record = db_conn.execute("SELECT post_patch_hash FROM bridge_ledger WHERE filepath=? ORDER BY timestamp DESC LIMIT 1", (filepath,)).fetchone()
            last_known_hash = last_record['post_patch_hash'] if last_record else ""

            # Reliably retrieve original LLM blocks using the resolution mapping
            original_key = original_file_keys.get(filepath)
            file_blocks = parsed_structure.get(original_key, [])
            s_block = "\n".join([b["search"] for b in file_blocks])
            r_block = "\n".join([b["replace"] for b in file_blocks])

            is_snapshot = False
            compressed_state = None

            # 1. The Human Intercept Rule (Manual edits detected)
            if disk_hash != last_known_hash:
                is_snapshot = True

            # 2. Genesis Overwrite Guardrail
            is_genesis = any(not b["search"].strip() for b in file_blocks)
            if is_genesis and orig_content.strip():
                is_snapshot = True

            # 3. The 5-Turn Keyframe Routine
            if not is_snapshot:
                recent_records = db_conn.execute("SELECT is_snapshot FROM bridge_ledger WHERE filepath=? ORDER BY timestamp DESC LIMIT 4", (filepath,)).fetchall()
                if len(recent_records) == 4 and not any(r['is_snapshot'] for r in recent_records):
                    is_snapshot = True

            if is_snapshot:
                compressed_state = zlib.compress(orig_content.encode('utf-8'))
            current_repo = filepath.split('/')[0] if '/' in filepath else ""
            patch_id = f"ptc_{uuid.uuid4().hex[:12]}"
            patch_count = len(file_blocks)
            chunks_json = json.dumps([{"search": b["search"], "replace": b["replace"]} for b in file_blocks])
            db_conn.execute('''
                INSERT INTO bridge_ledger (patch_id, transaction_id, repo, filepath, search_block, replace_block, post_patch_hash, is_snapshot, compressed_state, timestamp, ttl_expires_at, patch_count, chunks_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (patch_id, pid, current_repo, filepath, s_block, r_block, post_patch_hash, 1 if is_snapshot else 0, compressed_state, now_ts, ttl_48h, patch_count, chunks_json))

            # Phase 4: Restore target file EOL format (CRLF drift prevention)
            if '\r\n' in orig_content and '\r\n' not in final_content:
                final_content = final_content.replace('\n', '\r\n')

            vfs.save(filepath, final_content)
            mutations.append({"filepath": filepath, "operation": "save", "ignore_ledger": False})

        db_conn.commit()
        telemetry["status"] = "committed"

        # Broadcast the atomic transaction to the backend Event Bus
        # This guarantees Topology and Hooks awaken even if the target folder isn't covered by the Filesystem Watchdog.
        if mutations:
            from insetu.kernel.hooks import hooks
            hooks.emit_background('vfs_mutated', workspace_id=workspace_id, mutations=mutations)

    elif dry_run:
        telemetry["status"] = "dry_run_evaluated"

    if not telemetry["can_commit"]:
        telemetry["status"] = "action_required" if telemetry["summary"]["action_required"] > 0 else "failed"

    return telemetry

def execute_bridge_sync(workspace_id, data):
    import json
    sister_repos = get_sister_repos(workspace_id)
    _, ws_root, _ = get_workspace_physics(workspace_id)

    try:
        with VFSTransaction(workspace_id) as vfs:
            telemetry = _process_sync_transaction(vfs, workspace_id, data, sister_repos, ws_root)
            return json.dumps(telemetry)
    except Exception as e:
        return json.dumps({
            "transaction_id": "tx_aborted",
            "mode": "live",
            "status": "failed",
            "can_commit": False,
            "message": f"System processing fault: {str(e)}",
            "summary": {"total_patches": 0, "resolved": 0, "auto_skipped": 0, "action_required": 0, "failed": 1},
            "patches": []
        })