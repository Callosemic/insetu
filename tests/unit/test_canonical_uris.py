import json
import os
import tempfile
import unittest
from pathlib import Path
import akasa
import akasa.db as akasa_db
import akasa.utils as akasa_utils
from akasa.db import get_connection, apply_declarative_schema
from akasa.utils import load_config
from akasa.workers import _init_worker_schema
from insetu.core.topology.engine_topology import (
    TOPOLOGY_SCHEMA,
    buffer_topology_events,
    force_topology_scan,
    get_topology_files_for_repo,
    hook_request_vfs_manifest,
    mount_topology_volumes_dynamically,
    resolve_topology_buffer,
)
from insetu.core.utils_core import InSetuURI, BucketAddress, heal_sqlite_uri_column
from insetu.extensions.tracker.engine_tracker import get_tracker_path, TRACKER_SCHEMA
from insetu.extensions.notes.engine_notes import _resolve_intended_note_uri
from insetu.extensions.skills.engine_skills import _canonical_skill_uri
from insetu.extensions.flow.engine_flow import _migrate_batch_uris, handle_flow_pre_save
from akasa.vfs import sync_vfs_barrier
from akasa.vfs import VFSTransaction
from flask import Flask
from insetu.core.fs.engine_fs import fs_bp
from insetu.core.prompts.engine_prompts import prompts_bp
from insetu.core.gather.engine_gather import (
    _background_compile,
    _canonicalize_manifest_entry,
    gather_bp,
    hook_request_manifest,
    VFS_INDEX_SCHEMA,
)
from insetu.extensions.flow.engine_flow import flow_bp, _background_compile_workflows
from akasa.extension import ExtensionContext
from insetu.core.utils_core import execute_binary


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
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root_path = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root_path / ".insetu"
        (self.control_dir / "cache" / "db").mkdir(parents=True, exist_ok=True)

        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        akasa.reset_state(cwd=self.root_path.as_posix(), control_dir=".insetu")

        # Create a sample repo with a file
        self.repo_dir = self.root_path / "alpha"
        self.repo_dir.mkdir(parents=True, exist_ok=True)
        (self.repo_dir / "main.py").write_text("print('hello')\n", encoding="utf-8")
        (self.control_dir / "host.json").write_text(
            json.dumps({"port": 5005}),
            encoding="utf-8",
        )
        (self.control_dir / "workspaces.json").write_text(
            json.dumps({
                "workspaces": {"default": {"config_path": "config.json"}},
                "active_workspace": "default",
            }),
            encoding="utf-8",
        )
        (self.control_dir / "config.json").write_text(
            json.dumps({
                "extensions": ["config", "flow"],
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
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
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
        self.assertGreater(vfs_manifest.get("alpha::main", {}).get("source_ts", 0), 0)

    def test_relational_watermark_lifecycle_from_mutation_to_gather_compile(self):
        """
        Verifies the Relational Watermark Contract end-to-end:
        1. Initial compile sets ctx['ctx://contexts/alpha_context.txt'].meta.timestamp >= vfs['alpha::main'].source_ts.
        2. Mutating vfs://alpha/main.py and resolving topology advances vfs['alpha::main'].source_ts > ctx.meta.timestamp.
        3. Running differential _background_compile (even when content_hash is idempotent) advances ctx.meta.timestamp >= vfs.source_ts.
        """
        apply_declarative_schema("vfs_index", VFS_INDEX_SCHEMA, "default")
        force_topology_scan(workspace_id="default")
        g_ctx = gather_bp.get_context("default")

        # 1. Initial full compile
        _background_compile(g_ctx, force_full=True)
        sync_vfs_barrier("default")
        vfs_m1 = hook_request_vfs_manifest(workspace_id="default")
        ctx_m1 = hook_request_manifest(workspace_id="default")
        source_ts_1 = vfs_m1["alpha::main"]["source_ts"]
        compiled_ts_1 = ctx_m1["ctx://contexts/alpha_context.txt"]["meta"]["timestamp"]
        self.assertGreaterEqual(compiled_ts_1, source_ts_1)

        # 2. Mutate file on disk and resolve topology buffer -> source_ts must exceed compiled_ts_1
        (self.repo_dir / "main.py").write_text("print('updated')\n", encoding="utf-8")
        top_conn = get_connection("topology", workspace_id="default")
        top_conn.execute(
            "INSERT INTO topology_event_buffer (filepath, mutation_type, timestamp) VALUES (?, ?, ?)",
            ("vfs://alpha/main.py", "save", compiled_ts_1 + 1.0),
        )
        top_conn.commit()
        events = resolve_topology_buffer("default")
        vfs_m2 = hook_request_vfs_manifest(workspace_id="default")
        source_ts_2 = vfs_m2["alpha::main"]["source_ts"]
        self.assertGreater(source_ts_2, compiled_ts_1, "Mutated bucket source_ts must exceed prior compiled timestamp")

        # 3. Differential compile settles watermark -> compiled_ts_2 >= source_ts_2
        _background_compile(gather_bp.get_context("default"), force_full=False, ledger_events=events)
        sync_vfs_barrier("default")
        ctx_m2 = hook_request_manifest(workspace_id="default")
        compiled_ts_2 = ctx_m2["ctx://contexts/alpha_context.txt"]["meta"]["timestamp"]
        self.assertGreaterEqual(compiled_ts_2, source_ts_2, "Compiled artifact timestamp must advance past bucket source_ts")
    def test_insetu_uri_rejects_non_prefixed_paths(self):
        """InSetuURI raises ValueError if given a non-prefixed relative path."""
        with self.assertRaises(ValueError):
            InSetuURI("alpha/main.py")
        with self.assertRaises(ValueError):
            InSetuURI("notes/idea.md")
        with self.assertRaises(ValueError):
            InSetuURI("vfs:/alpha/main.py")
        valid_vfs = InSetuURI("vfs://alpha/main.py")
        self.assertFalse(hasattr(valid_vfs, "__dict__"), "InSetuURI must declare __slots__ = () to preserve AkasaURI slotted layout")
        self.assertEqual(valid_vfs.scheme, "vfs")
        self.assertEqual(valid_vfs.repo, "alpha")
        self.assertEqual(valid_vfs.path, "main.py")

    def test_python_insetu_uri_manipulation_and_flow_archive_routing(self):
        """Python InSetuURI supports parent_uri, join, with_name, and resolve_sibling_uri, and handle_flow_pre_save archives prior dated files."""
        nested = InSetuURI("vfs://alpha/sotu/sotu_20261021.md")
        self.assertEqual(str(nested.parent_uri), "vfs://alpha/sotu")
        self.assertEqual(str(nested.with_name("sotu_20261022.md")), "vfs://alpha/sotu/sotu_20261022.md")
        self.assertEqual(str(nested.parent_uri.join("archive", "sotu_20261020.md")), "vfs://alpha/sotu/archive/sotu_20261020.md")
        self.assertEqual(str(nested.resolve_sibling_uri("sotu/archive/")), "vfs://alpha/sotu/archive")
        self.assertEqual(str(nested.resolve_sibling_uri("vfs://sotu/archive/")), "vfs://alpha/sotu/archive")

        # Verify handle_flow_pre_save moves previous dated response into repo's archive folder
        sotu_dir = self.repo_dir / "sotu"
        sotu_dir.mkdir(parents=True, exist_ok=True)
        old_file = sotu_dir / "sotu_20261001.md"
        old_file.write_text("Old SOTU content", encoding="utf-8")

        handle_flow_pre_save(
            workspace_id="default",
            filepath="vfs://alpha/sotu/sotu_20261021.md",
            content="New SOTU content",
            data={
                "original_response_path": "alpha/sotu/sotu_{date}.md",
                "archive_path": "sotu/archive/",
            },
        )
        sync_vfs_barrier("default")
        archived_file = self.repo_dir / "sotu" / "archive" / "sotu_20261001.md"
        self.assertTrue(archived_file.exists())
        self.assertEqual(archived_file.read_text(encoding="utf-8"), "Old SOTU content")
        self.assertFalse(old_file.exists())

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
        # Verify heal_sqlite_uri_column handles UNIQUE/PRIMARY KEY collisions between unprefixed and prefixed rows cleanly
        top_conn.execute(
            "INSERT OR REPLACE INTO topology_ledger (filepath, repo, bucket_id, timestamp, git_status) VALUES (?, ?, ?, ?, ?)",
            ("alpha/legacy.py", "alpha", "main", 0.5, ""),
        )
        top_conn.commit()
        heal_sqlite_uri_column(top_conn, "topology_ledger", "filepath", "vfs://")
        healed_rows = [r["filepath"] for r in top_conn.execute("SELECT filepath FROM topology_ledger").fetchall()]
        self.assertIn("vfs://alpha/legacy.py", healed_rows)
        self.assertNotIn("alpha/legacy.py", healed_rows)

        trk_conn = get_connection("tracker", workspace_id="default")
        trk_conn.execute(
            "INSERT OR REPLACE INTO tracker_tickets (id, repo, ticket_type, status, title, filepath) VALUES (?, ?, ?, ?, ?, ?)",
            ("ALP-TODO-1", "alpha", "todo", "open", "Legacy Task", "alpha/.insetu-data/tracker/todos/open/ALP-TODO-1.md"),
        )
        trk_conn.commit()
        heal_sqlite_uri_column(trk_conn, "tracker_tickets", "filepath", "vfs://")
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
        vfs = VFSTransaction("default")
        with self.assertRaises(ValueError):
            vfs.read("alpha/main.py")
        with self.assertRaises(ValueError):
            vfs.save("alpha/main.py", "print(1)")
        with self.assertRaises(ValueError):
            vfs.delete("alpha/main.py")
    def test_manifest_entry_deep_canonicalization(self):
        """_canonicalize_manifest_entry upgrades bare keys, chunks, files, and meta pointers to canonical URIs."""
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

    def test_frontend_insetu_uri_value_object_in_node(self):
        """Frontend InSetuURI in insetu_sdk.js preserves scheme:// across withName, parentUri, join, and pathSegments."""
        sdk_path = (Path(__file__).resolve().parent.parent.parent / "insetu" / "core" / "system" / "insetu_sdk.js").resolve()
        sdk_src = sdk_path.read_text(encoding="utf-8")
        self.assertIn("export class InSetuURI", sdk_src)

        node_script = """
import assert from 'node:assert/strict';

globalThis.window = { inSetu: { utils: {} } };
window.inSetu.utils.parseURI = function(pathStr) {
    if (!pathStr) {
        return { scheme: '', volume: '', repo: '', relativePath: '', filename: '', raw: '' };
    }
    let str = String(pathStr).replace(/\\\\/g, '/').trim();
    let scheme = '';
    const schemeMatch = str.match(/^([a-zA-Z0-9_-]+):\\/\\/(.*)$/);
    if (schemeMatch) {
        scheme = schemeMatch[1];
        str = schemeMatch[2];
    }
    str = str.replace(/^\\/+/, '');
    const parts = str.split('/').filter(Boolean);
    const volume = parts.length > 0 ? parts[0] : '';
    const repo = parts.length > 1 ? parts[0] : (scheme === 'vfs' ? volume : '');
    const relativePath = parts.length > 1 ? parts.slice(1).join('/') : (scheme === 'vfs' ? '' : str);
    const filename = parts[parts.length - 1] || '';
    return { scheme, volume, repo, relativePath, filename, raw: pathStr };
};
"""
        # Extract the exact InSetuURI class definition from insetu_sdk.js
        start_idx = sdk_src.index("export class InSetuURI {")
        end_idx = sdk_src.index("window.inSetu = window.inSetu || {};", start_idx)
        uri_class_code = sdk_src[start_idx:end_idx]

        assertions = """
// 1. Nested file rename preserves vfs:// scheme and parent path
const nestedFile = new InSetuURI('vfs://alpha/src/components/button.js');
assert.equal(nestedFile.basename, 'button.js');
assert.equal(nestedFile.parentUri, 'vfs://alpha/src/components');
assert.equal(nestedFile.withName('icon-button.js'), 'vfs://alpha/src/components/icon-button.js');
assert.deepEqual(nestedFile.pathSegments, ['alpha', 'src', 'components', 'button.js']);
assert.equal(nestedFile.isRootVolume, false);

// 2. Repo-root file rename preserves vfs://<repo>/<newName>
const repoFile = new InSetuURI('vfs://alpha/README.md');
assert.equal(repoFile.parentUri, 'vfs://alpha');
assert.equal(repoFile.withName('CONTRIBUTING.md'), 'vfs://alpha/CONTRIBUTING.md');

// 3. Subfolder rename & join
const subFolder = new InSetuURI('vfs://alpha/docs/guides/');
assert.equal(subFolder.isRootVolume, false);
assert.equal(subFolder.withName('reference'), 'vfs://alpha/docs/reference');
assert.equal(subFolder.join('intro.md'), 'vfs://alpha/docs/guides/intro.md');

// 4. Top-level repository volume detection
const repoRoot = new InSetuURI('vfs://alpha/');
assert.equal(repoRoot.isRootVolume, true);
"""
        full_script = f"{node_script}\n{uri_class_code}\n{assertions}"
        res = execute_binary(["node", "--input-type=module", "-e", full_script], timeout=10.0)
        self.assertEqual(res.returncode, 0, f"Frontend InSetuURI Node test failed:\n{res.stderr}")

    def test_multipart_chunk_resolution_and_self_healing_fetch(self):
        """
        End-to-end verification of multi-part ctx:// chunk resolution and self-healing:
        1. Compiles a multi-part workflow (> 1 chunk) where the un-suffixed base_uri does not exist on disk.
        2. Verifies expand_selection and ctx.read_compiled_context resolve all _partN.txt chunks seamlessly.
        3. Verifies GET /api/default/fs/fetch?file=<base_uri> resolves _part1.txt (200 OK, never 404).
        4. Deletes physical cache files and verifies GET /api/default/fs/fetch self-heals on demand.
        """
        apply_declarative_schema("vfs_index", VFS_INDEX_SCHEMA, "default")
        _ = gather_bp.get_context("default")
        wf_ctx = flow_bp.get_context("default")

        # Create two large files (~260 KB each) so the workflow exceeds the 400 KB chunk limit and splits into 2 parts
        part_a = "A" * 260000
        part_b = "B" * 260000
        (self.repo_dir / "part_a.py").write_text(part_a, encoding="utf-8")
        (self.repo_dir / "part_b.py").write_text(part_b, encoding="utf-8")

        wf_ctx.store.set("workflows.json", "context_batches", [{
            "id": "core_system_wrap",
            "title": "Core System Wrap",
            "domain": "Workflows",
            "includes": ["vfs://alpha/part_a.py", "vfs://alpha/part_b.py"],
        }])
        sync_vfs_barrier("default")

        _background_compile_workflows(wf_ctx, force_full=True)
        sync_vfs_barrier("default")

        base_uri = "ctx://workflows/workflow_core_system_wrap_context.txt"
        part1_uri = "ctx://workflows/workflow_core_system_wrap_context_part1.txt"
        part2_uri = "ctx://workflows/workflow_core_system_wrap_context_part2.txt"

        # Un-suffixed base_uri must NOT exist physically on disk when split into parts, while _part1 and _part2 DO exist
        self.assertIsNone(wf_ctx.resolve_path(base_uri, must_exist=True))
        self.assertIsNotNone(wf_ctx.resolve_path(part1_uri, must_exist=True))
        self.assertIsNotNone(wf_ctx.resolve_path(part2_uri, must_exist=True))

        # 1. expand_selection([base_uri]) must return [_part1.txt, _part2.txt]
        expanded = wf_ctx.expand_selection([base_uri])
        self.assertEqual(expanded, [part1_uri, part2_uri])

        # 2. ctx.read_compiled_context(base_uri) must concatenate both parts seamlessly
        full_text = wf_ctx.read_compiled_context(base_uri)
        self.assertIn(part_a[:1024], full_text)
        self.assertIn(part_b[:1024], full_text)

        # 3. HTTP GET /api/default/fs/fetch?file=<base_uri> must return 200 OK (resolving _part1.txt) instead of 404
        app = Flask(__name__)
        app.register_blueprint(fs_bp.bp)
        client = app.test_client()

        res = client.get(f"/api/default/fs/fetch?file={base_uri}")
        self.assertEqual(res.status_code, 200)
        self.assertIn(part_a[:512].encode("utf-8"), res.data)

        # 4. Wipe physical _part1.txt and _part2.txt from disk -> GET /api/default/fs/fetch must self-heal and return 200 OK
        Path(wf_ctx.resolve_path(part1_uri)).unlink()
        Path(wf_ctx.resolve_path(part2_uri)).unlink()
        self.assertFalse(wf_ctx.is_context_on_disk(base_uri))
        res_healed = client.get(f"/api/default/fs/fetch?file={base_uri}")
        self.assertEqual(res_healed.status_code, 200)
        self.assertTrue(wf_ctx.is_context_on_disk(base_uri))

    def test_prompts_resolve_get_and_live_post_buffer_with_nested_macros(self):
        """GET and POST /api/default/prompts/resolve expand nested {{include_prompt:...}} blocks and {{ macro_* }} parameters without mutating disk."""
        p_ctx = prompts_bp.get_context("default")
        p_ctx.vfs.save(
            "ctx://prompts/role_base.md",
            "---\ntitle: Role Base\n---\nAct as the {{ macro_role }} for {{ macro_project }}.\n\n{{ macro_directives }}",
        )
        p_ctx.vfs.save(
            "ctx://prompts/directives.md",
            "### Tone\nKeep prose grounded.",
        )
        p_ctx.vfs.save(
            "ctx://prompts/standup.md",
            '{{include_prompt: ctx://prompts/role_base.md { role: "Lead Architect"; project: "inSetu"; directives: "{{include_prompt: ctx://prompts/directives.md}}" }}}\n\n# Task',
        )
        sync_vfs_barrier("default")

        app = Flask(__name__)
        app.register_blueprint(prompts_bp.bp)
        app.register_blueprint(fs_bp.bp)
        client = app.test_client()

        # 1. GET /fs/fetch returns raw unexpanded source
        raw_res = client.get("/api/default/fs/fetch?file=ctx://prompts/standup.md")
        self.assertEqual(raw_res.status_code, 200)
        self.assertIn(b"{{include_prompt:", raw_res.data)

        # 2. GET /prompts/resolve expands outer template, inner directives macro, and all macro_* variables
        resolved_res = client.get("/api/default/prompts/resolve?file=ctx://prompts/standup.md")
        self.assertEqual(resolved_res.status_code, 200)
        resolved_text = resolved_res.data.decode("utf-8")
        self.assertIn("Act as the Lead Architect for inSetu.", resolved_text)
        self.assertIn("### Tone\nKeep prose grounded.", resolved_text)
        self.assertNotIn("{{ macro_", resolved_text)
        # 3. POST /prompts/resolve evaluates unsaved in-memory buffer text without touching disk
        unsaved_buffer = '{{include_prompt: ctx://prompts/role_base.md { macro_role: "Reviewer"; macro_project: "Akasa"; macro_directives: "Check AST rules." }}}'
        post_res = client.post("/api/default/prompts/resolve", json={
            "filepath": "ctx://prompts/standup.md",
            "content": unsaved_buffer,
        })
        self.assertEqual(post_res.status_code, 200)
        post_text = post_res.data.decode("utf-8")
        self.assertIn("Act as the Reviewer for Akasa.", post_text)
        self.assertIn("Check AST rules.", post_text)

        # 4. Default fallback syntax {{ macro_var | default }} expands when parameter is omitted
        p_ctx.vfs.save(
            "ctx://prompts/with_default.md",
            "Role: {{ macro_role | Staff Engineer }}",
        )
        sync_vfs_barrier("default")
        def_res = client.post("/api/default/prompts/resolve", json={
            "filepath": "ctx://prompts/standup.md",
            "content": "{{include_prompt: ctx://prompts/with_default.md}}",
        })
        self.assertEqual(def_res.status_code, 200)
        self.assertEqual(def_res.data.decode("utf-8").strip(), "Role: Staff Engineer")


if __name__ == "__main__":
    unittest.main()