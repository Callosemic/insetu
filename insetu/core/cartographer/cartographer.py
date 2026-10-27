import os
import re
import ast
import json
import threading
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple, TypedDict
from insetu.core.sdk import InSetuExtension
from insetu.core.utils_core import (
    get_repo_path,
    load_config,
    build_tree_dict,
    execute_binary,
    InSetuURI,
)
from insetu.core.topology.engine_topology import get_valid_workspace_files, get_topology_files_for_repo
CARTOGRAPHER_SETTINGS_SCHEMA = [
    {
        "id": "include_symbols_in_index",
        "label": "Include Public AST Symbols in CODE_INDEX.md",
        "type": "boolean",
        "scope": "workspace",
        "default": True,
        "description": "Extracts top-level classes and public functions into CODE_INDEX.md with a 3-tier docstring waterfall."
    },
    {
        "id": "enrich_undocumented_symbols",
        "label": "LLM Symbol Enrichment (Stage 4)",
        "button_label": "Enrich '[comment required]' Symbols via Fast LLM",
        "type": "action",
        "scope": "workspace",
        "intent": "highlight",
        "endpoint": "cartographer/enrich",
        "description": "Batches undocumented symbol snippets in CODE_INDEX.md into a single fast-tier LLM prompt and writes 1-sentence summaries directly into the index."
    }
]

cartographer_bp = InSetuExtension(
    'cartographer',
    __name__,
    title="Cartographer",
    description="AST symbol index mapping and on-demand source span extraction.",
    core=True,
    settings_schema=CARTOGRAPHER_SETTINGS_SCHEMA,
)
SCRIPT_DIR = Path(__file__).resolve().parent.as_posix()
_CARTOGRAPHER_SIG_CACHE = {}
_CARTOGRAPHER_CACHE_LOCK = threading.Lock()
_CARTOGRAPHER_SYMBOL_CACHE: Dict[Tuple[str, str], Tuple[str, List[Dict[str, Any]]]] = {}


def _first_sentence(text: Optional[str]) -> str:
    """Normalizes the first sentence of a docstring or JSDoc comment for single-line index display."""
    if not text:
        return ""
    cleaned_lines = []
    for raw_line in text.strip().splitlines():
        line = re.sub(r'^\s*\*+\s?', '', raw_line).strip()
        if not line or line.startswith('@'):
            if cleaned_lines:
                break
            continue
        cleaned_lines.append(line)
        if line.endswith('.'):
            break
    joined = " ".join(cleaned_lines).strip()
    if not joined:
        return ""
    sentence_match = re.match(r'^(.+?\.)(?:\s|$)', joined)
    summary = sentence_match.group(1) if sentence_match else joined
    return summary[:140].rstrip() + ("..." if len(summary) > 140 else "")


def _format_py_signature(node: ast.AST) -> str:
    """Formats a canonical, coordinate-free Python class or function signature."""
    if isinstance(node, ast.ClassDef):
        bases = []
        for b in node.bases[:2]:
            try:
                bases.append(ast.unparse(b))
            except Exception:
                pass
        base_str = f"({', '.join(bases)})" if bases else ""
        return f"class {node.name}{base_str}"
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        prefix = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
        arg_names = [a.arg for a in node.args.args if a.arg not in ("self", "cls")]
        if len(arg_names) > 4:
            args_str = ", ".join(arg_names[:4]) + ", ..."
        else:
            args_str = ", ".join(arg_names)
        if node.args.kwarg and len(arg_names) <= 4:
            args_str = f"{args_str}, **{node.args.kwarg.arg}" if args_str else f"**{node.args.kwarg.arg}"
        return f"{prefix} {node.name}({args_str})"
    return ""


def _extract_python_symbols(content: str) -> Optional[List[Dict[str, Any]]]:
    """
    Extracts public top-level classes and functions from Python source code via stdlib ast.
    Returns None if the file has a SyntaxError so callers can preserve prior index entries.
    """
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return None
    lines = content.splitlines()
    symbols: List[Dict[str, Any]] = []
    for node in tree.body:
        if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name.startswith("_"):
                continue
            sig = _format_py_signature(node)
            if not sig:
                continue
            doc = _first_sentence(ast.get_docstring(node))
            start_line = min(
                [node.lineno] + [getattr(d, "lineno", node.lineno) for d in getattr(node, "decorator_list", [])]
            )
            end_line = getattr(node, "end_lineno", node.lineno) or node.lineno
            snippet = "\n".join(lines[max(0, start_line - 1):min(len(lines), start_line - 1 + 30)])
            symbols.append({
                "name": node.name,
                "signature": sig,
                "docstring": doc,
                "start_line": start_line,
                "end_line": end_line,
                "snippet": snippet,
            })
    return symbols


