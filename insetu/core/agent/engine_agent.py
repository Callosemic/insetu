from pathlib import Path
from datetime import datetime
import os
import re
import time
import uuid
import json
import threading
from typing import TypedDict, List, Dict, Any, Optional, Union, Literal, Tuple
from insetu.core.sdk import InSetuExtension, slugify
from insetu.core.utils_core import (
    InSetuURI,
    parse_blocks,
    generate_ascii_tree,
    get_available_contexts,
)
from insetu.core.bridge.bridge_test import run_repo_test_diagnostics
from insetu.core.gather.context_assemble import discover_constitution_files, record_affinity_interaction
from .orchestrator import (
    execute_declarative_routine,
    list_available_routines,
    load_routine_definition,
    resolve_routine_mode,
    parse_routine_content,
    serialize_routine_to_markdown,
    validate_routine_definition,
)

AGENT_SETTINGS_SCHEMA = [
    {
        "id": "rag_strategy",
        "label": "RAG Context Retrieval Strategy",
        "type": "select",
        "scope": "workspace",
        "default": "blast_radius",
        "options": [
            {"value": "blast_radius", "label": "Blast Radius (Deterministic AST + Bucket + Affinity Slicer, 0 Tokens)"},
            {"value": "llm_scout", "label": "LLM Scout (Fast-Tier 1-Hop / 2-Hop Semantic Discovery)"}
        ],
        "description": "Governs how context.assemble resolves edit targets and interface slices on each turn."
    },
    {
        "id": "compaction_strategy",
        "label": "Rolling History Compaction Strategy",
        "type": "select",
        "scope": "workspace",
        "default": "deterministic",
        "options": [
            {"value": "deterministic", "label": "Deterministic Micro-Receipts & Summary (0 Tokens, <1ms)"},
            {"value": "llm_compactor", "label": "Fast-Tier LLM History Summarizer"}
        ],
        "description": "Controls how conversation turns older than Turn N-5 are compacted into session.summary."
    },
    {
        "id": "run_tests_on_code",
        "label": "Run Diagnostic Test Gate After /code Commits",
        "type": "boolean",
        "scope": "workspace",
        "default": False,
        "description": "Automatically runs bridge.test (JUnit XML + fallback) after syntax-valid /code commits."
    },
    {
        "id": "strict_test_enforcement",
        "label": "Strict Test Gate Enforcement (Rollback on Test Failure)",
        "type": "boolean",
        "scope": "workspace",
        "default": False,
        "description": "When enabled, failing unit tests trigger up to 2 self-heal retries before rolling back to the zlib snapshot."
    }
]

AGENT_SCHEMA = {
    "chat_sessions": {
        "session_id": "TEXT PRIMARY KEY",
        "title": "TEXT",
        "updated_at": "REAL",
        "last_transaction_id": "TEXT",
        "active_job_id": "TEXT",
        "summary": "TEXT DEFAULT ''",
        "working_set_json": "TEXT DEFAULT '[]'",
        "token_ledger_json": "TEXT DEFAULT '{}'",
        "active_plan_path": "TEXT DEFAULT ''",
        "checkpoint_json": "TEXT DEFAULT '{}'"
    },
    "chat_messages": {
        "message_id": "TEXT PRIMARY KEY",
        "session_id": "TEXT",
        "role": "TEXT",
        "content": "TEXT",
        "raw_content": "TEXT",
        "timestamp": "REAL",
        "turn_index": "INTEGER DEFAULT 0"
    }
}

_CANCELLED_SESSIONS = set()
_CANCEL_LOCK = threading.Lock()
agent_bp = InSetuExtension(
    'agent',
    __name__,
    title="Agent Harness",
    description="Autonomous LLM agent and declarative Markdown-as-Code / YAML routine orchestrator.",
    core=True,
    schema=AGENT_SCHEMA,
    settings_schema=AGENT_SETTINGS_SCHEMA,
    volumes={
        "routines": {
            "scheme": "ctx",
            "tier": "data",
            "path_key": "routines_dir",
            "module_subdir": "routines",
            "legacy_dirs": ["routines", "data/agent/routines"],
        },
        "workflows": {
            "scheme": "ctx",
            "tier": "cache",
            "path_key": "workflows_dir",
            "legacy_dirs": ["workflows", "cache/workflows"],
        },
    },
)
__depends__ = ['llm', 'gather', 'bridge']


@agent_bp.on('mutate_workspace_config')
def _inject_agent_workflow_metadata(cfg, workspace_id=None, **kwargs):
    if "virtual_contexts" not in cfg:
        cfg["virtual_contexts"] = []
    vc = {
        "title": "Routine & Workflow Batches",
        "domain": "Routines",
        "description": "Compiled routine and workflow batch context payloads.",
        "out_file": "ctx://workflows/workflows_context.txt",
    }
    if not any(v.get("out_file") == vc["out_file"] for v in cfg["virtual_contexts"]):
        cfg["virtual_contexts"].append(vc)


@agent_bp.on('pre_file_save')
def _handle_routine_response_pre_save(workspace_id=None, filepath=None, content=None, data=None, **kwargs):
    if not data or not filepath:
        return
    archive_path = data.get("archive_path")
    original_response_path = data.get("original_response_path")
    if archive_path and original_response_path and "{date}" in original_response_path:
        ctx = agent_bp.get_context(workspace_id)
        file_uri = InSetuURI(filepath)
        basename = Path(original_response_path).name
        prefix = basename.split("{date}")[0]
        logical_target_dir = str(file_uri.parent_uri)
        archive_uri = file_uri.resolve_sibling_uri(archive_path)

        for walk_path in ctx.vfs.walk(logical_target_dir):
            if walk_path == str(file_uri):
                continue
            walk_uri = InSetuURI(walk_path)
            if str(walk_uri.parent_uri) == logical_target_dir and walk_uri.basename.startswith(prefix):
                dest_path = str(archive_uri.join(walk_uri.basename))
                old_content = ctx.vfs.read(walk_path)
                if old_content is not None:
                    ctx.vfs.save(dest_path, old_content)
                    ctx.vfs.delete(walk_path, data={"ignore_ledger": True})


