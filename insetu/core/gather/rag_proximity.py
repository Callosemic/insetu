"""
insetu.core.gather.rag_proximity
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Hebbian co-occurrence affinity graph (affinity_edges) and blast-radius CODE_INDEX.md
subtree outline slicer for the Unified RAG Funnel.
"""

import math
from pathlib import Path
import re
import time
from typing import Any, Dict, List, Optional, Set, Tuple

from insetu.core.languages import get_language_provider
from insetu.core.sdk import InSetuURI
from insetu.core.topology.engine_topology import (
    clamp_uris_to_topology,
    resolve_repo_code_index_uri,
)
from insetu.core.utils_core import get_sister_repos

DECAY_LAMBDA = 0.00001  # Half-life of ~19 hours
MAX_RAG_FILES_PER_HOP = 32
_POLYGLOT_PACKAGE_ENTRYPOINTS = (
    "/__init__.py", "/base.py", "/index.js", "/index.ts", "/index.tsx",
    "/mod.rs", "/lib.rs", "/00_index.md", "/README.md", "/index.md",
)

from insetu.core.gather.rag_scout import (
    build_context_file_metrics,
    collect_workspace_file_extensions as _collect_workspace_file_extensions,
    extract_doc_referenced_files,
    prioritize_document_sections,
)


def clamp_rag_files_to_topology(
    ctx,
    candidate_files: List[str],
    allowed_repos: Optional[List[str]] = None,
    max_files: int = MAX_RAG_FILES_PER_HOP,
    allow_genesis: bool = False,
) -> List[str]:
    """
    Single Source of Truth RAG & Agent Target URI Resolver:
    - Strips `#symbol` fragments and enforces `allowed_repos` scoping.
    - Resolves exact tracked files and package directories (`_POLYGLOT_PACKAGE_ENTRYPOINTS`) via `clamp_uris_to_topology`.
    - Accepts repo-scoped new file paths only when `allow_genesis=True`.
    - Disambiguates bare filenames or moved files via `ctx.find_path_candidates`.
    """
    if not candidate_files or ctx is None:
        return []
    all_mounted = set(get_sister_repos(ctx.workspace_id))
    repos_list = [r for r in (allowed_repos or list(all_mounted)) if r and r != "ALL"] or list(all_mounted)
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
        has_scheme = "://" in clean_f
        try:
            canon = InSetuURI.canonicalize(clean_f)
            u_obj = InSetuURI(canon)
        except Exception:
            canon, u_obj = "", None
        if u_obj is not None and u_obj.scheme and u_obj.scheme != "vfs":
            _add_unique(str(u_obj))
            continue
        if u_obj is not None and u_obj.repo in all_mounted:
            if u_obj.repo not in repos:
                continue
            exact = clamp_uris_to_topology(ctx.workspace_id, [canon], expand_dirs=False)
            if exact:
                for u in exact:
                    _add_unique(u)
                continue
            if "." not in u_obj.basename:
                pkg_dir = canon.rstrip("/") + "/"
                siblings = clamp_uris_to_topology(ctx.workspace_id, [pkg_dir], expand_dirs=True)
                for preferred_suffix in _POLYGLOT_PACKAGE_ENTRYPOINTS:
                    matched_sib = next((s for s in siblings if s.endswith(preferred_suffix)), None)
                    if matched_sib:
                        _add_unique(matched_sib)
                if siblings:
                    continue
        elif has_scheme:
            continue
        search_query = (u_obj.path if (has_scheme and u_obj is not None and u_obj.path) else clean_f)
        cands = ctx.find_path_candidates(clean_f, allowed_repos=repos_list)
        if (not cands or cands[0].get("score", 0) < 0.75) and search_query != clean_f:
            cands = ctx.find_path_candidates(search_query, allowed_repos=repos_list)
        matched_existing = False
        if cands and cands[0].get("score", 0) >= 0.75:
            cand_fp = cands[0]["filepath"]
            if not (has_scheme and u_obj is not None and "." in u_obj.basename and InSetuURI(cand_fp).basename.lower() != u_obj.basename.lower()):
                _add_unique(cand_fp)
                matched_existing = True
        if not matched_existing and allow_genesis and u_obj is not None and u_obj.repo in repos and u_obj.scheme == "vfs" and u_obj.path and "." in u_obj.basename and ".." not in canon:
            gen_uri = canon
            rel_p = u_obj.path.strip("/")
            first_seg, _, rest_rel = rel_p.partition("/")
            if first_seg in repos and "/" in rest_rel:
                unstripped_parent = f"vfs://{u_obj.repo}/{Path(rel_p).parent.as_posix().strip('/')}/"
                target_repo_parent = f"vfs://{first_seg}/{Path(rest_rel).parent.as_posix().strip('/')}/"
                has_unstripped_dir = bool(clamp_uris_to_topology(ctx.workspace_id, [unstripped_parent], expand_dirs=True))
                has_target_repo_dir = bool(clamp_uris_to_topology(ctx.workspace_id, [target_repo_parent], expand_dirs=True))
                if has_target_repo_dir and not has_unstripped_dir:
                    gen_uri = f"vfs://{first_seg}/{rest_rel.strip('/')}"
            _add_unique(gen_uri)
    return resolved_uris[:max_files]


