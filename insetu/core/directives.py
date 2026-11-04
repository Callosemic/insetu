"""
Four-tier agent directives reader and repository directive acceptance helpers (P13 Phase 1, Sprint 3).

It lives in insetu/core/ beside attestations.py because topology (sys.* prompt variables), the system routes and
the agent all read it; none of them owns it.

Reads the Markdown body of `agent.md` across four tiers, from least to most authoritative; later sections win:
1. Repository, shared: `vfs://<repo>/.insetu-data/settings/agent.md` (lowest: the repository's authors wrote it;
    included only when accepted in attestations)
2. User (global): `ctx://settings/.templates/user/agent.md`
3. Workspace: `ctx://settings/agent.md`
4. Repository, local: `vfs://<repo>/.insetu-data/settings.local/agent.md` (yours and the most specific)
"""
from typing import Any, Dict, List, Optional
import insetu.core.attestations as _attestations
from insetu.core.utils_core import get_sister_repos, parse_frontmatter

DIRECTIVE_PRECEDENCE_LINE = "Directive sections run from least to most authoritative: on conflict, a later section wins over an earlier one."
DIRECTIVE_TIERS = ("repo_shared", "user", "workspace", "repo_local")


def _is_safe_repo_name(repo: Optional[str]) -> bool:
    """Returns True when repo is a simple repository directory name without path traversal."""
    clean = str(repo or "").strip()
    return bool(clean and ".." not in clean and "/" not in clean and "\\" not in clean and "://" not in clean)


def resolve_directive_tier_uri(tier: str, repo: Optional[str] = None) -> Optional[str]:
    """Maps a directive tier identifier ('user', 'workspace', 'repo_shared', 'repo_local') to its canonical VFS/CTX URI."""
    clean_tier = str(tier or "").strip().lower()
    if clean_tier == "user":
        return "ctx://settings/.templates/user/agent.md"
    if clean_tier == "workspace":
        return "ctx://settings/agent.md"
    if clean_tier in ("repo_shared", "shared"):
        return f"vfs://{repo}/.insetu-data/settings/agent.md" if _is_safe_repo_name(repo) else None
    if clean_tier in ("repo_local", "local"):
        return f"vfs://{repo}/.insetu-data/settings.local/agent.md" if _is_safe_repo_name(repo) else None
    return None


def ensure_local_settings_gitignored(ctx, repo: str) -> None:
    """Ensures `settings.local/` is listed in `vfs://<repo>/.insetu-data/.gitignore` when local repo settings are written."""
    if not _is_safe_repo_name(repo):
        return
    gi_uri = f"vfs://{repo}/.insetu-data/.gitignore"
    existing = ctx.vfs.read(gi_uri) or ""
    lines = [line.strip().rstrip("/") for line in existing.splitlines()]
    if "settings.local" in lines:
        return
    sep = "\n" if existing and not existing.endswith("\n") else ""
    updated = f"{existing}{sep}settings.local/\n"
    ctx.vfs.save(gi_uri, updated, data={"ignore_ledger": True})


def _extract_directive_body(raw_text: Optional[str], uri: str, refuse_frontmatter: bool) -> Dict[str, Any]:
    """Splits a directive Markdown document, refusing YAML frontmatter on user and workspace tiers with a notice."""
    if raw_text is None:
        return {"exists": False, "body": "", "notices": []}
    yaml_meta, body, fm_match = parse_frontmatter(raw_text)
    notices: List[str] = []
    if fm_match and refuse_frontmatter:
        notices.append(
            f"Refused YAML frontmatter in {uri}: settings fields remain in JSON until Phase 6; only the Markdown body is read."
        )
    elif fm_match and isinstance(yaml_meta, dict) and any(k != "schema" for k in yaml_meta.keys()):
        notices.append(
            f"Ignored YAML frontmatter fields in {uri}: agent.md holds prose directives in its Markdown body."
        )
    return {"exists": True, "body": (body or "").strip(), "notices": notices}