@agent_bp.on('heal_missing_domain_volume')
def _heal_missing_agent_workflows_volume(ctx, volume=None, workspace_id=None, **kwargs):
    if volume == "workflows":
        _background_compile_routine_workflows(ctx, force_full=True)


@agent_bp.on('register_compilation_steps')
def _register_agent_workflow_compilation_step(workspace_id=None, **kwargs):
    return [{
        "id": "agent_workflows",
        "anchor": "body",
        "order": 40,
        "depends_on": ["gather_base", "git_diffs"],
        "ext_name": "agent",
        "worker_name": "compile_routine_workflows_task",
    }]


@agent_bp.worker("compile_routine_workflows_task")
def _background_compile_routine_workflows(
    ctx,
    force_full: Union[bool, Literal["compile_only"]] = False,
    compile_only: bool = False,
    target_repos: Optional[List[str]] = None,
    ledger_events: Optional[List[Dict[str, Any]]] = None,
    chain_state: Optional[Dict[str, Any]] = None,
):
    ctx.jobs.update_progress("Packing routine context batches...")
    ctx.sync_vfs_barrier()
    all_routines = [r for r in list_available_routines(ctx) if isinstance(r, dict) and r.get("includes")]
    current_manifest = ctx.manifest.get("ctx", {})
    manifest_deltas = {}

    if not all_routines:
        ctx.reconcile_domain(
            domain_uri_prefix="ctx://workflows/workflow_",
            manifest_deltas={},
            domain_dir="ctx://workflows",
            target_repos=target_repos,
        )
        return {"message": "No routine batches with static includes to pack."}
    effective_chain_state = chain_state if chain_state is not None else (ctx.jobs.chain_state or {})
    touched_buckets = effective_chain_state.get("touched_buckets")
    touched_diffs = effective_chain_state.get("touched_diffs")
    ledger_events = ledger_events or []
    explicit_target_repos = set(target_repos or [])
    mutated_vfs_files = {
        str(InSetuURI(e.get("filepath", "") if isinstance(e, dict) else str(e)))
        for e in ledger_events
        if (e.get("filepath") if isinstance(e, dict) else e) and "://" in str(e.get("filepath") if isinstance(e, dict) else e)
    }

    def _pack_routine(routine):
        rid = routine.get("id")
        includes = routine.get("includes") or []
        if not rid or not includes:
            return None, None
        base_uri = f"ctx://workflows/workflow_{rid}_context.txt"
        expanded_chunks = ctx.expand_selection(includes)
        batch_repos = set()
        expanded_base_uris = set()
        has_targeted_raw_files = False
        for chunk_id in expanded_chunks:
            expanded_base_uris.add(chunk_id)
            chunk_uri = InSetuURI(chunk_id)
            if chunk_uri.scheme == "ctx":
                base_cand = re.sub(r'_part\d+\.txt$', '.txt', chunk_id)
                expanded_base_uris.add(base_cand)
                meta_item = (current_manifest.get(base_cand) or {}).get("meta", {})
                item_repos = meta_item.get("repos") or ([meta_item.get("repo")] if meta_item.get("repo") else [])
                batch_repos.update(r for r in item_repos if r)
            elif chunk_uri.repo:
                batch_repos.add(chunk_uri.repo)
                if chunk_uri.scheme == "vfs" and (
                    str(chunk_uri) in mutated_vfs_files
                    or (explicit_target_repos and chunk_uri.repo in explicit_target_repos)
                ):
                    has_targeted_raw_files = True

        existing_entry = current_manifest.get(base_uri)
        chunks_exist_on_disk = ctx.is_context_on_disk(base_uri, existing_entry)
        if not force_full and target_repos and not (batch_repos & set(target_repos)) and chunks_exist_on_disk:
            return base_uri, existing_entry
        if not force_full and touched_buckets is not None and touched_diffs is not None and chunks_exist_on_disk:
            changed_deps = set(touched_buckets + touched_diffs)
            if not has_targeted_raw_files and not (expanded_base_uris & changed_deps):
                return base_uri, existing_entry

        text_blocks = []
        resolved_files = []
        for chunk_id in expanded_chunks:
            chunk_uri = InSetuURI(chunk_id)

            content = ctx.vfs.read(str(chunk_uri))
            if content is None and chunk_uri.scheme == "ctx":
                phys = ctx.resolve_path(str(chunk_uri), must_exist=True, allow_heal=False)
                if phys:
                    content = ctx.vfs.read(phys, is_absolute_artifact=True)
            if content is not None:
                text_blocks.append(f"--- {chunk_id} ---\n{content}\n\n")
                resolved_files.append(chunk_id)
            elif chunk_uri.is_diff:
                text_blocks.append(f"--- {chunk_id} (NO PENDING DIFFS) ---\n[Working tree clean.]\n\n")
                resolved_files.append(chunk_id)

        header_str = f"========== ROUTINE BATCH: {routine.get('title', rid)} ==========\n\n"
        header_str += generate_ascii_tree(resolved_files) + "\n\n"
        sorted_repos = sorted(batch_repos)
        meta = {
            "type": "routine",
            "title": routine.get("title", rid),
            "domain": routine.get("domain", "Routines"),
            "desc": routine.get("description") or "Compiled routine context payload.",
            "repo": sorted_repos[0] if len(sorted_repos) == 1 else "global",
            "bucket_id": "workflows",
            "repos": sorted_repos,
        }
        entry = ctx.compile_context(base_uri, header_str, text_blocks, resolved_files, meta)
        return base_uri, entry

    for filename, entry in ctx.jobs.map_parallel(_pack_routine, all_routines):
        if filename and entry:
            manifest_deltas[filename] = entry

    ctx.reconcile_domain(
        domain_uri_prefix="ctx://workflows/workflow_",
        manifest_deltas=manifest_deltas,
        domain_dir="ctx://workflows",
        target_repos=target_repos,
    )
    return {
        "message": "Routine workflows compiled successfully.",
        "artifact": {
            "step_id": "agent_workflows",
            "files": list(manifest_deltas.keys()),
            "cleared_buckets": ["global::workflows"],
            "touched_buckets": ["global::workflows"],
            "is_full_sweep": False,
        },
    }


