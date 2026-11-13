"""Declarative Markdown-as-Code (.md) and YAML (.yaml) routine loader, serializer, and validator (God-Objects Wave 3.2)."""

import ast
import copy
from datetime import datetime
import functools
from pathlib import Path
import re
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from insetu.core.agent.expressions import normalize_condition_expr as _default_normalize_cond_expr
from insetu.core.languages import get_language_provider
from insetu.core.sdk import CycleError, TemplateOverlayVFSDriver, extract_template_variables, resolve_dag_wavefronts, slugify
from insetu.core.topology.engine_topology import clamp_uris_to_topology, get_topology_files_for_repo
from insetu.core.utils_core import InSetuURI, get_sister_repos, load_yaml_string, parse_frontmatter, update_frontmatter

_ROUTINES_DRIVER = TemplateOverlayVFSDriver(module_subdir="routines")
MAX_RAG_FILES_PER_HOP = 15
RESERVED_ROUTINE_NODE_IDS = frozenset({"sys", "global", "inputs", "nodes", "loop", "holding", "trace", "_ctx"})

_PROSE_STOPWORDS = frozenset({
    "the", "and", "for", "with", "from", "that", "this", "into", "through", "execute",
    "implement", "update", "fix", "run", "task", "tasks", "item", "items", "section",
    "part", "step", "phase", "sprint", "plan", "doc", "file", "in", "on", "to", "of",
})

def _collect_workspace_file_extensions(ctx) -> Tuple[Set[str], Set[str]]:
    """Returns (known_extensions_lower, known_basenames_lower) from the workspace's live topology_ledger."""
    exts: Set[str] = {".md", ".txt", ".json", ".yaml", ".yml", ".toml"}
    basenames: Set[str] = set()
    if ctx is None:
        return exts, basenames
    for repo in get_sister_repos(ctx.workspace_id):
        for uri_str in get_topology_files_for_repo(ctx.workspace_id, repo):
            bname = InSetuURI(uri_str).basename.lower()
            if bname:
                basenames.add(bname)
                suf = Path(bname).suffix.lower()
                if suf:
                    exts.add(suf)
    return exts, basenames

def _prioritize_document_sections(user_prompt: str, docs_text: str) -> str:
    """Orders sections of docs_text by relevance to user_prompt using MarkdownLanguageProvider.definitions."""
    if not docs_text or not user_prompt:
        return docs_text or ""
    provider = get_language_provider("doc.md")
    headings = provider.definitions("ctx://contexts/doc.md", docs_text) if provider else []
    if not headings:
        return docs_text
    prompt_lower = user_prompt.lower()
    prompt_nums = {
        m.group(1) or m.group(2)
        for m in re.finditer(r'\b(\d+)\.\d+\b|\b(?:section|part|step|phase|sprint)\s+([a-z0-9]+)\b', prompt_lower)
        if (m.group(1) or m.group(2))
    }
    prompt_words = {w for w in re.findall(r'[a-z0-9_]{3,}', prompt_lower) if w not in _PROSE_STOPWORDS and not w.isdigit()}
    if not prompt_nums and not prompt_words:
        return docs_text
    lines = docs_text.splitlines()
    matched_slices: List[Tuple[int, str]] = []
    for h in headings:
        h_lower = str(h.get("name") or "").strip().lower()
        score = sum(10 for num in prompt_nums if re.search(rf'(?:^|\b){re.escape(num)}(?:\b|\.)', h_lower))
        score += sum(3 for w in prompt_words if w in h_lower)
        if score > 0:
            s_ln = max(1, int(h.get("line") or h.get("start_line") or 1))
            e_ln = min(len(lines), int(h.get("end_line") or len(lines)))
            matched_slices.append((score, "\n".join(lines[s_ln - 1 : e_ln])))
    if not matched_slices:
        return docs_text
    matched_slices.sort(key=lambda item: item[0], reverse=True)
    focused = "\n\n".join(chunk for _, chunk in matched_slices)
    return focused if prompt_nums else f"{focused}\n\n{docs_text}"