_JS_SYMBOL_RE = re.compile(
    r'^(?P<indent>[ \t]*)'
    r'(?:export\s+(?:default\s+)?)?'
    r'(?:(?P<async>async)\s+)?'
    r'(?:(?P<kind>class|function)\s+(?P<name>[A-Za-z][A-Za-z0-9_]*)\s*(?P<params>\([^;{]*\))?'
    r'|const\s+(?P<cname>[A-Za-z][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?(?P<cparams>\([^=;]*\)|[A-Za-z0-9_]+)\s*=>)',
    re.MULTILINE
)


def _find_brace_balanced_end(lines: List[str], start_idx: int) -> int:
    """Scans forward from start_idx (0-based) to find the closing line of a brace-delimited JS/TS block."""
    depth = 0
    opened = False
    in_str = None
    in_block_comment = False
    for idx in range(start_idx, len(lines)):
        line = lines[idx]
        i = 0
        n = len(line)
        while i < n:
            ch = line[i]
            nxt = line[i + 1] if i + 1 < n else ""
            if in_block_comment:
                if ch == "*" and nxt == "/":
                    in_block_comment = False
                    i += 2
                    continue
                i += 1
                continue
            if in_str:
                if ch == "\\":
                    i += 2
                    continue
                if ch == in_str:
                    in_str = None
                i += 1
                continue
            if ch == "/" and nxt == "/":
                break
            if ch == "/" and nxt == "*":
                in_block_comment = True
                i += 2
                continue
            if ch in ('"', "'", "`"):
                in_str = ch
                i += 1
                continue
            if ch == "{":
                depth += 1
                opened = True
            elif ch == "}":
                depth -= 1
                if opened and depth <= 0:
                    return idx + 1
            i += 1
        if not opened and line.rstrip().endswith(";"):
            return idx + 1
    return min(len(lines), start_idx + 1)


def _extract_preceding_jsdoc(lines: List[str], target_line_idx: int) -> Tuple[str, int]:
    """Returns (first_sentence_jsdoc, earliest_start_line_1based) preceding target_line_idx (0-based)."""
    idx = target_line_idx - 1
    while idx >= 0 and not lines[idx].strip():
        idx -= 1
    if idx < 0:
        return "", target_line_idx + 1
    if lines[idx].strip().endswith("*/"):
        end_comment = idx
        while idx >= 0 and "/*" not in lines[idx]:
            idx -= 1
        if idx >= 0:
            block = "\n".join(lines[idx:end_comment + 1])
            block = re.sub(r'^/\*+|\*+/$', '', block.strip())
            return _first_sentence(block), idx + 1
    elif lines[idx].strip().startswith("//"):
        comment_lines = []
        while idx >= 0 and lines[idx].strip().startswith("//"):
            comment_lines.insert(0, lines[idx].strip().lstrip("/").strip())
            idx -= 1
        return _first_sentence("\n".join(comment_lines)), idx + 2
    return "", target_line_idx + 1


def _extract_js_symbols(content: str) -> List[Dict[str, Any]]:
    """Extracts top-level exported/public classes and functions from JS/TS source code."""
    lines = content.splitlines()
    symbols: List[Dict[str, Any]] = []
    seen_names = set()
    for m in _JS_SYMBOL_RE.finditer(content):
        indent = m.group("indent") or ""
        if len(indent) > 0:
            continue
        name = m.group("name") or m.group("cname") or ""
        if not name or name.startswith("_") or name in seen_names:
            continue
        seen_names.add(name)
        line_idx = content.count("\n", 0, m.start())
        kind = m.group("kind")
        if kind == "class":
            sig = f"class {name}"
        else:
            raw_params = (m.group("params") or m.group("cparams") or "()").strip()
            if not raw_params.startswith("("):
                raw_params = f"({raw_params})"
            clean_params = re.sub(r'\s+', ' ', raw_params)
            if len(clean_params) > 36:
                clean_params = clean_params[:33].rstrip() + "...)"
            sig = f"function {name}{clean_params}"
        doc, start_line = _extract_preceding_jsdoc(lines, line_idx)
        end_line = _find_brace_balanced_end(lines, line_idx)
        snippet = "\n".join(lines[max(0, start_line - 1):min(len(lines), start_line - 1 + 30)])
        symbols.append({
            "name": name,
            "signature": sig,
            "docstring": doc,
            "start_line": start_line,
            "end_line": end_line,
            "snippet": snippet,
        })
    return symbols


