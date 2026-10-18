import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import akasa.db as akasa_db
import akasa.utils as akasa_utils
from akasa.extension import SettingsManager, _REGISTERED_SETTINGS_SCHEMAS
from akasa.utils import load_config, load_json_config, save_json_config
from akasa.workers import _init_worker_schema
from insetu.core.system.engine_system import (
    SYSTEM_SETTINGS_SCHEMA,
    hydrate_and_migrate_cascade_settings,
    save_system_config,
)
from insetu.core.utils_core import sanitize_workspace_config


class TestConfigurationCascade(unittest.TestCase):
    def setUp(self):
        for attr in dir(akasa_db):
            obj = getattr(akasa_db, attr)
            if hasattr(obj, "connections") and isinstance(obj.connections, dict):
                for c in list(obj.connections.values()):
                    try: c.close()
                    except Exception: pass
                obj.connections.clear()

        self.temp_dir = tempfile.TemporaryDirectory()
        self.root_path = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root_path / ".insetu"
        (self.control_dir / "cache" / "db").mkdir(parents=True, exist_ok=True)

        self.orig_cwd = akasa_utils._cwd
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        os.environ["AKASA_CONTROL_DIR"] = ".insetu"
        akasa_utils._cwd = self.root_path.as_posix()

        _init_worker_schema("default")

        # Ensure system schema is registered
        _REGISTERED_SETTINGS_SCHEMAS["system"] = SYSTEM_SETTINGS_SCHEMA

        # Seed baseline system.json
        self.system_json_path = self.control_dir / "system.json"
        self.system_json_path.write_text(
            json.dumps({
                "port": 5005,
                "enable_watchdog": True,
                "preload_all_extensions": False,
                "workspaces": {"default": {"config_path": "config.json"}},
            }, indent=2),
            encoding="utf-8",
        )

        # Clear caches after seeding system.json so each test starts with a clean slate
        akasa_utils._JSON_CACHE.clear()
        akasa_utils._JSON_MTIME.clear()
        load_config.clear_all()
    def tearDown(self):
        for attr in dir(akasa_db):
            obj = getattr(akasa_db, attr)
            if hasattr(obj, "connections") and isinstance(obj.connections, dict):
                for c in list(obj.connections.values()):
                    try: c.close()
                    except Exception: pass
                obj.connections.clear()
        akasa_utils._cwd = self.orig_cwd
        if self.orig_env_ctrl is not None:
            os.environ["AKASA_CONTROL_DIR"] = self.orig_env_ctrl
        akasa_utils._JSON_CACHE.clear()
        akasa_utils._JSON_MTIME.clear()
        load_config.clear_all()
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def test_three_tier_scope_routing_and_secrets_encryption(self):
        """SettingsManager routes daemon, workspace, repo, and secure fields to their isolated files."""
        test_schema = [
            {"id": "daemon_flag", "type": "boolean", "scope": "daemon", "default": False},
            {"id": "ws_label", "type": "text", "scope": "workspace", "default": "Default WS"},
            {"id": "repo_strategy", "type": "select", "scope": "repo", "default": "rebase"},
            {"id": "api_token", "type": "password", "scope": "workspace", "secure": True, "default": ""},
        ]
        mgr = SettingsManager("test_ext", "default", schema=test_schema)

        # 1. Daemon Scope -> system.json
        mgr.set("daemon_flag", True)
        sys_disk = json.loads(self.system_json_path.read_text(encoding="utf-8"))
        self.assertTrue(sys_disk.get("test_ext", {}).get("daemon_flag"))
        self.assertTrue(mgr.get("daemon_flag"))

        # 2. Workspace Scope -> workspace.settings.json
        mgr.set("ws_label", "Custom Workspace")
        ws_path = self.control_dir / "workspace.settings.json"
        ws_disk = json.loads(ws_path.read_text(encoding="utf-8"))
        self.assertEqual(ws_disk.get("test_ext", {}).get("ws_label"), "Custom Workspace")
        self.assertEqual(mgr.get("ws_label"), "Custom Workspace")

        # 3. Repo Scope -> repo.settings.json
        mgr.set("repo_strategy", "merge", repo="my-repo")
        repo_path = self.control_dir / "repo.settings.json"
        repo_disk = json.loads(repo_path.read_text(encoding="utf-8"))
        self.assertEqual(repo_disk.get("my-repo", {}).get("test_ext", {}).get("repo_strategy"), "merge")
        self.assertEqual(mgr.get("repo_strategy", repo="my-repo"), "merge")
        self.assertEqual(mgr.get("repo_strategy", repo="other-repo"), "rebase")

        # 4. Secure Vault -> secrets.json (Fernet v1: ciphertext on disk, plaintext on .get())
        with patch("akasa.auth.get_master_key") as mock_key:
            from cryptography.fernet import Fernet as _Fernet
            fixed_key = _Fernet.generate_key()
            mock_key.return_value = fixed_key

            mgr.set("api_token", "super-secret-token-123")
            secrets_path = self.control_dir / "secrets.json"
            secrets_disk = json.loads(secrets_path.read_text(encoding="utf-8"))
            raw_cipher = secrets_disk.get("test_ext", {}).get("api_token", "")
            self.assertTrue(raw_cipher.startswith("v1:"))
            self.assertNotIn("super-secret-token-123", raw_cipher)
            self.assertEqual(mgr.get("api_token"), "super-secret-token-123")

    def test_lazy_migration_from_legacy_config_json(self):
        """Legacy config.json values (extensions, instance_title, instance_emoji, port) auto-migrate into their tiers."""
        config_path = self.control_dir / "config.json"
        legacy_config = {
            "instance_title": "Legacy Workbench Title",
            "instance_emoji": "🚀",
            "port": 7070,
            "extensions": ["git", "notes"],
            "ignore_dirs": ["node_modules"],
            "target_repos": [{"repo_dir": "alpha", "title": "Alpha"}],
        }
        config_path.write_text(json.dumps(legacy_config, indent=2), encoding="utf-8")
        # Trigger load_config(), which fires mutate_workspace_config -> hydrate_and_migrate_cascade_settings
        loaded = load_config("default")
        SettingsManager("system", "default")._sync_vfs_barrier()

        # Verify in-memory hydration includes 'config' guardrail + migrated values
        self.assertEqual(loaded["instance_title"], "Legacy Workbench Title")
        self.assertEqual(loaded["instance_emoji"], "🚀")
        self.assertIn("config", loaded["extensions"])
        self.assertIn("git", loaded["extensions"])
        self.assertIn("notes", loaded["extensions"])

        # Verify workspace.settings.json was physically populated on disk
        ws_settings_path = self.control_dir / "workspace.settings.json"
        self.assertTrue(ws_settings_path.exists())
        ws_disk = json.loads(ws_settings_path.read_text(encoding="utf-8"))
        self.assertEqual(ws_disk["system"]["instance_title"], "Legacy Workbench Title")
        self.assertEqual(ws_disk["system"]["instance_emoji"], "🚀")
        self.assertEqual(ws_disk["system"]["extensions"], ["config", "git", "notes"])

    def test_save_system_config_routes_to_tiers_and_sanitizes_topology(self):
        """save_system_config persists settings to SettingsManager and strips non-topology keys from config.json."""
        config_path = self.control_dir / "config.json"
        config_path.write_text(json.dumps({"ignore_dirs": ["venv"], "target_repos": []}), encoding="utf-8")

        payload = {
            "instance_title": "Updated Title",
            "instance_emoji": "🧪",
            "port": 6060,
            "extensions": ["git", "tracker"],
            "ignore_dirs": ["venv", "dist"],
            "target_repos": [{"repo_dir": "core-repo", "title": "Core Repo"}],
        }
        save_system_config("default", payload)
        SettingsManager("system", "default")._sync_vfs_barrier()

        # 1. Verify config.json on disk is strictly topology-only
        raw_cfg_on_disk = json.loads(config_path.read_text(encoding="utf-8"))
        self.assertNotIn("extensions", raw_cfg_on_disk)
        self.assertNotIn("instance_title", raw_cfg_on_disk)
        self.assertNotIn("instance_emoji", raw_cfg_on_disk)
        self.assertNotIn("port", raw_cfg_on_disk)
        self.assertEqual(raw_cfg_on_disk["ignore_dirs"], ["venv", "dist"])
        self.assertEqual(len(raw_cfg_on_disk["target_repos"]), 1)

        # 2. Verify SettingsManager has the updated Tier 1 and Tier 2 values
        sys_mgr = SettingsManager("system", "default")
        self.assertEqual(sys_mgr.get("instance_title"), "Updated Title")
        self.assertEqual(sys_mgr.get("instance_emoji"), "🧪")
        self.assertEqual(sys_mgr.get("port"), 6060)
        self.assertEqual(sys_mgr.get("extensions"), ["config", "git", "tracker"])

        # 3. Verify load_config() still hydrates them in-memory for runtime consumers
        hydrated_cfg = load_config("default")
        self.assertEqual(hydrated_cfg["extensions"], ["config", "git", "tracker"])
        self.assertEqual(hydrated_cfg["instance_title"], "Updated Title")
        self.assertEqual(hydrated_cfg["port"], 6060)
    def test_all_registered_extension_schemas_and_roundtrip(self):
        """Every Core and Domain Extension settings_schema must comply with 3-tier scope contracts and round-trip cleanly."""
        import importlib as _importlib

        extension_modules = [
            "insetu.core.system.engine_system",
            "insetu.core.editor.engine_editor",
            "insetu.core.gather.engine_gather",
            "insetu.core.llm.engine_llm",
            "insetu.extensions.git.engine_git",
            "insetu.extensions.update.engine_update",
            "insetu.extensions.tracker.engine_tracker",
            "insetu.extensions.freshdesk.engine_freshdesk",
            "insetu.extensions.research.engine_research",
            "insetu.extensions.skills.engine_skills",
            "insetu.extensions.tailscale.engine_tailscale",
        ]
        for mod_name in extension_modules:
            _importlib.import_module(mod_name)

        self.assertGreaterEqual(len(_REGISTERED_SETTINGS_SCHEMAS), 10)

        with patch("akasa.auth.get_master_key") as mock_key:
            from cryptography.fernet import Fernet as _Fernet
            mock_key.return_value = _Fernet.generate_key()

            for ext_name, schema_spec in _REGISTERED_SETTINGS_SCHEMAS.items():
                schema = schema_spec("default") if callable(schema_spec) else schema_spec
                self.assertIsInstance(schema, list, f"Schema for '{ext_name}' must resolve to a list.")
                mgr = SettingsManager(ext_name, "default", schema=schema)

                for field in schema:
                    fid = field.get("id")
                    ftype = field.get("type")
                    scope = field.get("scope")
                    self.assertTrue(fid, f"Missing 'id' in schema for '{ext_name}'")
                    self.assertTrue(ftype, f"Missing 'type' in field '{ext_name}.{fid}'")
                    self.assertIn(
                        scope,
                        ("daemon", "workspace", "repo"),
                        f"Invalid or missing scope '{scope}' on '{ext_name}.{fid}'",
                    )

                    if ftype == "action":
                        continue

                    # Verify default read
                    default_val = field.get("default")
                    read_default = mgr.get(fid, repo="sample-repo")
                    self.assertEqual(
                        read_default,
                        default_val,
                        f"Default mismatch on '{ext_name}.{fid}'",
                    )

                    # Verify round-trip write & read into the target tier
                    if ftype == "boolean":
                        test_val = not bool(default_val)
                    elif ftype == "number":
                        test_val = (int(default_val or 0)) + 42
                    elif ftype in ("object", "json") or isinstance(default_val, (dict, list)):
                        test_val = {"test_key": "test_val"} if isinstance(default_val, dict) else ["test_item"]
                    else:
                        test_val = f"test_val_{fid}"

                    mgr.set(fid, test_val, repo="sample-repo")
                    self.assertEqual(
                        mgr.get(fid, repo="sample-repo"),
                        test_val,
                        f"Round-trip read/write failed for '{ext_name}.{fid}' (scope={scope})",
                    )

    def test_defaults_config_template_is_pure_topology(self):
        """defaults/config_json.txt must not contain daemon or workspace settings keys."""
        defaults_cfg_path = (
            Path(__file__).resolve().parent.parent.parent
            / "insetu"
            / "defaults"
            / "config_json.txt"
        )
        if defaults_cfg_path.exists():
            tpl_data = json.loads(defaults_cfg_path.read_text(encoding="utf-8"))
            for banned_key in ("instance_title", "instance_emoji", "port", "extensions"):
                self.assertNotIn(
                    banned_key,
                    tpl_data,
                    f"Non-topology key '{banned_key}' found in defaults/config_json.txt",
                )
            self.assertIn("target_repos", tpl_data)
            self.assertIn("ignore_dirs", tpl_data)


if __name__ == "__main__":
    unittest.main()