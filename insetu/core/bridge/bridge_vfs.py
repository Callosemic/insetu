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
from collections import OrderedDict
import copy
import threading

from typing import Any, Dict, Iterable, List, Optional, Set, Tuple
from insetu.core.utils_core import compute_vfs_sha256, get_workspace_physics, get_sister_repos, InSetuURI
from insetu.core.sdk import is_protected_vfs_target
from insetu.core.protected_changes import REFERENCE_KEY as _PROTECTED_REFERENCE_KEY, SOURCE_KEY as _PROTECTED_SOURCE_KEY
from insetu.core.languages import PythonLanguageProvider
from insetu.core.topology.engine_topology import get_omniscient_workspace_files
from .parser import LEDGER_CHUNK_TYPES, compute_block_signature, flatten_parsed_blocks, parse_blocks
from .bridge_fuzzy import (
    apply_block_in_memory,
    apply_textedit_in_memory,
    apply_json_patch_in_memory,
    expand_macros,
    heal_chevron_meltdown,
    has_distinctive_anchor_line,
    heal_llm_block_artifacts,
    is_effectively_identical,
    locate_closest_window,
    normalize_patch_payload,
    rebase_overlapping_block_in_memory,
)
from .bridge_ast import apply_ast_relocate_in_memory, apply_ast_rename_to_content, resolve_scope_files

# ==============================================================================
# TWO-TIER CONTENT-ADDRESSED SIGNATURE MEMOIZATION CACHE
# ==============================================================================
_EVAL_CACHE_LOCK = threading.Lock()
_FILE_EVAL_CACHE: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
_PATCH_EVAL_CACHE: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
MAX_FILE_EVAL_CACHE_SIZE = 256
MAX_PATCH_EVAL_CACHE_SIZE = 1024


def clear_bridge_eval_cache() -> None:
    """Clears the in-memory content-addressed FileEvalSig and PatchEvalSig caches."""
    with _EVAL_CACHE_LOCK:
        _FILE_EVAL_CACHE.clear()
        _PATCH_EVAL_CACHE.clear()


