"""Compiler-grade two-phase lexer, lookahead parser, and content-addressed signature computer for Yomama Bridge payloads."""
import hashlib
import json
import re
from typing import Any, Dict, List, Optional, Tuple
from insetu.core.utils_core import InSetuURI

LEDGER_CHUNK_TYPES = frozenset({
    "exact",
    "regex",
    "textedit",
    "json_patch",
    "relocate",
    "rename",
    "move_file",
    "archive_file",
    "delete_file",
    "revert",
})


def get_base_step_and_diffs(lines: List[str]) -> Tuple[int, List[int]]:
    """
    Analyzes a block of code to find its dominant structural base indentation unit (LCD > 1).
    Weights indentation transitions by actual line frequency so a few stray 2-space docstring
    or continuation lines cannot override a 4-space file's baseline step.
    """
    line_indents = [len(line) - len(line.lstrip()) for line in lines if line.strip()]
    unique_indents = sorted(set(line_indents))
    if len(unique_indents) <= 1:
        return 4, []

    diffs = [unique_indents[k + 1] - unique_indents[k] for k in range(len(unique_indents) - 1)]
    # Weight each non-zero indent jump by how many consecutive line transitions or indented lines support it
    weighted_jumps: List[int] = []
    for idx in range(len(line_indents) - 1):
        jump = abs(line_indents[idx + 1] - line_indents[idx])
        if jump > 1:
            weighted_jumps.append(jump)
    if not weighted_jumps:
        weighted_jumps = [d for d in diffs if d > 1]

    if not weighted_jumps:
        return 4, diffs

    # If the majority (>= 60%) of indented lines sit on multiples of 4, 4 is the structural step
    non_zero_indents = [i for i in line_indents if i > 0]
    if non_zero_indents:
        mult4_ratio = sum(1 for i in non_zero_indents if i % 4 == 0) / len(non_zero_indents)
        has_step4_jump = any(j == 4 for j in weighted_jumps) or (4 in unique_indents)
        if mult4_ratio >= 0.6 and has_step4_jump:
            return 4, diffs

    best_step = 4
    min_error = float('inf')
    for s_step in [4, 2, 3, 8]:
        error = 0
        has_base_jump = False
        for d in weighted_jumps:
            k = max(1, int(round(d / s_step)))
            if k == 1:
                has_base_jump = True
            error += abs(d - (k * s_step))
        if not has_base_jump:
            error += 1000 * len(weighted_jumps)
        if error < min_error:
            min_error = error
            best_step = s_step

    return best_step, diffs


def _parse_kv_directive_lines(lines: List[str]) -> Dict[str, str]:
    directives: Dict[str, str] = {}
    for raw_line in lines:
        s = raw_line.strip()
        if not s or ":" not in s:
            continue
        k, v = s.split(":", 1)
        directives[k.strip().upper()] = v.strip()
    return directives


def _project_textedit_search_replace(raw_textedit: str) -> Tuple[str, str]:
    """
    Projects a <<<<<<< TEXTEDIT body containing inline {{-delete}} and {{+insert}} spans
    into (search_str, replace_str) for 100% compatibility with bridge_ledger, /undo, and diff viewers.
    """
    search_projected = re.sub(r'\{\{\+([\s\S]*?)\}\}', '', raw_textedit)
    search_projected = re.sub(r'\{\{-([\s\S]*?)\}\}', lambda m: m.group(1), search_projected)
    replace_projected = re.sub(r'\{\{-([\s\S]*?)\}\}', '', raw_textedit)
    replace_projected = re.sub(r'\{\{\+([\s\S]*?)\}\}', lambda m: m.group(1), replace_projected)
    return search_projected, replace_projected


_MARKER_FILE_RE = re.compile(r'^[ \t]*(?:<[ \t]*){3,}FILE\s*:\s*(.+?)[ \t]*$')
_MARKER_ID_RE = re.compile(r'^[ \t]*(?:<[ \t]*){3,}ID\s*:\s*(.+?)[ \t]*$')
_MARKER_OPEN_RE = re.compile(
    r'^[ \t]*(?:<[ \t]*){3,}(COMMENT|RELOCATE|RENAME|MOVE_FILE|ARCHIVE_FILE|DELETE_FILE|TEXTEDIT|JSON_PATCH|SEARCH(?:\s+REGEX)?)\b[ \t]*$'
)
_MARKER_SEP_RE = re.compile(r'^[ \t]*(?:=[ \t]*){6,}=[ \t]*$')
_MARKER_CLOSE_RE = re.compile(r'^[ \t]*(?:>[ \t]*){1,}(REPLACE|EXECUTE)[ \t]*$')
_CHAT_CITATION_NOISE_RE = re.compile(
    r'(?:\[(?:source|cite)\s*:\s*[\d\s,a-zA-Z_-]+\]|\[cite_(?:start|end)\]|\[cite\])',
    re.IGNORECASE,
)
_ZERO_WIDTH_RE = re.compile(r'[\u200b\u200c\u200d\u2060\ufeff]')


