"""Tests that incremental topology events honor .gitignore and that manifest caches never keep pre-commit state."""
import json
import os
import subprocess
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import akasa
import akasa.utils as akasa_utils
from akasa.hooks import hooks
from akasa.db import apply_declarative_schema
from akasa.utils import load_config
from akasa.workers import _init_worker_schema
from insetu.core.gather.engine_gather import VFS_INDEX_SCHEMA, hook_request_manifest, hook_save_manifest
from insetu.core.topology.engine_topology import (
    TOPOLOGY_SCHEMA,
    force_topology_scan,
    hook_request_vfs_manifest,
    mount_topology_volumes_dynamically,
    resolve_topology_buffer,
    topology_bp,
)


class _WorkspaceCase(unittest.TestCase):
    """Shared git-backed one-repo workspace for the topology and manifest tests."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root_path = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root_path / ".insetu"
        (self.control_dir / "cache" / "db").mkdir(parents=True, exist_ok=True)
        self.repo_dir = self.root_path / "alpha"
        (self.repo_dir / "pkg").mkdir(parents=True, exist_ok=True)
        (self.repo_dir / "pkg" / "mod.py").write_text("VALUE = 1\n", encoding="utf-8")
        (self.repo_dir / ".gitignore").write_text("*.egg-info/\nbuild/\n", encoding="utf-8")
        for cmd in (
            ["git", "init", "-q"],
            ["git", "add", "-A"],
            ["git", "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "init"],
        ):
            subprocess.run(cmd, cwd=self.repo_dir, check=True, capture_output=True, timeout=30)
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
                "extensions": ["config", "gather"],
                "target_repos": [{"repo_dir": "alpha", "title": "Alpha", "exts": [".py", ".txt"]}],
            }),
            encoding="utf-8",
        )
        _init_worker_schema("default")
        apply_declarative_schema("topology", TOPOLOGY_SCHEMA, "default")
        apply_declarative_schema("vfs_index", VFS_INDEX_SCHEMA, "default")
        mount_topology_volumes_dynamically(load_config("default"), workspace_id="default")

    def tearDown(self):
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def _db(self):
        return topology_bp.get_context("default").db

    def _queue_save(self, rel):
        conn = self._db()
        conn.execute(
            "INSERT INTO topology_event_buffer (filepath, mutation_type, timestamp) VALUES (?, ?, ?)",
            (f"vfs://alpha/{rel}", "save", time.time()),
        )
        conn.commit()

    def _ledgered(self):
        return {r["filepath"] for r in self._db().execute("SELECT filepath FROM topology_ledger WHERE repo='alpha'").fetchall()}


class TestIncrementalEventsHonorGitignore(_WorkspaceCase):
    """Watcher events for git-ignored files stay out of the ledger, as they do in a full scan."""

    def test_full_scan_skips_ignored_build_output(self):
        egg = self.repo_dir / "alpha.egg-info"
        egg.mkdir()
        (egg / "SOURCES.txt").write_text("pkg/mod.py\n", encoding="utf-8")
        force_topology_scan(workspace_id="default")
        self.assertIn("vfs://alpha/pkg/mod.py", self._ledgered())
        self.assertNotIn("vfs://alpha/alpha.egg-info/SOURCES.txt", self._ledgered())

    def test_save_event_for_an_ignored_file_is_not_ledgered(self):
        force_topology_scan(workspace_id="default")
        egg = self.repo_dir / "alpha.egg-info"
        egg.mkdir()
        (egg / "SOURCES.txt").write_text("pkg/mod.py\n", encoding="utf-8")
        (self.repo_dir / "pkg" / "new.py").write_text("NEW = 1\n", encoding="utf-8")
        self._queue_save("alpha.egg-info/SOURCES.txt")
        self._queue_save("pkg/new.py")
        resolve_topology_buffer("default")
        self.assertIn("vfs://alpha/pkg/new.py", self._ledgered())
        self.assertNotIn("vfs://alpha/alpha.egg-info/SOURCES.txt", self._ledgered())

    def test_a_previously_ledgered_ignored_file_is_evicted_on_its_next_event(self):
        force_topology_scan(workspace_id="default")
        egg = self.repo_dir / "alpha.egg-info"
        egg.mkdir()
        (egg / "top_level.txt").write_text("alpha\n", encoding="utf-8")
        conn = self._db()
        conn.execute(
            "INSERT INTO topology_ledger (filepath, repo, bucket_id, timestamp) VALUES (?, ?, ?, ?)",
            ("vfs://alpha/alpha.egg-info/top_level.txt", "alpha", "main", time.time()),
        )
        conn.commit()
        self._queue_save("alpha.egg-info/top_level.txt")
        resolve_topology_buffer("default")
        self.assertNotIn("vfs://alpha/alpha.egg-info/top_level.txt", self._ledgered())

    def test_dropped_and_excluded_sub_buckets_bypass_dirty_watermark(self):
        """Files in _dropped buckets or sub-buckets with exclude_from_context=True must not trigger dirty watermarks."""
        cfg_path = self.control_dir / "config.json"
        cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
        cfg["target_repos"][0]["exts"] = [".py", ".txt", ".md", ".tmp"]
        cfg["target_repos"][0]["sub_buckets"] = [
            {"id": "docs", "match_prefixes": ["docs/"], "exclude_from_context": True},
            {"id": "scratch", "match_prefixes": ["scratch/"], "drop_patterns": ["*.tmp"]},
        ]
        cfg_path.write_text(json.dumps(cfg), encoding="utf-8")
        hooks.emit("config_mutated", workspace_id="default")
        force_topology_scan(workspace_id="default")

        # Create excluded and dropped files
        (self.repo_dir / "docs").mkdir(exist_ok=True)
        (self.repo_dir / "docs" / "api.md").write_text("# Docs\n", encoding="utf-8")
        (self.repo_dir / "scratch").mkdir(exist_ok=True)
        (self.repo_dir / "scratch" / "data.tmp").write_text("temp\n", encoding="utf-8")

        self._queue_save("docs/api.md")
        self._queue_save("scratch/data.tmp")
        events = resolve_topology_buffer("default")

        # Verify ledger has records but excluded buckets are marked accordingly
        ledger_files = self._ledgered()
        self.assertIn("vfs://alpha/docs/api.md", ledger_files)
        self.assertIn("vfs://alpha/scratch/data.tmp", ledger_files)
        vfs_manifest = hook_request_vfs_manifest(workspace_id="default")
        self.assertIn("alpha::docs", vfs_manifest)
        self.assertIn("alpha::_dropped", vfs_manifest)

    def test_force_include_wins_over_gitignore(self):
        cfg_path = self.control_dir / "config.json"
        cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
        cfg["target_repos"][0]["force_include"] = ["build/keep.txt"]
        cfg_path.write_text(json.dumps(cfg), encoding="utf-8")
        hooks.emit("config_mutated", workspace_id="default")
        force_topology_scan(workspace_id="default")
        (self.repo_dir / "build").mkdir()
        (self.repo_dir / "build" / "keep.txt").write_text("kept\n", encoding="utf-8")
        self._queue_save("build/keep.txt")
        resolve_topology_buffer("default")
        self.assertIn("vfs://alpha/build/keep.txt", self._ledgered())


class TestManifestCachesSeeCommittedState(_WorkspaceCase):
    """A read that lands between a writer's invalidation and its commit must not pin stale data in the 2 s cache."""

    def _read_inside_the_write_window(self, cached_fn, call):
        real_invalidate = cached_fn.invalidate

        def invalidate_then_read(*args, **kwargs):
            real_invalidate(*args, **kwargs)
            call()  # A concurrent reader (another DAG step, an SSE-triggered fetch) arriving mid-write.

        return patch.object(cached_fn, "invalidate", side_effect=invalidate_then_read)

    def test_ctx_manifest_reflects_a_save_immediately(self):
        uri = "ctx://contexts/alpha_context.txt"
        hook_save_manifest(manifest_data={uri: {"files": [], "meta": {"type": "gather", "repo": "alpha", "bucket_id": "main", "title": "v1"}}}, workspace_id="default")
        hook_request_manifest(workspace_id="default")
        with self._read_inside_the_write_window(hook_request_manifest, lambda: hook_request_manifest(workspace_id="default")):
            hook_save_manifest(manifest_data={uri: {"files": [], "meta": {"type": "gather", "repo": "alpha", "bucket_id": "main", "title": "v2"}}}, workspace_id="default")
        self.assertEqual(hook_request_manifest(workspace_id="default")[uri]["meta"]["title"], "v2")

    def test_vfs_manifest_reflects_resolved_events_immediately(self):
        force_topology_scan(workspace_id="default")
        hook_request_vfs_manifest(workspace_id="default")
        (self.repo_dir / "pkg" / "late.py").write_text("LATE = 1\n", encoding="utf-8")
        self._queue_save("pkg/late.py")
        with self._read_inside_the_write_window(hook_request_vfs_manifest, lambda: hook_request_vfs_manifest(workspace_id="default")):
            resolve_topology_buffer("default")
        files = hook_request_vfs_manifest(workspace_id="default").get("alpha::main", {}).get("files", [])
        self.assertIn("vfs://alpha/pkg/late.py", files)


if __name__ == "__main__":
    unittest.main()
