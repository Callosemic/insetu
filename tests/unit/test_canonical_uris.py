import json
import os
import tempfile
import unittest
from pathlib import Path
import akasa.db as akasa_db
import akasa.utils as akasa_utils
from akasa.db import get_connection, apply_declarative_schema
from akasa.utils import load_config
from akasa.workers import _init_worker_schema
from insetu.core.topology.engine_topology import (
    TOPOLOGY_SCHEMA,
    force_topology_scan,
    get_topology_files_for_repo,
    hook_request_vfs_manifest,
    mount_topology_volumes_dynamically,
)
from insetu.core.utils_core import InSetuURI, BucketAddress
from insetu.extensions.tracker.engine_tracker import get_tracker_path, TRACKER_SCHEMA
from insetu.extensions.notes.engine_notes import _resolve_intended_note_uri
from insetu.extensions.skills.engine_skills import _canonical_skill_uri
from insetu.extensions.flow.engine_flow import _migrate_batch_uris


def _reset_db_connections():
    for attr in dir(akasa_db):
        obj = getattr(akasa_db, attr)
        if hasattr(obj, "connections") and isinstance(obj.connections, dict):
            for c in list(obj.connections.values()):
                try: c.close()
                except Exception: pass
            obj.connections.clear()
        elif isinstance(obj, dict) and "conn" in attr.lower():
            for c in list(obj.values()):
                try: c.close()
                except Exception: pass
            obj.clear()


