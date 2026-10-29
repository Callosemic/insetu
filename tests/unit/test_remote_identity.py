import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from flask import Flask

import akasa
import akasa.utils as akasa_utils
from akasa.auth.peer import classify_peer, is_host_allowed, register_proxy_header
from akasa.utils import get_daemon_host_config_path, get_trusted_host_suffixes, save_json_config
from akasa.vfs import sync_vfs_barrier

import insetu.core.remote.engine_remote as remote


OWNER = "jrn@example.org"
WHOIS_OWNER_PHONE = {
    "Node": {"ComputedName": "iphone-13-mini", "Tags": None},
    "UserProfile": {"LoginName": OWNER},
}
WHOIS_OTHER_USER = {
    "Node": {"ComputedName": "guest-laptop", "Tags": None},
    "UserProfile": {"LoginName": "guest@example.org"},
}
WHOIS_TAGGED_NODE = {
    "Node": {"ComputedName": "build-server", "Tags": ["tag:server"]},
    "UserProfile": {"LoginName": "tagged-devices"},
}
STATUS_OWNED = {"Self": {"UserID": 42, "Tags": None}, "User": {"42": {"LoginName": OWNER}}}
STATUS_TAGGED_SELF = {"Self": {"UserID": 42, "Tags": ["tag:server"]}, "User": {"42": {"LoginName": OWNER}}}


class _FakeRequest:
    def __init__(self, headers=None):
        self.headers = headers or {}


class _TailscaleCliFixture:
    """Routes `tailscale whois/status --json` calls to canned payloads and counts invocations."""

    def __init__(self, whois_by_ip=None, status=STATUS_OWNED):
        self.whois_by_ip = whois_by_ip or {}
        self.status = status
        self.calls = []

    def __call__(self, args, timeout=3.0):
        self.calls.append(tuple(args))
        if args[0] == "whois":
            return self.whois_by_ip.get(args[-1])
        if args[0] == "status":
            return self.status
        return None


def _serve_peer(client_ip="100.76.11.32", login=OWNER):
    """A request as Tailscale Serve delivers it: loopback socket peer, fresh X-Forwarded-For, identity header."""
    headers = {"Host": "gookcentre.tail1234.ts.net", "X-Forwarded-For": client_ip}
    if login:
        headers["Tailscale-User-Login"] = login
    return classify_peer("127.0.0.1", headers), _FakeRequest(headers)