class ChatSessionPayload(TypedDict):
    title: str
class ChatPromptPayload(TypedDict, total=False):
    session_id: str
    prompt: str
    mode: str
    profile_id: str
    attached_files: List[str]
    read_only_files: List[str]
    routine_id: str
    transport: str
    handoff_responses: Dict[str, str]
    prior_chain_context: Dict[str, Any]


class AgentSessionActionPayload(TypedDict, total=False):
    session_id: str
    transaction_id: str
def _parse_colon_command_tokens(raw_prompt: str) -> Dict[str, str]:
        """
        Parses universal colon-scoped slash commands:
            - /code               -> namespace='', target='code', scope='', rest=''
            - /upkeep:docs        -> namespace='', target='upkeep', scope='docs', rest=''
            - /upkeep:docs:apply  -> namespace='', target='upkeep', scope='docs', stage='apply'
            - /user:upkeep:docs   -> namespace='user', target='upkeep', scope='docs', rest=''
        """
        text = (raw_prompt or "").strip()
        if not text.startswith("/"):
                return {"namespace": "", "target": "", "scope": "", "stage": "", "rest": text}
        first_token, _, rest = text.partition(" ")
        parts = [p.strip().lower() for p in first_token[1:].split(":") if p.strip()]
        if not parts:
                return {"namespace": "", "target": "", "scope": "", "stage": "", "rest": rest.strip()}

        namespace = ""
        if parts[0] == "user":
                namespace = "user"
                parts = parts[1:]

        target = parts[0] if parts else ""
        tail = parts[1:] if len(parts) > 1 else []
        stage = ""
        scope = ""
        for seg in tail:
                if seg in ("apply", "execute", "commit"):
                        stage = "apply"
                elif seg in ("audit", "plan", "propose"):
                        stage = "audit"
                elif not scope:
                        scope = seg
        return {
                "namespace": namespace,
                "target": target,
                "scope": scope,
                "stage": stage,
                "rest": rest.strip(),
        }


def _parse_slash_command(raw_prompt: str, explicit_mode: Optional[str] = None, routine: Optional[Dict[str, Any]] = None):
        """Parses leading colon-scoped slash commands (/code, /plan, /ask, /yomama, /upkeep:docs, /user:<id>:<scope>, /undo)."""
        text = (raw_prompt or "").strip()
        fallback_mode = (explicit_mode or "auto").strip().lower().lstrip("/")
        if text.startswith("/"):
                parsed_tok = _parse_colon_command_tokens(text)
                target = parsed_tok["target"]
                rest = parsed_tok["rest"]
                if target == "undo":
                        return "undo", rest
                if parsed_tok["namespace"] == "user":
                        return (target or "auto"), (rest or target or text)
                if routine and (
                        target in (routine.get("modes") or {})
                        or target == str(routine.get("id") or "").lower()
                        or f"/{target}" == str(routine.get("slash_command") or "").lower()
                ):
                        return target, (rest or target or text)
                if target in ("code", "plan", "ask", "yomama", "auto"):
                        return target, (rest or text)
        if routine:
                canon_mode, _, _ = resolve_routine_mode(routine, fallback_mode)
                return canon_mode, text
        return fallback_mode if fallback_mode in ("code", "plan", "ask", "yomama", "auto") else "auto", text
@agent_bp.route('routines', methods=['GET'], docstring="[sync] Lists all available declarative Markdown-as-Code (.md) and YAML (.yaml) routines with wavefront metadata and available contexts/prompts.")
def get_routines(ctx):
    routines = list_available_routines(ctx)
    expected_contexts = get_available_contexts(ctx.workspace_id, exclusion_flags=["exclude_from_context"], exclude_types=["diff", "routine"])
    available_diffs = []
    available_prompts = []
    try:
        available_diffs = ctx.emit_merge_list('request_available_diffs')
        available_prompts = ctx.emit_merge_list('request_available_prompts')
    except Exception:
        pass
    is_base = lambda name: bool(name and isinstance(name, str) and not re.search(r'_part\d+\.txt$', name))
    return {
        "routines": routines,
        "available_contexts": sorted([c for c in expected_contexts if is_base(c)]),
        "available_diffs": sorted([d for d in set(available_diffs) if is_base(d)]),
        "available_prompts": sorted([p for p in available_prompts if isinstance(p, str)]),
    }
class RoutineSavePayload(TypedDict, total=False):
    id: str
    title: str
    name: str
    domain: str
    description: str
    slash_command: str
    scope: str
    transport: str
    original_id: Optional[str]
    includes: Optional[List[str]]
    show_if_exists: Optional[List[str]]
    show_if_missing: Optional[List[str]]
    include_prompt: Optional[str]
    response_path: Optional[str]
    archive_path: Optional[str]
    nodes: Optional[List[Dict[str, Any]]]
    routine: Optional[Dict[str, Any]]
    raw_content: Optional[str]
    markdown_text: Optional[str]


