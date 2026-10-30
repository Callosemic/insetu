"""S2: preview servers bind loopback, open to the LAN only on a person's lease, and run custom commands only once approved."""
import json
import os
import socket
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch

import akasa
import akasa.utils as akasa_utils
from akasa.vfs import mount_volume
from insetu.core.agent import orchestrator
from insetu.core.sdk import get_registered_capabilities
from insetu.core.utils_core import approve_command, is_command_approved
from insetu.extensions.preview import engine_preview
from insetu.extensions.preview.engine_preview import (
    PreviewApprovalRequired,
    _build_launch_command,
    _get_repo_status_snapshot,
    auto_boot_pinned_preview_servers,
    cleanup_all_preview_servers,
    preview_bp,
    start_repo_server,
)

HUMAN_ONLY_CAPABILITIES = ("preview.open_lan", "preview.approve_command")


class _PreviewCase(unittest.TestCase):
    """A throwaway workspace with one static repository mounted as 'demo_app'."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.ws_root = Path(self.temp_dir.name).resolve() / "workspace"
        control_dir = self.ws_root / ".insetu"
        self.repo_path = self.ws_root / "demo_app"
        control_dir.mkdir(parents=True)
        self.repo_path.mkdir()
        (self.repo_path / "index.html").write_text("<h1>ok</h1>", encoding="utf-8")
        config = {
            "workspace_root": self.ws_root.as_posix(),
            "extensions": ["config", "preview"],
            "target_repos": [{"repo_dir": "demo_app", "title": "Demo", "domain": "Workspaces", "exts": [".html"]}],
        }
        config_file = control_dir / "config.json"
        config_file.write_text(json.dumps(config), encoding="utf-8")
        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.env_patch = patch.dict(os.environ, {"AKASA_CONFIG": config_file.as_posix()})
        self.env_patch.start()
        akasa.reset_state(cwd=self.ws_root.as_posix(), control_dir=".insetu")
        mount_volume("default", "vfs", "", self.ws_root.as_posix())
        mount_volume("default", "vfs", "demo_app", self.repo_path.as_posix())
        self.ctx = preview_bp.get_context("default")

    def tearDown(self):
        cleanup_all_preview_servers()
        self.env_patch.stop()
        akasa.reset_state(cwd=self.orig_cwd, control_dir=".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def _fetch(self, port, path):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=3) as resp:
                return resp.status, resp.read(), resp.headers
        except urllib.error.HTTPError as e:
            return e.code, e.read(), e.headers


class TestLoopbackByDefault(_PreviewCase):
    """Nothing binds beyond loopback unless a person opens it, and auto-start never does."""

    def test_default_bind_is_loopback(self):
        snap = start_repo_server(self.ctx, "demo_app")
        self.assertEqual(snap["effective_bind_host"], "127.0.0.1")
        self.assertEqual(snap["exposure"], "loopback")
        self.assertFalse(snap["lan_allowed"])

    def test_a_lan_setting_alone_does_not_bind_the_lan(self):
        snap = start_repo_server(self.ctx, "demo_app", overrides={"bind_host": "0.0.0.0"})
        self.assertTrue(snap["lan_allowed"])
        self.assertEqual(snap["effective_bind_host"], "127.0.0.1")

    def test_auto_start_stays_on_loopback(self):
        self.ctx.settings.update({"auto_start": True, "bind_host": "0.0.0.0"}, repo="demo_app")
        auto_boot_pinned_preview_servers(workspace_id="default")
        snap = _get_repo_status_snapshot(self.ctx, "demo_app")
        self.assertEqual(snap["status"], "running")
        self.assertEqual(snap["effective_bind_host"], "127.0.0.1")

    def test_rejects_unlisted_bind_hosts_and_modes(self):
        for overrides in ({"bind_host": "192.168.1.5"}, {"bind_host": "::"}, {"server_mode": "shell"}):
            with self.subTest(overrides=overrides), self.assertRaises(ValueError):
                start_repo_server(self.ctx, "demo_app", overrides=overrides)


class TestLanLease(_PreviewCase):
    """A LAN lease needs the repository's permission, and a timed lease falls back to loopback by itself."""

    def test_lease_refused_while_the_repo_is_loopback_only(self):
        with self.assertRaises(ValueError):
            start_repo_server(self.ctx, "demo_app", lan_lease="run")

    def test_lease_rejects_unknown_durations(self):
        self.ctx.settings.update({"bind_host": "0.0.0.0"}, repo="demo_app")
        with self.assertRaises(ValueError):
            start_repo_server(self.ctx, "demo_app", lan_lease="forever")

    def test_run_lease_binds_the_lan_until_restart(self):
        self.ctx.settings.update({"bind_host": "0.0.0.0"}, repo="demo_app")
        snap = start_repo_server(self.ctx, "demo_app", lan_lease="run")
        self.assertEqual(snap["effective_bind_host"], "0.0.0.0")
        self.assertEqual(snap["exposure"], "lan")
        self.assertIsNone(snap["lan_lease_until"])
        snap = start_repo_server(self.ctx, "demo_app")
        self.assertEqual(snap["exposure"], "loopback", "A plain restart ends the lease.")

    def test_timed_lease_expires_back_to_loopback(self):
        self.ctx.settings.update({"bind_host": "0.0.0.0"}, repo="demo_app")
        with patch.dict(engine_preview.LAN_LEASE_DURATIONS, {"test": 1}):
            snap = start_repo_server(self.ctx, "demo_app", lan_lease="test")
            self.assertEqual(snap["exposure"], "lan")
            self.assertIsNotNone(snap["lan_lease_until"])
            deadline = time.time() + 8
            while time.time() < deadline:
                snap = _get_repo_status_snapshot(self.ctx, "demo_app")
                # The expiry note is added just after the loopback restart registers, so wait for both.
                if snap["status"] == "running" and snap["exposure"] == "loopback" and any("expired" in line for line in snap["logs"]):
                    break
                time.sleep(0.2)
        self.assertEqual(snap["status"], "running")
        self.assertEqual(snap["effective_bind_host"], "127.0.0.1")
        self.assertTrue(any("expired" in line for line in snap["logs"]))