class TestTailscaleIdentityProvider(unittest.TestCase):
    """S1: Route B authenticates Tailscale devices only after whois verification of the trusted client IP."""

    def setUp(self):
        akasa.reset_state()
        register_proxy_header(*remote.TAILSCALE_IDENTITY_HEADERS)
        remote.reset_identity_caches()
        self.cli = _TailscaleCliFixture(whois_by_ip={
            "100.76.11.32": WHOIS_OWNER_PHONE,
            "100.99.0.7": WHOIS_OTHER_USER,
            "100.88.0.9": WHOIS_TAGGED_NODE,
        })
        self.patches = [
            patch.object(remote, "_run_tailscale_json", side_effect=self.cli),
            patch.object(remote, "_tailscale_available", return_value=True),
            patch.object(remote, "_identity_mode", return_value="whois"),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        remote.reset_identity_caches()
        akasa.reset_state()

    def _handshake(self, peer, request, config=None):
        return remote.tailscale_identity_handshake(
            request=request, peer=peer, client_ip=peer.client_ip, config=config or {}
        )

    def test_owner_device_through_serve_is_authenticated(self):
        peer, req = _serve_peer()
        res = self._handshake(peer, req)
        self.assertEqual(res, {"status": "authenticated", "method": "tailscale", "user": OWNER})

    def test_owner_is_authenticated_without_identity_header(self):
        peer, req = _serve_peer(login=None)
        self.assertEqual(self._handshake(peer, req)["user"], OWNER)

    def test_identity_header_mismatch_is_rejected(self):
        peer, req = _serve_peer(login="someone-else@example.org")
        self.assertIsNone(self._handshake(peer, req))

    def test_non_owner_requires_allowed_dev_emails(self):
        peer, req = _serve_peer(client_ip="100.99.0.7", login="guest@example.org")
        self.assertIsNone(self._handshake(peer, req))
        allowed = self._handshake(peer, req, config={"allowed_dev_emails": ["Guest@Example.org"]})
        self.assertEqual(allowed["user"], "guest@example.org")

    def test_tagged_nodes_are_always_rejected(self):
        peer, req = _serve_peer(client_ip="100.88.0.9", login=None)
        self.assertIsNone(self._handshake(peer, req, config={"allowed_dev_emails": ["tagged-devices"]}))

    def test_whois_failure_fails_closed_and_is_cached_briefly(self):
        peer, req = _serve_peer(client_ip="203.0.113.5", login=OWNER)
        self.assertIsNone(self._handshake(peer, req), "A forged header from an unknown address must not authenticate")
        self.assertIsNone(self._handshake(peer, req))
        whois_calls = [c for c in self.cli.calls if c[0] == "whois"]
        self.assertEqual(len(whois_calls), 1, "Failed lookups are cached for a few seconds")

    def test_successful_whois_is_cached(self):
        peer, req = _serve_peer()
        self._handshake(peer, req)
        self._handshake(peer, req)
        self.assertEqual(len([c for c in self.cli.calls if c[0] == "whois"]), 1)

    def test_spoofed_loopback_forwarded_for_is_not_authenticated(self):
        """An appending proxy delivering 'X-Forwarded-For: 127.0.0.1' yields a loopback client IP that whois cannot vouch for."""
        peer = classify_peer("127.0.0.1", {"Host": "gookcentre.tail1234.ts.net", "X-Forwarded-For": "127.0.0.1", "Tailscale-User-Login": OWNER})
        self.assertFalse(peer.is_direct_loopback)
        self.assertIsNone(self._handshake(peer, _FakeRequest({"Tailscale-User-Login": OWNER})))

    def test_direct_loopback_and_missing_client_ip_are_ignored(self):
        local = classify_peer("127.0.0.1", {"Host": "localhost"})
        self.assertIsNone(self._handshake(local, _FakeRequest()))
        no_ip = classify_peer("127.0.0.1", {"Host": "gookcentre.tail1234.ts.net", "Tailscale-User-Login": OWNER})
        self.assertEqual(no_ip.client_ip, "")
        self.assertIsNone(self._handshake(no_ip, _FakeRequest({"Tailscale-User-Login": OWNER})))
        self.assertEqual([c for c in self.cli.calls if c[0] == "whois"], [])

    def test_tagged_machine_has_no_owner(self):
        self.cli.status = STATUS_TAGGED_SELF
        peer, req = _serve_peer()
        self.assertIsNone(self._handshake(peer, req))
        self.assertEqual(self._handshake(peer, req, config={"allowed_dev_emails": [OWNER]})["user"], OWNER)

    def test_off_mode_disables_provider(self):
        with patch.object(remote, "_identity_mode", return_value="off"):
            peer, req = _serve_peer()
            self.assertIsNone(self._handshake(peer, req))

    def test_header_mode_only_trusts_headers_from_a_local_proxy(self):
        with patch.object(remote, "_identity_mode", return_value="header"):
            peer, req = _serve_peer(client_ip="100.99.0.7", login=OWNER)
            res = self._handshake(peer, req)
            self.assertEqual(res["method"], "tailscale_header")
            direct = classify_peer("100.99.0.7", {"Host": "gookcentre.tail1234.ts.net", "Tailscale-User-Login": OWNER})
            self.assertIsNone(self._handshake(direct, _FakeRequest({"Tailscale-User-Login": OWNER})))
            self.assertEqual([c for c in self.cli.calls if c[0] == "whois"], [])


class TestRemoteBootstrapIntegration(unittest.TestCase):
    """S1 end to end: akasa's /auth/bootstrap plus the insetu Tailscale provider and Host gate."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root_path = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root_path / ".insetu"
        (self.control_dir / "cache" / "db").mkdir(parents=True, exist_ok=True)
        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        akasa.reset_state(cwd=self.root_path.as_posix(), control_dir=".insetu")
        register_proxy_header(*remote.TAILSCALE_IDENTITY_HEADERS)
        remote.reset_identity_caches()
        (self.control_dir / "system.json").write_text(
            json.dumps({"port": 5005, "workspaces": {"default": {"config_path": "config.json"}}}), encoding="utf-8"
        )
        (self.control_dir / "config.json").write_text(
            json.dumps({"workspace_root": self.root_path.as_posix(), "extensions": ["config"]}), encoding="utf-8"
        )
        self.cli = _TailscaleCliFixture(whois_by_ip={"100.76.11.32": WHOIS_OWNER_PHONE})
        self.patches = [
            patch.object(remote, "_run_tailscale_json", side_effect=self.cli),
            patch.object(remote, "_tailscale_available", return_value=True),
        ]
        for p in self.patches:
            p.start()
        self.app = Flask(f"remote_bootstrap_{id(self)}")
        akasa.init_app(self.app, token_header="X-InSetu-Token")
        self.client = self.app.test_client()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        remote.reset_identity_caches()
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def _post(self, headers):
        return self.client.post("/auth/bootstrap", json={}, headers=headers, environ_overrides={"REMOTE_ADDR": "127.0.0.1"})

    def test_ts_net_suffix_is_registered_by_the_remote_module(self):
        self.assertIn(".ts.net", get_trusted_host_suffixes())
        self.assertTrue(is_host_allowed("gookcentre.tail1234.ts.net:9005", get_trusted_host_suffixes()))

    def test_phone_through_serve_authenticates_with_default_whois_mode(self):
        res = self._post({"Host": "gookcentre.tail1234.ts.net", "X-Forwarded-For": "100.76.11.32", "Tailscale-User-Login": OWNER})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["method"], "tailscale")
        self.assertEqual(res.get_json()["user"], OWNER)

    def test_spoofed_header_and_forged_identity_are_rejected(self):
        res = self._post({"Host": "gookcentre.tail1234.ts.net", "X-Forwarded-For": "127.0.0.1", "Tailscale-User-Login": OWNER})
        self.assertEqual(res.status_code, 401)

    def test_identity_header_alone_marks_request_proxied(self):
        res = self._post({"Host": "localhost", "Tailscale-User-Login": OWNER})
        self.assertEqual(res.status_code, 401, "A Tailscale identity header must disqualify the localhost route")

    def test_plain_localhost_still_authenticates(self):
        res = self._post({"Host": "127.0.0.1:5005"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["method"], "localhost")


class TestRemoteSettingsLifecycle(unittest.TestCase):
    """Settings migration from the retired 'tailscale' extension, configured hosts, and the preview helper."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root_path = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root_path / ".insetu"
        self.control_dir.mkdir(parents=True, exist_ok=True)
        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        akasa.reset_state(cwd=self.root_path.as_posix(), control_dir=".insetu")
        (self.control_dir / "system.json").write_text(
            json.dumps({"port": 5005, "workspaces": {"default": {"config_path": "config.json"}}}), encoding="utf-8"
        )
        (self.control_dir / "config.json").write_text(
            json.dumps({"workspace_root": self.root_path.as_posix()}), encoding="utf-8"
        )
        self.host_path = Path(get_daemon_host_config_path())

    def tearDown(self):
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def _write_host(self, data):
        save_json_config(self.host_path.as_posix(), data, workspace_id="default")
        sync_vfs_barrier("default")

    def _read_host(self):
        sync_vfs_barrier("default")
        return json.loads(self.host_path.read_text(encoding="utf-8"))

    def test_legacy_settings_migrate_once_without_overwriting(self):
        self._write_host({
            "port": 5005,
            "tailscale": {"auto_bind": False, "serve_port_mode": "custom", "custom_serve_port": 9005},
            "remote": {"serve_port_mode": "443"},
        })
        self.assertTrue(remote.migrate_legacy_tailscale_settings())
        data = self._read_host()
        self.assertEqual(data["remote"]["auto_bind"], False)
        self.assertEqual(data["remote"]["custom_serve_port"], 9005)
        self.assertEqual(data["remote"]["serve_port_mode"], "443", "Existing Remote Access values win")
        self.assertFalse(remote.migrate_legacy_tailscale_settings(), "Second run is a no-op")

    def test_migration_without_legacy_block_is_a_no_op(self):
        self._write_host({"port": 5005})
        self.assertFalse(remote.migrate_legacy_tailscale_settings())

    def test_configured_hosts_register_with_the_host_gate(self):
        self._write_host({"remote": {"allowed_hosts": "dev.example.org, tunnel.example.com ,"}})
        self.assertEqual(remote.register_configured_hosts(), ("dev.example.org", "tunnel.example.com"))
        self.assertTrue(is_host_allowed("dev.example.org", ()))
        self.assertTrue(is_host_allowed("tunnel.example.com:443", ()))

    def test_identity_mode_defaults_to_whois(self):
        self._write_host({"port": 5005})
        self.assertEqual(remote._identity_mode(), "whois")
        self._write_host({"remote": {"identity_mode": "bogus"}})
        self.assertEqual(remote._identity_mode(), "whois")
        self._write_host({"remote": {"identity_mode": "off"}})
        self.assertEqual(remote._identity_mode(), "off")

    def test_preview_helper_reports_missing_binary(self):
        with patch.object(remote, "_tailscale_available", return_value=False):
            ok, message = remote.set_tailscale_https_serve(5100, True)
        self.assertFalse(ok)
        self.assertIn("not found", message)


if __name__ == "__main__":
    unittest.main()
