"""Child process environment sanitization, outbound HTTP SSRF/byte-cap guard, and command attestations."""
import hashlib
import http.client
import ipaddress
import json
import os
import re
import socket
from typing import Any, Dict, Optional
import urllib.error
import urllib.parse
import urllib.request
import zlib

import insetu.core.attestations as _attestations
from insetu.core.sdk import SettingsManager

# Child process environments (S3). Every process insetu starts gets its environment from child_env().
CHILD_ENV_PURPOSES = ("shell", "tool", "repo_code")
# insetu's own process-private variables; no child needs them. (akasa also strips AKASA_BOOT_TOKEN itself.)
HOST_PRIVATE_ENV_VARS = frozenset({"AKASA_BOOT_TOKEN", "INSETU_BOOT_TOKEN", "INSETU_PANIC_DETAILS"})
# Variable names that look like credentials. Stripped from processes that run repository code, unless allowed per repo.
_SECRET_ENV_NAME_RE = re.compile(
    r"(?:^|_)(?:API_?KEY|ACCESS_?KEY|SECRET|SECRET_?KEY|TOKEN|PASSWORD|PASSWD|PRIVATE_?KEY|CREDENTIALS?|AUTH)(?:$|_)",
    re.IGNORECASE,
)

# Outbound HTTP (S4). Every fetch insetu makes goes through fetch_url().
FETCH_DEFAULT_TIMEOUT = 15
FETCH_DEFAULT_MAX_BYTES = 10 * 1024 * 1024
_FETCH_SCHEMES = ("http", "https")
_FETCH_MAX_REDIRECTS = 5

def _command_signature(kind: str, repo: str, command: str) -> str:
    """Approval key for one exact command. Test-runner keys keep their original 'repo:hash' form."""
    digest = hashlib.sha256((command or "").strip().encode("utf-8")).hexdigest()[:16]
    return f"{repo}:{digest}" if kind == "test" else f"{kind}:{repo}:{digest}"

def _command_subject(workspace_id: str, signature: str) -> str:
    """Attestation subject for one command approval: approvals are per workspace."""
    return f"{workspace_id}|{signature}"

def get_approved_commands(workspace_id: str) -> set:
    """Returns the approved command signatures for workspace_id from the attestation store (P5, S8)."""
    prefix = f"{workspace_id}|"
    return {r["digest"] for r in _attestations.list_attestations("command") if str(r.get("subject", "")).startswith(prefix)}

def approve_command(workspace_id: str, kind: str, repo: str, command: str) -> str:
    """Records a person's approval of one exact command of a kind ('test', 'preview') for a repository. Call only from human-only routes."""
    sig = _command_signature(kind, repo, command)
    _attestations.attest("command", _command_subject(workspace_id, sig), sig, {"kind": kind, "repo": repo, "command": (command or "").strip()})
    return sig

def is_command_approved(workspace_id: str, kind: str, repo: str, command: str) -> bool:
    """True only when a person approved this exact command of this kind for this repository. Never approves anything itself."""
    clean_cmd = (command or "").strip()
    if not clean_cmd:
        return False
    sig = _command_signature(kind, repo, clean_cmd)
    return _attestations.is_attested("command", _command_subject(workspace_id, sig), sig)

def is_test_command_approved(
    workspace_id: str,
    repo: str,
    command: str,
    default_command: str,
) -> bool:
    """
    True when `command` may run in `workspace_id` for `repo`: the repository's default test command,
    or a custom command a person approved earlier through bridge.test.approve. Never approves anything itself.
    """
    clean_cmd = (command or "").strip()
    clean_default = (default_command or "").strip()
    if not clean_cmd or clean_cmd == clean_default:
        return True
    return is_command_approved(workspace_id, "test", repo, clean_cmd)

def is_secret_env_name(name: str) -> bool:
    """True for environment variable names that look like credentials (API keys, tokens, passwords, SSH_AUTH_SOCK)."""
    return bool(_SECRET_ENV_NAME_RE.search(name or ""))

def get_child_env_passthrough(workspace_id: str, repo: str) -> set:
    """The credential-like variable names a person allowed through to this repository's processes."""
    raw = SettingsManager('system', workspace_id).get("child_env_passthrough", [], repo=repo) or []
    items = raw if isinstance(raw, (list, tuple)) else re.split(r"[\s,]+", str(raw))
    return {str(item).strip() for item in items if str(item).strip()}