def describe_unresolved_rag_path(
    ctx,
    raw_path: str,
    allowed_repos: Optional[List[str]] = None,
    prefix_label: str = "Unresolved path",
) -> str:
    """Formats a diagnostic message with closest tracked `topology_ledger` candidates when a scout/probe path fails to resolve."""
    cands = [
        c["filepath"]
        for c in (ctx.find_path_candidates(raw_path, allowed_repos=allowed_repos) or [])[:4]
        if isinstance(c, dict) and c.get("filepath")
    ]
    hint = f" Closest tracked files: {', '.join(cands)}" if cands else " Check CODE_INDEX.md for exact repository and path."
    return f"- {prefix_label} '{raw_path}' (not found in topology_ledger).{hint}"





def ingest_scout_inspect_files(
    ctx,
    envelope,
    parsed_output: Dict[str, Any],
    *,
    user_prompt: str,
    all_sister_repos: List[str],
    is_prose_fn,
) -> List[str]:
    """
    Pure deterministic helper invoked when a routine node with an `until:` loop returns `inspect_files`
    (or unread prose docs in `requested_files`). Clamps URIs to `topology_ledger`, reads their
    content/interfaces into `envelope.attached_docs_content`, mounts inspected prose docs onto `envelope`
    as reference context, and returns the list of newly inspected URIs.
    """
    if not isinstance(parsed_output, dict) or envelope is None:
        return []
    combined_docs_str = str(envelope.attached_docs_content or "")
    raw_inspect = list(parsed_output.get("inspect_files") or [])
    items_check = parsed_output.get("requested_items_check")
    item_files: List[str] = []
    if isinstance(items_check, list):
        for it_entry in items_check:
            if not isinstance(it_entry, dict):
                continue
            for doc_u in (it_entry.get("referenced_docs_to_inspect") or []):
                if isinstance(doc_u, str) and doc_u.strip() and doc_u.strip() not in raw_inspect:
                    raw_inspect.append(doc_u.strip())
            for f_u in (it_entry.get("files") or []):
                if isinstance(f_u, str) and f_u.strip():
                    if is_prose_fn(f_u.strip()) and f_u.strip() not in raw_inspect:
                        raw_inspect.append(f_u.strip())
                    elif f_u.strip() not in item_files:
                        item_files.append(f_u.strip())
    if item_files:
        merged_req = list(dict.fromkeys(list(parsed_output.get("requested_files") or []) + item_files))
        parsed_output["requested_files"] = merged_req
    raw_req_docs = [
        f for f in (list(parsed_output.get("requested_files") or []) + list(parsed_output.get("global_files") or []))
        if isinstance(f, str) and is_prose_fn(f) and InSetuURI(f).basename != "CODE_INDEX.md"
    ]
    allowed = None if (not envelope.pinned_repos or "ALL" in envelope.pinned_repos) else list(envelope.pinned_repos)
    raw_req_list = [f.strip() for f in (parsed_output.get("requested_files") or []) if isinstance(f, str) and f.strip()]
    all_raw_paths = [f.strip() for f in (raw_inspect + raw_req_list) if isinstance(f, str) and f.strip()]
    unresolved_notes: List[str] = []
    for raw_p in all_raw_paths:
        resolved_single = clamp_rag_files_to_topology(ctx, [raw_p], allowed_repos=allowed, max_files=1, allow_genesis=False)
        if not resolved_single:
            if allowed is not None:
                unpinned_hit = clamp_rag_files_to_topology(ctx, [raw_p], allowed_repos=all_sister_repos, max_files=1, allow_genesis=False)
                if unpinned_hit:
                    hit_repo = InSetuURI(unpinned_hit[0]).repo
                    unpinned_msg = (
                        f"Path '{raw_p}' resolves to '{unpinned_hit[0]}' in unpinned repository '{hit_repo}'. "
                        f"Ask the user to pin '{hit_repo}' (+{hit_repo}) if that repository should be included."
                    )
                    unpinned_list = envelope.sys.setdefault("unpinned_repo_notices", [])
                    if unpinned_msg not in unpinned_list:
                        unpinned_list.append(unpinned_msg)
            note = describe_unresolved_rag_path(ctx, raw_p, allowed_repos=allowed, prefix_label="Unresolved path")
            if note not in combined_docs_str and note not in unresolved_notes:
                unresolved_notes.append(note)

    candidates = clamp_rag_files_to_topology(ctx, raw_inspect + raw_req_docs, allowed_repos=allowed, allow_genesis=False)
    new_to_read = [u for u in candidates if f"DOCUMENT: {u}" not in combined_docs_str and f"INTERFACE: {u}" not in combined_docs_str]
    resolved_req = clamp_rag_files_to_topology(ctx, raw_req_list, allowed_repos=allowed, allow_genesis=False) if raw_req_list else []
    if not new_to_read and not unresolved_notes:
        return []
    blocks: List[str] = [combined_docs_str] if combined_docs_str else []
    if unresolved_notes:
        blocks.append(
            "=== SCOUT PATH RESOLUTION FEEDBACK (Correct these URIs in requested_files) ===\n"
            + "\n".join(unresolved_notes)
        )
    inspected_docs: List[str] = []
    for u in new_to_read[:6]:
        raw_u = ctx.vfs.read(u)
        if not raw_u:
            continue
        if is_prose_fn(u):
            clean_u = re.sub(r'^---\r?\n[\s\S]*?\r?\n---\r?\n', '', raw_u, count=1)
            blocks.append(f"=== INSPECTED DOCUMENT: {u} ===\n{prioritize_document_sections(user_prompt, clean_u)}")
            inspected_docs.append(u)
        else:
            prov = get_language_provider(u)
            sliced_u = prov.slice_interface(u, raw_u) if prov else raw_u[:6000]
            blocks.append(f"=== INSPECTED INTERFACE: {u} ===\n{sliced_u[:12000]}")
    envelope.attached_docs_content = "\n\n".join(b for b in blocks if b)
    if inspected_docs:
        envelope.apply_working_set_delta(slice_uris=inspected_docs, source="scout_hop2")
    if new_to_read:
        return new_to_read
    # Only force another LLM hop on path feedback if the scout explicitly requested inspect_files that failed to resolve,
    # or if zero requested_files resolved at all.
    if unresolved_notes and (raw_inspect or not resolved_req):
        return ["ctx://contexts/scout_path_feedback.txt"]
    return []