class TestCustomCommandApproval(_PreviewCase):
    """Custom commands run only after a person approves that exact command for that repository."""

    def test_custom_command_waits_for_approval(self):
        cmd = "python3 -m http.server {port} --bind {host}"
        with self.assertRaises(PreviewApprovalRequired) as caught:
            start_repo_server(self.ctx, "demo_app", overrides={"server_mode": "custom", "entry_target": cmd})
        self.assertEqual(caught.exception.command, cmd)
        self.assertFalse(is_command_approved("default", "preview", "demo_app", cmd), "Refusing must not approve.")
        approve_command("default", "preview", "demo_app", cmd)
        snap = start_repo_server(self.ctx, "demo_app")
        self.assertIn(snap["status"], ("running", "crashed"))

    def test_preview_and_test_approvals_are_separate(self):
        approve_command("default", "test", "demo_app", "make serve")
        self.assertFalse(is_command_approved("default", "preview", "demo_app", "make serve"))

    def test_refusal_tells_the_ui_what_to_approve(self):
        with self.assertRaises(PreviewApprovalRequired) as caught:
            start_repo_server(self.ctx, "demo_app", overrides={"server_mode": "custom", "entry_target": "make serve"})
        body, status = engine_preview._approval_required_response(caught.exception)
        self.assertEqual(status, 403)
        self.assertEqual((body["status"], body["repo"], body["command"]), ("needs_approval", "demo_app", "make serve"))

    def test_approval_and_lan_routes_are_human_only(self):
        caps = get_registered_capabilities()
        for name in HUMAN_ONLY_CAPABILITIES:
            with self.subTest(capability=name):
                self.assertIsNotNone(caps.get(name), f"{name} is not registered")
                self.assertIs(caps[name].get("mcp_expose"), False)
                self.assertIn(name, orchestrator.ROUTINE_BANNED_CAPABILITIES)


class TestServerHardening(_PreviewCase):
    """The static server hides dotfiles and symlink escapes, sends CORS only on request, and marimo always has a token."""

    def setUp(self):
        super().setUp()
        (self.repo_path / ".git").mkdir()
        (self.repo_path / ".git" / "config").write_text("[core]\n", encoding="utf-8")
        (self.repo_path / ".env").write_text("SECRET=1\n", encoding="utf-8")
        outside = self.ws_root.parent / "outside"
        outside.mkdir()
        (outside / "secret.txt").write_text("outside\n", encoding="utf-8")
        os.symlink(outside, self.repo_path / "escape")

    def test_static_server_refuses_dotfiles_and_escapes(self):
        port = start_repo_server(self.ctx, "demo_app")["port"]
        for path in ("/.git/config", "/.env", "/%2Egit/config", "/escape/secret.txt"):
            with self.subTest(path=path):
                status, body, _ = self._fetch(port, path)
                self.assertEqual(status, 404)
                self.assertNotIn(b"outside", body)
                self.assertNotIn(b"SECRET", body)
        status, body, headers = self._fetch(port, "/")
        self.assertEqual(status, 200)
        self.assertNotIn(b".git", body)
        self.assertNotIn(b".env", body)
        self.assertIsNone(headers.get("Access-Control-Allow-Origin"))

    def test_static_cors_is_opt_in(self):
        port = start_repo_server(self.ctx, "demo_app", overrides={"static_cors": True})["port"]
        _, _, headers = self._fetch(port, "/index.html")
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), "*")

    def test_marimo_always_runs_with_a_token(self):
        cmd, _, _ = _build_launch_command(
            self.ctx, "demo_app", self.repo_path.as_posix(), "marimo", ".", 5199, "127.0.0.1", "nb.py", access_token="tok123"
        )
        self.assertNotIn("--no-token", cmd)
        self.assertEqual(cmd[cmd.index("--token-password") + 1], "tok123")


if __name__ == "__main__":
    unittest.main()
