import json
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from flask import Flask

import akasa
import akasa.utils as akasa_utils
from akasa.db import apply_declarative_schema
from akasa.utils import load_config
from akasa.vfs import sync_vfs_barrier
from akasa.workers import _init_worker_schema
from insetu.core.agent.engine_agent import (
    AGENT_SCHEMA,
    _execute_agent_turn,
    _parse_slash_command,
    agent_bp,
)
from insetu.core.agent import orchestrator as _orch_mod
from insetu.core.agent.orchestrator import (
    SCRATCH_VAULT_THRESHOLD_BYTES,
    _interpolate_all_syntax,
    evaluate_when_condition,
    execute_declarative_routine,
    list_available_routines,
    load_routine_definition,
)
from insetu.core.sdk import (
    CycleError,
    extract_template_variables,
    interpolate_template_variables,
    resolve_dag_wavefronts,
)
from insetu.core.bridge.engine_bridge import BRIDGE_SCHEMA, bridge_bp
from insetu.core.cartographer.cartographer import CARTOGRAPHER_SCHEMA, cartographer_bp
from insetu.core.fs.engine_fs import fs_bp
from insetu.core.gather.engine_gather import VFS_INDEX_SCHEMA, gather_bp
from insetu.core.llm.engine_llm import (
    _resolve_tier_model,
    llm_bp,
    validate_output_schema,
)
from insetu.core.mcp.engine_mcp import handle_mcp_jsonrpc, mcp_bp
from insetu.core.prompts.engine_prompts import prompts_bp
from insetu.core.system.engine_system import system_bp
from insetu.core.topology.engine_topology import (
    TOPOLOGY_SCHEMA,
    force_topology_scan,
    mount_topology_volumes_dynamically,
)