def child_env(
    purpose: str,
    workspace_id: Optional[str] = None,
    repo: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, str]:
    """
    Builds the environment for a child process. Who chose the command decides what it inherits.

    'shell' is the person's interactive terminal: their full environment, minus insetu's own variables.
    'tool' covers commands insetu or the person configured (git, release tooling, tailscale, hooks, CLIs);
    it matches 'shell', because these tools legitimately need GH_TOKEN, TWINE_PASSWORD and similar.
    'repo_code' covers processes that run a repository's own code (preview servers, test runners) and also
    drops credential-like variables, except the names a person allowed for that repository (system setting
    'child_env_passthrough'). That prevents accidental leaks through debug pages, error reporters and logs;
    a child running as the user can still read any file the user can read.
    """
    if purpose not in CHILD_ENV_PURPOSES:
        raise ValueError(f"Unknown child environment purpose '{purpose}'. Use one of {', '.join(CHILD_ENV_PURPOSES)}.")
    env = {key: value for key, value in os.environ.items() if key not in HOST_PRIVATE_ENV_VARS}
    if purpose == "repo_code":
        allowed = get_child_env_passthrough(workspace_id, repo) if workspace_id and repo else set()
        env = {key: value for key, value in env.items() if key in allowed or not is_secret_env_name(key)}
    for key, value in (extra or {}).items():
        env[str(key)] = str(value)
    return env

class FetchRefused(Exception):
    """A URL was refused before or during the fetch: wrong scheme, a non-public address, or a body over the cap."""

class FetchHTTPError(Exception):
    """The server answered with an HTTP error status. Carries the (capped) response body."""

    def __init__(self, status: int, url: str, body: bytes):
        super().__init__(f"HTTP {status} from {url}")
        self.status = status
        self.code = status
        self.url = url
        self.body = body

    def text(self) -> str:
        return self.body.decode("utf-8", errors="replace")

class FetchResult:
    """A completed fetch: final URL after redirects, status, headers and the decoded (decompressed) body."""

    def __init__(self, url: str, status: int, headers, body: bytes):
        self.url = url
        self.status = status
        self.headers = headers
        self.body = body

    def text(self, encoding: str = "utf-8") -> str:
        return self.body.decode(encoding, errors="ignore")

    def json(self):
        return json.loads(self.body.decode("utf-8")) if self.body else {}

def _is_public_address(addr: str) -> bool:
    ip = ipaddress.ip_address(addr.split("%", 1)[0])
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    # is_global excludes loopback, private, link-local (cloud metadata), CGNAT/tailnet (100.64.0.0/10) and reserved ranges.
    return ip.is_global and not ip.is_multicast

def _host_is_allowed_private(host: str, port: Optional[int], allowed_private_hosts) -> bool:
    host = (host or "").lower().strip("[]")
    for entry in allowed_private_hosts or ():
        item = str(entry).strip().lower()
        if not item:
            continue
        if item == host or (port is not None and item == f"{host}:{port}"):
            return True
    return False

def _goes_through_proxy(url: str) -> bool:
    parts = urllib.parse.urlsplit(url)
    proxy = urllib.request.getproxies().get(parts.scheme.lower())
    return bool(proxy) and not urllib.request.proxy_bypass(parts.hostname or "")

