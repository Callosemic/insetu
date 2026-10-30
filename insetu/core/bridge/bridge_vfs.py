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
import difflib
import traceback
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from insetu.core.utils_core import get_workspace_physics, get_sister_repos, parse_blocks, InSetuURI
from insetu.core.topology.engine_topology import get_omniscient_workspace_files
from .bridge_fuzzy import (
    apply_block_in_memory,
    apply_textedit_in_memory,
    apply_json_patch_in_memory,
    clean_chevron_meltdown,
    expand_macros,
    heal_llm_block_artifacts,
    is_effectively_identical,
    normalize_patch_payload,
)
from .bridge_ast import apply_ast_relocate_in_memory, apply_ast_rename_to_content, resolve_scope_files

_BANNED_CONTROL_PLANE_FILENAMES = frozenset({
    "host.json",
    "workspaces.json",
    "secrets.json",
    "master_key.txt",
})
def _is_banned_bridge_target(uri: InSetuURI, norm_target: str, extra_protected_Substrings: Optional[ list ] = None) -> Optional[str]:
    base_lower = (uri.basename or "").lower()
    norm_lower = norm_target.replace("\\", "/").lower()
    raw_uri_lower = str(uri).replace("\\", "/").lower()
    parts_lower = [p.lower() for p in norm_lower.split("/") if p]
    # S8 Guarded Write: Refuse agent-originated writes targeting cli.py or fallback_bridge.py
    if base_lower in ("cli.py", "fallback_bridge.py") and ("insetu" in norm_lower or "insetu" in raw_uri_lower):
        return "Kernel Guardrail (S8 Guarded Write): Core CLI and Fallback Bridge files cannot be patched dynamically by agent turns."
    if base_lower in _BANNED_CONTROL_PLANE_FILENAMES or ".git" in parts_lower or base_lower == ".env" or base_lower.startswith(".env."):
        return f"Security Guardrail: Control-plane and credential file '{uri}' cannot be modified via the Yomama Bridge."
    for prot in (extra_protected_Substrings or []):
        if prot and str(prot).lower() in norm_lower:
            return f"Security Guardrail: Protected extension path '{uri}' cannot be modified via the Yomama Bridge."
    return None

try:
    from tree_sitter import Language as _TSLanguage, Parser as _TSParser
except ImportError:
    _TSLanguage = None
    _TSParser = None

try:
    import tree_sitter_python as _ts_python
except ImportError:
    _ts_python = None
try:
    import tree_sitter_javascript as _ts_javascript
except ImportError:
    _ts_javascript = None


def _validate_buffer_syntax(ctx, resolved_path: str, new_content: str) -> Tuple[bool, str]:
    """
    Validates full-buffer syntax for .json, .py, and .js/.ts/.mjs files using
    Tree-sitter (with ast.parse / node --input-type=module -c verification).
    Returns (has_syntax_error, error_message).
    """
    ext = Path(resolved_path).suffix.lower()
    try:
        if ext == '.json':
            json.loads(new_content)
            return False, ""
        if not _TSLanguage or not _TSParser:
            raise ImportError("Tree-sitter core bindings unavailable.")

        lang_mod = None
        if ext == '.py':
            lang_mod = _ts_python
        elif ext in ('.js', '.mjs', '.cjs', '.ts', '.tsx'):
            lang_mod = _ts_javascript

        if lang_mod:
            parser = _TSParser(_TSLanguage(lang_mod.language()))
            tree = parser.parse(bytes(new_content, "utf8"))
            if tree.root_node.has_error:
                if ext == '.py':
                    try:
                        ast.parse(new_content)
                    except SyntaxError as py_err:
                        return True, f"Line {py_err.lineno}: {py_err.msg}"
                elif ext in ('.js', '.ts', '.mjs'):
                    try:
                        res = ctx.exec.run(['node', '--input-type=module', '-c'], input=new_content, encoding='utf-8', timeout=5.0)
                        if res.returncode != 0:
                            return True, res.stderr.strip()
                    except Exception:
                        return True, "Tree-sitter detected a syntax error, and node fallback verification failed."
                else:
                    return True, "Tree-sitter detected a syntax error in the modified AST."
            return False, ""
        raise ImportError("Language not mapped for Tree-sitter.")
    except ImportError:
        if ext == '.py':
            try:
                ast.parse(new_content)
            except SyntaxError as e:
                return True, f"Line {e.lineno}: {e.msg}"
        elif ext in ('.js', '.ts', '.mjs'):
            try:
                res = ctx.exec.run(['node', '--input-type=module', '-c'], input=new_content, encoding='utf-8', timeout=5.0)
                if res.returncode != 0:
                    return True, res.stderr.strip()
            except Exception:
                pass
        return False, ""
    except SyntaxError as e:
        return True, f"Line {e.lineno}: {e.msg}"
    except ValueError as e:
        return True, str(e)
    except Exception as e:
        return True, str(e)


