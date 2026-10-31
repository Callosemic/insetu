"""S4: fetch_url() allows only http(s), refuses non-public addresses unless allowed, re-checks redirects, and caps bodies."""
import gzip
import http.server
import os
import threading
import unittest
from unittest.mock import patch

from insetu.core import utils_core
from insetu.core.utils_core import FetchHTTPError, FetchRefused, fetch_url
from insetu.extensions.ingest.engine_ingest import extract_markdown_from_url

PROXY_VARS = ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "all_proxy", "ALL_PROXY", "no_proxy", "NO_PROXY")


class _Handler(http.server.BaseHTTPRequestHandler):
    redirect_to = None

    def log_message(self, *args):
        pass

    def _send(self, status, body, headers=None):
        self.send_response(status)
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/ok":
            self._send(200, b"hello")
        elif self.path == "/big":
            self._send(200, b"x" * 4096)
        elif self.path == "/gzip":
            self._send(200, gzip.compress(b"<h1>compressed</h1>"), {"Content-Encoding": "gzip"})
        elif self.path == "/bomb":
            self._send(200, gzip.compress(b"\0" * (8 * 1024 * 1024)), {"Content-Encoding": "gzip"})
        elif self.path == "/redirect":
            self._send(302, b"", {"Location": type(self).redirect_to})
        elif self.path == "/missing":
            self._send(404, b"not here")
        else:
            self._send(500, b"?")


class TestOutboundFetch(unittest.TestCase):
    """fetch_url() against a local server: schemes, address policy, redirects, caps and error bodies."""

    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.env = patch.dict(os.environ, {}, clear=False)
        self.env.start()
        for name in PROXY_VARS:
            os.environ.pop(name, None)
        self.local = f"http://127.0.0.1:{self.port}"

    def tearDown(self):
        self.env.stop()

    def test_only_http_and_https(self):
        for url in ("file:///etc/passwd", "ftp://example.com/x", "gopher://example.com/", "data:text/plain,hi", "/relative"):
            with self.subTest(url=url), self.assertRaises(FetchRefused):
                fetch_url(url)

    def test_non_public_addresses_are_refused_by_default(self):
        for url in (
            f"{self.local}/ok",
            "http://169.254.169.254/latest/meta-data/",
            "http://100.100.100.100/",
            "http://10.0.0.1/",
            "http://[::1]/",
            "http://[::ffff:127.0.0.1]/",
        ):
            with self.subTest(url=url), self.assertRaises(FetchRefused):
                fetch_url(url, timeout=2)

    def test_private_allowed_when_a_person_said_so(self):
        self.assertEqual(fetch_url(f"{self.local}/ok", allow_private=True).body, b"hello")
        self.assertEqual(fetch_url(f"{self.local}/ok", allowed_private_hosts=[f"127.0.0.1:{self.port}"]).body, b"hello")
        with self.assertRaises(FetchRefused):
            fetch_url(f"{self.local}/ok", allowed_private_hosts=["127.0.0.1:1"])

    def test_redirect_into_a_private_address_is_refused(self):
        _Handler.redirect_to = f"http://127.0.0.1:{self.port}/ok"
        with self.assertRaises(FetchRefused):
            fetch_url(f"http://localhost:{self.port}/redirect", allowed_private_hosts=[f"localhost:{self.port}"])
        res = fetch_url(f"http://localhost:{self.port}/redirect", allowed_private_hosts=[f"localhost:{self.port}", f"127.0.0.1:{self.port}"])
        self.assertEqual((res.body, res.url), (b"hello", f"http://127.0.0.1:{self.port}/ok"))

    def test_redirect_to_another_scheme_is_refused(self):
        _Handler.redirect_to = "file:///etc/passwd"
        with self.assertRaises(Exception) as caught:
            fetch_url(f"{self.local}/redirect", allow_private=True)
        self.assertNotIn("root:", str(caught.exception))

    def test_connected_address_is_checked_even_if_resolution_lied(self):
        # Simulates DNS rebinding: the pre-connect check passes, but the socket lands on loopback.
        with patch.object(utils_core, "_check_fetch_target", lambda *a, **k: None):
            with self.assertRaises(FetchRefused):
                fetch_url(f"{self.local}/ok")

    def test_body_and_decompression_caps(self):
        with self.assertRaises(FetchRefused):
            fetch_url(f"{self.local}/big", allow_private=True, max_bytes=1024)
        self.assertEqual(fetch_url(f"{self.local}/gzip", allow_private=True).text(), "<h1>compressed</h1>")
        with self.assertRaises(FetchRefused):
            fetch_url(f"{self.local}/bomb", allow_private=True, max_bytes=1024 * 1024)

    def test_http_errors_carry_status_and_body(self):
        with self.assertRaises(FetchHTTPError) as caught:
            fetch_url(f"{self.local}/missing", allow_private=True)
        self.assertEqual((caught.exception.status, caught.exception.text()), (404, "not here"))


class TestIngestUsesThePolicy(unittest.TestCase):
    """Ingest refuses file:// and private hosts in both parser modes, unless a person allowed the host."""

    def test_ingest_refuses_local_targets(self):
        class _Settings:
            def __init__(self, hosts):
                self.hosts = hosts

            def get(self, key, default=None, **kwargs):
                return self.hosts if key == "allowed_private_hosts" else default

        ctx = type("Ctx", (), {"settings": _Settings([])})()
        for url in ("file:///etc/passwd", "http://169.254.169.254/latest/meta-data/"):
            with self.subTest(url=url), self.assertRaises((FetchRefused, ValueError)):
                try:
                    extract_markdown_from_url(ctx, url, method="bs4")
                except ImportError:
                    self.skipTest("beautifulsoup4 / markdownify not installed")
        with self.assertRaises(ValueError):
            extract_markdown_from_url(ctx, "file:///etc/passwd", method="jina")


if __name__ == "__main__":
    unittest.main()
