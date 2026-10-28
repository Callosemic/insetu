import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch

from insetu.fallback_bridge import (
    app as recovery_app,
    parse_blocks,
    apply_block_in_memory,
    expand_macros,
)


class TestFallbackBridge(unittest.TestCase):
    def setUp(self):
        self.client = recovery_app.test_client()

    def test_parse_blocks_skips_id_headers_and_captures_comments(self):
        """parse_blocks ignores <<<<<<< ID: headers and cleanly separates comments from search/replace blocks."""
        payload = (
            "<<<<<<< FILE: insetu/app.py\n"
            "<<<<<<< ID: cell_987654321\n"
            "<<<<<<< COMMENT\n"
            "Harden recovery port resolution\n"
            "<<<<<<< SEARCH\n"
            "def old_func():\n"
            "    return 5005\n"
            "=======\n"
            "def old_func():\n"
            "    return 5050\n"
            ">>>>>>> REPLACE\n"
        )
        parsed = parse_blocks(payload)
        self.assertIn("insetu/app.py", parsed)
        blocks = parsed["insetu/app.py"]
        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0]["comment"], "Harden recovery port resolution")
        self.assertEqual(blocks[0]["search"], "def old_func():\n    return 5005")
        self.assertEqual(blocks[0]["replace"], "def old_func():\n    return 5050")
        self.assertNotIn("cell_987654321", blocks[0]["comment"])
        self.assertNotIn("cell_987654321", blocks[0]["search"])

    def test_parse_blocks_handles_genesis_without_search_boundary(self):
        """parse_blocks transitions from OUTSIDE/COMMENT directly to REPLACE on ======= for genesis patches."""
        payload = (
            "<<<<<<< FILE: insetu/new_component.py\n"
            "<<<<<<< ID: cell_genesis_1\n"
            "<<<<<<< COMMENT\n"
            "Provision new component\n"
            "=======\n"
            "class NewComponent:\n"
            "    pass\n"
            ">>>>>>> REPLACE\n\n"
            "<<<<<<< FILE: insetu/no_comment.py\n"
            "=======\n"
            "value = 42\n"
            ">>>>>>> REPLACE\n"
        )
        parsed = parse_blocks(payload)
        self.assertIn("insetu/new_component.py", parsed)
        self.assertIn("insetu/no_comment.py", parsed)

        genesis_block1 = parsed["insetu/new_component.py"][0]
        self.assertEqual(genesis_block1["search"], "")
        self.assertEqual(genesis_block1["replace"], "class NewComponent:\n    pass")
        self.assertEqual(genesis_block1["comment"], "Provision new component")

        genesis_block2 = parsed["insetu/no_comment.py"][0]
        self.assertEqual(genesis_block2["search"], "")
        self.assertEqual(genesis_block2["replace"], "value = 42")
        self.assertEqual(genesis_block2["comment"], "")

    def test_apply_block_in_memory_genesis_and_anchors(self):
        """apply_block_in_memory succeeds on empty search (genesis) and performs standard diff replacements."""
        # 1. Genesis patch replaces empty content
        genesis_block = {"search": "", "replace": "header = 'genesis'"}
        ok, res = apply_block_in_memory("", genesis_block)
        self.assertTrue(ok)
        self.assertEqual(res, "header = 'genesis'")

        # 2. Existing content anchor match
        original = "first_line = 1\ntarget_line = 2\nlast_line = 3\n"
        patch_block = {
            "search": "target_line = 2",
            "replace": "target_line = 42",
        }
        ok, res = apply_block_in_memory(original, patch_block)
        self.assertTrue(ok)
        self.assertIn("target_line = 42", res)
        self.assertNotIn("target_line = 2", res)

        # 3. Nonexistent anchor fails safely without mutating content
        mismatched_block = {
            "search": "missing_line = 999",
            "replace": "should_not_appear = True",
        }
        ok, res = apply_block_in_memory(original, mismatched_block)
        self.assertFalse(ok)
        self.assertEqual(res, original)

    def test_macro_expansion_in_search_and_replace(self):
        """expand_macros expands multiplier and triple shorthand syntax."""
        text = "padding =     \nindent = >>>"
        expanded = expand_macros(text)
        self.assertEqual(expanded, "padding =     \nindent = >>>")

    def test_recovery_auth_bootstrap_route(self):
        """GET and POST /auth/bootstrap in fallback bridge return 200 with recovery and lifeboat metadata."""
        get_res = self.client.get("/auth/bootstrap")
        self.assertEqual(get_res.status_code, 200)
        get_data = get_res.get_json()
        self.assertEqual(get_data.get("status"), "recovery")
        self.assertEqual(get_data.get("mode"), "lifeboat")

        post_res = self.client.post("/auth/bootstrap", json={})
        self.assertEqual(post_res.status_code, 200)
        post_data = post_res.get_json()
        self.assertEqual(post_data.get("status"), "recovery")
        self.assertEqual(post_data.get("mode"), "lifeboat")

    def test_recovery_ui_and_root_redirect(self):
        """Root route redirects to /recovery and /recovery renders panic details."""
        root_res = self.client.get("/")
        self.assertEqual(root_res.status_code, 302)
        self.assertEqual(root_res.headers.get("Location"), "/recovery")
        with patch.dict(os.environ, {"INSETU_PANIC_DETAILS": "TestTraceback: simulated failure"}):
            rec_res = self.client.get("/recovery")
            self.assertEqual(rec_res.status_code, 200)
            self.assertIn(b"KERNEL PANIC", rec_res.data)
            self.assertIn(b"TestTraceback: simulated failure", rec_res.data)

    def test_recovery_reboot_token_sync_contract(self):
        """Recovery template script synchronizes insetu_boot_token to client storage upon successful bootstrap response."""
        from insetu.fallback_bridge import HTML_TEMPLATE

        # 1. Assert HTML template includes sessionStorage and localStorage token persistence
        self.assertIn("sessionStorage.setItem('insetu_boot_token', data.token)", HTML_TEMPLATE)
        self.assertIn("localStorage.setItem('insetu_boot_token', data.token)", HTML_TEMPLATE)
        self.assertIn("window.location.href = '/'", HTML_TEMPLATE)

        # 2. Verify /api/system/reboot returns 200 with success status
        with patch("threading.Thread.start"):
            reboot_res = self.client.post("/api/system/reboot")
            self.assertEqual(reboot_res.status_code, 200)
            reboot_data = reboot_res.get_json()
            self.assertEqual(reboot_data.get("status"), "success")


if __name__ == "__main__":
    unittest.main()