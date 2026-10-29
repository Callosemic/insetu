"""S8: the lifeboat shares the app's durable token, checks Host, and keeps reads and writes inside the workspace."""
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import insetu.fallback_bridge as lifeboat


class _LifeboatCase(unittest.TestCase):
    """A throwaway daemon directory with one repository, a secret outside the workspace and a symlink pointing at it."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        base = Path(self.temp_dir.name).resolve()
        self.root = base / "workspace"
        self.outside = base / "outside"
        (self.root / ".insetu").mkdir(parents=True)
        (self.root / "alpha").mkdir()
        self.outside.mkdir()
        (self.root / "alpha" / "notes.txt").write_text("inside\n", encoding="utf-8")
        (self.outside / "secret.txt").write_text("outside\n", encoding="utf-8")
        os.symlink(self.outside, self.root / "alpha" / "escape")
        (self.root / ".insetu" / "workspaces.json").write_text(
            json.dumps({"workspaces": {"default": {"config_path": "config.json"}}, "active_workspace": "default"}),
            encoding="utf-8",
        )
        (self.root / ".insetu" / "config.json").write_text(
            json.dumps({"workspace_root": self.root.as_posix(), "target_repos": [{"repo_dir": "alpha"}]}),
            encoding="utf-8",
        )
        (self.root / ".insetu" / "host.json").write_text(
            json.dumps({"port": 5005, "remote": {"allowed_hosts": "box.example.org"}}), encoding="utf-8"
        )
        self.orig_cwd = os.getcwd()
        os.chdir(self.root)
        self.env_patch = patch.dict(os.environ, {}, clear=False)
        self.env_patch.start()
        os.environ.pop("AKASA_BOOT_TOKEN", None)
        lifeboat._LIFEBOAT_TOKEN = None
        self.client = lifeboat.app.test_client()

    def tearDown(self):
        lifeboat._LIFEBOAT_TOKEN = None
        self.env_patch.stop()
        os.chdir(self.orig_cwd)
        self.temp_dir.cleanup()

    def _get(self, url, host="localhost", token=True):
        headers = {"Host": host}
        if token:
            headers["X-InSetu-Token"] = lifeboat.current_token()
        return self.client.get(url, headers=headers)


class TestLifeboatCredentials(_LifeboatCase):
    """The lifeboat accepts the app's durable session token, so a signed-in phone keeps working after a crash."""

    def test_uses_the_session_token_the_app_wrote(self):
        token_file = self.root / ".insetu" / "auth" / "session_token"
        token_file.parent.mkdir()
        token_file.write_text("durable-app-token\n", encoding="utf-8")
        self.assertEqual(lifeboat.current_token(), "durable-app-token")
        self.assertEqual(self._get("/api/fs/list").status_code, 200)

    def test_creates_the_shared_token_when_none_exists(self):
        if lifeboat._credentials_module() is None:
            self.skipTest("akasa/auth/credentials.py is not available (released akasa older than the credential store)")
        token = lifeboat.current_token()
        self.assertEqual((self.root / ".insetu" / "auth" / "session_token").read_text(encoding="utf-8").strip(), token)

    def test_without_the_credential_store_it_reads_the_token_file_directly(self):
        token_file = self.root / ".insetu" / "auth" / "session_token"
        token_file.parent.mkdir()
        token_file.write_text("written-by-the-app\n", encoding="utf-8")
        with patch.object(lifeboat, "_credentials_module", return_value=None):
            self.assertEqual(lifeboat.current_token(), "written-by-the-app")

    def test_last_resort_mints_a_lifeboat_only_token(self):
        with patch.object(lifeboat, "_credentials_module", return_value=None):
            token = lifeboat.current_token()
        self.assertEqual((self.root / ".insetu" / "lifeboat_token").read_text(encoding="utf-8").strip(), token)
        self.assertFalse((self.root / ".insetu" / "auth" / "session_token").exists())
        self.assertEqual(self._get("/api/fs/list").status_code, 200)

    def test_refuses_missing_and_wrong_tokens(self):
        self.assertEqual(self._get("/api/fs/list", token=False).status_code, 401)
        resp = self.client.get("/api/fs/list", headers={"Host": "localhost", "X-InSetu-Token": "wrong"})
        self.assertEqual(resp.status_code, 401)

    def test_query_token_only_works_for_downloads(self):
        token = lifeboat.current_token()
        self.assertEqual(self.client.get(f"/download/alpha/notes.txt?token={token}", headers={"Host": "localhost"}).status_code, 200)
        self.assertEqual(self.client.get(f"/api/fs/list?token={token}", headers={"Host": "localhost"}).status_code, 401)


class TestLifeboatHostCheck(_LifeboatCase):
    """DNS-rebinding guard: loopback, *.ts.net and configured hosts only."""

    def test_allowed_and_refused_hosts(self):
        for host, status in (
            ("localhost:5005", 200),
            ("127.0.0.1", 200),
            ("laptop.tail1234.ts.net", 200),
            ("box.example.org", 200),
            ("evil.example.com", 421),
            ("ts.net", 421),
            ("attacker-ts.net", 421),
        ):
            with self.subTest(host=host):
                self.assertEqual(self._get("/api/fs/list", host=host).status_code, status)

    def test_public_pages_still_check_host(self):
        self.assertEqual(self.client.get("/recovery", headers={"Host": "evil.example.com"}).status_code, 421)


class TestLifeboatReadContainment(_LifeboatCase):
    """/download and /api/fs/list stay inside the workspace, follow symlinks, and never expose the credential store."""

    def test_download_inside_the_workspace(self):
        resp = self._get("/download/alpha/notes.txt")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, b"inside\n")

    def test_download_refuses_paths_outside_the_workspace(self):
        for url in (
            "/download/" + (self.outside / "secret.txt").as_posix().lstrip("/"),
            "/download/../outside/secret.txt",
            "/download/alpha/escape/secret.txt",
        ):
            with self.subTest(url=url):
                resp = self._get(url)
                self.assertNotEqual(resp.status_code, 200)
                self.assertNotEqual(resp.data, b"outside\n")

    def test_download_refuses_the_credential_store(self):
        lifeboat.current_token()
        self.assertEqual(self._get("/download/.insetu/auth/session_token").status_code, 403)

    def test_listing_refuses_paths_outside_the_workspace(self):
        self.assertEqual(self._get("/api/fs/list?dir=..").status_code, 403)
        self.assertEqual(self._get("/api/fs/list?dir=" + self.outside.as_posix()).status_code, 403)
        self.assertEqual(self._get("/api/fs/list?dir=alpha/escape").status_code, 403)
        listing = self._get("/api/fs/list?dir=alpha").get_json()
        self.assertIn("notes.txt", listing["files"])

    def test_patches_cannot_write_through_a_symlink_or_into_the_credential_store(self):
        lifeboat.current_token()
        for header in ("vfs://alpha/escape/planted.py", ".insetu/auth/session_token"):
            with self.subTest(header=header):
                text = f"<<<<<<< FILE: {header}\n<<<<<<< SEARCH\n\n=======\nPWNED = True\n>>>>>>> REPLACE"
                log = self.client.post(
                    "/api/bridge/sync", json={"text": text},
                    headers={"Host": "localhost", "X-InSetu-Token": lifeboat.current_token()},
                ).get_data(as_text=True)
                self.assertNotIn("Successfully patched", log)
        self.assertFalse((self.outside / "planted.py").exists())
        stored = self.root / ".insetu" / "auth" / "session_token"
        self.assertTrue(not stored.exists() or "PWNED" not in stored.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