def compute_file_eval_signature(
    workspace_id: str,
    target_file: str,
    disk_hash: Optional[str],
    blocks: List[Dict[str, Any]],
    resolutions_for_file: Dict[str, Any],
    flags_tuple: Tuple[Any, ...],
    resolved_pointer: Optional[str] = None,
) -> str:
    """
    Tier 1 Per-File Bundle Signature (FileEvalSig):
    Pure function of the resolved file pointer, its on-disk SHA-256 hash, the ordered list of active patch blocks,
    and any user resolution decisions for this file.
    """
    block_sigs = [
        {
            "id": b.get("id") or "",
            "sig": compute_block_signature(b, resolutions_for_file.get(b.get("id") or "")),
        }
        for b in (blocks or [])
    ]
    payload = {
        "ws": workspace_id,
        "file": target_file,
        "pointer": resolved_pointer or target_file,
        "disk_hash": disk_hash if disk_hash is not None else "__MISSING__",
        "blocks": block_sigs,
        "file_res": resolutions_for_file.get(target_file) or {},
        "flags": list(flags_tuple),
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def compute_patch_eval_signature(
    resolved_path: str,
    input_buffer_hash: str,
    orig_disk_hash: str,
    block: Dict[str, Any],
    cell_res: Dict[str, Any],
) -> str:
    """
    Tier 2 Intra-File Sequential Chunk Signature (PatchEvalSig):
    Models a single chunk evaluation as a pure state transition from `input_buffer_hash` -> `output_buffer_hash`.
    """
    blk_sig = compute_block_signature(block, cell_res)
    raw = f"{resolved_path}||{input_buffer_hash}||{orig_disk_hash}||{blk_sig}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _cache_get(cache_obj: OrderedDict, key: str) -> Optional[Dict[str, Any]]:
    with _EVAL_CACHE_LOCK:
        val = cache_obj.get(key)
        if val is not None:
            cache_obj.move_to_end(key)
            return copy.deepcopy(val)
    return None


def _cache_put(cache_obj: OrderedDict, key: str, value: Dict[str, Any], max_size: int) -> None:
    with _EVAL_CACHE_LOCK:
        cache_obj[key] = copy.deepcopy(value)
        cache_obj.move_to_end(key)
        while len(cache_obj) > max_size:
            cache_obj.popitem(last=False)

_BANNED_CONTROL_PLANE_FILENAMES = frozenset({
    "host.json",
    "workspaces.json",
    "secrets.json",
    "master_key.txt",
    "attestations.json",
})
# Protected files (the recovery path) may be patched or deleted: the change waits for a person's confirmation (S8).
PROTECTED_CONFIRMATION_FLAG = "protected_needs_confirmation"


class FileTimeline:
    """
    Single Source of Truth for one file's state progression B_0 -> B_1 -> ... -> B_m across a Bridge transaction.
    Every buffer state B_k is Optional[str]:
        - None: file does not exist (absent on disk, or deleted by DELETE_FILE / MOVE_FILE).
        - "":   a 0-byte file exists.
        - str:  a file with content exists.
    """
    __slots__ = ("uri", "baseline", "baseline_hash", "current", "transitions")

    def __init__(self, uri: str, baseline: Optional[str]):
        self.uri: str = uri
        self.baseline: Optional[str] = baseline
        self.baseline_hash: Optional[str] = compute_vfs_sha256(baseline) if baseline is not None else None
        self.current: Optional[str] = baseline
        self.transitions: List[Dict[str, Any]] = []

    @property
    def existed_on_disk(self) -> bool:
        return self.baseline is not None

    @property
    def exists_now(self) -> bool:
        return self.current is not None

    @property
    def is_deleted(self) -> bool:
        return self.current is None

    @property
    def is_modified(self) -> bool:
        return self.current != self.baseline

    def record_step(
        self,
        post_buf: Optional[str],
        block: Dict[str, Any],
        patch_tel: Dict[str, Any],
        raw_target_file: str = "",
        block_index: int = 0,
        ledger_type: Optional[str] = None,
        ledger_search: Optional[str] = None,
        ledger_replace: Optional[str] = None,
    ) -> None:
        b_type = ledger_type or block.get("type", "exact")
        if b_type not in LEDGER_CHUNK_TYPES:
            raise ValueError(f"Unknown ledger chunk type '{b_type}'. Expected one of {sorted(LEDGER_CHUNK_TYPES)}.")
        pre_str = self.current or ""
        post_str = post_buf or ""
        if ledger_search is not None:
            s_val = ledger_search
        elif b_type in ("exact", "regex", "textedit"):
            s_val = block.get("search", "")
        else:
            s_val = pre_str

        if ledger_replace is not None:
            r_val = ledger_replace
        elif b_type in ("exact", "regex", "textedit"):
            r_val = block.get("replace", "")
        else:
            r_val = post_str

        self.transitions.append({
            "order": block.get("order", patch_tel.get("patch_index", 0)),
            "block": block,
            "block_index": block_index,
            "patch_tel": patch_tel,
            "pre_buffer": pre_str,
            "post_buffer": post_str,
            "post_state": post_buf,
            "cell_id": block.get("id"),
            "target_file": str(InSetuURI.from_external_input(raw_target_file)) if raw_target_file else self.uri,
            "raw_target_file": raw_target_file or self.uri,
            "ledger_chunk": {
                "comment": block.get("comment", ""),
                "type": b_type,
                "search": s_val,
                "replace": r_val,
                **({"patch_body": block["patch_body"]} if block.get("patch_body") else {}),
            },
        })
        self.current = post_buf


class BridgeWorkingTree:
    """
    Speculative VFS overlay for a single Bridge transaction.
    Owns all per-file FileTimeline instances and transitive move pointer redirects (src_uri -> dst_uri).
    """

    def __init__(self, vfs):
        self.vfs = vfs
        self.timelines: Dict[str, FileTimeline] = {}
        self.redirects: Dict[str, str] = {}

    def resolve_pointer(self, uri_str: str) -> str:
        cur = uri_str
        seen = set()
        while cur in self.redirects and cur not in seen:
            seen.add(cur)
            cur = self.redirects[cur]
        return cur

    def timeline(self, filepath: str) -> FileTimeline:
        tl = self.timelines.get(filepath)
        if tl is None:
            disk_content = self.vfs.read(filepath)
            tl = FileTimeline(filepath, disk_content)
            self.timelines[filepath] = tl
        return tl

    def read(self, filepath: str) -> Optional[str]:
        return self.timeline(filepath).current

    def disk_hash(self, filepath: str) -> Optional[str]:
        return self.timeline(filepath).baseline_hash

    def baseline(self, filepath: str) -> Optional[str]:
        return self.timeline(filepath).baseline

    def apply_step(
        self,
        filepath: str,
        post_buf: Optional[str],
        block: Dict[str, Any],
        patch_tel: Dict[str, Any],
        raw_target_file: str = "",
        block_index: int = 0,
        ledger_type: Optional[str] = None,
        ledger_search: Optional[str] = None,
        ledger_replace: Optional[str] = None,
    ) -> FileTimeline:
        tl = self.timeline(filepath)
        tl.record_step(
            post_buf=post_buf,
            block=block,
            patch_tel=patch_tel,
            raw_target_file=raw_target_file,
            block_index=block_index,
            ledger_type=ledger_type,
            ledger_search=ledger_search,
            ledger_replace=ledger_replace,
        )
        return tl

    def to_buffer_dict(self) -> Dict[str, str]:
        """Projects touched timelines to {uri: str} (with "" for deleted files) for backward-compatible callers."""
        return {fp: (tl.current if tl.current is not None else "") for fp, tl in self.timelines.items()}


def _is_banned_bridge_target(uri: InSetuURI, norm_target: str, extra_protected_Substrings: Optional[ list ] = None, allow_protected: bool = True) -> Optional[str]:
    base_lower = (uri.basename or "").lower()
    norm_lower = norm_target.replace("\\", "/").lower()
    parts_lower = [p.lower() for p in norm_lower.split("/") if p]
    if not allow_protected and is_protected_vfs_target(str(uri)):
        return "Kernel Guardrail (S8): Protected files cannot be moved, renamed or archived. Change them in place; the change waits for your confirmation."
    # Workspace extensions (.insetu/extensions/) may be written here: insetu only runs files a person approved (S8).
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

_TS_PARSER_LOCAL = threading.local()


def _get_cached_ts_parser(ext: str):
    """Returns a thread-local cached Tree-sitter Parser for .py or .js/.ts files."""
    if not _TSLanguage or not _TSParser:
        return None
    cache = getattr(_TS_PARSER_LOCAL, "parsers", None)
    if cache is None:
        cache = {}
        _TS_PARSER_LOCAL.parsers = cache
    lang_key = "py" if ext == ".py" else ("js" if ext in (".js", ".mjs", ".cjs", ".ts", ".tsx") else "")
    if not lang_key:
        return None
    if lang_key not in cache:
        lang_mod = _ts_python if lang_key == "py" else _ts_javascript
        if not lang_mod:
            return None
        cache[lang_key] = _TSParser(_TSLanguage(lang_mod.language()))
    return cache[lang_key]


def _check_python_module_forward_refs(tree: ast.Module) -> Optional[str]:
    """Delegates module-level import-time forward reference checking to PythonLanguageProvider."""
    return PythonLanguageProvider.check_module_forward_refs(tree)


def validate_buffer_syntax(ctx, resolved_path: str, new_content: str) -> Tuple[bool, str]:
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

        parser = _get_cached_ts_parser(ext)
        if parser is not None:
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
            if ext == '.py':
                py_tree = ast.parse(new_content)
                fwd_err = _check_python_module_forward_refs(py_tree)
                if fwd_err:
                    return True, fwd_err
            return False, ""
        raise ImportError("Language not mapped for Tree-sitter.")
    except ImportError:
        if ext == '.py':
            try:
                py_tree = ast.parse(new_content)
                fwd_err = _check_python_module_forward_refs(py_tree)
                if fwd_err:
                    return True, fwd_err
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


def process_sync_transaction(vfs, workspace_id, data, sister_repos, ws_root, return_buffers=False, ctx=None):
    if ctx is None:
        from insetu.core.bridge.engine_bridge import bridge_bp as _bridge_bp
        ctx = _bridge_bp.get_context(workspace_id)
    raw_text = heal_chevron_meltdown(data.get("text", ""))
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
    tree = BridgeWorkingTree(vfs)
    omniscient_cache = None
    deferred_failures = []
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

    def _validate_and_isolate_syntax(target_uris: Iterable[str]) -> None:
        """
        O(1) Per-File End-of-File AST Syntax Gate + Fault-Isolating Rollback:
        Validates the final buffer of each modified file once; if a syntax error is detected,
        walks that file's transition log to blame and isolate the offending chunk(s) while
        preserving valid sibling chunks.
        """
        for res_fp in sorted(target_uris):
            tl = tree.timelines.get(res_fp)
            if tl is None or not tl.transitions or tl.is_deleted:
                continue
            applied_records = tl.transitions
            if all(_is_gate_approved(rec["cell_id"], "SYNTAX_ERROR", rec["target_file"], res_fp) for rec in applied_records):
                continue

            final_buf = tl.current or ""
            has_syn_err, syn_err_str = validate_buffer_syntax(ctx, res_fp, final_buf)
            if not has_syn_err:
                continue

            clean_running_buf = applied_records[0]["pre_buffer"]
            isolated_culprit = False
            for idx_rec, rec in enumerate(applied_records):
                if _is_gate_approved(rec["cell_id"], "SYNTAX_ERROR", rec["target_file"], res_fp):
                    clean_running_buf = rec["post_buffer"]
                    continue
                if idx_rec == 0 or batch_has_cross_file_ops:
                    cand_buf = rec["post_buffer"]
                else:
                    b_cand = rec["block"]
                    fn_cand = apply_textedit_in_memory if b_cand.get("type") == "textedit" else apply_block_in_memory
                    ok_c, cand_buf, _ = fn_cand(clean_running_buf, b_cand, silent=True)
                    if not ok_c and tl.baseline:
                        ok_c, cand_buf, _ = rebase_overlapping_block_in_memory(
                            tl.baseline, clean_running_buf, b_cand, silent=True
                        )
                    if not ok_c:
                        cand_buf = rec["post_buffer"]

                chunk_err, chunk_err_str = validate_buffer_syntax(ctx, res_fp, cand_buf)
                if chunk_err and idx_rec < len(applied_records) - 1:
                    if batch_has_cross_file_ops:
                        lookahead_buf = applied_records[-1]["post_buffer"]
                    else:
                        lookahead_buf = cand_buf
                        for rem_rec in applied_records[idx_rec + 1:]:
                            rem_b = rem_rec["block"]
                            rem_fn = apply_textedit_in_memory if rem_b.get("type") == "textedit" else apply_block_in_memory
                            ok_rem, next_buf, _ = rem_fn(lookahead_buf, rem_b, silent=True)
                            if ok_rem:
                                lookahead_buf = next_buf
                    healed_later_err, _ = validate_buffer_syntax(ctx, res_fp, lookahead_buf)
                    if not healed_later_err:
                        chunk_err = False

                if chunk_err:
                    isolated_culprit = True
                    pt = rec["patch_tel"]
                    if pt["status"] == "resolved":
                        telemetry["summary"]["resolved"] = max(0, telemetry["summary"]["resolved"] - 1)
                    pt["status"] = "syntax_error"
                    pt["error_message"] = chunk_err_str or syn_err_str
                    diff = list(difflib.unified_diff(clean_running_buf.splitlines(), cand_buf.splitlines(), lineterm=""))
                    err_b64 = base64.b64encode(("\n".join(diff)).encode("utf-8")).decode("utf-8")
                    pt["syntax_error"] = err_b64
                    pt["gate"] = {
                        "code": "SYNTAX_ERROR",
                        "target_uri": res_fp,
                        "reason": chunk_err_str or syn_err_str,
                    }
                    for act_name in ("approve_gate", "ignore_syntax_error", "deselect_patch"):
                        if act_name not in pt["available_actions"]:
                            pt["available_actions"].append(act_name)
                    telemetry["can_commit"] = False
                    telemetry["summary"]["action_required"] += 1
                    deferred_failures.append({
                        "filepath": res_fp,
                        "raw_target_file": rec["raw_target_file"],
                        "block": rec["block"],
                        "block_index": rec.get("block_index", idx_rec),
                        "pre_buffer": clean_running_buf,
                        "post_buffer": cand_buf,
                        "patch_tel": pt,
                    })
                    ctx.emit_background(
                        "bridge_error",
                        filepath=res_fp,
                        error_type="syntax_error",
                        details=chunk_err_str or syn_err_str,
                        file_content=cand_buf,
                        patch_payload=json.dumps(rec["block"]),
                    )
                else:
                    clean_running_buf = cand_buf

            if isolated_culprit:
                tl.current = clean_running_buf
                tl.transitions = [
                    tr for tr in tl.transitions
                    if tr["patch_tel"].get("status") == "resolved"
                ]

    flat_all_blocks = flatten_parsed_blocks(parsed_structure)
    active_uris = {str(InSetuURI.from_external_input(af)) for af in active_files} | set(active_files)
    if active_files:
        for _, _, blk in flat_all_blocks:
            s_u = str(InSetuURI.from_external_input(blk["source_uri"])) if blk.get("source_uri") else ""
            t_u = str(InSetuURI.from_external_input(blk["target_uri"])) if blk.get("target_uri") else ""
            if s_u in active_uris and t_u:
                active_uris.add(t_u)
            elif t_u in active_uris and s_u:
                active_uris.add(s_u)

    batch_has_cross_file_ops = any(
        blk.get("type") in ("relocate", "rename", "move_file", "archive_file", "delete_file")
        for _, _, blk in flat_all_blocks
    )
    execution_groups: List[Tuple[str, List[Dict[str, Any]]]] = (
        [(raw_fp, [blk]) for raw_fp, _, blk in flat_all_blocks]
        if batch_has_cross_file_ops
        else list(parsed_structure.items())
    )
    all_touched_files: Set[str] = set()
    patch_index = 0
    for raw_target_file, blocks in execution_groups:
        uri = InSetuURI.from_external_input(raw_target_file)
        target_file = tree.resolve_pointer(str(uri))
        uri = InSetuURI(target_file)
        if active_files and (raw_target_file not in active_uris and str(InSetuURI.from_external_input(raw_target_file)) not in active_uris and target_file not in active_uris) or not blocks:
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

        # --- Tier 1 Content-Addressed File Bundle Cache Lookup (FileEvalSig) ---
        # A file group is eligible for isolated FileEvalSig caching if it contains no cross-file directives
        # and no global cross-file directives (RELOCATE, RENAME, MOVE_FILE) exist in the batch that could mutate it out-of-band.
        has_cross_file_directives = batch_has_cross_file_ops or any(
            b.get("type") in ("relocate", "rename", "move_file", "archive_file", "delete_file")
            for b in blocks
        )
        file_level_res = resolutions_map.get(target_file) if isinstance(resolutions_map.get(target_file), dict) else {}
        explicit_file_pointer = file_level_res.get("selected_uri") or confirmed_map.get(target_file)
        pointer_for_sig = str(InSetuURI.from_external_input(explicit_file_pointer)) if explicit_file_pointer else target_file
        initial_disk_hash = tree.disk_hash(pointer_for_sig)
        file_res_subset: Dict[str, Any] = {}
        if target_file in resolutions_map:
            file_res_subset[target_file] = resolutions_map[target_file]
        if target_file in confirmed_map:
            file_res_subset[target_file] = {**(file_res_subset.get(target_file) or {}), "selected_uri": confirmed_map[target_file]}
        for b in blocks:
            cid = b.get("id")
            if cid and cid in resolutions_map:
                file_res_subset[cid] = resolutions_map[cid]

        global_flags_tuple = (
            bool(data.get("force")),
            bool(data.get("ignore_syntax") or data.get("ignore_syntax_errors")),
            bool(data.get("allow_deep_search")),
            unattended,
            tuple(sorted(allowed_repos)),
        )
        file_eval_sig = None
        if not has_cross_file_directives:
            file_eval_sig = compute_file_eval_signature(
                workspace_id,
                target_file,
                initial_disk_hash,
                blocks,
                file_res_subset,
                global_flags_tuple,
                resolved_pointer=pointer_for_sig,
            )
            cached_file_bundle = _cache_get(_FILE_EVAL_CACHE, file_eval_sig)
            if cached_file_bundle is not None:
                c_res_path = cached_file_bundle.get("resolved_path")
                if c_res_path and tree.disk_hash(c_res_path) != cached_file_bundle.get("resolved_disk_hash"):
                    cached_file_bundle = None
            if cached_file_bundle is not None:
                for cp in cached_file_bundle["patches"]:
                    cp_copy = dict(cp)
                    cp_copy["patch_index"] = patch_index
                    patch_index += 1
                    if "flags" in cp_copy:
                        cp_copy["flags"] = list(cp_copy["flags"])
                    telemetry["patches"].append(cp_copy)
                    telemetry["summary"]["total_patches"] += 1
                    st_val = cp_copy.get("status")
                    if st_val == "resolved":
                        telemetry["summary"]["resolved"] += 1
                    elif st_val == "auto_skipped":
                        telemetry["summary"]["auto_skipped"] += 1
                    elif st_val in ("needs_confirmation", "offer_deep_search", "syntax_error"):
                        telemetry["summary"]["action_required"] += 1
                        telemetry["can_commit"] = False
                    else:
                        telemetry["summary"]["failed"] += 1
                        telemetry["can_commit"] = False
                for df_item in cached_file_bundle["deferred_failures"]:
                    deferred_failures.append(copy.deepcopy(df_item))
                c_res_path = cached_file_bundle.get("resolved_path")
                if c_res_path and cached_file_bundle.get("final_buffer") is not None:
                    tl_cached = tree.timeline(c_res_path)
                    tl_cached.current = cached_file_bundle["final_buffer"]
                    if cached_file_bundle.get("transitions"):
                        tl_cached.transitions = copy.deepcopy(cached_file_bundle["transitions"])
                continue

        file_patch_start_idx = len(telemetry["patches"])
        file_def_fail_start_idx = len(deferred_failures)
        touched_in_group = set()
        working_blocks = [dict(b) for b in blocks]

        for b_idx, b in enumerate(working_blocks):
            cell_id = b.get("id")
            cell_res = _get_cell_resolution(cell_id, target_file)
            if "_orig_patch_index" in b:
                assigned_patch_index = b["_orig_patch_index"]
            else:
                assigned_patch_index = patch_index
                patch_index += 1
            patch_tel = {
                "cell_id": cell_id,
                "patch_index": b.get("order") if isinstance(b.get("order"), int) else assigned_patch_index,
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
                src_uri = tree.resolve_pointer(str(InSetuURI.from_external_input(b.get("source_uri") or target_file)))
                dst_uri = tree.resolve_pointer(str(InSetuURI.from_external_input(b.get("target_uri") or "")))
                sym_name = b.get("symbol", "")
                src_content = tree.read(src_uri)
                dst_content = tree.read(dst_uri)
                ok_rel, new_src, new_dst, rel_status = apply_ast_relocate_in_memory(
                    src_content, dst_content, src_uri, dst_uri, sym_name, comment=b.get("comment")
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
                    deferred_failures.append({
                        "filepath": src_uri,
                        "raw_target_file": raw_target_file,
                        "block": b,
                        "block_index": b_idx,
                        "pre_buffer": src_content or "",
                        "patch_tel": patch_tel,
                    })
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
                tree.apply_step(src_uri, new_src, b, patch_tel, raw_target_file, b_idx)
                tree.apply_step(dst_uri, new_dst, b, patch_tel, raw_target_file, b_idx)
                touched_in_group.update((src_uri, dst_uri))
                all_touched_files.update((src_uri, dst_uri))
                patch_tel.update({
                    "resolved_file": src_uri,
                    "target_uri": dst_uri,
                    "symbol": sym_name,
                    "status": "resolved",
                    "resolution_type": "ast_relocate",
                    "flags": ["ast_relocate"],
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
                    s_content = tree.read(s_fp)
                    if not s_content or target_sym not in s_content:
                        continue
                    renamed_content = apply_ast_rename_to_content(s_fp, s_content, target_sym, new_sym)
                    if renamed_content != s_content:
                        tree.apply_step(s_fp, renamed_content, b, patch_tel, raw_target_file, b_idx)
                        touched_in_group.add(s_fp)
                        all_touched_files.add(s_fp)
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
                        "symbol": target_sym,
                        "renamed_count": len(modified_in_rename),
                        "status": "resolved",
                        "resolution_type": "ast_rename",
                        "flags": ["ast_rename"],
                    })
                    telemetry["summary"]["resolved"] += 1
                telemetry["patches"].append(patch_tel)
                continue

            if block_type in ("move_file", "archive_file", "delete_file"):
                src_uri_obj = InSetuURI.from_external_input(b.get("source_uri") or target_file)
                src_uri = str(src_uri_obj)
                src_ban = _is_banned_bridge_target(
                    src_uri_obj, f"{src_uri_obj.repo}/{src_uri_obj.path}".strip("/"), protected_substrings,
                    allow_protected=block_type == "delete_file",
                )
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

                src_content = tree.read(src_uri)
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
                    tree.apply_step(
                        src_uri, None, b, patch_tel, raw_target_file, b_idx,
                        ledger_type="delete_file", ledger_search=src_content, ledger_replace=""
                    )
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
                    dst_ban = _is_banned_bridge_target(
                        dst_uri_obj, f"{dst_uri_obj.repo}/{dst_uri_obj.path}".strip("/"), protected_substrings, allow_protected=False,
                    )
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

                dst_prev = tree.read(dst_uri)
                tree.apply_step(
                    src_uri, None, b, patch_tel, raw_target_file, b_idx,
                    ledger_type="delete_file", ledger_search=src_content, ledger_replace=""
                )
                tree.apply_step(
                    dst_uri, src_content, b, patch_tel, raw_target_file, b_idx,
                    ledger_type="exact", ledger_search=dst_prev or "", ledger_replace=src_content
                )
                tree.redirects[src_uri] = dst_uri
                touched_in_group.add(dst_uri)
                all_touched_files.add(dst_uri)
                patch_tel.update({
                    "resolved_file": src_uri,
                    "target_uri": dst_uri,
                    "status": "resolved",
                    "resolution_type": block_type,
                    "flags": [block_type],
                })
                telemetry["summary"]["resolved"] += 1
                telemetry["patches"].append(patch_tel)
                continue

            if block_type == "json_patch":
                content = tree.read(target_file)
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
                tree.apply_step(
                    target_file, new_jp_content, b, patch_tel, raw_target_file, b_idx,
                    ledger_type="json_patch", ledger_search=content, ledger_replace=new_jp_content
                )
                touched_in_group.add(target_file)
                all_touched_files.add(target_file)
                patch_tel.update({
                    "resolved_file": target_file,
                    "status": "resolved",
                    "resolution_type": "json_patch",
                    "flags": ["json_patch"],
                })
                telemetry["summary"]["resolved"] += 1
                telemetry["patches"].append(patch_tel)
                continue
            content = tree.read(target_file)
            search_str = normalize_patch_payload(b["search"], reference_content=content or "")
            replace_str = normalize_patch_payload(b["replace"], reference_content=content or "")
            is_genesis = not search_str.strip()

            # --- PHASE 1: PURE PATH (POINTER) RESOLUTION ---
            class ResolutionContext:
                def __init__(self):
                    self.resolved_path = None
                    self.resolution_type = None
                    self.handled = False

            pctx = ResolutionContext()
            effective_deep_search = bool(data.get("allow_deep_search") or cell_res.get("allow_deep_search"))

            def resolve_noop():
                if not is_genesis and is_effectively_identical(search_str.split('\n'), replace_str.split('\n')):
                    patch_tel.update({"status": "auto_skipped", "error_message": "No-Op: The SEARCH and REPLACE blocks are perfectly identical."})
                    telemetry["summary"]["auto_skipped"] += 1
                    pctx.handled = True

            def _enforce_genesis_overwrite_gate(resolved_uri: str) -> bool:
                if not resolved_uri:
                    return False
                if tree.read(resolved_uri) is not None and not _is_gate_approved(
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

            def resolve_confirmed():
                confirmed = cell_res.get("selected_uri") or file_level_res.get("selected_uri") or confirmed_map.get(target_file)
                if confirmed:
                    cand_uri = str(InSetuURI.from_external_input(confirmed))
                    if is_genesis:
                        pctx.resolved_path = cand_uri
                        pctx.resolution_type = "confirmed_candidate"
                        pctx.handled = True
                        _enforce_genesis_overwrite_gate(cand_uri)
                        return
                    if tree.read(cand_uri) is not None:
                        pctx.resolved_path = cand_uri
                        pctx.resolution_type = "confirmed_candidate"
                        pctx.handled = True

            def resolve_genesis():
                nonlocal omniscient_cache
                if not is_genesis:
                    return
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
                if target_dirname == '.':
                    target_dirname = ''
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

            def resolve_direct_path():
                if content is not None and not effective_deep_search:
                    pctx.resolved_path = target_file
                    pctx.resolution_type = "direct_match"
                    pctx.handled = True

            def resolve_pinned_shortcut():
                if len(allowed_repos) == 1 and not effective_deep_search:
                    cand = f"vfs://{allowed_repos[0]}/{norm_target}"
                    if tree.read(cand) is not None:
                        pctx.resolved_path = cand
                        pctx.resolution_type = "pinned_shortcut"
                        pctx.handled = True

            def resolve_fuzzy_path():
                if effective_deep_search and content is not None:
                    return
                raw_candidates = ctx.find_path_candidates(target_file, allowed_repos=allowed_repos)
                candidates = [c["filepath"] for c in raw_candidates if c["score"] >= 0.8]
                if not candidates:
                    return
                best_search_cand = None
                best_replace_cand = None
                cand_list = []

                for cand in candidates:
                    cand_content = tree.read(cand)
                    if cand_content is None or (
                        not has_distinctive_anchor_line(cand_content, search_str)
                        and not has_distinctive_anchor_line(cand_content, replace_str)
                    ):
                        continue
                    ok_search, _, s_status = apply_block_in_memory(cand_content, dict(b), silent=True)
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
                    if best_replace_cand:
                        patch_tel["flags"].append("already_applied")
                    patch_tel["available_actions"].extend(["confirm_candidate", "deselect_patch"])
                    telemetry["can_commit"] = False
                    telemetry["summary"]["action_required"] += 1
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
                        cand_content = tree.read(cand_uri)
                        if cand_content and longest_line in cand_content:
                            ok_search, _, s_status = apply_block_in_memory(cand_content, dict(b), silent=True)
                            if ok_search and s_status != "idempotent":
                                cand_list.append({"filepath": cand_uri, "score": 1.0, "match_type": "deep_search"})
                    if cand_list:
                        patch_tel.update({"status": "needs_confirmation", "resolution_type": "deep_search", "candidates": cand_list})
                        patch_tel["available_actions"].extend(["confirm_candidate", "deselect_patch"])
                        telemetry["can_commit"] = False
                        telemetry["summary"]["action_required"] += 1
                        pctx.handled = True

            # Execute Phase 1 Path Resolution (pure pointer resolution)
            for resolver in [resolve_noop, resolve_confirmed, resolve_genesis, resolve_direct_path, resolve_pinned_shortcut, resolve_fuzzy_path, resolve_deep_search]:
                resolver()
                if pctx.handled:
                    break

            if patch_tel["status"] in ("auto_skipped", "needs_confirmation", "offer_deep_search", "failed"):
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
            patch_tel["disk_hash"] = tree.disk_hash(resolved_path)

            content = tree.read(resolved_path) or ""
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

            # --- PHASE 2: CANONICAL IN-MEMORY TEST LOOP & TIER 2 SIGNATURE MEMOIZATION (PatchEvalSig) ---
            input_buf_hash = compute_vfs_sha256(content)
            orig_file_hash = tree.disk_hash(resolved_path) or ""
            patch_eval_sig = compute_patch_eval_signature(resolved_path, input_buf_hash, orig_file_hash, b, cell_res)
            cached_chunk = _cache_get(_PATCH_EVAL_CACHE, patch_eval_sig)
            apply_stat = "success"
            if cached_chunk is not None and cached_chunk.get("ok"):
                new_content = cached_chunk["new_content"]
                apply_stat = cached_chunk.get("apply_stat", "success")
                for flg in (cached_chunk.get("flags") or []):
                    if flg not in patch_tel["flags"]:
                        patch_tel["flags"].append(flg)
                ok = True
            else:
                apply_fn = apply_textedit_in_memory if block_type == "textedit" else apply_block_in_memory
                ok, new_content, apply_stat = apply_fn(content, dict(b), silent=True)
                orig_base = tree.baseline(resolved_path)
                if not ok and block_type != "textedit" and orig_base and orig_base != content:
                    ok_reb, reb_content, reb_stat = rebase_overlapping_block_in_memory(
                        orig_base, content, dict(b), silent=True
                    )
                    if ok_reb:
                        ok, new_content, apply_stat = True, reb_content, reb_stat
                        if reb_stat == "overlap_rebased":
                            patch_tel["resolution_type"] = "overlap_rebased"
                            if "rebased_overlap" not in patch_tel["flags"]:
                                patch_tel["flags"].append("rebased_overlap")
                if ok:
                    _cache_put(_PATCH_EVAL_CACHE, patch_eval_sig, {
                        "ok": True,
                        "new_content": new_content,
                        "apply_stat": apply_stat,
                        "flags": list(patch_tel["flags"]),
                    }, MAX_PATCH_EVAL_CACHE_SIZE)

            if ok and apply_stat in ("idempotent", "no_op"):
                patch_tel.update({
                    "resolved_file": resolved_path,
                    "status": "auto_skipped",
                    "error_message": (
                        "No-Op: The SEARCH and REPLACE blocks are perfectly identical."
                        if apply_stat == "no_op"
                        else "Already Applied: The target file natively matches the desired state."
                    ),
                })
                if apply_stat == "idempotent" and "already_applied" not in patch_tel["flags"]:
                    patch_tel["flags"].append("already_applied")
                telemetry["summary"]["auto_skipped"] += 1
                telemetry["patches"].append(patch_tel)
                continue

            if not ok:
                if isinstance(apply_stat, str) and apply_stat.startswith("ambiguous:"):
                    amb_lines = apply_stat.split(":", 1)[1]
                    patch_tel.update({
                        "resolved_file": resolved_path,
                        "status": "needs_confirmation",
                        "resolution_type": "ambiguous_anchor",
                        "ambiguous_lines": [int(x.strip()) for x in amb_lines.split(",") if x.strip().isdigit()],
                        "error_message": f"Ambiguous Search Anchor: SEARCH block matched multiple locations in '{resolved_path}' (lines {amb_lines}). Add 1-2 lines of surrounding context to disambiguate.",
                        "flags": ["ambiguous_anchor"],
                        "available_actions": ["deselect_patch"],
                    })
                else:
                    search_lines = search_str.replace('\r\n', '\n').replace('\xa0', ' ').split('\n')
                    replace_lines = replace_str.replace('\r\n', '\n').replace('\xa0', ' ').split('\n')
                    file_lines = content.replace('\r\n', '\n').replace('\xa0', ' ').split('\n')
                    win_info = locate_closest_window(
                        file_lines,
                        search_lines,
                        replace_lines=replace_lines,
                        symbol_hint=b.get("symbol") or b.get("target_symbol"),
                    )
                    actual_lines = win_info["actual_lines"]
                    diff = list(difflib.ndiff(search_lines, actual_lines))
                    err_b64 = base64.b64encode(("\n".join(diff)).encode('utf-8')).decode('utf-8')

                    # Only allow deterministic 'Snap Anchor to Disk' (heal_anchor) when the closest candidate
                    # window shares genuine structural similarity (>= 0.65) and at least one non-trivial line match,
                    # preventing single-brace coincidences from snapping onto unrelated code blocks.
                    sim_ratio = win_info["similarity_ratio"]
                    can_snap_anchor = sim_ratio >= 0.65 and bool(actual_lines)
                    anchor_b64 = (
                        base64.b64encode(("\n".join(actual_lines)).encode('utf-8')).decode('utf-8')
                        if can_snap_anchor
                        else None
                    )

                    patch_tel.update({
                        "resolved_file": resolved_path,
                        "status": "needs_confirmation",
                        "resolution_type": "anchor_failed",
                        "error_message": (
                            "Search anchor failed to match existing file closely enough to snap automatically."
                            if not can_snap_anchor
                            else "Search anchor failed to match existing file exactly."
                        ),
                        "syntax_error": err_b64,
                        "actual_anchor": anchor_b64,
                    })
                    if can_snap_anchor:
                        patch_tel["available_actions"].append("heal_anchor")
                    patch_tel["available_actions"].extend(["deselect_patch", "offer_deep_search"])

                telemetry["can_commit"] = False
                telemetry["summary"]["action_required"] += 1
                deferred_failures.append({
                    "filepath": resolved_path,
                    "raw_target_file": raw_target_file,
                    "block": b,
                    "block_index": b_idx,
                    "pre_buffer": content,
                    "patch_tel": patch_tel,
                })
                telemetry["patches"].append(patch_tel)
                ctx.emit_background('bridge_error', filepath=resolved_path, error_type='patch_failed', details=patch_tel["error_message"], file_content=content, patch_payload=json.dumps(b))
                continue

            # Record applied chunk in unified FileTimeline for O(1) end-of-file AST validation and ledger commit
            tree.apply_step(resolved_path, new_content, b, patch_tel, raw_target_file, b_idx)
            touched_in_group.add(resolved_path)
            all_touched_files.add(resolved_path)
            patch_tel["status"] = "resolved"
            telemetry["summary"]["resolved"] += 1
            telemetry["patches"].append(patch_tel)

        if batch_has_cross_file_ops:
            continue

        # --- Step i: O(1) Per-File End-of-File AST Syntax Gate + Fault-Isolating Rollback ---
        _validate_and_isolate_syntax(touched_in_group)

        # Store evaluated file bundle in _FILE_EVAL_CACHE for O(1) subsequent skips
        if file_eval_sig is not None:
            file_patches_slice = telemetry["patches"][file_patch_start_idx:]
            file_def_slice = deferred_failures[file_def_fail_start_idx:]
            resolved_fp_for_cache = next(
                (p.get("resolved_file") for p in file_patches_slice if p.get("resolved_file")),
                target_file,
            )
            tl_resolved = tree.timelines.get(resolved_fp_for_cache) if resolved_fp_for_cache else None
            _cache_put(_FILE_EVAL_CACHE, file_eval_sig, {
                "resolved_path": resolved_fp_for_cache,
                "resolved_disk_hash": tree.disk_hash(resolved_fp_for_cache) if resolved_fp_for_cache else None,
                "patches": file_patches_slice,
                "deferred_failures": file_def_slice,
                "transitions": tl_resolved.transitions if tl_resolved else [],
                "final_buffer": tl_resolved.current if tl_resolved else None,
            }, MAX_FILE_EVAL_CACHE_SIZE)

    if batch_has_cross_file_ops and all_touched_files:
        _validate_and_isolate_syntax(all_touched_files)

    telemetry["patches"].sort(key=lambda p: p.get("patch_index", 0))
    # S8: tell the person before committing which files will wait for their confirmation instead of being written.
    for patch in telemetry["patches"]:
        flags = list(patch.get("flags") or [])
        if patch.get("status") == "resolved" and PROTECTED_CONFIRMATION_FLAG not in flags:
            if is_protected_vfs_target(patch.get("resolved_file"), workspace_id) or (
                patch.get("target_uri") and is_protected_vfs_target(patch.get("target_uri"), workspace_id)
            ):
                patch["flags"] = flags + [PROTECTED_CONFIRMATION_FLAG]

    # Zero-Patch Validation
    if telemetry["summary"]["total_patches"] == 0:
        telemetry["can_commit"] = False
        telemetry["status"] = "failed"
        telemetry["message"] = "No valid or active patches detected in transaction payload."

    # Phase 4 Concurrency Lock: Re-verify physical disk hashes before commit
    if not dry_run and telemetry["can_commit"]:
        for filepath, tl in tree.timelines.items():
            if not tl.is_modified:
                continue
            current_on_disk = vfs.read(filepath)
            current_hash = compute_vfs_sha256(current_on_disk) if current_on_disk is not None else None
            if current_hash != tl.baseline_hash:
                telemetry["can_commit"] = False
                telemetry["status"] = "failed"
                telemetry["message"] = f"Concurrency Guard Triggered: '{filepath}' was modified on disk during transaction evaluation."
                break
    # Phase 4 & 5: Settlement and Ledger Staging
    if not dry_run and telemetry["can_commit"]:
        db_conn = ctx.db
        now_ts = time.time()
        ttl_48h = now_ts + 172800.0  # 48-hour TTL for metronome housekeeping
        created_file_comments: Dict[str, str] = {}
        protected_results: List[Dict[str, Any]] = []

        for filepath, tl in tree.timelines.items():
            if not tl.is_modified:
                continue
            orig_content = tl.baseline or ""
            final_content = tl.current or ""
            if is_protected_vfs_target(filepath, workspace_id):
                # Nothing is written and nothing enters the ledger: the change is staged for a person to confirm.
                origin_data = {_PROTECTED_SOURCE_KEY: "bridge", _PROTECTED_REFERENCE_KEY: pid}
                answer = vfs.delete(filepath, origin_data) if tl.is_deleted else vfs.save(filepath, final_content, origin_data)
                body = answer[0] if isinstance(answer, tuple) else answer
                body = body if isinstance(body, dict) else {}
                protected_results.append({
                    "filepath": filepath,
                    "status": body.get("status"),
                    "change_id": body.get("change_id"),
                    "message": body.get("message"),
                })
                continue

            disk_hash = tl.baseline_hash or ""
            post_patch_hash = "" if tl.is_deleted else compute_vfs_sha256(final_content)
            last_record = db_conn.execute("SELECT post_patch_hash FROM bridge_ledger WHERE filepath=? ORDER BY timestamp DESC LIMIT 1", (filepath,)).fetchone()
            last_known_hash = last_record['post_patch_hash'] if last_record else ""

            transitions = sorted(tl.transitions, key=lambda tr: tr.get("order", 0))
            ledger_chunks = [tr["ledger_chunk"] for tr in transitions]
            if not ledger_chunks:
                ledger_chunks = [{
                    "comment": "File deleted/relocated" if tl.is_deleted else "",
                    "type": "delete_file" if tl.is_deleted else "exact",
                    "search": orig_content,
                    "replace": "" if tl.is_deleted else final_content,
                }]

            s_block = "\n".join([c.get("search", "") for c in ledger_chunks])
            r_block = "\n".join([c.get("replace", "") for c in ledger_chunks])

            is_snapshot = False
            compressed_state = None
            existed_before_tx = tl.existed_on_disk

            # 1. The Human Intercept Rule (Manual edits detected) or brand-new file creation boundary
            if not existed_before_tx or disk_hash != last_known_hash:
                is_snapshot = True
            # 2. Genesis Overwrite Guardrail & Deletion Snapshot Guarantee
            is_genesis = (not existed_before_tx) or any(not c.get("search", "").strip() for c in ledger_chunks)
            if (is_genesis and orig_content.strip()) or tl.is_deleted:
                is_snapshot = True
            if not existed_before_tx and not tl.is_deleted:
                genesis_comment = next(
                    (c.get("comment", "").strip() for c in ledger_chunks if c.get("comment", "").strip()),
                    "",
                )
                if genesis_comment:
                    created_file_comments[filepath] = genesis_comment

            # 3. The 5-Turn Keyframe Routine
            if not is_snapshot and existed_before_tx:
                recent_records = db_conn.execute("SELECT is_snapshot FROM bridge_ledger WHERE filepath=? ORDER BY timestamp DESC LIMIT 4", (filepath,)).fetchall()
                if len(recent_records) == 4 and not any(r['is_snapshot'] for r in recent_records):
                    is_snapshot = True
            if is_snapshot and existed_before_tx and tl.baseline is not None:
                compressed_state = zlib.compress(tl.baseline.encode('utf-8'))
            file_uri = InSetuURI(filepath)
            current_repo = file_uri.repo if file_uri.repo else (file_uri.path.partition('/')[0] if '/' in file_uri.path else "")
            patch_id = f"ptc_{uuid.uuid4().hex[:12]}"
            patch_count = max(1, len(ledger_chunks))
            chunks_json = json.dumps(ledger_chunks)
            db_conn.execute('''
                INSERT INTO bridge_ledger (patch_id, transaction_id, repo, filepath, search_block, replace_block, post_patch_hash, is_snapshot, compressed_state, timestamp, ttl_expires_at, patch_count, chunks_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (patch_id, pid, current_repo, filepath, s_block, r_block, post_patch_hash, 1 if is_snapshot else 0, compressed_state, now_ts, ttl_48h, patch_count, chunks_json))
            if tl.is_deleted:
                vfs.delete(filepath)
            else:
                # Phase 4: Restore target file EOL format (CRLF drift prevention)
                if '\r\n' in orig_content and '\r\n' not in final_content:
                    final_content = final_content.replace('\n', '\r\n')
                vfs.save(filepath, final_content)

        db_conn.commit()
        telemetry["status"] = "committed"
        if protected_results:
            telemetry["pending_protected_changes"] = protected_results
            for patch in telemetry["patches"]:
                result = next((r for r in protected_results if r["filepath"] == patch.get("resolved_file")), None)
                if result and result["status"] not in ("pending_confirmation", "accepted"):
                    patch["status"] = "failed"
                    patch["error_message"] = result.get("message") or "The protected change was refused."
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
        return telemetry, tree.to_buffer_dict(), deferred_failures
    return telemetry


def execute_bridge_sync(workspace_id, data, ctx=None):
    if ctx is None:
        from insetu.core.bridge.engine_bridge import bridge_bp as _bridge_bp
        ctx = _bridge_bp.get_context(workspace_id)
    sister_repos = get_sister_repos(workspace_id)
    _, ws_root = get_workspace_physics(workspace_id)

    try:
        with ctx.vfs as vfs:
            telemetry = process_sync_transaction(vfs, workspace_id, data, sister_repos, ws_root, ctx=ctx)
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


