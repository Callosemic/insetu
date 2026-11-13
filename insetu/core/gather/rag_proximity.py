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
from typing import Dict, List, Optional, Set

from insetu.core.sdk import InSetuURI
from insetu.core.topology.engine_topology import (
    clamp_uris_to_topology,
    resolve_repo_code_index_uri,
)

DECAY_LAMBDA = 0.00001  # Half-life of ~19 hours


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
