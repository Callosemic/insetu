"""Unit tests for Developer Dashboard S9 error scrubbing, client error ingestion, bounded metrics previews, and extension BoundedCache resets."""
import json
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from flask import Flask

import akasa
from akasa.extension import SettingsManager
from akasa.workers import _init_worker_schema
from insetu.core.sdk import reset_kernel_state
from insetu.extensions.dev import engine_dev as _engine_dev
from insetu.extensions.dev.engine_dev import (
    dev_bp,
    log_bridge_error,
    log_system_error,
    record_dev_enabled_at_boot,
)
from insetu.extensions.git import engine_git as _engine_git
from insetu.extensions.notes import engine_notes as _engine_notes


class TestDevTelemetryAndScrubbing(unittest.TestCase):
    """Verifies S9 secret scrubbing on dev.db error tables, client_error ingestion, bounded get_dev_metrics previews, and extension BoundedCache purging."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        akasa.reset_state(cwd=str(self.root), control_dir=".insetu")
        control = self.root / ".insetu"
        control.mkdir(parents=True, exist_ok=True)
        (control / "workspaces.json").write_text(
            json.dumps({"workspaces": {"default": {"config_path": "config.json"}}}), encoding="utf-8"
        )
        (control / "config.json").write_text(
            json.dumps({"workspace_root": self.root.as_posix(), "extensions": ["dev"]}), encoding="utf-8"
        )
        _init_worker_schema("default")

    def tearDown(self):
        reset_kernel_state()
        self.temp_dir.cleanup()

    def test_bridge_and_system_errors_scrub_secrets_and_bound_metrics(self):
        """log_bridge_error, log_system_error, and POST dev/client_error scrub workspace secrets and Fernet ciphertext, and GET dev/metrics bounds large previews to 4000 chars."""
        secret_val = "sk-live-super-secret-value-987654"
        fernet_val = "v1:gAAAAABnTestCipherTokenPayload1234567890"
        test_schema = [
            {"id": "api_key", "type": "password", "scope": "workspace", "secure": True, "default": ""},
        ]
        mgr = SettingsManager("dev", "default", schema=test_schema)
        mgr.set("api_key", secret_val)
        mgr._sync_vfs_barrier()

        dev_ctx = dev_bp.get_context("default")
        # Secrets first: the 4000-character preview must not be what hides them.
        oversized_file = f"SECRET={secret_val}\nCIPHER={fernet_val}\n" + ("A" * 5000)
        oversized_patch = f"TOKEN={secret_val}\n" + ("B" * 4500)

        with patch.dict(os.environ, {"AKASA_BOOT_TOKEN": "boot-tok-secret-xyz"}):
            log_bridge_error(
                dev_ctx,
                filepath="vfs://alpha/config.py",
                error_type="AnchorMismatch",
                details=f"Failed with {secret_val} and boot-tok-secret-xyz",
                file_content=oversized_file,
                patch_payload=oversized_patch,
            )
            log_system_error(
                dev_ctx,
                source="Worker:test",
                error_type="RuntimeError",
                message=f"Crash leaking {secret_val}",
                traceback=f"Traceback: {fernet_val}",
                payload=f"{{\"key\": \"{secret_val}\"}}",
            )

            record_dev_enabled_at_boot(dev_ctx, workspace_id="default")
            app = Flask(__name__)
            app.register_blueprint(dev_bp.bp)
            client = app.test_client()

            resp = client.post(
                "/api/default/dev/client_error",
                json={
                    "source": "Browser:onerror",
                    "error_type": "TypeError",
                    "message": f"Uncaught error with {secret_val}",
                    "traceback": f"at fn (app.js:10:5) {fernet_val}",
                },
            )
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.get_json()["status"], "success")

            skip_resp = client.post("/api/default/dev/client_error", json={"message": ""})
            self.assertEqual(skip_resp.status_code, 200)
            self.assertEqual(skip_resp.get_json()["status"], "skipped")

            metrics_resp = client.get("/api/default/dev/metrics")
            self.assertEqual(metrics_resp.status_code, 200)
            metrics = metrics_resp.get_json()

        self.assertEqual(len(metrics["bridge_errors"]), 1)
        b_err = metrics["bridge_errors"][0]
        self.assertNotIn(secret_val, b_err["details"])
        self.assertNotIn("boot-tok-secret-xyz", b_err["details"])
        self.assertNotIn(secret_val, b_err["file_content"])
        self.assertNotIn(fernet_val, b_err["file_content"])
        self.assertLessEqual(len(b_err["file_content"]), 4000)
        self.assertGreater(b_err["file_content_length"], 5000)
        self.assertLessEqual(len(b_err["patch_payload"]), 4000)
        self.assertGreater(b_err["patch_payload_length"], 4500)

        self.assertEqual(len(metrics["system_errors"]), 2)
        for s_err in metrics["system_errors"]:
            self.assertNotIn(secret_val, s_err["message"])
            self.assertNotIn(fernet_val, s_err["traceback"])
            self.assertNotIn(secret_val, s_err["payload"])

    def test_extension_bounded_caches_purge_on_kernel_reset(self):
        """_DIFF_FILE_CACHE in engine_git and _SYNCED_NOTES_WORKSPACES in engine_notes are BoundedCache instances cleared by reset_kernel_state()."""
        _engine_git._DIFF_FILE_CACHE.put(("default", "/tmp/a.py"), "diff-block", revision=(1.0, 10, "M"))
        _engine_notes._SYNCED_NOTES_WORKSPACES.put("default", True)

        self.assertEqual(
            _engine_git._DIFF_FILE_CACHE.get(("default", "/tmp/a.py"), revision=(1.0, 10, "M")),
            "diff-block",
        )
        self.assertTrue(_engine_notes._SYNCED_NOTES_WORKSPACES.get("default"))

        reset_kernel_state()

        self.assertIsNone(
            _engine_git._DIFF_FILE_CACHE.get(("default", "/tmp/a.py"), revision=(1.0, 10, "M"))
        )
        self.assertIsNone(_engine_notes._SYNCED_NOTES_WORKSPACES.get("default"))


class TestDevModeGate(unittest.TestCase):
    """Dev routes switch on only with a restart: enabling dev in config at runtime does not open them."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        akasa.reset_state(cwd=str(self.root), control_dir=".insetu")
        control = self.root / ".insetu"
        control.mkdir(parents=True, exist_ok=True)
        (control / "workspaces.json").write_text(
            json.dumps({"workspaces": {"default": {"config_path": "config.json"}}}), encoding="utf-8"
        )
        (control / "config.json").write_text(
            json.dumps({"workspace_root": self.root.as_posix(), "extensions": ["dev"]}), encoding="utf-8"
        )
        _init_worker_schema("default")
        _engine_dev._DEV_ENABLED_AT_BOOT.discard("default")

    def tearDown(self):
        _engine_dev._DEV_ENABLED_AT_BOOT.discard("default")
        reset_kernel_state()
        self.temp_dir.cleanup()

    def test_dev_routes_stay_off_until_enabled_at_boot(self):
        app = Flask(__name__)
        app.register_blueprint(dev_bp.bp)
        client = app.test_client()

        # Enabled in config, but not at boot: the routes stay closed.
        self.assertEqual(client.get("/api/default/dev/metrics").status_code, 403)
        self.assertEqual(client.post("/api/default/dev/exec", json={"command": "true"}).status_code, 403)

        record_dev_enabled_at_boot(dev_bp.get_context("default"), workspace_id="default")
        self.assertEqual(client.get("/api/default/dev/metrics").status_code, 200)


if __name__ == "__main__":
    unittest.main()