def _process_sync_transaction(vfs, workspace_id, data, sister_repos, ws_root, return_buffers=False):
    from insetu.core.bridge.engine_bridge import bridge_bp as _bridge_bp
    ctx = _bridge_bp.get_context(workspace_id)
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
    deleted_targets = set()
    relocated_pairs = []
    omniscient_cache = None
    original_file_keys = {}
    deferred_failures = []

    def get_file_content(filepath):
        if filepath in memory_buffers: return memory_buffers[filepath]
        content = vfs.read(filepath)
        if content is not None:
            disk_hashes[filepath] = hashlib.sha256(content.encode('utf-8')).hexdigest()
            original_buffers[filepath] = content
            memory_buffers[filepath] = content
        return content
    protected_substrings = []
    try:
        protected_substrings = ctx.emit_merge_list('register_protected_bridge_paths')
    except Exception:
        pass
    resolutions_map = data.get("resolutions") or {}
    confirmed_map = data.get("confirmed_candidates") or {}
    unattended = bool(data.get("unattended", False))

    def _get_cell_resolution(cell_id: Optional[str], file_key: str) -> Dict[str, Any]:
        if cell_id and cell_id in resolutions_map and isinstance(resolutions_map[cell_id], dict):
            return resolutions_map[cell_id]
        if file_key in resolutions_map and isinstance(resolutions_map[file_key], dict):
            return resolutions_map[file_key]
        return {}

    def _is_gate_approved(cell_id: Optional[str], gate_code: str, *file_keys: str) -> bool:
        if data.get("force"):
            return True
        if gate_code == "SYNTAX_ERROR" and (data.get("ignore_syntax") or data.get("ignore_syntax_errors")):
            return True
        res_entry = _get_cell_resolution(cell_id, file_keys[0] if file_keys else "")
        approved = res_entry.get("approved_gate")
        if approved in (gate_code, "*"):
            return True
        for fk in file_keys:
            if fk and fk in confirmed_map:
                return True
        return False

    active_uris = {str(InSetuURI.from_external_input(af)) for af in active_files} | set(active_files)
    patch_index = 0
    for raw_target_file, blocks in parsed_structure.items():
        uri = InSetuURI.from_external_input(raw_target_file)
        target_file = str(uri)
        if active_files and (raw_target_file not in active_uris and target_file not in active_uris) or not blocks:
            continue
        norm_target = f"{uri.repo}/{uri.path}".strip('/') if uri.repo else uri.path
        if target_file.startswith("ws://"):
            telemetry["can_commit"] = False
            patch_tel = {
                "patch_index": patch_index,
                "original_file": target_file,
                "resolved_file": target_file,
                "status": "failed",
                "error_message": "Security Guardrail: Cross-workspace virtual mounts ('ws://') are strictly read-only and cannot be modified via the Yomama Bridge.",
                "flags": ["read_only_mount"],
                "candidates": [],
                "available_actions": []
            }
            patch_index += 1
            telemetry["summary"]["total_patches"] += 1
            telemetry["summary"]["failed"] += 1
            telemetry["patches"].append(patch_tel)
            continue
        ban_reason = _is_banned_bridge_target(uri, norm_target, protected_substrings)
        if ban_reason:
            telemetry["can_commit"] = False
            patch_tel = {
                "patch_index": patch_index,
                "original_file": target_file,
                "resolved_file": target_file,
                "status": "failed",
                "error_message": ban_reason,
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
        explicit_repo = uri.repo if uri.repo else (uri.path.partition('/')[0] if '/' in uri.path else None)
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
        for b_idx, b in enumerate(blocks):
            cell_id = b.get("id")
            cell_res = _get_cell_resolution(cell_id, target_file)
            if "_orig_patch_index" in b:
                assigned_patch_index = b["_orig_patch_index"]
            else:
                assigned_patch_index = patch_index
                patch_index += 1
            patch_tel = {
                "cell_id": cell_id,
                "patch_index": assigned_patch_index,
                "original_file": target_file,
                "resolved_file": None,
                "disk_hash": None,
                "status": "pending",
                "resolution_type": None,
                "flags": [],
                "gate": None,
                "candidates": [],
                "syntax_error": None,
                "error_message": None,
                "available_actions": []
            }
            telemetry["summary"]["total_patches"] += 1
            block_type = b.get("type", "exact")
            if block_type == "relocate":
                src_uri = str(InSetuURI.from_external_input(b.get("source_uri") or target_file))
                dst_uri = str(InSetuURI.from_external_input(b.get("target_uri") or ""))
                sym_name = b.get("symbol", "")
                src_content = get_file_content(src_uri)
                dst_content = get_file_content(dst_uri)
                ok_rel, new_src, new_dst, rel_status = apply_ast_relocate_in_memory(
                    src_content, dst_content, src_uri, dst_uri, sym_name
                )
                if not ok_rel:
                    patch_tel.update({
                        "resolved_file": src_uri,
                        "status": "failed",
                        "resolution_type": "ast_relocate",
                        "error_message": rel_status,
                        "available_actions": ["deselect_patch"],
                    })
                    telemetry["can_commit"] = False
                    telemetry["summary"]["failed"] += 1
                    telemetry["patches"].append(patch_tel)
                    continue
                if rel_status == "idempotent":
                    patch_tel.update({
                        "resolved_file": dst_uri,
                        "status": "auto_skipped",
                        "resolution_type": "ast_relocate",
                        "flags": ["already_applied"],
                        "error_message": f"Already Relocated: '{sym_name}' is already present in '{dst_uri}'.",
                    })
                    telemetry["summary"]["auto_skipped"] += 1
                    telemetry["patches"].append(patch_tel)
                    continue
                memory_buffers[src_uri] = new_src
                memory_buffers[dst_uri] = new_dst
                original_file_keys[src_uri] = raw_target_file
                original_file_keys[dst_uri] = raw_target_file
                patch_tel.update({
                    "resolved_file": f"{src_uri} -> {dst_uri}",
                    "status": "resolved",
                    "resolution_type": "ast_relocate",
                    "flags": [f"relocate:{sym_name}"],
                })
                telemetry["summary"]["resolved"] += 1
                telemetry["patches"].append(patch_tel)
                continue

            if block_type == "rename":
                scope_prefix = b.get("scope_prefix") or raw_target_file
                target_sym = b.get("target_symbol", "")
                new_sym = b.get("new_symbol", "")
                if not target_sym or not new_sym:
                    patch_tel.update({
                        "resolved_file": scope_prefix,
                        "status": "failed",
                        "resolution_type": "ast_rename",
                        "error_message": "RENAME requires TARGET and REPLACE_WITH fields.",
                        "available_actions": ["deselect_patch"],
                    })
                    telemetry["can_commit"] = False
                    telemetry["summary"]["failed"] += 1
                    telemetry["patches"].append(patch_tel)
                    continue
                scoped_files = resolve_scope_files(workspace_id, scope_prefix, allowed_repos=allowed_repos)
                modified_in_rename = []
                for s_fp in scoped_files:
                    s_content = get_file_content(s_fp)
                    if not s_content or target_sym not in s_content:
                        continue
                    renamed_content = apply_ast_rename_to_content(s_fp, s_content, target_sym, new_sym)
                    if renamed_content != s_content:
                        memory_buffers[s_fp] = renamed_content
                        original_file_keys.setdefault(s_fp, raw_target_file)
                        modified_in_rename.append(s_fp)
                if not modified_in_rename:
                    patch_tel.update({
                        "resolved_file": scope_prefix,
                        "status": "auto_skipped",
                        "resolution_type": "ast_rename",
                        "error_message": f"No occurrences of '{target_sym}' found within scope '{scope_prefix}'.",
                    })
                    telemetry["summary"]["auto_skipped"] += 1
                else:
                    patch_tel.update({
                        "resolved_file": modified_in_rename[0] if len(modified_in_rename) == 1 else scope_prefix,
                        "status": "resolved",
                        "resolution_type": "ast_rename",
                        "flags": [f"renamed in {len(modified_in_rename)} file(s)"],
                    })
                    telemetry["summary"]["resolved"] += 1
                telemetry["patches"].append(patch_tel)
                continue

            if block_type in ("move_file", "archive_file", "delete_file"):
                src_uri_obj = InSetuURI.from_external_input(b.get("source_uri") or target_file)
                src_uri = str(src_uri_obj)
                src_ban = _is_banned_bridge_target(src_uri_obj, f"{src_uri_obj.repo}/{src_uri_obj.path}".strip("/"), protected_substrings)
                if src_ban:
                    patch_tel.update({
                        "resolved_file": src_uri,
                        "status": "failed",
                        "resolution_type": block_type,
                        "error_message": src_ban,
                        "flags": ["banned_target"],
                    })
                    telemetry["can_commit"] = False
                    telemetry["summary"]["failed"] += 1
                    telemetry["patches"].append(patch_tel)
                    continue

                src_content = get_file_content(src_uri)
                if src_content is None:
                    patch_tel.update({
                        "resolved_file": src_uri,
                        "status": "failed",
                        "resolution_type": block_type,
                        "error_message": f"Source file '{src_uri}' not found on disk.",
                        "available_actions": ["deselect_patch"],
                    })
                    telemetry["can_commit"] = False
                    telemetry["summary"]["failed"] += 1
                    telemetry["patches"].append(patch_tel)
                    continue
                if block_type == "delete_file":
                    # Interactive UI commits (unattended=False) where the operator explicitly staged and clicked Patch
                    # are pre-authorized; unattended agent turns or dry-run previews surface the DESTRUCTIVE_DELETE gate.
                    is_confirmed_del = (not unattended and not dry_run and not data.get("require_delete_confirmation", False)) or _is_gate_approved(
                        cell_id, "DESTRUCTIVE_DELETE", target_file, src_uri
                    )
                    if not is_confirmed_del:
                        patch_tel.update({
                            "resolved_file": src_uri,
                            "status": "needs_confirmation",
                            "resolution_type": "confirm_delete",
                            "error_message": f"High-Consequence Action: Confirm permanent deletion of '{src_uri}' (snapshot will be saved in bridge_ledger for /undo).",
                            "flags": ["confirm_delete"],
                            "gate": {
                                "code": "DESTRUCTIVE_DELETE",
                                "target_uri": src_uri,
                                "reason": f"Confirm permanent deletion of '{src_uri}'.",
                            },
                            "available_actions": ["approve_gate", "deselect_patch"],
                        })
                        telemetry["can_commit"] = False
                        telemetry["summary"]["action_required"] += 1
                        telemetry["patches"].append(patch_tel)
                        continue
                    memory_buffers[src_uri] = ""
                    deleted_targets.add(src_uri)
                    original_file_keys[src_uri] = raw_target_file
                    patch_tel.update({
                        "resolved_file": src_uri,
                        "status": "resolved",
                        "resolution_type": "delete_file",
                        "flags": ["delete_file"],
                    })
                    telemetry["summary"]["resolved"] += 1
                    telemetry["patches"].append(patch_tel)
                    continue

                if block_type == "archive_file":
                    parent_path = src_uri_obj.path.rpartition('/')[0] if '/' in src_uri_obj.path else ''
                    new_rel = f"archived/{src_uri_obj.basename}" if not parent_path or parent_path == '.' else f"{parent_path}/archived/{src_uri_obj.basename}"
                    scheme = src_uri_obj.scheme or "vfs"
                    dst_uri = f"{scheme}://{src_uri_obj.repo}/{new_rel}" if src_uri_obj.repo else f"{scheme}://{new_rel}"
                else:
                    dst_uri_obj = InSetuURI.from_external_input(b.get("target_uri") or "")
                    dst_uri = str(dst_uri_obj)
                    dst_ban = _is_banned_bridge_target(dst_uri_obj, f"{dst_uri_obj.repo}/{dst_uri_obj.path}".strip("/"), protected_substrings)
                    if dst_ban:
                        patch_tel.update({
                            "resolved_file": dst_uri,
                            "status": "failed",
                            "resolution_type": block_type,
                            "error_message": dst_ban,
                            "flags": ["banned_target"],
                        })
                        telemetry["can_commit"] = False
                        telemetry["summary"]["failed"] += 1
                        telemetry["patches"].append(patch_tel)
                        continue

                if not dst_uri or dst_uri == src_uri:
                    patch_tel.update({
                        "resolved_file": src_uri,
                        "status": "failed",
                        "resolution_type": block_type,
                        "error_message": f"{block_type.upper()} requires a valid destination URI.",
                        "available_actions": ["deselect_patch"],
                    })
                    telemetry["can_commit"] = False
                    telemetry["summary"]["failed"] += 1
                    telemetry["patches"].append(patch_tel)
                    continue

                get_file_content(dst_uri)
                memory_buffers[src_uri] = ""
                memory_buffers[dst_uri] = src_content
                deleted_targets.add(src_uri)
                relocated_pairs.append((src_uri, dst_uri))
                original_file_keys[src_uri] = raw_target_file
                original_file_keys[dst_uri] = raw_target_file
                patch_tel.update({
                    "resolved_file": f"{src_uri} -> {dst_uri}",
                    "status": "resolved",
                    "resolution_type": block_type,
                    "flags": [f"{block_type}:{InSetuURI(dst_uri).basename}"],
                })
                telemetry["summary"]["resolved"] += 1
                telemetry["patches"].append(patch_tel)
                continue

            if block_type == "json_patch":
                content = get_file_content(target_file)
                if content is None:
                    patch_tel.update({
                        "resolved_file": target_file,
                        "status": "failed",
                        "resolution_type": "json_patch",
                        "error_message": f"Target file '{target_file}' not found for JSON_PATCH.",
                        "available_actions": ["deselect_patch"],
                    })
                    telemetry["can_commit"] = False
                    telemetry["summary"]["failed"] += 1
                    telemetry["patches"].append(patch_tel)
                    continue
                ok_jp, new_jp_content, jp_status = apply_json_patch_in_memory(target_file, content, b, silent=True)
                if not ok_jp:
                    patch_tel.update({
                        "resolved_file": target_file,
                        "status": "failed",
                        "resolution_type": "json_patch",
                        "error_message": jp_status,
                        "available_actions": ["deselect_patch"],
                    })
                    telemetry["can_commit"] = False
                    telemetry["summary"]["failed"] += 1
                    telemetry["patches"].append(patch_tel)
                    continue
                if jp_status == "idempotent":
                    patch_tel.update({
                        "resolved_file": target_file,
                        "status": "auto_skipped",
                        "resolution_type": "json_patch",
                        "flags": ["already_applied"],
                        "error_message": "Already Applied: Target object tree already matches JSON_PATCH state.",
                    })
                    telemetry["summary"]["auto_skipped"] += 1
                    telemetry["patches"].append(patch_tel)
                    continue
                b["search"] = content
                b["replace"] = new_jp_content
                memory_buffers[target_file] = new_jp_content
                original_file_keys[target_file] = raw_target_file
                patch_tel.update({
                    "resolved_file": target_file,
                    "status": "resolved",
                    "resolution_type": "json_patch",
                    "flags": ["json_patch"],
                })
                telemetry["summary"]["resolved"] += 1
                telemetry["patches"].append(patch_tel)
                continue
            content = get_file_content(target_file)
            search_str = normalize_patch_payload(b["search"], reference_content=content or "")
            replace_str = normalize_patch_payload(b["replace"], reference_content=content or "")
            is_genesis = not search_str.strip()

            # --- Chain of Responsibility Pipeline ---
            class ResolutionContext:
                def __init__(self):
                    self.resolved_path = None
                    self.resolution_type = None
                    self.handled = False

            pctx = ResolutionContext()
            def resolve_confirmed():
                confirmed = cell_res.get("selected_uri") or confirmed_map.get(target_file)
                if confirmed:
                    cand_uri = str(InSetuURI.from_external_input(confirmed))
                    if is_genesis:
                        pctx.resolved_path = cand_uri
                        pctx.resolution_type = "confirmed_candidate"
                        pctx.handled = True
                        return
                    cand_content = get_file_content(cand_uri)
                    if cand_content is not None:
                        apply_fn = apply_textedit_in_memory if block_type == "textedit" else apply_block_in_memory
                        ok_s, _, s_stat = apply_fn(cand_content, b, silent=True)
                        if ok_s:
                            if s_stat == "idempotent":
                                patch_tel.update({
                                    "resolved_file": cand_uri,
                                    "status": "auto_skipped",
                                    "error_message": "Already Applied: The target file natively matches the desired state.",
                                })
                                patch_tel["flags"].append("already_applied")
                                telemetry["summary"]["auto_skipped"] += 1
                            else:
                                pctx.resolved_path = cand_uri
                                pctx.resolution_type = "confirmed_candidate"
                            pctx.handled = True
                        elif len(blocks) > 1 and not b.get("_is_deferred_retry"):
                            pctx.resolved_path = cand_uri
                            pctx.resolution_type = "deferred_overlap"
                            pctx.handled = True
                        else:
                            pctx.resolved_path = cand_uri
                            pctx.resolution_type = "confirmed_candidate"
                            pctx.handled = True

            def resolve_noop():
                if is_effectively_identical(search_str.split('\n'), replace_str.split('\n')):
                    patch_tel.update({"status": "auto_skipped", "error_message": "No-Op: The SEARCH and REPLACE blocks are perfectly identical."})
                    telemetry["summary"]["auto_skipped"] += 1
                    pctx.handled = True
            def _enforce_genesis_overwrite_gate(resolved_uri: str) -> bool:
                if not resolved_uri:
                    return False
                if get_file_content(resolved_uri) is not None and not _is_gate_approved(
                    cell_id, "OVERWRITE_EXISTING", target_file, resolved_uri
                ):
                    patch_tel.update({
                        "resolved_file": resolved_uri,
                        "status": "needs_confirmation",
                        "resolution_type": "genesis_overwrite",
                        "error_message": f"File '{resolved_uri}' already exists on disk. Confirm to overwrite.",
                        "gate": {
                            "code": "OVERWRITE_EXISTING",
                            "target_uri": resolved_uri,
                            "reason": f"File '{resolved_uri}' already exists on disk.",
                        },
                        "candidates": [{"filepath": resolved_uri, "score": 1.0, "match_type": "overwrite"}],
                    })
                    patch_tel["flags"].append("confirm-to-overwrite")
                    patch_tel["available_actions"].extend(["approve_gate", "confirm_candidate", "deselect_patch"])
                    telemetry["can_commit"] = False
                    telemetry["summary"]["action_required"] += 1
                    return True
                return False

            def resolve_genesis():
                nonlocal omniscient_cache
                if not is_genesis: return
                explicit_repo = uri.repo if uri.repo else (uri.path.partition('/')[0] if '/' in uri.path else None)
                if explicit_repo in allowed_repos:
                    pctx.resolved_path = target_file
                    pctx.resolution_type = "genesis"
                    pctx.handled = True
                    _enforce_genesis_overwrite_gate(target_file)
                    return

                if omniscient_cache is None:
                    omniscient_cache = get_omniscient_workspace_files(workspace_id, allowed_repos)

                target_path_obj = Path(norm_target)
                target_dirname = target_path_obj.parent.as_posix()
                if target_dirname == '.': target_dirname = ''
                target_basename = target_path_obj.name

                cand_list = []
                if target_dirname:
                    known_dirs = set()
                    for _, cand_fp in omniscient_cache:
                        c_uri = InSetuURI(cand_fp)
                        c_rel = f"{c_uri.repo}/{c_uri.path}".strip('/') if c_uri.repo else c_uri.path
                        cand_parent = Path(c_rel).parent.as_posix()
                        known_dirs.add(cand_parent if cand_parent != '.' else '')
                    target_dir_suffix = target_dirname if target_dirname.startswith('/') else '/' + target_dirname
                    for kd in known_dirs:
                        if kd == target_dirname or kd.endswith(target_dir_suffix):
                            cand_list.append({"filepath": f"vfs://{kd}/{target_basename}", "score": 0.9, "match_type": "genesis_guess"})

                if not cand_list and len(allowed_repos) == 1:
                    cand_list.append({"filepath": f"vfs://{allowed_repos[0]}/{norm_target}", "score": 1.0, "match_type": "genesis_pinned"})
                if cand_list:
                    patch_tel.update({"status": "needs_confirmation", "resolution_type": "genesis_guess", "candidates": cand_list})
                    patch_tel["available_actions"].extend(["confirm_candidate", "deselect_patch"])
                    telemetry["can_commit"] = False
                    telemetry["summary"]["action_required"] += 1
                    pctx.handled = True
                else:
                    patch_tel.update({"status": "failed", "error_message": "Genesis patch missing valid repository anchor, and path fragment could not be uniquely matched."})
                    telemetry["summary"]["failed"] += 1
                    telemetry["can_commit"] = False
                    pctx.handled = True
            def resolve_direct_match():
                if content is not None:
                    apply_fn = apply_textedit_in_memory if block_type == "textedit" else apply_block_in_memory
                    ok_search, _, s_status = apply_fn(content, b, silent=True)
                    if ok_search:
                        if s_status == "idempotent":
                            patch_tel.update({"resolved_file": target_file, "status": "auto_skipped", "error_message": "Already Applied: The target file natively matches the desired state."})
                            patch_tel["flags"].append("already_applied")
                            telemetry["summary"]["auto_skipped"] += 1
                        else:
                            pctx.resolved_path = target_file
                            pctx.resolution_type = "direct_match"
                        pctx.handled = True
            def resolve_pinned_shortcut():
                if len(allowed_repos) == 1:
                    cand = f"vfs://{allowed_repos[0]}/{norm_target}"
                    cand_content = get_file_content(cand)
                    if cand_content is not None:
                        ok_search, _, s_status = apply_block_in_memory(cand_content, b, silent=True)
                        if ok_search:
                            if s_status == "idempotent":
                                patch_tel.update({"resolved_file": cand, "status": "auto_skipped", "error_message": "Already Applied: The target file natively matches the desired state."})
                                patch_tel["flags"].append("already_applied")
                                telemetry["summary"]["auto_skipped"] += 1
                            else:
                                pctx.resolved_path = cand
                                pctx.resolution_type = "pinned_shortcut"
                            pctx.handled = True
            def resolve_fuzzy_path():
                raw_candidates = ctx.find_path_candidates(target_file, allowed_repos=allowed_repos)
                candidates = [c["filepath"] for c in raw_candidates if c["score"] >= 0.8]
                best_search_cand = None
                best_replace_cand = None
                cand_list = []

                for cand in candidates:
                    cand_content = get_file_content(cand)
                    if cand_content is None: continue
                    ok_search, _, s_status = apply_block_in_memory(cand_content, b, silent=True)
                    if ok_search:
                        if s_status == "idempotent":
                            best_replace_cand = cand
                            cand_list.append({"filepath": cand, "score": 1.0, "match_type": "replace_block"})
                        else:
                            best_search_cand = cand
                            cand_list.append({"filepath": cand, "score": 1.0, "match_type": "search_block"})

                if len(cand_list) == 1:
                    pctx.resolved_path = cand_list[0]["filepath"]
                    pctx.resolution_type = "scored_path_auto"
                    if cand_list[0]["match_type"] == "replace_block":
                        patch_tel.update({"resolved_file": pctx.resolved_path, "status": "auto_skipped", "error_message": "Already Applied: The target file natively matches the desired state (Fuzzy Resolved)."})
                        patch_tel["flags"].append("already_applied")
                        telemetry["summary"]["auto_skipped"] += 1
                    pctx.handled = True
                elif best_search_cand or best_replace_cand:
                    patch_tel.update({"status": "needs_confirmation", "resolution_type": "scored_path", "candidates": cand_list})
                    if best_replace_cand: patch_tel["flags"].append("already_applied")
                    patch_tel["available_actions"].extend(["confirm_candidate", "deselect_patch"])
                    telemetry["can_commit"] = False
                    telemetry["summary"]["action_required"] += 1
                    pctx.handled = True
            effective_deep_search = bool(data.get("allow_deep_search") or cell_res.get("allow_deep_search"))
            def resolve_anchor_failure():
                if content is not None and not effective_deep_search:
                    apply_fn_probe = apply_textedit_in_memory if block_type == "textedit" else apply_block_in_memory
                    _, _, probe_status = apply_fn_probe(content, b, silent=True)
                    if isinstance(probe_status, str) and probe_status.startswith("ambiguous:"):
                        amb_lines = probe_status.split(":", 1)[1]
                        patch_tel.update({
                            "resolved_file": target_file,
                            "status": "needs_confirmation",
                            "resolution_type": "ambiguous_anchor",
                            "error_message": f"Ambiguous Search Anchor: SEARCH block matched multiple locations in '{target_file}' (lines {amb_lines}). Add 1-2 lines of surrounding context to disambiguate.",
                            "flags": ["ambiguous_anchor"],
                            "available_actions": ["deselect_patch"],
                        })
                        telemetry["can_commit"] = False
                        telemetry["summary"]["action_required"] += 1
                        deferred_failures.append({
                            "filepath": target_file,
                            "raw_target_file": raw_target_file,
                            "block": b,
                            "patch_tel": patch_tel,
                        })
                        pctx.handled = True
                        return
                    if len(blocks) > 1 and not b.get("_is_deferred_retry"):
                        pctx.resolved_path = target_file
                        pctx.resolution_type = "deferred_overlap"
                        pctx.handled = True
                        return
                    search_lines = search_str.replace('\r\n', '\n').replace('\xa0', ' ').split('\n')
                    file_lines = content.replace('\r\n', '\n').replace('\xa0', ' ').split('\n')
                    matcher = difflib.SequenceMatcher(None, file_lines, search_lines)
                    match = matcher.find_longest_match(0, len(file_lines), 0, len(search_lines))
                    start_idx = max(0, match.a - match.b)
                    end_idx = min(len(file_lines), start_idx + len(search_lines))
                    actual_lines = file_lines[start_idx:end_idx]
                    diff = list(difflib.ndiff(search_lines, actual_lines))
                    err_b64 = base64.b64encode(("\n".join(diff)).encode('utf-8')).decode('utf-8')
                    anchor_b64 = base64.b64encode(("\n".join(actual_lines)).encode('utf-8')).decode('utf-8')

                    patch_tel.update({
                        "resolved_file": target_file,
                        "status": "needs_confirmation", "resolution_type": "anchor_failed", 
                        "error_message": "Search anchor failed to match existing file exactly.", 
                        "syntax_error": err_b64, "actual_anchor": anchor_b64
                    })
                    patch_tel["available_actions"].extend(["heal_anchor", "deselect_patch", "offer_deep_search"])
                    telemetry["can_commit"] = False
                    telemetry["summary"]["action_required"] += 1
                    deferred_failures.append({
                        "filepath": target_file,
                        "raw_target_file": raw_target_file,
                        "block": b,
                        "patch_tel": patch_tel,
                    })
                    pctx.handled = True
            def resolve_deep_search():
                nonlocal omniscient_cache
                if not effective_deep_search:
                    patch_tel.update({"status": "offer_deep_search"})
                    patch_tel["available_actions"].extend(["offer_deep_search", "deselect_patch"])
                    telemetry["can_commit"] = False
                    telemetry["summary"]["action_required"] += 1
                    pctx.handled = True
                    return

                s_lines = [l for l in search_str.split('\n') if len(l.strip()) > 5 and not l.strip().startswith(('import ', 'from ', '{', '}', 'return'))]
                if s_lines:
                    longest_line = max(s_lines, key=len).strip()
                    if omniscient_cache is None:
                        omniscient_cache = get_omniscient_workspace_files(workspace_id, allowed_repos)
                    cand_list = []
                    for cand_basename, cand_fp in omniscient_cache:
                        cand_uri = str(InSetuURI(cand_fp))
                        cand_content = get_file_content(cand_uri)
                        if cand_content and longest_line in cand_content:
                            ok_search, _, s_status = apply_block_in_memory(cand_content, b, silent=True)
                            if ok_search and s_status != "idempotent":
                                cand_list.append({"filepath": cand_uri, "score": 1.0, "match_type": "deep_search"})
                    if cand_list:
                        patch_tel.update({"status": "needs_confirmation", "resolution_type": "deep_search", "candidates": cand_list})
                        patch_tel["available_actions"].extend(["confirm_candidate", "deselect_patch"])
                        telemetry["can_commit"] = False
                        telemetry["summary"]["action_required"] += 1
                        pctx.handled = True
            # Execute the Chain of Responsibility (resolve_noop MUST run first so identical S/R blocks never fall through)
            for resolver in [resolve_noop, resolve_confirmed, resolve_genesis, resolve_direct_match, resolve_pinned_shortcut, resolve_fuzzy_path, resolve_anchor_failure, resolve_deep_search]:
                resolver()
                if pctx.handled:
                    break
            if pctx.resolution_type == "deferred_overlap":
                b_copy = dict(b)
                b_copy["_is_deferred_retry"] = True
                b_copy["_orig_patch_index"] = assigned_patch_index
                blocks.append(b_copy)
                telemetry["summary"]["total_patches"] -= 1
                continue

            if patch_tel["status"] in ("auto_skipped", "needs_confirmation"):
                telemetry["patches"].append(patch_tel)
                continue

            resolved_path = pctx.resolved_path
            resolution_type = pctx.resolution_type

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
            is_confirmed_override = _is_gate_approved(cell_id, "EXPANSION_RISK", target_file, resolved_path)
            if search_str and search_str != replace_str and search_str in replace_str:
                if replace_str in content and not is_confirmed_override:
                    patch_tel["status"] = "needs_confirmation"
                    patch_tel["error_message"] = "Expansion Risk: The replacement block already exists in this file and contains the search block. Confirm to apply anyway."
                    patch_tel["flags"].append("expansion_risk")
                    patch_tel["gate"] = {
                        "code": "EXPANSION_RISK",
                        "target_uri": resolved_path,
                        "reason": "Replacement block already exists in target file.",
                    }
                    patch_tel["candidates"] = [{"filepath": resolved_path, "score": 1.0, "match_type": "expansion_override"}]
                    patch_tel["available_actions"].extend(["approve_gate", "confirm_candidate", "deselect_patch"])
                    telemetry["can_commit"] = False
            elif replace_str and replace_str != search_str and replace_str in search_str:
                patch_tel["flags"].append("code_removal")
                
            if patch_tel["status"] == "needs_confirmation":
                telemetry["summary"]["action_required"] += 1
                telemetry["patches"].append(patch_tel)
                continue
            # Apply patch to memory buffer
            apply_fn = apply_textedit_in_memory if block_type == "textedit" else apply_block_in_memory
            ok, new_content, _ = apply_fn(content, b, silent=True)
            if not ok:
                search_lines = search_str.replace('\r\n', '\n').replace('\xa0', ' ').split('\n')
                file_lines = content.replace('\r\n', '\n').replace('\xa0', ' ').split('\n')
                matcher = difflib.SequenceMatcher(None, file_lines, search_lines)
                match = matcher.find_longest_match(0, len(file_lines), 0, len(search_lines))
                start_idx = max(0, match.a - match.b)
                end_idx = min(len(file_lines), start_idx + len(search_lines))
                actual_lines = file_lines[start_idx:end_idx]
                diff = list(difflib.ndiff(search_lines, actual_lines))
                err_b64 = base64.b64encode(("\n".join(diff)).encode('utf-8')).decode('utf-8')

                patch_tel["status"] = "failed"
                patch_tel["error_message"] = "Failed to anchor patch block in memory."
                patch_tel["syntax_error"] = err_b64
                patch_tel["available_actions"].append("deselect_patch")
                telemetry["can_commit"] = False
                telemetry["summary"]["failed"] += 1
                telemetry["patches"].append(patch_tel)
                ctx.emit_background('bridge_error', filepath=resolved_path, error_type='patch_failed', details="Failed to anchor patch block in memory.", file_content=content, patch_payload=json.dumps(b))
                continue
            # Step i: Phase 3 - Incremental Per-Chunk AST Syntax Gate (With Lookahead Forgiveness)
            if not _is_gate_approved(cell_id, "SYNTAX_ERROR", target_file, resolved_path):
                syntax_error, err_str = _validate_buffer_syntax(ctx, resolved_path, new_content)
                if syntax_error and b_idx < len(blocks) - 1:
                    # Lookahead check: if subsequent chunks in the same file heal a split syntactic construct, allow this chunk
                    lookahead_buf = new_content
                    for rem_b in blocks[b_idx + 1:]:
                        rem_fn = apply_textedit_in_memory if rem_b.get("type") == "textedit" else apply_block_in_memory
                        ok_rem, next_buf, _ = rem_fn(lookahead_buf, rem_b, silent=True)
                        if ok_rem:
                            lookahead_buf = next_buf
                    healed_later_err, _ = _validate_buffer_syntax(ctx, resolved_path, lookahead_buf)
                    if not healed_later_err:
                        syntax_error = False

                if syntax_error:
                    patch_tel["status"] = "syntax_error"
                    patch_tel["error_message"] = err_str
                    diff = list(difflib.unified_diff(content.splitlines(), new_content.splitlines(), lineterm=""))
                    diff_str = "\n".join(diff)
                    err_b64 = base64.b64encode(diff_str.encode('utf-8')).decode('utf-8')
                    patch_tel["syntax_error"] = err_b64
                    patch_tel["gate"] = {
                        "code": "SYNTAX_ERROR",
                        "target_uri": resolved_path,
                        "reason": err_str,
                    }
                    patch_tel["available_actions"].extend(["approve_gate", "ignore_syntax_error", "deselect_patch"])
                    telemetry["can_commit"] = False
                    telemetry["summary"]["action_required"] += 1
                    deferred_failures.append({
                        "filepath": resolved_path,
                        "raw_target_file": raw_target_file,
                        "block": b,
                        "patch_tel": patch_tel,
                    })
                    telemetry["patches"].append(patch_tel)
                    ctx.emit_background('bridge_error', filepath=resolved_path, error_type='syntax_error', details=err_str, file_content=new_content, patch_payload=json.dumps(b))
                    continue

            # Update memory buffer
            memory_buffers[resolved_path] = new_content
            original_file_keys[resolved_path] = target_file
            patch_tel["status"] = "resolved"
            telemetry["summary"]["resolved"] += 1
            telemetry["patches"].append(patch_tel)
    telemetry["patches"].sort(key=lambda p: p.get("patch_index", 0))

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
        created_file_comments: Dict[str, str] = {}

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
            # 2. Genesis Overwrite Guardrail & Deletion Snapshot Guarantee
            is_genesis = any(not b["search"].strip() for b in file_blocks)
            if (is_genesis and orig_content.strip()) or filepath in deleted_targets:
                is_snapshot = True
            if is_genesis and not orig_content.strip() and filepath not in deleted_targets:
                genesis_comment = next((b.get("comment", "").strip() for b in file_blocks if not b["search"].strip() and b.get("comment", "").strip()), "")
                if genesis_comment:
                    created_file_comments[filepath] = genesis_comment

            # 3. The 5-Turn Keyframe Routine
            if not is_snapshot:
                recent_records = db_conn.execute("SELECT is_snapshot FROM bridge_ledger WHERE filepath=? ORDER BY timestamp DESC LIMIT 4", (filepath,)).fetchall()
                if len(recent_records) == 4 and not any(r['is_snapshot'] for r in recent_records):
                    is_snapshot = True
            if is_snapshot:
                compressed_state = zlib.compress(orig_content.encode('utf-8'))
            file_uri = InSetuURI(filepath)
            current_repo = file_uri.repo if file_uri.repo else (file_uri.path.partition('/')[0] if '/' in file_uri.path else "")
            patch_id = f"ptc_{uuid.uuid4().hex[:12]}"
            patch_count = max(1, len(file_blocks))
            if filepath in deleted_targets:
                chunks_json = json.dumps([{
                    "comment": (file_blocks[0].get("comment", "") if file_blocks else "File deleted/relocated"),
                    "type": "delete_file",
                    "search": orig_content,
                    "replace": "",
                }])
            else:
                chunks_json = json.dumps([{
                    "comment": b.get("comment", ""),
                    "type": b.get("type", "exact"),
                    "search": b["search"], 
                    "replace": b["replace"]
                } for b in file_blocks])
            db_conn.execute('''
                INSERT INTO bridge_ledger (patch_id, transaction_id, repo, filepath, search_block, replace_block, post_patch_hash, is_snapshot, compressed_state, timestamp, ttl_expires_at, patch_count, chunks_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (patch_id, pid, current_repo, filepath, s_block, r_block, post_patch_hash, 1 if is_snapshot else 0, compressed_state, now_ts, ttl_48h, patch_count, chunks_json))
            if filepath in deleted_targets:
                vfs.delete(filepath)
            else:
                # Phase 4: Restore target file EOL format (CRLF drift prevention)
                if '\r\n' in orig_content and '\r\n' not in final_content:
                    final_content = final_content.replace('\n', '\r\n')
                vfs.save(filepath, final_content)

        db_conn.commit()
        telemetry["status"] = "committed"
        if created_file_comments:
            # New files carry their genesis COMMENT so the Cartographer can describe them in CODE_INDEX.md
            try:
                ctx.emit('bridge_files_created', descriptions=created_file_comments)
            except Exception as e:
                print(f"⚠️ [Bridge] Could not publish new-file descriptions: {e}")

    elif dry_run:
        telemetry["status"] = "dry_run_evaluated"
    if not telemetry["can_commit"]:
        telemetry["status"] = "action_required" if telemetry["summary"]["action_required"] > 0 else "failed"

    if return_buffers:
        return telemetry, memory_buffers, deferred_failures
    return telemetry
def execute_bridge_sync(workspace_id, data):
    from insetu.core.bridge.engine_bridge import bridge_bp as _bridge_bp
    ctx = _bridge_bp.get_context(workspace_id)
    sister_repos = get_sister_repos(workspace_id)
    _, ws_root = get_workspace_physics(workspace_id)

    try:
        with ctx.vfs as vfs:
            telemetry = _process_sync_transaction(vfs, workspace_id, data, sister_repos, ws_root)
            return json.dumps(telemetry)
    except Exception as e:
        return json.dumps({
            "transaction_id": "tx_aborted",
            "mode": "live",
            "status": "failed",
            "can_commit": False,
            "message": f"System processing fault:\n{traceback.format_exc()}",
            "summary": {"total_patches": 0, "resolved": 0, "auto_skipped": 0, "action_required": 0, "failed": 1},
            "patches": []
        })