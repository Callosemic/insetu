from pathlib import Path
from datetime import datetime
import hashlib
import os
import re
import shlex
import time
import uuid
import json
import threading
from typing import TypedDict, List, Dict, Any, Optional, Union, Literal
from insetu.core.sdk import InSetuExtension, slugify
from insetu.core.utils_core import (
    InSetuURI,
    parse_blocks,
    generate_ascii_tree,
    get_available_contexts,
    get_repo_path,
    get_daemon_host_config_path,
    load_json_config,
    save_json_config,
)
from .orchestrator import (
    execute_declarative_routine,
    list_available_routines,
    load_routine_definition,
    resolve_routine_mode,
    parse_routine_content,
    serialize_routine_to_markdown,
    validate_routine_definition,
)

AGENT_SCHEMA = {
    "chat_sessions": {
        "session_id": "TEXT PRIMARY KEY",
        "title": "TEXT",
        "updated_at": "REAL",
        "last_transaction_id": "TEXT",
        "active_job_id": "TEXT"
    },
    "chat_messages": {
        "message_id": "TEXT PRIMARY KEY",
        "session_id": "TEXT",
        "role": "TEXT",
        "content": "TEXT",
        "raw_content": "TEXT",
        "timestamp": "REAL"
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
def _get_approved_test_commands(workspace_id: str) -> set:
    host_path = get_daemon_host_config_path()
    host_data = load_json_config(host_path, {})
    return set(host_data.get("approved_test_commands", {}).get(workspace_id, []))


def _approve_test_command(workspace_id: str, repo: str, command: str) -> str:
    sig = f"{repo}:{hashlib.sha256(command.strip().encode('utf-8')).hexdigest()[:16]}"
    host_path = get_daemon_host_config_path()
    host_data = load_json_config(host_path, {})
    approved = set(host_data.setdefault("approved_test_commands", {}).get(workspace_id, []))
    approved.add(sig)
    host_data["approved_test_commands"][workspace_id] = sorted(approved)
    save_json_config(host_path, host_data, workspace_id="default")
    return sig


class AgentRunTestPayload(TypedDict, total=False):
    repo: Optional[str]
    command: Optional[str]
    target: Optional[str]
    timeout: Optional[int]
    approve: Optional[bool]
@agent_bp.route('run_test', methods=['POST'], request_schema=AgentRunTestPayload, docstring="[sync] Executes an approved repository test command with shell=False and slices up to 35 failures for triage.")
def api_agent_run_test(ctx):
    data = ctx.payload or {}
    repos = [r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")]
    repo = str(data.get("repo") or (repos[0] if repos else "")).strip()
    default_cmd = ctx.call("agent.resolve_test_command", repo=repo, target=data.get("target") or "").get("command", "pytest -q")
    cmd = str(data.get("command") or "").strip() or default_cmd

    if data.get("approve"):
        _approve_test_command(ctx.workspace_id, repo, cmd)
    elif cmd != default_cmd:
        cmd_sig = f"{repo}:{hashlib.sha256(cmd.strip().encode('utf-8')).hexdigest()[:16]}"
        if cmd_sig not in _get_approved_test_commands(ctx.workspace_id):
            return {
                "status": "needs_approval",
                "error": f"Custom test command '{cmd}' requires approval before execution. Re-submit with approve=True.",
                "command": cmd,
                "repo": repo,
                "returncode": -1,
                "exit_code": -1,
                "failure_batch": [],
                "failure_count": 0,
            }, 403

    timeout = min(int(data.get("timeout") or 120), 120)
    cwd = get_repo_path(repo, ctx.workspace_id) if (repo and repo in repos) else ctx.paths["workspace_root"]
    cmd_args = shlex.split(cmd)
    try:
        res = ctx.exec.run(cmd_args, shell=False, cwd=cwd, timeout=timeout, check=False)
        stdout_str = (res.stdout or "")[-16000:]
        stderr_str = (res.stderr or "")[-16000:]
        combined = f"{stdout_str}\n{stderr_str}".strip()
        failure_lines = [
            line.strip()
            for line in combined.splitlines()
            if any(tok in line for tok in ("FAIL:", "ERROR:", "❌ [VIOLATION:", "FAILED ", "AssertionError:"))
        ][:35]
        return {
            "status": "passed" if res.returncode == 0 else "failed",
            "returncode": res.returncode,
            "exit_code": res.returncode,
            "command": cmd,
            "repo": repo,
            "stdout": stdout_str,
            "stderr": stderr_str,
            "combined_output": combined,
            "failure_batch": failure_lines,
            "failure_count": len(failure_lines),
        }
    except Exception as e:
        return {
            "status": "error",
            "returncode": -1,
            "exit_code": -1,
            "command": cmd,
            "repo": repo,
            "stdout": "",
            "stderr": str(e),
            "combined_output": str(e),
            "failure_batch": [],
            "failure_count": 0,
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

@agent_bp.route('messages/<session_id>', methods=['GET'], docstring="[sync] Retrieves message history for a specific chat session.")
def get_messages(ctx, session_id):
    cursor = ctx.db.execute("SELECT * FROM chat_messages WHERE session_id=? ORDER BY timestamp ASC", (session_id,))
    messages = [dict(r) for r in cursor.fetchall()]
    return {"messages": messages}
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
    cursor = ctx.db.execute(
        "SELECT role, content, raw_content FROM chat_messages WHERE session_id=? ORDER BY timestamp ASC",
        (session_id,),
    )
    history_messages = [
        {"role": r["role"], "content": (r["raw_content"] if r["raw_content"] else r["content"])}
        for r in cursor.fetchall()
    ]
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
    full_response = routine_result.get("response") or ""
    raw_full_response = routine_result.get("raw_response") or full_response
    all_tx_ids = routine_result.get("transaction_ids") or ([routine_result["transaction_id"]] if routine_result.get("transaction_id") else [])
    tx_id = ",".join(all_tx_ids) if all_tx_ids else None
    asst_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    now = time.time()
    ctx.db.insert_or_replace("chat_messages", {
        "message_id": asst_msg_id,
        "session_id": session_id,
        "role": "assistant",
        "content": full_response,
        "raw_content": raw_full_response,
        "timestamp": now,
    })
    if tx_id:
        ctx.db.execute(
            "UPDATE chat_sessions SET last_transaction_id=?, active_job_id=NULL, updated_at=? WHERE session_id=?",
            (tx_id, now, session_id),
        )
    else:
        ctx.db.execute(
            "UPDATE chat_sessions SET active_job_id=NULL, updated_at=? WHERE session_id=?",
            (now, session_id),
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