def expand_scouted_working_set_targets(
    ctx,
    envelope,
    *,
    user_prompt: str,
    all_sister_repos: List[str],
    primary_repo_name: str,
    is_prose_fn,
    discover_const_fn,
) -> None:
    """
    Consolidates scouted candidate files on `RoutineEnvelope`, extracts deterministic file references
    from attached/inspected documents, scopes the working set to the active `PlanTask` (when a multi-step
    plan is active), expands 1-hop AST/affinity neighbors at `slice` lens, and refreshes Tier 0 constitution.
    """
    raw_scout_list = list(envelope.scouted_candidate_files or [])

    def _infer_repos(docs_str: str) -> List[str]:
        explicit = {
            InSetuURI(f).repo
            for f in envelope.all_context_files
            if InSetuURI(f).scheme == "vfs" and InSetuURI(f).repo in all_sister_repos
        }
        haystack = f"{user_prompt or ''}\n{docs_str or ''}".lower()
        mentioned = {
            r for r in all_sister_repos
            if re.search(rf'(?<![a-z0-9_-]){re.escape(r.lower())}(?![a-z0-9_-])', haystack)
        }
        rel = explicit | mentioned
        return [r for r in all_sister_repos if r in rel] if rel else list(all_sister_repos)

    is_deterministic_scout = (
        envelope.sys.get("rag_strategy") == "blast_radius"
        or envelope.sys.get("helper_mode") == "deterministic"
    )
    combined_docs_str = envelope.attached_docs_content or ""
    relevant_repos = _infer_repos(combined_docs_str)
    allowed = (
        relevant_repos
        if (not envelope.pinned_repos or "ALL" in envelope.pinned_repos)
        else [r for r in relevant_repos if r in envelope.pinned_repos] or list(envelope.pinned_repos)
    )
    hop1_files = clamp_rag_files_to_topology(ctx, raw_scout_list, allowed_repos=allowed, allow_genesis=False) if raw_scout_list else []
    scouted_files = [f for f in hop1_files if InSetuURI(f).basename != "CODE_INDEX.md"]
    dropped_hop1: List[str] = []

    if is_deterministic_scout and combined_docs_str:
        for doc_ref_fp in extract_doc_referenced_files(ctx, user_prompt, combined_docs_str, allowed_repos=allowed):
            if doc_ref_fp and not is_prose_fn(doc_ref_fp) and doc_ref_fp not in scouted_files:
                scouted_files.append(doc_ref_fp)
        relevant_repos = _infer_repos(combined_docs_str)

    # --- Active Plan Resolution (Canonical PlanDocument or Existing Session Plan) ---
    from insetu.core.agent.schemas.plan import (
        format_active_plan_meta_projection as _format_plan_meta,
        normalize_active_plan_dict as _norm_plan_dict,
        parse_plan_markdown as _parse_plan_md,
    )

    existing_plan = envelope.active_plan if isinstance(envelope.active_plan, dict) else None
    plan_source_uri = next((f for f in envelope.all_context_files if is_prose_fn(f)), "")
    raw_scout_tasks = list(envelope.scouted_tasks or [])
    if not existing_plan and not raw_scout_tasks and plan_source_uri:
        raw_plan_txt = ctx.vfs.read(plan_source_uri) or ""
        ok_p, parsed_doc, _ = _parse_plan_md(raw_plan_txt)
        doc_tasks = ([t for s in parsed_doc.sprints for t in s.tasks] if parsed_doc and parsed_doc.tier == "epic" else (parsed_doc.tasks if parsed_doc else []))
        if ok_p and parsed_doc and doc_tasks:
            existing_plan = _norm_plan_dict(
                [t.to_dict() for t in doc_tasks],
                title=parsed_doc.title,
                source_uri=plan_source_uri,
                plan_filepath=plan_source_uri,
                is_ephemeral=False,
                clamp_fn=lambda uris: clamp_rag_files_to_topology(ctx, uris, allowed_repos=all_sister_repos, allow_genesis=True),
            )
    elif raw_scout_tasks:
        existing_plan = _norm_plan_dict(
            raw_scout_tasks,
            title=f"Plan: {user_prompt[:48]}",
            source_uri=plan_source_uri,
            plan_filepath=existing_plan.get("plan_filepath", "") if existing_plan else "",
            is_ephemeral=not bool(existing_plan and existing_plan.get("plan_filepath")),
            existing_plan=existing_plan,
            clamp_fn=lambda uris: clamp_rag_files_to_topology(ctx, uris, allowed_repos=all_sister_repos, allow_genesis=True),
        )

    raw_global_list = list(getattr(envelope, "scouted_global_files", None) or [])
    global_files = [
        gf for gf in (clamp_rag_files_to_topology(ctx, raw_global_list, allowed_repos=allowed, allow_genesis=False) if raw_global_list else [])
        if InSetuURI(gf).basename != "CODE_INDEX.md"
    ]
    if plan_source_uri and plan_source_uri not in global_files:
        global_files.insert(0, plan_source_uri)
    global_prose_docs = [gf for gf in global_files if is_prose_fn(gf)]
    global_code_slices = [gf for gf in global_files if not is_prose_fn(gf)]

    # 3. Enrich every task's `targets` with any existing workspace files mentioned in its `description` or `test_contract`,
    # then scope this turn's working set strictly to `global_prose_docs` + the active step's `targets`!
    if isinstance(existing_plan, dict) and len(existing_plan.get("tasks") or []) >= 2:
        for t_item in existing_plan["tasks"]:
            if not isinstance(t_item, dict):
                continue
            t_targets = list(t_item.get("targets") or [])
            t_desc = str(t_item.get("description") or "")
            for desc_file in extract_doc_referenced_files(ctx, t_desc, t_desc, allowed_repos=all_sister_repos, max_files=6):
                if desc_file and InSetuURI(desc_file).basename != "CODE_INDEX.md" and desc_file not in t_targets:
                    t_targets.append(desc_file)
            if t_item.get("test_contract"):
                tc_uri = str(t_item["test_contract"]).split("::", 1)[0].strip()
                for c_tc in clamp_rag_files_to_topology(ctx, [tc_uri], allowed_repos=all_sister_repos, allow_genesis=True):
                    if c_tc and c_tc not in t_targets:
                        t_targets.append(c_tc)
            t_item["targets"] = t_targets

        act_id = existing_plan.get("active_task_id")
        act_task = next((t for t in existing_plan["tasks"] if t.get("id") == act_id), None) or next(
            (t for t in existing_plan["tasks"] if not t.get("completed")), None
        )
        if act_task and act_task.get("targets"):
            step_targets = list(act_task["targets"])
            prose_docs_to_keep = list(dict.fromkeys(
                global_prose_docs + [
                    f for f in scouted_files
                    if is_prose_fn(f) and (f == plan_source_uri or f in step_targets or InSetuURI(f).basename in (act_task.get("description") or ""))
                ]
            ))
            deferred_files = [
                f for f in list(envelope.editable_files) + list(envelope.readonly_files) + scouted_files
                if f not in step_targets and f not in prose_docs_to_keep and f not in global_code_slices
            ]
            for df in deferred_files:
                if df in envelope.artifacts and envelope.artifacts[df].source != "user_pinned":
                    del envelope.artifacts[df]
                if df not in dropped_hop1:
                    dropped_hop1.append(df)
            for g_code in global_code_slices:
                if g_code not in step_targets and g_code in envelope.artifacts and envelope.artifacts[g_code].source != "user_pinned":
                    del envelope.artifacts[g_code]
            scouted_files = list(dict.fromkeys(prose_docs_to_keep + step_targets))
            relevant_repos = list({
                InSetuURI(f).repo for f in step_targets if InSetuURI(f).scheme == "vfs" and InSetuURI(f).repo
            }) or relevant_repos
        envelope.active_plan = existing_plan
        envelope.active_plan_prompt_block = _format_plan_meta(existing_plan)

    envelope.apply_working_set_delta(
        add=scouted_files,
        slice_uris=[gf for gf in global_code_slices if gf not in scouted_files],
        drop=dropped_hop1,
        source="scout_hop1",
    )
    code_seeds = [u for u in envelope.editable_files if not is_prose_fn(u)]
    if code_seeds and (is_deterministic_scout or (isinstance(existing_plan, dict) and len(existing_plan.get("tasks") or []) >= 2)):
        _, blast_refs = assemble_blast_radius(ctx, code_seeds, user_message=user_prompt)
        blast_uris: List[str] = []
        blast_sym_map: Dict[str, List[str]] = {}
        for r in (blast_refs or []):
            if not isinstance(r, dict) or not r.get("filepath"):
                continue
            bfp = r["filepath"]
            if InSetuURI(bfp).repo in relevant_repos and bfp not in envelope.artifacts:
                blast_uris.append(bfp)
                if r.get("symbols"):
                    blast_sym_map[bfp] = list(r["symbols"])
        if blast_uris:
            envelope.apply_working_set_delta(
                slice_uris=blast_uris[:12],
                slice_symbols_map=blast_sym_map,
                source="blast_radius",
            )

    scoped_const = envelope.refresh_constitution(discover_const_fn(ctx), primary_repo_name)
    envelope.file_token_map = build_context_file_metrics(
        ctx, scoped_const, envelope.readonly_files, envelope.editable_files
    )





