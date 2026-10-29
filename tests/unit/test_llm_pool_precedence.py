import json
import os
import tempfile
import unittest
from pathlib import Path

import akasa
import akasa.utils as akasa_utils
from akasa.vfs import sync_vfs_barrier

from insetu.core.llm.engine_llm import (
    llm_bp,
    get_compute_pool_and_profiles,
    _resolve_tier_execution_target,
    _model_provider_prefix,
)


class TestLlmPoolPrecedence(unittest.TestCase):
    """Routing precedence: saved pool/profiles, then explicitly saved legacy settings, then the schema's default pool."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root_path = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root_path / ".insetu"
        (self.control_dir / "cache" / "db").mkdir(parents=True, exist_ok=True)
        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        akasa.reset_state(cwd=self.root_path.as_posix(), control_dir=".insetu")
        (self.control_dir / "system.json").write_text(
            json.dumps({"port": 5005, "workspaces": {"default": {"config_path": "config.json"}}}), encoding="utf-8"
        )
        (self.control_dir / "config.json").write_text(
            json.dumps({"workspace_root": self.root_path.as_posix(), "extensions": ["config"]}), encoding="utf-8"
        )
        self.ctx = llm_bp.get_context("default")

    def tearDown(self):
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def _save(self, values):
        self.ctx.settings.update(values)
        sync_vfs_barrier("default")

    def test_fresh_install_uses_the_schema_default_pool(self):
        state = get_compute_pool_and_profiles(self.ctx)
        self.assertEqual([ep["id"] for ep in state["endpoints"]], ["anthropic_main"])
        fast = _resolve_tier_execution_target(self.ctx, "fast")
        self.assertEqual(fast["endpoint_id"], "anthropic_main")
        self.assertEqual(fast["model"], "claude-3-5-haiku-latest")

    def test_explicit_legacy_settings_win_over_the_default_pool(self):
        self._save({
            "provider": "openai_compatible",
            "base_url": "http://127.0.0.1:11434/v1",
            "model": "llama-standard",
            "tier_thinking_model": "llama-thinking",
        })
        thinking = _resolve_tier_execution_target(self.ctx, "thinking")
        self.assertEqual(thinking["endpoint_id"], "default_openai_compatible")
        self.assertEqual(thinking["model"], "llama-thinking")
        self.assertEqual(_resolve_tier_execution_target(self.ctx, "standard")["model"], "llama-standard")
        self.assertEqual(_resolve_tier_execution_target(self.ctx, "fast")["model"], "llama-standard", "Blank fast tier falls back to the standard model")

    def test_saved_pool_wins_over_legacy_settings(self):
        self._save({"model": "legacy-standard", "tier_thinking_model": "legacy-thinking"})
        self._save({
            "compute_endpoints": [{"id": "local_box", "label": "Local", "driver": "openai_compatible", "base_url": "http://127.0.0.1:1234/v1", "models": ["pool-model"]}],
            "llm_profiles": [{
                "id": "default",
                "title": "Default",
                "tiers": {
                    "standard": {"endpoint": "local_box", "model": "pool-model"},
                    "thinking": {"endpoint": "local_box", "model": "pool-model"},
                },
            }],
        })
        thinking = _resolve_tier_execution_target(self.ctx, "thinking")
        self.assertEqual(thinking["endpoint_id"], "local_box")
        self.assertEqual(thinking["model"], "pool-model")

    def test_model_provider_prefix(self):
        self.assertEqual(_model_provider_prefix("anthropic/claude-3-5-sonnet", "openrouter"), "anthropic")
        self.assertEqual(_model_provider_prefix("gpt-4o", "cloud"), "cloud")
        self.assertEqual(_model_provider_prefix("/odd", "cloud"), "cloud")
        self.assertEqual(_model_provider_prefix("", "cloud"), "cloud")


if __name__ == "__main__":
    unittest.main()
