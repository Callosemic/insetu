"""Pure Zero-I/O 6-Bucket RoutineEnvelope, ContextArtifact value object, and Web-Chat delta algebra."""
import copy
from dataclasses import dataclass, field, fields
import hashlib
from typing import Any, Dict, List, Literal, Optional, Set, Tuple

from insetu.core.utils_core import InSetuURI
from insetu.core.agent.routine_loader import RESERVED_ROUTINE_NODE_IDS, is_prose_document_uri
from insetu.core.agent.schemas.plan import format_active_plan_meta_projection

BucketName = Literal["governance", "hierarchy", "meta", "data", "telemetry", "prompt"]
LensName = Literal["full", "diff", "slice", "outline", "genesis"]

BUCKET_VOLATILITY_ORDER: Tuple[BucketName, ...] = (
    "governance",
    "hierarchy",
    "meta",
    "data",
    "telemetry",
    "prompt",
)

RESERVED_ENVELOPE_KEYS: Set[str] = set(RESERVED_ROUTINE_NODE_IDS)


def _hash_projection(lens: str, content: str) -> str:
    """Computes a stable content-addressed signature for a projected (lens, content) pair."""
    digest = hashlib.sha256((content or "").encode("utf-8")).hexdigest()[:16]
    return f"{lens}:{digest}"


@dataclass
class ContextArtifact:
    """Represents a single URI-addressed artifact mounted in one of the 6 canonical context buckets."""
    uri: str
    bucket: BucketName = "data"
    lens: LensName = "full"
    served_lens: LensName = "full"
    source: str = "auto"
    idle_turns: int = 0
    tokens: int = 0
    sha256: str = ""
    symbols: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "uri": self.uri,
            "bucket": self.bucket,
            "lens": self.lens,
            "served_lens": self.served_lens,
            "source": self.source,
            "idle_turns": self.idle_turns,
            "tokens": self.tokens,
            "sha256": self.sha256,
            "symbols": list(self.symbols),
        }