def extract_file_symbols(filepath: str, content: str) -> Optional[List[Dict[str, Any]]]:
    """
    Stage 2 Shallow Static AST Extractor:
    Extracts public top-level symbols for .py and .js/.ts/.mjs/.tsx files.
    Returns None if a syntax error prevented parsing.
    """
    if not content:
        return []
    ext = Path(filepath).suffix.lower()
    if ext == ".py":
        return _extract_python_symbols(content)
    if ext in (".js", ".mjs", ".ts", ".tsx"):
        return _extract_js_symbols(content)
    return []


def extract_symbol_source_slice(filepath: str, content: str, symbol_query: str) -> Optional[Dict[str, Any]]:
    """
    Locates a top-level class, method (Class.method or method), or function in `content`
    and returns its exact source slice (including leading decorators and JSDoc/comments).
    """
    if not content or not symbol_query:
        return None
    clean_query = symbol_query.strip()
    if clean_query.startswith(("def ", "async def ", "class ", "function ")):
        clean_query = clean_query.split("(")[0].split()[-1].strip()
    elif "(" in clean_query:
        clean_query = clean_query.split("(", 1)[0].strip()

    lines = content.splitlines()
    ext = Path(filepath).suffix.lower()

    if ext == ".py":
        try:
            tree = ast.parse(content)
        except SyntaxError as e:
            raise ValueError(f"SyntaxError in '{filepath}' at line {e.lineno}: {e.msg}") from e

        target_class, _, target_member = clean_query.partition(".")
        for node in tree.body:
            if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                if not target_member and node.name == target_class:
                    start_line = min(
                        [node.lineno] + [getattr(d, "lineno", node.lineno) for d in getattr(node, "decorator_list", [])]
                    )
                    end_line = getattr(node, "end_lineno", node.lineno) or node.lineno
                    while start_line > 1 and lines[start_line - 2].strip().startswith("#"):
                        start_line -= 1
                    slice_text = "\n".join(lines[start_line - 1:end_line])
                    return {
                        "symbol": node.name,
                        "signature": _format_py_signature(node),
                        "start_line": start_line,
                        "end_line": end_line,
                        "source": slice_text,
                    }
                if isinstance(node, ast.ClassDef) and (node.name == target_class or not target_member):
                    method_name = target_member if target_member else target_class
                    for child in node.body:
                        if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)) and child.name == method_name:
                            if target_member and node.name != target_class:
                                continue
                            start_line = min(
                                [child.lineno] + [getattr(d, "lineno", child.lineno) for d in getattr(child, "decorator_list", [])]
                            )
                            end_line = getattr(child, "end_lineno", child.lineno) or child.lineno
                            slice_text = "\n".join(lines[start_line - 1:end_line])
                            return {
                                "symbol": f"{node.name}.{child.name}",
                                "signature": _format_py_signature(child),
                                "start_line": start_line,
                                "end_line": end_line,
                                "source": slice_text,
                            }
        return None

    # JS / TS / Generic brace-balanced extraction
    target_class, _, target_member = clean_query.partition(".")
    search_name = target_member or target_class
    for sym in _extract_js_symbols(content):
        if sym["name"] == search_name:
            s_line = sym["start_line"]
            e_line = sym["end_line"]
            return {
                "symbol": sym["name"],
                "signature": sym["signature"],
                "start_line": s_line,
                "end_line": e_line,
                "source": "\n".join(lines[s_line - 1:e_line]),
            }

    method_pat = re.compile(
        r'^[ \t]*(?:export\s+)?(?:static\s+)?(?:async\s+)?(?:function\s+|class\s+)?'
        + re.escape(search_name)
        + r'\s*(?:\([^;{]*\))?\s*\{',
        re.MULTILINE
    )
    m = method_pat.search(content)
    if m:
        line_idx = content.count("\n", 0, m.start())
        _, s_line = _extract_preceding_jsdoc(lines, line_idx)
        e_line = _find_brace_balanced_end(lines, line_idx)
        return {
            "symbol": clean_query,
            "signature": clean_query,
            "start_line": s_line,
            "end_line": e_line,
            "source": "\n".join(lines[s_line - 1:e_line]),
        }
    return None