def record_affinity_interaction(
    ctx,
    file_list: List[str],
    interaction_type: str = "chat",
    weight: float = 1.0,
) -> None:
    """Updates co-occurrence weights in the persistent SQLite affinity_edges table."""
    valid_files = sorted(list(dict.fromkeys(str(InSetuURI(f)) for f in file_list if f and "://" in str(f))))
    if len(valid_files) < 2:
        return

    now_ts = time.time()
    conn = ctx.get_db("vfs_index")
    updates = []

    for i in range(len(valid_files)):
        for j in range(i + 1, len(valid_files)):
            fa, fb = valid_files[i], valid_files[j]
            edge_id = f"{fa}::{fb}"
            c_commit = weight if interaction_type == "commit" else 0.0
            c_pin = weight if interaction_type == "pin" else 0.0
            c_chat = weight if interaction_type == "chat" else 0.0
            c_miss = weight if interaction_type == "miss" else 0.0
            updates.append((edge_id, fa, fb, c_commit, c_pin, c_chat, c_miss, now_ts))

    conn.executemany("""
        INSERT INTO affinity_edges (edge_id, file_a, file_b, commit_co_count, pin_co_count, chat_co_count, scout_miss_count, last_updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(edge_id) DO UPDATE SET
            commit_co_count = commit_co_count + excluded.commit_co_count,
            pin_co_count = pin_co_count + excluded.pin_co_count,
            chat_co_count = chat_co_count + excluded.chat_co_count,
            scout_miss_count = scout_miss_count + excluded.scout_miss_count,
            last_updated_at = excluded.last_updated_at
    """, updates)
    conn.commit()


