"""
Probe helper for test_route_auth_inventory.py: boots inSetu (or the lifeboat) in a throwaway
workspace and reports which routes answer without a valid token.

Run as a subprocess, because importing insetu.app has process-wide side effects:

    python route_auth_probe.py app|lifeboat OUT_JSON

Every view function is replaced by a sentinel before probing, so no handler ever runs (no panic,
no reboot, no git push). A request "reaches" a route when the sentinel answers. The gate under
test sits in front of the views, so stubbing them changes nothing about what is checked.
"""
import json
import os
import re
import sys
import tempfile
from pathlib import Path

SENTINEL_STATUS = 299
STATE_CHANGING = {"POST", "PUT", "PATCH", "DELETE"}
PEERS = {
    "tailnet": {"REMOTE_ADDR": "100.101.102.103"},
    "loopback": {"REMOTE_ADDR": "127.0.0.1"},
}
# Paths that match no route: the gate answers 401 for them unless an allowlist prefix or suffix lets them through to a 404.
SYNTHETIC_PATHS = [
    "/__route_probe__/nothing",
    "/__route_probe__/nothing.map",
    "/api/default/__route_probe__/nothing.map",
    "/sm/__route_probe__",
    "/static/__route_probe__/nothing.js",
    "/static/__route_probe__/nothing.map",
]


def _fill(rule_text, trailing_value="probe"):
    """Builds a concrete URL for a Werkzeug rule. The last variable gets trailing_value."""
    variables = list(re.finditer(r"<(?:([a-zA-Z_]+)(?:\([^)]*\))?:)?([a-zA-Z_][a-zA-Z0-9_]*)>", rule_text))
    out, last = [], 0
    for idx, m in enumerate(variables):
        conv, name = m.group(1) or "default", m.group(2)
        if name == "workspace_id":
            value = "default"
        elif conv in ("int", "float"):
            value = "1"
        elif idx == len(variables) - 1:
            value = trailing_value
        else:
            value = "probe"
        out.append(rule_text[last:m.start()])
        out.append(value)
        last = m.end()
    out.append(rule_text[last:])
    return "".join(out), bool(variables) and variables[-1].end() == len(rule_text)


def _workspace(root):
    """Writes a minimal workspace that enables every bundled extension."""
    ctrl = root / ".insetu"
    (ctrl / "cache" / "db").mkdir(parents=True, exist_ok=True)
    ext_root = Path(__file__).resolve().parents[2] / "insetu" / "extensions"
    # A folder is an extension only if it has an engine module; leftovers from removed extensions
    # (an untracked folder with only __pycache__ in it) are not.
    bundled = sorted(
        p.name for p in ext_root.iterdir()
        if p.is_dir() and not p.name.startswith("__") and (p / f"engine_{p.name}.py").is_file()
    )
    (ctrl / "host.json").write_text(json.dumps({"port": 5005}), encoding="utf-8")
    (ctrl / "workspaces.json").write_text(
        json.dumps({"workspaces": {"default": {"config_path": "config.json"}}, "active_workspace": "default"}),
        encoding="utf-8",
    )
    (ctrl / "config.json").write_text(
        json.dumps({"workspace_root": root.as_posix(), "extensions": ["config", *bundled], "target_repos": []}),
        encoding="utf-8",
    )
    return bundled


def _load(mode):
    # Imported here, not at the top: these must run after main() has set up the throwaway workspace.
    if mode == "app":
        import insetu.app as _host_app
        from akasa.auth import BOOT_TOKEN as _BOOT_TOKEN
        return _host_app.app, _BOOT_TOKEN, "X-InSetu-Token"
    import insetu.fallback_bridge as _lifeboat
    # Contract: the lifeboat exposes current_token(), the credential its gate accepts.
    token = _lifeboat.current_token() if hasattr(_lifeboat, "current_token") else ""
    return _lifeboat.app, token, "X-InSetu-Token"


def main(mode, out_path):
    out_path = Path(out_path).resolve()
    root = Path(tempfile.mkdtemp(prefix="route_probe_")).resolve()
    bundled = _workspace(root)
    os.chdir(root)
    os.environ["AKASA_CONTROL_DIR"] = ".insetu"
    os.environ["INSETU_PORT"] = "5005"

    app, token, token_header = _load(mode)
    for endpoint in list(app.view_functions):
        app.view_functions[endpoint] = lambda *a, **kw: ("route-probe-sentinel", SENTINEL_STATUS)
    client = app.test_client()

    def reaches(method, url, headers=None, peer="tailnet", websocket=False):
        # Websocket-only rules (flask-sock) match only ws:// requests; over plain HTTP, routing fails with 400 after the gate.
        resp = client.open(
            url, method=method, headers={"Host": "localhost", **(headers or {})}, environ_base=PEERS[peer],
            environ_overrides={"wsgi.url_scheme": "ws"} if websocket else None,
        )
        return resp.status_code == SENTINEL_STATUS, resp.status_code

    rules = []
    for rule in sorted(app.url_map.iter_rules(), key=lambda r: r.rule):
        methods = sorted((rule.methods or set()) - {"HEAD", "OPTIONS"})
        url, trailing = _fill(rule.rule)
        ws = bool(getattr(rule, "websocket", False))
        entry = {"rule": rule.rule, "endpoint": rule.endpoint, "methods": methods, "websocket": ws, "open": {}, "control_failed": [], "bypasses": []}
        for method in methods:
            ok_with_token, status = reaches(method, url, {token_header: token}, websocket=ws) if token else (False, None)
            if not ok_with_token:
                entry["control_failed"].append({"method": method, "status": status})
            for peer in PEERS:
                hit, _status = reaches(method, url, peer=peer, websocket=ws)
                if hit:
                    entry["open"].setdefault(method, []).append(peer)
            variants = [
                ("wrong header token", url, {token_header: "0" * 32}),
                ("wrong akasa header token", url, {"X-Akasa-Token": "0" * 32}),
                ("wrong query token", url + ("&" if "?" in url else "?") + "token=" + "0" * 32, None),
            ]
            if trailing:
                variants.append(("trailing .map", _fill(rule.rule, "probe.map")[0], None))
                variants.append(("trailing static lookalike", _fill(rule.rule, "static/probe.js")[0], None))
                variants.append(("encoded dot segments", _fill(rule.rule, "%2e%2e/probe.map")[0], None))
            for label, v_url, v_headers in variants:
                hit, _status = reaches(method, v_url, v_headers, websocket=ws)
                if hit and method not in entry["open"]:
                    entry["bypasses"].append({"method": method, "variant": label, "url": v_url})
        rules.append(entry)

    synthetic = {}
    for path in SYNTHETIC_PATHS:
        resp = client.get(path, headers={"Host": "localhost"}, environ_base=PEERS["tailnet"])
        synthetic[path] = resp.status_code

    report = {
        "mode": mode,
        "bundled_extensions": bundled,
        "mounted_blueprints": sorted(app.blueprints),
        "has_token": bool(token),
        "rules": rules,
        "synthetic": synthetic,
    }
    Path(out_path).write_text(json.dumps(report, indent=2), encoding="utf-8")
    try:
        import akasa as _akasa
        _akasa.reset_state()
    except Exception:
        pass
    os._exit(0)  # Skip interpreter teardown: background kernel threads must not delay or fail the probe.


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