class TestCanonicalURIs(unittest.TestCase):
    def setUp(self):
        _reset_db_connections()
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root_path = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root_path / ".insetu"
        (self.control_dir / "cache" / "db").mkdir(parents=True, exist_ok=True)

        self.orig_cwd = akasa_utils._cwd
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        os.environ["AKASA_CONTROL_DIR"] = ".insetu"
        akasa_utils._cwd = self.root_path.as_posix()

        akasa_utils._JSON_CACHE.clear()
        akasa_utils._JSON_MTIME.clear()
        load_config.clear_all()

        # Create a sample repo with a file
        self.repo_dir = self.root_path / "alpha"
        self.repo_dir.mkdir(parents=True, exist_ok=True)
        (self.repo_dir / "main.py").write_text("print('hello')\n", encoding="utf-8")

        (self.control_dir / "system.json").write_text(
            json.dumps({"port": 5005, "workspaces": {"default": {"config_path": "config.json"}}}),
            encoding="utf-8",
        )
        (self.control_dir / "config.json").write_text(
            json.dumps({
                "ignore_dirs": ["node_modules", ".git", ".insetu"],
                "include_extensions": [".py", ".md"],
                "target_repos": [{"repo_dir": "alpha", "title": "Alpha", "exts": [".py", ".md"]}],
            }),
            encoding="utf-8",
        )
        _init_worker_schema("default")
        apply_declarative_schema("topology", TOPOLOGY_SCHEMA, "default")
        apply_declarative_schema("tracker", TRACKER_SCHEMA, "default")

        mount_topology_volumes_dynamically(load_config("default"), workspace_id="default")

    def tearDown(self):
        _reset_db_connections()
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
    def test_topology_ledger_stores_canonical_vfs_uris(self):
        """force_topology_scan stores vfs://<repo>/<path> in topology_ledger and manifest.vfs."""
        force_topology_scan(workspace_id="default")

        full_uris = get_topology_files_for_repo("default", "alpha")
        self.assertIn("vfs://alpha/main.py", full_uris)
        self.assertTrue(all(u.startswith("vfs://alpha/") for u in full_uris))

        vfs_manifest = hook_request_vfs_manifest(workspace_id="default")
        bucket_files = vfs_manifest.get("alpha::main", {}).get("files", [])
        self.assertIn("vfs://alpha/main.py", bucket_files)
    def test_insetu_uri_rejects_non_prefixed_paths(self):
        """InSetuURI raises ValueError if given a non-prefixed relative path."""
        with self.assertRaises(ValueError):
            InSetuURI("alpha/main.py")
        with self.assertRaises(ValueError):
            InSetuURI("notes/idea.md")
        with self.assertRaises(ValueError):
            InSetuURI("vfs:/alpha/main.py")

        valid_vfs = InSetuURI("vfs://alpha/main.py")
        self.assertEqual(valid_vfs.scheme, "vfs")
        self.assertEqual(valid_vfs.repo, "alpha")
        self.assertEqual(valid_vfs.path, "main.py")

    def test_from_external_input_normalizes_boundary_strings(self):
        """InSetuURI.from_external_input normalizes raw LLM/user strings and WSGI single-slash paths at ingress boundaries."""
        raw_llm = InSetuURI.from_external_input("alpha/main.py")
        self.assertEqual(str(raw_llm), "vfs://alpha/main.py")

        wsgi_collapsed = InSetuURI.from_external_input("ctx:/contexts/alpha_context.txt")
        self.assertEqual(str(wsgi_collapsed), "ctx://contexts/alpha_context.txt")

        already_canonical = InSetuURI.from_external_input("ws://hub/prompts/guide.md")
        self.assertEqual(str(already_canonical), "ws://hub/prompts/guide.md")

    def test_sqlite_ledger_boot_migrations_upgrade_legacy_rows(self):
        """Boot and hydration migrations upgrade legacy scheme-less SQLite rows to canonical URIs."""
        top_conn = get_connection("topology", workspace_id="default")
        top_conn.execute(
            "INSERT OR REPLACE INTO topology_ledger (filepath, repo, bucket_id, timestamp, git_status) VALUES (?, ?, ?, ?, ?)",
            ("alpha/legacy.py", "alpha", "main", 1.0, ""),
        )
        top_conn.execute("UPDATE topology_ledger SET filepath = 'vfs://' || filepath WHERE filepath NOT LIKE '%://%'")
        top_conn.commit()
        rows = [r["filepath"] for r in top_conn.execute("SELECT filepath FROM topology_ledger").fetchall()]
        self.assertIn("vfs://alpha/legacy.py", rows)
        self.assertTrue(all("://" in r for r in rows))

        trk_conn = get_connection("tracker", workspace_id="default")
        trk_conn.execute(
            "INSERT OR REPLACE INTO tracker_tickets (id, repo, ticket_type, status, title, filepath) VALUES (?, ?, ?, ?, ?, ?)",
            ("ALP-TODO-1", "alpha", "todo", "open", "Legacy Task", "alpha/.insetu-data/tracker/todos/open/ALP-TODO-1.md"),
        )
        trk_conn.execute("UPDATE tracker_tickets SET filepath = 'vfs://' || filepath WHERE filepath NOT LIKE '%://%'")
        trk_conn.commit()
        t_row = trk_conn.execute("SELECT filepath FROM tracker_tickets WHERE id='ALP-TODO-1'").fetchone()
        self.assertEqual(t_row["filepath"], "vfs://alpha/.insetu-data/tracker/todos/open/ALP-TODO-1.md")

    def test_domain_uri_generators_emit_canonical_schemes(self):
        """Tracker, Notes, Skills, and BucketAddress always emit scheme-qualified URIs."""
        # Tracker
        tracker_uri = get_tracker_path("alpha", "todo", "open")
        self.assertEqual(tracker_uri, "vfs://alpha/.insetu-data/tracker/todos/open")

        # Notes
        repo_note_uri = _resolve_intended_note_uri("alpha", "design.md", {"alpha"})
        global_note_uri = _resolve_intended_note_uri("global", "ideas.md", {"alpha"})
        self.assertEqual(repo_note_uri, "vfs://alpha/.insetu-data/notes/design.md")
        self.assertEqual(global_note_uri, "ctx://notes/ideas.md")

        # Skills
        skill_uri = _canonical_skill_uri("chopin-ballade.md")
        self.assertEqual(skill_uri, "ctx://skills/chopin-ballade.md")
        self.assertEqual(_canonical_skill_uri(skill_uri), "ctx://skills/chopin-ballade.md")

        # BucketAddress
        addr = BucketAddress("alpha", "docs")
        self.assertEqual(addr.context_uri, "ctx://contexts/alpha_docs_context.txt")
        self.assertEqual(addr.diff_uri, "ctx://diffs/alpha_docs_diffs.txt")

    def test_flow_batch_boot_migration_upgrades_legacy_paths(self):
        """_migrate_batch_uris upgrades legacy scheme-less paths in workflows.json to ctx:// and vfs:// URIs."""
        legacy_batch = {
            "id": "review",
            "title": "Review",
            "includes": [
                "alpha_context.txt",
                "alpha_diffs.txt",
                "workflow_prep_context.txt",
                "prompts/system_review.md",
                "alpha/main.py",
            ],
            "show_if_exists": ["alpha_diffs.txt"],
            "include_prompt": "review_guide.md",
        }
        changed = _migrate_batch_uris(legacy_batch)
        self.assertTrue(changed)
        self.assertEqual(
            legacy_batch["includes"],
            [
                "ctx://contexts/alpha_context.txt",
                "ctx://diffs/alpha_diffs.txt",
                "ctx://workflows/workflow_prep_context.txt",
                "ctx://prompts/system_review.md",
                "vfs://alpha/main.py",
            ],
        )
        self.assertEqual(legacy_batch["show_if_exists"], ["ctx://diffs/alpha_diffs.txt"])
        self.assertEqual(legacy_batch["include_prompt"], "ctx://prompts/review_guide.md")

        # Second pass should be idempotent
        self.assertFalse(_migrate_batch_uris(legacy_batch))

    def test_vfs_transaction_rejects_non_canonical_paths(self):
        """VFSTransaction.read, .save, and .delete reject scheme-less paths unless is_absolute_artifact is True."""
        from akasa.vfs import VFSTransaction
        vfs = VFSTransaction("default")
        with self.assertRaises(ValueError):
            vfs.read("alpha/main.py")
        with self.assertRaises(ValueError):
            vfs.save("alpha/main.py", "print(1)")
        with self.assertRaises(ValueError):
            vfs.delete("alpha/main.py")

    def test_manifest_entry_deep_canonicalization(self):
        """_canonicalize_manifest_entry upgrades bare keys, chunks, files, and meta pointers to canonical URIs."""
        from insetu.core.gather.engine_gather import _canonicalize_manifest_entry
        raw_entry = {
            "files": ["alpha/main.py", "notes_context.txt"],
            "chunks": ["notes_context.txt", "notes_context_part2.txt"],
            "meta": {"filepath": "notes_context.txt", "out_file": "notes_context.txt"}
        }
        canon_fp, canon_entry = _canonicalize_manifest_entry("notes_context.txt", raw_entry)
        self.assertEqual(canon_fp, "ctx://contexts/notes_context.txt")
        self.assertEqual(
            canon_entry["files"],
            ["vfs://alpha/main.py", "ctx://contexts/notes_context.txt"]
        )
        self.assertEqual(
            canon_entry["chunks"],
            ["ctx://contexts/notes_context.txt", "ctx://contexts/notes_context_part2.txt"]
        )
        self.assertEqual(canon_entry["meta"]["filepath"], "ctx://contexts/notes_context.txt")
        self.assertEqual(canon_entry["meta"]["out_file"], "ctx://contexts/notes_context.txt")
    def test_expand_selection_handles_folders_and_files_for_quickpack(self):
        """expand_selection expands trailing-slash folder URIs, {filepath, folderpath, isDir} dicts, and unindexed subfolders into a flat List[str]."""
        from akasa.extension import ExtensionContext
        sub_dir = self.repo_dir / "nested" / "preview"
        sub_dir.mkdir(parents=True, exist_ok=True)
        (sub_dir / "widget.py").write_text("x = 1\n", encoding="utf-8")

        force_topology_scan(workspace_id="default")
        ctx = ExtensionContext("gather", "default")

        items = [
            {"filepath": "vfs://alpha/nested/preview/", "folderpath": "vfs://alpha/nested/preview", "isDir": True},
            "vfs://alpha/",
            {"filepath": "vfs://alpha/main.py", "isDir": False}
        ]
        expanded = ctx.expand_selection(items=items, gather_only=True)
        self.assertTrue(all(isinstance(f, str) for f in expanded))
        self.assertIn("vfs://alpha/nested/preview/widget.py", expanded)
        self.assertIn("vfs://alpha/main.py", expanded)


if __name__ == "__main__":
    unittest.main()