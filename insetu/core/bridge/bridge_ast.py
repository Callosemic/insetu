import io
import re
import json
import fnmatch
import tokenize
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from insetu.core.utils_core import InSetuURI, get_sister_repos
from insetu.core.cartographer.cartographer import extract_symbol_source_slice
from insetu.core.topology.engine_topology import get_omniscient_workspace_files


def apply_ast_relocate_in_memory(
    source_content: str,
    target_content: Optional[str],
    source_uri: str,
    target_uri: str,
    symbol: str,
) -> Tuple[bool, str, str, str]:
    """
    Byte-exact AST symbol cut-and-paste from source_content into target_content.
    Returns (ok, updated_source_content, updated_target_content, status_or_error).
    """
    if not symbol or not source_uri or not target_uri:
        return False, source_content or "", target_content or "", "RELOCATE requires SYMBOL, FROM, and TO fields."

    if source_content is None:
        return False, "", target_content or "", f"Source file '{source_uri}' not found."

    target_base = target_content or ""

    try:
        span = extract_symbol_source_slice(source_uri, source_content, symbol)
    except ValueError as e:
        return False, source_content, target_base, str(e)

    if not span:
        # Idempotency check: if symbol is already in target_content and absent from source_content
        try:
            already_in_target = extract_symbol_source_slice(target_uri, target_base, symbol) if target_base else None
        except ValueError:
            already_in_target = None
        if already_in_target:
            return True, source_content, target_base, "idempotent"
        return False, source_content, target_base, f"Symbol '{symbol}' not found in source file '{source_uri}'."

    slice_text = span["source"]
    start_line = span["start_line"]
    end_line = span["end_line"]

    src_lines = source_content.splitlines()
    remaining_lines = src_lines[:start_line - 1] + src_lines[end_line:]
    new_source = re.sub(r'\n{3,}', '\n\n', "\n".join(remaining_lines)).strip()
    if new_source:
        new_source += "\n"

    # Guard against duplicating the symbol if target already has it
    try:
        existing_in_target = extract_symbol_source_slice(target_uri, target_base, symbol) if target_base else None
    except ValueError:
        existing_in_target = None

    if existing_in_target:
        t_lines = target_base.splitlines()
        t_start = existing_in_target["start_line"]
        t_end = existing_in_target["end_line"]
        updated_t_lines = t_lines[:t_start - 1] + slice_text.splitlines() + t_lines[t_end:]
        new_target = "\n".join(updated_t_lines).rstrip() + "\n"
    else:
        if target_base.strip():
            new_target = target_base.rstrip() + "\n\n\n" + slice_text.strip() + "\n"
        else:
            new_target = slice_text.strip() + "\n"

    return True, new_source, new_target, "success"


def _rename_tokens_in_python(content: str, target_symbol: str, new_symbol: str) -> str:
    """Replaces identifier / dotted identifier sequences in Python source while skipping strings and comments."""
    if target_symbol not in content:
        return content
    target_parts = [p.strip() for p in target_symbol.split(".") if p.strip()]
    if not target_parts:
        return content

    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(content).readline))
    except tokenize.TokenError:
        return content

    # Collect (start_row, start_col, end_row, end_col) spans in reverse order
    sig_indices = [
        idx for idx, tok in enumerate(tokens)
        if tok.type not in (tokenize.NL, tokenize.NEWLINE, tokenize.INDENT, tokenize.DEDENT, tokenize.COMMENT, tokenize.ENCODING)
    ]

    pattern_seq: List[Tuple[int, str]] = []
    for i, part in enumerate(target_parts):
        if i > 0:
            pattern_seq.append((tokenize.OP, "."))
        pattern_seq.append((tokenize.NAME, part))

    pat_len = len(pattern_seq)
    spans_to_replace: List[Tuple[Tuple[int, int], Tuple[int, int]]] = []
    i = 0
    while i <= len(sig_indices) - pat_len:
        matched = True
        for offset, (exp_type, exp_str) in enumerate(pattern_seq):
            tok = tokens[sig_indices[i + offset]]
            if tok.type != exp_type or tok.string != exp_str:
                matched = False
                break
        if matched:
            # Ensure it's not preceded by a dot if target_symbol is a bare identifier
            if len(target_parts) == 1 and i > 0:
                prev_tok = tokens[sig_indices[i - 1]]
                if prev_tok.type == tokenize.OP and prev_tok.string == ".":
                    i += 1
                    continue
            first_tok = tokens[sig_indices[i]]
            last_tok = tokens[sig_indices[i + pat_len - 1]]
            spans_to_replace.append((first_tok.start, last_tok.end))
            i += pat_len
        else:
            i += 1

    if not spans_to_replace:
        return content

    lines = content.splitlines(keepends=True)
    line_offsets = [0]
    for l in lines:
        line_offsets.append(line_offsets[-1] + len(l))

    def to_abs_offset(pos: Tuple[int, int]) -> int:
        row, col = pos
        return line_offsets[row - 1] + col

    out = content
    for start_pos, end_pos in reversed(spans_to_replace):
        s_idx = to_abs_offset(start_pos)
        e_idx = to_abs_offset(end_pos)
        out = out[:s_idx] + new_symbol + out[e_idx:]
    return out


_JS_TOKEN_OR_SKIP_RE = re.compile(
    r'(?P<comment>//[^\n]*|/\*[\s\S]*?\*/)'
    r'|(?P<string>"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|`(?:\\.|[^`\\])*`)'
)


