import ast
import json
import os
import tempfile
import unittest
from pathlib import Path

import akasa
import akasa.utils as akasa_utils
from insetu.core.bridge.bridge_fuzzy import (
    find_all_block_anchors,
    find_block_anchor,
    apply_block_in_memory,
    is_effectively_identical,
)
from insetu.core.bridge.bridge_vfs import _process_sync_transaction


class TestBridgeAnchorInvariants(unittest.TestCase):
    """Regression and fitness tests for patch anchor matching, no-op detection, chunk blame isolation, and the single patch engine."""

    def setUp(self):
        # Transaction tests resolve fuzzy paths through the topology database, so they need a sandboxed
        # daemon cwd; without one they create real .insetu/cache/db files in whatever directory runs the suite.
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

    def tearDown(self):
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def test_partial_line_hijack_immunity(self):
        """
        Regression test for the boundary prefix/suffix hijack bug:
        A SEARCH block ending with a short token like '}' or '})()))))}' must NOT match an earlier
        line that merely starts with '}' (like '} catch (e) {}') when an exact match exists later.
        """
        file_content = "\n".join([
            "function alpha() {",
            "    try {",
            "        doSomething();",
            "    } catch (e) {}",
            "}",
            "",
            "function beta() {",
            "    try {",
            "        doSomething();",
            "    }",
            "    return true;",
            "}",
        ])
        block = {
            "search": "\n".join([
                "    try {",
                "        doSomething();",
                "    }",
            ]),
            "replace": "\n".join([
                "    try {",
                "        doSomethingElse();",
                "    }",
            ]),
        }
        ok, updated, status = apply_block_in_memory(file_content, block, silent=True)
        assert ok is True
        assert status == "success"
        # alpha() must remain completely untouched; beta() must be updated cleanly
        assert "} catch (e) {}" in updated
        assert "doSomethingElse();" in updated


    def test_boundary_suffix_preservation_on_tier1_fallback(self):
        """
        If Tier 0 finds 0 exact matches and Tier 1 matches a truncated last line (len >= 6),
        apply_block_in_memory must preserve the unmatched trailing suffix on that line.
        """
        file_content = "\n".join([
            "import { html } from 'lit';",
            "export class InSetuSystemSettings extends InSetuElement {",
            "    constructor() { super(); }",
            "}",
        ])
        block = {
            "search": "\n".join([
                "import { html } from 'lit';",
                "export class InSetuSystemSettings",
            ]),
            "replace": "\n".join([
                "import { html } from 'lit';",
                "export class InSetuHelper {}",
                "export class InSetuSystemSettings",
            ]),
        }
        ok, updated, status = apply_block_in_memory(file_content, block, silent=True)
        assert ok is True
        assert status == "success"
        assert "export class InSetuSystemSettings extends InSetuElement {" in updated


    def test_ambiguous_anchor_rejection(self):
        """
        When a SEARCH block matches 2 or more locations in the same file, apply_block_in_memory
        must reject the patch with 'ambiguous:<lines>' rather than silently mutating the first hit.
        """
        file_content = "\n".join([
            "class FirstWidget {",
            "    render() {",
            "        return 'hello';",
            "    }",
            "}",
            "",
            "class SecondWidget {",
            "    render() {",
            "        return 'hello';",
            "    }",
            "}",
        ])
        block = {
            "search": "\n".join([
                "    render() {",
                "        return 'hello';",
                "    }",
            ]),
            "replace": "\n".join([
                "    render() {",
                "        return 'updated';",
                "    }",
            ]),
        }
        ok, updated, status = apply_block_in_memory(file_content, block, silent=True)
        assert ok is False
        assert status.startswith("ambiguous:")
        assert "2, 8" in status, status  # 1-based lines of each matching "render() {"
        assert updated == file_content
    def test_per_chunk_ast_blame_isolation(self):
        """
        Verifies that when a multi-chunk transaction has a syntax error in Chunk #1
        and valid edits in Chunk #2 and Chunk #3, _process_sync_transaction blames
        Chunk #1 (patch_index=0, cell_id='cell_1') rather than blaming Chunk #3 (blocks[-1]).
        """
        class DummyVFS:
            def __init__(self, initial_files):
                self.files = dict(initial_files)

            def read(self, fp):
                return self.files.get(fp)

            def save(self, fp, content):
                self.files[fp] = content

            def delete(self, fp):
                self.files.pop(fp, None)

        initial_py = "\n".join([
            "def alpha():",
            "    return 1",
            "",
            "def beta():",
            "    return 2",
            "",
            "def gamma():",
            "    return 3",
        ])
        vfs = DummyVFS({"vfs://repo/sample.py": initial_py})
        raw_payload = "\n\n".join([
            "<<<<<<< FILE: vfs://repo/sample.py\n<<<<<<< ID: cell_1\n<<<<<<< SEARCH\ndef alpha():\n    return 1\n=======\ndef alpha(:\n    return 10\n>>>>>>> REPLACE",
            "<<<<<<< FILE: vfs://repo/sample.py\n<<<<<<< ID: cell_2\n<<<<<<< SEARCH\ndef beta():\n    return 2\n=======\ndef beta():\n    return 20\n>>>>>>> REPLACE",
            "<<<<<<< FILE: vfs://repo/sample.py\n<<<<<<< ID: cell_3\n<<<<<<< SEARCH\ndef gamma():\n    return 3\n=======\ndef gamma():\n    return 30\n>>>>>>> REPLACE",
        ])
        telemetry, buffers, deferred = _process_sync_transaction(
            vfs,
            workspace_id="default",
            data={
                "text": raw_payload,
                "active_files": ["vfs://repo/sample.py"],
                "dry_run": True,
                "pinned_repos": ["ALL"],
            },
            sister_repos=["repo"],
            ws_root="/tmp",
            return_buffers=True,
        )
        assert telemetry["can_commit"] is False
        patches_by_id = {p["cell_id"]: p for p in telemetry["patches"]}
        assert patches_by_id["cell_1"]["status"] == "syntax_error"
        assert patches_by_id["cell_1"]["patch_index"] == 0
        assert patches_by_id["cell_2"]["status"] == "resolved"
        assert patches_by_id["cell_2"]["patch_index"] == 1
        assert patches_by_id["cell_3"]["status"] == "resolved"
        assert patches_by_id["cell_3"]["patch_index"] == 2
        assert len(deferred) == 1
        assert deferred[0]["block"]["id"] == "cell_1"


    def test_deferred_overlap_preserves_visual_patch_index(self):
        """
        Verifies that when Chunk #1 depends on Chunk #2 (so Chunk #1 is deferred via
        deferred_overlap and evaluated after Chunk #2), telemetry['patches'] still
        preserves patch_index=0 for cell_1 and patch_index=1 for cell_2.
        """
        class DummyVFS:
            def __init__(self, initial_files):
                self.files = dict(initial_files)

            def read(self, fp):
                return self.files.get(fp)

            def save(self, fp, content):
                self.files[fp] = content

        vfs = DummyVFS({"vfs://repo/order.py": "x = 1\n"})
        # cell_1 looks for 'x = 2', which is only introduced by cell_2
        raw_payload = "\n\n".join([
            "<<<<<<< FILE: vfs://repo/order.py\n<<<<<<< ID: cell_1\n<<<<<<< SEARCH\nx = 2\n=======\nx = 3\n>>>>>>> REPLACE",
            "<<<<<<< FILE: vfs://repo/order.py\n<<<<<<< ID: cell_2\n<<<<<<< SEARCH\nx = 1\n=======\nx = 2\n>>>>>>> REPLACE",
        ])
        telemetry = _process_sync_transaction(
            vfs,
            workspace_id="default",
            data={
                "text": raw_payload,
                "active_files": ["vfs://repo/order.py"],
                "dry_run": True,
                "pinned_repos": ["ALL"],
            },
            sister_repos=["repo"],
            ws_root="/tmp",
        )
        assert telemetry["can_commit"] is True
        assert telemetry["patches"][0]["cell_id"] == "cell_1"
        assert telemetry["patches"][0]["patch_index"] == 0
        assert telemetry["patches"][1]["cell_id"] == "cell_2"
        assert telemetry["patches"][1]["patch_index"] == 1


    def test_fitness_no_unconditional_startswith_in_strict_scan(self):
        """
        Architectural Fitness Check:
        Ensures bridge_fuzzy.py never uses unconditional .startswith() or .endswith()
        without the permit_partial_bounds guard inside find_all_block_anchors.
        """
        fuzzy_path = Path(__file__).resolve().parent.parent.parent / "insetu" / "core" / "bridge" / "bridge_fuzzy.py"
        source = fuzzy_path.read_text(encoding="utf-8")
        tree = ast.parse(source)
        fn_node = next(
            n for n in ast.walk(tree)
            if isinstance(n, ast.FunctionDef) and n.name == "find_all_block_anchors"
        )
        fn_src = ast.get_source_segment(source, fn_node) or ""
        assert "permit_partial_bounds" in fn_src
        assert "if not f_stripped.startswith(s_stripped):" not in fn_src


    def test_fitness_single_patch_engine_invariant(self):
        """
        Architectural Fitness Check (SINGLE_PATCH_ENGINE_INVARIANT):
        Verifies that apply_block_in_memory is only defined in bridge_fuzzy.py and
        the zero-dependency fallback_bridge.py lifeboat.
        """
        insetu_pkg = Path(__file__).resolve().parent.parent.parent / "insetu"
        definers = []
        for py_file in insetu_pkg.rglob("*.py"):
            try:
                tree = ast.parse(py_file.read_text(encoding="utf-8"))
            except SyntaxError:
                continue
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef) and node.name == "apply_block_in_memory":
                    definers.append(py_file.name)
        assert set(definers) <= {"bridge_fuzzy.py", "fallback_bridge.py"}

    def test_blank_line_above_target_is_preserved(self):
        """A SEARCH without leading blank lines must not swallow the blank line above its first content line."""
        file_content = "x = 1\n\n    if a:\n        b()\n\n\ndef f():\n    pass\n"
        block = {"search": "    if a:\n        b()\n\n", "replace": "    if a:\n        b()\n\n    if c:\n        d()\n\n"}
        ok, updated, status = apply_block_in_memory(file_content, block, silent=True)
        assert ok is True and status == "success", status
        assert updated == file_content.replace(block["search"], block["replace"], 1), repr(updated)

    def test_leading_blank_lines_consumed_only_as_many_as_search_has(self):
        file_content = "x = 1\n\n\n\nif a:\n    b()\n"
        block = {"search": "\nif a:\n    b()", "replace": "\nif a:\n    c()"}
        ok, updated, status = apply_block_in_memory(file_content, block, silent=True)
        assert ok is True
        assert updated == "x = 1\n\n\n\nif a:\n    c()\n", repr(updated)

    def test_blank_line_only_change_is_applied_not_skipped(self):
        """Adding or removing blank lines is a real change, so it must not be reported as a no-op."""
        ok, added, status = apply_block_in_memory("x = 1\ny = 2\n", {"search": "x = 1\ny = 2", "replace": "x = 1\n\n\ny = 2"}, silent=True)
        assert ok is True and status == "success", status
        assert added == "x = 1\n\n\ny = 2\n"
        ok, removed, status = apply_block_in_memory("x = 1\n\n\ny = 2\n", {"search": "x = 1\n\n\ny = 2", "replace": "x = 1\ny = 2"}, silent=True)
        assert ok is True and status == "success", status
        assert removed == "x = 1\ny = 2\n"

    def test_identical_and_uniformly_reindented_blocks_remain_no_ops(self):
        content = "a\n    b\n"
        assert apply_block_in_memory(content, {"search": "a\n    b", "replace": "a\n    b"}, silent=True)[2] == "no_op"
        assert is_effectively_identical(["    a", "        b"], ["a", "    b"])
        assert not is_effectively_identical(["a", "", "b"], ["a", "b"])


if __name__ == "__main__":
    unittest.main()
