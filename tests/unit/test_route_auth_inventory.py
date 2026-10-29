"""V4: every HTTP route needs the token unless it is on a reviewed public list, in the app and in the lifeboat."""
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

PROBE = Path(__file__).resolve().parent / "route_auth_probe.py"
STATE_CHANGING = {"POST", "PUT", "PATCH", "DELETE"}

# Every route either method may reach without a token, and why. Adding to this list is a security review.
APP_PUBLIC_ROUTES = {
    ("/", "GET"): "SPA shell; renders no workspace data, and the client fetches the token after load.",
    ("/manifest.json", "GET"): "PWA manifest; instance title and icons only.",
    ("/sw.js", "GET"): "Service worker script; static.",
    ("/favicon.ico", "GET"): "Icon; static.",
    ("/recovery", "GET"): "Zero-JS escape page; static HTML. Its panic button sends the stored token.",
    ("/auth/bootstrap", "POST"): "Issues the token; S1's peer checks (localhost, Tailscale identity, static token) decide.",
    ("/api/system/openapi.json", "GET"): "Route catalog for MCP and the SDK; describes routes, holds no data.",
    ("/api/system/llm_catalog.json", "GET"): "Public model and pricing catalog, CORS-enabled by design.",
    ("/static/<path:filename>", "GET"): "Bundled static assets.",
    ("/static/extensions/<ext_name>/<path:filename>", "GET"): "Extension assets, confined to the extension's folder.",
    ("/static/js/extensions/ext_<ext_name>.js", "GET"): "Extension frontend bundles.",
}
LIFEBOAT_PUBLIC_ROUTES = {
    ("/", "GET"): "Redirects to /recovery.",
    ("/recovery", "GET"): "Recovery page; static HTML. Every action on it sends the token.",
    ("/auth/bootstrap", "GET"): "Tells reboot polling loops the server is in recovery mode; issues nothing.",
    ("/auth/bootstrap", "POST"): "Same as GET, for clients that poll with POST.",
    ("/static/<path:filename>", "GET"): "Bundled static assets.",
}
STATE_CHANGING_EXEMPT = {("/auth/bootstrap", "POST")}


def _run_probe(mode):
    out = Path(tempfile.mkdtemp(prefix="route_probe_out_")) / f"{mode}.json"
    env = dict(os.environ, PYTHONPATH=os.pathsep.join(p for p in sys.path if p))
    proc = subprocess.run(
        [sys.executable, PROBE.as_posix(), mode, out.as_posix()],
        capture_output=True, text=True, timeout=300, env=env,
    )
    if proc.returncode != 0 or not out.exists():
        raise RuntimeError(f"route probe ({mode}) failed with exit {proc.returncode}:\n{proc.stdout[-4000:]}\n{proc.stderr[-4000:]}")
    return json.loads(out.read_text(encoding="utf-8"))


class _InventoryCase(unittest.TestCase):
    """Shared assertions over one probe report per mode."""
    mode = None
    public = {}
    report = None

    @classmethod
    def setUpClass(cls):
        cls.report = _run_probe(cls.mode)

    def _open(self):
        return {(e["rule"], m) for e in self.report["rules"] for m in e["open"]}

    def _registered(self):
        return {(e["rule"], m) for e in self.report["rules"] for m in e["methods"]}

    def assert_inventory(self):
        opened, registered = self._open(), self._registered()
        unexpected = sorted(opened - set(self.public))
        stale = sorted(k for k in self.public if k not in registered)
        closed = sorted(k for k in self.public if k in registered and k not in opened)
        self.assertEqual(unexpected, [], f"Routes answer without a token but are not on the {self.mode} public list: {unexpected}")
        self.assertEqual(stale, [], f"Public-list entries match no registered route: {stale}")
        self.assertEqual(closed, [], f"Listed as public but require a token (remove them from the list): {closed}")

    def assert_no_bypass(self):
        bypasses = [(e["rule"], b["method"], b["variant"], b["url"]) for e in self.report["rules"] for b in e["bypasses"]]
        self.assertEqual(bypasses, [], f"Protected routes reached without a valid token: {bypasses}")

    def assert_token_reaches_everything(self):
        self.assertTrue(self.report["has_token"], f"The {self.mode} exposes no token to authenticate with.")
        failed = [(e["rule"], f["method"], f["status"]) for e in self.report["rules"] for f in e["control_failed"]]
        self.assertEqual(failed, [], f"A valid token did not reach these routes, so their probes prove nothing: {failed}")

    def assert_public_routes_are_read_only(self):
        writable = sorted(k for k in self._open() if k[1] in STATE_CHANGING and k not in STATE_CHANGING_EXEMPT)
        self.assertEqual(writable, [], f"Public routes must not change state: {writable}")

    def assert_unmatched_paths_refused(self):
        leaked = {p: s for p, s in self.report["synthetic"].items() if not p.startswith("/static/") and s != 401}
        self.assertEqual(leaked, {}, f"Paths outside /static/ that match no route got past the gate (an allowlist prefix or suffix is too broad): {leaked}")


class TestAppRouteAuthInventory(_InventoryCase):
    """The main app: one token gate in front of every route, with a short reviewed public list."""
    mode = "app"
    public = APP_PUBLIC_ROUTES

    def test_every_route_requires_a_token_unless_listed(self):
        self.assert_inventory()

    def test_no_variant_bypasses_the_gate(self):
        self.assert_no_bypass()

    def test_a_valid_token_reaches_every_route(self):
        self.assert_token_reaches_everything()

    def test_public_routes_are_read_only(self):
        self.assert_public_routes_are_read_only()

    def test_unmatched_paths_outside_static_are_refused(self):
        self.assert_unmatched_paths_refused()

    def test_every_bundled_extension_is_mounted(self):
        missing = sorted(set(self.report["bundled_extensions"]) - set(self.report["mounted_blueprints"]))
        self.assertEqual(missing, [], f"Bundled extensions failed to mount, so their routes went unprobed: {missing}")

    @unittest.skipUnless(importlib.util.find_spec("flask_sock"), "flask-sock is not installed")
    def test_terminal_websocket_is_probed(self):
        self.assertIn("/api/<workspace_id>/term/stream", {e["rule"] for e in self.report["rules"]})


class TestLifeboatRouteAuthInventory(_InventoryCase):
    """The lifeboat: the same rules, because it listens on the port Tailscale exposes."""
    mode = "lifeboat"
    public = LIFEBOAT_PUBLIC_ROUTES

    def test_every_route_requires_a_token_unless_listed(self):
        self.assert_inventory()

    def test_no_variant_bypasses_the_gate(self):
        self.assert_no_bypass()

    def test_a_valid_token_reaches_every_route(self):
        self.assert_token_reaches_everything()

    def test_public_routes_are_read_only(self):
        self.assert_public_routes_are_read_only()

    def test_unmatched_paths_outside_static_are_refused(self):
        self.assert_unmatched_paths_refused()


if __name__ == "__main__":
    unittest.main()
