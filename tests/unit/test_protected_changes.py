"""S8: a change to a protected file waits as a pending change until a person confirms exactly what they reviewed."""
import ast
import contextlib
import io
import json
import os
import tempfile
import unittest
from pathlib import Path

import akasa
import akasa.utils as akasa_utils
from akasa.db import apply_declarative_schema
from akasa.utils import load_config
from akasa.workers import _init_worker_schema
import insetu.core.protected_changes as protected_changes
from insetu.core.agent import orchestrator
from insetu.core.bridge.bridge_vfs import PROTECTED_CONFIRMATION_FLAG, execute_bridge_sync
from insetu.core.bridge.engine_bridge import BRIDGE_SCHEMA
from insetu.core.fs.engine_fs import fs_bp
from insetu.core.sdk import (
    execute_confirmed_protected_write,
    execute_vfs_delete,
    execute_vfs_move,
    execute_vfs_save,
    execution_frame,
    get_registered_capabilities,
    set_protected_write_handler,
    sync_vfs_barrier,
)
from insetu.core.system.engine_system import system_bp  # noqa: F401 - registers the system.protected.* routes
from insetu.core.topology.engine_topology import TOPOLOGY_SCHEMA, mount_topology_volumes_dynamically
from tests.fitness.core import FitnessState
from tests.fitness.rules_python import BackendFitnessVisitor

def cli_source(label):
    """A small but working cli.py: the smoke test imports it and runs `insetu --help`."""
    return f'import sys\n\n\ndef main():\n    print("Usage: insetu [{label}]")\n    sys.exit(0)\n'


ORIGINAL = cli_source("original")
CHANGED = cli_source("changed")
BROKEN = "import sys\n\n\ndef main(:\n"
CLI_URI = "vfs://insetu/insetu/cli.py"
SHADOW_URI = "vfs://insetu/insetu/__pycache__/cli.cpython-313.pyc"


class _ProtectedCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root / ".insetu"
        (self.control_dir / "cache" / "db").mkdir(parents=True)
        self.cli = self.root / "insetu" / "insetu" / "cli.py"
        self.cli.parent.mkdir(parents=True)
        self.cli.write_text(ORIGINAL, encoding="utf-8")
        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        akasa.reset_state(cwd=self.root.as_posix(), control_dir=".insetu")
        (self.control_dir / "host.json").write_text(json.dumps({"port": 5005}), encoding="utf-8")
        (self.control_dir / "workspaces.json").write_text(
            json.dumps({"workspaces": {"default": {"config_path": "config.json"}}, "active_workspace": "default"}), encoding="utf-8"
        )
        (self.control_dir / "config.json").write_text(json.dumps({
            "workspace_root": self.root.as_posix(),
            "extensions": ["config", "bridge"],
            "target_repos": [{"repo_dir": "insetu", "title": "inSetu", "exts": [".py"]}],
        }), encoding="utf-8")
        _init_worker_schema("default")
        apply_declarative_schema("topology", TOPOLOGY_SCHEMA, "default")
        apply_declarative_schema("bridge", BRIDGE_SCHEMA, "default")
        mount_topology_volumes_dynamically(load_config("default"), workspace_id="default")
        protected_changes.install()
        self.caps = get_registered_capabilities()

    def tearDown(self):
        set_protected_write_handler(None)
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def _cli_text(self):
        sync_vfs_barrier("default")
        return self.cli.read_text(encoding="utf-8") if self.cli.exists() else None

    def _audit_events(self):
        sync_vfs_barrier("default")
        path = protected_changes.audit_log_path()
        if not path.exists():
            return []
        return [json.loads(line)["event"] for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]

    def _propose(self, content=CHANGED, origin="mcp"):
        with execution_frame(origin=origin):
            body = execute_vfs_save("default", CLI_URI, content)
        self.assertEqual(body["status"], "pending_confirmation", body)
        return body["change_id"]


