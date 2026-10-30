import os
import re
import ast
import json
import threading
import hashlib
import time
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple, TypedDict
from insetu.core.sdk import InSetuExtension
from insetu.core.utils_core import (
    get_repo_path,
    load_config,
    build_tree_dict,
    execute_binary,
    InSetuURI,
    parse_frontmatter,
)
from insetu.core.topology.engine_topology import get_valid_workspace_files, get_topology_files_for_repo
from insetu.core.languages import (
    SUPPORTED_SYMBOL_EXTENSIONS,
    describe_source_file,
    extract_file_symbols,
    extract_symbol_source_slice,
    first_sentence as _first_sentence,
)
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
CARTOGRAPHER_SCHEMA = {
    "symbol_ledger": {
        "symbol_key": "TEXT PRIMARY KEY",
        "repo": "TEXT",
        "filepath": "TEXT",
        "symbol_name": "TEXT",
        "signature": "TEXT",
        "body_hash": "TEXT",
        "verified_hash": "TEXT",
        "comment": "TEXT",
        "status": "TEXT",
        "updated_at": "REAL"
    },
    "file_descriptions": {
        "file_uri": "TEXT PRIMARY KEY",
        "description": "TEXT",
        "source": "TEXT",
        "updated_at": "REAL"
    }
}

cartographer_bp = InSetuExtension(
    'cartographer',
    __name__,
    title="Cartographer",
    description="AST symbol index mapping and on-demand source span extraction.",
    core=True,
    schema=CARTOGRAPHER_SCHEMA,
    settings_schema=CARTOGRAPHER_SETTINGS_SCHEMA,
)
SCRIPT_DIR = Path(__file__).resolve().parent.as_posix()
_CARTOGRAPHER_SIG_CACHE = {}
_CARTOGRAPHER_CACHE_LOCK = threading.Lock()
_CARTOGRAPHER_SYMBOL_CACHE: Dict[Tuple[str, str], Tuple[str, List[Dict[str, Any]]]] = {}




@cartographer_bp.on('bridge_files_created')
def _record_genesis_descriptions(ctx, descriptions: Optional[Dict[str, str]] = None, workspace_id=None, **kwargs):
    """Stores the first sentence of each genesis patch COMMENT as the new file's pending CODE_INDEX.md description."""
    rows = []
    now_ts = time.time()
    for raw_uri, raw_comment in (descriptions or {}).items():
        summary = _first_sentence(str(raw_comment or ""))
        if raw_uri and summary:
            rows.append((str(InSetuURI(raw_uri)), summary, "genesis_comment", now_ts))
    if not rows:
        return
    ctx.db.executemany(
        "INSERT OR REPLACE INTO file_descriptions (file_uri, description, source, updated_at) VALUES (?, ?, ?, ?)",
        rows,
    )
    ctx.db.commit()


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
                # Ignore system placeholders, reST underline artifacts, and synthetic tautologies to prevent placeholder lock-in
                is_synthetic_tautology = (
                    (comment.startswith((
                        "Function ",
                        "Class definition for ",
                        "TypedDict contract for ",
                        "Async handler ",
                    )) and comment.endswith("."))
                    or "~~~~" in comment
                )
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
                if sym_comment:
                    clean_sym_comment = re.sub(r'^\[stale\?\]\s*', '', str(sym_comment)).strip()
                    if sym.get("is_stale"):
                        sym_comment_str = f" # [stale?] {clean_sym_comment}"
                    else:
                        sym_comment_str = f" # {clean_sym_comment}"
                else:
                    sym_comment_str = " # [comment required]"
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
class CartographerVerifySymbolsPayload(TypedDict, total=False):
    repo: Optional[str]
    symbols: Optional[List[str]]
    verify_all_documented: Optional[bool]


