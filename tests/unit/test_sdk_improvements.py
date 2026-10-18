import json
import os
import tempfile
import time
import unittest
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch
import akasa.db as akasa_db
import akasa.utils as akasa_utils
from akasa.db import get_connection
from akasa.extension import ExtensionContext
from akasa.utils import load_config
from akasa.workers import _execute_job, _execute_immediate_job, _init_worker_schema, register_callback
from insetu.core.sdk import InSetuExtension
from insetu.core.utils_core import parse_frontmatter


def _reset_db_connections():
    for attr in dir(akasa_db):
        obj = getattr(akasa_db, attr)
        if hasattr(obj, "connections") and isinstance(obj.connections, dict):
            for c in list(obj.connections.values()):
                try: c.close()
                except Exception: pass
            obj.connections.clear()
        elif isinstance(obj, dict) and "conn" in attr.lower():
            for c in list(obj.values()):
                try: c.close()
                except Exception: pass
            obj.clear()


class TestSdkImprovements(unittest.TestCase):
    def setUp(self):
        _reset_db_connections()
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root_path = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root_path / ".insetu"
        (self.control_dir / "cache" / "db").mkdir(parents=True, exist_ok=True)

        self.orig_cwd = akasa_utils._cwd
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        os.environ["AKASA_CONTROL_DIR"] = ".insetu"
        akasa_utils._cwd = self.root_path.as_posix()

        akasa_utils._JSON_CACHE.clear()
        akasa_utils._JSON_MTIME.clear()
        load_config.clear_all()
        self.workspace_id = f"ws_{uuid.uuid4().hex[:8]}"
        (self.control_dir / "system.json").write_text(
            json.dumps({
                "port": 5005,
                "workspaces": {
                    "default": {"config_path": "config.json"},
                    self.workspace_id: {"config_path": (self.control_dir / "config.json").as_posix()},
                },
            }),
            encoding="utf-8",
        )
        (self.control_dir / "config.json").write_text(
            json.dumps({"workspace_root": self.root_path.as_posix(), "target_repos": []}),
            encoding="utf-8",
        )

        _init_worker_schema(self.workspace_id)

    def tearDown(self):
        _reset_db_connections()
        akasa_utils._cwd = self.orig_cwd
        if self.orig_env_ctrl is not None:
            os.environ["AKASA_CONTROL_DIR"] = self.orig_env_ctrl
        akasa_utils._JSON_CACHE.clear()
        akasa_utils._JSON_MTIME.clear()
        load_config.clear_all()
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def test_create_entity_file_contract(self):
        """ctx.create_entity_file formats YAML frontmatter, slugifies, and saves to VFS."""
        ctx = ExtensionContext("notes", self.workspace_id)
        mock_vfs_save = MagicMock()
        ctx.vfs.save = mock_vfs_save
        logical_path, meta = ctx.create_entity_file(
            folder="ctx://notes",
            title="Sprint Architecture Review!",
            yaml_data={"status": "draft", "tags": ["arch", "core"]},
            body_content="## Description\nInitial architectural review notes.",
            prefix="not"
        )

        # 1. Path & Slug Verification
        self.assertTrue(logical_path.startswith("ctx://notes/sprint_architecture_review-not-"))
        self.assertTrue(logical_path.endswith(".md"))

        # 2. Metadata Verification
        self.assertEqual(meta["title"], "Sprint Architecture Review!")
        self.assertEqual(meta["status"], "draft")
        self.assertEqual(meta["tags"], ["arch", "core"])
        self.assertIn("created_at", meta)
        self.assertIn("updated_at", meta)

        # 3. VFS Write Payload Verification
        mock_vfs_save.assert_called_once()
        saved_path, saved_content = mock_vfs_save.call_args[0]
        self.assertEqual(saved_path, logical_path)
        parsed_yaml, body, _ = parse_frontmatter(saved_content)
        self.assertEqual(parsed_yaml["title"], "Sprint Architecture Review!")
        self.assertEqual(parsed_yaml["status"], "draft")
        self.assertTrue(body.startswith("## Description"))
        self.assertIn("Initial architectural review notes.", body)
    @patch("akasa.workers.is_extension_enabled")
    def test_worker_drops_recurring_job_for_disabled_extension(self, mock_is_enabled):
        """_execute_job drops and deletes pending recurring jobs if extension is disabled."""
        mock_is_enabled.return_value = False
        executed = False

        def sample_callback(**kwargs):
            nonlocal executed
            executed = True

        register_callback("custom_ext", "sample_task", sample_callback)

        _init_worker_schema(self.workspace_id)
        conn = get_connection("workers", workspace_id=self.workspace_id)
        conn.execute(
            "INSERT OR REPLACE INTO jobs (id, ext_name, callback_name, interval_ms, status) VALUES (?, ?, ?, ?, 'running')",
            ("job_recurring_123", "custom_ext", "sample_task", 60000)
        )
        conn.commit()
        _execute_job(
            job_id="job_recurring_123",
            ext_name="custom_ext",
            callback_name="sample_task",
            interval_ms=60000,
            jitter_ms=0,
            args_json="{}",
            fallback_ws=self.workspace_id
        )

        self.assertFalse(executed, "Callback must not execute for disabled extensions.")
        fresh_conn = get_connection("workers", workspace_id=self.workspace_id)
        row = fresh_conn.execute("SELECT id FROM jobs WHERE id=?", ("job_recurring_123",)).fetchone()
        self.assertIsNone(row, "Job record must be purged from jobs table.")

    @patch("akasa.workers.is_extension_enabled")
    def test_immediate_job_fails_safely_for_disabled_extension(self, mock_is_enabled):
        """_execute_immediate_job logs failure without executing callback if extension is disabled."""
        mock_is_enabled.return_value = False
        executed = False

        def immediate_callback(**kwargs):
            nonlocal executed
            executed = True

        register_callback("disabled_ext", "immediate_task", immediate_callback)
        conn = get_connection("workers", workspace_id=self.workspace_id)
        now = time.time()
        conn.execute(
            "INSERT OR REPLACE INTO immediate_jobs (id, ext_name, callback_name, status, created_at, updated_at) VALUES (?, ?, ?, 'processing', ?, ?)",
            ("imm_456", "disabled_ext", "immediate_task", now, now)
        )
        conn.commit()

        _execute_immediate_job(
            job_id="imm_456",
            ext_name="disabled_ext",
            callback_name="immediate_task",
            args_json="{}",
            target_ws=self.workspace_id
        )

        self.assertFalse(executed, "Immediate callback must not execute for disabled extensions.")
        # Re-acquire connection because worker execution manages and closes its own DB handle
        fresh_conn = get_connection("workers", workspace_id=self.workspace_id)
        row = fresh_conn.execute("SELECT status, status_message FROM immediate_jobs WHERE id=?", ("imm_456",)).fetchone()
        self.assertEqual(row["status"], "failed")
        self.assertIn("disabled", row["status_message"].lower())


if __name__ == "__main__":
    unittest.main()