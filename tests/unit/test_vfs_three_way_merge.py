import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from flask import Flask
import akasa
import akasa.db as akasa_db
import akasa.utils as akasa_utils
from akasa.utils import load_config
from akasa.vfs import sync_vfs_barrier
from akasa.workers import _init_worker_schema
import insetu.core.editor.engine_editor as engine_editor
from insetu.core.fs.engine_fs import fs_bp
from insetu.core.utils_core import (
    three_way_merge_text as _three_way_merge_text,
    record_vfs_ancestor as _record_ancestor,
    lookup_vfs_ancestor as _lookup_ancestor,
    compute_vfs_sha256 as _compute_sha256,
)
from insetu.core.topology.engine_topology import mount_topology_volumes_dynamically


class TestVfsThreeWayMerge(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root_path = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root_path / ".insetu"
        (self.control_dir / "cache" / "db").mkdir(parents=True, exist_ok=True)
        self.repo_dir = self.root_path / "drafts"
        self.repo_dir.mkdir(parents=True, exist_ok=True)

        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        akasa.reset_state(cwd=self.root_path.as_posix(), control_dir=".insetu")

        (self.control_dir / "system.json").write_text(
            json.dumps({"port": 5005, "workspaces": {"default": {"config_path": "config.json"}}}),
            encoding="utf-8",
        )
        (self.control_dir / "config.json").write_text(
            json.dumps({
                "workspace_root": self.root_path.as_posix(),
                "extensions": ["config", "publish"],
                "target_repos": [{"repo_dir": "drafts", "title": "Drafts", "exts": [".md"]}],
            }),
            encoding="utf-8",
        )
        _init_worker_schema("default")
        w_conn = akasa_db.get_connection("workers", workspace_id="default")
        w_conn.execute("""
            CREATE TABLE IF NOT EXISTS vfs_event_log (
                filepath TEXT PRIMARY KEY,
                mutation_type TEXT,
                timestamp REAL
            )
        """)
        w_conn.commit()
        mount_topology_volumes_dynamically(load_config("default"), workspace_id="default")

        self.app = Flask(__name__)
        self.app.register_blueprint(fs_bp.bp)
        self.client = self.app.test_client()

    def tearDown(self):
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def test_disjoint_paragraphs_merge_cleanly(self):
        base = "Paragraph 1: Original intro.\n\nParagraph 2: Middle section.\n\nParagraph 3: Original conclusion.\n"
        disk = "Paragraph 1: Edited intro on Tablet.\n\nParagraph 2: Middle section.\n\nParagraph 3: Original conclusion.\n"
        incoming = "Paragraph 1: Original intro.\n\nParagraph 2: Middle section.\n\nParagraph 3: Edited conclusion on Laptop.\n"

        ok, merged = _three_way_merge_text(base, disk, incoming)
        self.assertTrue(ok)
        self.assertIn("Edited intro on Tablet.", merged)
        self.assertIn("Edited conclusion on Laptop.", merged)
        self.assertIn("Middle section.", merged)

    def test_zombie_ack_superset_replay_merges_cleanly(self):
        """
        Simulates a dropped HTTP response at the park:
        - Server started at V0 (base).
        - Save #1 (V1) reached the server and updated disk to V1, but the ACK was lost.
        - User kept typing offline to produce V2 and replayed Save #2 with base=V0.
        """
        v0 = "# Essay Draft\n\nFirst paragraph.\n"
        v1 = "# Essay Draft\n\nFirst paragraph.\n\nSecond paragraph added at park.\n"
        v2 = "# Essay Draft\n\nFirst paragraph.\n\nSecond paragraph added at park.\n\nThird paragraph added while offline.\n"

        ok, merged = _three_way_merge_text(v0, v1, v2)
        self.assertTrue(ok)
        self.assertEqual(merged, v2)
    def test_true_same_line_collision_flags_conflict(self):
        base = "Line 1\nShared target line\nLine 3\n"
        disk = "Line 1\nTablet rewrote target line A\nLine 3\n"
        incoming = "Line 1\nLaptop rewrote target line B\nLine 3\n"

        ok, _ = _three_way_merge_text(base, disk, incoming)
        self.assertFalse(ok)

    def test_same_line_substring_collision_does_not_false_positive_merge(self):
        base = "Header\ncat\nFooter\n"
        disk = "Header\ncat!\nFooter\n"
        incoming = "Header\nscatter!\nFooter\n"

        ok, _ = _three_way_merge_text(base, disk, incoming)
        self.assertFalse(ok)

    def test_ancestor_ring_buffer_lookup(self):
        text_v0 = "Initial content v0"
        h0 = _record_ancestor("default", "vfs://drafts/notes.md", text_v0)
        self.assertEqual(h0, _compute_sha256(text_v0))
        resolved = _lookup_ancestor("default", "vfs://drafts/notes.md", h0)
        self.assertEqual(resolved, text_v0)

    def test_api_fs_save_three_way_merge_and_conflict_fallback(self):
        """End-to-end route test: api_fs_save auto-merges disjoint concurrent saves and writes .conflict_ on true collisions."""
        target_uri = "vfs://drafts/collab.md"
        v0 = "Header: Shared Essay\n\nSection A: Original\n\nSection B: Original\n"
        (self.repo_dir / "collab.md").write_text(v0, encoding="utf-8")

        # 1. Both Tablet and Laptop fetch V0
        fetch_res = self.client.get(f"/api/default/fs/fetch?file={target_uri}")
        self.assertEqual(fetch_res.status_code, 200)
        h0 = _compute_sha256(v0)

        # 2. Tablet edits Section A and saves with base_hash=h0
        v_tablet = "Header: Shared Essay\n\nSection A: Updated by Tablet\n\nSection B: Original\n"
        res_tab = self.client.post("/api/default/fs/save", json={
            "filepath": target_uri,
            "content": v_tablet,
            "base_hash": h0,
        })
        self.assertEqual(res_tab.status_code, 200)
        sync_vfs_barrier("default")

        # 3. Laptop edits Section B and saves with stale base_hash=h0 (without even needing base_content!)
        v_laptop = "Header: Shared Essay\n\nSection A: Original\n\nSection B: Updated by Laptop\n"
        res_lap = self.client.post("/api/default/fs/save", json={
            "filepath": target_uri,
            "content": v_laptop,
            "base_hash": h0,
        })
        self.assertEqual(res_lap.status_code, 200)
        lap_data = res_lap.get_json()
        self.assertEqual(lap_data["status"], "merged")
        self.assertIn("Updated by Tablet", lap_data["merged_content"])
        self.assertIn("Updated by Laptop", lap_data["merged_content"])
        sync_vfs_barrier("default")

        disk_merged = (self.repo_dir / "collab.md").read_text(encoding="utf-8")
        self.assertEqual(disk_merged, lap_data["merged_content"])
        conflict_files = list(self.repo_dir.glob("collab.conflict_*.md"))
        self.assertEqual(len(conflict_files), 0)

        # 4. True same-line collision with stale base_hash=h0 -> creates .conflict_<ts>.md and returns 409
        v_collision = "Header: Shared Essay\n\nSection A: Colliding edit on Section A\n\nSection B: Original\n"
        res_col = self.client.post("/api/default/fs/save", json={
            "filepath": target_uri,
            "content": v_collision,
            "base_hash": h0,
        })
        self.assertEqual(res_col.status_code, 409)
        sync_vfs_barrier("default")
        conflict_files_after = list(self.repo_dir.glob("collab.conflict_*.md"))
        self.assertEqual(len(conflict_files_after), 1)
        self.assertEqual(conflict_files_after[0].read_text(encoding="utf-8"), v_collision)


if __name__ == "__main__":
    unittest.main()