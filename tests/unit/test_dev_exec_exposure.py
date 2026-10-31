"""dev.exec runs real shell commands now, so it stays a person's tool: hidden from MCP and banned in routines (until S5)."""
import unittest
from unittest.mock import patch

from insetu.core.agent import orchestrator
from insetu.core.mcp import engine_mcp
from insetu.core.sdk import get_registered_capabilities
import insetu.extensions.dev.engine_dev  # noqa: F401  (registers dev.exec)

CAPABILITY = "dev.exec"


class TestDevExecExposure(unittest.TestCase):
    """MCP neither lists nor calls dev.exec, and routines cannot use it."""

    def test_hidden_from_mcp(self):
        spec = get_registered_capabilities().get(CAPABILITY)
        self.assertIsNotNone(spec, f"{CAPABILITY} is not registered")
        self.assertIs(spec.get("mcp_expose"), False)
        ctx = type("Ctx", (), {"workspace_id": "default"})()
        with patch.object(engine_mcp, "list_available_routines", return_value=[]):
            names = {t["name"] for t in engine_mcp._build_mcp_tools_list(ctx)}
        self.assertNotIn(CAPABILITY, names)
        reply = engine_mcp.handle_mcp_jsonrpc(ctx, {
            "jsonrpc": "2.0", "id": 1, "method": "tools/call",
            "params": {"name": CAPABILITY, "arguments": {"command": "id"}},
        })
        self.assertEqual(reply["error"]["code"], -32601)

    def test_banned_in_routines(self):
        self.assertIn(CAPABILITY, orchestrator.ROUTINE_BANNED_CAPABILITIES)


if __name__ == "__main__":
    unittest.main()