def extract_doc_referenced_files(ctx, user_prompt: str, docs_text: str) -> List[str]:
    """Format- and repository-agnostic file reference extractor for attached plans, tickets, and notes."""
    if not docs_text or ctx is None:
        return []
    try:
        known_exts, known_basenames = _collect_workspace_file_extensions(ctx)
        prioritized_text = _prioritize_document_sections(user_prompt, docs_text)
        provider = get_language_provider("doc.md")
        raw_candidates: List[str] = list(re.findall(r'(?:vfs|ctx)://[A-Za-z0-9_./-]+\.[A-Za-z0-9]{1,10}', prioritized_text))
        if provider:
            for imp in provider.imports("ctx://contexts/doc.md", prioritized_text):
                link_target = str(imp.get("target") or imp.get("module") or "").strip().split("#", 1)[0].strip()
                if link_target and not link_target.startswith(("http://", "https://", "mailto:")):
                    raw_candidates.append(link_target)
        for m in re.finditer(r'(?<![A-Za-z0-9_./:-])([A-Za-z0-9_][A-Za-z0-9_./-]*\.[A-Za-z][A-Za-z0-9]{0,9})(?![A-Za-z0-9_./-])', prioritized_text):
            tok = m.group(1).strip().lstrip("./")
            if not tok or ".." in tok:
                continue
            suf, bname = Path(tok).suffix.lower(), Path(tok).name.lower()
            if suf not in known_exts or ("/" not in tok and (tok.count(".") > 1 or bname not in known_basenames)):
                continue
            raw_candidates.append(tok)
        deduped = list(dict.fromkeys(c.strip().strip("`'\"") for c in raw_candidates if c and c.strip()))
        return clamp_rag_files_to_topology(ctx, deduped, max_files=12)
    except Exception:
        return []

def collect_live_files_for_patch_healing(ctx, parsed_blocks: Dict[str, Any], readonly_list: List[str]) -> str:
    """Reads current disk contents of files targeted by a failed Yomama patch so the healing LLM has exact anchors."""
    snippets: List[str] = []
    for raw_file in parsed_blocks.keys():
        if raw_file in readonly_list:
            continue
        try:
            canon_uri = str(InSetuURI(raw_file))
        except Exception:
            continue
        disk_text = ctx.vfs.read(canon_uri)
        if disk_text is None:
            candidates = ctx.find_path_candidates(canon_uri)
            if candidates:
                canon_uri = candidates[0]["filepath"]
                disk_text = ctx.vfs.read(canon_uri)
        if disk_text is not None:
            snippets.append(f"=== CURRENT FILE ON DISK: {canon_uri} ===\n{disk_text}")
    return "\n\n".join(snippets)

def clamp_rag_files_to_topology(
    ctx,
    candidate_files: List[str],
    allowed_repos: Optional[List[str]] = None,
    max_files: int = MAX_RAG_FILES_PER_HOP,
    allow_genesis: bool = False,
) -> List[str]:
    """Clamps and resolves LLM-selected RAG file URIs against topology_ledger within allowed_repos."""
    if not candidate_files or ctx is None:
        return []
    repos_list = list(allowed_repos or get_sister_repos(ctx.workspace_id))
    repos = set(repos_list)
    resolved_uris: List[str] = []

    def _add_unique(uri_str: str) -> None:
        if uri_str and uri_str not in resolved_uris:
            resolved_uris.append(uri_str)

    for raw_f in candidate_files:
        if not raw_f or not isinstance(raw_f, str):
            continue
        clean_f = raw_f.strip().split("#", 1)[0].strip()
        if not clean_f:
            continue
        try:
            canon = InSetuURI.canonicalize(clean_f)
        except Exception:
            canon = ""
        if canon and InSetuURI(canon).repo in repos:
            exact = clamp_uris_to_topology(ctx.workspace_id, [canon], expand_dirs=False)
            if exact:
                for u in exact:
                    _add_unique(u)
                continue
            if allow_genesis and InSetuURI(canon).scheme == "vfs" and InSetuURI(canon).path and "." in InSetuURI(canon).basename and ".." not in canon:
                _add_unique(canon)
            parent_dir = str(InSetuURI(canon).parent_uri).rstrip("/") + "/"
            siblings = clamp_uris_to_topology(ctx.workspace_id, [parent_dir], expand_dirs=True)
            if siblings:
                for preferred_suffix in ("/__init__.py", "/base.py"):
                    matched_sib = next((s for s in siblings if s.endswith(preferred_suffix)), None)
                    if matched_sib:
                        _add_unique(matched_sib)
                if not any(s.endswith(("/__init__.py", "/base.py")) for s in siblings):
                    _add_unique(siblings[0])
                continue
        cands = ctx.find_path_candidates(clean_f, allowed_repos=repos_list)
        if cands and cands[0].get("score", 0) >= 0.75:
            _add_unique(cands[0]["filepath"])
    return resolved_uris[:max_files]

ROUTINE_RESPONSE_DOCUMENT_EXTENSIONS = frozenset({
    ".md", ".markdown", ".txt", ".json", ".yaml", ".yml", ".csv",
})

_FILE_TOKEN_METRIC_CACHE: Dict[Tuple[str, str, bool, int, int], int] = {}

