import unittest

from insetu.core.agent.orchestrator import (
    _persist_routine_response,
    _response_path_error,
    validate_routine_definition,
)


class _RecordingVfs:
    def __init__(self):
        self.saves = []

    def save(self, uri, content, data=None):
        self.saves.append((uri, content, data))


class _FakeCtx:
    def __init__(self):
        self.vfs = _RecordingVfs()


def _routine(response_path):
    return {
        "id": "weekly_report",
        "response_path": response_path,
        "nodes": [{"id": "draft", "type": "llm", "prompt": "Summarize."}],
    }


class TestRoutineResponsePath(unittest.TestCase):
    """A routine's response_path writes documents directly; code targets must go through bridge.sync."""

    def test_document_targets_are_accepted(self):
        for path in ("vfs://notes/report_{date}.md", "ctx://contexts/summary.txt", "vfs://notes/data.json", "vfs://notes/plan.yaml"):
            with self.subTest(path=path):
                self.assertIsNone(_response_path_error(path))
                ok, err, _ = validate_routine_definition(_routine(path))
                self.assertTrue(ok, err)

    def test_code_targets_are_rejected_at_validation(self):
        for path in ("vfs://insetu/insetu/app.py", "vfs://web/src/index.js", "vfs://notes/no_extension"):
            with self.subTest(path=path):
                ok, err, _ = validate_routine_definition(_routine(path))
                self.assertFalse(ok)
                self.assertIn("bridge.sync", err)

    def test_persist_saves_documents_with_date_and_metadata(self):
        ctx = _FakeCtx()
        routine = dict(_routine("vfs://notes/report_{date}.md"), archive_path="vfs://notes/archive/")
        uri = _persist_routine_response(ctx, routine, "# Report")
        self.assertEqual(len(ctx.vfs.saves), 1)
        saved_uri, content, meta = ctx.vfs.saves[0]
        self.assertEqual(saved_uri, uri)
        self.assertNotIn("{date}", saved_uri)
        self.assertEqual(content, "# Report")
        self.assertEqual(meta["archive_path"], "vfs://notes/archive/")

    def test_persist_refuses_code_targets_at_runtime(self):
        ctx = _FakeCtx()
        with self.assertRaises(PermissionError):
            _persist_routine_response(ctx, _routine("vfs://insetu/insetu/app.py"), "print('hi')")
        self.assertEqual(ctx.vfs.saves, [])

    def test_persist_is_a_no_op_without_path_or_text(self):
        ctx = _FakeCtx()
        self.assertIsNone(_persist_routine_response(ctx, _routine(None), "text"))
        self.assertIsNone(_persist_routine_response(ctx, _routine("vfs://notes/r.md"), ""))
        self.assertEqual(ctx.vfs.saves, [])


if __name__ == "__main__":
    unittest.main()
