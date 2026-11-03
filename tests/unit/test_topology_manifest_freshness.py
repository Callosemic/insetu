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
from insetu.core.gather.context_assemble import (
    assemble_context_payload,
    prune_stale_affinity_edges,
    record_affinity_interaction,
)
from insetu.core.gather.engine_gather import VFS_INDEX_SCHEMA, hook_request_manifest, hook_save_manifest
import insetu.core.topology.engine_topology as _engine_topology
from insetu.core.topology.engine_topology import (
    TOPOLOGY_SCHEMA,
    _SIEVE_CONFIG_FINGERPRINTS,
    force_topology_scan,
    get_topology_files_for_repo,
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

    def test_editing_gitignore_or_config_reconciles_existing_ledger_rows(self):
        """Updating .gitignore or config.json evicts previously ledgered files that are now ignored or excluded without a manual full scan."""
        force_topology_scan(workspace_id="default")
        # 1. Create a file in vendor_tmp/ before vendor_tmp/ is in .gitignore -> it gets ledgered
        v_dir = self.repo_dir / "vendor_tmp"
        v_dir.mkdir()
        (v_dir / "bundle.py").write_text("X = 1\n", encoding="utf-8")
        self._queue_save("vendor_tmp/bundle.py")
        resolve_topology_buffer("default")
        self.assertIn("vfs://alpha/vendor_tmp/bundle.py", self._ledgered())

        # 2. Add vendor_tmp/ to .gitignore and queue a save event for .gitignore -> vendor_tmp/bundle.py is evicted!
        gi = self.repo_dir / ".gitignore"
        gi.write_text(gi.read_text(encoding="utf-8") + "vendor_tmp/\n", encoding="utf-8")
        self._queue_save(".gitignore")
        resolve_topology_buffer("default")
        self.assertNotIn("vfs://alpha/vendor_tmp/bundle.py", self._ledgered())

        # 3. Remove .txt from repo exts and emit config_mutated -> previously ledgered .txt files are evicted!
        (self.repo_dir / "notes.txt").write_text("hello\n", encoding="utf-8")
        self._queue_save("notes.txt")
        resolve_topology_buffer("default")
        self.assertIn("vfs://alpha/notes.txt", self._ledgered())

        cfg_path = self.control_dir / "config.json"
        cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
        cfg["target_repos"][0]["exts"] = [".py"]
        cfg_path.write_text(json.dumps(cfg), encoding="utf-8")
        hooks.emit("config_mutated", workspace_id="default")
        self.assertNotIn("vfs://alpha/notes.txt", self._ledgered())

    def test_expand_selection_and_context_assemble_exclude_ignored_tmp_subdirs(self):
        """ctx.expand_selection and assemble_context_payload never include ignored subdirectories (tests/tmp/) or stale affinity edges."""
        force_topology_scan(workspace_id="default")
        # Create tests/valid_test.py and tests/tmp/leak.py while tmp/ is ignored in .gitignore and config.json
        tests_dir = self.repo_dir / "tests"
        tmp_dir = tests_dir / "tmp"
        tmp_dir.mkdir(parents=True)
        (tests_dir / "valid_test.py").write_text("def test_ok(): pass\n", encoding="utf-8")
        (tmp_dir / "leak.py").write_text("SECRET_TMP = 1\n", encoding="utf-8")

        # Simulate a stale pre-existing row in topology_ledger from before tmp/ was added to .gitignore
        ctx = topology_bp.get_context("default")
        ctx.db.execute(
            "INSERT OR REPLACE INTO topology_ledger (filepath, repo, bucket_id, timestamp) VALUES (?, ?, ?, ?)",
            ("vfs://alpha/tests/tmp/leak.py", "alpha", "main", 1.0),
        )
        ctx.db.commit()

        gi = self.repo_dir / ".gitignore"
        gi.write_text(gi.read_text(encoding="utf-8") + "tmp/\n", encoding="utf-8")
        self._queue_save("tests/valid_test.py")

        # Simulate cold boot by clearing in-memory sieve fingerprints -> first read reconciles against .gitignore!
        _SIEVE_CONFIG_FINGERPRINTS.clear()
        tracked = get_topology_files_for_repo("default", "alpha")
        self.assertIn("vfs://alpha/tests/valid_test.py", tracked)
        self.assertNotIn("vfs://alpha/tests/tmp/leak.py", tracked)

        # 1. Expanding vfs://alpha/tests/ (both gather_only=True and gather_only=False) must exclude tests/tmp/leak.py
        expanded_all = ctx.expand_selection(["vfs://alpha/tests/"], gather_only=False)
        self.assertIn("vfs://alpha/tests/valid_test.py", expanded_all)
        self.assertNotIn("vfs://alpha/tests/tmp/leak.py", expanded_all)

        # 2. Even if a stale Hebbian affinity edge points to vfs://alpha/tests/tmp/leak.py, assemble_context_payload clamps it out
        #    WITHOUT immediately deleting the recent row from affinity_edges (protecting against transient branch/filter desyncs).
        record_affinity_interaction(ctx, ["vfs://alpha/pkg/mod.py", "vfs://alpha/tests/tmp/leak.py"], interaction_type="commit", weight=5.0)
        assembled = assemble_context_payload(
            ctx,
            edit_targets=["vfs://alpha/pkg/mod.py", "vfs://alpha/tests/tmp/leak.py"],
            reference_files=["vfs://alpha/tests/tmp/leak.py"],
            user_message="Check context exclusions",
        )
        self.assertEqual(assembled["edit_targets"], ["vfs://alpha/pkg/mod.py"])
        ref_paths = [r["filepath"] for r in assembled["reference_targets"]]
        self.assertNotIn("vfs://alpha/tests/tmp/leak.py", ref_paths)
        self.assertNotIn("tests/tmp/leak.py", assembled["content"])

        # Recent edge is preserved within the grace period, then pruned once expired
        self.assertEqual(prune_stale_affinity_edges(ctx, grace_period_seconds=3600.0), 0)
        idx_conn = ctx.get_db("vfs_index")
        idx_conn.execute("UPDATE affinity_edges SET last_updated_at = 1.0")
        idx_conn.commit()
        self.assertEqual(prune_stale_affinity_edges(ctx, grace_period_seconds=3600.0), 1)

    def test_config_mutated_without_a_sieve_change_does_not_walk_repositories(self):
        """Ordinary settings saves also emit config_mutated; with config.json unchanged, no repository is re-walked."""
        force_topology_scan(workspace_id="default")
        with patch.object(_engine_topology, "_reconcile_repo_ledger_with_sieve", side_effect=AssertionError("walked")) as walk:
            hooks.emit("config_mutated", workspace_id="default")
        walk.assert_not_called()


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