def get_directives(ctx, repo: Optional[str] = None) -> Dict[str, Any]:
    """
    Assembles the active agent directives across the four tiers for `repo` (defaulting to the first mounted repo).
    Shared repository directives (`vfs://<repo>/.insetu-data/settings/agent.md`) are included in `text` only when
    an active `repo_directive` attestation matches the exact SHA-256 digest of the trimmed Markdown body.
    """
    wid = ctx.workspace_id or "default"
    known_repos = get_sister_repos(wid)
    clean_repo = str(repo or (known_repos[0] if known_repos else "") or "").strip()
    has_valid_repo = _is_safe_repo_name(clean_repo) and (not known_repos or clean_repo in known_repos)
    effective_repo = clean_repo if has_valid_repo else ""

    # Least to most authoritative (DIRECTIVE_PRECEDENCE_LINE): the repository's suggestions, then your own tiers
    # from most general to most specific.
    tier_specs = []
    if effective_repo:
        tier_specs.append((
            "repo_shared",
            f"Directives suggested by the {effective_repo} repository (repository content)",
            f"vfs://{effective_repo}/.insetu-data/settings/agent.md",
            False,
            True,
        ))
    tier_specs.extend([
        ("user", "Your directives", "ctx://settings/.templates/user/agent.md", True, False),
        ("workspace", "Workspace directives", "ctx://settings/agent.md", True, False),
    ])
    if effective_repo:
        tier_specs.append((
            "repo_local",
            f"Local repository directives ({effective_repo})",
            f"vfs://{effective_repo}/.insetu-data/settings.local/agent.md",
            False,
            False,
        ))

    sections: List[str] = []
    notices: List[str] = []
    tiers_info: Dict[str, Dict[str, Any]] = {}
    pending_acceptance = False
    expected_digest: Optional[str] = None

    for tier_id, heading, uri, refuse_fm, needs_acceptance in tier_specs:
        raw = ctx.vfs.read(uri)
        parsed = _extract_directive_body(raw, uri, refuse_frontmatter=refuse_fm)
        notices.extend(parsed["notices"])
        body_text = parsed["body"]

        if not parsed["exists"]:
            tiers_info[tier_id] = {
                "tier": tier_id,
                "heading": heading,
                "uri": uri,
                "status": "absent",
                "body": "",
                "accepted": not needs_acceptance,
                "notices": parsed["notices"],
            }
            continue

        if not body_text:
            tiers_info[tier_id] = {
                "tier": tier_id,
                "heading": heading,
                "uri": uri,
                "status": "empty",
                "body": "",
                "accepted": not needs_acceptance,
                "notices": parsed["notices"],
            }
            continue

        if needs_acceptance:
            digest = _attestations.digest_of(body_text)
            subject = f"{wid}|{effective_repo}"
            grant = _attestations.get_attestation("repo_directive", subject)
            accepted_digest = grant.get("digest") if isinstance(grant, dict) else None
            accepted_body = (grant.get("detail") or {}).get("body", "") if isinstance(grant, dict) else ""
            if grant and accepted_digest == digest:
                sections.append(f"#### {heading}\n\n{body_text}")
                tiers_info[tier_id] = {
                    "tier": tier_id,
                    "heading": heading,
                    "uri": uri,
                    "status": "accepted",
                    "body": body_text,
                    "digest": digest,
                    "accepted": True,
                    "accepted_body": accepted_body or body_text,
                    "notices": parsed["notices"],
                }
            else:
                pending_acceptance = True
                expected_digest = digest
                status_label = "changed" if grant else "pending_acceptance"
                tiers_info[tier_id] = {
                    "tier": tier_id,
                    "heading": heading,
                    "uri": uri,
                    "status": status_label,
                    "body": body_text,
                    "digest": digest,
                    "accepted": False,
                    "accepted_digest": accepted_digest,
                    "accepted_body": accepted_body,
                    "notices": parsed["notices"],
                }
        else:
            sections.append(f"#### {heading}\n\n{body_text}")
            tiers_info[tier_id] = {
                "tier": tier_id,
                "heading": heading,
                "uri": uri,
                "status": "active",
                "body": body_text,
                "accepted": True,
                "notices": parsed["notices"],
            }

    assembled_text = f"{DIRECTIVE_PRECEDENCE_LINE}\n\n" + "\n\n".join(sections) if sections else ""
    return {
        "repo": effective_repo,
        "text": assembled_text,
        "tiers": tiers_info,
        "notices": notices,
        "pending_acceptance": pending_acceptance,
        "expected_digest": expected_digest,
    }