class TestProposals(_ProtectedCase):
    """Machine saves and deletes wait and write nothing; moves, recovery-file deletes and insetu's own records are refused."""

    def test_a_machine_save_waits_and_writes_nothing(self):
        change_id = self._propose()
        self.assertEqual(self._cli_text(), ORIGINAL)
        [change] = protected_changes.list_pending()
        self.assertEqual(change["id"], change_id)
        self.assertEqual(change["proposed_by"]["origin"], "mcp")
        self.assertEqual(change["base_hash"], protected_changes.content_hash(ORIGINAL))
        self.assertEqual(change["current_content"], ORIGINAL)
        self.assertFalse(change["stale"])
        self.assertEqual(self._propose(), change_id, "the same proposal again is the same pending change")
        self.assertEqual(protected_changes.count_pending(), 1)
        self.assertEqual(self._audit_events(), ["proposed"])

    def test_a_delete_waits_but_a_recovery_file_is_never_deleted(self):
        shadow = self.cli.parent / "__pycache__" / "cli.cpython-313.pyc"
        shadow.parent.mkdir()
        shadow.write_text("stale bytecode", encoding="utf-8")
        with execution_frame(origin="routine"):
            body, status = execute_vfs_delete("default", SHADOW_URI)
            self.assertEqual((body["status"], status), ("pending_confirmation", 202))
            self.assertEqual(execute_vfs_delete("default", CLI_URI)[1], 403)
        self.assertEqual(self._cli_text(), ORIGINAL)
        [change] = protected_changes.list_pending()
        with execution_frame(transport="HTTP"):
            _body, status = protected_changes.confirm(change["id"], "delete")
        self.assertEqual(status, 200)
        sync_vfs_barrier("default")
        self.assertFalse(shadow.exists())

    def test_moves_and_insetus_own_records_are_refused(self):
        with execution_frame(origin="mcp"):
            _body, status = execute_vfs_move("default", CLI_URI, "vfs://insetu/insetu/cli_old.py")
            self.assertEqual(status, 403)
            for target in (
                self.control_dir / "attestations.json",
                self.control_dir / "pending_changes" / "pc_000000000000.json",
                self.control_dir / "audit" / "protected_changes.jsonl",
            ):
                with self.subTest(target=target.name):
                    body = execute_vfs_save("default", target.as_posix(), "{}", {"is_absolute_artifact": True})
                    self.assertEqual(body["status"], "error")
        self.assertEqual(protected_changes.count_pending(), 0)
        self.assertEqual(self._cli_text(), ORIGINAL)


class TestConfirmation(_ProtectedCase):
    """Only a person confirms, only the reviewed content, and only against an unchanged file."""

    def test_a_person_confirms_exactly_what_they_reviewed(self):
        change_id = self._propose()
        with execution_frame(transport="HTTP"):
            _body, status = protected_changes.confirm(change_id, protected_changes.content_hash("SOMETHING ELSE\n"))
            self.assertEqual(status, 409)
            self.assertEqual(self._cli_text(), ORIGINAL)
            body, status = protected_changes.confirm(change_id, protected_changes.content_hash(CHANGED))
        self.assertEqual((body["status"], status), ("confirmed", 200))
        self.assertEqual(self._cli_text(), CHANGED)
        self.assertEqual(protected_changes.list_pending(), [])
        self.assertEqual(self._audit_events(), ["proposed", "confirm_refused", "confirmed"])

    def test_machines_cannot_confirm_or_discard(self):
        change_id = self._propose()
        result_hash = protected_changes.content_hash(CHANGED)
        for origin in ("mcp", "routine", "agent"):
            with self.subTest(origin=origin), execution_frame(origin=origin):
                self.assertEqual(protected_changes.confirm(change_id, result_hash)[1], 403)
                self.assertEqual(protected_changes.discard(change_id)[1], 403)
        self.assertEqual(self._cli_text(), ORIGINAL)
        self.assertEqual(protected_changes.count_pending(), 1)
        for cap_id in ("system.protected.confirm", "system.protected.discard"):
            with self.subTest(capability=cap_id):
                self.assertIs(self.caps[cap_id]["mcp_expose"], False)
                self.assertIn(cap_id, orchestrator.ROUTINE_BANNED_CAPABILITIES)

    def test_a_change_to_a_file_that_moved_on_is_refused(self):
        change_id = self._propose()
        execute_confirmed_protected_write("default", CLI_URI, "NEWER = True\n")
        [change] = protected_changes.list_pending()
        self.assertTrue(change["stale"])
        with execution_frame(transport="HTTP"):
            self.assertEqual(protected_changes.confirm(change_id, change["result_hash"])[1], 409)
            self.assertEqual(protected_changes.discard(change_id)[1], 200)
        self.assertEqual(self._cli_text(), "NEWER = True\n")
        self.assertEqual(protected_changes.count_pending(), 0)
        self.assertEqual(self._audit_events(), ["proposed", "confirm_refused", "discarded"])