def assemble_blast_radius(
    ctx,
    edit_targets: List[str],
    user_message: str = "",
    history_summary: str = "",
    max_rag_files: int = 15,
) -> Tuple[List[str], List[Dict[str, Any]]]:
    """
    4-Layer Deterministic Blast Radius:
    1. Seed resolution (explicit edit_targets).
    2. Upstream callees (exact imported symbol definitions).
    3. Downstream callers (export impact radius via Cartographer / search).
    4. Topological bucket siblings & Hebbian affinity edges.
    """
    clean_edits = clamp_uris_to_topology(
        ctx.workspace_id,
        list(dict.fromkeys(str(InSetuURI(f)) for f in edit_targets if f)),
        expand_dirs=True,
    )
    reference_map: Dict[str, Set[str]] = {}

    for ef in clean_edits:
        content = ctx.vfs.read(ef)
        provider = get_language_provider(ef) if content else None
        if not provider or not content:
            continue
        for imp in provider.imports(ef, content):
            mod_path = (imp.get("module") or "").strip()
            names = imp.get("names") or []
            if mod_path.startswith(".") and mod_path.lstrip("./"):
                uri_obj = InSetuURI(ef)
                cand_uri = uri_obj.parent_uri.join(mod_path.lstrip("./"))
                trials = [f"{cand_uri}{ext}" for ext in (".py", ".js", ".ts", ".rs")] + [str(cand_uri)]
                matched_trials = clamp_uris_to_topology(ctx.workspace_id, trials, expand_dirs=False)
                if matched_trials and matched_trials[0] not in clean_edits:
                    reference_map.setdefault(matched_trials[0], set()).update(names)
        for exp in provider.exports(ef, content):
            exp_name = exp.get("name")
            if exp_name:
                for hit in ctx.emit_merge_list("vfs_search", query=exp_name)[:3]:
                    hit_path = str(InSetuURI(hit.get("path") or ""))
                    if hit_path and hit_path not in clean_edits and hit_path != ef:
                        reference_map.setdefault(hit_path, set()).add(exp_name)

    for peer in get_affinity_neighbors(ctx, clean_edits, top_k=4):
        if peer not in clean_edits and peer not in reference_map:
            reference_map.setdefault(peer, set())
    if len(reference_map) < 2:
        for ef in clean_edits:
            ef_uri = InSetuURI(ef)
            if ef_uri.scheme == "vfs" and ef_uri.repo and ef_uri.path:
                for sib in clamp_uris_to_topology(ctx.workspace_id, [f"{ef_uri.parent_uri}/"], expand_dirs=True):
                    bname = InSetuURI(sib).basename
                    if sib not in clean_edits and sib not in reference_map and not bname.startswith(".") and not sib.endswith(".md"):
                        reference_map.setdefault(sib, set())
                        if len(reference_map) >= 4:
                            break

    valid_ref_uris = set(clamp_uris_to_topology(ctx.workspace_id, list(reference_map.keys()), expand_dirs=False))
    ref_targets = [
        {"filepath": fp, "symbols": sorted(syms)}
        for fp, syms in reference_map.items()
        if fp in valid_ref_uris
        and ctx.vfs.read(fp) is not None
        and not (fp.endswith("/__init__.py") and len((ctx.vfs.read(fp) or "").strip()) < 64)
    ][:max_rag_files]
    return clean_edits, ref_targets