def build_context_file_metrics(ctx, constitution_files: List[str], reference_files: List[str], pinned_files: List[str]) -> Dict[str, int]:
    """Computes real estimated token counts per file URI in the active working set with tenant-scoped memoization."""
    token_map: Dict[str, int] = {}
    wid = getattr(ctx, "workspace_id", None) or "default"
    all_uris = list(dict.fromkeys((constitution_files or []) + (reference_files or []) + (pinned_files or [])))
    ref_set = set(reference_files or [])
    for uri in all_uris:
        if not uri:
            continue
        try:
            content = ctx.vfs.read(uri)
        except Exception:
            content = None
        if not isinstance(content, str):
            continue
        is_ref = (uri in ref_set and len(content) > 4000)
        cache_key = (wid, uri, is_ref, len(content), hash(content))
        if cache_key in _FILE_TOKEN_METRIC_CACHE:
            token_map[uri] = _FILE_TOKEN_METRIC_CACHE[cache_key]
            continue
        if is_ref:
            prov = get_language_provider(uri)
            if prov:
                try:
                    content = prov.slice_interface(uri, content)
                except Exception:
                    pass
        tok_est = max(1, len(content) // 4)
        if len(_FILE_TOKEN_METRIC_CACHE) > 2048:
            _FILE_TOKEN_METRIC_CACHE.clear()
        _FILE_TOKEN_METRIC_CACHE[cache_key] = token_map[uri] = tok_est
    return token_map

def is_prose_document_uri(uri_or_path: str) -> bool:
    """Returns True when a URI or path represents prose documentation, plans, or notes rather than executable source code."""
    clean = str(uri_or_path or "").strip().split("#", 1)[0].strip()
    if not clean:
        return False
    provider = get_language_provider(clean)
    if provider is not None:
        return not getattr(provider, "indexes_code_symbols", True)
    return Path(clean).suffix.lower() in (".md", ".markdown", ".txt", ".rst", ".adoc")

def compile_node_wavefronts(nodes: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    """Compiles routine nodes into level-order topological wavefronts via Ring 0 resolve_dag_wavefronts."""
    valid_nodes = []
    for idx, n in enumerate(nodes or []):
        if not isinstance(n, dict) or not n.get("id"):
            continue
        nc = dict(n)
        parents = nc.get("parents") or nc.get("depends_on") or []
        if isinstance(parents, str):
            parents = [p.strip() for p in parents.split(",") if p.strip()]
        nc["parents"] = [str(p).strip() for p in parents if str(p).strip()]
        nc.setdefault("order", (idx + 1) * 10)
        valid_nodes.append(nc)
    if not valid_nodes:
        return []
    return resolve_dag_wavefronts(valid_nodes, id_key="id", parents_key="parents", order_key="order")

def response_path_error(response_path: Any) -> Optional[str]:
    """Returns an error message when a routine's response_path does not target a document file, else None."""
    if not response_path:
        return None
    if not isinstance(response_path, str):
        return "Routine response_path must be a string URI."
    try:
        target_name = InSetuURI(InSetuURI.canonicalize(response_path.replace("{date}", "date"))).basename
    except (ValueError, TypeError):
        return f"Routine response_path '{response_path}' is not a valid URI."
    suffix = Path(target_name).suffix.lower()
    if suffix not in ROUTINE_RESPONSE_DOCUMENT_EXTENSIONS:
        allowed = ", ".join(sorted(ROUTINE_RESPONSE_DOCUMENT_EXTENSIONS))
        return (
            f"Routine response_path '{response_path}' must target a document ({allowed}). "
            "Code changes must go through bridge.sync so they are validated and recorded."
        )
    return None

def persist_routine_response(ctx, routine: Dict[str, Any], response_text: str) -> Optional[str]:
    """
    Saves a routine's declared report (response_path) directly through the VFS and returns its URI.
    Only document targets are allowed, so response_path can never bypass bridge.sync for code.
    """
    resp_path_tpl = routine.get("response_path")
    if not (resp_path_tpl and response_text and isinstance(resp_path_tpl, str)):
        return None
    err = response_path_error(resp_path_tpl)
    if err:
        raise PermissionError(err)
    date_str = datetime.now().strftime("%Y-%m-%d")
    resolved_resp_uri = InSetuURI.canonicalize(resp_path_tpl.replace("{date}", date_str))
    save_meta: Dict[str, Any] = {"original_response_path": resp_path_tpl}
    if routine.get("archive_path"):
        save_meta["archive_path"] = routine["archive_path"]
    ctx.vfs.save(resolved_resp_uri, response_text, data=save_meta)
    return resolved_resp_uri

def validate_routine_definition(
    routine_dict: Dict[str, Any],
    normalize_cond_fn: Optional[Callable[[str, Optional[Dict[str, Any]]], Tuple[str, Dict[str, Any]]]] = None,
) -> Tuple[bool, str, List[List[str]]]:
    """
    Validates a parsed routine definition dictionary:
    1. Verifies slug-safe 'id' and non-empty 'nodes' list.
    2. Compiles topological wavefronts via Ring 0 resolve_dag_wavefronts (rejecting unknown parents or cycles).
    3. Validates every node's 'when'/'condition' and 'until' expression via ast.parse(..., mode='eval').
    Returns (is_valid, error_message, wavefront_id_groups).
    """
    if not isinstance(routine_dict, dict):
        return False, "Routine definition must be a dictionary.", []
    rid = str(routine_dict.get("id") or "").strip()
    if not rid or not re.match(r'^[a-zA-Z0-9_-]+$', rid):
        return False, f"Invalid or missing routine id '{rid}'.", []
    response_err = response_path_error(routine_dict.get("response_path"))
    if response_err:
        return False, response_err, []
    nodes = routine_dict.get("nodes")
    if not isinstance(nodes, list) or len(nodes) == 0:
        if routine_dict.get("includes") or routine_dict.get("include_prompt"):
            return True, "", []
        return False, f"Routine '{rid}' must define a non-empty 'nodes' list.", []

    cond_normalizer = normalize_cond_fn or _default_normalize_cond_expr

    def _validate_expr_syntax(expr_str: Optional[str], label: str) -> Optional[str]:
        if not expr_str or not str(expr_str).strip():
            return None
        s_expr, _ = cond_normalizer(str(expr_str).strip(), None)
        try:
            ast.parse(s_expr, mode="eval")
            return None
        except SyntaxError as se:
            return f"Invalid {label} expression '{expr_str}': {se.msg}"

    try:
        waves = compile_node_wavefronts(nodes)
        wave_ids = [[n["id"] for n in w] for w in waves]
    except (CycleError, ValueError) as e:
        return False, f"DAG Topology Error in routine '{rid}': {e}", []

    for n in nodes:
        if not isinstance(n, dict):
            continue
        nid = str(n.get("id", "unknown")).strip()
        if nid in RESERVED_ROUTINE_NODE_IDS:
            return False, f"Node id '{nid}' in routine '{rid}' is a reserved envelope namespace key.", []
        for cond_key in ("when", "condition", "until"):
            err = _validate_expr_syntax(n.get(cond_key), f"node '{nid}' {cond_key}")
            if err:
                return False, err, []
        if str(n.get("type") or "").lower() == "loop":
            body_nodes = n.get("body") or n.get("nodes") or []
            if isinstance(body_nodes, list) and body_nodes:
                try:
                    compile_node_wavefronts(body_nodes)
                except (CycleError, ValueError) as e:
                    return False, f"DAG Topology Error in loop '{nid}': {e}", []
                for bn in body_nodes:
                    if isinstance(bn, dict):
                        for ck in ("when", "condition", "until"):
                            err = _validate_expr_syntax(bn.get(ck), f"loop node '{bn.get('id')}' {ck}")
                            if err:
                                return False, err, []

    return True, "", wave_ids

def _extract_markdown_node_sections(body_text: str) -> Dict[str, str]:
    """Splits a Markdown-as-Code routine body by top-level `## <node_id>` headings, ignoring empty `---` artifacts and preserving unheaded bodies under 'execute_prompt'."""
    if not body_text or not body_text.strip():
        return {}
    cleaned_body = re.sub(r'^(?:\s*---\s*\n)+', '', body_text.replace("\r\n", "\n")).strip()
    if not cleaned_body:
        return {}
    sections: Dict[str, List[str]] = {}
    preamble_lines: List[str] = []
    current_node_id: Optional[str] = None
    heading_re = re.compile(r'^##\s+([a-zA-Z0-9_-]+)\s*(?:<!--.*?-->)?\s*$')
    for line in cleaned_body.split("\n"):
        m = heading_re.match(line.strip())
        if m:
            current_node_id = m.group(1).strip()
            sections.setdefault(current_node_id, [])
        elif current_node_id is not None:
            sections[current_node_id].append(line)
        else:
            preamble_lines.append(line)
    if not sections and preamble_lines:
        clean_preamble = "\n".join(preamble_lines).strip()
        if clean_preamble:
            return {"execute_prompt": clean_preamble}
    return {nid: "\n".join(lines).strip() for nid, lines in sections.items()}

def parse_routine_content(raw_text: str, fallback_id: str = "routine", is_markdown: bool = True) -> Dict[str, Any]:
    """
    Parses either a Markdown-as-Code (.md) routine (YAML frontmatter + ## <node_id> sections)
    or a YAML (.yaml/.yml) routine into a normalized definition dict with compiled wavefronts.
    The result depends only on the arguments, so each distinct text is parsed once; callers get their own copy.
    """
    return copy.deepcopy(_parse_routine_text(raw_text or "", str(fallback_id), bool(is_markdown)))

@functools.lru_cache(maxsize=512)
def _parse_routine_text(raw_text: str, fallback_id: str, is_markdown: bool) -> Dict[str, Any]:
    if not raw_text or not raw_text.strip():
        raise ValueError(f"Routine '{fallback_id}' is empty.")

    section_prompts: Dict[str, str] = {}
    if is_markdown or raw_text.lstrip().startswith("---"):
        yaml_meta, body, fm_match = parse_frontmatter(raw_text)
        if fm_match and isinstance(yaml_meta, dict):
            defn = dict(yaml_meta)
            section_prompts = _extract_markdown_node_sections(body)
        else:
            parsed_yaml = load_yaml_string(raw_text)
            defn = dict(parsed_yaml) if isinstance(parsed_yaml, dict) else {}
    else:
        parsed_yaml = load_yaml_string(raw_text)
        defn = dict(parsed_yaml) if isinstance(parsed_yaml, dict) else {}

    rid = str(defn.get("id") or fallback_id).strip()
    defn["id"] = rid
    title_val = defn.get("title") or defn.get("name") or rid.replace("_", " ").title()
    defn["title"] = str(title_val)
    defn["name"] = str(defn.get("name") or title_val)
    defn["domain"] = str(defn.get("domain") or "Routines")
    defn["description"] = str(defn.get("description") or "")
    slash_cmd = defn.get("slash_command")
    defn["slash_command"] = str(slash_cmd) if slash_cmd else f"/{rid}"
    for arr_key in ("includes", "show_if_exists", "show_if_missing"):
        val = defn.get(arr_key)
        if isinstance(val, list):
            defn[arr_key] = [InSetuURI.canonicalize(str(x)) for x in val if str(x).strip()]
        elif isinstance(val, str) and val.strip():
            defn[arr_key] = [InSetuURI.canonicalize(val.strip())]
        else:
            defn[arr_key] = []

    if defn.get("include_prompt") and isinstance(defn["include_prompt"], str):
        defn["include_prompt"] = InSetuURI.canonicalize(defn["include_prompt"], default_prefix="ctx://prompts/")

    raw_nodes = defn.get("nodes")
    nodes: List[Dict[str, Any]] = []
    if isinstance(raw_nodes, list) and raw_nodes:
        for idx, n in enumerate(raw_nodes):
            if not isinstance(n, dict) or not n.get("id"):
                continue
            node_copy = dict(n)
            nid = str(node_copy["id"]).strip()
            node_copy["id"] = nid
            parents = node_copy.get("parents") or node_copy.get("depends_on") or []
            if isinstance(parents, str):
                parents = [p.strip() for p in parents.split(",") if p.strip()]
            node_copy["parents"] = [str(p).strip() for p in parents if str(p).strip()]
            node_copy.setdefault("order", (idx + 1) * 10)
            if node_copy.get("prompt_uri") and isinstance(node_copy["prompt_uri"], str):
                node_copy["prompt_uri"] = InSetuURI.canonicalize(node_copy["prompt_uri"], default_prefix="ctx://prompts/")
            if nid in section_prompts and section_prompts[nid]:
                node_copy["prompt"] = section_prompts[nid]
            elif (
                idx == 0
                and str(node_copy.get("type", "llm")).lower() == "llm"
                and not node_copy.get("prompt")
                and not node_copy.get("prompt_uri")
            ):
                if "execute_prompt" in section_prompts and len(section_prompts) == 1:
                    node_copy["prompt"] = section_prompts["execute_prompt"]
                elif defn.get("include_prompt"):
                    node_copy["prompt_uri"] = str(defn["include_prompt"])
            nodes.append(node_copy)
    elif defn.get("include_prompt") or section_prompts or defn.get("includes"):
        first_section_id = next(iter(section_prompts.keys()), "execute_prompt")
        single_node: Dict[str, Any] = {
            "id": first_section_id,
            "type": "llm",
            "tier": str(defn.get("tier") or "standard"),
            "parents": [],
            "order": 10,
        }
        if defn.get("include_prompt"):
            single_node["prompt_uri"] = str(defn["include_prompt"])
        if first_section_id in section_prompts:
            single_node["prompt"] = section_prompts[first_section_id]
        nodes.append(single_node)

    defn["nodes"] = nodes
    if nodes:
        try:
            waves = resolve_dag_wavefronts(nodes, id_key="id", parents_key="parents", order_key="order")
            defn["wavefronts"] = [[n["id"] for n in w] for w in waves]
        except (CycleError, ValueError):
            defn["wavefronts"] = [[n["id"]] for n in nodes]
    else:
        defn["wavefronts"] = []
    var_sources = [raw_text]
    for n in nodes:
        if isinstance(n.get("prompt"), str):
            var_sources.append(n["prompt"])
    defn["variables"] = extract_template_variables("\n".join(var_sources))
    return defn

def serialize_routine_to_markdown(defn: Dict[str, Any]) -> str:
    """Serializes a routine definition dict into Markdown-as-Code (YAML frontmatter + ## <node_id> sections)."""
    rid = str(defn.get("id") or slugify(defn.get("title") or defn.get("name") or "routine") or "routine")
    title = str(defn.get("title") or defn.get("name") or rid)
    fm_data: Dict[str, Any] = {
        "id": rid,
        "title": title,
        "domain": str(defn.get("domain") or "Routines"),
        "description": str(defn.get("description") or ""),
        "slash_command": str(defn.get("slash_command") or f"/{rid}"),
    }
    for opt_key in ("scopes", "includes", "show_if_exists", "show_if_missing", "include_prompt", "response_path", "archive_path", "mcp_expose", "transport", "intent_key", "intent_description", "modes", "default_mode", "output"):
        if opt_key in defn and defn[opt_key] not in (None, [], ""):
            fm_data[opt_key] = defn[opt_key]

    nodes_list = defn.get("nodes") or []
    clean_nodes = []
    body_sections = []
    for n in nodes_list:
        if not isinstance(n, dict) or not n.get("id"):
            continue
        n_copy = dict(n)
        prompt_body = str(n_copy.pop("prompt", "") or "").strip()
        clean_nodes.append(n_copy)
        if prompt_body:
            body_sections.append(f"## {n_copy['id']}\n{prompt_body}")
    if clean_nodes:
        fm_data["nodes"] = clean_nodes
    body_str = "\n\n".join(body_sections)
    return update_frontmatter(body_str, fm_data)

def _format_routine_summary(rid: str, loaded: Dict[str, Any]) -> Dict[str, Any]:
    modes_dict = loaded.get("modes") or {}
    modes_list = [
        {
            "id": m_id,
            "label": m_cfg.get("label") or f"/{m_id}",
            "routine": m_cfg.get("routine") or rid,
            "description": m_cfg.get("description") or "",
            "effective_intent": m_cfg.get("effective_intent"),
        }
        for m_id, m_cfg in modes_dict.items()
        if isinstance(m_cfg, dict)
    ]
    nodes_list = loaded.get("nodes") or []
    wavefronts = loaded.get("wavefronts")
    if not wavefronts and nodes_list:
        try:
            waves = resolve_dag_wavefronts(nodes_list, id_key="id", parents_key="parents", order_key="order")
            wavefronts = [[n["id"] for n in w] for w in waves]
        except Exception:
            wavefronts = [[n.get("id")] for n in nodes_list if isinstance(n, dict) and n.get("id")]

    title_val = loaded.get("title") or loaded.get("name") or rid.replace("_", " ").title()
    return {
        "id": loaded.get("id") or rid, "name": loaded.get("name") or title_val, "title": title_val,
        "domain": loaded.get("domain") or "Routines", "slash_command": loaded.get("slash_command") or f"/{rid}",
        "scopes": list(loaded.get("scopes") or []), "description": loaded.get("description") or "",
        "default_mode": loaded.get("default_mode") or "auto", "transport": loaded.get("transport") or "auto",
        "intent_key": loaded.get("intent_key"), "intent_description": loaded.get("intent_description"),
        "modes": modes_list, "nodes": nodes_list, "node_count": len(nodes_list),
        "wavefronts": wavefronts or [], "variables": loaded.get("variables") or [],
        "includes": loaded.get("includes") or [], "show_if_exists": loaded.get("show_if_exists") or [],
        "show_if_missing": loaded.get("show_if_missing") or [], "include_prompt": loaded.get("include_prompt"),
        "response_path": loaded.get("response_path"), "archive_path": loaded.get("archive_path"),
        "filepath": loaded.get("filepath") or f"ctx://routines/.templates/agent/{rid}.md",
        "source": loaded.get("source") or "builtin", "has_override": bool(loaded.get("has_override", False)),
        "is_shared": bool(loaded.get("is_shared", False)), "source_workspace": loaded.get("source_workspace"),
    }

def _iter_module_routine_files(ctx) -> List[Tuple[str, str, Path]]:
    results: List[Tuple[str, str, Path]] = []
    active_mods = ctx.get_active_modules() if ctx is not None else ["agent"]
    if "agent" not in active_mods:
        active_mods = ["agent"] + list(active_mods)
    seen = set()
    for mod_name in active_mods:
        if mod_name in seen:
            continue
        seen.add(mod_name)
        mod_dir = _ROUTINES_DRIVER.resolve_module_dir(mod_name, ctx.workspace_id if ctx else "default")
        if not mod_dir or not mod_dir.exists():
            continue
        seen_stems: Set[str] = set()
        for ext in ("*.md", "*.yaml", "*.yml"):
            for p in sorted(mod_dir.glob(ext)):
                if p.is_file() and p.stem not in seen_stems:
                    seen_stems.add(p.stem)
                    results.append((mod_name, p.stem, p))
    return results

def _read_routine_uri_or_path(ctx, uri_str: str, fallback_path: Optional[Path] = None) -> Optional[str]:
    """Reads a routine through the VFS write-through cache first, falling back to VFS absolute artifact read."""
    if ctx is not None:
        val = ctx.vfs.read(uri_str)
        if val is not None:
            return val
        if fallback_path is not None:
            return ctx.vfs.read(fallback_path.as_posix(), is_absolute_artifact=True)
        return None
    if fallback_path is not None and fallback_path.is_file():
        return fallback_path.read_text(encoding="utf-8")
    return None

def list_available_routines(ctx=None) -> List[Dict[str, Any]]:
    """Discovers all declarative routines (.md and .yaml) across Built-in Module .templates, Global User Templates, Workspace Overrides, and Shared Mounts."""
    routines_map: Dict[str, Dict[str, Any]] = {}

    for mod_name, stem, fpath in _iter_module_routine_files(ctx):
        try:
            tpl_uri = f"ctx://routines/.templates/{mod_name}/{fpath.name}"
            raw = _read_routine_uri_or_path(ctx, tpl_uri, fpath)
            if not raw:
                continue
            parsed = parse_routine_content(raw, fallback_id=stem, is_markdown=(fpath.suffix.lower() == ".md"))
            rid = parsed["id"]
            parsed["source"] = "builtin"
            parsed["module"] = mod_name
            parsed["filepath"] = tpl_uri
            routines_map[rid] = _format_routine_summary(rid, parsed)
        except Exception:
            continue

    try:
        user_dir = _ROUTINES_DRIVER.ensure_global_user_templates_dir(ctx.workspace_id if ctx else "default")
        if user_dir.exists():
            for ext in ("*.md", "*.yaml", "*.yml"):
                for p in sorted(user_dir.glob(ext)):
                    if not p.is_file():
                        continue
                    try:
                        user_uri = f"ctx://routines/.templates/user/{p.name}"
                        raw = _read_routine_uri_or_path(ctx, user_uri, p)
                        if not raw:
                            continue
                        parsed = parse_routine_content(raw, fallback_id=p.stem, is_markdown=(p.suffix.lower() == ".md"))
                        rid = parsed["id"]
                        parsed["has_override"] = rid in routines_map
                        parsed["source"] = "user_template"
                        parsed["filepath"] = user_uri
                        routines_map[rid] = _format_routine_summary(rid, parsed)
                    except Exception:
                        continue
    except Exception:
        pass

    if ctx is not None:
        ws_uris = list(ctx.vfs.walk("ctx://routines", exts=[".md", ".yaml", ".yml"]))
        for ws_uri in sorted(ws_uris):
            if "/.templates/" in ws_uri:
                continue
            try:
                raw = ctx.vfs.read(ws_uri)
                if not raw:
                    continue
                fname = InSetuURI(ws_uri).basename
                stem = Path(fname).stem
                parsed = parse_routine_content(raw, fallback_id=stem, is_markdown=fname.lower().endswith(".md"))
                rid = parsed["id"]
                parsed["has_override"] = rid in routines_map
                parsed["source"] = "workspace"
                parsed["filepath"] = f"ctx://routines/{fname}"
                routines_map[rid] = _format_routine_summary(rid, parsed)
            except Exception:
                continue

        legacy_dir = Path(ctx.paths["control_dir"]).joinpath("routines")
        if legacy_dir.exists() and legacy_dir.is_dir():
            for ext in ("*.md", "*.yaml", "*.yml"):
                for fpath in sorted(legacy_dir.glob(ext)):
                    if not fpath.is_file():
                        continue
                    try:
                        ws_uri = f"ctx://routines/{fpath.name}"
                        raw = _read_routine_uri_or_path(ctx, ws_uri, fpath)
                        if not raw:
                            continue
                        parsed = parse_routine_content(raw, fallback_id=fpath.stem, is_markdown=(fpath.suffix.lower() == ".md"))
                        rid = parsed["id"]
                        if rid in routines_map and routines_map[rid].get("source") == "workspace":
                            continue
                        parsed["has_override"] = rid in routines_map
                        parsed["source"] = "workspace"
                        parsed["filepath"] = ws_uri
                        routines_map[rid] = _format_routine_summary(rid, parsed)
                    except Exception:
                        continue

        for domain_name in ("agent",):
            try:
                for target_ws, ws_uri in ctx.iter_shared_mount_files(domain=domain_name, exts=[".md", ".yaml", ".yml"]):
                    raw = ctx.vfs.read(ws_uri)
                    if not raw:
                        continue
                    try:
                        parsed = parse_routine_content(raw, fallback_id=Path(ws_uri).stem, is_markdown=ws_uri.endswith(".md"))
                        rid = f"{target_ws}__{parsed['id']}"
                        parsed["id"] = rid
                        parsed["title"] = f"[🌐 {target_ws}] {parsed.get('title') or rid}"
                        parsed["name"] = parsed["title"]
                        parsed["filepath"] = ws_uri
                        parsed["source"] = "shared"
                        parsed["is_shared"] = True
                        parsed["source_workspace"] = target_ws
                        routines_map[rid] = _format_routine_summary(rid, parsed)
                    except Exception:
                        pass
            except Exception:
                pass

    return list(routines_map.values())

def resolve_routine_mode(routine: Dict[str, Any], requested_mode: Optional[str] = None) -> Tuple[str, str, Optional[str]]:
    """
    Resolves a requested slash mode against the routine's declarative `modes:` block.
    Returns (canonical_mode_id, initial_effective_intent, handoff_routine_id).
    """
    modes_map = routine.get("modes") or {}
    default_mode = str(routine.get("default_mode") or "auto").strip().lower()
    raw = str(requested_mode or default_mode).strip().lower().lstrip("/")

    if raw in modes_map and isinstance(modes_map[raw], dict):
        m_cfg = modes_map[raw]
        target_routine = m_cfg.get("routine")
        return raw, str(m_cfg.get("effective_intent") or "EDIT_CODE"), target_routine

    if default_mode in modes_map and isinstance(modes_map[default_mode], dict):
        m_cfg = modes_map[default_mode]
        return default_mode, str(m_cfg.get("effective_intent") or "EDIT_CODE"), m_cfg.get("routine")
    return raw or "auto", "EDIT_CODE", None

def load_routine_definition(ctx, routine_id: str = "workspace_turn") -> Dict[str, Any]:
    """
    Loads a declarative routine (.md or .yaml) across the 3-Tier Same-Name Override Cascade:
    1. Workspace Override (ctx://routines/<id>.md|.yaml or .insetu/routines/<id>.yaml)
    2. Global User Template (ctx://routines/.templates/user/<id>.md|.yaml)
    3. Built-in Module Template (ctx://routines/.templates/<mod>/<id>.md|.yaml)
    """
    raw_input = str(routine_id or "workspace_turn").strip()
    if ctx is not None and raw_input.startswith(("ctx://", "ws://", "vfs://")):
        raw_content = ctx.vfs.read(raw_input)
        if raw_content:
            parsed = parse_routine_content(raw_content, fallback_id=Path(raw_input).stem, is_markdown=raw_input.endswith(".md"))
            parsed["filepath"] = raw_input
            return parsed

    clean_id = re.sub(r'[^a-zA-Z0-9_-]', '', raw_input.lstrip("/"))
    if not clean_id:
        clean_id = "workspace_turn"
    if ctx is not None:
        for ext in (".md", ".yaml", ".yml"):
            ws_uri = f"ctx://routines/{clean_id}{ext}"
            raw_ws = ctx.vfs.read(ws_uri)
            if raw_ws:
                parsed = parse_routine_content(raw_ws, fallback_id=clean_id, is_markdown=(ext == ".md"))
                parsed["filepath"] = ws_uri
                parsed["source"] = "workspace"
                return parsed
            legacy_path = Path(ctx.paths["control_dir"]).joinpath("routines", f"{clean_id}{ext}")
            if legacy_path.exists():
                raw_leg = ctx.vfs.read(legacy_path.as_posix(), is_absolute_artifact=True)
                if raw_leg:
                    parsed = parse_routine_content(raw_leg, fallback_id=clean_id, is_markdown=(ext == ".md"))
                    parsed["filepath"] = f"ctx://routines/{clean_id}{ext}"
                    parsed["source"] = "workspace"
                    return parsed
        for ext in (".md", ".yaml", ".yml"):
            user_uri = f"ctx://routines/.templates/user/{clean_id}{ext}"
            raw_user = ctx.vfs.read(user_uri)
            if raw_user:
                parsed = parse_routine_content(raw_user, fallback_id=clean_id, is_markdown=(ext == ".md"))
                parsed["filepath"] = user_uri
                parsed["source"] = "user_template"
                return parsed

    for mod_name, stem, fpath in _iter_module_routine_files(ctx):
        if stem == clean_id:
            tpl_uri = f"ctx://routines/.templates/{mod_name}/{fpath.name}"
            raw = _read_routine_uri_or_path(ctx, tpl_uri, fpath)
            if not raw:
                continue
            parsed = parse_routine_content(raw, fallback_id=clean_id, is_markdown=(fpath.suffix.lower() == ".md"))
            parsed["filepath"] = tpl_uri
            parsed["source"] = "builtin"
            parsed["module"] = mod_name
            return parsed

    raise FileNotFoundError(f"Agent routine '{clean_id}' not found.")