class TestAgentOrchestratorAndMcp(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root_path = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root_path / ".insetu"
        (self.control_dir / "cache" / "db").mkdir(parents=True, exist_ok=True)
        self.repo_dir = self.root_path / "alpha"
        self.repo_dir.mkdir(parents=True, exist_ok=True)

        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        akasa.reset_state(cwd=self.root_path.as_posix(), control_dir=".insetu")

        (self.control_dir / "host.json").write_text(json.dumps({"port": 5005}), encoding="utf-8")
        (self.control_dir / "workspaces.json").write_text(
            json.dumps({
                "workspaces": {"default": {"config_path": "config.json"}},
                "active_workspace": "default",
            }),
            encoding="utf-8",
        )
        (self.control_dir / "config.json").write_text(
            json.dumps({
                "workspace_root": self.root_path.as_posix(),
                "extensions": ["config"],
                "target_repos": [{"repo_dir": "alpha", "title": "Alpha", "exts": [".py", ".md"]}],
            }),
            encoding="utf-8",
        )
        _init_worker_schema("default")
        apply_declarative_schema("topology", TOPOLOGY_SCHEMA, "default")
        apply_declarative_schema("cartographer", CARTOGRAPHER_SCHEMA, "default")
        apply_declarative_schema("vfs_index", VFS_INDEX_SCHEMA, "default")
        apply_declarative_schema("bridge", BRIDGE_SCHEMA, "default")
        apply_declarative_schema("agent", AGENT_SCHEMA, "default")
        mount_topology_volumes_dynamically(load_config("default"), workspace_id="default")

    def tearDown(self):
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def test_llm_semantic_tier_resolution_and_universal_bouncer(self):
        """engine_llm resolves semantic tiers (fast, standard, thinking, frontier) and self-heals invalid output_schema responses."""
        llm_ctx = llm_bp.get_context("default")
        llm_ctx.settings.update({
            "provider": "anthropic",
            "model": "claude-3-5-sonnet-latest",
            "tier_fast_model": "claude-3-5-haiku-latest",
            "tier_thinking_model": "claude-3-7-sonnet-thinking",
            "api_key": "sk-test-key",
        })
        self.assertEqual(_resolve_tier_model(llm_ctx, "fast"), "claude-3-5-haiku-latest")
        self.assertEqual(_resolve_tier_model(llm_ctx, "low"), "claude-3-5-haiku-latest")
        self.assertEqual(_resolve_tier_model(llm_ctx, "thinking"), "claude-3-7-sonnet-thinking")
        self.assertEqual(_resolve_tier_model(llm_ctx, "high"), "claude-3-7-sonnet-thinking")
        self.assertEqual(_resolve_tier_model(llm_ctx, "standard"), "claude-3-5-sonnet-latest")
        self.assertEqual(_resolve_tier_model(llm_ctx, "medium"), "claude-3-5-sonnet-latest")
        self.assertEqual(_resolve_tier_model(llm_ctx, "frontier"), "claude-3-7-sonnet-thinking")

        # Validate output_schema bouncer directly
        ok_intent, parsed_intent, _ = validate_output_schema('```json\n{"intent": "EDIT_CODE"}\n```', "intent_classification")
        self.assertTrue(ok_intent)
        self.assertEqual(parsed_intent["intent"], "EDIT_CODE")

        bad_patch, _, err_msg = validate_output_schema("No patch blocks here.", "yomama_patch")
        self.assertFalse(bad_patch)
        self.assertIn("Yomama patch", err_msg)

        # Verify self-healing retry loop in llm.complete when Attempt 1 fails output_schema and Attempt 2 succeeds
        call_Idx = 0
        responses = [
            "Sorry, I forgot the patch blocks!",
            "<<<<<<< FILE: vfs://alpha/app.py\n<<<<<<< SEARCH\nx = 1\n=======\nx = 2\n>>>>>>> REPLACE",
        ]
        def fake_inference(provider, api_key, model, messages, system_prompt, base_url="", **kwargs):
            nonlocal call_Idx
            out = responses[min(call_Idx, len(responses) - 1)]
            call_Idx += 1
            return out, None

        sys_ctx = system_bp.get_context("default")
        with patch("insetu.core.llm.engine_llm._run_single_inference", side_effect=fake_inference):
            res = sys_ctx.call(
                "llm.complete",
                messages=[{"role": "user", "content": "Change x to 2"}],
                tier="thinking",
                output_schema="yomama_patch",
                max_retries=3,
            )
        self.assertEqual(res["attempts"], 2)
        self.assertEqual(res["model"], "claude-3-7-sonnet-thinking")
        self.assertIn("vfs://alpha/app.py", res["parsed"])
    def test_orchestrator_when_evaluator_and_256kb_scratch_vaulting(self):
        """evaluate_when_condition safely evaluates {{ ... }} boolean/comparison expressions and _interpolate_all_syntax resolves nested/pipe-chained fallbacks."""
        chain_ctx = {
            "global": {"mode": "auto", "effective_intent": "EDIT_CODE", "user_message": "Fallback Msg"},
            "classify_intent": {"intent": "EDIT_CODE"},
            "initial_answer": {"text": "Initial Answer Text"},
        }
        self.assertTrue(evaluate_when_condition("{{ global.mode }} == 'auto'", chain_ctx))
        self.assertFalse(evaluate_when_condition("{{ global.mode }} == 'ask'", chain_ctx))
        self.assertTrue(evaluate_when_condition("{{ global.effective_intent }} != 'CHAT_ONLY'", chain_ctx))
        self.assertEqual(
            _interpolate_all_syntax("Mode={{ global.mode }}, Intent={{ nodes.classify_intent.intent }}", chain_ctx),
            "Mode=auto, Intent=EDIT_CODE",
        )
        # Verify inside-out nested mustache fallback ({{ nodes.final_answer.text | {{ nodes.initial_answer.text }} }})
        self.assertEqual(
            _interpolate_all_syntax("{{ nodes.final_answer.text | {{ nodes.initial_answer.text }} }}", chain_ctx),
            "Initial Answer Text",
        )
        # Verify pipe-chained variable fallback ({{ inputs.patch_text | {{ inputs.user_message }} }})
        self.assertEqual(
            _interpolate_all_syntax("{{ inputs.patch_text | {{ inputs.user_message }} }}", chain_ctx),
            "Fallback Msg",
        )
        # Verify workspace_turn.yaml router and standalone sub-routines (code, plan, ask, yomama) load cleanly
        agent_ctx = agent_bp.get_context("default")
        routine_def = load_routine_definition(agent_ctx, "workspace_turn")
        self.assertEqual(routine_def["id"], "workspace_turn")
        self.assertEqual(set(routine_def["modes"].keys()), {"auto", "code", "plan", "ask", "yomama"})
        self.assertEqual(len(routine_def["nodes"]), 2)
        self.assertEqual(routine_def["nodes"][1]["type"], "routine")
        sys_ctx = system_bp.get_context("default")
        routines_res = sys_ctx.call("agent.routines")
        routine_ids = {r["id"] for r in routines_res["routines"]}
        for expected_id in ("workspace_turn", "code", "plan", "ask", "yomama", "implement", "bugfix", "refactor", "test", "upkeep", "debt_ratchet"):
            self.assertIn(expected_id, routine_ids)

    def test_declarative_agent_modes_and_one_click_undo_rollback(self):
        """/code mode edits files via bridge.sync and /undo reverts the transaction via bridge.revert."""
        target_py = self.repo_dir / "math_ops.py"
        target_py.write_text("def multiply(a, b):\n    return a + b\n", encoding="utf-8")
        (self.repo_dir / "README.md").write_text("# Read-Only Guide\n", encoding="utf-8")
        force_topology_scan(workspace_id="default")
        routine_def = load_routine_definition(agent_bp.get_context("default"), "workspace_turn")
        self.assertEqual(_parse_slash_command("/code Fix multiply", routine=routine_def), ("code", "Fix multiply"))
        self.assertEqual(_parse_slash_command("/plan Outline RFC", routine=routine_def), ("plan", "Outline RFC"))
        self.assertEqual(_parse_slash_command("/yomama <<<<<<< FILE: a.py", routine=routine_def), ("yomama", "<<<<<<< FILE: a.py"))
        self.assertEqual(_parse_slash_command("/ask What does multiply do?", routine=routine_def), ("ask", "What does multiply do?"))
        self.assertEqual(_parse_slash_command("/undo", routine=routine_def), ("undo", ""))

        agent_ctx = agent_bp.get_context("default")
        agent_ctx.db.insert_or_replace("chat_sessions", {
            "session_id": "ses_code_1",
            "title": "Code Turn",
            "updated_at": time.time(),
        })
        agent_ctx.db.commit()

        llm_ctx = llm_bp.get_context("default")
        llm_ctx.settings.set("api_key", "sk-test")

        valid_patch = (
            "<<<<<<< FILE: vfs://alpha/math_ops.py\n"
            "<<<<<<< COMMENT\n"
            "Fix multiplication operator\n"
            "<<<<<<< SEARCH\n"
            "def multiply(a, b):\n"
            "    return a + b\n"
            "=======\n"
            "def multiply(a, b):\n"
            "    return a * b\n"
            ">>>>>>> REPLACE"
        )

        with patch("insetu.core.llm.engine_llm._run_single_inference", return_value=(valid_patch, None)):
            turn_res = _execute_agent_turn(
                agent_ctx,
                session_id="ses_code_1",
                user_prompt="Fix multiply in math_ops.py",
                mode="code",
                attached_files=["vfs://alpha/math_ops.py"],
                read_only_files=["vfs://alpha/README.md"],
            )

        sync_vfs_barrier("default")
        tx_id = turn_res["artifact"]["transaction_id"]
        self.assertTrue(tx_id and tx_id.startswith("tx_"))
        self.assertIn("return a * b", target_py.read_text(encoding="utf-8"))
        # Now invoke agent.undo (or /undo) -> must revert math_ops.py back to 'return a + b'
        sys_ctx = system_bp.get_context("default")
        undo_res = sys_ctx.call("agent.undo", session_id="ses_code_1")
        sync_vfs_barrier("default")
        self.assertEqual(undo_res["status"], "success")
        self.assertEqual(undo_res["transaction_id"], tx_id)
        self.assertIn("return a + b", target_py.read_text(encoding="utf-8"))

        # Test /yomama DAG: feed a broken-anchor patch -> self-heals against live VFS file -> commits cleanly
        broken_patch = (
            "<<<<<<< FILE: vfs://alpha/math_ops.py\n"
            "<<<<<<< SEARCH\n"
            "def multiply(wrong_arg_name):\n"
            "    return wrong_arg_name\n"
            "=======\n"
            "def multiply(a, b):\n"
            "    return a * b * 1\n"
            ">>>>>>> REPLACE"
        )
        healed_patch = (
            "<<<<<<< FILE: vfs://alpha/math_ops.py\n"
            "<<<<<<< SEARCH\n"
            "def multiply(a, b):\n"
            "    return a + b\n"
            "=======\n"
            "def multiply(a, b):\n"
            "    return a * b * 1\n"
            ">>>>>>> REPLACE"
        )
        with patch("insetu.core.llm.engine_llm._run_single_inference", return_value=(healed_patch, None)) as mock_heal_llm:
            yomama_res = _execute_agent_turn(
                agent_ctx,
                session_id="ses_code_1",
                user_prompt=broken_patch,
                mode="yomama",
            )
            sync_vfs_barrier("default")
            self.assertEqual(mock_heal_llm.call_count, 1, "/yomama must invoke LLM healer when initial anchor fails")
            self.assertTrue(yomama_res["artifact"]["transaction_id"].startswith("tx_"))
            self.assertIn("return a * b * 1", target_py.read_text(encoding="utf-8"))

    def test_mcp_server_tools_resources_and_prompts_jsonrpc(self):
        """MCP 2025-03-26 server handles initialize, tools/list, tools/call, resources/list, resources/read, prompts/list, and prompts/get."""
        # Seed a source file, CODE_INDEX.md, and a parameterized prompt
        (self.repo_dir / "widget.py").write_text(
            "def greet_user(name: str) -> str:\n"
            "    \"\"\"Greets a user by name.\"\"\"\n"
            "    return f'Hello, {name}!'\n",
            encoding="utf-8",
        )
        (self.repo_dir / "CODE_INDEX.md").write_text("# Alpha Index\n", encoding="utf-8")
        force_topology_scan(workspace_id="default")

        p_ctx = prompts_bp.get_context("default")
        p_ctx.vfs.save(
            "ctx://prompts/review_template.md",
            "---\ntitle: Code Review\ndescription: Reviews a module.\n---\nReview {{ macro_module }} with focus on {{ macro_focus | security }}.",
        )
        sync_vfs_barrier("default")

        mcp_ctx = mcp_bp.get_context("default")

        # 1. initialize
        init_resp = handle_mcp_jsonrpc(mcp_ctx, {"jsonrpc": "2.0", "id": 1, "method": "initialize"})
        self.assertEqual(init_resp["result"]["protocolVersion"], "2025-03-26")
        self.assertIn("tools", init_resp["result"]["capabilities"])

        # 2. tools/list
        tools_resp = handle_mcp_jsonrpc(mcp_ctx, {"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        tool_names = {t["name"] for t in tools_resp["result"]["tools"]}
        self.assertIn("cartographer.extract", tool_names)
        self.assertIn("fs.fetch", tool_names)
        self.assertIn("bridge.sync", tool_names)

        # 3. tools/call -> cartographer.extract
        call_resp = handle_mcp_jsonrpc(mcp_ctx, {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "cartographer.extract",
                "arguments": {"filepath": "vfs://alpha/widget.py", "symbol": "greet_user"},
            },
        })
        self.assertFalse(call_resp["result"]["isError"])
        extracted_payload = json.loads(call_resp["result"]["content"][0]["text"])
        self.assertEqual(extracted_payload["symbol"], "greet_user")
        self.assertIn("return f'Hello, {name}!'", extracted_payload["source"])

        # 4. resources/list & resources/read
        res_list = handle_mcp_jsonrpc(mcp_ctx, {"jsonrpc": "2.0", "id": 4, "method": "resources/list"})
        res_uris = {r["uri"] for r in res_list["result"]["resources"]}
        self.assertIn("vfs://alpha/CODE_INDEX.md", res_uris)

        res_read = handle_mcp_jsonrpc(mcp_ctx, {
            "jsonrpc": "2.0",
            "id": 5,
            "method": "resources/read",
            "params": {"uri": "vfs://alpha/widget.py"},
        })
        self.assertIn("def greet_user", res_read["result"]["contents"][0]["text"])

        # 5. prompts/list & prompts/get (with macro argument discovery and substitution)
        prompts_list = handle_mcp_jsonrpc(mcp_ctx, {"jsonrpc": "2.0", "id": 6, "method": "prompts/list"})
        rev_prompt = next((p for p in prompts_list["result"]["prompts"] if p["name"] == "ctx://prompts/review_template.md"), None)
        self.assertIsNotNone(rev_prompt)
        arg_names = {a["name"]: a["required"] for a in rev_prompt["arguments"]}
        self.assertEqual(arg_names, {"module": True, "focus": False})

        prompt_get = handle_mcp_jsonrpc(mcp_ctx, {
            "jsonrpc": "2.0",
            "id": 7,
            "method": "prompts/get",
            "params": {
                "name": "ctx://prompts/review_template.md",
                "arguments": {"module": "akasa/vfs.py"},
            },
        })
        rendered_msg = prompt_get["result"]["messages"][0]["content"]["text"]
        self.assertEqual(rendered_msg.strip(), "Review akasa/vfs.py with focus on security.")
        # 6. Verify Flask HTTP route /api/default/mcp
        app = Flask(__name__)
        app.register_blueprint(mcp_bp.bp)
        client = app.test_client()
        http_res = client.post("/api/default/mcp", json={"jsonrpc": "2.0", "id": 99, "method": "ping"})
        self.assertEqual(http_res.status_code, 200)
        self.assertEqual(http_res.get_json()["id"], 99)

    def test_bridge_auto_heal_defers_overlapping_chunk_and_heals_against_post_valid_buffer(self):
        """bridge.sync with auto_heal=True defers a failed/overlapping chunk, applies valid chunks in memory first, and heals the deferred chunk against the post-valid buffer using tier='fast'."""
        target_py = self.repo_dir / "overlap.py"
        target_py.write_text(
            "def first():\n    return 1\n\ndef second():\n    return 2\n",
            encoding="utf-8",
        )
        force_topology_scan(workspace_id="default")

        llm_ctx = llm_bp.get_context("default")
        llm_ctx.settings.update({
            "provider": "anthropic",
            "model": "claude-3-5-sonnet-latest",
            "tier_fast_model": "claude-3-5-haiku-latest",
            "api_key": "sk-test",
        })

        # Chunk 1 has a stale/overlapping anchor, while Chunk 2 is valid.
        raw_payload = (
            "<<<<<<< FILE: vfs://alpha/overlap.py\n"
            "<<<<<<< ID: cell_bad_1\n"
            "<<<<<<< SEARCH\n"
            "def first_wrong_anchor():\n    return 999\n"
            "=======\n"
            "def first():\n    return 10\n"
            ">>>>>>> REPLACE\n\n"
            "<<<<<<< FILE: vfs://alpha/overlap.py\n"
            "<<<<<<< ID: cell_good_2\n"
            "<<<<<<< SEARCH\n"
            "def second():\n    return 2\n"
            "=======\n"
            "def second():\n    return 20\n"
            ">>>>>>> REPLACE"
        )

        captured_prompts = []
        healed_tail = (
            "<<<<<<< FILE: vfs://alpha/overlap.py\n"
            "<<<<<<< SEARCH\n"
            "def first():\n    return 1\n"
            "=======\n"
            "def first():\n    return 10\n"
            ">>>>>>> REPLACE"
        )

        def fake_fast_healer(provider, api_key, model, messages, system_prompt, base_url="", **kwargs):
            captured_prompts.append((model, messages[-1]["content"]))
            return healed_tail, None

        sys_ctx = system_bp.get_context("default")
        with patch("insetu.core.llm.engine_llm._run_single_inference", side_effect=fake_fast_healer):
            res = sys_ctx.call(
                "bridge.sync",
                text=raw_payload,
                active_files=["vfs://alpha/overlap.py"],
                dry_run=False,
                auto_heal=True,
                wait=True,
            )

        sync_vfs_barrier("default")
        self.assertTrue(res.get("can_commit"))
        self.assertEqual(res.get("healed_attempts"), 1)
        self.assertEqual(len(captured_prompts), 1)
        used_model, healer_prompt = captured_prompts[0]
        self.assertEqual(used_model, "claude-3-5-haiku-latest")
        # Verify the buffer handed to the healer ALREADY had Chunk 2 ('return 20') applied in memory!
        self.assertIn("return 20", healer_prompt)
        final_disk = target_py.read_text(encoding="utf-8")
        self.assertIn("return 10", final_disk)
        self.assertIn("return 20", final_disk)

    def test_mcp_tool_declaration_schema_contract(self):
        """MCP tools/list enforces that every registered tool exposes an inputSchema with type='object' and defined properties."""
        mcp_ctx = mcp_bp.get_context("default")
        tools_resp = handle_mcp_jsonrpc(mcp_ctx, {"jsonrpc": "2.0", "id": 101, "method": "tools/list"})
        self.assertNotIn("error", tools_resp)
        tools = tools_resp["result"]["tools"]
        self.assertGreater(len(tools), 0)
        from insetu.core.sdk import get_registered_capabilities as _get_caps
        caps = _get_caps()
        for tool in tools:
            tool_name = tool.get("name")
            self.assertTrue(tool_name, "Every MCP tool must define a non-empty name")
            schema = tool.get("inputSchema")
            self.assertIsInstance(schema, dict, f"Tool '{tool_name}' must provide an inputSchema dictionary")
            self.assertEqual(schema.get("type"), "object", f"Tool '{tool_name}' inputSchema type must be 'object'")
            props = schema.get("properties")
            self.assertIsInstance(props, dict, f"Tool '{tool_name}' must define properties dictionary")
            cap_spec = caps.get(tool_name) or {}
            if cap_spec.get("request_schema") or cap_spec.get("path_params") or tool_name.startswith("routine."):
                self.assertGreater(len(props), 0, f"Parameterized tool '{tool_name}' must specify at least one property")

    def test_scratch_vaulting_boundary_for_large_outputs(self):
        """Agent routine steps producing outputs exceeding SCRATCH_VAULT_THRESHOLD_BYTES (256KB) spill to disk scratch files."""
        self.assertEqual(SCRATCH_VAULT_THRESHOLD_BYTES, 256 * 1024)

        agent_ctx = agent_bp.get_context("default")
        scratch_dir = Path(agent_ctx.paths.get("cache_dir", self.control_dir / "cache")) / "scratch"
        scratch_dir.mkdir(parents=True, exist_ok=True)

        # Generate large payload exceeding 256KB threshold
        large_content = "X" * (SCRATCH_VAULT_THRESHOLD_BYTES + 4096)
        chain_ctx = {
            "global": {"session_id": "ses_scratch_vault_test"},
            "large_step": large_content,
        }

        # Verify threshold evaluation and vaulting
        self.assertGreater(len(large_content.encode("utf-8")), SCRATCH_VAULT_THRESHOLD_BYTES)
        vault_file = scratch_dir / "step_large_step.txt"
        vault_file.write_text(large_content, encoding="utf-8")
        self.assertTrue(vault_file.exists())
        self.assertGreaterEqual(vault_file.stat().st_size, SCRATCH_VAULT_THRESHOLD_BYTES)
    def test_resolve_dag_wavefronts_and_reentrant_map_parallel(self):
        """Ring 0 resolve_dag_wavefronts groups parallel generations deterministically, raises CycleError on cycles, and nested run_parallel calls execute without thread starvation."""
        # Diamond DAG: root -> (branch_b, branch_a) -> sink
        diamond_nodes = [
            {"id": "root", "depends_on": [], "order": 10},
            {"id": "branch_b", "depends_on": ["root"], "order": 30},
            {"id": "branch_a", "depends_on": ["root"], "order": 20},
            {"id": "sink", "depends_on": ["branch_a", "branch_b"], "order": 40},
        ]
        waves = resolve_dag_wavefronts(diamond_nodes)
        wave_ids = [[n["id"] for n in w] for w in waves]
        self.assertEqual(wave_ids, [["root"], ["branch_a", "branch_b"], ["sink"]])

        # Cycle detection raises CycleError
        cyclic_nodes = [
            {"id": "a", "depends_on": ["b"]},
            {"id": "b", "depends_on": ["a"]},
        ]
        with self.assertRaises(CycleError):
            resolve_dag_wavefronts(cyclic_nodes)

        # Template variable extraction & interpolation
        tpl_text = "Audit {{ target_repo }} with focus on {{ focus_area | security }} and {{ macro_style | concise }}."
        vars_found = extract_template_variables(tpl_text)
        self.assertEqual(
            [(v["name"], v["default"], v["required"]) for v in vars_found],
            [("target_repo", None, True), ("focus_area", "security", False), ("style", "concise", False)],
        )
        rendered = interpolate_template_variables(tpl_text, {"target_repo": "insetu", "macro_style": "strict"})
        self.assertEqual(rendered, "Audit insetu with focus on security and strict.")

        # Verify nested reentrant map_parallel inside an outer map_parallel completes without deadlock
        sys_ctx = system_bp.get_context("default")
        outer_res = sys_ctx.jobs.map_parallel(
            lambda x: sys_ctx.jobs.map_parallel(lambda y: x * 10 + y, [1, 2, 3]),
            [1, 2, 3, 4, 5],
        )
        self.assertEqual(len(outer_res), 5)
        self.assertEqual(outer_res[0], [11, 12, 13])

    def test_wavefront_diamond_and_repeat_execution(self):
        """Executes a 4-branch task-parallel diamond DAG (fetch -> [b1, b2, b3, b4] -> reduce) and a repeat: 3 ensemble node."""
        agent_ctx = agent_bp.get_context("default")
        llm_ctx = llm_bp.get_context("default")
        llm_ctx.settings.update({"provider": "anthropic", "api_key": "sk-test", "max_parallel_requests": 4})

        diamond_routine_md = (
            "---\n"
            "id: diamond_ensemble\n"
            "title: Diamond & Repeat Test\n"
            "nodes:\n"
            "  - id: b1\n"
            "    type: llm\n"
            "    tier: fast\n"
            "    parents: []\n"
            "  - id: b2\n"
            "    type: llm\n"
            "    tier: fast\n"
            "    parents: []\n"
            "  - id: b3\n"
            "    type: llm\n"
            "    tier: fast\n"
            "    parents: []\n"
            "  - id: b4\n"
            "    type: llm\n"
            "    tier: fast\n"
            "    parents: []\n"
            "  - id: reduce_step\n"
            "    type: llm\n"
            "    tier: thinking\n"
            "    repeat: 3\n"
            "    parents: [b1, b2, b3, b4]\n"
            "---\n\n"
            "## b1\nBranch 1\n\n"
            "## b2\nBranch 2\n\n"
            "## b3\nBranch 3\n\n"
            "## b4\nBranch 4\n\n"
            "## reduce_step\nSynthesize: {{ nodes.b1.text }} | {{ nodes.b2.text }} | {{ nodes.b3.text }} | {{ nodes.b4.text }}\n"
        )
        sys_ctx = system_bp.get_context("default")
        save_res = sys_ctx.call("agent.routines.save", id="diamond_ensemble", raw_content=diamond_routine_md)
        sync_vfs_barrier("default")
        self.assertEqual(save_res["routine"]["wavefronts"], [["b1", "b2", "b3", "b4"], ["reduce_step"]])

        def fake_infer(provider, api_key, model, messages, system_prompt, base_url="", **kwargs):
            content = messages[-1]["content"]
            return f"OUT({content.splitlines()[0]})", None

        with patch("insetu.core.llm.engine_llm._run_single_inference", side_effect=fake_infer):
            out = execute_declarative_routine(agent_ctx, routine_id="diamond_ensemble", user_prompt="Go")
        self.assertEqual(out["status"], "completed")
        self.assertEqual(len(out["state"]["reduce_step"]["items"]), 3)
        self.assertIn("OUT(Branch 1)", out["state"]["reduce_step"]["text"])
        self.assertIn("OUT(Branch 4)", out["state"]["reduce_step"]["text"])

    def test_routines_vfs_volume_fork_save_and_yomama_patch(self):
        """Verifies reading ctx://routines/.templates/agent/code.md, saving a custom routine, patching it via bridge.sync, and rejecting cyclic routines with HTTP 422."""
        agent_ctx = agent_bp.get_context("default")
        sys_ctx = system_bp.get_context("default")
        # 1. Built-in routines live exclusively as read-only .md files and can be hijacked by a workspace override
        self.assertFalse(hasattr(_orch_mod, "_BUILTIN_ROUTINES"), "Built-in routines must not be hardcoded in Python")
        builtin_code = agent_ctx.vfs.read("ctx://routines/.templates/agent/code.md")
        self.assertIsNotNone(builtin_code)
        self.assertIn("id: code", builtin_code)

        default_ask = load_routine_definition(agent_ctx, "ask")
        self.assertEqual(default_ask["source"], "builtin")
        self.assertEqual(default_ask["filepath"], "ctx://routines/.templates/agent/ask.md")

        # Hijack /ask with a workspace routine override -> load_routine_definition and execute_declarative_routine use the override
        hijacked_ask_md = (
            "---\n"
            "id: ask\n"
            "title: Hijacked Ask Routine\n"
            "slash_command: /ask\n"
            "output: \"{{ nodes.custom_step.text }}\"\n"
            "nodes:\n"
            "  - id: custom_step\n"
            "    type: llm\n"
            "    tier: fast\n"
            "    parents: []\n"
            "---\n\n"
            "## custom_step\nHijacked prompt: {{ inputs.user_message }}\n"
        )
        sys_ctx.call("agent.routines.save", id="ask", raw_content=hijacked_ask_md)
        sync_vfs_barrier("default")
        overridden_ask = load_routine_definition(agent_ctx, "ask")
        self.assertEqual(overridden_ask["source"], "workspace")
        self.assertEqual(overridden_ask["title"], "Hijacked Ask Routine")

        # Delete override -> reverts cleanly to built-in read-only .md template
        sys_ctx.call("agent.routines.delete", id="ask")
        sync_vfs_barrier("default")
        restored_ask = load_routine_definition(agent_ctx, "ask")
        self.assertEqual(restored_ask["source"], "builtin")

        # 2. Save custom routine via agent.routines.save
        custom_md = (
            "---\n"
            "id: custom_audit\n"
            "title: Custom Audit\n"
            "nodes:\n"
            "  - id: step_one\n"
            "    type: llm\n"
            "    tier: fast\n"
            "    parents: []\n"
            "---\n\n"
            "## step_one\nInitial audit prompt.\n"
        )
        saved = sys_ctx.call("agent.routines.save", id="custom_audit", raw_content=custom_md)
        sync_vfs_barrier("default")
        self.assertEqual(saved["filepath"], "ctx://routines/custom_audit.md")

        # 3. Patch ctx://routines/custom_audit.md via Yomama bridge.sync (JSON_PATCH)
        patch_payload = (
            "<<<<<<< FILE: ctx://routines/custom_audit.md\n"
            "<<<<<<< JSON_PATCH\n"
            '{"nodes[id=step_one].tier": "thinking"}\n'
            ">>>>>>> REPLACE"
        )
        b_res = sys_ctx.call("bridge.sync", text=patch_payload, active_files=["ctx://routines/custom_audit.md"], wait=True)
        sync_vfs_barrier("default")
        self.assertTrue(b_res.get("can_commit"))
        loaded_after = load_routine_definition(agent_ctx, "custom_audit")
        self.assertEqual(loaded_after["nodes"][0]["tier"], "thinking")

        # 4. Reject cyclic routine definition with 422
        cyclic_md = (
            "---\n"
            "id: cyclic_bad\n"
            "title: Cyclic Bad\n"
            "nodes:\n"
            "  - id: a\n"
            "    type: llm\n"
            "    parents: [b]\n"
            "  - id: b\n"
            "    type: llm\n"
            "    parents: [a]\n"
            "---\n"
        )
        app = Flask(__name__)
        app.register_blueprint(agent_bp.bp)
        client = app.test_client()
        resp_422 = client.post("/api/default/agent/routines/save", json={"id": "cyclic_bad", "raw_content": cyclic_md})
        self.assertEqual(resp_422.status_code, 422)

    def test_yomama_textedit_json_patch_and_file_lifecycle_directives(self):
        """Yomama Bridge applies TEXTEDIT inline diffs, JSON_PATCH key-path selector mutations, and MOVE_FILE/DELETE_FILE with snapshot revert."""
        md_file = self.repo_dir / "essay.md"
        md_file.write_text(
            "---\ntitle: Old Title\nstatus: open\ntags:\n  - draft\n---\n\nThe quick brown fox\njumps over the lazy dog.\n",
            encoding="utf-8",
        )
        json_file = self.repo_dir / "config_sample.json"
        json_file.write_text(
            json.dumps({
                "version": 1,
                "obsolete": "remove_me",
                "nodes": [{"id": "step_a", "tier": "fast"}, {"id": "step_b", "tier": "standard"}],
            }, indent=2) + "\n",
            encoding="utf-8",
        )
        force_topology_scan(workspace_id="default")
        sys_ctx = system_bp.get_context("default")

        # 1. TEXTEDIT (across soft-wrapped newline) + JSON_PATCH on .md frontmatter + JSON_PATCH on .json selector
        combined_patch = (
            "<<<<<<< FILE: vfs://alpha/essay.md\n"
            "<<<<<<< JSON_PATCH\n"
            '{"title": "Updated Essay", "status": "active"}\n'
            ">>>>>>> REPLACE\n\n"
            "<<<<<<< FILE: vfs://alpha/essay.md\n"
            "<<<<<<< TEXTEDIT\n"
            "The quick {{-brown }}fox {{+gracefully }}jumps over the lazy dog.\n"
            ">>>>>>> REPLACE\n\n"
            "<<<<<<< FILE: vfs://alpha/config_sample.json\n"
            "<<<<<<< JSON_PATCH\n"
            '{"version": 2, "obsolete": null, "nodes[id=step_a].tier": "thinking"}\n'
            ">>>>>>> REPLACE"
        )
        res = sys_ctx.call(
            "bridge.sync",
            text=combined_patch,
            active_files=["vfs://alpha/essay.md", "vfs://alpha/config_sample.json"],
            dry_run=False,
            wait=True,
        )
        sync_vfs_barrier("default")
        self.assertTrue(res.get("can_commit"), f"Combined TEXTEDIT/JSON_PATCH failed: {res}")

        md_disk = md_file.read_text(encoding="utf-8")
        self.assertIn("title: Updated Essay", md_disk)
        self.assertIn("status: active", md_disk)
        self.assertIn("The quick fox gracefully jumps over the lazy dog.", md_disk)

        json_disk = json.loads(json_file.read_text(encoding="utf-8"))
        self.assertEqual(json_disk["version"], 2)
        self.assertNotIn("obsolete", json_disk)
        self.assertEqual(json_disk["nodes"][0]["tier"], "thinking")
        # 2. DELETE_FILE in unattended mode emits a semantic DESTRUCTIVE_DELETE gate, and commits when approved via resolutions or interactive mode
        del_patch = (
            "<<<<<<< FILE: vfs://alpha/config_sample.json\n"
            "<<<<<<< ID: cell_del_1\n"
            "<<<<<<< DELETE_FILE\n"
            "FILE: vfs://alpha/config_sample.json\n"
            ">>>>>>> EXECUTE"
        )
        unconfirmed_del = sys_ctx.call(
            "bridge.sync",
            text=del_patch,
            active_files=["vfs://alpha/config_sample.json"],
            unattended=True,
            wait=True,
        )
        self.assertFalse(unconfirmed_del.get("can_commit"))
        self.assertEqual(unconfirmed_del["patches"][0]["gate"]["code"], "DESTRUCTIVE_DELETE")
        self.assertTrue(json_file.exists())

        confirmed_del = sys_ctx.call(
            "bridge.sync",
            text=del_patch,
            active_files=["vfs://alpha/config_sample.json"],
            unattended=True,
            resolutions={"cell_del_1": {"approved_gate": "DESTRUCTIVE_DELETE"}},
            wait=True,
        )
        sync_vfs_barrier("default")
        self.assertTrue(confirmed_del.get("can_commit"))
        self.assertFalse(json_file.exists())

        # Revert deletion -> restores config_sample.json from compressed snapshot!
        sys_ctx.call("bridge.revert", transaction_id=confirmed_del["transaction_id"], target_state="initial")
        sync_vfs_barrier("default")
        self.assertTrue(json_file.exists())
        restored_json = json.loads(json_file.read_text(encoding="utf-8"))
        self.assertEqual(restored_json["version"], 2)
        # 3. Genesis patch targeting an existing file in an allowed repo halts with OVERWRITE_EXISTING gate until approved
        genesis_overwrite_patch = (
            "<<<<<<< FILE: vfs://alpha/essay.md\n"
            "<<<<<<< ID: cell_overwrite_1\n"
            "<<<<<<< SEARCH\n"
            "=======\n"
            "# Completely Overwritten Essay\n"
            ">>>>>>> REPLACE"
        )
        unconfirmed_ow = sys_ctx.call(
            "bridge.sync",
            text=genesis_overwrite_patch,
            active_files=["vfs://alpha/essay.md"],
            wait=True,
        )
        self.assertFalse(unconfirmed_ow.get("can_commit"))
        self.assertEqual(unconfirmed_ow["patches"][0]["gate"]["code"], "OVERWRITE_EXISTING")

        confirmed_ow = sys_ctx.call(
            "bridge.sync",
            text=genesis_overwrite_patch,
            active_files=["vfs://alpha/essay.md"],
            resolutions={"cell_overwrite_1": {"approved_gate": "OVERWRITE_EXISTING"}},
            wait=True,
        )
        sync_vfs_barrier("default")
        self.assertTrue(confirmed_ow.get("can_commit"))
        self.assertEqual(md_file.read_text(encoding="utf-8"), "# Completely Overwritten Essay\n")

        # Verify bridge.turn_diff accurately replays prior JSON_PATCH/TEXTEDIT chunks when computing turn diffs
        turn_diff_res = sys_ctx.call("bridge.turn_diff", transaction_ids=[confirmed_ow["transaction_id"]])
        self.assertIn("vfs://alpha/essay.md", turn_diff_res["files"])
        self.assertIn("+# Completely Overwritten Essay", turn_diff_res["diff_text"])

        # 4. Control-plane write ban rejects .insetu/secrets.json
        banned_patch = (
            "<<<<<<< FILE: vfs://.insetu/secrets.json\n"
            "<<<<<<< SEARCH\n=======\n{}\n>>>>>>> REPLACE"
        )
        banned_res = sys_ctx.call("bridge.sync", text=banned_patch, active_files=["vfs://.insetu/secrets.json"], wait=True)
        self.assertFalse(banned_res.get("can_commit"))
        self.assertEqual(banned_res["patches"][0]["flags"], ["banned_target"])
    def test_manual_web_chat_wavefront_pause_and_resume(self):
        """Workspace routines in ctx://routines/*.md are discovered cleanly, and manual Web-Chat wavefront execution pauses across parallel branches and resumes downstream reducer nodes."""
        sys_ctx = system_bp.get_context("default")
        agent_ctx = agent_bp.get_context("default")

        # 1. Save a workspace routine batch in ctx://routines/ and verify discovery
        standup_md = (
            "---\n"
            "id: morning_standup\n"
            "title: Morning Standup Batch\n"
            "domain: Routines\n"
            "includes:\n"
            "  - vfs://alpha/README.md\n"
            "---\n"
        )
        sys_ctx.call("agent.routines.save", id="morning_standup", raw_content=standup_md)
        sync_vfs_barrier("default")

        all_routines = list_available_routines(agent_ctx)
        by_id = {r["id"]: r for r in all_routines}
        self.assertIn("morning_standup", by_id)
        self.assertEqual(by_id["morning_standup"]["source"], "workspace")

        # 2. Save a custom Markdown-as-Code routine with a banned capability -> must raise PermissionError on execution
        bad_routine_md = (
            "---\n"
            "id: forbidden_exec\n"
            "title: Forbidden Exec\n"
            "nodes:\n"
            "  - id: run_shell\n"
            "    type: exec\n"
            "    capability: dev.exec\n"
            "    payload:\n"
            "      command: echo pwned\n"
            "---\n"
        )
        sys_ctx.call("agent.routines.save", id="forbidden_exec", raw_content=bad_routine_md)
        sync_vfs_barrier("default")

        with self.assertRaises(PermissionError):
            execute_declarative_routine(agent_ctx, routine_id="forbidden_exec", user_prompt="test")
        # 3. Verify multi-branch Web-Chat Handoff Pause & Resume on a 2-branch wavefront -> reducer routine
        fanout_md = (
            "---\n"
            "id: manual_fanout\n"
            "title: Manual Fanout\n"
            "transport: manual\n"
            "nodes:\n"
            "  - id: sec_scan\n"
            "    type: llm\n"
            "    tier: fast\n"
            "    parents: []\n"
            "  - id: perf_scan\n"
            "    type: llm\n"
            "    tier: fast\n"
            "    parents: []\n"
            "  - id: final_report\n"
            "    type: llm\n"
            "    tier: thinking\n"
            "    parents: [sec_scan, perf_scan]\n"
            "---\n\n"
            "## sec_scan\nAudit security: {{ inputs.user_message }}\n\n"
            "## perf_scan\nAudit performance: {{ inputs.user_message }}\n\n"
            "## final_report\nCombine: {{ nodes.sec_scan.text }} AND {{ nodes.perf_scan.text }}\n"
        )
        sys_ctx.call("agent.routines.save", id="manual_fanout", raw_content=fanout_md)
        sync_vfs_barrier("default")

        # Wavefront 0 pauses and returns BOTH branches upfront in pending_handoff.branches
        paused_w0 = execute_declarative_routine(
            agent_ctx,
            routine_id="manual_fanout",
            user_prompt="Check alpha",
        )
        self.assertEqual(paused_w0["status"], "paused_for_user")
        branches_w0 = paused_w0["pending_handoff"]["branches"]
        self.assertEqual([b["node_id"] for b in branches_w0], ["sec_scan", "perf_scan"])

        # Supply Wavefront 0 responses -> advances to Wavefront 1 (final_report) and populates $sec_scan.text and $perf_scan.text!
        paused_w1 = execute_declarative_routine(
            agent_ctx,
            routine_id="manual_fanout",
            user_prompt="Check alpha",
            inputs={
                "prior_chain_context": paused_w0["chain_context"],
                "handoff_responses": {
                    "sec_scan": "SEC_OK",
                    "perf_scan": "PERF_OK",
                },
            },
        )
        self.assertEqual(paused_w1["status"], "paused_for_user")
        self.assertEqual(paused_w1["pending_handoff"]["node_id"], "final_report")
        self.assertIn("Combine: SEC_OK AND PERF_OK", paused_w1["pending_handoff"]["compiled_prompt"])

        # Supply Wavefront 1 response -> completes routine!
        done_res = execute_declarative_routine(
            agent_ctx,
            routine_id="manual_fanout",
            user_prompt="Check alpha",
            inputs={
                "prior_chain_context": paused_w1["chain_context"],
                "handoff_responses": {
                    "sec_scan": "SEC_OK",
                    "perf_scan": "PERF_OK",
                    "final_report": "ALL_SYSTEMS_GO",
                },
            },
        )
        self.assertEqual(done_res["status"], "completed")
        self.assertEqual(done_res["response"], "ALL_SYSTEMS_GO")

        # 4. agent/run_test refuses an unapproved custom command (403), and the caller cannot approve it.
        #    Only the human-only bridge/test/approve route records an approval (P5).
        app = Flask(__name__)
        app.register_blueprint(agent_bp.bp)
        app.register_blueprint(bridge_bp.bp)
        client = app.test_client()
        command = "python3 -c \"print('custom test ok')\""
        unapproved_resp = client.post("/api/default/agent/run_test", json={"repo": "alpha", "command": command})
        self.assertEqual(unapproved_resp.status_code, 403)
        self.assertEqual(unapproved_resp.get_json()["status"], "needs_approval")

        # A stale 'approve' flag from before P5 must not approve anything.
        self_approve_resp = client.post("/api/default/agent/run_test", json={"repo": "alpha", "command": command, "approve": True})
        self.assertEqual(self_approve_resp.status_code, 403)
        self.assertEqual(self_approve_resp.get_json()["status"], "needs_approval")

        approval_resp = client.post("/api/default/bridge/test/approve", json={"repo": "alpha", "command": command})
        self.assertEqual(approval_resp.status_code, 200)
        self.assertEqual(approval_resp.get_json()["status"], "approved")

        # Once a person approved it, the same command runs, and the approval persists in host.json.
        approved_resp = client.post("/api/default/agent/run_test", json={"repo": "alpha", "command": command})
        self.assertEqual(approved_resp.status_code, 200)
        self.assertEqual(approved_resp.get_json()["status"], "passed")
        self.assertIn("custom test ok", approved_resp.get_json()["stdout"])

    def test_cartographer_symbol_drift_watermark_and_topology_audit_upkeep(self):
        """Cartographer flags modified functions with [stale?] when their CODE_INDEX.md comment is unchanged, and topology.audit_upkeep + colon-scoped /upkeep:docs resolve cleanly."""
        from insetu.core.cartographer.cartographer import map_repositories as _map_repositories
        from insetu.core.agent.engine_agent import _parse_colon_command_tokens as __parse_colon_command_tokens

        sys_ctx = system_bp.get_context("default")

        # 1. Verify universal colon-scoped command grammar
        parsed_1 = __parse_colon_command_tokens("/upkeep:docs focus on alpha")
        self.assertEqual(parsed_1["target"], "upkeep")
        self.assertEqual(parsed_1["scope"], "docs")
        self.assertEqual(parsed_1["rest"], "focus on alpha")

        parsed_2 = __parse_colon_command_tokens("/user:upkeep:modularize:apply")
        self.assertEqual(parsed_2["namespace"], "user")
        self.assertEqual(parsed_2["target"], "upkeep")
        self.assertEqual(parsed_2["scope"], "modularize")
        self.assertEqual(parsed_2["stage"], "apply")

        # 2. Seed a documented function in vfs://alpha/service.py and map CODE_INDEX.md
        service_py = self.repo_dir / "service.py"
        service_py.write_text(
            'def calculate_tax(amount):\n'
            '    """Computes standard 10 percent sales tax."""\n'
            '    return amount * 0.10\n',
            encoding="utf-8",
        )
        force_topology_scan("default")
        _map_repositories("default", silent=True, target_repos=["alpha"])
        sync_vfs_barrier("default")

        idx_file = self.repo_dir / "CODE_INDEX.md"
        idx_text_v1 = idx_file.read_text(encoding="utf-8")
        self.assertIn("def calculate_tax(amount)", idx_text_v1)
        self.assertIn("# Computes standard 10 percent sales tax.", idx_text_v1)
        self.assertNotIn("[stale?]", idx_text_v1)
        # 3. Mutate the implementation body of calculate_tax without updating the docstring/comment
        service_py.write_text(
            'def calculate_tax(amount):\n'
            '    """Computes standard 10 percent sales tax."""\n'
            '    base = amount * 0.25\n'
            '    surcharge = 15.0\n'
            '    return base + surcharge\n',
            encoding="utf-8",
        )
        _map_repositories("default", silent=True, target_repos=["alpha"])
        sync_vfs_barrier("default")

        idx_text_v2 = idx_file.read_text(encoding="utf-8")
        self.assertIn("[stale?] Computes standard 10 percent sales tax.", idx_text_v2)

        # 4. Run topology.audit_upkeep and verify stale_comments and god_objects detection
        audit_res = sys_ctx.call("topology.audit_upkeep", repo="alpha", scope="all", god_object_min_lines=3, god_object_min_symbols=1)
        self.assertEqual(audit_res["status"], "success")
        stale_list = audit_res["docs_drift"]["stale_comments"]
        self.assertTrue(any(s["symbol_name"] == "calculate_tax" for s in stale_list))
        self.assertTrue(any(g["filepath"] == "vfs://alpha/service.py" for g in audit_res["god_objects"]))
        # 5. Verify cartographer.verify_symbols clears the [stale?] flag once reviewed
        ver_res = sys_ctx.call("cartographer.verify_symbols", repo="alpha", symbols=["calculate_tax"])
        self.assertGreaterEqual(ver_res["verified_count"], 1)
        idx_text_v3 = idx_file.read_text(encoding="utf-8")
        self.assertNotIn("[stale?]", idx_text_v3)
        # 6. Verify {{ymm:<char>x<N>}} transport escape macros expand cleanly in expand_macros and apply_block_in_memory
        from insetu.core.bridge.bridge_fuzzy import expand_macros as _expand_macros, apply_block_in_memory as _apply_block_in_memory
        escaped_sample = "{{ymm:`x3}}text\n{{ymm:<x7}} SEARCH\n{{ymm:=x7}}\n{{ymm:>x7}} REPLACE\n{{ymm:`x3}}"
        self.assertEqual(
            _expand_macros(escaped_sample),
            "```text\n<<<<<<< SEARCH\n=======\n>>>>>>> REPLACE\n```",
        )
        ok_blk, patched_doc, _ = _apply_block_in_memory(
            "# Doc\nOld line\n",
            {"search": "Old line", "replace": "Fence: {{ymm:`x3}} and {{ymm:<x7}} FILE:"},
            silent=True,
        )
        self.assertTrue(ok_blk)
        self.assertIn("Fence: ``` and <<<<<<< FILE:", patched_doc)

    def test_llm_resolve_target_and_raw_content_message_history(self):
        """llm.resolve_target resolves execution target metadata without leaking plaintext keys, and chat_messages retains raw_content across turns."""
        sys_ctx = system_bp.get_context("default")
        agent_ctx = agent_bp.get_context("default")

        # 1. Verify llm.resolve_target capability returns driver metadata
        target_res = sys_ctx.call("llm.resolve_target", tier="standard")
        self.assertEqual(target_res["tier"], "standard")
        self.assertIn("provider", target_res)
        self.assertIn("model", target_res)
        self.assertIn("is_web_chat", target_res)
        self.assertIn("has_api_key", target_res)
        self.assertNotIn("api_key", target_res, "api_key plaintext must not be exposed by resolve_target")

        # 2. Verify chat_messages preserves raw_content alongside clean prose content
        ses_id = "ses_raw_content_test"
        agent_ctx.db.insert_or_replace("chat_sessions", {
            "session_id": ses_id,
            "title": "Raw Content Test",
            "updated_at": time.time(),
        })
        msg_id = "msg_raw_test_1"
        c_open = "<" * 7
        c_sep = "=" * 7
        c_close = ">" * 7
        raw_reply = (
            f"Here is the explanation.\n\n"
            f"{c_open} FILE: vfs://alpha/sample.py\n"
            f"{c_open} SEARCH\nx = 1\n{c_sep}\nx = 2\n{c_close} REPLACE"
        )
        agent_ctx.db.insert_or_replace("chat_messages", {
            "message_id": msg_id,
            "session_id": ses_id,
            "role": "assistant",
            "content": "Here is the explanation.\n\n✅ Applied patches to 1 file(s).",
            "raw_content": raw_reply,
            "timestamp": time.time(),
        })
        agent_ctx.db.commit()

        # Query back and verify history rehydration prefers raw_content
        cursor = agent_ctx.db.execute(
            "SELECT role, content, raw_content FROM chat_messages WHERE session_id=? ORDER BY timestamp ASC",
            (ses_id,),
        )
        history = [
            {"role": r["role"], "content": (r["raw_content"] if r["raw_content"] else r["content"])}
            for r in cursor.fetchall()
        ]
        self.assertEqual(len(history), 1)
        self.assertIn(f"{c_open} FILE: vfs://alpha/sample.py", history[0]["content"])


if __name__ == "__main__":
    unittest.main()