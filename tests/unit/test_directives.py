"""
Unit tests for Phase 1, Sprint 3: 4-tier agent directives, repository directive acceptance,
protected VFS target confinement, and pending confirmation vs. UI editor saves.
"""
import os
import shutil
import tempfile
import unittest
from pathlib import Path

import insetu.app as _insetu_app  # noqa: F401 - Registers core blueprints & protected write handler
import insetu.core.attestations as _attestations
import insetu.core.protected_changes as _protected_changes
from insetu.core.directives import DIRECTIVE_PRECEDENCE_LINE, get_directives
from insetu.core.agent.orchestrator import ROUTINE_BANNED_CAPABILITIES
from insetu.core.mcp.engine_mcp import handle_mcp_jsonrpc, mcp_bp
from insetu.core.sdk import (
    execution_frame,
    get_registered_capabilities,
    is_protected_vfs_target,
    reset_kernel_state,
    save_json_config,
    set_protected_write_handler,
    sync_vfs_barrier,
)
from insetu.core.system.engine_system import system_bp
from insetu.core.topology.engine_topology import build_sys_landmarks_context, mount_topology_volumes_dynamically


class TestDirectivesAndAcceptance(unittest.TestCase):
    """Verifies 4-tier directive assembly, attestation acceptance, route guards, and S8 VFS protection."""

    def setUp(self):
        self._orig_cwd = os.getcwd()
        self._tmp = tempfile.mkdtemp(prefix="insetu_directives_test_")
        self.ws_root = Path(self._tmp).resolve()
        self.repo_dir = self.ws_root / "alpha"
        self.repo_dir.mkdir(parents=True, exist_ok=True)
        os.chdir(self.ws_root)
        reset_kernel_state(cwd=self.ws_root.as_posix(), control_dir=".insetu")

        cfg = {
            "workspace_root": self.ws_root.as_posix(),
            "extensions": ["git", "tracker"],
            "target_repos": [{"repo_dir": "alpha", "title": "Alpha Repo", "domain": "Workspaces"}],
        }
        ctrl = self.ws_root / ".insetu"
        ctrl.mkdir(parents=True, exist_ok=True)
        save_json_config((ctrl / "config.json").as_posix(), cfg, workspace_id="default")
        save_json_config(
            (ctrl / "workspaces.json").as_posix(),
            {"workspaces": {"default": {"config_path": "config.json"}}, "active_workspace": "default"},
            workspace_id="default",
        )
        mount_topology_volumes_dynamically(cfg, workspace_id="default")
        # The handler survives akasa's reset, but other suites clear it in tearDown.
        _protected_changes.install()
        self.ctx = system_bp.get_context("default")

    def tearDown(self):
        sync_vfs_barrier("default")
        set_protected_write_handler(None)
        os.chdir(self._orig_cwd)
        reset_kernel_state(cwd=self._orig_cwd, control_dir=".insetu")
        shutil.rmtree(self._tmp, ignore_errors=True)

    def _editor_save(self, uri: str, content: str):
        with execution_frame(origin="ui"):
            res = self.ctx.vfs.save(
                uri,
                content,
                data={_protected_changes.SOURCE_KEY: _protected_changes.EDITOR_SOURCE},
            )
        sync_vfs_barrier("default")
        return res

    def test_protected_target_confinement(self):
        """All four directive URIs are protected, while unrelated agent.md paths are not."""
        for protected_uri in (
            "ctx://settings/.templates/user/agent.md",
            "ctx://settings/agent.md",
            "vfs://alpha/.insetu-data/settings/agent.md",
            "vfs://alpha/.insetu-data/settings.local/agent.md",
        ):
            self.assertTrue(
                is_protected_vfs_target(protected_uri, "default"),
                f"Expected directive URI '{protected_uri}' to be protected.",
            )
        self.assertFalse(is_protected_vfs_target("vfs://alpha/docs/settings/agent.md", "default"))
        self.assertFalse(is_protected_vfs_target("vfs://alpha/src/data/settings/agent.md", "default"))
        self.assertFalse(is_protected_vfs_target("vfs://alpha/src/data/system/agent.md", "default"))
        self.assertFalse(is_protected_vfs_target("vfs://alpha/src/agent.md", "default"))

    def test_tier_ordering_headings_and_frontmatter_refusal(self):
        """User and workspace frontmatter is refused with a notice; accepted tiers assemble in 4-tier order."""
        self._editor_save("ctx://settings/.templates/user/agent.md", "---\nfoo: bar\n---\nPrefer concise functions.")
        self._editor_save("ctx://settings/agent.md", "Follow workspace naming rules.")
        self._editor_save("vfs://alpha/.insetu-data/settings/agent.md", "Shared repo rule: use strict types.")
        self._editor_save("vfs://alpha/.insetu-data/settings.local/agent.md", "Local repo override: skip slow suite.")

        # Before accepting shared repo directives, shared tier is omitted and flagged pending
        initial = get_directives(self.ctx, repo="alpha")
        self.assertTrue(initial["pending_acceptance"])
        self.assertIn("Prefer concise functions.", initial["text"])
        self.assertIn("Follow workspace naming rules.", initial["text"])
        self.assertNotIn("Shared repo rule: use strict types.", initial["text"])
        self.assertIn("Local repo override: skip slow suite.", initial["text"])
        self.assertTrue(any("Refused YAML frontmatter" in n for n in initial["notices"]))

        # Accept shared repo directives via the human-only route
        digest = initial["expected_digest"]
        with execution_frame(origin="ui"):
            accept_res = self.ctx.call("system.directives.accept", repo="alpha", digest=digest)
        self.assertEqual(accept_res["status"], "accepted")

        assembled = get_directives(self.ctx, repo="alpha")["text"]
        self.assertTrue(assembled.startswith(DIRECTIVE_PRECEDENCE_LINE))
        # Least to most authoritative: the repository's suggestions first, then user, workspace, repository local
        idx_shared = assembled.index("#### Directives suggested by the alpha repository (repository content)")
        idx_user = assembled.index("#### Your directives")
        idx_ws = assembled.index("#### Workspace directives")
        idx_local = assembled.index("#### Local repository directives (alpha)")
        self.assertLess(idx_shared, idx_user)
        self.assertLess(idx_user, idx_ws)
        self.assertLess(idx_ws, idx_local)

        # Verify sys.directives injection in build_sys_landmarks_context
        sys_ctx = build_sys_landmarks_context(self.ctx, repo_hint="alpha")
        self.assertEqual(sys_ctx["directives"], assembled)

        # Modifying the shared file on disk invalidates acceptance until re-accepted
        self._editor_save("vfs://alpha/.insetu-data/settings/agent.md", "Shared repo rule: modified after pull.")
        after_edit = get_directives(self.ctx, repo="alpha")
        self.assertTrue(after_edit["pending_acceptance"])
        self.assertNotIn("Shared repo rule: modified after pull.", after_edit["text"])
        self.assertEqual(
            after_edit["tiers"]["repo_shared"]["accepted_body"],
            "Shared repo rule: use strict types.",
        )

        # Revoking removes the attestation
        with execution_frame(origin="ui"):
            self.ctx.call("system.directives.revoke", repo="alpha")
        after_revoke = get_directives(self.ctx, repo="alpha")
        self.assertEqual(after_revoke["tiers"]["repo_shared"]["status"], "pending_acceptance")

    def test_accept_route_refuses_stale_digest_and_machine_origins(self):
        """system/directives/accept refuses a stale digest (409), refuses machine origins (403), and is hidden from MCP/routines."""
        self._editor_save("vfs://alpha/.insetu-data/settings/agent.md", "Shared directive v1.")
        info = get_directives(self.ctx, repo="alpha")
        valid_digest = info["expected_digest"]

        # Stale digest -> 409
        with self.assertRaises(RuntimeError) as stale_cm:
            self.ctx.call("system.directives.accept", repo="alpha", digest="0000stale")
        self.assertIn("changed after you reviewed", str(stale_cm.exception))

        # Machine origins -> 403
        for origin in ("mcp", "routine", "agent"):
            with execution_frame(origin=origin):
                with self.assertRaises(RuntimeError) as machine_cm:
                    self.ctx.call("system.directives.accept", repo="alpha", digest=valid_digest)
                self.assertIn("person", str(machine_cm.exception))

        # Hidden from MCP and routine-banned
        caps = get_registered_capabilities()
        for cap_id in ("system.directives.accept", "system.directives.revoke", "system.directives.save"):
            self.assertIn(cap_id, ROUTINE_BANNED_CAPABILITIES)
            self.assertIs(caps[cap_id].get("mcp_expose"), False)

        mcp_ctx = mcp_bp.get_context("default")
        tools_resp = handle_mcp_jsonrpc(mcp_ctx, {"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
        tool_names = {t["name"] for t in tools_resp["result"]["tools"]}
        self.assertNotIn("system.directives.accept", tool_names)
        self.assertNotIn("system.directives.revoke", tool_names)
        self.assertNotIn("system.directives.save", tool_names)

    def test_agent_and_mcp_writes_are_held_while_ui_editor_saves_write(self):
        """Saves from mcp/agent/routine to any directive file return pending_confirmation; UI editor saves write immediately."""
        for tier, uri in (
            ("user", "ctx://settings/.templates/user/agent.md"),
            ("workspace", "ctx://settings/agent.md"),
            ("repo_shared", "vfs://alpha/.insetu-data/settings/agent.md"),
            ("repo_local", "vfs://alpha/.insetu-data/settings.local/agent.md"),
        ):
            prior_text = self.ctx.vfs.read(uri)
            with execution_frame(origin="mcp"):
                held = self.ctx.vfs.save(uri, f"Unauthorized {tier} directive.")
            sync_vfs_barrier("default")
            self.assertEqual(held.get("status"), "pending_confirmation")
            self.assertEqual(self.ctx.vfs.read(uri), prior_text)

            with execution_frame(origin="ui"):
                saved = self.ctx.call("system.directives.save", tier=tier, repo="alpha", content=f"Authorized {tier} directive.")
            sync_vfs_barrier("default")
            self.assertEqual(saved["status"], "success")
            self.assertEqual(self.ctx.vfs.read(uri), f"Authorized {tier} directive.")

        # Writing repo_local also ensures settings.local/ is in .insetu-data/.gitignore
        gi_text = self.ctx.vfs.read("vfs://alpha/.insetu-data/.gitignore") or ""
        self.assertIn("settings.local/", gi_text)

    def test_sprint4_unified_session_templates_render_per_repo_directives_and_landmarks(self):
        """start_session_protocol.md and close_session_protocol.md render from a single template per workflow using sys.* landmarks and accepted directives."""
        from insetu.core.prompts.engine_prompts import resolve_prompt_text as _resolve_prompt_text

        self._editor_save("ctx://settings/.templates/user/agent.md", "- Personal rule: write concise prose.")
        self._editor_save("vfs://alpha/.insetu-data/settings/agent.md", "- Alpha repo guardrail: preserve strict membrane boundaries.")
        digest = get_directives(self.ctx, repo="alpha")["expected_digest"]
        with execution_frame(origin="ui"):
            self.ctx.call("system.directives.accept", repo="alpha", digest=digest)

        rendered_start = _resolve_prompt_text(
            self.ctx,
            target_uri="ctx://prompts/.templates/agent/start_session_protocol.md",
            repo="alpha",
            interpolate_vars=True,
        )
        self.assertIn("Alpha Repo", rendered_start)
        self.assertIn("Personal rule: write concise prose.", rendered_start)
        self.assertIn("Alpha repo guardrail: preserve strict membrane boundaries.", rendered_start)

        rendered_close = _resolve_prompt_text(
            self.ctx,
            target_uri="ctx://prompts/.templates/git/close_session_protocol.md",
            repo="alpha",
            interpolate_vars=True,
        )
        self.assertIn("Alpha Repo", rendered_close)
        self.assertIn("Alpha repo guardrail: preserve strict membrane boundaries.", rendered_close)
        self.assertIn("vfs://alpha/.insetu-data/tracker/epics/closed", rendered_close)

    def test_run_directives_are_appended_after_accepted_directives(self):
        """A run's directives input is added under its own heading and never replaces the assembled tiers."""
        self._editor_save("ctx://settings/agent.md", "Follow workspace naming rules.")
        sys_ctx = build_sys_landmarks_context(
            self.ctx,
            repo_hint="alpha",
            extra_inputs={"directives": "Only touch the parser."},
        )
        text = sys_ctx["directives"]
        self.assertIn("Follow workspace naming rules.", text)
        self.assertIn("#### Directives for this run\n\nOnly touch the parser.", text)
        self.assertLess(text.index("Follow workspace naming rules."), text.index("Only touch the parser."))

    def test_legacy_system_settings_folder_moves_to_settings_on_mount(self):
        """Files under the old <control>/data/system/ folder are moved into <control>/data/settings/ when settings mounts."""
        ctrl = self.ws_root / ".insetu"
        legacy = ctrl / "data" / "system"
        legacy.mkdir(parents=True, exist_ok=True)
        (legacy / "agent.md").write_text("Legacy workspace directive.", encoding="utf-8")

        system_bp.mount_volumes("default", force=True)

        self.assertFalse((legacy / "agent.md").exists())
        moved = ctrl / "data" / "settings" / "agent.md"
        self.assertEqual(moved.read_text(encoding="utf-8"), "Legacy workspace directive.")
        self.assertEqual(self.ctx.vfs.read("ctx://settings/agent.md"), "Legacy workspace directive.")


if __name__ == "__main__":
    unittest.main()
