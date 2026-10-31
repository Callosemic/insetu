"""P13 Sprints 1 and 2: repository landmarks, repo-tier settings authority, optional includes and the settings-access ratchet."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import insetu.core.topology.engine_topology as _engine_topology
import insetu.core.utils_core as _utils_core
from insetu.core.utils_core import InSetuURI, resolve_macro_includes
from insetu.core.topology.engine_topology import (
    TOPOLOGY_SETTINGS_SCHEMA,
    discover_constitution_files,
    get_landmark_kinds,
    resolve_repo_landmarks,
)
from insetu.extensions.tracker.engine_tracker import _register_tracker_landmark
from insetu.core.system.engine_system import system_bp
from tests.fitness.rules_python import check_settings_access_ratchet


class _FakeVFS:
    def __init__(self, files=None):
        self.files = dict(files or {})

    def read(self, uri, is_absolute_artifact=False):
        return self.files.get(str(uri))

    def save(self, uri, content, data=None):
        self.files[str(uri)] = content
        return {"status": "success"}

    def walk(self, root_uri, exts=None):
        prefix = str(root_uri).rstrip("/") + "/"
        out = []
        for k in sorted(self.files.keys()):
            if k.startswith(prefix):
                if not exts or any(k.endswith(e) for e in exts):
                    out.append(k)
        return out


class _FakeCtx:
    def __init__(self, workspace_id="test_ws", config=None, files=None):
        self.workspace_id = workspace_id
        self.config = config or {
            "target_repos": [
                {"repo_dir": "insetu", "title": "inSetu Developer OS"},
                {"repo_dir": "akasa", "title": "Akasa Kernel"},
            ]
        }
        self.vfs = _FakeVFS(files)


class TestRepoLandmarks(unittest.TestCase):
    """Landmarks resolve from discovery and repo settings within the repository, and optional includes follow extension state."""

    def test_uri_canonicalize_settings_scheme(self):
        self.assertEqual(InSetuURI.canonicalize("settings/topology.md"), "ctx://settings/topology.md")
        self.assertEqual(
            InSetuURI.canonicalize("ctx://settings/.templates/user/agent.md"),
            "ctx://settings/.templates/user/agent.md",
        )

    def test_system_settings_volume_declared(self):
        self.assertIn("settings", system_bp.volumes)
        spec = system_bp.volumes["settings"]
        self.assertEqual(spec["scheme"], "ctx")
        self.assertEqual(spec["module_subdir"], "settings")

    def test_landmarks_conventional_discovery_insetu_and_akasa(self):
        insetu_files = [
            "vfs://insetu/README.md",
            "vfs://insetu/docs/01_engineering_standards.md",
            "vfs://insetu/docs/02_extension_api_contract.md",
            "vfs://insetu/docs/adrs/0001-record-architecture-decisions.md",
            "vfs://insetu/tests/unit/test_sample.py",
            "vfs://insetu/tests/fitness/rules_python.py",
            "vfs://insetu/.insetu-data/tracker/open/task-1.md",
        ]
        akasa_files = [
            "vfs://akasa/README.md",
            "vfs://akasa/docs/standards/security.md",
            "vfs://akasa/tests/test_kernel.py",
        ]
        with patch.object(
            _engine_topology,
            "get_topology_files_for_repo",
            side_effect=lambda wid, repo_dir: insetu_files if repo_dir == "insetu" else akasa_files,
        ), patch.object(
            _engine_topology,
            "get_repo_path",
            side_effect=lambda repo_dir, wid=None: "",
        ), patch.object(
            _engine_topology.hooks,
            "emit_merge_list",
            side_effect=lambda event, **kw: _register_tracker_landmark() if event == "register_repo_landmarks" else [],
        ):
            ctx = _FakeCtx()
            insetu_lm = resolve_repo_landmarks(ctx, repo="insetu")
            self.assertIn("vfs://insetu/docs/01_engineering_standards.md", insetu_lm["landmarks"]["standards_files"])
            self.assertIn("vfs://insetu/docs/02_extension_api_contract.md", insetu_lm["landmarks"]["contract_files"])
            self.assertIn("vfs://insetu/README.md", insetu_lm["landmarks"]["contract_files"])
            self.assertEqual(insetu_lm["landmarks"]["adr_dir"], "vfs://insetu/docs/adrs")
            self.assertEqual(insetu_lm["landmarks"]["tracker_dir"], "vfs://insetu/.insetu-data/tracker")
            self.assertEqual(insetu_lm["landmarks"]["test_dirs"], ["vfs://insetu/tests/unit"])
            self.assertEqual(insetu_lm["landmarks"]["fitness_dirs"], ["vfs://insetu/tests/fitness"])

            akasa_lm = resolve_repo_landmarks(ctx, repo="akasa")
            self.assertEqual(akasa_lm["landmarks"]["standards_files"], ["vfs://akasa/docs/standards/security.md"])
            self.assertEqual(akasa_lm["landmarks"]["contract_files"], ["vfs://akasa/README.md"])
            self.assertEqual(akasa_lm["landmarks"]["adr_dir"], "")
            self.assertEqual(akasa_lm["landmarks"]["tracker_dir"], "")
            self.assertEqual(akasa_lm["landmarks"]["test_dirs"], ["vfs://akasa/tests"])

            # Constitution pinning must include docs/01_engineering_standards.md
            constitution = discover_constitution_files(ctx)
            self.assertIn("vfs://insetu/docs/01_engineering_standards.md", constitution)
            self.assertIn("vfs://akasa/docs/standards/security.md", constitution)

    def test_landmarks_override_local_precedence_confinement_and_authority(self):
        tracked = [
            "vfs://insetu/custom/rules.md",
            "vfs://insetu/custom/local_rules.md",
            "vfs://insetu/contracts/api.md",
            "vfs://insetu/architecture/decisions/001.md",
            "vfs://insetu/suites/unit/test_a.py",
            "vfs://insetu/suites/arch/check.py",
        ]
        shared_md = (
            "---\n"
            "schema: 1\n"
            "unauthorized_permission: true\n"
            "landmarks:\n"
            "  standards:\n"
            "    - custom/rules.md\n"
            "    - ../outside_secret.md\n"
            "  contracts:\n"
            "    - /etc/passwd\n"
            "    - contracts/api.md\n"
            "  adrs: architecture/decisions\n"
            "  tests:\n"
            "    - suites/unit\n"
            "  fitness:\n"
            "    - suites/arch/check.py\n"
            "---\n"
        )
        local_md = (
            "---\n"
            "schema: 1\n"
            "landmarks:\n"
            "  standards:\n"
            "    - custom/local_rules.md\n"
            "---\n"
        )
        with patch.object(
            _engine_topology,
            "get_topology_files_for_repo",
            side_effect=lambda wid, repo_dir: tracked,
        ), patch.object(
            _engine_topology,
            "get_repo_path",
            side_effect=lambda repo_dir, wid=None: "",
        ):
            ctx = _FakeCtx(
                workspace_id="ws_override_test",
                files={
                    "vfs://insetu/.insetu-data/settings/topology.md": shared_md,
                    "vfs://insetu/.insetu-data/settings.local/topology.md": local_md,
                },
            )
            lm = resolve_repo_landmarks(ctx, repo="insetu")
            self.assertEqual(lm["landmarks"]["standards_files"], ["vfs://insetu/custom/local_rules.md"])
            self.assertEqual(lm["landmarks"]["contract_files"], ["vfs://insetu/contracts/api.md"])
            self.assertEqual(lm["landmarks"]["adr_dir"], "vfs://insetu/architecture/decisions")
            self.assertEqual(lm["landmarks"]["test_dirs"], ["vfs://insetu/suites/unit"])
            self.assertEqual(lm["landmarks"]["fitness_dirs"], ["vfs://insetu/suites/arch/check.py"])

            notices_text = "\n".join(lm["notices"])
            self.assertIn("unauthorized_permission", notices_text)
            self.assertIn("/etc/passwd", notices_text)

            # Reading landmarks never writes; a local override that git would commit is reported instead.
            self.assertIsNone(ctx.vfs.read("vfs://insetu/.insetu-data/.gitignore"))
            self.assertIn("settings.local/", notices_text)

            ctx.vfs.files["vfs://insetu/.insetu-data/.gitignore"] = "settings.local/\n"
            _engine_topology._REPO_TIER_SETTINGS_CACHE.clear()
            quiet = resolve_repo_landmarks(ctx, repo="insetu")
            self.assertFalse(any(".gitignore" in n for n in quiet["notices"]))

    def test_unknown_repository_has_no_landmarks(self):
        ctx = _FakeCtx(workspace_id="ws_unknown_repo")
        with patch.object(_engine_topology, "get_topology_files_for_repo", side_effect=AssertionError("must not scan")):
            lm = resolve_repo_landmarks(ctx, repo="not-mounted")
        self.assertEqual((lm["landmarks"]["standards_files"], lm["landmarks"]["adr_dir"]), ([], ""))
        self.assertTrue(any("not a mounted repository" in n for n in lm["notices"]))

    def test_core_names_no_extension_landmark(self):
        with patch.object(_engine_topology.hooks, "emit_merge_list", return_value=[]):
            kinds, notices = get_landmark_kinds("ws_core_only")
        self.assertEqual([k["id"] for k in kinds], ["standards", "contracts", "adrs", "tests", "fitness"])
        self.assertEqual(notices, [])

    def test_extension_landmark_kinds_are_validated(self):
        bad = [
            {"id": "standards", "shape": "files", "output": "x_files", "defaults": []},
            {"id": "notes", "shape": "dir", "output": "notices", "defaults": []},
            {"id": "wiki", "shape": "tree", "output": "wiki_dir", "defaults": []},
            {"id": "escape", "shape": "dir", "output": "escape_dir", "defaults": ["../elsewhere"]},
        ]
        with patch.object(_engine_topology.hooks, "emit_merge_list", return_value=bad + _register_tracker_landmark()):
            kinds, notices = get_landmark_kinds("ws_bad_kinds")
        self.assertEqual([k["id"] for k in kinds][-1], "tracker")
        self.assertEqual(len(kinds), 6)
        self.assertEqual(len(notices), 4)

    def test_landmarks_setting_is_hidden_from_the_hub(self):
        self.assertEqual([f["type"] for f in TOPOLOGY_SETTINGS_SCHEMA], ["hidden"])

    def test_sprint2_optional_prompt_includes(self):
        templates = {
            "ctx://prompts/.templates/tracker/phase.md": "## Tracker Phase\nClose active tickets.",
            "ctx://prompts/regular.md": "Regular prompt body",
        }
        pattern = r'\{\{\s*include_prompt\??\s*:\s*([^\s{}]+)\s*(?:\{([\s\S]*?)\})?\s*\}\}'
        src_disabled = "Header Line\n\n{{include_prompt?: ctx://prompts/.templates/tracker/phase.md}}\n\nFooter Line"

        # 1. When extension 'tracker' is disabled, {{include_prompt?: ...}} resolves to "" and collapses blank lines
        with patch.object(_utils_core, "is_extension_enabled", side_effect=lambda ext, wid=None: False):
            out_disabled = resolve_macro_includes(
                src_disabled,
                "ctx://prompts/housekeeping.md",
                pattern,
                lambda uri: templates.get(uri),
                workspace_id="test_ws",
            )
            self.assertEqual(out_disabled, "Header Line\n\nFooter Line")
            # Blank lines away from the omitted include are content (code blocks, poems) and stay as written.
            spaced = "Keep\n\n\n\nthese\n\n{{include_prompt?: ctx://prompts/.templates/tracker/phase.md}}\n\nEnd"
            out_spaced = resolve_macro_includes(spaced, "ctx://prompts/housekeeping.md", pattern, lambda uri: templates.get(uri), workspace_id="test_ws")
            self.assertEqual(out_spaced, "Keep\n\n\n\nthese\n\nEnd")

        # 2. When extension 'tracker' is enabled, it expands normally (and errors if missing or non-template)
        with patch.object(_utils_core, "is_extension_enabled", side_effect=lambda ext, wid=None: ext == "tracker"):
            out_enabled = resolve_macro_includes(
                src_disabled,
                "ctx://prompts/housekeeping.md",
                pattern,
                lambda uri: templates.get(uri),
                workspace_id="test_ws",
            )
            self.assertIn("## Tracker Phase", out_enabled)

            src_missing = "{{include_prompt?: ctx://prompts/.templates/tracker/missing_file.md}}"
            out_missing = resolve_macro_includes(
                src_missing,
                "ctx://prompts/housekeeping.md",
                pattern,
                lambda uri: templates.get(uri),
                workspace_id="test_ws",
            )
            self.assertIn("[!] MACRO TARGET NOT FOUND:", out_missing)

            src_shorthand = "{{include_prompt?: .templates/tracker/phase.md}}"
            out_shorthand = resolve_macro_includes(
                src_shorthand,
                "ctx://prompts/housekeeping.md",
                pattern,
                lambda uri: templates.get(uri),
                workspace_id="test_ws",
            )
            self.assertIn("## Tracker Phase", out_shorthand)

            for invalid_uri in ("ctx://prompts/regular.md", "ctx://prompts/.templates/user/custom.md"):
                out_invalid_opt = resolve_macro_includes(
                    f"{{{{include_prompt?: {invalid_uri}}}}}",
                    "ctx://prompts/housekeeping.md",
                    pattern,
                    lambda uri: templates.get(uri),
                    workspace_id="test_ws",
                )
                self.assertIn("[!] OPTIONAL INCLUDE ERROR:", out_invalid_opt)

    def test_settings_access_ratchet_is_a_ratchet(self):
        """New files and higher counts fail; lower counts and empty entries fail until the baseline is lowered."""
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            (root / "insetu" / "core" / "sample").mkdir(parents=True)
            floor = root / "insetu" / "cli.py"
            floor.write_text('x = "config.json"\n', encoding="utf-8")
            baseline = {"insetu/cli.py": (1, "boot floor")}
            self.assertEqual(check_settings_access_ratchet(root, ratchet=baseline), [])

            rogue = root / "insetu" / "core" / "sample" / "rogue.py"
            rogue.write_text("from insetu.core.sdk import load_config\ncfg = load_config()\n", encoding="utf-8")
            out = check_settings_access_ratchet(root, ratchet=baseline)
            self.assertEqual(len(out), 1)
            self.assertIn("insetu/core/sample/rogue.py", out[0])
            rogue.unlink()

            floor.write_text('x = "config.json"\ny = "host.json"\n', encoding="utf-8")
            self.assertIn("grew from 1 to 2", check_settings_access_ratchet(root, ratchet=baseline)[0])

            floor.write_text("x = 1\n", encoding="utf-8")
            self.assertIn("remove this SETTINGS_ACCESS_RATCHET entry", check_settings_access_ratchet(root, ratchet=baseline)[0])

            floor.write_text('x = "config.json"\n', encoding="utf-8")
            self.assertIn("lower its SETTINGS_ACCESS_RATCHET baseline to 1", check_settings_access_ratchet(root, ratchet={"insetu/cli.py": (2, "boot floor")})[0])

    def test_settings_access_ratchet_matches_the_repository(self):
        self.assertEqual(check_settings_access_ratchet(), [])


if __name__ == "__main__":
    unittest.main()
