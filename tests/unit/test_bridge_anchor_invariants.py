import ast
import json
import os
import tempfile
import unittest
from pathlib import Path

import akasa
import akasa.utils as akasa_utils
from unittest.mock import patch
from insetu.core.bridge.bridge_fuzzy import (
    find_all_block_anchors,
    find_block_anchor,
    apply_block_in_memory,
    is_effectively_identical,
    rebase_overlapping_block_in_memory,
)
from insetu.core.bridge.bridge_vfs import (
    clear_bridge_eval_cache,
    process_sync_transaction,
)


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
        (self.control_dir / "host.json").write_text(json.dumps({"port": 5005}), encoding="utf-8")
        (self.control_dir / "workspaces.json").write_text(
            json.dumps({"workspaces": {"default": {"config_path": "config.json"}}, "active_workspace": "default"}),
            encoding="utf-8",
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
        telemetry, buffers, deferred = process_sync_transaction(
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


    def test_canonical_order_and_n_minus_1_state_recording(self):
        """
        Verifies that the internal test loop strictly follows canonical given order (0 .. n)
        without reordering failed patches to the end, and records the exact n-1 virtual buffer
        state (pre_buffer) when patch n fails.
        """
        clear_bridge_eval_cache()

        class DummyVFS:
            def __init__(self, initial_files):
                self.files = dict(initial_files)

            def read(self, fp):
                return self.files.get(fp)

            def save(self, fp, content):
                self.files[fp] = content

        initial_py = "a = 1\nb = 2\nc = 3\n"
        vfs = DummyVFS({"vfs://repo/order.py": initial_py})
        # Patch 1 succeeds (a = 1 -> a = 10)
        # Patch 2 fails to anchor (b = 999 -> b = 20); its n-1 state must have a = 10 and c = 3!
        # Patch 3 succeeds (c = 3 -> c = 30)
        raw_payload = "\n\n".join([
            "<<<<<<< FILE: vfs://repo/order.py\n<<<<<<< ID: cell_1\n<<<<<<< SEARCH\na = 1\n=======\na = 10\n>>>>>>> REPLACE",
            "<<<<<<< FILE: vfs://repo/order.py\n<<<<<<< ID: cell_2\n<<<<<<< SEARCH\nb = 999\n=======\nb = 20\n>>>>>>> REPLACE",
            "<<<<<<< FILE: vfs://repo/order.py\n<<<<<<< ID: cell_3\n<<<<<<< SEARCH\nc = 3\n=======\nc = 30\n>>>>>>> REPLACE",
        ])
        telemetry, buffers, deferred = process_sync_transaction(
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
            return_buffers=True,
        )
        self.assertFalse(telemetry["can_commit"])
        self.assertEqual([p["cell_id"] for p in telemetry["patches"]], ["cell_1", "cell_2", "cell_3"])
        self.assertEqual([p["patch_index"] for p in telemetry["patches"]], [0, 1, 2])
        self.assertEqual(telemetry["patches"][0]["status"], "resolved")
        self.assertEqual(telemetry["patches"][1]["status"], "needs_confirmation")
        self.assertEqual(telemetry["patches"][2]["status"], "resolved")
        self.assertEqual(len(deferred), 1)
        self.assertEqual(deferred[0]["block"]["id"], "cell_2")
        # The n-1 buffer for cell_2 must contain cell_1's edit (a = 10) but NOT cell_3's edit (c = 30)!
        self.assertEqual(deferred[0]["pre_buffer"], "a = 10\nb = 2\nc = 3\n")

    def test_path_resolution_and_test_loop_never_mutate_input_blocks(self):
        """
        Verifies that apply_block_in_memory and _process_sync_transaction never mutate
        the input block dictionary's 'search' or 'replace' fields (preserving block signatures).
        """
        clear_bridge_eval_cache()
        from insetu.core.bridge.parser import compute_block_signature as _compute_sig

        # 1. Direct apply_block_in_memory with artifact healing and trailing-line absorption
        file_content = "def calc(x):\n    return x + 1\n    # trailing context\n"
        raw_block = {
            "id": "cell_imm_1",
            "type": "exact",
            "search": "def calc(x):\n    return x + 1",
            "replace": "def calc(x):\n    return x + 2\n    # trailing context",
        }
        sig_before = _compute_sig(raw_block)
        search_before = raw_block["search"]
        replace_before = raw_block["replace"]

        ok, updated, status = apply_block_in_memory(file_content, raw_block, silent=True)
        self.assertTrue(ok)
        self.assertEqual(status, "success")
        self.assertIn("return x + 2", updated)
        self.assertNotIn("[cite:", updated)
        self.assertEqual(raw_block["search"], search_before, "Input block['search'] must not be mutated")
        self.assertEqual(raw_block["replace"], replace_before, "Input block['replace'] must not be mutated")
        self.assertEqual(_compute_sig(raw_block), sig_before, "Block signature must remain invariant after evaluation")


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

    def test_locate_closest_window_finds_misindented_blocks_and_populates_actual_anchor(self):
        """S1.T1 & S1.T4: locate_closest_window finds a target function deep inside a >400-line file even when the SEARCH block is mis-indented (8 spaces vs 4 spaces), and SINGLE_WINDOW_LOCATOR_MANDATE flags raw SequenceMatcher in bridge modules."""
        import contextlib as _contextlib
        import io as _io
        from insetu.core.bridge.bridge_fuzzy import locate_closest_window as _locate_win
        from tests.fitness.core import FitnessState as _FitnessState
        from tests.fitness.rules_python import BackendFitnessVisitor as _Visitor

        file_lines = [f"def filler_{i}():\n    return {i}" for i in range(220)]
        file_lines.extend([
            "def target_deep_fn(x, y):",
            "    computed_value = (x * 10) + (y * 20)",
            "    if computed_value > 100:",
            "        return computed_value - 5",
            "    return computed_value",
        ])
        full_file = "\n".join(file_lines) + "\n"
        all_lines = full_file.splitlines()

        # Mis-indented SEARCH block (8/16 spaces instead of 4/8) with a modified line
        search_lines = [
            "def target_deep_fn(x, y):",
            "        computed_value = (x * 10) + (y * 999)",
            "        if computed_value > 100:",
            "                return computed_value - 5",
            "        return computed_value",
        ]
        win = _locate_win(all_lines, search_lines)
        self.assertTrue(win["has_meaningful_line"])
        self.assertGreaterEqual(win["similarity_ratio"], 0.65)
        self.assertIn("def target_deep_fn(x, y):", "\n".join(win["actual_lines"]))

        # Verify SINGLE_WINDOW_LOCATOR_MANDATE flags raw difflib.SequenceMatcher in engine_bridge.py
        prev = _FitnessState.violations_found
        buf = _io.StringIO()
        try:
            fake_bridge = Path(__file__).resolve().parent.parent.parent / "insetu" / "core" / "bridge" / "engine_bridge.py"
            with _contextlib.redirect_stdout(buf):
                _Visitor(fake_bridge, fake_bridge.name, is_test=False).visit(
                    ast.parse("import difflib\nm = difflib.SequenceMatcher(None, ['a'], ['b'])\n")
                )
            self.assertIn("SINGLE_WINDOW_LOCATOR_MANDATE", buf.getvalue())
        finally:
            _FitnessState.violations_found = prev

    def test_stray_two_space_docstring_lines_never_double_four_space_indentation(self):
        """Regression test for Issue E7: a 2-space continuation line inside a docstring or block must not flip the step to 2 and double 4-space indents into 8-space indents."""
        from insetu.core.bridge.parser import get_base_step_and_diffs as _get_step

        sample_lines = [
            "def example(a, b):",
            '    """',
            "    Summary line:",
            "      - stray 2-space bullet inside docstring",
            '    """',
            "    if a > b:",
            "        return a",
            "    return b",
        ]
        step, _ = _get_step(sample_lines)
        self.assertEqual(step, 4, "A stray 2-space line inside a 4-space function must not flip the base step from 4 to 2")

        file_content = "def header():\n    return 0\n\ndef target():\n    return 1\n"
        replacement = "\n".join(sample_lines)
        ok, updated, status = apply_block_in_memory(
            file_content,
            {"search": "def target():\n    return 1", "replace": replacement},
            silent=True,
        )
        self.assertTrue(ok)
        self.assertEqual(status, "success")
        self.assertIn("    if a > b:\n        return a\n    return b", updated)
        self.assertNotIn("        if a > b:", updated, "4-space body must never be doubled to 8 spaces")

    def test_deterministic_overlap_rebase_merges_shared_boundary_context(self):
        """
        When Patch #1 and Patch #2 are both written against the original file (O) and share
        overlapping sandwich context lines, _process_sync_transaction rebases Patch #2 deterministically
        in memory (0 LLM calls) and flags 'rebased_overlap'.
        """
        clear_bridge_eval_cache()

        class DummyVFS:
            def __init__(self, initial_files):
                self.files = dict(initial_files)

            def read(self, fp):
                return self.files.get(fp)

            def save(self, fp, content):
                self.files[fp] = content

        orig_py = "\n".join([
            "def compute_totals(items):",
            "    subtotal = sum(items)",
            "    tax = subtotal * 0.08",
            "    shipping = 5.0",
            "    return subtotal + tax + shipping",
        ]) + "\n"
        vfs = DummyVFS({"vfs://repo/billing.py": orig_py})

        # Patch 1 modifies `tax = subtotal * 0.08` -> `tax = subtotal * 0.10`
        # Patch 2 (written against orig_py) includes `tax = subtotal * 0.08` as its top sandwich context line
        # while changing `shipping = 5.0` -> `shipping = 0.0`.
        raw_payload = "\n\n".join([
            "<<<<<<< FILE: vfs://repo/billing.py\n<<<<<<< ID: cell_p1\n<<<<<<< SEARCH\n    subtotal = sum(items)\n    tax = subtotal * 0.08\n    shipping = 5.0\n=======\n    subtotal = sum(items)\n    tax = subtotal * 0.10\n    shipping = 5.0\n>>>>>>> REPLACE",
            "<<<<<<< FILE: vfs://repo/billing.py\n<<<<<<< ID: cell_p2\n<<<<<<< SEARCH\n    tax = subtotal * 0.08\n    shipping = 5.0\n    return subtotal + tax + shipping\n=======\n    tax = subtotal * 0.08\n    shipping = 0.0\n    return subtotal + tax + shipping\n>>>>>>> REPLACE",
        ])
        telemetry, buffers, deferred = process_sync_transaction(
            vfs,
            workspace_id="default",
            data={
                "text": raw_payload,
                "active_files": ["vfs://repo/billing.py"],
                "dry_run": True,
                "pinned_repos": ["ALL"],
            },
            sister_repos=["repo"],
            ws_root="/tmp",
            return_buffers=True,
        )
        self.assertTrue(telemetry["can_commit"], f"Expected overlap rebase to succeed: {telemetry}")
        self.assertEqual(len(deferred), 0)
        final_buf = buffers["vfs://repo/billing.py"]
        self.assertIn("tax = subtotal * 0.10", final_buf)
        self.assertIn("shipping = 0.0", final_buf)
        p2_tel = next(p for p in telemetry["patches"] if p["cell_id"] == "cell_p2")
        self.assertEqual(p2_tel["status"], "resolved")

    def test_two_tier_signature_memoization_and_single_eof_ast_gate(self):
        """
        Verifies:
        1. O(1) End-of-File AST Gate: _validate_buffer_syntax runs ONCE per modified file on clean multi-chunk batches (instead of N times).
        2. Tier 1 FileEvalSig Cache Hit: Re-evaluating a multi-file batch where File A is untouched and File B is edited skips _validate_buffer_syntax and apply_block_in_memory on File A completely.
        """
        clear_bridge_eval_cache()

        class DummyVFS:
            def __init__(self, initial_files):
                self.files = dict(initial_files)

            def read(self, fp):
                return self.files.get(fp)

            def save(self, fp, content):
                self.files[fp] = content

        file_a = "\n".join([f"def fn_a_{i}():\n    return {i}\n" for i in range(5)])
        file_b = "def fn_b():\n    return 100\n"
        vfs = DummyVFS({
            "vfs://repo/file_a.py": file_a,
            "vfs://repo/file_b.py": file_b,
        })

        chunks_a = [
            f"<<<<<<< FILE: vfs://repo/file_a.py\n<<<<<<< ID: cell_a_{i}\n<<<<<<< SEARCH\ndef fn_a_{i}():\n    return {i}\n=======\ndef fn_a_{i}():\n    return {(i + 1) * 10}\n>>>>>>> REPLACE"
            for i in range(5)
        ]
        chunk_b_v1 = "<<<<<<< FILE: vfs://repo/file_b.py\n<<<<<<< ID: cell_b_1\n<<<<<<< SEARCH\ndef fn_b():\n    return 100\n=======\ndef fn_b():\n    return 200\n>>>>>>> REPLACE"

        from insetu.core.bridge import bridge_vfs as _bvfs
        with patch.object(_bvfs, "validate_buffer_syntax", wraps=_bvfs.validate_buffer_syntax) as spy_syntax:
            tel_1 = process_sync_transaction(
                vfs,
                workspace_id="default",
                data={
                    "text": "\n\n".join(chunks_a + [chunk_b_v1]),
                    "active_files": ["vfs://repo/file_a.py", "vfs://repo/file_b.py"],
                    "dry_run": True,
                    "pinned_repos": ["ALL"],
                },
                sister_repos=["repo"],
                ws_root="/tmp",
            )
            self.assertTrue(tel_1["can_commit"])
            # 5 chunks in file_a + 1 chunk in file_b -> _validate_buffer_syntax must be called only ONCE per file (2 calls total)!
            self.assertEqual(spy_syntax.call_count, 2)

            # Pass 2: Triage/modify ONLY file_b while file_a's 5 chunks are unchanged -> file_a hits _FILE_EVAL_CACHE (0 syntax calls for file_a)!
            spy_syntax.reset_mock()
            chunk_b_v2 = "<<<<<<< FILE: vfs://repo/file_b.py\n<<<<<<< ID: cell_b_1\n<<<<<<< SEARCH\ndef fn_b():\n    return 100\n=======\ndef fn_b():\n    return 300\n>>>>>>> REPLACE"
            tel_2 = process_sync_transaction(
                vfs,
                workspace_id="default",
                data={
                    "text": "\n\n".join(chunks_a + [chunk_b_v2]),
                    "active_files": ["vfs://repo/file_a.py", "vfs://repo/file_b.py"],
                    "dry_run": True,
                    "pinned_repos": ["ALL"],
                },
                sister_repos=["repo"],
                ws_root="/tmp",
            )
            self.assertTrue(tel_2["can_commit"])
            self.assertEqual(tel_2["summary"]["resolved"], 6)
            self.assertEqual(spy_syntax.call_count, 1, "Untouched file_a must hit _FILE_EVAL_CACHE with 0 AST syntax re-validations")

        # 3. Tier 2 Intra-File PatchEvalSig Memoization:
        # When chunk 4 of file_a is modified (simulating a healed patch at index 4), chunks 0..3 hit _PATCH_EVAL_CACHE
        # and make ZERO calls to apply_block_in_memory!
        chunks_a_healed_last = list(chunks_a)
        chunks_a_healed_last[4] = (
            "<<<<<<< FILE: vfs://repo/file_a.py\n<<<<<<< ID: cell_a_4\n"
            "<<<<<<< SEARCH\ndef fn_a_4():\n    return 4\n=======\ndef fn_a_4():\n    return 444\n>>>>>>> REPLACE"
        )
        with patch.object(_bvfs, "apply_block_in_memory", wraps=_bvfs.apply_block_in_memory) as spy_apply:
            tel_3 = process_sync_transaction(
                vfs,
                workspace_id="default",
                data={
                    "text": "\n\n".join(chunks_a_healed_last),
                    "active_files": ["vfs://repo/file_a.py"],
                    "dry_run": True,
                    "pinned_repos": ["ALL"],
                },
                sister_repos=["repo"],
                ws_root="/tmp",
            )
            self.assertTrue(tel_3["can_commit"])
            self.assertEqual(
                spy_apply.call_count,
                1,
                "Chunks 0..3 must hit _PATCH_EVAL_CACHE without calling apply_block_in_memory; only chunk 4 should execute",
            )

        # 4. Pointer-change invalidation: remapping the pointer to a different target file forces fresh signature evaluation
        vfs.files["vfs://repo/file_a_copy.py"] = file_a
        with patch.object(_bvfs, "apply_block_in_memory", wraps=_bvfs.apply_block_in_memory) as spy_apply_remap:
            tel_4 = process_sync_transaction(
                vfs,
                workspace_id="default",
                data={
                    "text": "\n\n".join(chunks_a),
                    "active_files": ["vfs://repo/file_a.py"],
                    "resolutions": {"vfs://repo/file_a.py": {"selected_uri": "vfs://repo/file_a_copy.py"}},
                    "dry_run": True,
                    "pinned_repos": ["ALL"],
                },
                sister_repos=["repo"],
                ws_root="/tmp",
            )
            self.assertTrue(tel_4["can_commit"])
            self.assertEqual(spy_apply_remap.call_count, 5, "Changing the target file pointer must invalidate cached signatures and evaluate all 5 chunks against the new pointer")

        # 5. Phase 4.4 70-Patch Multi-File Batch Benchmark:
        # 14 files x 5 chunks = 70 patches total. Mutating 1 chunk in file_13 must skip 13 files via Tier 1
        # (_FILE_EVAL_CACHE) and 4 leading chunks in file_13 via Tier 2 (_PATCH_EVAL_CACHE) -> 69/70 (98.5%) cache hits in < 15ms!
        import time as _time
        clear_bridge_eval_cache()
        batch_files = {
            f"vfs://repo/mod_{f_idx}.py": "\n".join([f"def fn_{f_idx}_{c_idx}():\n    return {c_idx}\n" for c_idx in range(5)])
            for f_idx in range(14)
        }
        vfs_70 = DummyVFS(batch_files)
        blocks_70 = []
        for f_idx in range(14):
            for c_idx in range(5):
                blocks_70.append(
                    f"<<<<<<< FILE: vfs://repo/mod_{f_idx}.py\n<<<<<<< ID: cell_{f_idx}_{c_idx}\n"
                    f"<<<<<<< SEARCH\ndef fn_{f_idx}_{c_idx}():\n    return {c_idx}\n"
                    f"=======\ndef fn_{f_idx}_{c_idx}():\n    return {(c_idx + 1) * 10}\n>>>>>>> REPLACE"
                )
        active_70 = list(batch_files.keys())

        # Warm the cache with Pass 1 (all 70 patches)
        tel_70_pass1 = process_sync_transaction(
            vfs_70,
            workspace_id="default",
            data={"text": "\n\n".join(blocks_70), "active_files": active_70, "dry_run": True, "pinned_repos": ["ALL"]},
            sister_repos=["repo"],
            ws_root="/tmp",
        )
        self.assertTrue(tel_70_pass1["can_commit"])
        self.assertEqual(tel_70_pass1["summary"]["resolved"], 70)

        # Mutate ONLY the 70th patch (file 13, chunk 4) and measure Pass 2 cache hits and wall time
        blocks_70_mutated = list(blocks_70)
        blocks_70_mutated[-1] = (
            "<<<<<<< FILE: vfs://repo/mod_13.py\n<<<<<<< ID: cell_13_4\n"
            "<<<<<<< SEARCH\ndef fn_13_4():\n    return 4\n"
            "=======\ndef fn_13_4():\n    return 9999\n>>>>>>> REPLACE"
        )
        with patch.object(_bvfs, "apply_block_in_memory", wraps=_bvfs.apply_block_in_memory) as spy_apply_70:
            t0 = _time.perf_counter()
            tel_70_pass2 = process_sync_transaction(
                vfs_70,
                workspace_id="default",
                data={"text": "\n\n".join(blocks_70_mutated), "active_files": active_70, "dry_run": True, "pinned_repos": ["ALL"]},
                sister_repos=["repo"],
                ws_root="/tmp",
            )
            elapsed_ms = (_time.perf_counter() - t0) * 1000.0
            self.assertTrue(tel_70_pass2["can_commit"])
            self.assertEqual(tel_70_pass2["summary"]["resolved"], 70)
            # 69 out of 70 patches hit cache (98.57% >= 95%): only 1 call to apply_block_in_memory!
            self.assertEqual(spy_apply_70.call_count, 1)
            self.assertLess(elapsed_ms, 50.0, f"Expected 70-patch memoized re-evaluation in <50ms, took {elapsed_ms:.2f}ms")

    def test_module_forward_ref_gate_allows_lambda_and_try_except_defs_and_rejects_true_forward_ref(self):
        """
        Regression test for 1b:
        1. `handler = lambda: later()` before `def later(): return 1` is valid at import time and passes `_validate_buffer_syntax`.
        2. `try: import fastjson as js / except ImportError: def js(): return helper()` before `def helper(): return 1` is valid at import time and passes.
        3. `register(later)` at module top level before `def later(): return 1` raises NameError at import time and is rejected by `_validate_buffer_syntax`.
        """
        from insetu.core.bridge.bridge_vfs import validate_buffer_syntax as __validate_buffer_syntax
        from insetu.core.system.engine_system import system_bp as _system_bp

        ctx = _system_bp.get_context("default")

        lambda_src = (
            "handler = lambda: later()\n"
            "def later():\n"
            "    return 1\n"
        )
        has_err_lambda, err_lambda = __validate_buffer_syntax(ctx, "vfs://repo/lambda_ok.py", lambda_src)
        self.assertFalse(has_err_lambda, f"Lambda body must not be flagged as an import-time forward reference: {err_lambda}")

        try_except_def_src = (
            "try:\n"
            "    import fastjson as js\n"
            "except ImportError:\n"
            "    def js():\n"
            "        return helper()\n"
            "def helper():\n"
            "    return 1\n"
        )
        has_err_try, err_try = __validate_buffer_syntax(ctx, "vfs://repo/try_def_ok.py", try_except_def_src)
        self.assertFalse(has_err_try, f"Def body inside try/except must not be flagged as an import-time forward reference: {err_try}")

        real_fwd_ref_src = (
            "def register(fn):\n"
            "    return fn\n"
            "register(later)\n"
            "def later():\n"
            "    return 1\n"
        )
        has_err_real, err_real = __validate_buffer_syntax(ctx, "vfs://repo/real_fwd_bad.py", real_fwd_ref_src)
        self.assertTrue(has_err_real, "True import-time forward reference `register(later)` before `def later` must fail the syntax gate")
        self.assertIn("forward reference to 'later'", err_real)

    def test_fitness_no_undefined_type_annotations_across_codebase(self):
        """
        Architectural Fitness Check:
        In Python without `from __future__ import annotations`, type annotations on nested
        functions or local variables inside branches are only evaluated when that branch runs.
        Scans all Python files in insetu/ to verify that every identifier referenced in any
        parameter, return, or variable type annotation is defined in module scope or builtins.
        """
        import builtins as _builtins

        builtin_names = set(dir(_builtins)) | {"__file__", "__name__", "__doc__", "__package__"}
        insetu_pkg = Path(__file__).resolve().parent.parent.parent / "insetu"
        violations = []

        for py_file in sorted(insetu_pkg.rglob("*.py")):
            if "/vendor/" in py_file.as_posix():
                continue
            try:
                tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=py_file.as_posix())
            except SyntaxError:
                continue

            # Collect all names bound in the file (imports, defs, classes, assignments, comprehensions, args)
            bound_names = set(builtin_names)
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        bound_names.add((alias.asname or alias.name).split(".")[0])
                elif isinstance(node, ast.ImportFrom):
                    for alias in node.names:
                        bound_names.add(alias.asname or alias.name)
                elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    bound_names.add(node.name)
                elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
                    bound_names.add(node.id)
                elif isinstance(node, ast.arg):
                    bound_names.add(node.arg)

            # Inspect every annotation expression in the module
            annotation_nodes = []
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    if node.returns:
                        annotation_nodes.append((node.lineno, node.returns))
                    for a in (
                        list(node.args.posonlyargs)
                        + list(node.args.args)
                        + list(node.args.kwonlyargs)
                        + ([node.args.vararg] if node.args.vararg else [])
                        + ([node.args.kwarg] if node.args.kwarg else [])
                    ):
                        if a and a.annotation:
                            annotation_nodes.append((a.lineno, a.annotation))
                elif isinstance(node, ast.AnnAssign) and node.annotation:
                    annotation_nodes.append((node.lineno, node.annotation))

            for lineno, ann in annotation_nodes:
                for sub in ast.walk(ann):
                    if isinstance(sub, ast.Name) and isinstance(sub.ctx, ast.Load):
                        if sub.id not in bound_names:
                            rel = py_file.relative_to(insetu_pkg.parent).as_posix()
                            violations.append(f"{rel}:{lineno} references unimported type annotation '{sub.id}'")

        self.assertEqual(violations, [], "Unimported type annotation symbols found:\n" + "\n".join(violations))


if __name__ == "__main__":
    unittest.main()