@cartographer_bp.on('register_compilation_steps')
def _register_cartographer_compilation_step(workspace_id=None, **kwargs):
    return [{
        "id": "cartographer_map",
        "anchor": "body",
        "order": 15,
        "depends_on": ["topology_scan"],
        "ext_name": "cartographer",
        "worker_name": "map_task"
    }]
@cartographer_bp.worker("map_task")
def _background_map(
    ctx,
    target_repos: Optional[List[str]] = None,
    ledger_events: Optional[List[Dict[str, Any]]] = None,
):
    ctx.jobs.update_progress("Mapping repository topology...")
    map_repositories(ctx.workspace_id, target_repos=target_repos)
    return {
        "message": "Cartography complete.",
        "next_kwargs": {"ledger_events": ledger_events or []}
    }
def extract_existing_comments(index_path, repo_path=None, vfs_content=None):
    """Pass 1: Extracts path-scoped and basename comments from VFS content, falling back to Git history only if empty."""
    def parse_text_for_comments(text):
        cmap = {}
        basename_first_comment = {}
        path_stack = []
        for line in text.splitlines():
            if "#" in line and any(c in line for c in ("├──", "└──", "│")):
                parts = line.split("#", 1)
                left_part = parts[0]
                clean_name = left_part.lstrip(' │├└─\t').rstrip(' \t')
                comment = parts[1].strip()
                if not clean_name:
                    continue
                prefix_len = len(left_part) - len(left_part.lstrip(' │├└─\t'))
                depth = max(0, (prefix_len // 4) - 1)
                path_stack = path_stack[:depth]
                bare_name = clean_name.rstrip('/')
                path_stack.append(bare_name)
                rel_path = "/".join(path_stack)
                # Ignore system placeholders and synthetic tautologies to prevent placeholder lock-in
                is_synthetic_tautology = comment.startswith((
                    "Function ",
                    "Class definition for ",
                    "TypedDict contract for ",
                    "Async handler ",
                )) and comment.endswith(".")
                if comment not in ("[comment required]", "[managed file]") and not is_synthetic_tautology:
                    cmap[rel_path] = comment
                    cmap[f"{rel_path}/"] = comment
                    basename_first_comment.setdefault(clean_name, comment)
                    basename_first_comment.setdefault(bare_name, comment)
                    basename_first_comment.setdefault(f"{bare_name}/", comment)
        for b_key, b_comment in basename_first_comment.items():
            if b_key not in cmap:
                cmap[b_key] = b_comment
        return cmap

    raw_index = vfs_content
    if raw_index is None and os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            raw_index = f.read()
    live_comments = parse_text_for_comments(raw_index) if raw_index else {}
    git_comments = {}
    if repo_path and (not live_comments or "[comment required]" in (raw_index or "")):
        try:
            rel_index = Path(index_path).resolve().relative_to(Path(repo_path).resolve()).as_posix()
            res = execute_binary(['git', 'show', f'HEAD:{rel_index}'], capture_output=True, text=True, cwd=repo_path)
            if res.returncode == 0:
                git_comments = parse_text_for_comments(res.stdout)
        except Exception:
            pass

    merged = git_comments.copy()
    merged.update(live_comments)
    return merged


def _is_path_managed(current_path: str, managed_dirs: List[str]) -> bool:
    if not current_path or not managed_dirs:
        return False
    norm_cur = current_path.strip("/")
    cur_parts = set(norm_cur.split("/"))
    for d in managed_dirs:
        clean_d = str(d or "").strip("/")
        if not clean_d:
            continue
        if "/" in clean_d:
            if norm_cur == clean_d or norm_cur.startswith(f"{clean_d}/") or f"/{clean_d}/" in f"/{norm_cur}/":
                return True
        elif clean_d in cur_parts:
            return True
    return False
def render_ascii_tree(node, comment_map, managed_dirs, prefix="", current_path="", symbol_map=None):
    """Pass 2: Builds the new tree and injects the 3-tier waterfall comments and shallow AST symbol children."""
    lines = []
    entries = sorted(list(node.keys()))
    symbol_map = symbol_map or {}

    # Declarative management: Check if current path falls under managed folders
    is_managed = _is_path_managed(current_path, managed_dirs)

    for i, key in enumerate(entries):
        is_last = (i == len(entries) - 1)
        connector = "└── " if is_last else "├── "
        # Determine if it's a directory (has children) to match folder keys
        is_dir = isinstance(node[key], dict) and len(node[key]) > 0
        next_path = f"{current_path}/{key}" if current_path else key
        rel_lookup_key = f"{next_path}/" if is_dir else next_path
        lookup_key = f"{key}/" if is_dir else key

        # Attempt to match the relative path key first, then exact basename key, then raw key
        comment = comment_map.get(rel_lookup_key)
        if comment is None:
            comment = comment_map.get(next_path)
        if comment is None:
            comment = comment_map.get(lookup_key)
        if comment is None:
            comment = comment_map.get(key)
        if comment is None:
            # If the folder matches our managed list and the item itself is a file
            if is_managed and not is_dir:
                comment_str = " # [managed file]"
            else:
                comment_str = " # [comment required]"
        elif comment == "":
            comment_str = " #"
        else:
            comment_str = f" # {comment}"

        # Pad the line to align the comments cleanly (e.g., at column 35)
        raw_line = f"{prefix}{connector}{key}{'/' if is_dir else ''}"
        padded_line = raw_line.ljust(35)
        lines.append(f"{padded_line}{comment_str}")
        extension = "    " if is_last else "│   "
        if is_dir:
            lines.extend(render_ascii_tree(node[key], comment_map, managed_dirs, prefix + extension, next_path, symbol_map=symbol_map))
        elif not is_managed and next_path in symbol_map:
            file_symbols = symbol_map[next_path] or []
            for s_idx, sym in enumerate(file_symbols):
                s_last = (s_idx == len(file_symbols) - 1)
                s_conn = "└── " if s_last else "├── "
                sig = sym["signature"]
                sym_rel_key = f"{next_path}/{sig}"
                # 3-Tier Waterfall: Tier 1 (Explicit Map Comment) -> Tier 2 (Docstring) -> Tier 3 (Sentinel)
                sym_comment = (
                    comment_map.get(sym_rel_key)
                    or comment_map.get(f"{next_path}::{sig}")
                    or comment_map.get(sig)
                    or sym.get("docstring")
                )
                sym_comment_str = f" # {sym_comment}" if sym_comment else " # [comment required]"
                sym_raw_line = f"{prefix + extension}{s_conn}{sig}"
                lines.append(f"{sym_raw_line.ljust(35)}{sym_comment_str}")

    return lines


class CartographerExtractPayload(TypedDict):
    filepath: str
    symbol: str


@cartographer_bp.route('extract', methods=['GET', 'POST'], request_schema=CartographerExtractPayload, docstring="[sync] Slices and returns the exact AST source block (including decorators and leading docstrings) for a target class, method, or function without line-number drift.")
def api_cartographer_extract(ctx):
    data = ctx.payload or {}
    raw_fp = str(data.get("filepath") or data.get("file") or "").strip()
    symbol = str(data.get("symbol") or "").strip()
    if not raw_fp or not symbol:
        return {"error": "Both 'filepath' and 'symbol' are required."}, 400
    uri = InSetuURI.from_external_input(raw_fp)
    content = ctx.vfs.read(str(uri))
    if content is None:
        return {"error": f"File not found in VFS: {uri}"}, 404
    try:
        extracted = extract_symbol_source_slice(str(uri), content, symbol)
    except ValueError as e:
        return {"error": str(e)}, 422
    if not extracted:
        return {"error": f"Symbol '{symbol}' not found in '{uri}'."}, 404
    return {
        "status": "success",
        "filepath": str(uri),
        **extracted,
    }


class CartographerEnrichPayload(TypedDict, total=False):
    repo: Optional[str]


@cartographer_bp.route('enrich', methods=['POST'], request_schema=CartographerEnrichPayload, docstring="Batches undocumented symbol snippets in CODE_INDEX.md into a fast-tier LLM call and injects the generated 1-sentence descriptions.")
def api_cartographer_enrich(ctx):
    data = ctx.payload or {}
    target_repo = str(data.get("repo") or "").strip() or None
    job_id = ctx.jobs.submit("enrich_task", job_category="ui_blocking", repo=target_repo)
    return {"status": "accepted", "job_id": job_id}, 202


@cartographer_bp.worker("enrich_task")
def _background_enrich(ctx, repo: Optional[str] = None, job_id: Optional[str] = None):
    target_repos = [repo] if repo else [r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")]
    enriched_total = 0
    for r_dir in target_repos:
        if not r_dir:
            continue
        ctx.jobs.update_progress(f"Enriching undocumented symbols for {r_dir}...")
        r_cfg = next((c for c in ctx.config.get("target_repos", []) if c.get("repo_dir") == r_dir), {})
        logical_index_path = f"vfs://{r_dir}/docs/CODE_INDEX.md" if r_cfg.get("is_core_chassis") else f"vfs://{r_dir}/CODE_INDEX.md"
        index_text = ctx.vfs.read(logical_index_path) or ""
        repo_path = Path(get_repo_path(r_dir, ctx.workspace_id)).resolve()
        index_phys = (repo_path / "docs" / "CODE_INDEX.md") if r_cfg.get("is_core_chassis") else (repo_path / "CODE_INDEX.md")
        comments = extract_existing_comments(index_phys, repo_path, vfs_content=index_text)

        pending_prompts = {}
        for f_uri in get_topology_files_for_repo(ctx.workspace_id, r_dir):
            rel_p = InSetuURI(f_uri).path
            f_content = ctx.vfs.read(f_uri)
            if not f_content:
                continue
            syms = extract_file_symbols(rel_p, f_content) or []
            for s in syms:
                sig = s["signature"]
                key = f"{rel_p}/{sig}"
                if not (comments.get(key) or comments.get(sig) or s.get("docstring")):
                    pending_prompts[key] = s["snippet"]
                if len(pending_prompts) >= 25:
                    break
            if len(pending_prompts) >= 25:
                break

        if not pending_prompts:
            continue

        prompt_items = "\n\n".join([f"KEY: {k}\n```Code\n{snip}\n```" for k, snip in pending_prompts.items()])
        sys_msg = (
            "You are a concise code documentation engine. Return ONLY a valid JSON object mapping each exact KEY "
            "to a single-sentence summary (under 110 characters) describing its responsibility. No markdown fences."
        )
        try:
            llm_res = ctx.call(
                "llm.complete",
                messages=[{"role": "user", "content": prompt_items}],
                system=sys_msg,
                tier="fast",
                wait=True,
            )
            raw_reply = (llm_res.get("text", "") if isinstance(llm_res, dict) else str(llm_res)).strip()
            raw_reply = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw_reply, flags=re.MULTILINE).strip()
            parsed_map = json.loads(raw_reply)
            if isinstance(parsed_map, dict):
                for k, desc in parsed_map.items():
                    if k in pending_prompts and isinstance(desc, str) and desc.strip():
                        comments[k] = _first_sentence(desc.strip())
                        enriched_total += 1
        except Exception as e:
            print(f"⚠️ [Cartographer Enrich] LLM batch failed for {r_dir}: {e}")
            continue

        with _CARTOGRAPHER_CACHE_LOCK:
            _CARTOGRAPHER_SIG_CACHE.pop((ctx.workspace_id or "default", r_dir), None)
        map_repositories(ctx.workspace_id, target_repos=[r_dir], extra_comments={r_dir: comments})

    ctx.sync_vfs_barrier()
    return {"message": f"Enriched {enriched_total} symbol(s).", "artifact": {"enriched_count": enriched_total}}


def map_repositories(workspace_id=None, silent=True, target_repos=None, extra_comments=None):
    if not silent: print(f"\n{'-'*50}\n🚀 inSetu: Mapping Repository Topologies\n{'-'*50}")
    ctx = cartographer_bp.get_context(workspace_id)
    cfg = ctx.config
    all_configs = cfg.get("target_repos", [])
    def process_repo(config):
        repo_dir = config.get("repo_dir")
        if not repo_dir: return
        if target_repos and repo_dir not in target_repos: return
        repo_path = Path(get_repo_path(repo_dir, workspace_id)).resolve()

        index_path = (repo_path / "docs" / "CODE_INDEX.md") if config.get("is_core_chassis") else (repo_path / "CODE_INDEX.md")
        if not repo_path.exists():
            if not silent: print(f"⚠️  Skipping {repo_dir}: Directory not found.")
            return
        if not silent: print(f"🗺️  Cartographing {repo_dir}...")
        logical_index_path = f"vfs://{repo_dir}/docs/CODE_INDEX.md" if config.get("is_core_chassis") else f"vfs://{repo_dir}/CODE_INDEX.md"
        valid_uris = get_topology_files_for_repo(workspace_id, repo_dir)

        if not valid_uris: return
        hidden_managed = {d for d in (set(cfg.get("managed_dirs", [])) | {".insetu-data"}) if d.startswith('.')}
        filtered_files = [
            InSetuURI(u).path for u in valid_uris
            if not any(InSetuURI(u).path.startswith(f"{d}/") or f"/{d}/" in InSetuURI(u).path for d in hidden_managed)
        ]
        if not filtered_files: return
        managed_dirs = config.get("repo_managed_dirs") if config.get("repo_managed_dirs") is not None else cfg.get("managed_dirs", [])
        include_symbols = bool(ctx.settings.get("include_symbols_in_index", True))
        live_vfs_index = ctx.vfs.read(logical_index_path)
        comments = extract_existing_comments(index_path, repo_path, vfs_content=live_vfs_index)
        if isinstance(extra_comments, dict) and isinstance(extra_comments.get(repo_dir), dict):
            comments.update(extra_comments[repo_dir])

        symbol_map: Dict[str, List[Dict[str, Any]]] = {}
        symbol_sig_parts = []
        if include_symbols:
            for rel_f in filtered_files:
                if _is_path_managed(rel_f, managed_dirs):
                    continue
                ext = Path(rel_f).suffix.lower()
                if ext not in (".py", ".js", ".mjs", ".ts", ".tsx"):
                    continue
                f_uri = f"vfs://{repo_dir}/{rel_f}"
                f_text = ctx.vfs.read(f_uri)
                if f_text is None:
                    continue
                f_hash = str(hash(f_text))
                sym_cache_key = (workspace_id or "default", f_uri)
                cached_sym = _CARTOGRAPHER_SYMBOL_CACHE.get(sym_cache_key)
                if cached_sym and cached_sym[0] == f_hash:
                    extracted_syms = cached_sym[1]
                else:
                    extracted_syms = extract_file_symbols(rel_f, f_text)
                    if extracted_syms is None:
                        # Syntax error resilience: retain last known good symbols from cache
                        extracted_syms = cached_sym[1] if cached_sym else []
                    else:
                        _CARTOGRAPHER_SYMBOL_CACHE[sym_cache_key] = (f_hash, extracted_syms)
                if extracted_syms:
                    symbol_map[rel_f] = extracted_syms
                    symbol_sig_parts.append((rel_f, tuple(s["signature"] for s in extracted_syms)))

        cache_key = (workspace_id or "default", repo_dir)
        pre_sig = (tuple(filtered_files), hash(live_vfs_index), tuple(managed_dirs), tuple(symbol_sig_parts), bool(extra_comments))
        with _CARTOGRAPHER_CACHE_LOCK:
            if live_vfs_index is not None and not extra_comments and _CARTOGRAPHER_SIG_CACHE.get(cache_key) == pre_sig:
                return

        tree_dict = build_tree_dict(filtered_files)
        if config.get("is_core_chassis"):
            os.makedirs(Path(index_path).parent, exist_ok=True)

        header = f"# {config.get('title', repo_dir)} Code Index\n\nThis index serves as the architectural map. It outlines the core directories and their operational purpose to maintain a clear mental model of the ecosystem, preventing cognitive overload and logic drift.\n\n```text\n{repo_dir}/\n"
        tree_lines = render_ascii_tree(tree_dict, comments, managed_dirs, symbol_map=symbol_map)
        footer = "\n```\n"
        rendered_index = header + "\n".join(tree_lines) + footer
        if rendered_index != live_vfs_index:
            ctx.vfs.save(logical_index_path, rendered_index, data={"ignore_ledger": True})
        post_sig = (tuple(filtered_files), hash(rendered_index), tuple(managed_dirs), tuple(symbol_sig_parts), False)
        with _CARTOGRAPHER_CACHE_LOCK:
            _CARTOGRAPHER_SIG_CACHE[cache_key] = post_sig

        missing = sum(1 for line in tree_lines if "[comment required]" in line)
        if not silent:
            if missing > 0:
                print(f"  └─ ✅ Index updated. ⚠️ {missing} placeholders require attention.")
            else:
                print(f"  └─ ✅ Index updated. Perfect documentation parity.")
    ctx.jobs.map_parallel(process_repo, all_configs)

    if not silent: print("\n🎉 Cartography complete!\n")

if __name__ == "__main__":
    map_repositories()