@agent_bp.route('routines/save', methods=['POST'], request_schema=RoutineSavePayload, docstring="[sync] Validates and saves or forks a declarative routine in ctx://routines/ or ctx://routines/.templates/user/.")
def api_save_routine(ctx):
    data = dict(ctx.payload or {})
    if isinstance(data.get("routine"), dict):
        nested = dict(data.pop("routine"))
        nested.update(data)
        data = nested
    scope = str(data.pop("scope", "workspace") or "workspace").strip().lower()
    raw_content = data.pop("raw_content", None) or data.pop("markdown_text", None)
    original_id = str(data.pop("original_id", "") or "").strip()

    try:
        if raw_content and isinstance(raw_content, str) and raw_content.strip():
            parsed = parse_routine_content(raw_content, fallback_id=data.get("id") or "routine", is_markdown=True)
            rid = slugify(data.get("id") or parsed.get("id") or parsed.get("title") or "routine")
            parsed["id"] = rid
            is_valid, err_msg, wave_ids = validate_routine_definition(parsed)
            if not is_valid:
                return {"error": err_msg}, 422
            parsed["wavefronts"] = wave_ids
            md_content = raw_content if raw_content.lstrip().startswith("---") else serialize_routine_to_markdown(parsed)
        else:
            rid = slugify(data.get("id") or data.get("title") or data.get("name") or "routine")
            if not rid:
                return {"error": "Routine id or title is required."}, 400
            data["id"] = rid
            is_valid, err_msg, wave_ids = validate_routine_definition(data)
            if not is_valid:
                return {"error": err_msg}, 422
            md_content = serialize_routine_to_markdown(data)
            parsed = parse_routine_content(md_content, fallback_id=rid, is_markdown=True)
            parsed["wavefronts"] = wave_ids
    except Exception as val_err:
        return {"error": str(val_err)}, 422

    target_uri = (
        f"ctx://routines/.templates/user/{rid}.md"
        if scope in ("user", "global", "user_template")
        else f"ctx://routines/{rid}.md"
    )
    if original_id and original_id != rid:
        old_uri = (
            f"ctx://routines/.templates/user/{original_id}.md"
            if scope in ("user", "global", "user_template")
            else f"ctx://routines/{original_id}.md"
        )
        if ctx.vfs.read(old_uri) is not None:
            ctx.vfs.delete(old_uri)

    ctx.vfs.save(target_uri, md_content)
    job_id = None
    if parsed.get("includes"):
        job_id = ctx.jobs.submit("compile_routine_workflows_task", coalesce=True, job_category="ui_blocking")

    return {
        "status": "success",
        "filepath": target_uri,
        "routine": {**parsed, "filepath": target_uri, "source": "user_template" if "user/" in target_uri else "workspace"},
        "routines": list_available_routines(ctx),
        "job_id": job_id,
    }


class RoutineDeletePayload(TypedDict, total=False):
    id: str
    filepath: Optional[str]
    scope: Optional[str]


@agent_bp.route('routines/delete', methods=['POST'], request_schema=RoutineDeletePayload, docstring="[sync] Deletes a workspace or user-template routine override (reverting to the built-in template if one exists).")
def api_delete_routine(ctx):
    data = ctx.payload or {}
    rid = str(data.get("id") or "").strip().lstrip("/")
    fp = str(data.get("filepath") or "").strip()
    scope = str(data.get("scope") or "workspace").strip().lower()

    candidates = []
    if fp and (fp.startswith("ctx://routines/") and ("/.templates/" not in fp or "/.templates/user/" in fp)):
        candidates.append(fp)
    if rid:
        if scope in ("user", "global", "user_template"):
            candidates.extend([f"ctx://routines/.templates/user/{rid}.md", f"ctx://routines/.templates/user/{rid}.yaml"])
        else:
            candidates.extend([f"ctx://routines/{rid}.md", f"ctx://routines/{rid}.yaml"])

    deleted = []
    for cand in candidates:
        if ctx.vfs.read(cand) is not None:
            ctx.vfs.delete(cand)
            deleted.append(cand)

    job_id = ctx.jobs.submit("compile_routine_workflows_task", coalesce=True, job_category="system_background")
    return {
        "status": "success",
        "deleted": deleted,
        "routines": list_available_routines(ctx),
        "job_id": job_id,
    }


class EnsurePlanFilePayload(TypedDict, total=False):
    repo: Optional[str]
    title: Optional[str]
    plan_uri: Optional[str]


