"""Unit test suite [S4.T1] verifying akasa/db.py 16-DB pool & declarative constraints, MarkdownLanguageProvider, and topology ctx_events."""

import json
import os
import tempfile
import unittest
from pathlib import Path

from insetu.core.sdk import (
     apply_declarative_schema,
    get_connection,
    hooks,
    mount_volume,
    register_driver,
    DefaultVFSDriver,
    reset_kernel_state,
)
from insetu.core.languages import (
    MarkdownLanguageProvider,
    extract_file_symbols,
    extract_symbol_source_slice,
    format_interleaved_file_diff,
    get_language_provider,
)
from insetu.core.topology.engine_topology import (
    buffer_topology_events,
    resolve_topology_buffer,
)


class TestAkasaDbAndMarkdownAst(unittest.TestCase):
    """Verification suite [S4.T1] gating Sprint 1 task [S1.T0]."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root_path = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root_path / ".insetu"
        (self.control_dir / "cache" / "db").mkdir(parents=True, exist_ok=True)
        self.repo_dir = self.root_path / "alpha"
        self.repo_dir.mkdir(parents=True, exist_ok=True)

        self.orig_cwd = os.getcwd()
        reset_kernel_state(cwd=self.root_path.as_posix(), control_dir=".insetu")

        self.workspace_id = "default"
        (self.control_dir / "workspaces.json").write_text(
            json.dumps({"workspaces": {"default": {"config_path": "config.json"}}}),
            encoding="utf-8",
        )
        (self.control_dir / "config.json").write_text(
            json.dumps({
                "workspace_root": self.root_path.as_posix(),
                "target_repos": [{"repo_dir": "alpha", "title": "Alpha"}],
            }),
            encoding="utf-8",
        )
        register_driver("vfs", DefaultVFSDriver())
        register_driver("ctx", DefaultVFSDriver())
        mount_volume(self.workspace_id, "vfs", "alpha", self.repo_dir.as_posix())

    def tearDown(self):
        reset_kernel_state(cwd=self.orig_cwd, control_dir=".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def test_1_akasa_db_16_connection_pool_and_declarative_constraints_indexes(self):
        """akasa/db.py retains up to 16 concurrent per-workspace DB connections without eviction and applies __constraints__ and __indexes__."""
        opened_conns = {}
        for idx in range(14):
            db_name = f"domain_{idx}"
            opened_conns[db_name] = get_connection(db_name, self.workspace_id)

        # Verify none of the 14 connections were closed/evicted
        for db_name, conn in opened_conns.items():
            row = conn.execute("SELECT 1").fetchone()
            self.assertEqual(row[0], 1, f"Connection for {db_name} should remain open under the 16-DB limit")

        # Verify composite PRIMARY KEY (__constraints__) and CREATE INDEX (__indexes__) migration
        schema = {
            "md_records": {
                "db_scope": "TEXT NOT NULL",
                "id": "TEXT NOT NULL",
                "title": "TEXT DEFAULT ''",
                "__constraints__": ["PRIMARY KEY (db_scope, id)"],
                "__indexes__": ["idx_md_records_scope ON md_records(db_scope)"],
            }
        }
        apply_declarative_schema("mddb_test", schema, self.workspace_id)
        # Re-apply with an added column to verify idempotency and column diffing alongside __constraints__
        schema["md_records"]["status"] = "TEXT DEFAULT 'open'"
        apply_declarative_schema("mddb_test", schema, self.workspace_id)

        conn = get_connection("mddb_test", self.workspace_id)
        conn.execute("INSERT INTO md_records (db_scope, id, title, status) VALUES ('ext:tracker', 'T1', 'First', 'open')")
        conn.execute("INSERT INTO md_records (db_scope, id, title, status) VALUES ('ext:notes', 'T1', 'Same ID Other Scope', 'done')")
        conn.commit()

        rows = conn.execute("SELECT db_scope, id, status FROM md_records ORDER BY db_scope").fetchall()
        self.assertEqual(len(rows), 2)

        idx_rows = conn.execute("PRAGMA index_list(md_records)").fetchall()
        idx_names = {r["name"] for r in idx_rows}
        self.assertIn("idx_md_records_scope", idx_names)

    def test_2_markdown_language_provider_ast_links_citations_and_slicing(self):
        """MarkdownLanguageProvider extracts heading spans, resolves relative links, wikilinks, citations, slices sections, and formats AST diffs."""
        md_doc = (
            "---\n"
            "title: Architecture Spec\n"
            "description: Core Markdown AST test document.\n"
            "---\n\n"
            "# 1. Overview\n"
            "**Primary Goal:** Unify markdown indexing across repositories.\n"
            "See [Sibling Doc](../guides/setup.md#install) and [[concept_note#details|Concept]].\n"
            " Prior work is cited in [@smith2024; @doe2025_mddb].\n\n"
            "```python\n"
            "# Not a markdown heading inside code fence!\n"
            "x = 1\n"
            "```\n\n"
            "## 1.1 Sub-Component\n"
            "**Latency Budget:** Sub-millisecond lookup.\n"
            "Includes {{include_prompt: ctx://prompts/sub_prompt.md}}.\n\n"
            "# 2. Second Top Section\n"
            "Final paragraph line.\n"
        )
        filepath = "vfs://alpha/docs/specs/arch.md"
        provider = get_language_provider(filepath)
        self.assertIsInstance(provider, MarkdownLanguageProvider)

        # 1. Definitions & Scope Boundaries (ignoring '# Not a markdown heading' inside python fence)
        defs = provider.definitions(filepath, md_doc)
        self.assertEqual([d["name"] for d in defs], ["1. Overview", "1.1 Sub-Component", "2. Second Top Section"])
        self.assertEqual(defs[0]["start_line"], 6)
        self.assertEqual(defs[0]["end_line"], 18)
        self.assertEqual(defs[1]["start_line"], 16)
        self.assertEqual(defs[1]["end_line"], 18)
        self.assertEqual(defs[2]["start_line"], 20)

        # 2. Imports: relative link -> canonical vfs://, wikilink, citations, and include_prompt
        imps = provider.imports(filepath, md_doc)
        md_links = [i for i in imps if i["kind"] == "markdown_link"]
        self.assertEqual(len(md_links), 1)
        self.assertEqual(md_links[0]["target_uri"], "vfs://alpha/docs/guides/setup.md")
        self.assertEqual(md_links[0]["anchor"], "install")
        self.assertEqual(md_links[0]["heading"], "1. Overview")

        wikilinks = [i for i in imps if i["kind"] == "wikilink"]
        self.assertEqual(len(wikilinks), 1)
        self.assertEqual(wikilinks[0]["target_uri"], "vfs://alpha/docs/specs/concept_note.md")
        self.assertEqual(wikilinks[0]["anchor"], "details")

        citations = [i["citation_key"] for i in imps if i["kind"] == "citation"]
        self.assertEqual(citations, ["smith2024", "doe2025_mddb"])

        # 3. Exports: headings and bold lead-in terms
        exps = provider.exports(filepath, md_doc)
        terms = [e["name"] for e in exps if e["kind"] == "term"]
        self.assertIn("Primary Goal", terms)
        self.assertIn("Latency Budget", terms)

        # 4. Section Slicing & Interface Compression
        sec_slice = extract_symbol_source_slice(filepath, md_doc, "1.1 Sub-Component")
        self.assertIsNotNone(sec_slice)
        self.assertIn("Latency Budget", sec_slice["source"])
        self.assertNotIn("Second Top Section", sec_slice["source"])

        skeleton = provider.slice_interface(filepath, md_doc, max_tokens=200)
        self.assertIn("# 1. Overview", skeleton)
        self.assertIn("**Primary Goal:**", skeleton)
        self.assertNotIn("x = 1", skeleton)

        # 5. AST-Enclosing Interleaved Diff on >60 line .md file
        long_lines = ["---", "title: Long Spec", "---", ""]
        for sec_idx in range(1, 6):
            long_lines.append(f"## Section {sec_idx}")
            for p_idx in range(1, 16):
                long_lines.append(f"Paragraph {sec_idx}.{p_idx} baseline text.")
            long_lines.append("")
        base_md = "\n".join(long_lines)
        mutated_md = base_md.replace("Paragraph 3.5 baseline text.", "Paragraph 3.5 UPDATED text.")
        diff_out = format_interleaved_file_diff(filepath, base_md, mutated_md)
        self.assertIn("## Section 3", diff_out)
        self.assertIn("- Paragraph 3.5 baseline text.", diff_out)
        self.assertIn("+ Paragraph 3.5 UPDATED text.", diff_out)
        self.assertIn("## Section 5", diff_out)
        self.assertIn("unchanged]", diff_out)

    def test_3_topology_slew_limited_ctx_events_filtering(self):
        """engine_topology.py folds ctx://notes/ and ctx://skills/ mutations into topology_resolved.ctx_events while ignoring ctx://contexts/ and ctx://diffs/."""
        captured = []

        @hooks.on("topology_resolved")
        def _on_resolved(workspace_id=None, events=None, ctx_events=None, **kwargs):
            if workspace_id == self.workspace_id:
                captured.append({
                    "events": list(events or []),
                    "ctx_events": [e for e in (ctx_events or []) if str(e.get("filepath", "")).startswith(("ctx://", "ws://"))],
                })

        conn = get_connection("topology", self.workspace_id)
        conn.executemany(
            "INSERT INTO topology_event_buffer (filepath, mutation_type, timestamp) VALUES (?, ?, ?)",
            [
                ("ctx://notes/idea_1.md", "save", 1.0),
                ("ctx://skills/ guitar.md", "save", 1.0),
                ("ctx://contexts/alpha_context.txt", "save", 1.0),
                ("ctx://diffs/alpha_diffs.txt", "save", 1.0),
                ("ws://peer_ws/notes/shared.md", "save", 1.0),
            ],
        )
        conn.commit()

        resolve_topology_buffer(self.workspace_id)
        self.assertEqual(len(captured), 1)
        ctx_uris = [e["filepath"] for e in captured[0]["ctx_events"]]
        self.assertIn("ctx://notes/idea_1.md", ctx_uris)
        self.assertIn("ws://peer_ws/notes/shared.md", ctx_uris)
        self.assertNotIn("ctx://contexts/alpha_context.txt", ctx_uris)
        self.assertNotIn("ctx://diffs/alpha_diffs.txt", ctx_uris)


if __name__ == "__main__":
    unittest.main()
