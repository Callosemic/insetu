import ast
import importlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from cryptography.fernet import Fernet
import akasa
import akasa.db as akasa_db
import akasa.utils as akasa_utils
from akasa.auth import rotate_master_key, _on_security_settings_updated
from akasa.extension import SettingsManager, _REGISTERED_SETTINGS_SCHEMAS, MASKED_SECRET_SENTINEL
from akasa.utils import load_config, load_json_config, save_json_config
from akasa.workers import _init_worker_schema
from insetu.core.system.engine_system import (
    SYSTEM_SETTINGS_SCHEMA,
    hydrate_and_migrate_cascade_settings,
    save_system_config,
)
from insetu.core.topology.engine_topology import is_file_tracked_by_sieve, resolve_file_bucket
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

        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        akasa.reset_state(cwd=self.root_path.as_posix(), control_dir=".insetu")

        _init_worker_schema("default")

        # Ensure system schema is registered
        _REGISTERED_SETTINGS_SCHEMAS["system"] = SYSTEM_SETTINGS_SCHEMA
        # Seed baseline host.json and workspaces.json
        self.host_json_path = self.control_dir / "host.json"
        self.workspaces_json_path = self.control_dir / "workspaces.json"
        self.host_json_path.write_text(
            json.dumps({
                "port": 5005,
                "enable_watchdog": True,
                "preload_all_extensions": False,
            }, indent=2),
            encoding="utf-8",
        )
        self.workspaces_json_path.write_text(
            json.dumps({
                "workspaces": {"default": {"config_path": "config.json"}},
                "active_workspace": "default",
            }, indent=2),
            encoding="utf-8",
        )

        # Clear caches after seeding system.json so each test starts with a clean slate
        akasa.reset_state(cwd=self.root_path.as_posix(), control_dir=".insetu")
        _init_worker_schema("default")

    def tearDown(self):
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
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
        # 1. Daemon Scope -> host.json
        mgr.set("daemon_flag", True)
        sys_disk = json.loads(self.host_json_path.read_text(encoding="utf-8"))
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
            fixed_key = Fernet.generate_key()
            mock_key.return_value = fixed_key
            mgr.set("api_token", "super-secret-token-123")
            secrets_path = self.control_dir / "secrets.json"
            secrets_disk = json.loads(secrets_path.read_text(encoding="utf-8"))
            raw_cipher = secrets_disk.get("test_ext", {}).get("api_token", "")
            self.assertTrue(raw_cipher.startswith("v1:"))
            self.assertNotIn("super-secret-token-123", raw_cipher)
            self.assertEqual(mgr.get("api_token"), "super-secret-token-123")

            # 5. Secret Masking & Sentinel Preservation
            self.assertEqual(mgr.get("api_token", mask_secrets=True), MASKED_SECRET_SENTINEL)
            self.assertEqual(mgr.get_all(mask_secrets=True)["api_token"], MASKED_SECRET_SENTINEL)

            # Updating with MASKED_SECRET_SENTINEL must preserve existing secret
            mgr.update({"api_token": MASKED_SECRET_SENTINEL, "ws_label": "Updated Label"})
            self.assertEqual(mgr.get("api_token"), "super-secret-token-123")
            self.assertEqual(mgr.get("ws_label"), "Updated Label")
            # Updating with empty string must clear the secret
            mgr.update({"api_token": ""})
            self.assertEqual(mgr.get("api_token"), "")
            self.assertEqual(mgr.get("api_token", mask_secrets=True), "")

            # 6. Legacy plaintext secret migration on .get() must not emit config_mutated on a read
            secrets_path.write_text(json.dumps({"test_ext": {"api_token": "legacy-plaintext-key"}}), encoding="utf-8")
            akasa_utils._JSON_CACHE.clear()
            akasa_utils._JSON_MTIME.clear()
            with patch("akasa.hooks.hooks.emit") as mock_emit:
                migrated_val = mgr.get("api_token")
                self.assertEqual(migrated_val, "legacy-plaintext-key")
                mock_emit.assert_not_called()
            mgr._sync_vfs_barrier()
            migrated_disk = json.loads(secrets_path.read_text(encoding="utf-8"))
            self.assertTrue(migrated_disk["test_ext"]["api_token"].startswith("v1:"))
    def test_master_fernet_key_rotation_reencrypts_secrets(self):
        """rotate_master_key atomically decrypts and re-encrypts secrets.json with the new key."""
        key_1 = Fernet.generate_key().decode("utf-8")
        key_2 = Fernet.generate_key().decode("utf-8")
        local_key_file = self.control_dir / "master_key.txt"
        local_key_file.write_text(key_1, encoding="utf-8")

        test_schema = [
            {"id": "api_key", "type": "password", "scope": "workspace", "secure": True, "default": ""}
        ]
        mgr = SettingsManager("llm", "default", schema=test_schema)
        mgr.set("api_key", "sk-live-secret-999")
        mgr._sync_vfs_barrier()

        self.assertEqual(mgr.get("api_key"), "sk-live-secret-999")
        # Rotate to key_2
        rotated = rotate_master_key(key_2)
        mgr._sync_vfs_barrier()
        self.assertTrue(rotated)
        self.assertEqual(local_key_file.read_text(encoding="utf-8").strip(), key_2)
        self.assertEqual(mgr.get("api_key"), "sk-live-secret-999")
        # Simulate invalid key saved to host.json via security_settings_updated hook
        sys_data = load_json_config(self.host_json_path.as_posix(), {})
        sys_data["security"] = {"master_fernet_key": "not-a-valid-fernet-key"}
        save_json_config(self.host_json_path.as_posix(), sys_data, workspace_id="default")
        mgr._sync_vfs_barrier()

        _on_security_settings_updated(workspace_id="default")
        mgr._sync_vfs_barrier()

        # Verify invalid plaintext key was scrubbed from host.json and existing secrets remain intact
        cleaned_sys = json.loads(self.host_json_path.read_text(encoding="utf-8"))
        self.assertNotIn("security", cleaned_sys)
        self.assertEqual(local_key_file.read_text(encoding="utf-8").strip(), key_2)
        self.assertEqual(mgr.get("api_key"), "sk-live-secret-999")
    def test_all_ctx_settings_calls_reference_declared_schema_keys(self):
        """Every ctx.settings.get('key') and ctx.settings.set('key', ...) in Core and Extensions must exist in that module's settings_schema."""
        insetu_pkg_dir = Path(__file__).resolve().parent.parent.parent / "insetu"
        repo_root = insetu_pkg_dir.parent
        for py_file in sorted(insetu_pkg_dir.rglob("engine_*.py")):
            rel_mod = py_file.relative_to(repo_root).with_suffix("").as_posix().replace("/", ".")
            try:
                importlib.import_module(rel_mod)
            except Exception:
                pass

            tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
            ext_name = py_file.stem.replace("engine_", "")
            schema_spec = _REGISTERED_SETTINGS_SCHEMAS.get(ext_name, [])
            schema = schema_spec("default") if callable(schema_spec) else schema_spec
            declared_keys = {f.get("id") for f in (schema or []) if isinstance(f, dict) and f.get("id")}

            for node in ast.walk(tree):
                if (
                    isinstance(node, ast.Call)
                    and isinstance(node.func, ast.Attribute)
                    and node.func.attr in ("get", "set")
                    and isinstance(node.func.value, ast.Attribute)
                    and node.func.value.attr == "settings"
                    and isinstance(node.func.value.value, ast.Name)
                    and node.func.value.value.id == "ctx"
                    and len(node.args) >= 1
                    and isinstance(node.args[0], ast.Constant)
                    and isinstance(node.args[0].value, str)
                ):
                    key_str = node.args[0].value
                    self.assertIn(
                        key_str,
                        declared_keys,
                        f"{py_file.name}:{node.lineno} calls ctx.settings.{node.func.attr}('{key_str}'), "
                        f"but '{key_str}' is not declared in {ext_name}'s settings_schema!"
                    )

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
            importlib.import_module(mod_name)

        self.assertGreaterEqual(len(_REGISTERED_SETTINGS_SCHEMAS), 10)

        with patch("akasa.auth.get_master_key") as mock_key:
            mock_key.return_value = Fernet.generate_key()

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
    def test_vfs_sieve_blank_slate_nullable_override_and_bucket_zero(self):
        """is_file_tracked_by_sieve honors Nullable Overrides (explicit [] vs None) and resolve_file_bucket routes to Bucket 0 or _dropped."""
        global_cfg = {
            "ignore_dirs": ["build", "dist"],
            "ignore_files": ["secret.txt"],
            "ignore_patterns": ["*.log"],
            "include_extensions": [".py", ".md"],
        }

        # 1. Inherit State (repo overrides are None/omitted) -> uses global rules
        inherit_repo_cfg = {"repo_dir": "alpha", "apply_ignore": True}
        self.assertTrue(is_file_tracked_by_sieve("src/app.py", inherit_repo_cfg, global_cfg, repo_dir="alpha"))
        self.assertFalse(is_file_tracked_by_sieve("build/output.py", inherit_repo_cfg, global_cfg, repo_dir="alpha"))
        self.assertFalse(is_file_tracked_by_sieve("debug.log", inherit_repo_cfg, global_cfg, repo_dir="alpha"))
        self.assertFalse(is_file_tracked_by_sieve("src/style.css", inherit_repo_cfg, global_cfg, repo_dir="alpha"))

        # 2. Override State (repo explicitly sets empty list [] or custom list) -> completely replaces global rules
        override_repo_cfg = {
            "repo_dir": "alpha",
            "apply_ignore": True,
            "repo_ignore_dirs": [],
            "repo_ignore_patterns": [],
            "exts": [".py", ".css", ".log"],
        }
        self.assertTrue(is_file_tracked_by_sieve("build/output.py", override_repo_cfg, global_cfg, repo_dir="alpha"))
        self.assertTrue(is_file_tracked_by_sieve("debug.log", override_repo_cfg, global_cfg, repo_dir="alpha"))
        self.assertTrue(is_file_tracked_by_sieve("src/style.css", override_repo_cfg, global_cfg, repo_dir="alpha"))

        # 3. Sub-Bucket Extraction & Bucket 0 Fallthrough
        sub_buckets = [
            {
                "id": "docs",
                "title": "Docs",
                "match_prefixes": ["docs/"],
                "drop_patterns": ["archived/"],
                "ignore_patterns": ["internal_notes.md"],
            }
        ]
        # Matched sub-bucket
        b_docs, _ = resolve_file_bucket("docs/guide.md", sub_buckets, repo_dir="alpha")
        self.assertEqual(b_docs["id"], "docs")

        # Dropped pattern -> returns _dropped sentinel (omitted from both sub-bucket and Bucket 0)
        b_drop, _ = resolve_file_bucket("docs/archived/old.md", sub_buckets, repo_dir="alpha")
        self.assertEqual(b_drop["id"], "_dropped")

        # Ignored pattern in sub-bucket -> passes through to Bucket 0 (returns None, None)
        b_pass, _ = resolve_file_bucket("docs/internal_notes.md", sub_buckets, repo_dir="alpha")
        self.assertIsNone(b_pass)


if __name__ == "__main__":
    unittest.main()