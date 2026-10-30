import json
import os
import socket
import tempfile
import time
import unittest
import urllib.request
from pathlib import Path
import akasa
import akasa.utils as akasa_utils
from akasa.hooks import hooks
from akasa.vfs import mount_volume
from insetu.core.utils_core import approve_command
from insetu.extensions.preview.engine_preview import (
    preview_bp,
    _detect_repo_mode,
    _get_repo_status_snapshot,
    start_repo_server,
    stop_repo_server,
    cleanup_all_preview_servers,
    auto_boot_pinned_preview_servers,
)


class TestExtPreviewUnit(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.ws_root = Path(self.temp_dir.name).resolve() / "workspace"
        self.control_dir = self.ws_root / ".insetu"
        self.repo_path = self.ws_root / "demo_app"
        self.control_dir.mkdir(parents=True, exist_ok=True)
        self.repo_path.mkdir(parents=True, exist_ok=True)

        config_data = {
            "workspace_root": self.ws_root.as_posix(),
            "extensions": ["config", "preview"],
            "target_repos": [
                {
                    "repo_dir": "demo_app",
                    "title": "Demo App",
                    "domain": "Workspaces",
                    "exts": [".py", ".html", ".js", ".css", ".yml", ".json"],
                }
            ],
        }
        self.config_file = self.control_dir / "config.json"
        self.config_file.write_text(json.dumps(config_data), encoding="utf-8")
        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.orig_akasa_config = os.environ.get("AKASA_CONFIG")
        os.environ["AKASA_CONFIG"] = self.config_file.as_posix()
        akasa.reset_state(cwd=self.ws_root.as_posix(), control_dir=".insetu")

        mount_volume("default", "vfs", "", self.ws_root.as_posix())
        mount_volume("default", "vfs", "demo_app", self.repo_path.as_posix())
        self.ctx = preview_bp.get_context("default")

    def tearDown(self):
        cleanup_all_preview_servers()
        if self.orig_akasa_config is None:
            os.environ.pop("AKASA_CONFIG", None)
        else:
            os.environ["AKASA_CONFIG"] = self.orig_akasa_config
        akasa.reset_state(cwd=self.orig_cwd, control_dir=".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass
    def test_passive_mode_detection(self):
        (self.repo_path / "index.html").write_text("<h1>Hello</h1>", encoding="utf-8")
        mode, target = _detect_repo_mode(self.ctx, "demo_app", self.repo_path.as_posix())
        self.assertEqual(mode, "static")
        self.assertEqual(target, "")

        (self.repo_path / "main.py").write_text("from fastapi import FastAPI\napp = FastAPI()\n", encoding="utf-8")
        mode, target = _detect_repo_mode(self.ctx, "demo_app", self.repo_path.as_posix())
        self.assertEqual(mode, "uvicorn")
        self.assertEqual(target, "main:app")
        (self.repo_path / "main.py").unlink()

        (self.repo_path / "app.py").write_text("from flask import Flask\napp = Flask(__name__)\n", encoding="utf-8")
        mode, target = _detect_repo_mode(self.ctx, "demo_app", self.repo_path.as_posix())
        self.assertEqual(mode, "flask")
        self.assertEqual(target, "app")
        (self.repo_path / "app.py").unlink()

        (self.repo_path / "app.py").write_text("import streamlit as st\nst.title('Demo')\n", encoding="utf-8")
        mode, target = _detect_repo_mode(self.ctx, "demo_app", self.repo_path.as_posix())
        self.assertEqual(mode, "streamlit")
        self.assertEqual(target, "app.py")
        (self.repo_path / "app.py").unlink()

        (self.repo_path / "vite.config.js").write_text("export default {}\n", encoding="utf-8")
        mode, target = _detect_repo_mode(self.ctx, "demo_app", self.repo_path.as_posix())
        self.assertEqual(mode, "vite")
        (self.repo_path / "vite.config.js").unlink()

    def test_static_server_lifecycle_and_headers(self):
        (self.repo_path / "index.html").write_text("<!DOCTYPE html><title>InSetu Test</title>", encoding="utf-8")
        snapshot = start_repo_server(self.ctx, "demo_app", overrides={"bind_host": "127.0.0.1"})
        self.assertEqual(snapshot["status"], "running")
        self.assertGreaterEqual(snapshot["port"], 5100)
        self.assertFalse(snapshot["auto_start"])

        persisted_port = self.ctx.settings.get("port", repo="demo_app")
        self.assertEqual(int(persisted_port), snapshot["port"])

        url = f"http://127.0.0.1:{snapshot['port']}/index.html"
        with urllib.request.urlopen(url, timeout=3) as resp:
            body = resp.read().decode("utf-8")
            self.assertIn("InSetu Test", body)
            self.assertIsNone(resp.headers.get("Access-Control-Allow-Origin"), "CORS is off unless static_cors is set (S2).")
            self.assertIn("no-store", resp.headers.get("Cache-Control") or "")

        stopped = stop_repo_server(self.ctx, "demo_app")
        self.assertEqual(stopped["status"], "stopped")

    def test_startup_crash_probe_captures_logs(self):
        crash_cmd = "python3 -c \"import sys; print('FATAL_BOOT_CRASH_MARKER', flush=True); sys.exit(1)\""
        approve_command("default", "preview", "demo_app", crash_cmd)
        snapshot = start_repo_server(
            self.ctx,
            "demo_app",
            overrides={"server_mode": "custom", "entry_target": crash_cmd, "bind_host": "127.0.0.1"},
        )
        self.assertEqual(snapshot["status"], "crashed")
        self.assertTrue(any("FATAL_BOOT_CRASH_MARKER" in line for line in snapshot["logs"]))

    def test_external_port_adoption(self):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as ext_sock:
            ext_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            ext_sock.bind(("127.0.0.1", 0))
            ext_sock.listen(1)
            bound_port = ext_sock.getsockname()[1]

            snapshot = start_repo_server(
                self.ctx,
                "demo_app",
                overrides={"port": bound_port, "bind_host": "127.0.0.1"},
            )
            self.assertEqual(snapshot["status"], "external")
            self.assertEqual(snapshot["port"], bound_port)

    def test_workspace_shutdown_and_auto_start(self):
        (self.repo_path / "index.html").write_text("<h1>Auto Boot</h1>", encoding="utf-8")
        self.ctx.settings.update({"auto_start": False, "bind_host": "127.0.0.1"}, repo="demo_app")
        auto_boot_pinned_preview_servers(workspace_id="default")
        self.assertEqual(_get_repo_status_snapshot(self.ctx, "demo_app")["status"], "stopped")

        self.ctx.settings.update({"auto_start": True, "bind_host": "127.0.0.1"}, repo="demo_app")
        auto_boot_pinned_preview_servers(workspace_id="default")
        running_snap = _get_repo_status_snapshot(self.ctx, "demo_app")
        self.assertEqual(running_snap["status"], "running")

        hooks.emit("workspace_shutdown", workspace_id="default")
        time.sleep(0.2)
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            self.assertNotEqual(s.connect_ex(("127.0.0.1", running_snap["port"])), 0)


if __name__ == "__main__":
    unittest.main()