def _rename_tokens_in_code(content: str, target_symbol: str, new_symbol: str) -> str:
    """Replaces target_symbol in JS/TS/other code while ignoring string literals and comments."""
    if target_symbol not in content:
        return content
    escaped_target = r'\s*\.\s*'.join(re.escape(p.strip()) for p in target_symbol.split(".") if p.strip())
    prefix_guard = r'(?<![A-Za-z0-9_$\.])' if "." not in target_symbol else r'(?<![A-Za-z0-9_$])'
    sym_re = re.compile(prefix_guard + f"({escaped_target})" + r'(?![A-Za-z0-9_$])')

    out_parts = []
    last_idx = 0
    for m in _JS_TOKEN_OR_SKIP_RE.finditer(content):
        code_segment = content[last_idx:m.start()]
        if code_segment:
            out_parts.append(sym_re.sub(new_symbol, code_segment))
        out_parts.append(m.group(0))
        last_idx = m.end()
    tail = content[last_idx:]
    if tail:
        out_parts.append(sym_re.sub(new_symbol, tail))
    return "".join(out_parts)


def apply_ast_rename_to_content(filepath: str, content: str, target_symbol: str, new_symbol: str) -> str:
    """Token-aware symbol renamer for a single file buffer."""
    if not content or not target_symbol or not new_symbol or target_symbol == new_symbol:
        return content
    ext = Path(filepath).suffix.lower()
    if ext == ".py":
        return _rename_tokens_in_python(content, target_symbol, new_symbol)
    return _rename_tokens_in_code(content, target_symbol, new_symbol)


def resolve_scope_files(workspace_id: str, scope_prefix: str, allowed_repos: Optional[List[str]] = None) -> List[str]:
    """Resolves a URI prefix or glob pattern (e.g. vfs://insetu/insetu/core/**/*.js) into canonical VFS URIs."""
    repos = allowed_repos or get_sister_repos(workspace_id)
    omniscient = get_omniscient_workspace_files(workspace_id, repos)
    all_uris = [fp for _, fp in omniscient]
    if not scope_prefix or scope_prefix.strip() in ("*", "vfs://", "vfs://*"):
        return all_uris
    norm_scope = str(InSetuURI.from_external_input(scope_prefix))
    matched = []
    for uri_str in all_uris:
        if uri_str == norm_scope or uri_str.startswith(norm_scope.rstrip("/") + "/"):
            matched.append(uri_str)
        elif fnmatch.fnmatch(uri_str, norm_scope) or fnmatch.fnmatch(InSetuURI(uri_str).path, scope_prefix):
            matched.append(uri_str)
    return matched


def generate_commit_message_from_ledger(ctx, repo: Optional[str] = None, transaction_id: Optional[str] = None, limit: int = 10) -> Dict[str, Any]:
    """
    Synthesizes a Conventional Commit message and Transaction-ID trailers directly from
    recent bridge_ledger intent comments (<<<<<<< COMMENT).
    """
    if transaction_id:
        rows = ctx.db.execute(
            "SELECT transaction_id, repo, filepath, chunks_json, timestamp FROM bridge_ledger WHERE transaction_id = ? ORDER BY timestamp ASC",
            (transaction_id,)
        ).fetchall()
    elif repo:
        rows = ctx.db.execute(
            "SELECT transaction_id, repo, filepath, chunks_json, timestamp FROM bridge_ledger WHERE repo = ? ORDER BY timestamp DESC LIMIT ?",
            (repo, limit)
        ).fetchall()
    else:
        rows = ctx.db.execute(
            "SELECT transaction_id, repo, filepath, chunks_json, timestamp FROM bridge_ledger ORDER BY timestamp DESC LIMIT ?",
            (limit,)
        ).fetchall()

    if not rows:
        return {"subject": "chore: update workspace files", "body": "", "commit_message": "chore: update workspace files", "transactions": []}

    tx_ids = []
    repos_touched = []
    comments: List[str] = []
    files_touched: List[str] = []

    for r in rows:
        tx_id = r["transaction_id"]
        if tx_id and tx_id not in tx_ids:
            tx_ids.append(tx_id)
        r_name = r["repo"]
        if r_name and r_name not in repos_touched:
            repos_touched.append(r_name)
        fp = r["filepath"]
        if fp and fp not in files_touched:
            files_touched.append(fp)
        if r["chunks_json"]:
            try:
                chunks = json.loads(r["chunks_json"])
                for ch in chunks:
                    c_text = (ch.get("comment") or "").strip()
                    if c_text and c_text not in comments:
                        comments.append(c_text)
            except Exception:
                pass

    scope = repos_touched[0] if len(repos_touched) == 1 else ("workspace" if len(repos_touched) > 1 else "core")
    if comments:
        primary = comments[0].splitlines()[0].strip().rstrip(".")
        lower_p = primary.lower()
        commit_type = "fix" if any(w in lower_p for w in ("fix", "bug", "heal", "repair", "resolve")) else (
            "refactor" if any(w in lower_p for w in ("refactor", "relocate", "rename", "extract", "clean")) else "feat"
        )
        subject = f"{commit_type}({scope}): {primary[:72]}"
    else:
        basenames = ", ".join(InSetuURI(f).basename for f in files_touched[:3])
        subject = f"chore({scope}): update {basenames}"

    body_lines = [f"- {c}" for c in comments[:8]]
    trailer_lines = [f"Transaction-ID: {tid}" for tid in tx_ids[:5]]
    parts = [subject]
    if body_lines:
        parts.append("\n".join(body_lines))
    if trailer_lines:
        parts.append("\n".join(trailer_lines))
    full_msg = "\n\n".join(parts)

    return {
        "subject": subject,
        "body": "\n".join(body_lines),
        "trailers": trailer_lines,
        "commit_message": full_msg,
        "transactions": tx_ids,
        "files": files_touched,
    }