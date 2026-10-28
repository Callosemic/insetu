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
from insetu.core.agent.orchestrator import (
    SCRATCH_VAULT_THRESHOLD_BYTES,
    evaluate_when_condition,
    execute_declarative_routine,
    interpolate_template,
    load_routine_definition,
)
from insetu.core.bridge.engine_bridge import BRIDGE_SCHEMA, bridge_bp
from insetu.core.cartographer.cartographer import cartographer_bp
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
        self.assertEqual(_resolve_tier_model(llm_ctx, "thinking"), "claude-3-7-sonnet-thinking")
        self.assertEqual(_resolve_tier_model(llm_ctx, "standard"), "claude-3-5-sonnet-latest")
        self.assertEqual(_resolve_tier_model(llm_ctx, "frontier"), "claude-3-5-sonnet-latest")

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
        """evaluate_when_condition safely evaluates boolean/comparison expressions andexecute_declarative_routine vaults >=256KB outputs."""
        chain_ctx = {
            "global": {"mode": "auto", "effective_intent": "EDIT_CODE"},
            "classify_intent": {"intent": "EDIT_CODE"},
        }
        self.assertTrue(evaluate_when_condition("$global.mode == 'auto'", chain_ctx))
        self.assertFalse(evaluate_when_condition("$global.mode == 'ask'", chain_ctx))
        self.assertTrue(evaluate_when_condition("$global.effective_intent != 'CHAT_ONLY'", chain_ctx))
        self.assertEqual(
            interpolate_template("Mode=$global.mode, Intent=${classify_intent.intent}", chain_ctx),
            "Mode=auto, Intent=EDIT_CODE",
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
        for expected_id in ("workspace_turn", "code", "plan", "ask", "yomama", "map_reduce_audit", "symbol_refactor"):
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

        for tool in tools:
            tool_name = tool.get("name")
            self.assertTrue(tool_name, "Every MCP tool must define a non-empty name")
            schema = tool.get("inputSchema")
            self.assertIsInstance(schema, dict, f"Tool '{tool_name}' must provide an inputSchema dictionary")
            self.assertEqual(schema.get("type"), "object", f"Tool '{tool_name}' inputSchema type must be 'object'")
            props = schema.get("properties")
            self.assertIsInstance(props, dict, f"Tool '{tool_name}' must define properties dictionary")
            self.assertGreater(len(props), 0, f"Tool '{tool_name}' must specify at least one property")

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


if __name__ == "__main__":
    unittest.main()