@agent_bp.route('ensure_plan_file', methods=['POST'], request_schema=EnsurePlanFilePayload, docstring="[sync] Resolves or creates a canonical Markdown plan file URI for the /plan routine.")
def api_ensure_plan_file(ctx):
    data = ctx.payload or {}
    explicit_uri = str(data.get("plan_uri") or "").strip()
    if explicit_uri and explicit_uri not in ("None", "null"):
        canon = InSetuURI.canonicalize(explicit_uri)
        existing = ctx.vfs.read(canon) or ""
        return {"plan_uri": canon, "existing_content": existing}

    repos = [r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")]
    repo = str(data.get("repo") or (repos[0] if repos else "global")).strip()
    title = str(data.get("title") or "Architecture Plan").strip()
    safe_title = title.replace('"', "'")
    date_str = datetime.now().strftime("%Y-%m-%d")
    slug = slugify(title)[:40] or "plan"
    folder = f"vfs://{repo}/.insetu-data/notes" if (repo != "global" and repo in repos and "notes" in ctx.get_active_modules()) else "ctx://notes"
    plan_uri = f"{folder}/{date_str}-{slug}.md"
    existing = ctx.vfs.read(plan_uri)
    if existing is None:
        now_iso = datetime.now().isoformat(timespec="seconds")
        init_content = (
            f"---\n"
            f'title: "{safe_title}"\n'
            f"repo: {repo}\n"
            f"created_at: {now_iso}\n"
            f"tags: [plan, rfc]\n"
            f"---\n\n"
            f"# {title}\n\n"
            f"## 1. Architectural Context & Objective\n\n"
            f"## 2. File-Level Execution Plan\n"
        )
        ctx.vfs.save(plan_uri, init_content)
        existing = init_content
    return {"plan_uri": plan_uri, "existing_content": existing}


class ResolveTestCommandPayload(TypedDict, total=False):
    repo: Optional[str]
    target: Optional[str]
@agent_bp.route('resolve_test_command', methods=['GET', 'POST'], request_schema=ResolveTestCommandPayload, docstring="[sync] Inspects workspace repository configuration files to determine the appropriate test runner command.")
def api_resolve_test_command(ctx):
    data = ctx.payload or {}
    repos = [r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")]
    repo = str(data.get("repo") or (repos[0] if repos else "")).strip()
    target = str(data.get("target") or "").strip()
    if not repo or repo not in repos:
        return {"repo": repo, "command": f"pytest {target}".strip() or "pytest -q", "runner": "pytest"}

    if ctx.vfs.read(f"vfs://{repo}/pyproject.toml") or ctx.resolve_path(f"vfs://{repo}/tests", must_exist=True, allow_heal=False):
        return {"repo": repo, "command": f"pytest {target}".strip() if target else "pytest -q", "runner": "pytest"}
    if ctx.vfs.read(f"vfs://{repo}/package.json"):
        return {"repo": repo, "command": "npm test", "runner": "npm"}
    if ctx.vfs.read(f"vfs://{repo}/Cargo.toml"):
        return {"repo": repo, "command": "cargo test", "runner": "cargo"}
    if ctx.vfs.read(f"vfs://{repo}/go.mod"):
        return {"repo": repo, "command": "go test ./...", "runner": "go"}
    return {"repo": repo, "command": f"pytest {target}".strip() or "pytest -q", "runner": "pytest"}
class AgentRunTestPayload(TypedDict, total=False):
    repo: Optional[str]
    command: Optional[str]
    target: Optional[str]
    timeout: Optional[int]


@agent_bp.route('run_test', methods=['POST'], request_schema=AgentRunTestPayload, docstring="[sync] Executes an approved repository test command via the unified bridge test runner and slices failures for triage.")
def api_agent_run_test(ctx):
    data = ctx.payload or {}
    repos = [r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")]
    repo = str(data.get("repo") or (repos[0] if repos else "")).strip()
    target_str = str(data.get("target") or "").strip()
    target_files = [target_str] if target_str else None
    diag_res = run_repo_test_diagnostics(
        ctx,
        repo=repo,
        command_override=data.get("command"),
        target_files=target_files,
        timeout=max(1, min(int(data.get("timeout") or 120), 120)),
    )
    if diag_res.get("status") == "needs_approval":
        return diag_res, 403
    norm_status = "passed" if diag_res.get("exit_code") == 0 else "failed"
    return {
        **diag_res,
        "status": norm_status,
    }
@agent_bp.route('sessions', methods=['GET'], docstring="[sync] Retrieves all chat sessions for the active workspace.")
def get_sessions(ctx):
    rows = ctx.db.get_all("chat_sessions", order_by="updated_at DESC")
    return {"sessions": rows}

@agent_bp.route('sessions', methods=['POST'], request_schema=ChatSessionPayload, docstring="[sync] Creates a new chat session.")
def create_session(ctx):
    data = ctx.payload or {}
    session_id = f"ses_{uuid.uuid4().hex[:12]}"
    title = data.get("title", "New Conversation")

    ctx.db.insert_or_replace("chat_sessions", {
        "session_id": session_id,
        "title": title,
        "updated_at": time.time()
    })
    return {"status": "success", "session_id": session_id}

@agent_bp.route('messages/<session_id>', methods=['GET'], docstring="[sync] Retrieves message history, working-set state, token ledger, and plan contracts for a specific chat session.")
def get_messages(ctx, session_id):
    cursor = ctx.db.execute("SELECT * FROM chat_messages WHERE session_id=? ORDER BY timestamp ASC", (session_id,))
    messages = [dict(r) for r in cursor.fetchall()]
    s_row = ctx.db.execute("SELECT * FROM chat_sessions WHERE session_id=?", (session_id,)).fetchone()

    working_set = []
    token_ledger = {"prompt_tokens": 0, "completion_tokens": 0, "saved_by_slicing": 0}
    checkpoint = None
    plan_path = ""
    summary = ""

    if s_row:
        try:
            working_set = json.loads(s_row["working_set_json"] or "[]")
        except Exception:
            working_set = []
        try:
            token_ledger = json.loads(s_row["token_ledger_json"] or "{}")
        except Exception:
            token_ledger = {"prompt_tokens": 0, "completion_tokens": 0, "saved_by_slicing": 0}
        try:
            checkpoint = json.loads(s_row["checkpoint_json"] or "null")
        except Exception:
            checkpoint = None
        plan_path = s_row["active_plan_path"] or ""
        summary = s_row["summary"] or ""

    # Tier 0 Constitution Files: Auto-pin engineering standards resolved via repository landmarks
    constitution = discover_constitution_files(ctx)

    return {
        "messages": messages,
        "working_set": working_set,
        "token_ledger": token_ledger,
        "checkpoint": checkpoint,
        "active_plan_path": plan_path,
        "summary": summary,
        "constitution_files": constitution,
    }
@agent_bp.route('cancel', methods=['POST'], request_schema=AgentSessionActionPayload, docstring="[sync] Signals an active agent turn to abort before the next LLM call or VFS mutation.")
def cancel_agent_turn(ctx):
    data = ctx.payload or {}
    session_id = str(data.get("session_id") or "").strip()
    if not session_id:
        return {"error": "session_id is required"}, 400
    with _CANCEL_LOCK:
        _CANCELLED_SESSIONS.add((ctx.workspace_id, session_id))
    row = ctx.db.get_by_id("chat_sessions", session_id, id_col="session_id")
    if row and row.get("active_job_id"):
        from insetu.core.sdk import get_connection as _get_conn
        w_conn = _get_conn("workers", workspace_id=ctx.workspace_id)
        w_conn.execute(
            "UPDATE immediate_jobs SET status='failed', status_message='Cancelled by user.' WHERE id=?",
            (row["active_job_id"],),
        )
        w_conn.commit()
    return {"status": "cancelled", "session_id": session_id}


@agent_bp.route('undo', methods=['POST'], request_schema=AgentSessionActionPayload, docstring="[sync] Reverts the most recent Yomama Bridge transaction for this chat session.")
def undo_last_agent_turn(ctx):
    data = ctx.payload or {}
    session_id = str(data.get("session_id") or "").strip()
    tx_id = str(data.get("transaction_id") or "").strip()
    if not tx_id and session_id:
        row = ctx.db.get_by_id("chat_sessions", session_id, id_col="session_id")
        if row:
            tx_id = row.get("last_transaction_id") or ""
    if not tx_id:
        return {"error": "No recorded transaction found to undo for this session."}, 404
    tx_list = [t.strip() for t in tx_id.split(",") if t.strip()]
    rev_res = {}
    for single_tx in reversed(tx_list):
        rev_res = ctx.call("bridge.revert", transaction_id=single_tx, target_state="initial", wait=True)
    if session_id:
        now = time.time()
        ctx.db.insert_or_replace("chat_messages", {
            "message_id": f"msg_{uuid.uuid4().hex[:12]}",
            "session_id": session_id,
            "role": "assistant",
            "content": f"⏪ Reverted transaction `{tx_id}`: {rev_res.get('message', 'Files restored.')}",
            "timestamp": now,
        })
        ctx.db.execute("UPDATE chat_sessions SET last_transaction_id=NULL, updated_at=? WHERE session_id=?", (now, session_id))
        ctx.db.commit()
    return {"status": "success", "transaction_id": tx_id, "revert": rev_res}


@agent_bp.route('prompt', methods=['POST'], request_schema=ChatPromptPayload, docstring="Dispatches a new user prompt into the background declarative agent worker chain.")
def submit_prompt(ctx):
    data = ctx.payload or {}
    session_id = data.get("session_id")
    raw_prompt = str(data.get("prompt") or "").strip()
    explicit_mode = str(data.get("mode") or "").strip().lower().lstrip("/")
    if explicit_mode == "undo" or raw_prompt.lower() == "/undo":
        return ctx.call("agent.undo", session_id=session_id, transaction_id=data.get("transaction_id"))
    attached_files = data.get("attached_files", [])
    read_only_files = data.get("read_only_files", [])
    routine_id = str(data.get("routine_id") or "workspace_turn").strip()
    if not raw_prompt and routine_id and routine_id != "workspace_turn":
        raw_prompt = f"/{routine_id}"
    if not session_id or not raw_prompt:
        return {"error": "session_id and prompt are required"}, 400
    parsed_colon = _parse_colon_command_tokens(raw_prompt)
    if parsed_colon["target"] and parsed_colon["target"] not in ("auto", "code", "plan", "ask", "yomama", "undo"):
        cand_target = parsed_colon["target"]
        for r_summary in list_available_routines(ctx):
            r_slash = str(r_summary.get("slash_command") or "").lstrip("/").lower()
            if cand_target in (r_summary.get("id", "").lower(), r_slash):
                routine_id = r_summary["id"]
                break
    try:
        routine_def = load_routine_definition(ctx, routine_id)
    except Exception:
        routine_def = None
    resolved_mode, clean_prompt = _parse_slash_command(raw_prompt, data.get("mode"), routine=routine_def)
    if resolved_mode == "undo":
        return ctx.call("agent.undo", session_id=session_id, transaction_id=data.get("transaction_id"))

    with _CANCEL_LOCK:
        _CANCELLED_SESSIONS.discard((ctx.workspace_id, session_id))

    now = time.time()
    is_handoff_resume = isinstance(data.get("handoff_responses"), dict) and len(data["handoff_responses"]) > 0
    user_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    if not is_handoff_resume:
        ctx.db.insert_or_replace("chat_messages", {
            "message_id": user_msg_id,
            "session_id": session_id,
            "role": "user",
            "content": raw_prompt,
            "timestamp": now,
        })
    extra_turn_inputs: Dict[str, Any] = {}
    if parsed_colon["scope"]:
        extra_turn_inputs["scope"] = parsed_colon["scope"]
        extra_turn_inputs["target"] = parsed_colon["scope"]
    if parsed_colon["stage"]:
        extra_turn_inputs["stage"] = parsed_colon["stage"]
    if data.get("scope"):
        extra_turn_inputs["scope"] = str(data["scope"])
    if data.get("stage"):
        extra_turn_inputs["stage"] = str(data["stage"])
    if data.get("profile_id"):
        extra_turn_inputs["profile_id"] = str(data["profile_id"]).strip()
    if data.get("transport"):
        extra_turn_inputs["transport"] = data["transport"]
    if isinstance(data.get("handoff_responses"), dict):
        extra_turn_inputs["handoff_responses"] = data["handoff_responses"]
    if isinstance(data.get("prior_chain_context"), dict):
        extra_turn_inputs["prior_chain_context"] = data["prior_chain_context"]

    job_id = ctx.jobs.submit(
        "agent_turn_task",
        job_category="ui_blocking",
        session_id=session_id,
        user_prompt=clean_prompt,
        mode=resolved_mode,
        attached_files=attached_files,
        read_only_files=read_only_files,
        routine_id=routine_id,
        extra_inputs=extra_turn_inputs,
        retry_count=0,
    )
    ctx.db.execute(
        "UPDATE chat_sessions SET updated_at=?, active_job_id=? WHERE session_id=?",
        (now, job_id, session_id),
    )
    ctx.db.commit()

    return {"status": "accepted", "job_id": job_id, "message_id": user_msg_id, "mode": resolved_mode}, 202
def _compact_session_history(
    ctx,
    session_id: str,
    rows: List[Dict[str, Any]],
    existing_summary: str = "",
) -> Tuple[List[Dict[str, str]], str]:
    """
    Two-Stage Rolling History Compaction (Section 3.2):
    - Tier 1 (Hot Verbatim Window): Last 2 user/assistant turns (4 messages) injected verbatim (prose-only `content`, never `raw_content`).
    - Tier 2 (Warm Micro-Receipts): Turns N-2 through N-5 condensed into 1-2 line receipts.
    - Tier 3 (Cold Session Summary): Turns older than N-5 folded into <session_summary>.
    """
    if not rows:
        return [], existing_summary

    clean_msgs = [{"role": r["role"], "content": (r["content"] or "").strip()} for r in rows if (r["content"] or "").strip()]
    total_len = len(clean_msgs)
    if total_len <= 4:
        return clean_msgs, existing_summary

    hot_verbatim = clean_msgs[-4:]
    warm_slice = clean_msgs[max(0, total_len - 12):-4]
    cold_slice = clean_msgs[:max(0, total_len - 12)]

    updated_summary = existing_summary
    if cold_slice:
        compaction_mode = str(ctx.settings.get("compaction_strategy", "deterministic") or "deterministic")
        cold_lines = [f"[{m['role']}]: {m['content'][:160].replace(chr(10), ' ')}" for m in cold_slice]
        cold_digest = "\n".join(cold_lines)
        if compaction_mode == "llm_compactor":
            try:
                sum_res = ctx.call(
                    "llm.complete",
                    messages=[{"role": "user", "content": f"Condense these prior turns into a concise architectural summary:\n{existing_summary}\n\n{cold_digest}"}],
                    tier="fast",
                    wait=True,
                )
                if isinstance(sum_res, dict) and sum_res.get("text"):
                    updated_summary = sum_res["text"].strip()
            except Exception:
                updated_summary = (f"{existing_summary}\n{cold_digest}").strip()[-4000:]
        else:
            updated_summary = (f"{existing_summary}\n{cold_digest}").strip()[-4000:]

    warm_receipts = [
        f"[Turn Receipt ({m['role']})]: {m['content'].splitlines()[0][:180]}"
        for m in warm_slice
    ]

    compacted_history: List[Dict[str, str]] = []
    prefix_parts = []
    if updated_summary:
        prefix_parts.append(f"<session_summary>\n{updated_summary}\n</session_summary>")
    if warm_receipts:
        prefix_parts.append("Recent Turn Micro-Receipts:\n" + "\n".join(warm_receipts))
    if prefix_parts:
        compacted_history.append({"role": "user", "content": "\n\n".join(prefix_parts)})
        compacted_history.append({"role": "assistant", "content": "Acknowledged session summary and recent turn receipts."})

    compacted_history.extend(hot_verbatim)
    return compacted_history, updated_summary


@agent_bp.worker("agent_turn_task")
def _execute_agent_turn(
    ctx,
    job_id: Optional[str] = None,
    session_id: Optional[str] = None,
    user_prompt: str = "",
    mode: str = "auto",
    attached_files: Optional[List[str]] = None,
    read_only_files: Optional[List[str]] = None,
    routine_id: str = "workspace_turn",
    extra_inputs: Optional[Dict[str, Any]] = None,
    retry_count: int = 0,
):
    s_row = ctx.db.execute("SELECT summary, working_set_json, token_ledger_json FROM chat_sessions WHERE session_id=?", (session_id,)).fetchone()
    existing_summary = (s_row["summary"] if s_row and s_row["summary"] else "") or ""

    cursor = ctx.db.execute(
        "SELECT role, content, raw_content FROM chat_messages WHERE session_id=? ORDER BY timestamp ASC",
        (session_id,),
    )
    raw_rows = [dict(r) for r in cursor.fetchall()]
    history_messages, updated_summary = _compact_session_history(ctx, session_id or "default", raw_rows, existing_summary)
    if not history_messages and user_prompt:
        history_messages = [{"role": "user", "content": user_prompt}]

    def _is_cancelled() -> bool:
        with _CANCEL_LOCK:
            return (ctx.workspace_id, session_id) in _CANCELLED_SESSIONS

    routine_result = execute_declarative_routine(
        ctx,
        session_id=session_id or "default",
        user_prompt=user_prompt,
        mode=mode,
        attached_files=attached_files or [],
        read_only_files=read_only_files or [],
        history_messages=history_messages,
        routine_id=routine_id,
        inputs=extra_inputs,
        is_cancelled_fn=_is_cancelled,
    )
    if routine_result.get("status") == "paused_for_user":
        now = time.time()
        ctx.db.execute(
            "UPDATE chat_sessions SET active_job_id=NULL, updated_at=? WHERE session_id=?",
            (now, session_id),
        )
        ctx.db.commit()
        return {
            "message": "Routine paused for Web-Chat handoff.",
            "artifact": {
                "session_id": session_id,
                "routine_id": routine_result.get("routine_id", routine_id),
                "status": "paused_for_user",
                "pending_handoff": routine_result.get("pending_handoff"),
                "wavefronts": routine_result.get("wavefronts", []),
                "chain_context": routine_result.get("chain_context", {}),
            },
        }

    # P1 Execution Budget Checkpoint
    if routine_result.get("status") == "paused_for_budget":
        now = time.time()
        checkpoint = routine_result.get("checkpoint") or {}
        ctx.db.execute(
            "UPDATE chat_sessions SET active_job_id=NULL, checkpoint_json=?, updated_at=? WHERE session_id=?",
            (json.dumps(checkpoint), now, session_id),
        )
        ctx.db.commit()
        return {
            "message": routine_result.get("message", "Paused for execution budget checkpoint."),
            "artifact": {
                "session_id": session_id,
                "routine_id": routine_result.get("routine_id", routine_id),
                "status": "paused_for_budget",
                "checkpoint": checkpoint,
                "wavefront_index": routine_result.get("wavefront_index", 0),
            },
        }
    full_response = routine_result.get("response") or ""
    raw_full_response = routine_result.get("raw_response") or full_response
    all_tx_ids = routine_result.get("transaction_ids") or ([routine_result["transaction_id"]] if routine_result.get("transaction_id") else [])
    tx_id = ",".join(all_tx_ids) if all_tx_ids else None
    asst_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    now = time.time()
    cursor = ctx.db.execute("SELECT count(*) as cnt FROM chat_messages WHERE session_id=?", (session_id,))
    msg_count = cursor.fetchone()["cnt"] or 0

    ctx.db.insert_or_replace("chat_messages", {
        "message_id": asst_msg_id,
        "session_id": session_id,
        "role": "assistant",
        "content": full_response,
        "raw_content": raw_full_response,
        "timestamp": now,
        "turn_index": msg_count + 1,
    })

    # End-of-Turn Working Set Maintenance (Pillar 1: 5-Turn TTL Decay & Eviction)
    working_set_row = ctx.db.execute("SELECT working_set_json FROM chat_sessions WHERE session_id=?", (session_id,)).fetchone()
    working_set: List[Dict[str, Any]] = []
    if working_set_row and working_set_row["working_set_json"]:
        try:
            working_set = json.loads(working_set_row["working_set_json"])
        except Exception:
            working_set = []

    ws_map: Dict[str, Dict[str, Any]] = {}
    for ws_entry in working_set:
        if not isinstance(ws_entry, dict):
            continue
        raw_fp = ws_entry.get("filepath") or ws_entry.get("uri") or ""
        if not raw_fp:
            continue
        norm_fp = str(InSetuURI(raw_fp))
        ws_map[norm_fp] = {
            "filepath": norm_fp,
            "tier": ws_entry.get("tier") or "pinned",
            "idle_turns": int(ws_entry.get("idle_turns") or 0),
            "user_pinned": bool(ws_entry.get("user_pinned", False)),
        }

    # Age inactive items (user_pinned files are exempt from auto-decay per Section 3.1)
    for ws_entry in ws_map.values():
        if not ws_entry.get("user_pinned"):
            ws_entry["idle_turns"] = ws_entry.get("idle_turns", 0) + 1
            if ws_entry["idle_turns"] >= 6 and ws_entry.get("tier") == "pinned":
                ws_entry["tier"] = "reference"

    # Persist explicitly attached user files as user_pinned
    for af in (attached_files or []):
        norm_af = str(InSetuURI(af))
        if norm_af not in ws_map:
            ws_map[norm_af] = {
                "filepath": norm_af,
                "tier": "pinned",
                "idle_turns": 0,
                "user_pinned": True,
            }

    # Promote newly committed files
    committed_list = list(routine_result.get("committed_files") or [])
    for cf in committed_list:
        norm_cf = str(InSetuURI(cf))
        was_user_pinned = bool(ws_map.get(norm_cf, {}).get("user_pinned", False))
        ws_map[norm_cf] = {
            "filepath": norm_cf,
            "tier": "pinned",
            "idle_turns": 0,
            "user_pinned": was_user_pinned,
        }

    # Reinforce Global Hebbian Affinity Graph (Section 4.1)
    try:
        if len(committed_list) >= 2:
            record_affinity_interaction(ctx, committed_list, interaction_type="commit", weight=3.0)
        if attached_files and len(attached_files) >= 2:
            record_affinity_interaction(ctx, attached_files, interaction_type="pin", weight=2.0)
    except Exception:
        pass

    # Update cumulative Session Token Ledger (Section 3.1)
    token_ledger = {"prompt_tokens": 0, "completion_tokens": 0, "saved_by_slicing": 0}
    if s_row and s_row["token_ledger_json"]:
        try:
            token_ledger.update(json.loads(s_row["token_ledger_json"]))
        except Exception:
            pass
    fetch_ctx_state = (routine_result.get("chain_context") or {}).get("fetch_context") or {}
    ctx_est_tok = int(fetch_ctx_state.get("total_tokens_estimated") or 0)
    turn_prompt_tok = max(1, (len(user_prompt or "") // 4) + ctx_est_tok)
    turn_comp_tok = max(1, len(raw_full_response or "") // 4)
    turn_saved_tok = int(fetch_ctx_state.get("saved_by_slicing_tokens") or 0)
    token_ledger["prompt_tokens"] = int(token_ledger.get("prompt_tokens", 0)) + turn_prompt_tok
    token_ledger["completion_tokens"] = int(token_ledger.get("completion_tokens", 0)) + turn_comp_tok
    token_ledger["saved_by_slicing"] = int(token_ledger.get("saved_by_slicing", 0)) + turn_saved_tok
    serialized_ledger = json.dumps(token_ledger)

    # Evict items past Turn 8
    surviving_ws = [
        ws_entry for ws_entry in ws_map.values()
        if ws_entry.get("user_pinned") or ws_entry.get("idle_turns", 0) < 9
    ]
    serialized_ws = json.dumps(surviving_ws)

    if tx_id:
        ctx.db.execute(
            "UPDATE chat_sessions SET last_transaction_id=?, active_job_id=NULL, updated_at=?, working_set_json=?, summary=?, token_ledger_json=? WHERE session_id=?",
            (tx_id, now, serialized_ws, updated_summary, serialized_ledger, session_id),
        )
    else:
        ctx.db.execute(
            "UPDATE chat_sessions SET active_job_id=NULL, updated_at=?, working_set_json=?, summary=?, token_ledger_json=? WHERE session_id=?",
            (now, serialized_ws, updated_summary, serialized_ledger, session_id),
        )
    ctx.db.commit()

    return {
        "message": "Turn complete.",
        "artifact": {
            "message_id": asst_msg_id,
            "response": full_response,
            "unapplied_patches": routine_result.get("unapplied_patches", ""),
            "mode": routine_result.get("mode", mode),
            "effective_intent": routine_result.get("effective_intent"),
            "transaction_id": routine_result.get("transaction_id"),
            "transaction_ids": all_tx_ids,
            "committed_files": routine_result.get("committed_files", []),
        },
    }