def _preclean_web_chat_artifacts(raw_text: str) -> str:
    """
    Normalizes web-chat LLM copy-paste artifacts before lexing:
    1. Strips zero-width invisible characters and CRLF / non-breaking spaces inside markers.
    2. Heals multi-line blockquote chevron meltdown (`> > > REPLACE\\n>\\n>` -> `>>>>>>> REPLACE`).
    Note: {{ymm:...}} transport macros are intentionally NOT expanded before lexing so escaped
    markers inside patch bodies can never be mistaken for outer structural block boundaries.
    """
    text = raw_text.replace('\r\n', '\n').replace('\xa0', ' ')
    text = re.sub(
        r'^[ \t\u200b-\u200d\ufeff]*(?:>[ \t]*)+REPLACE[ \t]*(?:\n[ \t]*(?:>[ \t]*)+$)*',
        '>>>>>>> REPLACE',
        text,
        flags=re.MULTILINE,
    )
    text = re.sub(
        r'^[ \t\u200b-\u200d\ufeff]*(?:>[ \t]*)+EXECUTE[ \t]*(?:\n[ \t]*(?:>[ \t]*)+$)*',
        '>>>>>>> EXECUTE',
        text,
        flags=re.MULTILINE,
    )
    return text


def _clean_marker_candidate(line: str) -> str:
    """Strips invisible zero-width chars and trailing web-chat citation tags when testing if a line is a Yomama marker."""
    cleaned = _ZERO_WIDTH_RE.sub('', line)
    if '[' in cleaned and ('cite' in cleaned.lower() or 'source' in cleaned.lower()):
        cleaned = _CHAT_CITATION_NOISE_RE.sub('', cleaned)
    return cleaned


