"""Unified 6-Bucket RoutineEnvelope, ContextArtifact value object, and Web-Chat delta state machine."""
from dataclasses import dataclass, field
import hashlib
import re
from typing import Any, Dict, List, Literal, Optional, Set, Tuple

from insetu.core.utils_core import InSetuURI
from insetu.core.agent.routine_loader import is_prose_document_uri, resolve_routine_mode
from insetu.core.gather.context_assemble import resolve_query_context

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

RESERVED_ENVELOPE_KEYS: Set[str] = {"sys", "global", "inputs", "nodes", "loop", "holding", "trace", "_ctx"}


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
    source: str = "auto"
    idle_turns: int = 0
    tokens: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "uri": self.uri,
            "bucket": self.bucket,
            "lens": self.lens,
            "source": self.source,
            "idle_turns": self.idle_turns,
            "tokens": self.tokens,
        }


@dataclass
class RoutineEnvelope:
    """
    Single state and working-set container for a declarative Routine or Agent turn.
    Maintains the 6 volatility-ordered buckets, node outputs, execution trace, and
    the content-addressed Web-Chat sent-hash ledger for Same-Window delta packing.
    """
    session_id: str = "default"
    routine_id: str = "workspace_turn"
    user_prompt: str = ""
    web_chat_window_mode: Literal["same_window", "new_window"] = "new_window"
    artifacts: Dict[str, ContextArtifact] = field(default_factory=dict)
    sent_hashes: Dict[str, str] = field(default_factory=dict)
    staged_sent_hashes: Dict[str, str] = field(default_factory=dict)
    nodes: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    holding: Dict[str, Any] = field(default_factory=dict)

    def sync_lists(
        self,
        editable_list: List[str],
        readonly_list: List[str],
        all_context_files: List[str],
        scoped_const: Optional[List[str]] = None,
    ) -> None:
        """Synchronizes legacy orchestrator working-set lists with the authoritative RoutineEnvelope artifacts map."""
        const_set = set(scoped_const or self.constitution_uris())
        for u in list(self.artifacts.keys()):
            if u not in all_context_files and u not in editable_list and u not in readonly_list and u not in const_set:
                if self.artifacts[u].source != "user_pinned":
                    del self.artifacts[u]
        for cf in const_set:
            if cf:
                self.artifacts[cf] = ContextArtifact(uri=cf, bucket="governance", lens="full", source="constitution")
        for rf in readonly_list:
            if rf and rf not in const_set:
                cur = self.artifacts.get(rf)
                self.artifacts[rf] = ContextArtifact(
                    uri=rf,
                    bucket="data",
                    lens="slice",
                    source=cur.source if cur else "reference",
                    idle_turns=cur.idle_turns if cur else 0,
                )
        for ef in editable_list:
            if ef and ef not in const_set:
                cur = self.artifacts.get(ef)
                self.artifacts[ef] = ContextArtifact(
                    uri=ef,
                    bucket="meta" if is_prose_document_uri(ef) else "data",
                    lens="full",
                    source=cur.source if cur else "user_pinned",
                    idle_turns=0,
                )
        editable_list[:] = [u for u in editable_list if u in self.artifacts and self.artifacts[u].lens in ("full", "diff", "genesis") and u not in const_set]
        for u, art in self.artifacts.items():
            if art.bucket in ("data", "meta") and art.lens in ("full", "diff", "genesis") and u not in editable_list and u not in const_set:
                editable_list.append(u)
        readonly_list[:] = [u for u in readonly_list if u in self.artifacts and self.artifacts[u].lens == "slice" and u not in const_set]
        for u, art in self.artifacts.items():
            if art.bucket == "data" and art.lens == "slice" and u not in readonly_list and u not in const_set:
                readonly_list.append(u)
        all_context_files[:] = list(dict.fromkeys(list(const_set) + readonly_list + editable_list))

    def apply_working_set_delta(
        self,
        *,
        add: Optional[List[str]] = None,
        slice_uris: Optional[List[str]] = None,
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
                if not u:
                    continue
                cur = self.artifacts.get(u)
                if cur is None:
                    self.artifacts[u] = ContextArtifact(
                        uri=u,
                        bucket=target_bucket,
                        lens=target_lens,
                        source=source,
                    )
                    added_out.append(u)
                else:
                    # Promote lens if requested lens is higher resolution
                    lens_rank = {"outline": 1, "slice": 2, "diff": 3, "full": 4}
                    if lens_rank.get(target_lens, 1) >= lens_rank.get(cur.lens, 1) or source in ("user_pinned", "probe"):
                        cur.lens = target_lens
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

    def to_checkpoint(self, status: str, wavefront_index: int = 0, pending_handoff: Any = None, wavefronts: Any = None, chain_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Serializes the RoutineEnvelope and chain_context into a server-authoritative checkpoint dictionary."""
        return {
            "status": status,
            "session_id": self.session_id,
            "routine_id": self.routine_id,
            "user_prompt": self.user_prompt,
            "web_chat_window_mode": self.web_chat_window_mode,
            "wavefront_index": wavefront_index,
            "wavefronts": wavefronts or [],
            "pending_handoff": pending_handoff,
            "artifacts": {u: a.to_dict() for u, a in self.artifacts.items()},
            "sent_hashes": dict(self.sent_hashes),
            "staged_sent_hashes": dict(self.staged_sent_hashes),
            "holding": dict(self.holding),
            "chain_context": chain_context or {},
        }

    @classmethod
    def from_checkpoint(cls, data: Dict[str, Any]) -> "RoutineEnvelope":
        """Reconstructs a RoutineEnvelope from a persisted server checkpoint dictionary."""
        if not isinstance(data, dict):
            return cls()
        g_ctx = (data.get("chain_context") or {}).get("global") or {}
        raw_arts = data.get("artifacts") or {}
        arts: Dict[str, ContextArtifact] = {}
        if isinstance(raw_arts, dict):
            for u, spec in raw_arts.items():
                if isinstance(spec, dict) and spec.get("uri"):
                    arts[u] = ContextArtifact(
                        uri=spec["uri"],
                        bucket=spec.get("bucket", "data"),
                        lens=spec.get("lens", "full"),
                        source=spec.get("source", "auto"),
                        idle_turns=int(spec.get("idle_turns") or 0),
                        tokens=int(spec.get("tokens") or 0),
                    )
        return cls(
            session_id=str(data.get("session_id") or g_ctx.get("session_id") or "default"),
            routine_id=str(data.get("routine_id") or "workspace_turn"),
            user_prompt=str(data.get("user_prompt") or g_ctx.get("user_prompt") or ""),
            web_chat_window_mode=data.get("web_chat_window_mode") or g_ctx.get("web_chat_window_mode") or "same_window",
            artifacts=arts,
            sent_hashes=dict(data.get("sent_hashes") or g_ctx.get("web_chat_sent_hashes") or {}),
            staged_sent_hashes=dict(data.get("staged_sent_hashes") or g_ctx.get("web_chat_staged_hashes") or {}),
            holding=dict(data.get("holding") or {}),
        )

    @property
    def editable_files(self) -> List[str]:
        """Read-only computed list of full/diff-lens data and meta target URIs."""
        return self.editable_uris()

    @property
    def readonly_files(self) -> List[str]:
        """Read-only computed list of slice-lens reference URIs."""
        return self.reference_uris()

    @property
    def all_context_files(self) -> List[str]:
        """Read-only computed list of all mounted vfs:// and ctx:// URIs in bucket volatility order."""
        return self.all_file_uris()

    def fork_sub_routine(self, target_routine_id: str) -> "RoutineEnvelope":
        """Creates a child RoutineEnvelope for sub-routine delegation preserving working-set artifacts and Web-Chat hashes."""
        return RoutineEnvelope(
            session_id=self.session_id,
            routine_id=target_routine_id,
            user_prompt=self.user_prompt,
            web_chat_window_mode=self.web_chat_window_mode,
            artifacts={k: ContextArtifact(**v.to_dict()) for k, v in self.artifacts.items()},
            sent_hashes=dict(self.sent_hashes),
            staged_sent_hashes=dict(self.staged_sent_hashes),
            nodes=dict(self.nodes),
            holding=dict(self.holding),
        )

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

    def resolve_query_directives(
        self,
        ctx,
        directives: List[str],
        clamp_fn,
    ) -> Tuple[List[str], Set[str]]:
        """
        Parses `<<<<<<< QUERY_CONTEXT` lines (`+ vfs://...`, `- vfs://...`, `msg://<id>`)
        into `(clamped_add_uris, clamped_drop_uris)`, materializing any recalled `msg://`
        session messages into `ctx://contexts/recalled_session_messages.txt`.
        """
        raw_add_uris: List[str] = []
        raw_drop_uris: List[str] = []
        recalled_msgs: List[str] = []
        for q_item in (directives or [])[:12]:
            for raw_ln in str(q_item).splitlines():
                s_ln = raw_ln.strip().strip("`'")
                if not s_ln:
                    continue
                is_drop = s_ln.startswith("-") or s_ln.lower().startswith("drop:")
                clean_ln = re.sub(r'^(?:[-+*]|drop:|add:)\s*', '', s_ln, flags=re.IGNORECASE).strip()
                if clean_ln.startswith(("msg://", "msg_")):
                    recalled = resolve_query_context(ctx, clean_ln)
                    if isinstance(recalled, dict) and recalled.get("content"):
                        recalled_msgs.append(
                            f"=== RECALLED MESSAGE {recalled.get('message_id')} (Turn #{recalled.get('seq')} · {recalled.get('role')}) ===\n"
                            f"{recalled.get('content')}"
                        )
                    continue
                found_uris = re.findall(r'(?:vfs|ctx)://[A-Za-z0-9_./-]+', clean_ln)
                target_list = raw_drop_uris if is_drop else raw_add_uris
                if found_uris:
                    target_list.extend(found_uris)
                elif clean_ln:
                    target_list.append(clean_ln)

        if recalled_msgs:
            self.holding["recalled_messages_text"] = "\n\n".join(recalled_msgs)

        clamped_add = clamp_fn(ctx, raw_add_uris)
        clamped_drop = set(clamp_fn(ctx, raw_drop_uris)) if raw_drop_uris else set()
        self.apply_working_set_delta(add=clamped_add, drop=list(clamped_drop), source="probe")
        return clamped_add, clamped_drop


def reconcile_working_set_ttl(
    existing_ws: List[Dict[str, Any]],
    *,
    pinned_this_turn: Optional[List[str]] = None,
    referenced_this_turn: Optional[List[str]] = None,
    committed_this_turn: Optional[List[str]] = None,
    advance_turn_age: bool = True,
) -> List[Dict[str, Any]]:
    """
    Single Source of Truth for Session Working-Set Lifecycle (5-Turn TTL Decay & Eviction):
    - When `advance_turn_age=False` (e.g., mid-turn `paused_for_user`), records active pinned/reference files without aging.
    - When `advance_turn_age=True` (end of turn), increments `idle_turns` on non-user-pinned items,
      demotes `pinned` -> `reference` (`full` -> `slice`) at `idle_turns >= 6`, and evicts at `idle_turns >= 9`.
    """
    ws_map: Dict[str, Dict[str, Any]] = {}
    for ws_entry in (existing_ws or []):
        if not isinstance(ws_entry, dict):
            continue
        raw_fp = ws_entry.get("filepath") or ws_entry.get("uri") or ""
        if not raw_fp:
            continue
        try:
            norm_fp = str(InSetuURI(raw_fp))
        except Exception:
            continue
        ws_map[norm_fp] = {
            "filepath": norm_fp,
            "tier": ws_entry.get("tier") or "pinned",
            "idle_turns": int(ws_entry.get("idle_turns") or 0),
            "user_pinned": bool(ws_entry.get("user_pinned", False)),
        }

    if advance_turn_age:
        for ws_entry in ws_map.values():
            if not ws_entry.get("user_pinned"):
                ws_entry["idle_turns"] = ws_entry.get("idle_turns", 0) + 1
                if ws_entry["idle_turns"] >= 6 and ws_entry.get("tier") == "pinned":
                    ws_entry["tier"] = "reference"

    for rf in (referenced_this_turn or []):
        if not rf:
            continue
        try:
            norm_rf = str(InSetuURI(rf))
        except Exception:
            continue
        if norm_rf not in ws_map:
            ws_map[norm_rf] = {
                "filepath": norm_rf,
                "tier": "reference",
                "idle_turns": 0,
                "user_pinned": False,
            }

    for af in (pinned_this_turn or []):
        if not af:
            continue
        try:
            norm_af = str(InSetuURI(af))
        except Exception:
            continue
        was_pinned = bool(ws_map.get(norm_af, {}).get("user_pinned", True))
        ws_map[norm_af] = {
            "filepath": norm_af,
            "tier": "pinned",
            "idle_turns": 0,
            "user_pinned": was_pinned,
        }

    for cf in (committed_this_turn or []):
        if not cf:
            continue
        try:
            norm_cf = str(InSetuURI(cf))
        except Exception:
            continue
        was_user_pinned = bool(ws_map.get(norm_cf, {}).get("user_pinned", False))
        ws_map[norm_cf] = {
            "filepath": norm_cf,
            "tier": "pinned",
            "idle_turns": 0,
            "user_pinned": was_user_pinned,
        }

    return [
        ws_entry for ws_entry in ws_map.values()
        if ws_entry.get("user_pinned") or ws_entry.get("idle_turns", 0) < 9
    ]


def parse_colon_command_tokens(raw_prompt: str) -> Dict[str, str]:
    """Parses universal colon-scoped slash commands (/code, /upkeep:docs, /upkeep:docs:apply, /user:upkeep:docs)."""
    text = (raw_prompt or "").strip()
    if not text.startswith("/"):
        return {"namespace": "", "target": "", "scope": "", "stage": "", "rest": text}
    first_token, _, rest = text.partition(" ")
    parts = [p.strip().lower() for p in first_token[1:].split(":") if p.strip()]
    if not parts:
        return {"namespace": "", "target": "", "scope": "", "stage": "", "rest": rest.strip()}
    namespace = "user" if parts[0] == "user" else ""
    if namespace:
        parts = parts[1:]
    target = parts[0] if parts else ""
    stage, scope = "", ""
    for seg in parts[1:]:
        if seg in ("apply", "execute", "commit"):
            stage = "apply"
        elif seg in ("audit", "plan", "propose"):
            stage = "audit"
        elif not scope:
            scope = seg
    return {"namespace": namespace, "target": target, "scope": scope, "stage": stage, "rest": rest.strip()}


def parse_slash_command(raw_prompt: str, explicit_mode: Optional[str] = None, routine: Optional[Dict[str, Any]] = None) -> Tuple[str, str]:
    """Parses leading colon-scoped slash commands (/code, /plan, /ask, /yomama, /upkeep:docs, /user:<id>:<scope>, /undo)."""
    text = (raw_prompt or "").strip()
    fallback_mode = (explicit_mode or "auto").strip().lower().lstrip("/")
    if text.startswith("/"):
        parsed_tok = parse_colon_command_tokens(text)
        target, rest = parsed_tok["target"], parsed_tok["rest"]
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
    return (fallback_mode if fallback_mode in ("code", "plan", "ask", "yomama", "auto") else "auto"), text


def record_trace_step(
    chain_context: Dict[str, Any], context_lock, node_id: str, *, node_type: str = "llm", tier: str = "",
    capability: str = "", wavefront_index: int = 0, status: str = "running", elapsed_ms: int = 0,
    summary: str = "", added_files: Optional[List[str]] = None, dropped_files: Optional[List[str]] = None,
    children: Optional[List[Dict[str, Any]]] = None,
) -> None:
    """Appends or updates a structured node execution trace record in chain_context['global']['execution_trace']."""
    with context_lock:
        g = chain_context.setdefault("global", {})
        trace_list: List[Dict[str, Any]] = list(g.get("execution_trace") or [])
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
        g["execution_trace"] = trace_list
        g["active_node_id"] = node_id if status in ("running", "paused") else g.get("active_node_id", "")
