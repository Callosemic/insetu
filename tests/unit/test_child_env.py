"""S3: child processes get their environment from child_env(); repository code never sees insetu's token or credential-like variables."""
import ast
import contextlib
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import akasa
import akasa.utils as akasa_utils
from akasa.vfs import mount_volume
from insetu.core.sdk import SettingsManager
from insetu.core.system.engine_system import system_bp  # registers the system settings schema
from insetu.core.utils_core import child_env, is_secret_env_name
from insetu.extensions.preview.engine_preview import _build_launch_command, preview_bp
from tests.fitness.core import FitnessState
from tests.fitness.rules_python import BackendFitnessVisitor

PLANTED = {
    "AKASA_BOOT_TOKEN": "boot-token-value",
    "INSETU_PANIC_DETAILS": "traceback text",
    "OPENAI_API_KEY": "sk-planted",
    "GH_TOKEN": "ghp-planted",
    "STRIPE_SECRET_KEY": "sk_live_planted",
    "SSH_AUTH_SOCK": "/tmp/agent.sock",
    "DATABASE_URL": "postgres://localhost/dev",
    "NODE_ENV": "development",
}


class _EnvCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        root = Path(self.temp_dir.name).resolve()
        (root / ".insetu").mkdir()
        (root / "alpha").mkdir()
        (root / ".insetu" / "config.json").write_text(json.dumps({
            "workspace_root": root.as_posix(),
            "extensions": ["config", "preview"],
            "target_repos": [{"repo_dir": "alpha", "title": "Alpha", "exts": [".html"]}],
        }), encoding="utf-8")
        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.env_patch = patch.dict(os.environ, {**PLANTED, "AKASA_CONFIG": (root / ".insetu" / "config.json").as_posix()})
        self.env_patch.start()
        akasa.reset_state(cwd=root.as_posix(), control_dir=".insetu")
        mount_volume("default", "vfs", "", root.as_posix())
        mount_volume("default", "vfs", "alpha", (root / "alpha").as_posix())
        self.root = root

    def tearDown(self):
        self.env_patch.stop()
        akasa.reset_state(cwd=self.orig_cwd, control_dir=".insetu")
        self.temp_dir.cleanup()


class TestChildEnvPurposes(_EnvCase):
    """Who chose the command decides what it inherits."""

    def test_no_purpose_inherits_insetu_private_variables(self):
        for purpose in ("shell", "tool", "repo_code"):
            env = child_env(purpose, "default", "alpha")
            with self.subTest(purpose=purpose):
                self.assertNotIn("AKASA_BOOT_TOKEN", env)
                self.assertNotIn("INSETU_PANIC_DETAILS", env)
                self.assertEqual(env.get("NODE_ENV"), "development")

    def test_shell_and_tool_keep_the_persons_credentials(self):
        for purpose in ("shell", "tool"):
            env = child_env(purpose)
            with self.subTest(purpose=purpose):
                self.assertEqual(env.get("GH_TOKEN"), "ghp-planted")
                self.assertEqual(env.get("OPENAI_API_KEY"), "sk-planted")

    def test_repo_code_drops_credential_like_variables(self):
        env = child_env("repo_code", "default", "alpha")
        for name in ("OPENAI_API_KEY", "GH_TOKEN", "STRIPE_SECRET_KEY", "SSH_AUTH_SOCK"):
            self.assertNotIn(name, env)
        self.assertEqual(env.get("DATABASE_URL"), "postgres://localhost/dev")
        self.assertIn("PATH", env)

    def test_passthrough_is_per_repository(self):
        SettingsManager("system", "default").set("child_env_passthrough", ["STRIPE_SECRET_KEY"], repo="alpha")
        self.assertEqual(child_env("repo_code", "default", "alpha").get("STRIPE_SECRET_KEY"), "sk_live_planted")
        self.assertNotIn("OPENAI_API_KEY", child_env("repo_code", "default", "alpha"))
        self.assertNotIn("STRIPE_SECRET_KEY", child_env("repo_code", "default", "beta"))

    def test_extra_values_and_unknown_purposes(self):
        self.assertEqual(child_env("tool", extra={"PSR_COMMIT_PARSER": "conventional"})["PSR_COMMIT_PARSER"], "conventional")
        with self.assertRaises(ValueError):
            child_env("everything")

    def test_secret_name_matching(self):
        for name in ("API_KEY", "OPENAI_API_KEY", "AWS_SECRET_ACCESS_KEY", "GITHUB_TOKEN", "DB_PASSWORD", "SSH_AUTH_SOCK", "GOOGLE_APPLICATION_CREDENTIALS"):
            self.assertTrue(is_secret_env_name(name), name)
        for name in ("PATH", "HOME", "DATABASE_URL", "TOKENIZERS_PARALLELISM", "OAUTHLIB_INSECURE_TRANSPORT", "XAUTHORITY"):
            self.assertFalse(is_secret_env_name(name), name)


class TestRepositoryProcesses(_EnvCase):
    """Preview servers and test runners use repo_code, and a real child sees neither the token nor a key."""

    def test_env_run_through_ctx_exec_shows_no_token_or_key(self):
        ctx = preview_bp.get_context("default")
        res = ctx.exec.run(["env"], cwd=self.root.as_posix(), env=child_env("repo_code", "default", "alpha"))
        self.assertNotIn("boot-token-value", res.stdout)
        self.assertNotIn("sk-planted", res.stdout)
        self.assertIn("NODE_ENV=development", res.stdout)

    def test_preview_launch_environment_is_repo_code(self):
        ctx = preview_bp.get_context("default")
        _, _, env = _build_launch_command(ctx, "alpha", (self.root / "alpha").as_posix(), "static", ".", 5199, "127.0.0.1", "")
        self.assertNotIn("OPENAI_API_KEY", env)
        self.assertNotIn("AKASA_BOOT_TOKEN", env)
        self.assertEqual(env["PORT"], "5199")


class TestChildEnvAndFetchRules(unittest.TestCase):
    """CHILD_ENV_MANDATE, OUTBOUND_FETCH_MANDATE and REMOTE_CODE_URL_BAN flag the raw patterns outside their homes."""

    SNIPPET = (
        "import os\nimport urllib.request\n"
        "env = os.environ.copy()\nother = dict(os.environ)\n"
        "urllib.request.urlopen('https://example.com')\n"
        "URL = f'https://esm.sh/@codemirror/lang-{1}'\n"
    )

    def _rules(self, rel_path):
        fake = Path(__file__).resolve().parent.parent.parent / rel_path
        prev = FitnessState.violations_found
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf):
                BackendFitnessVisitor(fake, fake.name, is_test=False).visit(ast.parse(self.SNIPPET))
        finally:
            FitnessState.violations_found = prev
        return buf.getvalue()

    def test_flagged_in_an_extension(self):
        out = self._rules("insetu/extensions/demo/engine_demo.py")
        self.assertEqual(out.count("CHILD_ENV_MANDATE"), 2)
        self.assertEqual(out.count("OUTBOUND_FETCH_MANDATE"), 1)
        self.assertEqual(out.count("REMOTE_CODE_URL_BAN"), 1)

    def test_homes_and_reviewed_files_are_exempt(self):
        self.assertNotIn("CHILD_ENV_MANDATE", self._rules("insetu/core/utils_core.py"))
        self.assertNotIn("OUTBOUND_FETCH_MANDATE", self._rules("insetu/core/llm/engine_llm.py"))


if __name__ == "__main__":
    unittest.main()
