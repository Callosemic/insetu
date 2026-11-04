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
    VFSTransaction,
    get_repo_path,
    load_config,
    build_tree_dict,
    execute_binary,
    InSetuURI,
    parse_frontmatter,
)
from insetu.core.topology.engine_topology import (
    get_topology_files_for_repo,
    get_valid_workspace_files,
    resolve_repo_code_index_uri,
)
from insetu.core.languages import (
    SUPPORTED_SYMBOL_EXTENSIONS,
    describe_directory,
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
        "button_label": "Describe Missing and Review [stale?] Symbols via Fast LLM",
        "type": "action",
        "scope": "workspace",
        "intent": "highlight",
        "endpoint": "cartographer/enrich",
        "description": "One fast-tier LLM call per repository: writes a one-sentence description for each '[comment required]' symbol, and reviews each '[stale?]' description against the changed code, keeping it (and clearing the flag) when it is still accurate or revising only what the code made wrong."
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
__depends__ = ['topology']
SCRIPT_DIR = Path(__file__).resolve().parent.as_posix()
_CARTOGRAPHER_SIG_CACHE = {}
_CARTOGRAPHER_CACHE_LOCK = threading.Lock()
_CARTOGRAPHER_SYMBOL_CACHE: Dict[Tuple[str, str], Tuple[str, List[Dict[str, Any]]]] = {}

# file_descriptions sources. CODE_INDEX.md is the source of truth; these rows are its working memory.
DESCRIPTION_SOURCE_GENESIS = "genesis_comment"   # first sentence of the patch COMMENT that created the file
DESCRIPTION_SOURCE_INDEX = "code_index"          # mirror of the index text for a path that is currently in the topology
DESCRIPTION_SOURCE_ORPHAN = "code_index_orphan"  # index text kept for a path that left the topology
# How long the text of a path that left the topology is kept, so it comes back if the path does.
ORPHANED_DESCRIPTION_TTL_SECONDS = 90 * 24 * 3600
# map_repositories never saves a render built from an index that changed while it ran; it maps again, this many times.
INDEX_CHANGED_DURING_MAP = "index_changed_during_map"
MAX_INDEX_RACE_RETRIES = 3




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


@cartographer_bp.on('ensure_cartography_fresh')
def _handle_ensure_cartography_fresh(target_repos=None, workspace_id=None, **kwargs):
    map_repositories(workspace_id, silent=True, target_repos=target_repos)


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
        basename_comment = {}
        basename_count = {}
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
                # Every entry counts toward its name's uniqueness, described or not.
                basename_count[bare_name] = basename_count.get(bare_name, 0) + 1
                if comment not in ("[comment required]", "[managed file]") and not is_synthetic_tautology:
                    cmap[rel_path] = comment
                    cmap[f"{rel_path}/"] = comment
                    basename_comment.setdefault(bare_name, comment)
        # A bare name (a file or symbol without its path) is a fallback for an entry that moved. It is only kept when
        # the name appears once in the index: 'def main(argv)', '__init__.py' or 'class Test(unittest.TestCase)' name
        # many entries, and borrowing one entry's text for another wrote wrong descriptions into the index.
        for bare_name, b_comment in basename_comment.items():
            if basename_count.get(bare_name) == 1:
                for b_key in (bare_name, f"{bare_name}/"):
                    cmap.setdefault(b_key, b_comment)
        return cmap

    raw_index = vfs_content
    if raw_index is None and os.path.exists(index_path):
        with VFSTransaction() as vfs:
            raw_index = vfs.read(str(index_path), is_absolute_artifact=True)
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


@cartographer_bp.route('enrich', methods=['POST'], request_schema=CartographerEnrichPayload, docstring="Describes '[comment required]' symbols and reviews '[stale?]' descriptions against their changed code in one fast-tier LLM call per repository.")
def api_cartographer_enrich(ctx):
    data = ctx.payload or {}
    target_repo = str(data.get("repo") or "").strip() or None
    job_id = ctx.jobs.submit("enrich_task", job_category="ui_blocking", repo=target_repo)
    return {"status": "accepted", "job_id": job_id}, 202


ENRICH_BATCH_SIZE = 25
# What the LLM answers for a '[stale?]' description that is still accurate for the changed code.
ENRICH_KEEP = "KEEP"
ENRICH_SYSTEM_PROMPT = (
    "You maintain the descriptions in a code index. Reply with ONLY a JSON object (no markdown fences) mapping each KEY "
    "to its answer.\n"
    "- DESCRIBE items: a one-sentence description (under 110 characters) of the symbol's responsibility.\n"
    "- REVIEW items: the code changed since its description was written. If the description is still accurate, answer "
    "exactly \"KEEP\". Otherwise answer a revised one-line description that keeps every statement that is still true, "
    "including intent, constraints and context the code does not show, and changes only what the code made wrong."
)


def _enrich_reply_map(raw_reply: str) -> Dict[str, Any]:
    cleaned = re.sub(r'^```(?:json)?\s*|\s*```$', '', (raw_reply or "").strip(), flags=re.MULTILINE).strip()
    parsed = json.loads(cleaned)
    return parsed if isinstance(parsed, dict) else {}


@cartographer_bp.worker("enrich_task")
def _background_enrich(ctx, repo: Optional[str] = None, job_id: Optional[str] = None):
    """
    Describes '[comment required]' symbols and reviews '[stale?]' ones. A reviewed description the LLM keeps stays word for
    word and is verified at the current code (as verify_symbols does for a person); a revised one replaces it only if
    the index still holds the text the LLM reviewed.
    """
    target_repos = [repo] if repo else [r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")]
    totals = {"described": 0, "kept": 0, "revised": 0}
    for r_dir in target_repos:
        if not r_dir:
            continue
        ctx.jobs.update_progress(f"Describing and reviewing symbols for {r_dir}...")
        r_cfg = next((c for c in ctx.config.get("target_repos", []) if c.get("repo_dir") == r_dir), {})
        logical_index_path = resolve_repo_code_index_uri(ctx, r_dir, r_cfg)
        index_text = ctx.vfs.read(logical_index_path) or ""
        repo_path = Path(get_repo_path(r_dir, ctx.workspace_id)).resolve()
        index_phys = repo_path / InSetuURI(logical_index_path).path
        comments = extract_existing_comments(index_phys, repo_path, vfs_content=index_text)

        to_describe: Dict[str, str] = {}
        to_review: Dict[str, Tuple[str, str, str]] = {}  # key -> (index text as reviewed, description, snippet)
        ledger_keys: Dict[str, str] = {}
        for f_uri in get_topology_files_for_repo(ctx.workspace_id, r_dir):
            rel_p = InSetuURI(f_uri).path
            f_content = ctx.vfs.read(f_uri)
            if not f_content:
                continue
            for s in extract_file_symbols(rel_p, f_content) or []:
                sig = s["signature"]
                key = f"{rel_p}/{sig}"
                existing = str(comments.get(key) or comments.get(sig) or s.get("docstring") or "").strip()
                if not existing:
                    to_describe[key] = s["snippet"]
                elif existing.startswith("[stale?]"):
                    description = re.sub(r'^\[stale\?\]\s*', '', existing).strip()
                    to_review[key] = (existing, description, s["snippet"])
                    ledger_keys[key] = f"{f_uri}::{sig}"
                if len(to_describe) + len(to_review) >= ENRICH_BATCH_SIZE:
                    break
            if len(to_describe) + len(to_review) >= ENRICH_BATCH_SIZE:
                break
        if not to_describe and not to_review:
            continue

        sections = [f"DESCRIBE\nKEY: {k}\n```Code\n{snip}\n```" for k, snip in to_describe.items()]
        sections += [
            f"REVIEW\nKEY: {k}\nCURRENT DESCRIPTION: {desc}\n```Code\n{snip}\n```"
            for k, (_seen, desc, snip) in to_review.items()
        ]
        try:
            llm_res = ctx.call(
                "llm.complete",
                messages=[{"role": "user", "content": "\n\n".join(sections)}],
                system=ENRICH_SYSTEM_PROMPT,
                tier="fast",
                wait=True,
            )
            reply = _enrich_reply_map(llm_res.get("text", "") if isinstance(llm_res, dict) else str(llm_res))
        except Exception as e:
            print(f"⚠️ [Cartographer Enrich] LLM batch failed for {r_dir}: {e}")
            continue

        generated: Dict[str, Any] = {}
        keep_keys: List[str] = []
        for key, answer in reply.items():
            text = " ".join(str(answer or "").split())
            if not text:
                continue
            if key in to_describe:
                generated[key] = _first_sentence(text)
                totals["described"] += 1
            elif key in to_review:
                seen, description, _snip = to_review[key]
                if text.strip('"').upper() == ENRICH_KEEP or text == description:
                    keep_keys.append(ledger_keys[key])
                    totals["kept"] += 1
                else:
                    # Replaces the description only if the index still holds the text that was reviewed.
                    generated[key] = {"text": text, "replaces": seen}
                    totals["revised"] += 1
        if keep_keys:
            now_ts = time.time()
            ctx.db.executemany(
                "UPDATE symbol_ledger SET verified_hash = body_hash, status = 'verified', updated_at = ? WHERE symbol_key = ?",
                [(now_ts, k) for k in keep_keys],
            )
            ctx.db.commit()

        with _CARTOGRAPHER_CACHE_LOCK:
            _CARTOGRAPHER_SIG_CACHE.pop((ctx.workspace_id or "default", r_dir), None)
        map_repositories(ctx.workspace_id, target_repos=[r_dir], extra_comments={r_dir: generated})

    ctx.sync_vfs_barrier()
    enriched_total = sum(totals.values())
    return {
        "message": f"Described {totals['described']}, kept {totals['kept']} and revised {totals['revised']} symbol description(s).",
        "artifact": {"enriched_count": enriched_total, **totals},
    }


def _remember_index_descriptions(ctx, repo_dir, present_files, present_dirs, comments, stored_descriptions):
    """Mirrors the resolved index text of every present path into file_descriptions and keeps the text of paths that left.

    The rows are working memory for CODE_INDEX.md, never a second source of truth:
    - a present path with text is stored as DESCRIPTION_SOURCE_INDEX;
    - a present path without text loses its row, because the index no longer describes it;
    - a stored path that left the topology becomes DESCRIPTION_SOURCE_ORPHAN, so its text can come back with it;
    - orphans older than ORPHANED_DESCRIPTION_TTL_SECONDS are dropped.
    """
    placeholders = ("[comment required]", "[managed file]")
    now_ts = time.time()
    present = {}
    for rel_f in present_files:
        present[f"vfs://{repo_dir}/{rel_f}"] = comments.get(rel_f)
    for rel_d in present_dirs:
        present[f"vfs://{repo_dir}/{rel_d}/"] = comments.get(f"{rel_d}/") or comments.get(rel_d)
    upserts, deletes = [], []
    for uri, desc in present.items():
        stored = stored_descriptions.get(uri)
        if desc and desc not in placeholders:
            if stored != (desc, DESCRIPTION_SOURCE_INDEX):
                upserts.append((uri, desc, DESCRIPTION_SOURCE_INDEX, now_ts))
        elif stored and stored[1] != DESCRIPTION_SOURCE_GENESIS:
            deletes.append((uri,))
    try:
        orphan_rows = ctx.db.execute(
            "SELECT file_uri, description, source, updated_at FROM file_descriptions WHERE file_uri LIKE ?",
            (f"vfs://{repo_dir}/%",),
        ).fetchall()
        for row in orphan_rows:
            uri = row["file_uri"]
            if uri in present:
                continue
            if row["source"] == DESCRIPTION_SOURCE_INDEX:
                upserts.append((uri, row["description"], DESCRIPTION_SOURCE_ORPHAN, now_ts))
            elif row["source"] == DESCRIPTION_SOURCE_ORPHAN and now_ts - float(row["updated_at"] or 0) > ORPHANED_DESCRIPTION_TTL_SECONDS:
                deletes.append((uri,))
        if upserts:
            ctx.db.executemany(
                "INSERT OR REPLACE INTO file_descriptions (file_uri, description, source, updated_at) VALUES (?, ?, ?, ?)",
                upserts,
            )
        if deletes:
            ctx.db.executemany("DELETE FROM file_descriptions WHERE file_uri = ?", deletes)
        if upserts or deletes:
            ctx.db.commit()
    except Exception as exc:
        print(f"⚠️ [Cartographer] Could not remember index descriptions for {repo_dir}: {exc}")


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

        logical_index_path = resolve_repo_code_index_uri(ctx, repo_dir, config)
        index_path = repo_path / InSetuURI(logical_index_path).path
        if not repo_path.exists():
            if not silent: print(f"⚠️  Skipping {repo_dir}: Directory not found.")
            return
        if not silent: print(f"🗺️  Cartographing {repo_dir}...")
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
            # Generated text (the LLM enrich pass) never overrides index text written since it was generated. A plain
            # string fills an entry the index does not describe; {"text", "replaces"} replaces a description only while
            # the index still holds exactly the text that was reviewed.
            for key, generated in extra_comments[repo_dir].items():
                current = comments.get(key)
                if isinstance(generated, dict):
                    if generated.get("text") and (not current or current == generated.get("replaces")):
                        comments[key] = generated["text"]
                elif generated and not current:
                    comments[key] = generated

        # Tier 2 fallbacks for files and directories the index does not describe yet (hand-written index text always wins):
        # 2a. index text remembered for a path that left the topology and has come back (an unmounted and remounted
        #     volume, a file moved away and back), so its description survives the round trip;
        # 2b. the first sentence of the Yomama genesis patch COMMENT that created the file;
        # 2c. polyglot self-description from module docstrings, leading comments, frontmatter, or manifest metadata.
        # A remembered row for a path that never left is not a fallback: if the index lost its text, a person removed it.
        index_loaded = bool((live_vfs_index or "").strip()) or index_path.exists()
        try:
            stored_rows = ctx.db.execute(
                "SELECT file_uri, description, source FROM file_descriptions WHERE file_uri LIKE ?",
                (f"vfs://{repo_dir}/%",),
            ).fetchall()
            stored_descriptions = {r["file_uri"]: (r["description"], r["source"]) for r in stored_rows}
        except Exception as exc:
            print(f"⚠️ [Cartographer] Could not read remembered descriptions for {repo_dir}: {exc}")
            stored_descriptions = {}
        restorable_sources = {DESCRIPTION_SOURCE_GENESIS, DESCRIPTION_SOURCE_ORPHAN}
        if not index_loaded:
            restorable_sources.add(DESCRIPTION_SOURCE_INDEX)
        genesis_descriptions = {
            uri: desc for uri, (desc, source) in stored_descriptions.items() if source in restorable_sources and desc
        }

        filtered_set = set(filtered_files)
        seen_dirs = set()
        for rel_f in filtered_files:
            parts = rel_f.split("/")
            for idx in range(1, len(parts)):
                seen_dirs.add("/".join(parts[:idx]))
            if rel_f in comments or _is_path_managed(rel_f, managed_dirs):
                continue
            genesis_desc = genesis_descriptions.get(f"vfs://{repo_dir}/{rel_f}")
            if genesis_desc:
                comments[rel_f] = genesis_desc
                continue
            src_desc = describe_source_file(rel_f, ctx.vfs.read(f"vfs://{repo_dir}/{rel_f}") or "")
            if src_desc:
                comments[rel_f] = src_desc

        for rel_d in sorted(seen_dirs):
            d_key = f"{rel_d}/"
            if d_key in comments or rel_d in comments or Path(rel_d).name in comments or f"{Path(rel_d).name}/" in comments:
                continue
            if _is_path_managed(rel_d, managed_dirs):
                continue
            dir_desc = (
                genesis_descriptions.get(f"vfs://{repo_dir}/{d_key}")
                or genesis_descriptions.get(f"vfs://{repo_dir}/{rel_d}")
                or describe_directory(rel_d, filtered_set, lambda rel_p: ctx.vfs.read(f"vfs://{repo_dir}/{rel_p}"))
            )
            if dir_desc:
                comments[d_key] = dir_desc
                comments[rel_d] = dir_desc

        if index_loaded:
            _remember_index_descriptions(ctx, repo_dir, filtered_files, seen_dirs, comments, stored_descriptions)

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
        comments_sig = tuple(sorted((k, v) for k, v in comments.items() if k in filtered_set or k.rstrip("/") in seen_dirs))
        pre_sig = (tuple(filtered_files), hash(live_vfs_index), tuple(managed_dirs), tuple(symbol_sig_parts), comments_sig, bool(extra_comments))
        with _CARTOGRAPHER_CACHE_LOCK:
            if live_vfs_index is not None and not extra_comments and _CARTOGRAPHER_SIG_CACHE.get(cache_key) == pre_sig:
                return

        tree_dict = build_tree_dict(filtered_files)
        os.makedirs(Path(index_path).parent, exist_ok=True)

        header = f"# {config.get('title', repo_dir)} Code Index\n\nThis index serves as the architectural map. It outlines the core directories and their operational purpose to maintain a clear mental model of the ecosystem, preventing cognitive overload and logic drift.\n\n```text\n{repo_dir}/\n"
        tree_lines = render_ascii_tree(tree_dict, comments, managed_dirs, symbol_map=symbol_map)
        footer = "\n```\n"
        rendered_index = header + "\n".join(tree_lines) + footer
        if ctx.vfs.read(logical_index_path) != live_vfs_index:
            # The index changed while this map ran (a person's edit or a bridge commit). This render was built from the
            # older text and would overwrite theirs, so map again from the new text instead.
            return INDEX_CHANGED_DURING_MAP
        if rendered_index != live_vfs_index:
            ctx.vfs.save(logical_index_path, rendered_index, data={"ignore_ledger": True})
        post_sig = (tuple(filtered_files), hash(rendered_index), tuple(managed_dirs), tuple(symbol_sig_parts), comments_sig, False)
        with _CARTOGRAPHER_CACHE_LOCK:
            _CARTOGRAPHER_SIG_CACHE[cache_key] = post_sig

        missing = sum(1 for line in tree_lines if "[comment required]" in line)
        if not silent:
            if missing > 0:
                print(f"  └─ ✅ Index updated. ⚠️ {missing} placeholders require attention.")
            else:
                print(f"  └─ ✅ Index updated. Perfect documentation parity.")
    def process_repo_until_settled(config):
        for _attempt in range(MAX_INDEX_RACE_RETRIES):
            if process_repo(config) != INDEX_CHANGED_DURING_MAP:
                return
        print(f"⚠️ [Cartographer] CODE_INDEX.md for {config.get('repo_dir')} kept changing during mapping; left as it is.")

    ctx.jobs.map_parallel(process_repo_until_settled, all_configs)

    if not silent: print("\n🎉 Cartography complete!\n")

if __name__ == "__main__":
    map_repositories()