@dataclass
class RoutineEnvelope:
    """
    Pure, zero-I/O state and working-set container for a declarative Routine or Agent turn.
    Maintains the 6 volatility-ordered buckets, node outputs, execution trace, active plan,
    and content-addressed Web-Chat sent-hash ledger for Same-Window delta packing.
    """
    # 1. Turn Identity & Routing
    session_id: str = "default"
    routine_id: str = "workspace_turn"
    user_prompt: str = ""
    mode: str = "auto"
    effective_intent: str = "EDIT_CODE"
    profile_id: str = "default"
    pinned_repos: List[str] = field(default_factory=list)
    context_nonce: str = ""
    has_raw_patches: bool = False
    has_code_targets: bool = False

    # 2. 6-Bucket Working Set & Scout Buffers
    artifacts: Dict[str, ContextArtifact] = field(default_factory=dict)
    file_token_map: Dict[str, int] = field(default_factory=dict)
    attached_docs_content: str = ""
    recalled_messages_text: str = ""
    scouted_global_files: List[str] = field(default_factory=list)
    scouted_candidate_files: List[str] = field(default_factory=list)
    scouted_tasks: List[Dict[str, Any]] = field(default_factory=list)

    # 3. Active Plan & Task Directives (Bucket 3: meta)
    active_plan: Optional[Dict[str, Any]] = None
    active_plan_prompt_block: str = ""
    staged_task_actions: List[Dict[str, Any]] = field(default_factory=list)

    # 4. Transport Delta State & Two-Level Budget Watermarks
    web_chat_window_mode: Literal["same_window", "new_window"] = "new_window"
    sent_hashes: Dict[str, str] = field(default_factory=dict)
    staged_sent_hashes: Dict[str, str] = field(default_factory=dict)
    web_chat_delta_meta: Dict[str, Any] = field(default_factory=dict)
    budget_limit_usd: float = 1.0
    budget_step_usd: float = 1.0
    session_cost_usd: float = 0.0
    model_context_length: int = 200000
    context_soft_ceiling: int = 150000
    outline_budget: int = 10000

    # 5. DAG Execution Registers
    sys: Dict[str, Any] = field(default_factory=dict)
    inputs: Dict[str, Any] = field(default_factory=dict)
    global_vars: Dict[str, Any] = field(default_factory=dict)
    nodes: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    loop: Dict[str, Any] = field(default_factory=dict)
    holding: Dict[str, Any] = field(default_factory=dict)
    execution_trace: List[Dict[str, Any]] = field(default_factory=list)

    def render_active_plan_block(self) -> str:
        """Returns `active_plan_prompt_block` if explicitly set, or derives it from `self.active_plan`."""
        if self.active_plan_prompt_block:
            return str(self.active_plan_prompt_block)
        if isinstance(self.active_plan, dict) and self.active_plan.get("tasks"):
            return format_active_plan_meta_projection(self.active_plan)
        return ""

    def is_repo_allowed(self, uri: str) -> bool:
        """Returns True if `uri` belongs to an allowed/pinned repository (or is a workspace `ctx://` URI)."""
        if not uri or not self.pinned_repos or "ALL" in self.pinned_repos:
            return True
        parsed = InSetuURI(uri)
        if parsed.scheme != "vfs" or not parsed.repo:
            return True
        return parsed.repo in self.pinned_repos

    def refresh_constitution(self, all_constitution_uris: List[str], primary_repo_name: str = "") -> List[str]:
        """Scopes Tier 0 governance constitution files to the repositories active in the working set (clamped to pinned_repos)."""
        allowed_const = [cf for cf in (all_constitution_uris or []) if self.is_repo_allowed(cf)]
        non_const_uris = [
            u for u, art in self.artifacts.items()
            if art.bucket in ("data", "meta") and InSetuURI(u).scheme == "vfs" and InSetuURI(u).repo
        ]
        code_repos = {
            InSetuURI(u).repo for u in non_const_uris if not is_prose_document_uri(u)
        }
        touched_repos = code_repos or {InSetuURI(u).repo for u in non_const_uris}
        if not touched_repos and primary_repo_name and primary_repo_name != "workspace":
            if not self.pinned_repos or "ALL" in self.pinned_repos or primary_repo_name in self.pinned_repos:
                touched_repos = {primary_repo_name}
        scoped = [cf for cf in allowed_const if InSetuURI(cf).repo in touched_repos] if touched_repos else allowed_const[:2]
        for u in [k for k, a in self.artifacts.items() if a.bucket == "governance" and k not in scoped]:
            del self.artifacts[u]
        for cf in scoped:
            self.artifacts[cf] = ContextArtifact(uri=cf, bucket="governance", lens="full", served_lens="full", source="constitution")
        return scoped

    def set_node(self, node_id: str, val: Dict[str, Any]) -> Dict[str, Any]:
        """Stores `val` for `node_id` in `self.nodes` and returns `val`."""
        self.nodes[node_id] = val
        return val

    def get_node(self, node_id: str, default: Any = None) -> Any:
        """Returns the state dict for `node_id` from `self.nodes`."""
        return self.nodes.get(node_id, default)

    def global_view(self) -> Dict[str, Any]:
        """Computes the authoritative `global.*` scope projection directly from `RoutineEnvelope` fields."""
        cur_all = self.all_context_files
        cur_edit = self.editable_files
        cur_ro = self.readonly_files
        out: Dict[str, Any] = {
            **self.inputs,
            **self.global_vars,
            "session_id": self.session_id,
            "user_prompt": self.user_prompt,
            "user_message": self.user_prompt,
            "mode": self.mode,
            "effective_intent": self.effective_intent,
            "has_raw_patches": self.has_raw_patches,
            "has_attached_files": bool(cur_all),
            "has_code_targets": self.has_code_targets or any(not is_prose_document_uri(f) for f in cur_edit),
            "attached_docs_content": self.attached_docs_content,
            "attached_files": cur_edit,
            "selected_files": cur_edit,
            "read_only_files": cur_ro,
            "constitution_files": self.constitution_files,
            "all_context_files": cur_all,
            "context_nonce": self.context_nonce,
            "_context_nonce": self.context_nonce,
            "web_chat_sent_hashes": dict(self.sent_hashes),
            "web_chat_staged_hashes": dict(self.staged_sent_hashes),
            "web_chat_window_mode": self.web_chat_window_mode,
            "web_chat_delta_meta": dict(self.web_chat_delta_meta),
            "budget_limit_usd": self.budget_limit_usd,
            "budget_step_usd": self.budget_step_usd,
            "session_cost_usd": round(self.session_cost_usd, 6),
            "model_context_length": self.model_context_length,
            "context_soft_ceiling": self.context_soft_ceiling,
            "execution_trace": list(self.execution_trace),
            "file_token_map": dict(self.file_token_map),
            "active_plan": self.active_plan,
            "active_plan_prompt_block": self.render_active_plan_block(),
            "staged_task_actions": list(self.staged_task_actions),
            "scouted_global_files": list(self.scouted_global_files),
        }
        return out

    def to_scope_dict(self, ctx=None) -> Dict[str, Any]:
        """Returns the read-only Mustache and condition evaluation scope projected from `RoutineEnvelope`."""
        scope: Dict[str, Any] = {
            **self.nodes,
            "nodes": self.nodes,
            "sys": self.sys,
            "global": self.global_view(),
            "inputs": {
                **self.inputs,
                "user_prompt": self.user_prompt,
                "user_message": self.user_prompt,
            },
            "loop": self.loop,
        }
        if ctx is not None:
            scope["_ctx"] = ctx
        return scope

    def apply_working_set_delta(
        self,
        *,
        add: Optional[List[str]] = None,
        slice_uris: Optional[List[str]] = None,
        slice_symbols_map: Optional[Dict[str, List[str]]] = None,
        outline_uris: Optional[List[str]] = None,
        drop: Optional[List[str]] = None,
        source: str = "auto",
        bucket: BucketName = "data",
    ) -> Tuple[List[str], List[str]]:
        """
        Applies a structured working-set mutation (+add, ~slice, ~outline, -drop).
        User-pinned artifacts (source='user_pinned') are protected against automated scout drops.
        Returns (added_or_promoted_uris, dropped_uris).
        """
        added_out: List[str] = []
        dropped_out: List[str] = []

        for d_uri in (drop or []):
            if not d_uri or d_uri not in self.artifacts:
                continue
            existing = self.artifacts[d_uri]
            if existing.source == "user_pinned" and source in ("scout_hop1", "scout_hop2"):
                continue
            del self.artifacts[d_uri]
            dropped_out.append(d_uri)

        def _upsert(uris: Optional[List[str]], target_lens: LensName, target_bucket: BucketName) -> None:
            for u in (uris or []):
                if not u or not self.is_repo_allowed(u):
                    continue
                effective_bucket: BucketName = (
                    "meta" if (target_bucket == "data" and target_lens == "full" and is_prose_document_uri(u)) else target_bucket
                )
                req_syms = list((slice_symbols_map or {}).get(u) or [])
                cur = self.artifacts.get(u)
                if cur is None:
                    self.artifacts[u] = ContextArtifact(
                        uri=u,
                        bucket=effective_bucket,
                        lens=target_lens,
                        source=source,
                        symbols=req_syms,
                    )
                    added_out.append(u)
                else:
                    lens_rank = {"outline": 1, "slice": 2, "diff": 3, "genesis": 3, "full": 4}
                    if lens_rank.get(target_lens, 1) >= lens_rank.get(cur.lens, 1) or source in ("user_pinned", "probe"):
                        cur.lens = target_lens
                        cur.bucket = effective_bucket
                    if req_syms:
                        cur.symbols = list(dict.fromkeys(cur.symbols + req_syms))
                    if source == "user_pinned":
                        cur.source = "user_pinned"

        _upsert(outline_uris, "outline", "hierarchy")
        _upsert(slice_uris, "slice", bucket)
        _upsert(add, "full", bucket)
        return added_out, dropped_out

    def snapshot_wavefront_uris(self) -> Set[str]:
        """Captures the set of active artifact URIs prior to executing a parallel wavefront."""
        return set(self.artifacts.keys())

    def settle_wavefront_uris(self, pre_wavefront_uris: Set[str], promoted_uris: Optional[Set[str]] = None) -> List[str]:
        """Evicts branch-local artifacts added during a multi-node wavefront that were not promoted downstream."""
        keep = set(pre_wavefront_uris or set()) | set(promoted_uris or set())
        evicted: List[str] = []
        for uri, art in list(self.artifacts.items()):
            if uri not in keep and art.source == "wavefront_branch":
                del self.artifacts[uri]
                evicted.append(uri)
        return evicted

    def to_checkpoint(self, status: str, wavefront_index: int = 0, pending_handoff: Any = None, wavefronts: Any = None, reason: str = "") -> Dict[str, Any]:
        """Serializes every dataclass field on RoutineEnvelope plus checkpoint metadata into a server-authoritative dictionary."""
        out: Dict[str, Any] = {
            "status": status,
            "wavefront_index": wavefront_index,
            "wavefronts": wavefronts or [],
            "pending_handoff": pending_handoff,
            "reason": reason,
        }
        for f in fields(self):
            val = getattr(self, f.name)
            if f.name == "artifacts":
                out["artifacts"] = {u: a.to_dict() for u, a in (val or {}).items()}
            else:
                out[f.name] = copy.deepcopy(val)
        return out

    @classmethod
    def from_checkpoint(cls, data: Dict[str, Any]) -> "RoutineEnvelope":
        """Reconstructs a RoutineEnvelope by reflecting over `dataclasses.fields(cls)`."""
        if not isinstance(data, dict):
            return cls()
        kwargs: Dict[str, Any] = {}
        for f in fields(cls):
            if f.name == "artifacts":
                raw_arts = data.get("artifacts") or {}
                arts: Dict[str, ContextArtifact] = {}
                if isinstance(raw_arts, dict):
                    for u, spec in raw_arts.items():
                        if isinstance(spec, dict) and spec.get("uri"):
                            arts[u] = ContextArtifact(
                                uri=spec["uri"],
                                bucket=spec.get("bucket", "data"),
                                lens=spec.get("lens", "full"),
                                served_lens=spec.get("served_lens", spec.get("lens", "full")),
                                source=spec.get("source", "auto"),
                                idle_turns=int(spec.get("idle_turns") or 0),
                                tokens=int(spec.get("tokens") or 0),
                                sha256=str(spec.get("sha256") or ""),
                                symbols=list(spec.get("symbols") or []),
                            )
                kwargs["artifacts"] = arts
                continue
            raw_val = data.get(f.name)
            if raw_val is not None:
                kwargs[f.name] = copy.deepcopy(raw_val)
        return cls(**kwargs)

    @property
    def editable_files(self) -> List[str]:
        """Read-only computed list of full/diff-lens data and meta target URIs."""
        return self.editable_uris()

    @property
    def readonly_files(self) -> List[str]:
        """Read-only computed list of slice-lens reference URIs."""
        return self.reference_uris()

    @property
    def constitution_files(self) -> List[str]:
        """Read-only computed list of Tier 0 governance constitution URIs."""
        return self.constitution_uris()

    @property
    def all_context_files(self) -> List[str]:
        """Read-only computed list of all mounted vfs:// and ctx:// URIs in bucket volatility order."""
        return self.all_file_uris()

    def fork_sub_routine(self, target_routine_id: str) -> "RoutineEnvelope":
        """Creates a child RoutineEnvelope for sub-routine delegation by cloning all dataclass fields via `to_checkpoint`/`from_checkpoint`."""
        cloned = self.to_checkpoint("running")
        cloned["routine_id"] = target_routine_id
        return RoutineEnvelope.from_checkpoint(cloned)

    def merge_sub_routine_result(
        self,
        child_env: "RoutineEnvelope",
    ) -> None:
        """Merges working-set artifacts, active_plan, staged_task_actions, file_token_map, hashes, and execution_trace from a completed child RoutineEnvelope into this parent envelope."""
        self.artifacts = {k: ContextArtifact(**v.to_dict()) for k, v in child_env.artifacts.items()}
        if child_env.effective_intent and child_env.effective_intent != "EDIT_CODE":
            self.effective_intent = child_env.effective_intent
        if child_env.global_vars:
            self.global_vars.update(child_env.global_vars)
        self.sent_hashes.update(child_env.sent_hashes)
        self.staged_sent_hashes.update(child_env.staged_sent_hashes)
        if child_env.web_chat_delta_meta:
            self.web_chat_delta_meta = dict(child_env.web_chat_delta_meta)
        self.session_cost_usd = max(self.session_cost_usd, child_env.session_cost_usd)
        self.budget_limit_usd = max(self.budget_limit_usd, child_env.budget_limit_usd)
        if isinstance(child_env.active_plan, dict) and child_env.active_plan.get("tasks"):
            self.active_plan = copy.deepcopy(child_env.active_plan)
            self.active_plan_prompt_block = child_env.active_plan_prompt_block
        if child_env.scouted_global_files:
            self.scouted_global_files = list(dict.fromkeys(self.scouted_global_files + child_env.scouted_global_files))
        if child_env.staged_task_actions:
            self.staged_task_actions = list(child_env.staged_task_actions)
        if child_env.file_token_map:
            self.file_token_map.update(child_env.file_token_map)
        if child_env.attached_docs_content:
            self.attached_docs_content = child_env.attached_docs_content
        if "fetch_context" in child_env.nodes:
            self.nodes["fetch_context"] = copy.deepcopy(child_env.nodes["fetch_context"])
        existing_ids = {t.get("id") for t in self.execution_trace if isinstance(t, dict)}
        for tr_item in child_env.execution_trace:
            if isinstance(tr_item, dict) and tr_item.get("id") not in existing_ids:
                self.execution_trace.append(copy.deepcopy(tr_item))

    def editable_uris(self) -> List[str]:
        """Returns all full/diff/genesis-lens data/meta target URIs (excluding constitution files)."""
        return [
            a.uri for a in self.artifacts.values()
            if a.bucket in ("data", "meta") and a.lens in ("full", "diff", "genesis")
        ]

    def reference_uris(self) -> List[str]:
        """Returns all slice-lens reference URIs."""
        return [
            a.uri for a in self.artifacts.values()
            if a.bucket == "data" and a.lens == "slice"
        ]

    def constitution_uris(self) -> List[str]:
        """Returns all Tier 0 governance constitution URIs."""
        return [
            a.uri for a in self.artifacts.values()
            if a.bucket == "governance"
        ]

    def all_file_uris(self) -> List[str]:
        """Returns all vfs:// and ctx:// URIs in volatility bucket order."""
        ordered: List[str] = []
        for b_name in BUCKET_VOLATILITY_ORDER:
            for art in self.artifacts.values():
                if art.bucket == b_name and art.uri.startswith(("vfs://", "ctx://")) and art.uri not in ordered:
                    ordered.append(art.uri)
        return ordered

    def partition_full_vs_delta_blocks(
        self,
        rendered_blocks: List[Tuple[str, str, str]],
    ) -> Tuple[str, str, Dict[str, str], Dict[str, Any]]:
        """
        Given a list of `(artifact_uri, lens, block_text)` tuples in bucket volatility order,
        computes:
        1. `full_text`: Complete context payload (for 'new_window' mode and API calls).
        2. `delta_text`: Incremental context payload containing only artifacts that were added,
           promoted in lens, or modified on disk since the last paste into the same external chat window.
        3. `next_hashes`: Updated `{uri: "lens:sha256"}` dictionary.
        4. `delta_meta`: `{changed_uris, unchanged_uris, full_tokens, delta_tokens}`.
        """
        full_parts: List[str] = []
        delta_parts: List[str] = []
        unchanged_uris: List[str] = []
        changed_uris: List[str] = []
        baseline_hashes = {} if self.web_chat_window_mode == "new_window" else self.sent_hashes
        next_hashes: Dict[str, str] = dict(baseline_hashes)

        for uri, lens, text_block in rendered_blocks:
            if not text_block:
                continue
            full_parts.append(text_block)
            sig = _hash_projection(lens, text_block)
            prev_sig = baseline_hashes.get(uri)
            next_hashes[uri] = sig
            if prev_sig == sig:
                unchanged_uris.append(uri)
            else:
                changed_uris.append(uri)
                delta_parts.append(text_block)

        self.staged_sent_hashes = next_hashes

        full_text = "\n\n".join(full_parts)
        if unchanged_uris:
            reuse_header = (
                "============================================================\n"
                "SAME-WINDOW DELTA CONTEXT PAYLOAD (Incremental Update)\n"
                "============================================================\n"
                "ALREADY IN YOUR CHAT WINDOW (Unchanged since previous turn/hop — reuse from earlier in this thread):\n"
                + "\n".join(f"  • {u}" for u in unchanged_uris)
                + "\n"
            )
            if delta_parts:
                delta_text = reuse_header + "\nNEW OR UPDATED CONTEXT ARTIFACTS:\n\n" + "\n\n".join(delta_parts)
            else:
                delta_text = (
                    reuse_header
                    + "\n[All context artifacts in the working set are unchanged from earlier in this chat window. "
                    "You only need to paste the new Prompt + Directives!]\n"
                )
        else:
            delta_text = full_text

        delta_meta = {
            "changed_uris": changed_uris,
            "unchanged_uris": unchanged_uris,
            "changed_count": len(changed_uris),
            "unchanged_count": len(unchanged_uris),
            "full_tokens": len(full_text) // 4,
            "delta_tokens": (len("\n\n".join(delta_parts)) // 4) if delta_parts else 0,
        }
        return full_text, delta_text, next_hashes, delta_meta




def record_trace_step(
    target_state: Any, context_lock, node_id: str, *, node_type: str = "llm", tier: str = "",
    capability: str = "", wavefront_index: int = 0, status: str = "running", elapsed_ms: int = 0,
    summary: str = "", added_files: Optional[List[str]] = None, dropped_files: Optional[List[str]] = None,
    children: Optional[List[Dict[str, Any]]] = None,
) -> None:
    """Appends or updates a structured node execution trace record on `RoutineEnvelope.execution_trace`."""
    with context_lock:
        is_env = isinstance(target_state, RoutineEnvelope)
        g = target_state.global_vars if is_env else target_state.setdefault("global", {})
        trace_list: List[Dict[str, Any]] = list(target_state.execution_trace if is_env else (g.get("execution_trace") or []))
        existing = next((item for item in trace_list if item.get("id") == node_id), None)
        entry = {
            "id": node_id, "type": node_type, "tier": tier, "capability": capability,
            "wavefront_index": wavefront_index, "status": status, "elapsed_ms": elapsed_ms, "summary": summary,
            "added_files": list(added_files or (existing.get("added_files") if existing else []) or []),
            "dropped_files": list(dropped_files or (existing.get("dropped_files") if existing else []) or []),
            "children": list(children if children is not None else ((existing.get("children") if existing else []) or [])),
        }
        if existing is not None:
            trace_list[trace_list.index(existing)] = entry
        else:
            trace_list.append(entry)
        if is_env:
            target_state.execution_trace = trace_list
        else:
            g["execution_trace"] = trace_list
        g["active_node_id"] = node_id if status in ("running", "paused") else g.get("active_node_id", "")
