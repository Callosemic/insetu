"""Tests that the Cartographer derives file descriptions from docstrings instead of leaving placeholders."""
import json
import os
import tempfile
import unittest
from pathlib import Path

import akasa
import akasa.utils as akasa_utils
from akasa.db import apply_declarative_schema
from akasa.utils import load_config
from akasa.vfs import sync_vfs_barrier
from akasa.workers import _init_worker_schema
from insetu.core.bridge.bridge_vfs import execute_bridge_sync
from insetu.core.bridge.engine_bridge import BRIDGE_SCHEMA
from insetu.core.cartographer.cartographer import CARTOGRAPHER_SCHEMA, describe_source_file, map_repositories
from insetu.core.topology.engine_topology import (
    TOPOLOGY_SCHEMA,
    force_topology_scan,
    mount_topology_volumes_dynamically,
)


class TestDescribeSourceFile(unittest.TestCase):
    """describe_source_file reads module docstrings and leading file comments, never symbol docs."""

    def test_python_module_docstring(self):
        src = '"""Vendors sutram into insetu. More detail here."""\nimport os\n'
        self.assertEqual(describe_source_file("scripts/vendor_lock.py", src), "Vendors sutram into insetu.")

    def test_test_module_falls_back_to_first_class_docstring(self):
        src = 'import unittest\n\nclass TestX(unittest.TestCase):\n    """Checks the lifeboat refuses writes outside the workspace."""\n'
        self.assertEqual(describe_source_file("tests/unit/test_x.py", src), "Checks the lifeboat refuses writes outside the workspace.")

    def test_regular_module_does_not_borrow_a_class_docstring(self):
        src = 'class Helper:\n    """Helps."""\n'
        self.assertEqual(describe_source_file("pkg/helper.py", src), "")

    def test_broken_python_yields_nothing(self):
        self.assertEqual(describe_source_file("pkg/broken.py", "def broken(:\n"), "")

    def test_js_leading_line_comments_skip_the_path_comment(self):
        src = "// sutram-boot.js\n// Stage 1 Bootloader: Vendorization & DOM Guardrails\n\n(async function() {})();\n"
        self.assertEqual(describe_source_file("sutram/js/sutram-boot.js", src), "Stage 1 Bootloader: Vendorization & DOM Guardrails")

    def test_js_file_jsdoc_followed_by_import(self):
        src = "/**\n * Shared chassis styles for every panel.\n */\nimport { css } from 'lit';\n"
        self.assertEqual(describe_source_file("yenvui/js/shared_styles.js", src), "Shared chassis styles for every panel.")

    def test_js_jsdoc_attached_to_a_declaration_is_not_a_file_description(self):
        src = "/**\n * Formats currency.\n */\nexport function formatCurrency(amount) {}\n"
        self.assertEqual(describe_source_file("ui/format.js", src), "")


class TestMapRepositoriesFileFallback(unittest.TestCase):
    """map_repositories describes a new file from its docstring when the index has no line for it."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root_path = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root_path / ".insetu"
        (self.control_dir / "cache" / "db").mkdir(parents=True, exist_ok=True)
        self.repo_dir = self.root_path / "alpha"
        self.repo_dir.mkdir(parents=True, exist_ok=True)
        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        akasa.reset_state(cwd=self.root_path.as_posix(), control_dir=".insetu")
        (self.control_dir / "host.json").write_text(json.dumps({"port": 5005}), encoding="utf-8")
        (self.control_dir / "workspaces.json").write_text(
            json.dumps({"workspaces": {"default": {"config_path": "config.json"}}, "active_workspace": "default"}),
            encoding="utf-8",
        )
        (self.control_dir / "config.json").write_text(
            json.dumps({
                "workspace_root": self.root_path.as_posix(),
                "extensions": ["config", "cartographer", "bridge"],
                "target_repos": [{"repo_dir": "alpha", "title": "Alpha", "exts": [".py", ".md"]}],
            }),
            encoding="utf-8",
        )
        _init_worker_schema("default")
        apply_declarative_schema("topology", TOPOLOGY_SCHEMA, "default")
        apply_declarative_schema("cartographer", CARTOGRAPHER_SCHEMA, "default")
        apply_declarative_schema("bridge", BRIDGE_SCHEMA, "default")
        mount_topology_volumes_dynamically(load_config("default"), workspace_id="default")

    def tearDown(self):
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def _index_line(self, name):
        text = (self.repo_dir / "CODE_INDEX.md").read_text(encoding="utf-8")
        return next(line for line in text.splitlines() if f"── {name}" in line)

    def test_new_file_with_docstring_gets_a_description_and_index_text_still_wins(self):
        (self.repo_dir / "documented.py").write_text('"""Parses widget manifests."""\n', encoding="utf-8")
        (self.repo_dir / "kept.py").write_text('"""Docstring that must not override the index."""\n', encoding="utf-8")
        (self.repo_dir / "bare.py").write_text("X = 1\n", encoding="utf-8")
        (self.repo_dir / "CODE_INDEX.md").write_text(
            "# Alpha Code Index\n\n```text\nalpha/\n"
            "├── CODE_INDEX.md                   # Index file\n"
            "└── kept.py                         # Hand-written description.\n```\n",
            encoding="utf-8",
        )
        force_topology_scan(workspace_id="default")
        map_repositories("default", silent=True)
        sync_vfs_barrier("default")
        self.assertIn("# Parses widget manifests.", self._index_line("documented.py"))
        self.assertIn("# Hand-written description.", self._index_line("kept.py"))
        self.assertIn("# [comment required]", self._index_line("bare.py"))

    def test_genesis_patch_comment_describes_the_new_file(self):
        (self.repo_dir / "CODE_INDEX.md").write_text(
            "# Alpha Code Index\n\n```text\nalpha/\n├── CODE_INDEX.md                   # Index file\n```\n",
            encoding="utf-8",
        )
        force_topology_scan(workspace_id="default")
        map_repositories("default", silent=True)
        sync_vfs_barrier("default")
        marker = "<" * 7
        patch = "\n".join([
            f"{marker} FILE: vfs://alpha/widgets.py",
            f"{marker} COMMENT",
            "Parses widget manifests into typed records. Added for the importer.",
            f"{marker} SEARCH",
            "=" * 7,
            '"""Module docstring that loses to the genesis comment."""',
            "X = 1",
            ">" * 7 + " REPLACE",
        ])
        result = json.loads(execute_bridge_sync("default", {"text": patch, "dry_run": False, "pinned_repos": ["ALL"]}))
        self.assertEqual(result["status"], "committed", result)
        sync_vfs_barrier("default")
        force_topology_scan(workspace_id="default")
        map_repositories("default", silent=True)
        sync_vfs_barrier("default")
        self.assertIn("# Parses widget manifests into typed records.", self._index_line("widgets.py"))


if __name__ == "__main__":
    unittest.main()