def _check_fetch_target(url: str, allow_private: bool, allowed_private_hosts) -> None:
    """Refuses non-http(s) URLs and, unless allowed, hosts that resolve to any non-public address."""
    parts = urllib.parse.urlsplit(url)
    if parts.scheme.lower() not in _FETCH_SCHEMES:
        raise FetchRefused(f"Only http and https URLs can be fetched (got '{parts.scheme or 'none'}').")
    if not parts.hostname:
        raise FetchRefused("The URL has no host.")
    if allow_private or _host_is_allowed_private(parts.hostname, parts.port, allowed_private_hosts):
        return
    try:
        literal = ipaddress.ip_address(parts.hostname.split("%", 1)[0])
    except ValueError:
        literal = None
    if literal is not None:
        if not _is_public_address(str(literal)):
            raise FetchRefused(f"'{parts.hostname}' is a non-public address, which is not fetched.")
        return
    port = parts.port or (443 if parts.scheme.lower() == "https" else 80)
    try:
        infos = socket.getaddrinfo(parts.hostname, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as e:
        if _goes_through_proxy(url):
            return  # The proxy resolves the name; this machine may not be able to.
        raise FetchRefused(f"Could not resolve '{parts.hostname}': {e}") from e
    for info in infos:
        if not _is_public_address(info[4][0]):
            raise FetchRefused(f"'{parts.hostname}' resolves to a non-public address ({info[4][0]}), which is not fetched.")

class _PeerCheckingMixin:
    """Checks the address actually connected to, so a DNS answer that changes after the check is still refused."""

    _fetch_guard = None  # (allow_private, allowed_private_hosts), set per opener

    def connect(self):
        super().connect()
        guard = self._fetch_guard
        if guard is None or guard[0]:
            return
        if _host_is_allowed_private(self.host, self.port, guard[1]):
            return
        peer = self.sock.getpeername()[0]
        if not _is_public_address(peer):
            self.sock.close()
            raise FetchRefused(f"Connected to a non-public address ({peer}); refused.")

def _build_fetch_opener(allow_private: bool, allowed_private_hosts, max_redirects: int, proxied: bool):
    # Through a proxy, the connected address is the proxy's and says nothing about the target, so only the
    # pre-connect resolution check applies there.
    guard = None if proxied else (allow_private, tuple(allowed_private_hosts or ()))

    class _HTTPConnection(_PeerCheckingMixin, http.client.HTTPConnection):
        _fetch_guard = guard

    class _HTTPSConnection(_PeerCheckingMixin, http.client.HTTPSConnection):
        _fetch_guard = guard

    class _HTTPHandler(urllib.request.HTTPHandler):
        def http_open(self, req):
            return self.do_open(_HTTPConnection, req)

    class _HTTPSHandler(urllib.request.HTTPSHandler):
        def https_open(self, req):
            return self.do_open(_HTTPSConnection, req, context=self._context)

    class _RedirectHandler(urllib.request.HTTPRedirectHandler):
        max_redirections = max_redirects

        def redirect_request(self, req, fp, code, msg, headers, newurl):
            _check_fetch_target(newurl, allow_private, allowed_private_hosts)
            return super().redirect_request(req, fp, code, msg, headers, newurl)

    return urllib.request.build_opener(_HTTPHandler, _HTTPSHandler, _RedirectHandler)

def _read_capped(response, max_bytes: int) -> bytes:
    """Reads the body, decompressing gzip or deflate, and refuses anything over max_bytes before or after decoding."""
    encoding = (response.headers.get("Content-Encoding") or "").lower().strip()
    # wbits 32 + MAX_WBITS accepts both gzip and zlib-wrapped deflate streams.
    decoder = zlib.decompressobj(32 + zlib.MAX_WBITS) if encoding in ("gzip", "x-gzip", "deflate") else None
    out = bytearray()
    raw_seen = 0
    while True:
        chunk = response.read(64 * 1024)
        if not chunk:
            break
        raw_seen += len(chunk)
        if raw_seen > max_bytes:
            raise FetchRefused(f"Response is larger than the {max_bytes // 1024} KB limit.")
        if decoder is None:
            out.extend(chunk)
        else:
            out.extend(decoder.decompress(chunk, max_bytes + 1 - len(out)))
            if decoder.unconsumed_tail:
                raise FetchRefused(f"Decompressed response is larger than the {max_bytes // 1024} KB limit.")
        if len(out) > max_bytes:
            raise FetchRefused(f"Decompressed response is larger than the {max_bytes // 1024} KB limit.")
    return bytes(out)

def fetch_url(
    url: str,
    *,
    method: Optional[str] = None,
    headers: Optional[Dict[str, str]] = None,
    data: Optional[bytes] = None,
    timeout: float = FETCH_DEFAULT_TIMEOUT,
    max_bytes: int = FETCH_DEFAULT_MAX_BYTES,
    allow_private: bool = False,
    allowed_private_hosts=(),
    max_redirects: int = _FETCH_MAX_REDIRECTS,
) -> FetchResult:
    """
    The one way insetu makes an outbound HTTP request (S4). Only http and https; a timeout; a byte cap applied
    while reading and after decompression; redirects re-checked. Unless allow_private is set, a host that resolves
    to a loopback, private, link-local (cloud metadata), CGNAT or tailnet address is refused, both before connecting
    and against the address actually connected to. Who chose the URL decides allow_private: a URL a caller supplies
    (ingest) must be public unless a person listed its host in allowed_private_hosts; an endpoint a person
    configured in settings (a local model server) may be private.
    Raises FetchRefused, FetchHTTPError (4xx/5xx, body capped) or URLError/TimeoutError for network failures.
    """
    _check_fetch_target(url, allow_private, allowed_private_hosts)
    req_headers = {"User-Agent": "inSetu/1.0", "Accept-Encoding": "gzip, deflate"}
    req_headers.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    opener = _build_fetch_opener(allow_private, allowed_private_hosts, max_redirects, _goes_through_proxy(url))
    try:
        with opener.open(req, timeout=timeout) as response:
            body = _read_capped(response, max_bytes)
            return FetchResult(response.geturl(), getattr(response, "status", 200), response.headers, body)
    except urllib.error.HTTPError as e:
        try:
            err_body = _read_capped(e, min(max_bytes, 256 * 1024))
        except Exception:
            err_body = b""
        raise FetchHTTPError(e.code, url, err_body) from None
    except urllib.error.URLError as e:
        if isinstance(e.reason, FetchRefused):
            raise e.reason from None
        raise