class TestWritersSeeTheHold(_ProtectedCase):
    """A person's editor save is checked and written; MCP saves and bridge patches come back as pending."""

    def _fs_save(self, content):
        ctx = fs_bp.get_context("default", payload={"filepath": CLI_URI, "content": content})
        return self.caps["fs.save"]["handler"](ctx)

    def test_a_persons_editor_save_is_checked_and_written_but_an_mcp_save_waits(self):
        with execution_frame(origin="mcp"):
            body, status = self._fs_save(CHANGED)
        self.assertEqual((body["status"], status), ("pending_confirmation", 202))
        self.assertEqual(self._cli_text(), ORIGINAL)
        with execution_frame(transport="HTTP"):
            body, status = self._fs_save(BROKEN)
            self.assertEqual(status, 422, body)
            self.assertIn("smoke test failed", body["error"])
            self.assertEqual(self._cli_text(), ORIGINAL)
            body = self._fs_save(CHANGED)  # A save that went through answers like any other: a body, HTTP 200.
        self.assertEqual(body["status"], "accepted", body)
        self.assertTrue(body["base_hash"], "the editor gets the new base hash for its next save")
        self.assertEqual(self._cli_text(), CHANGED)
        self.assertEqual(self._audit_events(), ["proposed", "smoke_failed", "editor_saved"])
        ctx = fs_bp.get_context("default", payload={"file": CLI_URI})
        self.assertTrue(self.caps["fs.protected"]["handler"](ctx)["protected"])

    def test_a_bridge_patch_to_a_protected_file_waits(self):
        marker = "<" * 7
        patch = "\n".join([
            f"{marker} FILE: {CLI_URI}",
            f"{marker} SEARCH",
            '    print("Usage: insetu [original]")',
            "=" * 7,
            '    print("Usage: insetu [patched]")',
            ">" * 7 + " REPLACE",
        ])
        dry = json.loads(execute_bridge_sync("default", {"text": patch, "dry_run": True, "pinned_repos": ["ALL"]}))
        self.assertIn(PROTECTED_CONFIRMATION_FLAG, dry["patches"][0]["flags"], dry)
        with execution_frame(origin="agent"):
            live = json.loads(execute_bridge_sync("default", {"text": patch, "dry_run": False, "pinned_repos": ["ALL"]}))
        self.assertEqual(live["status"], "committed", live)
        [pending] = live["pending_protected_changes"]
        self.assertEqual(pending["status"], "pending_confirmation")
        self.assertEqual(self._cli_text(), ORIGINAL)
        [change] = protected_changes.list_pending()
        self.assertEqual(change["id"], pending["change_id"])
        self.assertEqual((change["proposed_by"]["origin"], change["proposed_by"]["source"]), ("agent", "bridge"))
        self.assertEqual(change["content"], cli_source("patched"))



class TestProtectedWriteChokepoint(unittest.TestCase):
    """PROTECTED_WRITE_CHOKEPOINT: only the two homes write past the guard or set the policy."""

    SNIPPET = "execute_confirmed_protected_write('default', 'x', 'y')\nset_protected_write_handler(None)\n"

    def _rules(self, rel_path):
        fake = Path(__file__).resolve().parent.parent.parent / rel_path
        prev = FitnessState.violations_found
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf):
                BackendFitnessVisitor(fake, fake.name, is_test=False).visit(ast.parse(self.SNIPPET))
        finally:
            FitnessState.violations_found = prev
        return buf.getvalue().count("PROTECTED_WRITE_CHOKEPOINT")

    def test_flagged_outside_its_homes(self):
        self.assertEqual(self._rules("insetu/extensions/demo/engine_demo.py"), 2)
        self.assertEqual(self._rules("insetu/core/attestations.py"), 1, "attestations may write past the guard, not set the policy")
        self.assertEqual(self._rules("insetu/core/protected_changes.py"), 0)


if __name__ == "__main__":
    unittest.main()