@cartographer_bp.route('verify_symbols', methods=['POST'], request_schema=CartographerVerifySymbolsPayload, docstring="[sync] Marks specified symbol_keys (or all documented symbols in a repo) as verified at their current AST body_hash, clearing [stale?] flags.")
def api_cartographer_verify_symbols(ctx):
    data = ctx.payload or {}
    repo = str(data.get("repo") or "").strip()
    symbols = data.get("symbols") or []
    verify_all = bool(data.get("verify_all_documented", not symbols))
    now_ts = time.time()
    updated = 0
    if symbols and isinstance(symbols, list):
        for s_key in symbols:
            clean_k = str(s_key or "").strip()
            if not clean_k:
                continue
            cur = ctx.db.execute(
                "UPDATE symbol_ledger SET verified_hash = body_hash, status = 'verified', updated_at = ? "
                "WHERE (symbol_key = ? OR filepath || '/' || signature = ? OR symbol_name = ?) AND comment != ''",
                (now_ts, clean_k, clean_k, clean_k),
            )
            updated += cur.rowcount
    elif verify_all:
        if repo:
            cur = ctx.db.execute(
                "UPDATE symbol_ledger SET verified_hash = body_hash, status = 'verified', updated_at = ? "
                "WHERE repo = ? AND comment != '' AND status = 'stale'",
                (now_ts, repo),
            )
        else:
            cur = ctx.db.execute(
                "UPDATE symbol_ledger SET verified_hash = body_hash, status = 'verified', updated_at = ? "
                "WHERE comment != '' AND status = 'stale'",
                (now_ts,),
            )
        updated += cur.rowcount
    ctx.db.commit()
    with _CARTOGRAPHER_CACHE_LOCK:
        _CARTOGRAPHER_SIG_CACHE.clear()
        _CARTOGRAPHER_SYMBOL_CACHE.clear()
    target_repos = [repo] if repo else None
    map_repositories(ctx.workspace_id, target_repos=target_repos)
    ctx.sync_vfs_barrier()
    return {"status": "success", "verified_count": updated}


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
                existing_c = comments.get(key) or comments.get(sig) or s.get("docstring") or ""
                if not existing_c or str(existing_c).strip().startswith("[stale?]"):
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

        # Tier 2 Markdown Frontmatter & Heading Fallback for undocumented .md files (Routines, Prompts, ADRs)
        for rel_f in filtered_files:
            if _is_path_managed(rel_f, managed_dirs):
                continue
            if Path(rel_f).suffix.lower() != ".md":
                continue
            if rel_f in comments or Path(rel_f).name in comments:
                continue
            f_text = ctx.vfs.read(f"vfs://{repo_dir}/{rel_f}") or ""
            md_desc = ""
            if f_text.strip():
                fm_data, body_text, _ = parse_frontmatter(f_text)
                if isinstance(fm_data, dict):
                    md_desc = _first_sentence(str(fm_data.get("description") or fm_data.get("title") or ""))
                if not md_desc and body_text:
                    for raw_l in body_text.splitlines():
                        clean_l = raw_l.strip()
                        if clean_l.startswith("#"):
                            md_desc = _first_sentence(clean_l.lstrip("#").strip())
                            if md_desc:
                                break
            if not md_desc and "adrs/" in rel_f:
                stem = re.sub(r'^\d+-', '', Path(rel_f).stem).replace('-', ' ').strip()
                if stem:
                    md_desc = f"ADR: {stem[:1].upper() + stem[1:]}."
            if md_desc:
                comments[rel_f] = md_desc

        # Tier 2 fallbacks for files the index does not describe yet (hand-written index text always wins):
        # 2a. the first sentence of the Yomama genesis patch COMMENT that created the file;
        # 2b. for .py/.js/.ts files, the module docstring or leading file comment.
        try:
            genesis_rows = ctx.db.execute(
                "SELECT file_uri, description FROM file_descriptions WHERE file_uri LIKE ?",
                (f"vfs://{repo_dir}/%",),
            ).fetchall()
            genesis_descriptions = {r["file_uri"]: r["description"] for r in genesis_rows}
        except Exception:
            genesis_descriptions = {}
        for rel_f in filtered_files:
            if rel_f in comments or _is_path_managed(rel_f, managed_dirs):
                continue
            genesis_desc = genesis_descriptions.get(f"vfs://{repo_dir}/{rel_f}")
            if genesis_desc:
                comments[rel_f] = genesis_desc
                continue
            if Path(rel_f).suffix.lower() not in SUPPORTED_SYMBOL_EXTENSIONS:
                continue
            src_desc = describe_source_file(rel_f, ctx.vfs.read(f"vfs://{repo_dir}/{rel_f}") or "")
            if src_desc:
                comments[rel_f] = src_desc

        symbol_map: Dict[str, List[Dict[str, Any]]] = {}
        symbol_sig_parts = []
        if include_symbols:
            for rel_f in filtered_files:
                if _is_path_managed(rel_f, managed_dirs):
                    continue
                ext = Path(rel_f).suffix.lower()
                if ext not in SUPPORTED_SYMBOL_EXTENSIONS:
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
                    symbol_map[rel_f] = [dict(s) for s in extracted_syms]

        # Reconcile extracted AST symbols with symbol_ledger to detect silent implementation drift ([stale?])
        if include_symbols and symbol_map:
            try:
                existing_rows = ctx.db.execute(
                    "SELECT symbol_key, body_hash, verified_hash, comment, status FROM symbol_ledger WHERE repo = ?",
                    (repo_dir,),
                ).fetchall()
                ledger_map = {r["symbol_key"]: dict(r) for r in existing_rows}
            except Exception:
                ledger_map = {}

            now_ts = time.time()
            upserts = []
            seen_keys = set()
            for rel_f, syms in symbol_map.items():
                f_uri = f"vfs://{repo_dir}/{rel_f}"
                for sym in syms:
                    sig = sym["signature"]
                    sym_rel_key = f"{rel_f}/{sig}"
                    sym_key = f"{f_uri}::{sig}"
                    seen_keys.add(sym_key)
                    b_hash = sym.get("body_hash") or ""
                    raw_comment = (
                        comments.get(sym_rel_key)
                        or comments.get(f"{rel_f}::{sig}")
                        or comments.get(sig)
                        or sym.get("docstring")
                        or ""
                    ).strip()
                    has_stale_tag_in_index = raw_comment.startswith("[stale?]")
                    clean_comment = re.sub(r'^\[stale\?\]\s*', '', raw_comment).strip()
                    prev = ledger_map.get(sym_key)

                    if not clean_comment:
                        status = "missing"
                        v_hash = ""
                        is_stale = False
                    elif prev is None:
                        if has_stale_tag_in_index:
                            status = "stale"
                            v_hash = ""
                            is_stale = True
                        else:
                            status = "verified"
                            v_hash = b_hash
                            is_stale = False
                    else:
                        prev_comment = (prev.get("comment") or "").strip()
                        prev_v_hash = (prev.get("verified_hash") or "").strip()
                        prev_status = (prev.get("status") or "verified").strip()
                        # If the comment text in CODE_INDEX.md was updated (or [stale?] was explicitly removed by the user/agent)
                        if clean_comment != prev_comment and not has_stale_tag_in_index:
                            status = "verified"
                            v_hash = b_hash
                            is_stale = False
                        elif prev_status == "stale" and not has_stale_tag_in_index and prev.get("body_hash") == b_hash:
                            # Operator stripped [stale?] in CODE_INDEX.md to confirm existing comment is still accurate
                            status = "verified"
                            v_hash = b_hash
                            is_stale = False
                        elif prev_v_hash and b_hash != prev_v_hash:
                            status = "stale"
                            v_hash = prev_v_hash
                            is_stale = True
                        elif prev_status == "stale":
                            status = "stale"
                            v_hash = prev_v_hash
                            is_stale = True
                        else:
                            status = "verified"
                            v_hash = b_hash
                            is_stale = False

                    sym["is_stale"] = is_stale
                    comments[sym_rel_key] = f"[stale?] {clean_comment}" if (is_stale and clean_comment) else clean_comment
                    upserts.append((
                        sym_key,
                        repo_dir,
                        f_uri,
                        sym["name"],
                        sig,
                        b_hash,
                        v_hash,
                        clean_comment,
                        status,
                        now_ts,
                    ))
                symbol_sig_parts.append((
                    rel_f,
                    tuple((s["signature"], s.get("body_hash", ""), bool(s.get("is_stale"))) for s in syms),
                ))

            try:
                if upserts:
                    ctx.db.executemany(
                        "INSERT OR REPLACE INTO symbol_ledger "
                        "(symbol_key, repo, filepath, symbol_name, signature, body_hash, verified_hash, comment, status, updated_at) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        upserts,
                    )
                stale_keys = [k for k in ledger_map.keys() if k not in seen_keys]
                if stale_keys:
                    placeholders = ",".join(["?"] * len(stale_keys))
                    ctx.db.execute(f"DELETE FROM symbol_ledger WHERE symbol_key IN ({placeholders})", tuple(stale_keys))
                ctx.db.commit()
            except Exception:
                pass

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