def get_affinity_neighbors(ctx, seed_files: List[str], top_k: int = 5) -> List[str]:
    """Calculates time-decayed Hebbian affinity scores to return top correlated peer files."""
    if not seed_files:
        return []
    conn = ctx.get_db("vfs_index")
    now_ts = time.time()
    seed_set = {str(InSetuURI(s)) for s in seed_files}
    placeholders = ",".join(["?"] * len(seed_set))

    rows = conn.execute(f"""
        SELECT file_a, file_b, commit_co_count, pin_co_count, chat_co_count, scout_miss_count, last_updated_at
        FROM affinity_edges
        WHERE file_a IN ({placeholders}) OR file_b IN ({placeholders})
    """, tuple(seed_set) + tuple(seed_set)).fetchall()

    scores: Dict[str, float] = {}
    for r in rows:
        fa, fb = r["file_a"], r["file_b"]
        peer = fb if fa in seed_set else fa
        if peer in seed_set:
            continue
        dt = max(0.0, now_ts - float(r["last_updated_at"]))
        decay = math.exp(-DECAY_LAMBDA * dt)
        raw_w = (
            3.0 * float(r["commit_co_count"])
            + 2.0 * float(r["pin_co_count"])
            + 1.0 * float(r["chat_co_count"])
            - 0.5 * float(r["scout_miss_count"])
        )
        effective = raw_w * decay
        if effective > 0.0:
            scores[peer] = scores.get(peer, 0.0) + effective

    sorted_peers = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    candidate_peers = [p[0] for p in sorted_peers]
    if not candidate_peers:
        return []
    valid_peers = set(clamp_uris_to_topology(ctx.workspace_id, candidate_peers, expand_dirs=False))
    return [p for p in candidate_peers if p in valid_peers][:top_k]