def _select_optimal_separator_index(body_lines: List[str], sep_indices: List[int]) -> int:
    """
    Compiler lookahead disambiguator when multiple `=======` lines appear between
    `<<<<<<< SEARCH` and `>>>>>>> REPLACE`.
    Picks the separator index that balances inner code fences and surrounding context.
    """
    if len(sep_indices) == 1:
        return sep_indices[0]
    best_idx = sep_indices[len(sep_indices) // 2]
    best_score = -10**9
    total = len(body_lines)
    for cand in sep_indices:
        left = body_lines[:cand]
        right = body_lines[cand + 1:]
        left_fences = sum(1 for l in left if l.lstrip().startswith("```"))
        right_fences = sum(1 for l in right if l.lstrip().startswith("```"))
        score = 0
        if left_fences % 2 == 0 and right_fences % 2 == 0:
            score += 500
        if left and right and left[0].strip() and left[0].strip() == right[0].strip():
            score += 300
        if left and right and left[-1].strip() and left[-1].strip() == right[-1].strip():
            score += 300
        dist_from_mid = abs(cand - (total // 2))
        score -= dist_from_mid
        if score > best_score:
            best_score = score
            best_idx = cand
    return best_idx


def compute_block_signature(block: Dict[str, Any], resolution: Optional[Dict[str, Any]] = None) -> str:
    """Computes a deterministic SHA-256 content signature for a parsed Yomama block and its user resolution."""
    payload = {
        "type": block.get("type", "exact"),
        "search": block.get("search", ""),
        "replace": block.get("replace", ""),
        "raw_directive": block.get("raw_directive", ""),
        "symbol": block.get("symbol", ""),
        "target_uri": block.get("target_uri", ""),
        "target_symbol": block.get("target_symbol", ""),
        "new_symbol": block.get("new_symbol", ""),
        "malformed": bool(block.get("malformed", False)),
        "resolution": resolution or {},
    }
    raw_bytes = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(raw_bytes).hexdigest()


def parse_blocks(text: str) -> Dict[str, List[Dict[str, Any]]]:
    """
    Compiler-grade two-phase Lexer + Lookahead Parser for Yomama Bridge payloads:
    - Heals web-chat chevron meltdown (`> > > REPLACE`, `< < < SEARCH`, `{{ymm:...}}`, `````).
    - Tolerates leading indentation on markers caused by Markdown/HTML copy-paste.
    - Uses lookahead across SEARCH..REPLACE spans to disambiguate literal `=======` lines inside code payloads.
    - Synchronizes on error boundaries and emits explicit diagnostic blocks (`malformed: True`)
      with line numbers so truncated or malformed patches never silently vanish.
    """
    if not text:
        return {}

    norm_text = _preclean_web_chat_artifacts(text)
    all_lines = norm_text.split('\n')

    start_line_idx = 0
    for idx, raw_line in enumerate(all_lines):
        cand_line = _clean_marker_candidate(raw_line)
        if _MARKER_FILE_RE.match(cand_line) or _MARKER_OPEN_RE.match(cand_line):
            start_line_idx = idx
            break
    else:
        return {}

    files: Dict[str, List[Dict[str, Any]]] = {}
    file_header_lines: Dict[str, int] = {}
    current_file: Optional[str] = None
    current_id: Optional[str] = None
    state = "OUTSIDE"
    state_start_line = 1
    current_type = "exact"
    comment_lines: List[str] = []
    body_lines: List[str] = []
    ast_lines: List[str] = []
    next_order_idx = 0

    def _next_order() -> int:
        nonlocal next_order_idx
        val = next_order_idx
        next_order_idx += 1
        return val

    def _emit_malformed_block(target_file: Optional[str], reason: str, line_no: int, raw_excerpt: List[str]):
        nonlocal comment_lines, body_lines, ast_lines, current_id, state
        dest_file = target_file or current_file or "vfs://_unscoped_patch_error_"
        diag_msg = f"Line {line_no}: {reason}"
        print(f"  [!] Yomama Parser Diagnostic ({dest_file}): {diag_msg}")
        excerpt_str = "\n".join(raw_excerpt[:20])
        order_idx = _next_order()
        files.setdefault(dest_file, []).append({
            "id": current_id or f"cell_{order_idx}",
            "order": order_idx,
            "type": "exact",
            "malformed": True,
            "error": diag_msg,
            "line_start": line_no,
            "comment": ("\n".join(comment_lines).strip() or f"[!] PARSE ERROR ({diag_msg})"),
            "search": f"<<<YOMAMA_PARSE_ERROR: {diag_msg}>>>\n{excerpt_str}",
            "replace": "",
        })
        comment_lines = []
        body_lines = []
        ast_lines = []
        current_id = None
        state = "OUTSIDE"

    def _flush_search_replace_span(close_line_no: int):
        nonlocal comment_lines, body_lines, current_id, state
        if not current_file:
            _emit_malformed_block(None, "SEARCH/REPLACE block declared without a preceding '<<<<<<< FILE:' header.", state_start_line, body_lines)
            return
        sep_indices = [idx for idx, l in enumerate(body_lines) if _MARKER_SEP_RE.match(_clean_marker_candidate(l))]
        if not sep_indices:
            _emit_malformed_block(
                current_file,
                "Missing '=======' separator between '<<<<<<< SEARCH' and '>>>>>>> REPLACE' (check for rich-text copy/paste stripping).",
                state_start_line,
                body_lines,
            )
            return
        split_at = _select_optimal_separator_index(body_lines, sep_indices)
        s_lines = body_lines[:split_at]
        r_lines = body_lines[split_at + 1:]
        order_idx = _next_order()
        files.setdefault(current_file, []).append({
            "id": current_id or f"cell_{order_idx}",
            "order": order_idx,
            "type": current_type,
            "line_start": state_start_line,
            "line_end": close_line_no,
            "comment": "\n".join(comment_lines).strip(),
            "search": "\n".join(s_lines),
            "replace": "\n".join(r_lines),
        })
        comment_lines = []
        body_lines = []
        current_id = None
        state = "OUTSIDE"

    def _flush_directive_block(close_line_no: int):
        nonlocal comment_lines, ast_lines, current_id, state
        if state in ("RELOCATE", "RENAME", "MOVE_FILE", "ARCHIVE_FILE", "DELETE_FILE"):
            kv = _parse_kv_directive_lines(ast_lines)
            if state == "RELOCATE":
                raw_src = kv.get("FROM") or current_file or ""
                raw_dst = kv.get("TO") or ""
                src_file = str(InSetuURI.from_external_input(raw_src)) if raw_src else ""
                dst_file = str(InSetuURI.from_external_input(raw_dst)) if raw_dst else ""
                sym_name = kv.get("SYMBOL") or ""
                if src_file:
                    order_idx = _next_order()
                    files.setdefault(src_file, []).append({
                        "id": current_id or f"cell_{order_idx}",
                        "order": order_idx,
                        "type": "relocate",
                        "line_start": state_start_line,
                        "line_end": close_line_no,
                        "comment": "\n".join(comment_lines).strip(),
                        "symbol": sym_name,
                        "source_uri": src_file,
                        "target_uri": dst_file,
                        "raw_directive": "\n".join(ast_lines),
                        "search": "",
                        "replace": "",
                    })
            elif state == "RENAME":
                scope_val = kv.get("SCOPE") or current_file or "vfs://"
                target_sym = kv.get("TARGET") or ""
                replace_sym = kv.get("REPLACE_WITH") or ""
                order_idx = _next_order()
                files.setdefault(scope_val, []).append({
                    "id": current_id or f"cell_{order_idx}",
                    "order": order_idx,
                    "type": "rename",
                    "line_start": state_start_line,
                    "line_end": close_line_no,
                    "comment": "\n".join(comment_lines).strip(),
                    "target_symbol": target_sym,
                    "new_symbol": replace_sym,
                    "scope_prefix": scope_val,
                    "raw_directive": "\n".join(ast_lines),
                    "search": "",
                    "replace": "",
                })
            elif state == "MOVE_FILE":
                raw_src = kv.get("FROM") or kv.get("FILE") or current_file or ""
                raw_dst = kv.get("TO") or kv.get("DEST") or ""
                src_file = str(InSetuURI.from_external_input(raw_src)) if raw_src else ""
                dst_file = str(InSetuURI.from_external_input(raw_dst)) if raw_dst else ""
                if src_file:
                    order_idx = _next_order()
                    files.setdefault(src_file, []).append({
                        "id": current_id or f"cell_{order_idx}",
                        "order": order_idx,
                        "type": "move_file",
                        "line_start": state_start_line,
                        "line_end": close_line_no,
                        "comment": "\n".join(comment_lines).strip(),
                        "source_uri": src_file,
                        "target_uri": dst_file,
                        "raw_directive": "\n".join(ast_lines),
                        "search": "",
                        "replace": "",
                    })
            elif state == "ARCHIVE_FILE":
                raw_target = kv.get("FILE") or kv.get("FROM") or current_file or ""
                target_uri = str(InSetuURI.from_external_input(raw_target)) if raw_target else ""
                if target_uri:
                    order_idx = _next_order()
                    files.setdefault(target_uri, []).append({
                        "id": current_id or f"cell_{order_idx}",
                        "order": order_idx,
                        "type": "archive_file",
                        "line_start": state_start_line,
                        "line_end": close_line_no,
                        "comment": "\n".join(comment_lines).strip(),
                        "source_uri": target_uri,
                        "raw_directive": "\n".join(ast_lines),
                        "search": "",
                        "replace": "",
                    })
            elif state == "DELETE_FILE":
                raw_target = kv.get("FILE") or kv.get("FROM") or current_file or ""
                target_uri = str(InSetuURI.from_external_input(raw_target)) if raw_target else ""
                if target_uri:
                    order_idx = _next_order()
                    files.setdefault(target_uri, []).append({
                        "id": current_id or f"cell_{order_idx}",
                        "order": order_idx,
                        "type": "delete_file",
                        "line_start": state_start_line,
                        "line_end": close_line_no,
                        "comment": "\n".join(comment_lines).strip(),
                        "source_uri": target_uri,
                        "raw_directive": "\n".join(ast_lines),
                        "search": "",
                        "replace": "",
                    })
        elif state == "JSON_PATCH" and current_file:
            raw_json_body = "\n".join(ast_lines).strip()
            order_idx = _next_order()
            files.setdefault(current_file, []).append({
                "id": current_id or f"cell_{order_idx}",
                "order": order_idx,
                "type": "json_patch",
                "line_start": state_start_line,
                "line_end": close_line_no,
                "comment": "\n".join(comment_lines).strip(),
                "patch_body": raw_json_body,
                "raw_directive": raw_json_body,
                "search": "",
                "replace": raw_json_body,
            })
        elif state == "TEXTEDIT" and current_file:
            raw_te = "\n".join(ast_lines)
            s_proj, r_proj = _project_textedit_search_replace(raw_te)
            order_idx = _next_order()
            files.setdefault(current_file, []).append({
                "id": current_id or f"cell_{order_idx}",
                "order": order_idx,
                "type": "textedit",
                "line_start": state_start_line,
                "line_end": close_line_no,
                "comment": "\n".join(comment_lines).strip(),
                "raw_textedit": raw_te,
                "search": s_proj,
                "replace": r_proj,
            })
        comment_lines = []
        ast_lines = []
        current_id = None
        state = "OUTSIDE"

    def _synchronize_unclosed_state(next_marker_label: str):
        if state == "SEARCH_SPAN":
            _emit_malformed_block(
                current_file,
                f"Unclosed '<<<<<<< SEARCH' block (encountered '{next_marker_label}' before '>>>>>>> REPLACE').",
                state_start_line,
                body_lines,
            )
        elif state in ("TEXTEDIT", "JSON_PATCH", "RELOCATE", "RENAME", "MOVE_FILE", "ARCHIVE_FILE", "DELETE_FILE"):
            _emit_malformed_block(
                current_file,
                f"Unclosed '<<<<<<< {state}' directive (encountered '{next_marker_label}' before closing tag).",
                state_start_line,
                ast_lines,
            )

    for offset, line in enumerate(all_lines[start_line_idx:]):
        line_no = start_line_idx + offset + 1
        cand = _clean_marker_candidate(line)

        m_file = _MARKER_FILE_RE.match(cand)
        if m_file:
            _synchronize_unclosed_state("<<<<<<< FILE:")
            raw_file_target = m_file.group(1).strip()
            current_file = str(InSetuURI.from_external_input(raw_file_target)) if raw_file_target else ""
            if current_file:
                files.setdefault(current_file, [])
                file_header_lines.setdefault(current_file, line_no)
            current_id = None
            comment_lines = []
            state = "OUTSIDE"
            continue

        m_id = _MARKER_ID_RE.match(cand)
        if m_id and state in ("OUTSIDE", "COMMENT"):
            current_id = m_id.group(1).strip()
            continue

        m_open = _MARKER_OPEN_RE.match(cand)
        if m_open:
            directive = m_open.group(1).upper()
            if directive == "COMMENT":
                _synchronize_unclosed_state("<<<<<<< COMMENT")
                state = "COMMENT"
                state_start_line = line_no
                comment_lines = []
            elif directive.startswith("SEARCH"):
                _synchronize_unclosed_state("<<<<<<< SEARCH")
                state = "SEARCH_SPAN"
                state_start_line = line_no
                body_lines = []
                current_type = "regex" if "REGEX" in directive else "exact"
            else:
                _synchronize_unclosed_state(f"<<<<<<< {directive}")
                state = directive
                state_start_line = line_no
                ast_lines = []
            continue

        m_close = _MARKER_CLOSE_RE.match(cand)
        if m_close:
            close_kind = m_close.group(1).upper()
            if close_kind == "EXECUTE":
                _flush_directive_block(line_no)
            elif close_kind == "REPLACE":
                if state in ("TEXTEDIT", "JSON_PATCH", "RELOCATE", "RENAME", "MOVE_FILE", "ARCHIVE_FILE", "DELETE_FILE"):
                    _flush_directive_block(line_no)
                elif state == "SEARCH_SPAN":
                    _flush_search_replace_span(line_no)
                else:
                    state = "OUTSIDE"
            continue

        if _MARKER_SEP_RE.match(cand) and state in ("OUTSIDE", "COMMENT") and current_file:
            print(f"  [~] Warning: Missing '<<<<<<< SEARCH' tag detected for {current_file} at line {line_no}. Auto-healing as a genesis patch.")
            state = "SEARCH_SPAN"
            state_start_line = line_no
            current_type = "exact"
            body_lines = ["======="]
            continue

        if state == "COMMENT":
            comment_lines.append(line)
        elif state == "SEARCH_SPAN":
            body_lines.append(line)
        elif state in ("RELOCATE", "RENAME", "MOVE_FILE", "ARCHIVE_FILE", "DELETE_FILE", "TEXTEDIT", "JSON_PATCH"):
            ast_lines.append(line)

    _synchronize_unclosed_state("EOF")

    for f_uri, blk_list in list(files.items()):
        if not blk_list:
            hdr_line = file_header_lines.get(f_uri, 1)
            _emit_malformed_block(
                f_uri,
                "File header declared without any complete SEARCH/REPLACE or directive block.",
                hdr_line,
                [],
            )

    return files


def flatten_parsed_blocks(parsed_structure: Dict[str, List[Dict[str, Any]]]) -> List[Tuple[str, int, Dict[str, Any]]]:
    """
    Returns a flat list of (raw_target_file, block_index_in_file, block_dict) sorted strictly
    by the canonical 0..n creation order ('order') in which blocks appeared in the payload.
    """
    flat: List[Tuple[int, str, int, Dict[str, Any]]] = []
    seq = 0
    for raw_file, blocks in (parsed_structure or {}).items():
        for b_idx, blk in enumerate(blocks or []):
            order_val = blk.get("order") if isinstance(blk.get("order"), int) else seq
            flat.append((order_val, raw_file, b_idx, blk))
            seq += 1
    flat.sort(key=lambda item: item[0])
    return [(raw_file, b_idx, blk) for _, raw_file, b_idx, blk in flat]


def serialize_block_chunk(
    block: Dict[str, Any],
    filepath: str = "",
    include_file_header: bool = False,
    include_id: bool = False,
) -> str:
    """
    Single Source of Truth serializer for a single Yomama block dict.
    When `include_file_header=False` and `include_id=False`, emits the exact body stored in `BridgeStore.cells[].content`.
    """
    lines: List[str] = []
    if include_file_header and filepath:
        lines.append(f"<<<<<<< FILE: {filepath}")
    if include_id and block.get("id"):
        lines.append(f"<<<<<<< ID: {block['id']}")
    if block.get("comment"):
        lines.append(f"<<<<<<< COMMENT\n{block['comment']}")
    b_type = block.get("type", "exact")
    if b_type in ("relocate", "rename", "move_file", "archive_file", "delete_file"):
        header_map = {
            "relocate": "<<<<<<< RELOCATE",
            "rename": "<<<<<<< RENAME",
            "move_file": "<<<<<<< MOVE_FILE",
            "archive_file": "<<<<<<< ARCHIVE_FILE",
            "delete_file": "<<<<<<< DELETE_FILE",
        }
        raw_dir = block.get("raw_directive", "")
        if not raw_dir:
            if b_type == "move_file":
                raw_dir = f"FROM: {block.get('source_uri') or filepath}\nTO: {block.get('target_uri') or ''}"
            elif b_type in ("archive_file", "delete_file"):
                raw_dir = f"FILE: {block.get('source_uri') or filepath}"
        lines.append(f"{header_map[b_type]}\n{raw_dir}\n>>>>>>> EXECUTE")
    elif b_type == "json_patch":
        body_str = block.get("patch_body") or block.get("raw_directive") or block.get("replace", "")
        lines.append(f"<<<<<<< JSON_PATCH\n{body_str}\n>>>>>>> REPLACE")
    elif b_type == "textedit" and block.get("raw_textedit"):
        lines.append(f"<<<<<<< TEXTEDIT\n{block['raw_textedit']}\n>>>>>>> REPLACE")
    else:
        search_header = "<<<<<<< SEARCH REGEX" if b_type == "regex" else "<<<<<<< SEARCH"
        lines.append(f"{search_header}\n{block.get('search', '')}\n=======\n{block.get('replace', '')}\n>>>>>>> REPLACE")
    return "\n".join(lines)


def serialize_blocks_to_yomama(file_to_blocks: Dict[str, List[Dict[str, Any]]]) -> str:
    """Serializes a mapping of filepath -> block dicts into canonical Yomama patch text, preserving canonical 0..n order across interleaved files."""
    flat = flatten_parsed_blocks(file_to_blocks)
    if not flat:
        return ""
    groups: List[str] = []
    current_fp: Optional[str] = None
    current_lines: List[str] = []
    for raw_fp, _, blk in flat:
        if raw_fp != current_fp:
            if current_lines:
                groups.append("\n".join(current_lines))
            current_fp = raw_fp
            current_lines = [f"<<<<<<< FILE: {raw_fp}"]
        current_lines.append(
            serialize_block_chunk(blk, filepath=raw_fp, include_file_header=False, include_id=bool(blk.get("id")))
        )
    if current_lines:
        groups.append("\n".join(current_lines))
    return "\n\n".join(groups)
