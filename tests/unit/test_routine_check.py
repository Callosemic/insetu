"""The routine check reports prompts that do not resolve, and a run stops on a missing prompt instead of sending an empty one."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from insetu.core.agent import routine_check
from insetu.core.prompts import engine_prompts
from insetu.core.prompts.engine_prompts import PromptNotFound, require_prompt_text

MISSING = "ctx://prompts/inSetu/insetu-close-session.md"
TEMPLATE = "ctx://prompts/.templates/git/close_session_protocol.md"


def _routine(*nodes, **meta):
    return {"id": "wrap", "filepath": "ctx://routines/wrap.md", "nodes": list(nodes), **meta}


class _FakeCascade:
    """Stands in for the prompt cascade: knows a fixed set of prompts, and some only by file-name search."""

    def __init__(self, texts, by_name=None):
        self.texts = texts
        self.by_name = by_name or {}

    def read(self, ctx, uri, report=None):
        if uri in self.texts:
            if report is not None:
                report.update({"source": uri, "via": "cascade"})
            return self.texts[uri]
        if uri in self.by_name:
            source = self.by_name[uri]
            if report is not None:
                report.update({"source": source, "via": "name_search"})
            return self.texts[source]
        return None

    def resolve(self, ctx, target_uri=None, raw_content=None, interpolate_vars=True, **kwargs):
        text = raw_content if raw_content is not None else self.read(ctx, target_uri)
        if text is None:
            return None
        return text.replace("{{include_prompt: ctx://prompts/gone.md}}", "[!] MACRO TARGET NOT FOUND: ctx://prompts/gone.md")


class TestRoutineCheck(unittest.TestCase):
    """check_routine mirrors how a run resolves each LLM step's prompt."""

    def _check(self, routine, texts=None, by_name=None, repos=("insetu", "akasa")):
        cascade = _FakeCascade(texts or {}, by_name)
        ctx = SimpleNamespace(workspace_id="default")
        with patch.object(routine_check, "read_prompt_with_cascade", cascade.read), \
                patch.object(routine_check, "resolve_prompt_text", cascade.resolve), \
                patch.object(routine_check, "get_sister_repos", lambda ws: list(repos)):
            return routine_check.check_routine(ctx, routine)

    def test_a_missing_prompt_is_an_error_with_the_case_hint(self):
        """A prompt_uri that does not resolve is an error, and a folder that differs from a repository only by case is named."""
        findings = self._check(_routine({"id": "execute_prompt", "type": "llm", "prompt_uri": MISSING}))
        self.assertEqual([f["code"] for f in findings], ["prompt_not_found"])
        self.assertEqual(findings[0]["severity"], "error")
        self.assertIn("'inSetu' differs from the repository 'insetu'", findings[0]["message"])

    def test_the_routine_level_include_prompt_is_used_when_the_step_names_none(self):
        """A step without prompt_uri falls back to the routine's include_prompt, as a run does."""
        findings = self._check(_routine({"id": "execute_prompt", "type": "llm"}, include_prompt=MISSING))
        self.assertEqual([f["code"] for f in findings], ["prompt_not_found"])

    def test_a_resolving_template_is_clean(self):
        """A step pointing at an existing template has no problems."""
        findings = self._check(_routine({"id": "execute_prompt", "type": "llm", "prompt_uri": TEMPLATE}), texts={TEMPLATE: "Close the session."})
        self.assertEqual(findings, [])

    def test_a_prompt_found_only_by_file_name_is_a_warning(self):
        """Resolving through the file-name search works today but is fragile, so it is reported with the URI it found."""
        findings = self._check(
            _routine({"id": "execute_prompt", "type": "llm", "prompt_uri": "ctx://prompts/old/close.md"}),
            texts={"vfs://insetu/.insetu-data/prompts/close.md": "Close."},
            by_name={"ctx://prompts/old/close.md": "vfs://insetu/.insetu-data/prompts/close.md"},
        )
        self.assertEqual([f["code"] for f in findings], ["found_by_name_search"])
        self.assertIn("vfs://insetu/.insetu-data/prompts/close.md", findings[0]["message"])

    def test_a_missing_include_is_an_error(self):
        """An {{include_prompt: ...}} that does not resolve is reported, in a step's own text or in its prompt."""
        findings = self._check(_routine({"id": "step", "type": "llm", "prompt": "Do it.\n{{include_prompt: ctx://prompts/gone.md}}"}))
        self.assertEqual([(f["code"], f["uri"]) for f in findings], [("include_not_found", "ctx://prompts/gone.md")])

    def test_a_step_with_no_prompt_at_all_is_a_warning(self):
        """A step with no text and no prompt_uri runs with only the chat message."""
        findings = self._check(_routine({"id": "step", "type": "llm", "prompt": "---\n---"}))
        self.assertEqual([f["code"] for f in findings], ["empty_prompt"])

    def test_non_llm_steps_are_not_checked(self):
        """exec and loop steps have no prompt to resolve."""
        self.assertEqual(self._check(_routine({"id": "refresh", "type": "exec", "capability": "git.compile_diffs"})), [])


class TestCascadeReportsWhereItFoundAPrompt(unittest.TestCase):
    """read_prompt_with_cascade tells the check whether a prompt was found directly or only by file name."""

    def _ctx(self, files):
        return SimpleNamespace(workspace_id="default", vfs=SimpleNamespace(read=lambda uri: files.get(uri)), get_active_modules=lambda: ["git"])

    def test_a_direct_hit_is_reported_as_cascade(self):
        ctx = self._ctx({"ctx://prompts/notes.md": "Notes."})
        report = {}
        with patch.object(engine_prompts, "get_sister_repos", lambda ws: []):
            self.assertEqual(engine_prompts.read_prompt_with_cascade(ctx, "ctx://prompts/notes.md", report=report), "Notes.")
        self.assertEqual(report, {"source": "ctx://prompts/notes.md", "via": "cascade"})

    def test_a_file_name_match_is_reported_as_name_search(self):
        ctx = self._ctx({"vfs://insetu/.insetu-data/prompts/close.md": "Close."})
        report = {}
        with patch.object(engine_prompts, "get_sister_repos", lambda ws: []), \
                patch.object(engine_prompts, "provide_available_prompts", lambda workspace_id=None: ["vfs://insetu/.insetu-data/prompts/close.md"]):
            self.assertEqual(engine_prompts.read_prompt_with_cascade(ctx, "ctx://prompts/old/close.md", report=report), "Close.")
        self.assertEqual(report, {"source": "vfs://insetu/.insetu-data/prompts/close.md", "via": "name_search"})


class TestAMissingPromptStopsTheRun(unittest.TestCase):
    """require_prompt_text turns a prompt that did not resolve into an error naming the routine and URI."""

    def test_missing_prompt_raises(self):
        with self.assertRaises(PromptNotFound) as caught:
            require_prompt_text(None, MISSING, "insetu_root")
        self.assertIn("insetu_root", str(caught.exception))
        self.assertIn(MISSING, str(caught.exception))

    def test_resolved_prompt_passes_through(self):
        self.assertEqual(require_prompt_text("", TEMPLATE), "")
        self.assertEqual(require_prompt_text("Close.", TEMPLATE), "Close.")


if __name__ == "__main__":
    unittest.main()
