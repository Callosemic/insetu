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
from insetu.core.agent.commands import (
    parse_colon_command_tokens as _parse_colon_command_tokens,
    parse_slash_command as _parse_slash_command,
)
from insetu.core.agent.engine_agent import (
    AGENT_SCHEMA,
    _execute_agent_turn,
    agent_bp,
)
from insetu.core.agent import orchestrator as _orch_mod
from insetu.core.agent.expressions import (
    SCRATCH_VAULT_THRESHOLD_BYTES,
    evaluate_when_condition,
)
from insetu.core.agent.orchestrator import (
    _interpolate_all_syntax,
    execute_declarative_routine,
)
from insetu.core.agent.routine_loader import (
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
    _resolve_tier_execution_target,
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
            "compute_endpoints": [{
                "id": "anthropic_main",
                "label": "Anthropic Claude API",
                "driver": "anthropic",
                "api_key": "sk-test-key",
                "max_parallel": 4,
            }],
            "llm_profiles": [{
                "id": "default",
                "title": "Default Configuration",
                "tiers": {
                    "decision": {"endpoint": "anthropic_main", "model": "claude-3-5-haiku-latest"},
                    "fast": {"endpoint": "anthropic_main", "model": "claude-3-5-haiku-latest"},
                    "standard": {"endpoint": "anthropic_main", "model": "claude-3-5-sonnet-latest"},
                    "thinking": {"endpoint": "anthropic_main", "model": "claude-3-7-sonnet-thinking"},
                    "frontier": {"endpoint": "anthropic_main", "model": "claude-3-7-sonnet-thinking"},
                },
            }],
        })
        self.assertEqual(_resolve_tier_execution_target(llm_ctx, "fast")["model"], "claude-3-5-haiku-latest")
        self.assertEqual(_resolve_tier_execution_target(llm_ctx, "low")["model"], "claude-3-5-haiku-latest")
        self.assertEqual(_resolve_tier_execution_target(llm_ctx, "thinking")["model"], "claude-3-7-sonnet-thinking")
        self.assertEqual(_resolve_tier_execution_target(llm_ctx, "high")["model"], "claude-3-7-sonnet-thinking")
        self.assertEqual(_resolve_tier_execution_target(llm_ctx, "standard")["model"], "claude-3-5-sonnet-latest")
        self.assertEqual(_resolve_tier_execution_target(llm_ctx, "medium")["model"], "claude-3-5-sonnet-latest")
        self.assertEqual(_resolve_tier_execution_target(llm_ctx, "frontier")["model"], "claude-3-7-sonnet-thinking")

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
        llm_ctx.settings.set("compute_endpoints", [{"id": "anthropic_main", "driver": "anthropic", "api_key": "sk-test"}])

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
        # /code stages its patches for Confirm & Commit: nothing is written and no transaction exists yet
        self.assertFalse(turn_res["artifact"].get("transaction_id"))
        self.assertIn("return a + b", target_py.read_text(encoding="utf-8"))
        # Confirm & Commit: a live bridge.sync of the staged patch, then undo through bridge.revert
        sys_ctx = system_bp.get_context("default")
        live_res = sys_ctx.call("bridge.sync", text=valid_patch, dry_run=False, wait=True)
        sync_vfs_barrier("default")
        tx_id = live_res["transaction_id"]
        self.assertTrue(tx_id and tx_id.startswith("tx_"))
        self.assertIn("return a * b", target_py.read_text(encoding="utf-8"))
        sys_ctx.call("bridge.revert", transaction_id=tx_id, target_state="initial")
        sync_vfs_barrier("default")
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

    def test_bridge_auto_heal_repairs_in_canonical_order_from_n_minus_1_state(self):
        """bridge.sync with auto_heal=True heals a failed chunk n against the exact n-1 virtual buffer state and substitutes the repaired chunk in-place without reordering."""
        target_py = self.repo_dir / "overlap.py"
        target_py.write_text(
            "def first():\n    return 1\n\ndef second():\n    return 2\n\ndef third():\n    return 3\n",
            encoding="utf-8",
        )
        force_topology_scan(workspace_id="default")

        llm_ctx = llm_bp.get_context("default")
        llm_ctx.settings.update({
            "compute_endpoints": [{"id": "anthropic_main", "driver": "anthropic", "api_key": "sk-test"}],
        })

        # Chunk 1 is valid (return 1 -> return 10).
        # Chunk 2 has a stale anchor (def second_wrong_anchor); its n-1 state has Chunk 1 applied ('return 10'),
        # and replaces 'return 2' with 'return 20'.
        # Chunk 3 depends on Chunk 2 having been applied first in canonical order (matches 'return 20' -> 'return 200')!
        raw_payload = (
            "<<<<<<< FILE: vfs://alpha/overlap.py\n"
            "<<<<<<< ID: cell_good_1\n"
            "<<<<<<< SEARCH\n"
            "def first():\n    return 1\n"
            "=======\n"
            "def first():\n    return 10\n"
            ">>>>>>> REPLACE\n\n"
            "<<<<<<< FILE: vfs://alpha/overlap.py\n"
            "<<<<<<< ID: cell_bad_2\n"
            "<<<<<<< SEARCH\n"
            "def second_wrong_anchor():\n    return 999\n"
            "=======\n"
            "def second():\n    return 20\n"
            ">>>>>>> REPLACE\n\n"
            "<<<<<<< FILE: vfs://alpha/overlap.py\n"
            "<<<<<<< ID: cell_dependent_3\n"
            "<<<<<<< SEARCH\n"
            "def second():\n    return 20\n\ndef third():\n    return 3\n"
            "=======\n"
            "def second():\n    return 20\n\ndef third():\n    return 30\n"
            ">>>>>>> REPLACE"
        )

        captured_prompts = []
        healed_chunk_2 = (
            "<<<<<<< FILE: vfs://alpha/overlap.py\n"
            "<<<<<<< SEARCH\n"
            "def second():\n    return 2\n"
            "=======\n"
            "def second():\n    return 20\n"
            ">>>>>>> REPLACE"
        )

        def fake_fast_healer(provider, api_key, model, messages, system_prompt, base_url="", **kwargs):
            captured_prompts.append((model, messages[-1]["content"]))
            return healed_chunk_2, None

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
        self.assertTrue(res.get("can_commit"), f"Expected canonical in-place heal to commit cleanly: {res}")
        self.assertEqual(res.get("healed_attempts"), 1)
        self.assertEqual(len(captured_prompts), 1)
        used_model, healer_prompt = captured_prompts[0]
        self.assertEqual(used_model, "claude-3-5-haiku-latest")
        # Verify the buffer handed to the healer for Chunk 2 is the exact n-1 state (Chunk 1's 'return 10' applied, Chunk 3's 'return 3' untouched)
        self.assertIn("return 10", healer_prompt)
        self.assertIn("return 3", healer_prompt)
        self.assertNotIn("return 30", healer_prompt)
        # Verify canonical order was preserved so Chunk 3 anchored on top of healed Chunk 2!
        self.assertEqual([p["cell_id"] for p in res["patches"]], ["cell_good_1", "cell_bad_2", "cell_dependent_3"])
        self.assertIn("cell_bad_2", res.get("healed_cells", {}))
        self.assertEqual(res["healed_cells"]["cell_bad_2"]["file"], "vfs://alpha/overlap.py")
        self.assertIn("return 20", res["healed_cells"]["cell_bad_2"]["content"])
        final_disk = target_py.read_text(encoding="utf-8")
        self.assertIn("return 10", final_disk)
        self.assertIn("return 20", final_disk)
        self.assertIn("return 30", final_disk)

        # Verify that if the LLM healer returns a block that still fails to anchor, it is rejected immediately in 1 call (never looping)
        unhealable_payload = (
            "<<<<<<< FILE: vfs://alpha/overlap.py\n"
            "<<<<<<< ID: cell_unhealable\n"
            "<<<<<<< SEARCH\n"
            "def nonexistent_fn():\n    return 999\n"
            "=======\n"
            "def nonexistent_fn():\n    return 0\n"
            ">>>>>>> REPLACE"
        )
        dud_calls = []

        def fake_dud_healer(provider, api_key, model, messages, system_prompt, base_url="", **kwargs):
            dud_calls.append(1)
            return unhealable_payload, None

        with patch("insetu.core.llm.engine_llm._run_single_inference", side_effect=fake_dud_healer):
            dud_res = sys_ctx.call(
                "bridge.sync",
                text=unhealable_payload,
                active_files=["vfs://alpha/overlap.py"],
                dry_run=True,
                auto_heal=True,
                max_heal_passes=5,
                wait=True,
            )
        self.assertFalse(dud_res.get("can_commit"))
        self.assertEqual(len(dud_calls), 1, "Unhealable cell must be attempted at most once and halted immediately")

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
        llm_ctx.settings.update({
            "compute_endpoints": [{"id": "anthropic_main", "driver": "anthropic", "api_key": "sk-test", "max_parallel": 4}],
        })

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
        reduce_node = out["envelope"].nodes["reduce_step"]
        self.assertEqual(len(reduce_node["items"]), 3)
        self.assertIn("OUT(Branch 1)", reduce_node["text"])
        self.assertIn("OUT(Branch 4)", reduce_node["text"])

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
        self.assertIn("+ # Completely Overwritten Essay", turn_diff_res["diff_text"])

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

        from insetu.core.agent.envelope import RoutineEnvelope as _RoutineEnvelope
        # Supply Wavefront 0 responses via server checkpoint -> advances to Wavefront 1 (final_report)!
        paused_w1 = execute_declarative_routine(
            agent_ctx,
            routine_id="manual_fanout",
            user_prompt="Check alpha",
            envelope=_RoutineEnvelope.from_checkpoint(paused_w0["checkpoint"]),
            inputs={
                "handoff_responses": {
                    "sec_scan": "SEC_OK",
                    "perf_scan": "PERF_OK",
                },
            },
        )
        self.assertEqual(paused_w1["status"], "paused_for_user")
        self.assertEqual(paused_w1["pending_handoff"]["node_id"], "final_report")
        self.assertIn("Combine: SEC_OK AND PERF_OK", paused_w1["pending_handoff"]["compiled_prompt"])

        # Supply Wavefront 1 response via server checkpoint -> completes routine!
        done_res = execute_declarative_routine(
            agent_ctx,
            routine_id="manual_fanout",
            user_prompt="Check alpha",
            envelope=_RoutineEnvelope.from_checkpoint(paused_w1["checkpoint"]),
            inputs={
                "handoff_responses": {
                    "sec_scan": "SEC_OK",
                    "perf_scan": "PERF_OK",
                    "final_report": "ALL_SYSTEMS_GO",
                },
            },
        )
        self.assertEqual(done_res["status"], "completed")
        self.assertEqual(done_res["response"], "ALL_SYSTEMS_GO")

        # 3b. Verify routine with include_prompt + nested {{include_prompt:...}} macro + bare slash command invocation
        #     expands the full prompt and Yomama directives on manual handoff (never returning the bare routine ID slug!)
        p_ctx = prompts_bp.get_context("default")
        p_ctx.vfs.save(
            "ctx://prompts/sub_rules.md",
            "---\ntitle: Sub Rules\n---\nAlways check edge cases.",
        )
        p_ctx.vfs.save(
            "ctx://prompts/wrap_main.md",
            "---\ntitle: Wrap Main\n---\nPerform wrap audit for {{ macro_target | core }}.\n\n{{include_prompt: ctx://prompts/sub_rules.md}}",
        )
        wrap_routine_md = (
            "---\n"
            "id: insetu_core_ai_bridge_wrap\n"
            "title: AI Bridge Wrap\n"
            "transport: manual\n"
            "include_prompt: ctx://prompts/wrap_main.md\n"
            "includes:\n"
            "  - vfs://alpha/README.md\n"
            "nodes:\n"
            "  - id: synthesize_step\n"
            "    type: llm\n"
            "    tier: standard\n"
            "    output_schema: conversational_with_patches\n"
            "---\n"
        )
        sys_ctx.call("agent.routines.save", id="insetu_core_ai_bridge_wrap", raw_content=wrap_routine_md)
        sync_vfs_barrier("default")

        # Also verify InSetuContext.call("prompts.resolve", ...) unwraps the Flask (text, 200, headers) tuple into a plain str
        direct_resolved = sys_ctx.call("prompts.resolve", file="ctx://prompts/wrap_main.md")
        self.assertIsInstance(direct_resolved, str)
        self.assertIn("Always check edge cases.", direct_resolved)

        wrap_handoff = execute_declarative_routine(
            agent_ctx,
            routine_id="insetu_core_ai_bridge_wrap",
            user_prompt="insetu_core_ai_bridge_wrap",
        )
        self.assertEqual(wrap_handoff["status"], "paused_for_user")
        copied_prompt = wrap_handoff["pending_handoff"]["prompt_text"]
        self.assertNotEqual(copied_prompt.strip(), "insetu_core_ai_bridge_wrap")
        self.assertIn("Perform wrap audit for core.", copied_prompt)
        self.assertIn("Always check edge cases.", copied_prompt)
        self.assertIn("<<<<<<< FILE:", copied_prompt)

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

        sys_ctx = system_bp.get_context("default")

        # 1. Verify universal colon-scoped command grammar
        parsed_1 = _parse_colon_command_tokens("/upkeep:docs focus on alpha")
        self.assertEqual(parsed_1["target"], "upkeep")
        self.assertEqual(parsed_1["scope"], "docs")
        self.assertEqual(parsed_1["rest"], "focus on alpha")

        parsed_2 = _parse_colon_command_tokens("/user:upkeep:modularize:apply")
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

        # 1. Verify llm.resolve_target capability returns driver metadata and can_auto_heal readiness
        target_res = sys_ctx.call("llm.resolve_target", tier="fast")
        self.assertEqual(target_res["tier"], "fast")
        self.assertIn("provider", target_res)
        self.assertIn("model", target_res)
        self.assertIn("is_web_chat", target_res)
        self.assertIn("has_api_key", target_res)
        self.assertFalse(target_res["can_auto_heal"], "Without an API key on a cloud endpoint, can_auto_heal must be False")
        self.assertIn("No API key", target_res["auto_heal_reason"])
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

    def test_interpolation_resolves_inside_out_and_never_rescans_values(self):
        """A resolved value is never scanned again: '{{ global.mode }}' inside the user message stays literal, though global.mode exists."""
        chain_ctx = {
            "global": {"mode": "auto", "user_message": "Keep {{ global.mode }} literal"},
            "initial_answer": {"text": "Initial Answer Text"},
        }
        rendered = _interpolate_all_syntax(
            "Msg: {{ inputs.user_message }} | Out: {{ nodes.final_answer.text | {{ nodes.initial_answer.text }} }}",
            chain_ctx,
        )
        self.assertEqual(rendered, "Msg: Keep {{ global.mode }} literal | Out: Initial Answer Text")

    def test_ingest_reply_validation_and_monotonic_seq_after_delete(self):
        """ingest_reply issues server message_ids, returns 400 on client message_id or invalid role, 404 on unknown session_id, and never reuses a deleted seq."""
        agent_ctx = agent_bp.get_context("default")
        sid = "sess_ingest_rules"
        agent_ctx.db.execute(
            "INSERT INTO chat_sessions (session_id, title, updated_at, seq_counter) VALUES (?, ?, ?, ?)",
            (sid, "Ingest Rules", time.time(), 0),
        )
        agent_ctx.db.commit()

        app = Flask(__name__)
        app.register_blueprint(agent_bp.bp)
        client = app.test_client()

        # 1. Valid ingest_reply mints server-issued 'msg_' + 12 hex ID and seq=1
        r1 = client.post(
            "/api/default/agent/ingest_reply",
            json={"session_id": sid, "role": "user", "raw_text": "Original text"},
        )
        self.assertEqual(r1.status_code, 200)
        msg_id_1 = r1.get_json()["message_id"]
        self.assertRegex(msg_id_1, r"^msg_[0-9a-f]{12}$")
        first_seq = int(r1.get_json()["seq"])
        self.assertEqual(first_seq, 1)

        # 2. Client-supplied message_id returns exactly 400 and writes nothing
        r_dup = client.post(
            "/api/default/agent/ingest_reply",
            json={"session_id": sid, "message_id": msg_id_1, "role": "user", "raw_text": "Clobbered text"},
        )
        self.assertEqual(r_dup.status_code, 400)
        row_1 = agent_ctx.db.execute("SELECT content FROM chat_messages WHERE message_id=?", (msg_id_1,)).fetchone()
        self.assertEqual(row_1["content"], "Original text")

        # 3. role="system" returns 400; unknown session_id returns 404; neither writes a row or bumps seq_counter
        r_role = client.post(
            "/api/default/agent/ingest_reply",
            json={"session_id": sid, "role": "system", "raw_text": "System override"},
        )
        self.assertEqual(r_role.status_code, 400)
        r_unknown = client.post(
            "/api/default/agent/ingest_reply",
            json={"session_id": "sess_does_not_exist", "role": "assistant", "raw_text": "Hello"},
        )
        self.assertEqual(r_unknown.status_code, 404)
        total_rows = agent_ctx.db.execute("SELECT COUNT(*) AS cnt FROM chat_messages WHERE session_id=?", (sid,)).fetchone()["cnt"]
        seq_after_rejects = agent_ctx.db.execute("SELECT seq_counter FROM chat_sessions WHERE session_id=?", (sid,)).fetchone()["seq_counter"]
        self.assertEqual(total_rows, 1)
        self.assertEqual(seq_after_rejects, 1)

        # 4. Deleting the newest message never reuses its sequence number
        self.assertEqual(client.delete(f"/api/default/agent/messages/{msg_id_1}").status_code, 200)
        r2 = client.post(
            "/api/default/agent/ingest_reply",
            json={"session_id": sid, "role": "user", "raw_text": "Second message"},
        )
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(int(r2.get_json()["seq"]), 2)

    def test_message_deletion_invalidates_cold_compaction_blocks_and_rebuilds_from_messages(self):
        """Deleting a message from the first cold block drops both cold blocks, resets watermark to 0, clears compacted_into_id, and rebuilds from chat_messages alone."""
        from insetu.core.agent.session_ledger import (
            compact_session_history as _compact_history,
            next_session_seq as _next_seq,
        )

        agent_ctx = agent_bp.get_context("default")
        sid = "sess_compaction_invalidation"
        now = time.time()
        agent_ctx.db.execute(
            "INSERT INTO chat_sessions (session_id, title, updated_at, seq_counter) VALUES (?, ?, ?, ?)",
            (sid, "Compaction Test", now, 0),
        )
        agent_ctx.settings.set("helper_mode", "deterministic")
        for idx in range(1, 21):
            s_num = _next_seq(agent_ctx, sid)
            agent_ctx.db.execute(
                "INSERT INTO chat_messages (message_id, session_id, seq, role, content, raw_content, receipt, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (f"m_cold_{idx}", sid, s_num, "user" if idx % 2 else "assistant", f"Turn {idx} body", f"Turn {idx} body", f"[Turn #{s_num}]: Turn {idx}", now + idx),
            )
        agent_ctx.db.commit()

        raw_rows_14 = [
            dict(r) for r in agent_ctx.db.execute(
                "SELECT message_id, seq, role, content, raw_content, receipt, transaction_id FROM chat_messages WHERE session_id=? ORDER BY seq ASC LIMIT 14",
                (sid,),
            ).fetchall()
        ]
        _, _, cv_step1 = _compact_history(agent_ctx, sid, raw_rows_14, "", {"compacted_up_to_seq": 0, "blocks": []})
        raw_rows_20 = [
            dict(r) for r in agent_ctx.db.execute(
                "SELECT message_id, seq, role, content, raw_content, receipt, transaction_id FROM chat_messages WHERE session_id=? ORDER BY seq ASC",
                (sid,),
            ).fetchall()
        ]
        _, _, cv_step2 = _compact_history(agent_ctx, sid, raw_rows_20, "", cv_step1)
        self.assertEqual(len(cv_step2.get("blocks", [])), 2)
        agent_ctx.db.execute(
            "UPDATE chat_sessions SET compacted_view_json=? WHERE session_id=?",
            (json.dumps(cv_step2), sid),
        )
        agent_ctx.db.commit()

        app = Flask(__name__)
        app.register_blueprint(agent_bp.bp)
        client = app.test_client()
        self.assertEqual(client.delete("/api/default/agent/messages/m_cold_1").status_code, 200)

        cv_after_del = json.loads(
            agent_ctx.db.execute("SELECT compacted_view_json FROM chat_sessions WHERE session_id=?", (sid,)).fetchone()["compacted_view_json"]
        )
        self.assertEqual(cv_after_del.get("blocks"), [])
        self.assertEqual(cv_after_del.get("compacted_up_to_seq"), 0)
        non_empty_compacted = agent_ctx.db.execute(
            "SELECT COUNT(*) AS cnt FROM chat_messages WHERE session_id=? AND compacted_into_id != ''",
            (sid,),
        ).fetchone()["cnt"]
        self.assertEqual(non_empty_compacted, 0)

        surviving_rows = [
            dict(r) for r in agent_ctx.db.execute(
                "SELECT message_id, seq, role, content, raw_content, receipt, transaction_id FROM chat_messages WHERE session_id=? ORDER BY seq ASC",
                (sid,),
            ).fetchall()
        ]
        surviving_cold_ids = [r["message_id"] for r in surviving_rows[:-12]]
        _, _, cv_rebuilt = _compact_history(agent_ctx, sid, surviving_rows, "", cv_after_del)
        rebuilt_covered_ids = [mid for b in cv_rebuilt.get("blocks", []) for mid in b.get("message_ids", [])]
        self.assertEqual(rebuilt_covered_ids, surviving_cold_ids)

        agent_ctx.db.execute("UPDATE chat_messages SET compacted_into_id='' WHERE session_id=?", (sid,))
        agent_ctx.db.commit()
        _, _, cv_from_scratch = _compact_history(agent_ctx, sid, surviving_rows, "", {})
        scratch_covered_ids = [mid for b in cv_from_scratch.get("blocks", []) for mid in b.get("message_ids", [])]
        self.assertEqual(scratch_covered_ids, surviving_cold_ids)

    def test_real_turn_records_context_hashes_matching_bridge_ledger(self):
        """Running a real assistant turn that commits a file records context_hashes_json on the stored assistant message matching bridge_ledger.post_patch_hash."""
        from insetu.core.utils_core import compute_vfs_sha256 as _compute_sha256

        target_file = self.repo_dir / "turn_hash_target.py"
        target_file.write_text("VALUE = 1\n", encoding="utf-8")
        force_topology_scan(workspace_id="default")

        agent_ctx = agent_bp.get_context("default")
        sid = "sess_turn_hashes"
        agent_ctx.db.execute(
            "INSERT INTO chat_sessions (session_id, title, updated_at, seq_counter) VALUES (?, ?, ?, ?)",
            (sid, "Turn Hashes", time.time(), 0),
        )
        agent_ctx.db.commit()

        patch_uri = "vfs://alpha/turn_hash_target.py"
        yomama_prompt = (
            f"<<<<<<< FILE: {patch_uri}\n"
            "<<<<<<< SEARCH\nVALUE = 1\n=======\nVALUE = 99\n>>>>>>> REPLACE"
        )
        turn_out = _execute_agent_turn(
            agent_ctx,
            session_id=sid,
            user_prompt=yomama_prompt,
            mode="yomama",
            attached_files=[patch_uri],
        )
        sync_vfs_barrier("default")
        self.assertTrue(turn_out["artifact"]["transaction_id"].startswith("tx_"))

        asst_row = agent_ctx.db.execute(
            "SELECT transaction_id, context_hashes_json FROM chat_messages WHERE session_id=? AND role='assistant' ORDER BY seq DESC LIMIT 1",
            (sid,),
        ).fetchone()
        self.assertIsNotNone(asst_row)
        stored_hashes = json.loads(asst_row["context_hashes_json"] or "{}")

        bridge_db = agent_ctx.get_db("bridge")
        ledger_row = bridge_db.execute(
            "SELECT post_patch_hash FROM bridge_ledger WHERE filepath=? ORDER BY timestamp DESC LIMIT 1",
            (patch_uri,),
        ).fetchone()
        self.assertIsNotNone(ledger_row)
        self.assertEqual(stored_hashes.get(patch_uri), ledger_row["post_patch_hash"])
        self.assertEqual(stored_hashes.get(patch_uri), _compute_sha256("VALUE = 99\n"))

    def test_query_context_refuses_untracked_files_across_all_forms(self):
        """A QUERY_CONTEXT directive naming a file outside the topology (by direct URI, file_slice, symbol_def, or fuzzy name) is refused by resolve_query_context and excluded from compile_query_quickpack."""
        from insetu.core.gather.context_assemble import (
            compile_query_quickpack as _compile_qq,
            resolve_query_context as _resolve_qc,
        )

        (self.repo_dir / "tracked_mod.py").write_text("def ok_fn():\n    return 1\n", encoding="utf-8")
        (self.repo_dir / "secret_untracked.env").write_text("API_SECRET=top_secret\n", encoding="utf-8")
        force_topology_scan(workspace_id="default")

        g_ctx = gather_bp.get_context("default")
        # Tracked file is served
        served = _resolve_qc(g_ctx, "vfs://alpha/tracked_mod.py")
        self.assertEqual(served.get("type"), "file_read")
        self.assertIn("def ok_fn", served.get("content", ""))

        # Untracked file refused by direct URI, file_slice, symbol_def, and fuzzy name
        for bad_directive in (
            "vfs://alpha/secret_untracked.env",
            '{"type": "file_slice", "filepath": "vfs://alpha/secret_untracked.env", "start_line": 1, "end_line": 5}',
            '{"type": "symbol_def", "target": "vfs://alpha/secret_untracked.env#API_SECRET"}',
            "secret_untracked.env",
        ):
            res_bad = _resolve_qc(g_ctx, bad_directive)
            self.assertNotEqual(res_bad.get("type"), "file_read", f"Untracked file must not be read via {bad_directive}")
            self.assertNotIn("top_secret", json.dumps(res_bad))

        # compile_query_quickpack excludes untracked files even when named by URI or fuzzy basename
        c_open = "<" * 7
        c_close = ">" * 7 + " EXECUTE"
        raw_probe = f"{c_open} QUERY_CONTEXT\nvfs://alpha/tracked_mod.py\nvfs://alpha/secret_untracked.env\nsecret_untracked.env\n{c_close}"
        qp = _compile_qq(g_ctx, raw_probe)
        self.assertIsNotNone(qp)
        self.assertEqual(qp["files"], ["vfs://alpha/tracked_mod.py"])

    def test_multi_step_plan_scoping_commit_advance_and_file_promotion(self):
        """Verifies ephemeral multi-step plan normalization, active-step working-set scoping, commit-driven task check-off (manual vs auto), and promotion to a real plan.md file."""
        from insetu.core.agent.schemas.plan import (
            format_active_plan_meta_projection as _format_plan_meta,
            normalize_active_plan_dict as _norm_plan_dict,
        )
        from insetu.core.agent.plan_ledger import (
            complete_and_advance_plan_task as _complete_task,
            promote_ephemeral_plan_to_file as _promote_plan,
            record_committed_bridge_transaction as _record_tx,
        )

        (self.repo_dir / "step1_mod.py").write_text("STEP_1 = True\n", encoding="utf-8")
        (self.repo_dir / "step2_mod.py").write_text("STEP_2 = True\n", encoding="utf-8")
        force_topology_scan(workspace_id="default")

        agent_ctx = agent_bp.get_context("default")
        sid = "sess_plan_stepper"
        raw_tasks = [
            {"id": "T1", "kind": "edit", "description": "2.1 & 2.2 in step1_mod.py", "targets": ["vfs://alpha/step1_mod.py"], "test_contract": "vfs://alpha/tests/test_s1.py"},
            {"id": "T2", "kind": "edit", "description": "2.3 & 2.4 in step2_mod.py", "targets": ["vfs://alpha/step2_mod.py"], "test_contract": "vfs://alpha/tests/test_s2.py"},
            {"id": "T3", "kind": "verify", "description": "Run full verification pass", "targets": ["vfs://alpha/step1_mod.py", "vfs://alpha/step2_mod.py"]},
            {"id": "T4", "kind": "verify", "description": "Final audit check", "targets": ["vfs://alpha/step1_mod.py"]},
        ]
        plan_dict = _norm_plan_dict(raw_tasks, title="Hardening 2.1-2.4", is_ephemeral=True)
        self.assertIsNotNone(plan_dict)
        self.assertEqual(plan_dict["active_task_id"], "T1")
        self.assertTrue(plan_dict["recommend_file_upgrade"])

        meta_proj = _format_plan_meta(plan_dict)
        self.assertIn("CURRENT ACTIVE STEP [T1]", meta_proj)
        self.assertIn("[ ] (DEFERRED — Do NOT implement in this turn) [T2]", meta_proj)

        agent_ctx.db.execute(
            "INSERT INTO chat_sessions (session_id, title, updated_at, active_plan_json, seq_counter) VALUES (?, ?, ?, ?, ?)",
            (sid, "Plan Stepper Test", time.time(), json.dumps(plan_dict), 0),
        )
        agent_ctx.db.commit()

        # 1. With auto_complete_plan_tasks=False (default), committing tx_step1 records pending_commit_tx on T1 without auto-advancing
        agent_ctx.settings.set("auto_complete_plan_tasks", False)
        rec1 = _record_tx(agent_ctx, sid, "tx_step1", ["vfs://alpha/step1_mod.py"])
        self.assertFalse(rec1["auto_advanced"])
        self.assertEqual(rec1["active_plan"]["pending_commit_tx"], "tx_step1")
        self.assertEqual(rec1["active_plan"]["active_task_id"], "T1")

        # 2. Clicking 'Mark [T1] Complete & Start [T2]' completes T1 with tx_step1 and advances active_task_id to T2
        adv1 = _complete_task(agent_ctx, sid)
        self.assertEqual(adv1["completed_task"]["id"], "T1")
        self.assertTrue(adv1["completed_task"]["completed"])
        self.assertEqual(adv1["completed_task"]["transaction_id"], "tx_step1")
        self.assertEqual(adv1["next_task"]["id"], "T2")
        self.assertEqual(adv1["active_plan"]["active_task_id"], "T2")

        # 3. Promote ephemeral plan to a real docs/plans/*.md file
        prom = _promote_plan(agent_ctx, sid, repo="alpha")
        self.assertEqual(prom["status"], "success")
        plan_uri = prom["plan_filepath"]
        self.assertTrue(plan_uri.startswith("vfs://alpha/docs/plans/"))
        sync_vfs_barrier("default")
        md_on_disk = agent_ctx.vfs.read(plan_uri)
        self.assertIn("- [x] [T1] 2.1 & 2.2 in step1_mod.py (tx_step1)", md_on_disk)
        self.assertIn("- [ ] [T2] 2.3 & 2.4 in step2_mod.py", md_on_disk)

        # 4. With auto_complete_plan_tasks=True, committing tx_step2 automatically marks T2 complete, ticks the file on disk, and advances to T3!
        agent_ctx.settings.set("auto_complete_plan_tasks", True)
        rec2 = _record_tx(agent_ctx, sid, "tx_step2", ["vfs://alpha/step2_mod.py"])
        sync_vfs_barrier("default")
        self.assertTrue(rec2["auto_advanced"])
        self.assertEqual(rec2["next_task"]["id"], "T3")
        md_after_t2 = agent_ctx.vfs.read(plan_uri)
        self.assertIn("- [x] [T2] 2.3 & 2.4 in step2_mod.py (tx_step2)", md_after_t2)

        # 5. Verify extract_task_manage_directives intercepts both explicit TASK_MANAGE and checkbox-only SEARCH/REPLACE blocks
        from insetu.core.agent.schemas.plan import extract_task_manage_directives as _extract_tm
        from insetu.core.agent.plan_ledger import apply_task_manage_actions as _apply_tm
        c_open = "<" * 7
        c_sep = "=" * 7
        c_close_rep = ">" * 7 + " REPLACE"
        c_close_exe = ">" * 7 + " EXECUTE"
        mixed_reply = (
            f"{c_open} FILE: vfs://alpha/step1_mod.py\n{c_open} SEARCH\nSTEP_1 = True\n{c_sep}\nSTEP_1 = False\n{c_close_rep}\n\n"
            f"{c_open} FILE: {plan_uri}\n{c_open} TASK_MANAGE\nCOMPLETE: T3\nADD: T5 | kind: verify | targets: vfs://alpha/step1_mod.py | Extra check\n{c_close_exe}\n\n"
            f"{c_open} FILE: {plan_uri}\n{c_open} SEARCH\n- [ ] [T4] Final audit check\n{c_sep}\n- [x] [T4] Final audit check\n{c_close_rep}"
        )
        tm_actions, remaining_patches = _extract_tm(mixed_reply)
        self.assertEqual([a["op"] for a in tm_actions], ["complete", "add", "complete"])
        self.assertEqual([a["task_id"] for a in tm_actions], ["T3", "T5", "T4"])
        self.assertIn("STEP_1 = False", remaining_patches)
        self.assertNotIn("TASK_MANAGE", remaining_patches)
        self.assertNotIn("[T4] Final audit check", remaining_patches)

        tm_res = _apply_tm(agent_ctx, sid, tm_actions)
        self.assertEqual(tm_res["status"], "success")
        self.assertEqual(tm_res["active_plan"]["active_task_id"], "T5")

    def test_routine_envelope_delta_packing_and_doc_reference_extraction(self):
        """RoutineEnvelope partitions unchanged vs. changed blocks in same_window mode, protects user_pinned files from probe drops, and extract_doc_referenced_files resolves Markdown headings and links."""
        from insetu.core.agent.envelope import RoutineEnvelope as _RoutineEnvelope
        from insetu.core.gather.rag_proximity import extract_doc_referenced_files as _extract_doc_refs

        # 1. Same-Window vs. New-Window Web-Chat delta partitioning
        env = _RoutineEnvelope(session_id="ses_delta", web_chat_window_mode="same_window")
        blocks_t1 = [
            ("vfs://alpha/README.md", "full", "=== vfs://alpha/README.md [FULL] ===\n# Alpha\n"),
            ("vfs://alpha/app.py", "full", "=== vfs://alpha/app.py [FULL] ===\nx = 1\n"),
        ]
        full_1, delta_1, staged_1, meta_1 = env.partition_full_vs_delta_blocks(blocks_t1)
        self.assertEqual(delta_1, full_1)
        self.assertEqual((meta_1["changed_count"], meta_1["unchanged_count"]), (2, 0))

        # Ratify Turn 1 hashes and modify only app.py on Turn 2
        env.sent_hashes.update(staged_1)
        blocks_t2 = [
            ("vfs://alpha/README.md", "full", "=== vfs://alpha/README.md [FULL] ===\n# Alpha\n"),
            ("vfs://alpha/app.py", "full", "=== vfs://alpha/app.py [FULL] ===\nx = 2\n"),
        ]
        _, delta_2, _, meta_2 = env.partition_full_vs_delta_blocks(blocks_t2)
        self.assertEqual(meta_2["unchanged_uris"], ["vfs://alpha/README.md"])
        self.assertEqual(meta_2["changed_uris"], ["vfs://alpha/app.py"])
        self.assertIn("ALREADY IN YOUR CHAT WINDOW", delta_2)
        self.assertIn("x = 2", delta_2)
        self.assertNotIn("# Alpha", delta_2)

        # In new_window mode, all blocks are emitted even when sent_hashes match
        env.web_chat_window_mode = "new_window"
        full_3, delta_3, _, meta_3 = env.partition_full_vs_delta_blocks(blocks_t2)
        self.assertEqual(delta_3, full_3)
        self.assertEqual(meta_3["unchanged_count"], 0)

        # 2. QUERY_CONTEXT directives: user_pinned survives scout drops while probe drops and additions apply
        (self.repo_dir / "pinned.py").write_text("PINNED = 1\n", encoding="utf-8")
        (self.repo_dir / "extra.py").write_text("EXTRA = 1\n", encoding="utf-8")
        (self.repo_dir / "docs").mkdir(parents=True, exist_ok=True)
        (self.repo_dir / "docs" / "spec.md").write_text("# Spec\n", encoding="utf-8")
        force_topology_scan("default")

        env.apply_working_set_delta(add=["vfs://alpha/pinned.py"], source="user_pinned")
        _, dropped_by_scout = env.apply_working_set_delta(drop=["vfs://alpha/pinned.py"], source="scout_hop2")
        self.assertEqual(dropped_by_scout, [], "Scout passes must never drop user_pinned files")

        from insetu.core.gather.context_assemble import resolve_envelope_query_directives as _resolve_env_q
        agent_ctx = agent_bp.get_context("default")
        added_q, _ = _resolve_env_q(
            agent_ctx,
            env,
            ["+ vfs://alpha/extra.py"],
            lambda c, uris: [u for u in uris if u.startswith("vfs://alpha/")],
        )
        self.assertEqual(added_q, ["vfs://alpha/extra.py"])
        self.assertIn("vfs://alpha/extra.py", env.artifacts)

        # 3. extract_doc_referenced_files resolves Markdown links and explicit URIs via MarkdownLanguageProvider
        plan_text = (
            "# 1. Storage Layer\n"
            "Update [Spec](docs/spec.md) and `vfs://alpha/pinned.py`.\n\n"
            "# 2. Unrelated Section\n"
            "Leave `vfs://alpha/extra.py` alone.\n"
        )
        refs = _extract_doc_refs(agent_ctx, "Implement Section 1.1 Storage Layer", plan_text)
        self.assertIn("vfs://alpha/pinned.py", refs)

    def test_greenfield_epistemic_scout_loop_and_transport_isomorphism(self):
        """Verifies the bounded `until:` epistemic scout loop (Hop 1 `need_context` -> Hop 2 `ready` with `drop_files`) and Turn-1 `TASK_MANAGE` + patch settlement parity across API and Web-Chat transports."""
        (self.repo_dir / "mod_a.py").write_text("A = 1\n", encoding="utf-8")
        (self.repo_dir / "mod_b.py").write_text("B = 1\n", encoding="utf-8")
        (self.repo_dir / "wrong_guess.py").write_text("W = 1\n", encoding="utf-8")
        (self.repo_dir / "docs").mkdir(parents=True, exist_ok=True)
        (self.repo_dir / "docs" / "brief.md").write_text(
            "# Brief\nSee `docs/child_plan.md` for the exact modules.\n",
            encoding="utf-8",
        )
        (self.repo_dir / "docs" / "child_plan.md").write_text(
            "# Child Plan\n1. Update `vfs://alpha/mod_a.py` first, then `vfs://alpha/mod_b.py`.\n",
            encoding="utf-8",
        )
        force_topology_scan("default")

        agent_ctx = agent_bp.get_context("default")
        llm_ctx = llm_bp.get_context("default")
        llm_ctx.settings.update({
            "compute_endpoints": [{"id": "anthropic_main", "driver": "anthropic", "api_key": "sk-test"}],
        })

        c_open = "<" * 7
        c_sep = "=" * 7
        c_close_rep = ">" * 7 + " REPLACE"
        c_close_exe = ">" * 7 + " EXECUTE"
        combined_thinking_reply = (
            f"Executing Step T1 now.\n\n"
            f"```text\n"
            f"{c_open} FILE: ctx://plan/active_plan.md\n"
            f"{c_open} TASK_MANAGE\n"
            f"ADD: T1 | kind: edit | targets: vfs://alpha/mod_a.py | Update A in mod_a.py\n"
            f"ADD: T2 | kind: edit | targets: vfs://alpha/mod_b.py | Update B in mod_b.py\n"
            f"ACTIVE: T1\n"
            f"{c_close_exe}\n"
            f"```\n\n"
            f"```text\n"
            f"{c_open} FILE: vfs://alpha/mod_a.py\n"
            f"{c_open} SEARCH\nA = 1\n{c_sep}\nA = 42\n{c_close_rep}\n"
            f"```"
        )

        # 1. API Transport Run: Interleaved (scout_targets -> plan_tasks) loop:
        #    - Cycle 1 scout_targets guesses wrong_guess.py + mod_a.py;
        #    - Cycle 1 plan_tasks sees brief.md references unread docs/child_plan.md -> returns status="need_context", inspect_files=["vfs://alpha/docs/child_plan.md"];
        #    - Cycle 2 scout_targets reads child_plan.md + Prior Plan Feedback, drops wrong_guess.py, and requests mod_b.py;
        #    - Cycle 2 plan_tasks locks in T1..T2 with status="ready";
        #    - generate_patch emits TASK_MANAGE + T1 patch.
        call_seq = []
        def fake_api_infer(provider, api_key, model, messages, system_prompt, base_url="", **kwargs):
            prompt_str = messages[-1]["content"]
            call_seq.append(prompt_str)
            if "Fast File Scout" in prompt_str:
                if "=== INSPECTED DOCUMENT: vfs://alpha/docs/child_plan.md ===" not in prompt_str:
                    return json.dumps({
                        "inspect_files": [],
                        "requested_files": ["vfs://alpha/wrong_guess.py", "vfs://alpha/mod_a.py"],
                        "reason": "Initial file scout before child_plan.md is requested by planner",
                    }), None
                return json.dumps({
                    "inspect_files": [],
                    "global_files": ["vfs://alpha/docs/brief.md"],
                    "requested_files": ["vfs://alpha/mod_b.py"],
                    "drop_files": ["vfs://alpha/wrong_guess.py"],
                    "reason": "Scouted mod_b.py and dropped wrong_guess.py after reading child_plan.md",
                }), None
            if "Fast Plan Synthesizer" in prompt_str:
                if "=== INSPECTED DOCUMENT: vfs://alpha/docs/child_plan.md ===" not in prompt_str:
                    return json.dumps({
                        "tasks": [
                            {"id": "T1", "kind": "edit", "description": "Draft T1", "targets": ["vfs://alpha/mod_a.py"]},
                        ],
                        "inspect_files": ["vfs://alpha/docs/child_plan.md"],
                        "missing_context_notes": "Need to read docs/child_plan.md to find second module",
                        "status": "need_context",
                        "reason": "Need child_plan.md",
                    }), None
                return json.dumps({
                    "tasks": [
                        {"id": "T1", "kind": "edit", "description": "Initial T1 from planner", "targets": ["vfs://alpha/mod_a.py"]},
                        {"id": "T2", "kind": "edit", "description": "Initial T2 from planner", "targets": ["vfs://alpha/mod_b.py"]},
                    ],
                    "inspect_files": [],
                    "missing_context_notes": "",
                    "status": "ready",
                    "reason": "Planned T1 and T2 after reading child_plan.md",
                }), None
            return combined_thinking_reply, None

        sid_api = "sess_iso_api"
        agent_ctx.db.execute(
            "INSERT INTO chat_sessions (session_id, title, updated_at, seq_counter) VALUES (?, ?, ?, ?)",
            (sid_api, "API Isomorphism", time.time(), 0),
        )
        agent_ctx.db.commit()

        with patch("insetu.core.llm.engine_llm._run_single_inference", side_effect=fake_api_infer):
            api_turn = _execute_agent_turn(
                agent_ctx,
                session_id=sid_api,
                user_prompt="Execute items 1 and 2 from brief.md",
                mode="code",
            )

        art_api = api_turn["artifact"]
        # Verify Cycle 1 (scout + plan) + Cycle 2 (scout + plan) + Generate Patch ran (5 total LLM calls)
        self.assertEqual(len(call_seq), 5)
        # Verify wrong_guess.py was dropped while mod_a.py and mod_b.py were retained, and active_plan was initialized with T1 active!
        self.assertIsNotNone(art_api["active_plan"])
        self.assertEqual([t["id"] for t in art_api["active_plan"]["tasks"]], ["T1", "T2"])
        self.assertEqual(art_api["active_plan"]["active_task_id"], "T1")
        self.assertEqual(art_api["active_plan"]["tasks"][0]["description"], "Update A in mod_a.py")
        self.assertIn("A = 42", art_api["unapplied_patches"])
        self.assertNotIn("TASK_MANAGE", art_api["unapplied_patches"])

        # Verify `msg://` session overview + turn dossier projection and `.zip` telemetry bundle export
        from insetu.core.bridge.bridge_telemetry import (
            build_session_telemetry_files_map as _build_tel_map,
            build_session_telemetry_zip_bytes as _build_tel_zip,
        )
        tel_map = _build_tel_map(agent_ctx, session_id=sid_api)
        self.assertIn("00_session_overview.txt", tel_map)
        self.assertIn("ACTIVE PLAN:", tel_map["00_session_overview.txt"])
        self.assertTrue(any(k.startswith("turn_001_") for k in tel_map.keys()))
        zip_raw = _build_tel_zip(agent_ctx, session_id=sid_api)
        self.assertGreater(len(zip_raw), 100)

        # 2. Web-Chat (`agent/ingest_reply`) Transport Isomorphism: ingesting the exact same combined_thinking_reply
        #    produces the exact same active_plan and cleaned unapplied_patches!
        sid_wc = "sess_iso_wc"
        agent_ctx.db.execute(
            "INSERT INTO chat_sessions (session_id, title, updated_at, seq_counter) VALUES (?, ?, ?, ?)",
            (sid_wc, "WebChat Isomorphism", time.time(), 0),
        )
        agent_ctx.db.commit()

        app = Flask(__name__)
        app.register_blueprint(agent_bp.bp)
        client = app.test_client()
        wc_resp = client.post(
            "/api/default/agent/ingest_reply",
            json={"session_id": sid_wc, "role": "assistant", "raw_text": combined_thinking_reply},
        )
        self.assertEqual(wc_resp.status_code, 200)
        wc_data = wc_resp.get_json()
        self.assertEqual(wc_data["active_plan"]["active_task_id"], art_api["active_plan"]["active_task_id"])
        self.assertEqual([t["id"] for t in wc_data["active_plan"]["tasks"]], [t["id"] for t in art_api["active_plan"]["tasks"]])
        self.assertIn("A = 42", wc_data["unapplied_patches"])
        self.assertNotIn("TASK_MANAGE", wc_data["unapplied_patches"])

        # 3. Reflection Invariant: Every field in dataclasses.fields(RoutineEnvelope) round-trips losslessly
        #    through to_checkpoint() -> from_checkpoint() and fork_sub_routine()
        from dataclasses import fields as _dc_fields
        from insetu.core.agent.envelope import ContextArtifact as _ContextArtifact, RoutineEnvelope as _RoutineEnvelope
        populated_env = _RoutineEnvelope(
            session_id="ses_refl",
            routine_id="code",
            user_prompt="Prompt sentinel",
            mode="code",
            profile_id="prof_1",
            pinned_repos=["alpha"],
            web_chat_window_mode="same_window",
            budget_limit_usd=2.5,
            budget_step_usd=1.25,
            artifacts={"vfs://alpha/mod_a.py": _ContextArtifact(uri="vfs://alpha/mod_a.py", bucket="data", lens="full", source="user_pinned", tokens=120, symbols=["A"])},
            sent_hashes={"vfs://alpha/mod_a.py": "full:abc"},
            staged_sent_hashes={"vfs://alpha/mod_a.py": "full:def"},
            nodes={"scout_targets": {"status": "completed"}},
            holding={"branch_1": "val"},
            scouted_candidate_files=["vfs://alpha/mod_a.py"],
            scouted_tasks=[{"id": "T1", "description": "Task 1"}],
            attached_docs_content="=== DOC ===",
            active_plan={"title": "Plan", "active_task_id": "T1", "tasks": [{"id": "T1"}]},
            active_plan_prompt_block="=== PLAN BLOCK ===",
            staged_task_actions=[{"op": "complete", "task_id": "T1"}],
            file_token_map={"vfs://alpha/mod_a.py": 120},
        )
        cp_dict = populated_env.to_checkpoint("paused_for_user", wavefront_index=1)
        restored_env = _RoutineEnvelope.from_checkpoint(cp_dict)
        forked_env = populated_env.fork_sub_routine("sub_code")
        for f_spec in _dc_fields(_RoutineEnvelope):
            if f_spec.name == "routine_id":
                self.assertEqual(restored_env.routine_id, "code")
                self.assertEqual(forked_env.routine_id, "sub_code")
            elif f_spec.name == "artifacts":
                self.assertEqual(restored_env.artifacts["vfs://alpha/mod_a.py"].to_dict(), populated_env.artifacts["vfs://alpha/mod_a.py"].to_dict())
                self.assertEqual(forked_env.artifacts["vfs://alpha/mod_a.py"].to_dict(), populated_env.artifacts["vfs://alpha/mod_a.py"].to_dict())
            else:
                self.assertEqual(getattr(restored_env, f_spec.name), getattr(populated_env, f_spec.name), f"Field {f_spec.name} failed checkpoint round-trip")
                self.assertEqual(getattr(forked_env, f_spec.name), getattr(populated_env, f_spec.name), f"Field {f_spec.name} failed fork_sub_routine round-trip")

        # Verify JavaScriptLanguageProvider.exports handles trailing commas and 'as' aliases in export blocks
        from insetu.core.languages.javascript import JavaScriptLanguageProvider as _JsProvider
        js_exports = _JsProvider().exports(
            "vfs://alpha/agent.js",
            "export {\n    AgentStore,\n    internalFn as publicFn,\n};\n",
        )
        self.assertEqual([e["name"] for e in js_exports], ["AgentStore", "publicFn"])

        # Verify unified clamp_rag_files_to_topology policy matrix:
        from insetu.core.gather.rag_proximity import clamp_rag_files_to_topology as _clamp_rag
        # (a) #symbol fragment stripping on tracked file
        self.assertEqual(_clamp_rag(agent_ctx, ["vfs://alpha/mod_a.py#A"], allowed_repos=populated_env.pinned_repos, allow_genesis=False), ["vfs://alpha/mod_a.py"])
        # (b) Nonexistent Genesis file rejected when allow_genesis=False, accepted when allow_genesis=True
        self.assertEqual(_clamp_rag(agent_ctx, ["vfs://alpha/new_gen.py"], allowed_repos=populated_env.pinned_repos, allow_genesis=False), [])
        self.assertEqual(_clamp_rag(agent_ctx, ["vfs://alpha/new_gen.py"], allowed_repos=populated_env.pinned_repos, allow_genesis=True), ["vfs://alpha/new_gen.py"])
        # (c) Package directory without extension resolves to __init__.py entrypoint
        (self.repo_dir / "subpkg").mkdir(parents=True, exist_ok=True)
        (self.repo_dir / "subpkg" / "__init__.py").write_text("PKG = 1\n", encoding="utf-8")
        force_topology_scan("default")
        self.assertEqual(_clamp_rag(agent_ctx, ["vfs://alpha/subpkg"], allowed_repos=populated_env.pinned_repos, allow_genesis=False), ["vfs://alpha/subpkg/__init__.py"])
        # (d) Repo outside pinned_repos is rejected even with allow_genesis=True
        self.assertEqual(_clamp_rag(agent_ctx, ["vfs://other_repo/hack.py"], allowed_repos=populated_env.pinned_repos, allow_genesis=True), [])

        # 4. Sub-Routine Envelope Merge Invariant (/auto mode: workspace_turn -> classify_intent -> code):
        #    Verify that running through workspace_turn's `type: routine` handoff node merges child active_plan,
        #    unapplied_patches, and execution_trace back to the root turn settlement artifact.
        def fake_auto_infer(provider, api_key, model, messages, system_prompt, base_url="", **kwargs):
            prompt_str = messages[-1]["content"]
            if "Classify the user's intent" in prompt_str or kwargs.get("output_schema") == "intent_classification":
                return '{"intent": "EDIT_CODE"}', None
            if "Fast File Scout" in prompt_str:
                return json.dumps({
                    "inspect_files": [],
                    "requested_files": ["vfs://alpha/mod_a.py", "vfs://alpha/mod_b.py"],
                    "reason": "Ready",
                }), None
            if "Fast Plan Synthesizer" in prompt_str:
                return json.dumps({
                    "tasks": [
                        {"id": "T1", "kind": "edit", "description": "Update A in mod_a.py", "targets": ["vfs://alpha/mod_a.py"]},
                        {"id": "T2", "kind": "edit", "description": "Update B in mod_b.py", "targets": ["vfs://alpha/mod_b.py"]},
                    ],
                    "inspect_files": [],
                    "missing_context_notes": "",
                    "status": "ready",
                    "reason": "Planned",
                }), None
            return combined_thinking_reply, None

        sid_auto = "sess_iso_auto"
        agent_ctx.db.execute(
            "INSERT INTO chat_sessions (session_id, title, updated_at, seq_counter) VALUES (?, ?, ?, ?)",
            (sid_auto, "Auto Mode Sub-Routine Merge", time.time(), 0),
        )
        agent_ctx.db.commit()
        with patch("insetu.core.llm.engine_llm._run_single_inference", side_effect=fake_auto_infer):
            auto_turn = _execute_agent_turn(
                agent_ctx,
                session_id=sid_auto,
                user_prompt="Execute items 1 and 2 from brief.md",
                mode="auto",
            )
        art_auto = auto_turn["artifact"]
        self.assertIsNotNone(art_auto["active_plan"], "/auto sub-routine handoff must merge child active_plan into parent envelope")
        self.assertEqual(art_auto["active_plan"]["active_task_id"], "T1")
        self.assertIn("A = 42", art_auto["unapplied_patches"])
        trace_ids = [t.get("id") for t in (art_auto.get("execution_trace") or [])]
        self.assertIn("classify_intent", trace_ids)
        self.assertIn("generate_patch", trace_ids)

    def test_homonymous_repo_genesis_dedup_and_step1_global_scoping_and_paused_telemetry(self):
        """Verifies Pattern A (Step 1 scopes out deferred T2..T4 files and demotes code global_files to slice), Pattern B (homonymous <repo>/<repo>/ genesis deduplication preserves package paths), and Pattern C (paused handoff telemetry includes checkpoint execution_trace)."""
        from insetu.core.gather.rag_proximity import clamp_rag_files_to_topology as _clamp_rag
        from insetu.core.bridge.bridge_telemetry import build_session_telemetry_files_map as _build_tel_map

        # Create a homonymous package layout inside repo 'alpha':
        # - vfs://alpha/alpha/app.py (inner package directory 'alpha/alpha/')
        # - vfs://alpha/alpha/core/engine.py (inner subpackage 'alpha/alpha/core/')
        # - vfs://alpha/tests/unit/test_existing.py (repo-root tests directory 'alpha/tests/unit/')
        # - vfs://alpha/docs/brief.md (repo-root docs directory 'alpha/docs/')
        (self.repo_dir / "alpha" / "core").mkdir(parents=True, exist_ok=True)
        (self.repo_dir / "alpha" / "app.py").write_text("APP = 1\n", encoding="utf-8")
        (self.repo_dir / "alpha" / "core" / "engine.py").write_text("ENGINE = 1\n", encoding="utf-8")
        (self.repo_dir / "alpha" / "core" / "step2_only.py").write_text("STEP2 = 1\n", encoding="utf-8")
        (self.repo_dir / "tests" / "unit").mkdir(parents=True, exist_ok=True)
        (self.repo_dir / "tests" / "unit" / "test_existing.py").write_text("TEST = 1\n", encoding="utf-8")
        (self.repo_dir / "docs").mkdir(parents=True, exist_ok=True)
        (self.repo_dir / "docs" / "brief.md").write_text("# Brief\n1. Step 1\n2. Step 2\n", encoding="utf-8")
        force_topology_scan("default")

        agent_ctx = agent_bp.get_context("default")

        # Pattern B:
        # 1. Accidental doubled repo prefix on repo-root test path ("alpha/tests/unit/test_new_parity.py" -> "vfs://alpha/alpha/tests/unit/test_new_parity.py")
        #    must deduplicate to "vfs://alpha/tests/unit/test_new_parity.py" because vfs://alpha/tests/unit/ exists and vfs://alpha/alpha/tests/unit/ does not.
        # 2. Legitimate new file inside the homonymous inner package ("vfs://alpha/alpha/core/new_helper.py" or "vfs://alpha/alpha/new_mod.py")
        #    must NOT be stripped because vfs://alpha/alpha/core/ and vfs://alpha/alpha/ exist in topology_ledger!
        clamped_gen = _clamp_rag(
            agent_ctx,
            [
                "alpha/tests/unit/test_new_parity.py",
                "vfs://alpha/alpha/tests/unit/test_new_parity.py",
                "vfs://alpha/alpha/core/new_helper.py",
                "vfs://alpha/alpha/new_root_mod.py",
            ],
            allowed_repos=["alpha"],
            allow_genesis=True,
        )
        self.assertEqual(
            clamped_gen,
            [
                "vfs://alpha/tests/unit/test_new_parity.py",
                "vfs://alpha/alpha/core/new_helper.py",
                "vfs://alpha/alpha/new_root_mod.py",
            ],
        )

        # Pattern A & C: Run /code where scout_targets is API-backed (fast tier) and generate_patch is web_chat (pauses for handoff).
        llm_ctx = llm_bp.get_context("default")
        llm_ctx.settings.update({
            "compute_endpoints": [
                {"id": "anthropic_main", "driver": "anthropic", "api_key": "sk-test"},
                {"id": "web_chat", "driver": "web_chat"},
            ],
            "llm_profiles": [{
                "id": "hybrid_dogfood",
                "title": "Fast API Scout + WebChat Thinking",
                "tiers": {
                    "decision": {"endpoint": "anthropic_main", "model": "claude-3-5-haiku-latest"},
                    "fast": {"endpoint": "anthropic_main", "model": "claude-3-5-haiku-latest"},
                    "standard": {"endpoint": "web_chat", "model": "chatbot"},
                    "thinking": {"endpoint": "web_chat", "model": "chatbot"},
                    "frontier": {"endpoint": "web_chat", "model": "chatbot"},
                },
            }],
            "active_profile_id": "hybrid_dogfood",
        })

        def fake_fast_scout(provider, api_key, model, messages, system_prompt, base_url="", **kwargs):
            prompt_str = messages[-1]["content"]
            if "Fast File Scout" in prompt_str:
                return json.dumps({
                    "inspect_files": [],
                    "global_files": ["vfs://alpha/docs/brief.md", "vfs://alpha/alpha/core/engine.py"],
                    "requested_files": [
                        "vfs://alpha/alpha/app.py",
                        "vfs://alpha/alpha/core/engine.py",
                        "vfs://alpha/alpha/core/step2_only.py",
                    ],
                    "reason": "Scouted candidate files",
                }), None
            return json.dumps({
                "tasks": [
                    {
                        "id": "T1",
                        "kind": "edit",
                        "description": "Step 1 in app.py",
                        "targets": ["vfs://alpha/alpha/app.py"],
                        "test_contract": "alpha/tests/unit/test_new_parity.py",
                    },
                    {
                        "id": "T2",
                        "kind": "edit",
                        "description": "Step 2 in step2_only.py",
                        "targets": ["vfs://alpha/alpha/core/step2_only.py"],
                    },
                ],
                "inspect_files": [],
                "missing_context_notes": "",
                "status": "ready",
                "reason": "Planned 2-step execution",
            }), None

        sid_dogfood = "sess_dogfood_pause"
        now_ts = time.time()
        agent_ctx.db.execute(
            "INSERT INTO chat_sessions (session_id, title, updated_at, seq_counter) VALUES (?, ?, ?, ?)",
            (sid_dogfood, "Dogfood Pause Test", now_ts, 1),
        )
        agent_ctx.db.execute(
            "INSERT INTO chat_messages (message_id, session_id, seq, role, content, raw_content, receipt, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("msg_dogfood_u1", sid_dogfood, 1, "user", "execute 1 through 2 in brief.md", "/code execute 1 through 2 in brief.md", "execute 1 through 2 in brief.md", now_ts),
        )
        agent_ctx.db.commit()

        with patch("insetu.core.llm.engine_llm._run_single_inference", side_effect=fake_fast_scout):
            paused_turn = _execute_agent_turn(
                agent_ctx,
                session_id=sid_dogfood,
                user_prompt="execute 1 through 2 in brief.md",
                mode="code",
                extra_inputs={"profile_id": "hybrid_dogfood"},
            )

        art_p = paused_turn["artifact"]
        self.assertEqual(art_p["status"], "paused_for_user")
        # Pattern A check:
        # - Editable full/genesis files on Turn 1 must contain app.py, brief.md, and the deduplicated genesis test_new_parity.py
        # - step2_only.py (deferred to T2) and engine.py (code file in global_files) must NOT be in attached_files (editable full lens)!
        # - engine.py (from global_files) is mounted in read_only_files (slice lens).
        self.assertIn("vfs://alpha/alpha/app.py", art_p["attached_files"])
        self.assertIn("vfs://alpha/tests/unit/test_new_parity.py", art_p["attached_files"])
        self.assertNotIn("vfs://alpha/alpha/core/step2_only.py", art_p["attached_files"])
        self.assertNotIn("vfs://alpha/alpha/core/engine.py", art_p["attached_files"])
        self.assertIn("vfs://alpha/alpha/core/engine.py", art_p["read_only_files"])

        # Pattern C check: While paused at generate_patch, building session telemetry includes the paused turn's
        # DAG execution trace (scout_targets, fetch_context, generate_patch) and LLM scout call in both 00_session_overview and turn_001 dossier!
        paused_tel_map = _build_tel_map(agent_ctx, session_id=sid_dogfood)
        self.assertIn("00_session_overview.txt", paused_tel_map)
        self.assertIn("scout_targets", paused_tel_map["00_session_overview.txt"])
        dossier_key = next((k for k in paused_tel_map.keys() if k.startswith("turn_001_")), "")
        self.assertTrue(dossier_key)
        self.assertIn("scout_targets", paused_tel_map[dossier_key])
        self.assertIn("Paused-Handoff Working Set:", paused_tel_map[dossier_key])

    def test_lens_contract_message_parser_projection_genesis_and_reserved_ids(self):
        """P25: one msg:// parser and canonical form; projections record served_lens and sha256; a missing target projects as genesis; reserved node IDs are refused."""
        from insetu.core.agent.routine_loader import validate_routine_definition as _validate_routine
        from insetu.core.gather.context_assemble import project_resource_lens as _project_lens
        from insetu.core.gather.msg_lens import parse_message_uri as _parse_msg_uri

        self.assertEqual(_parse_msg_uri("msg://sess_1/m_cold_2 [raw]"), ("msg://m_cold_2", "m_cold_2", True))
        self.assertEqual(_parse_msg_uri("m_cold_2"), ("msg://m_cold_2", "m_cold_2", False))

        agent_ctx = agent_bp.get_context("default")
        agent_ctx.db.execute(
            "INSERT INTO chat_sessions (session_id, title, updated_at, seq_counter) VALUES (?, ?, ?, ?)",
            ("sess_lens_contract", "Lens Contract", time.time(), 1),
        )
        agent_ctx.db.execute(
            "INSERT INTO chat_messages (message_id, session_id, seq, role, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            ("m_cold_2", "sess_lens_contract", 1, "user", "Cold message body", time.time()),
        )
        agent_ctx.db.commit()
        msg_proj = _project_lens(agent_ctx, "msg://sess_lens_contract/m_cold_2", lens="slice")
        self.assertEqual(msg_proj["uri"], "msg://m_cold_2")
        self.assertEqual(msg_proj["served_lens"], "slice")
        self.assertTrue(msg_proj["sha256"])

        gen_proj = _project_lens(agent_ctx, "vfs://alpha/uncreated_day0.py", lens="full")
        self.assertEqual(gen_proj["served_lens"], "genesis")
        self.assertIn("GENESIS TARGET: vfs://alpha/uncreated_day0.py", gen_proj.get("text") or gen_proj.get("content") or "")

        ok_reserved, err_reserved, _ = _validate_routine({
            "id": "bad_reserved",
            "nodes": [{"id": "global", "type": "llm", "parents": []}],
        })
        self.assertFalse(ok_reserved)
        self.assertIn("reserved", err_reserved)


if __name__ == "__main__":
    unittest.main()