def prune_stale_affinity_edges(ctx, grace_period_seconds: float = 14 * 86400.0) -> int:
    """
    Garbage-collects affinity_edges rows only after they have been inactive longer than
    grace_period_seconds AND are untracked by topology_ledger.
    """
    conn = ctx.get_db("vfs_index")
    cutoff = time.time() - max(0.0, float(grace_period_seconds))
    try:
        rows = conn.execute(
            "SELECT file_a, file_b FROM affinity_edges WHERE last_updated_at < ?",
            (cutoff,),
        ).fetchall()
    except Exception:
        return 0
    if not rows:
        return 0
    candidates = list({r["file_a"] for r in rows} | {r["file_b"] for r in rows})
    valid_set = set(clamp_uris_to_topology(ctx.workspace_id, candidates, expand_dirs=False))
    dead_uris = [u for u in candidates if u not in valid_set]
    if not dead_uris:
        return 0
    ph = ",".join(["?"] * len(dead_uris))
    cur = conn.execute(
        f"DELETE FROM affinity_edges WHERE last_updated_at < ? AND (file_a IN ({ph}) OR file_b IN ({ph}))",
        (cutoff, *dead_uris, *dead_uris),
    )
    conn.commit()
    return int(cur.rowcount or 0)


def slice_code_index_for_blast_radius(
    ctx,
    seed_files: List[str],
    max_chars: int = 6000,
) -> str:
    """
    Slices a repository's CODE_INDEX.md to retain only top-level directory landmarks and
    the specific directory subtrees (files + AST symbol coordinates) matching `seed_files`.
    """
    if not seed_files or ctx is None:
        return ""
    ancestor_dirs_by_repo: Dict[str, Set[str]] = {}
    leaf_dirs_by_repo: Dict[str, Set[str]] = {}
    target_basenames_by_repo: Dict[str, Set[str]] = {}
    for raw_f in seed_files:
        if not raw_f or "://" not in str(raw_f):
            continue
        uri = InSetuURI(raw_f)
        if uri.scheme != "vfs" or not uri.repo or not uri.path:
            continue
        rel_p = uri.path.strip("/")
        parent_dir = Path(rel_p).parent.as_posix()
        ancestor_dirs_by_repo.setdefault(uri.repo, set())
        leaf_dirs_by_repo.setdefault(uri.repo, set())
        if parent_dir and parent_dir != ".":
            parts = [p for p in parent_dir.split("/") if p]
            for p_seg in parts[:-1]:
                ancestor_dirs_by_repo[uri.repo].add(p_seg)
            if parts:
                leaf_dirs_by_repo[uri.repo].add(parts[-1])
        target_basenames_by_repo.setdefault(uri.repo, set()).add(uri.basename)

    if not leaf_dirs_by_repo and not target_basenames_by_repo:
        return ""

    out_sections: List[str] = []
    entry_re = re.compile(r'^(?P<indent>[│ \t]*)(?:├──|└──)\s+(?P<name>[^\s#]+)')

    for repo in sorted(set(leaf_dirs_by_repo.keys()) | set(target_basenames_by_repo.keys())):
        idx_uri = resolve_repo_code_index_uri(ctx, repo)
        idx_text = ctx.vfs.read(idx_uri) if idx_uri else None
        if not idx_text:
            continue
        anc_names = ancestor_dirs_by_repo.get(repo, set())
        leaf_names = leaf_dirs_by_repo.get(repo, set())
        bnames = target_basenames_by_repo.get(repo, set())
        kept_lines: List[str] = []
        active_dir_depth: Optional[int] = None
        active_file_depth: Optional[int] = None

        for raw_line in idx_text.splitlines():
            m = entry_re.match(raw_line)
            if not m:
                continue
            depth = len(m.group("indent"))
            name = m.group("name").strip()

            if active_file_depth is not None and depth > active_file_depth:
                kept_lines.append(raw_line)
                continue
            active_file_depth = None

            if active_dir_depth is not None and depth <= active_dir_depth:
                active_dir_depth = None

            if name.endswith("/"):
                clean_d = name.rstrip("/")
                if depth <= 4 or clean_d in anc_names:
                    kept_lines.append(raw_line)
                if clean_d in leaf_names:
                    if raw_line not in kept_lines[-1:]:
                        kept_lines.append(raw_line)
                    active_dir_depth = depth
            else:
                if active_dir_depth is not None or name in bnames:
                    kept_lines.append(raw_line)
                    active_file_depth = depth

        if kept_lines:
            joined = "\n".join(kept_lines)
            if len(joined) > max_chars:
                joined = joined[:max_chars] + "\n... [neighborhood index truncated]"
            out_sections.append(
                f"=== TIER 1 NEIGHBORHOOD CODE_INDEX SUBSET (Outline Lens): {idx_uri} ===\n{joined}\n"
            )

    return "\n".join(out_sections)
