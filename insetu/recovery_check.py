"""
Smoke tests for the recovery path (S8). Standard library only, so it runs wherever insetu is installed.

    python -m insetu.recovery_check <kind> <path>   < new_source

Reads a proposed version of one recovery file from stdin and checks that it would still work, without writing
it anywhere. The source is compiled as if it were the file at <path>, so code that finds things relative to its
own __file__ behaves as the real file would. Exit status 0 means the check passed; anything else is a failure,
with the reason on stderr.

Kinds:
    cli          insetu/cli.py: imports, and `insetu --help` exits cleanly.
    lifeboat     insetu/fallback_bridge.py: imports, builds its Flask app, serves its public page, and reads
                 and verifies its token through the credential store.
    credentials  akasa/auth/credentials.py: imports, and creates, reads, verifies and rotates a token in a
                 temporary control directory.

insetu runs it in a subprocess, in a temporary working directory, before it writes a confirmed change or a
Files-editor save of one of these files, and before it keeps a version as the last-good copy.
"""
import io
import sys
import tempfile
import types
from contextlib import redirect_stdout
from pathlib import Path

CHECK_KINDS = ("cli", "lifeboat", "credentials")
# The kind of check for each recovery file, by file name.
KIND_BY_FILENAME = {"cli.py": "cli", "fallback_bridge.py": "lifeboat", "credentials.py": "credentials"}


def load_source(name: str, source: str, path: str) -> types.ModuleType:
    """Executes source as a fresh module named name whose __file__ is path. Nothing is written to disk."""
    module = types.ModuleType(name)
    module.__file__ = path
    sys.modules[name] = module
    exec(compile(source, path, "exec"), module.__dict__)
    return module


def check_cli(source: str, path: str) -> None:
    """The CLI imports, and `insetu --help` exits cleanly with a usage line."""
    module = load_source("insetu_recovery_check_cli", source, path)
    saved_argv = sys.argv
    sys.argv = ["insetu", "--help"]
    try:
        with redirect_stdout(io.StringIO()) as out:
            module.main()
    except SystemExit as exc:
        if exc.code not in (0, None):
            raise AssertionError(f"`insetu --help` exited with {exc.code!r}")
    else:
        raise AssertionError("`insetu --help` returned without exiting")
    finally:
        sys.argv = saved_argv
    if "Usage" not in out.getvalue():
        raise AssertionError("`insetu --help` printed no usage line")


def check_lifeboat(source: str, path: str) -> None:
    """The lifeboat imports, serves its public page, and reads and verifies its token."""
    module = load_source("insetu_recovery_check_lifeboat", source, path)
    if not callable(getattr(module, "run_recovery_app", None)):
        raise AssertionError("run_recovery_app() is missing")
    client = module.app.test_client()
    response = client.get("/", headers={"Host": "127.0.0.1"})
    if response.status_code >= 500:
        raise AssertionError(f"GET / answered {response.status_code}")
    token = module.current_token()
    if not token or not module._token_matches(token) or module._token_matches(token + "x"):
        raise AssertionError("the lifeboat cannot read and verify its token")


def check_credentials(source: str, path: str) -> None:
    """The credential store creates, reads, verifies and rotates a token in a temporary directory."""
    module = load_source("insetu_recovery_check_credentials", source, path)
    with tempfile.TemporaryDirectory() as control_dir:
        token = module.load_or_create_token(control_dir)
        if not token or module.read_token(control_dir) != token:
            raise AssertionError("a new token does not read back")
        if module.load_or_create_token(control_dir) != token:
            raise AssertionError("a second load made a different token")
        if not module.verify_token(token, token) or module.verify_token(token + "x", token) or module.verify_token("", token):
            raise AssertionError("verify_token accepts the wrong token or rejects the right one")
        rotated = module.rotate_token(control_dir)
        if rotated == token or module.read_token(control_dir) != rotated or module.verify_token(token, rotated):
            raise AssertionError("rotate_token does not replace the token")


CHECKS = {"cli": check_cli, "lifeboat": check_lifeboat, "credentials": check_credentials}


def main(argv=None) -> int:
    """`python -m insetu.recovery_check <kind> <path> < source`: exit status 0 when the check passed."""
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) != 2 or args[0] not in CHECKS:
        print(f"Usage: python -m insetu.recovery_check [{' | '.join(CHECK_KINDS)}] <path> < source", file=sys.stderr)
        return 2
    kind, path = args
    source = sys.stdin.read()
    try:
        CHECKS[kind](source, str(Path(path).resolve()))
    except BaseException as exc:  # A SystemExit or KeyboardInterrupt from the candidate is a failure too.
        print(f"{kind} smoke test failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
