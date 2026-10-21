import os
import sys
import unittest
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from akasa.uri import AkasaURI
from akasa.vfs import (
    InterWorkspaceVFSDriver,
    set_mount_authorizer,
    execute_vfs_save,
    execute_vfs_delete,
    execute_vfs_move,
    execute_vfs_bulk,
)
from insetu.core.system.engine_system import _authorize_inter_workspace_mount
from insetu.core.topology.engine_topology import broadcast_cross_workspace_mutations


class TestWorkspaceMounts(unittest.TestCase):
    def setUp(self):
        set_mount_authorizer(_authorize_inter_workspace_mount)
        self.driver = InterWorkspaceVFSDriver()
        self.temp_dir = tempfile.TemporaryDirectory()
        self.base_path = Path(self.temp_dir.name)

        # Setup mock tenant physical control directories
        self.hub_data = self.base_path / "hub" / "data" / "prompts"
        self.hub_data.mkdir(parents=True, exist_ok=True)
        self.sample_prompt = self.hub_data / "architect.md"
        self.sample_prompt.write_text("# Software Architect Prompt\n", encoding="utf-8")

        self.app_data = self.base_path / "app" / "data" / "prompts"
        self.app_data.mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        self.temp_dir.cleanup()

    @patch("akasa.vfs.get_all_workspace_ids")
    @patch("akasa.vfs.get_tenant_control_dir")
    @patch("insetu.core.system.engine_system.SettingsManager")
    def test_unauthorized_subscriber_rejected(self, mock_settings_mgr, mock_control_dir, mock_all_ws):
        """Subscriber that has not declared shared_mounts cannot resolve target workspace assets."""
        mock_all_ws.return_value = ["hub", "app"]
        mock_control_dir.side_effect = lambda ws: (self.base_path / ws).as_posix()

        sub_settings = MagicMock()
        sub_settings.get.side_effect = lambda k, default=None: [] if k == "shared_mounts" else default

        pub_settings = MagicMock()
        pub_settings.get.side_effect = lambda k, default=None: {"prompts": {"allowed": ["*"]}} if k == "export_shared_domains" else default

        mock_settings_mgr.side_effect = lambda ext, ws: sub_settings if ws == "app" else pub_settings

        uri = AkasaURI("ws://hub/prompts/architect.md")
        resolved = self.driver.resolve(uri, workspace_id="app")
        self.assertIsNone(resolved)

    @patch("akasa.vfs.get_all_workspace_ids")
    @patch("akasa.vfs.get_tenant_control_dir")
    @patch("insetu.core.system.engine_system.SettingsManager")
    def test_unexported_domain_rejected(self, mock_settings_mgr, mock_control_dir, mock_all_ws):
        """Subscriber mounting an unexported domain cannot resolve target assets."""
        mock_all_ws.return_value = ["hub", "app"]
        mock_control_dir.side_effect = lambda ws: (self.base_path / ws).as_posix()

        sub_settings = MagicMock()
        sub_settings.get.side_effect = lambda k, default=None: [{"workspace_id": "hub", "domain": "prompts"}] if k == "shared_mounts" else default

        pub_settings = MagicMock()
        pub_settings.get.side_effect = lambda k, default=None: {} if k == "export_shared_domains" else default

        mock_settings_mgr.side_effect = lambda ext, ws: sub_settings if ws == "app" else pub_settings

        uri = AkasaURI("ws://hub/prompts/architect.md")
        resolved = self.driver.resolve(uri, workspace_id="app")
        self.assertIsNone(resolved)

    @patch("akasa.vfs.get_all_workspace_ids")
    @patch("akasa.vfs.get_tenant_control_dir")
    @patch("insetu.core.system.engine_system.SettingsManager")
    def test_restricted_subscriber_denied(self, mock_settings_mgr, mock_control_dir, mock_all_ws):
        """Publisher restricting export to specific workspace IDs denies unlisted subscribers."""
        mock_all_ws.return_value = ["hub", "app", "other_tenant"]
        mock_control_dir.side_effect = lambda ws: (self.base_path / ws).as_posix()

        sub_settings = MagicMock()
        sub_settings.get.side_effect = lambda k, default=None: [{"workspace_id": "hub", "domain": "prompts"}] if k == "shared_mounts" else default

        pub_settings = MagicMock()
        pub_settings.get.side_effect = lambda k, default=None: {"prompts": {"allowed": ["other_tenant"]}} if k == "export_shared_domains" else default

        mock_settings_mgr.side_effect = lambda ext, ws: sub_settings if ws == "app" else pub_settings

        uri = AkasaURI("ws://hub/prompts/architect.md")
        resolved = self.driver.resolve(uri, workspace_id="app")
        self.assertIsNone(resolved)

    @patch("akasa.vfs.get_all_workspace_ids")
    @patch("akasa.vfs.get_tenant_control_dir")
    @patch("insetu.core.system.engine_system.SettingsManager")
    def test_authorized_handshake_resolves_path(self, mock_settings_mgr, mock_control_dir, mock_all_ws):
        """Mutually declared handshake resolves physical asset path."""
        mock_all_ws.return_value = ["hub", "app"]
        mock_control_dir.side_effect = lambda ws: (self.base_path / ws).as_posix()

        sub_settings = MagicMock()
        sub_settings.get.side_effect = lambda k, default=None: [{"workspace_id": "hub", "domain": "prompts"}] if k == "shared_mounts" else default

        pub_settings = MagicMock()
        pub_settings.get.side_effect = lambda k, default=None: {"prompts": {"allowed": ["app"]}} if k == "export_shared_domains" else default

        mock_settings_mgr.side_effect = lambda ext, ws: sub_settings if ws == "app" else pub_settings

        uri = AkasaURI("ws://hub/prompts/architect.md")
        resolved = self.driver.resolve(uri, workspace_id="app")
        self.assertIsNotNone(resolved)
        self.assertEqual(Path(resolved).resolve(), self.sample_prompt.resolve())

    @patch("akasa.vfs.get_all_workspace_ids")
    @patch("akasa.vfs.get_tenant_control_dir")
    @patch("insetu.core.system.engine_system.SettingsManager")
    def test_directory_traversal_containment(self, mock_settings_mgr, mock_control_dir, mock_all_ws):
        """Traversal attempts escaping data and workspace roots return None."""
        mock_all_ws.return_value = ["hub", "app"]
        mock_control_dir.side_effect = lambda ws: (self.base_path / ws).as_posix()

        sub_settings = MagicMock()
        sub_settings.get.side_effect = lambda k, default=None: [{"workspace_id": "hub", "domain": "prompts"}] if k == "shared_mounts" else default

        pub_settings = MagicMock()
        pub_settings.get.side_effect = lambda k, default=None: {"prompts": {"allowed": ["*"]}} if k == "export_shared_domains" else default

        mock_settings_mgr.side_effect = lambda ext, ws: sub_settings if ws == "app" else pub_settings

        uri = AkasaURI("ws://hub/prompts/../../../../etc/passwd")
        resolved = self.driver.resolve(uri, workspace_id="app")
        self.assertIsNone(resolved)

    def test_vfs_write_barriers(self):
        """Mutations on ws:// virtual mount paths are rejected by VFS barriers."""
        res_save = execute_vfs_save("app", "ws://hub/prompts/architect.md", "# Modified\n")
        self.assertEqual(res_save.get("status"), "error")

        res_del, code_del = execute_vfs_delete("app", "ws://hub/prompts/architect.md")
        self.assertEqual(code_del, 403)

        res_move, code_move = execute_vfs_move("app", "ws://hub/prompts/architect.md", "vfs://app/local.md")
        self.assertEqual(code_move, 403)

        res_bulk, code_bulk = execute_vfs_bulk("app", [
            {"action": "delete", "filepath": "ws://hub/prompts/architect.md"},
            {"action": "delete", "filepath": "vfs://app/notes.md"}
        ])
        self.assertEqual(len(res_bulk.get("operations", [])), 1)
        self.assertEqual(res_bulk["operations"][0]["filepath"], "vfs://app/notes.md")
    @patch("akasa.hooks.hooks.emit_background")
    @patch("insetu.core.topology.engine_topology.get_all_workspace_ids")
    @patch("insetu.core.topology.engine_topology.SettingsManager")
    def test_cross_workspace_event_broadcasting(self, mock_settings_mgr, mock_all_ws, mock_emit_bg):
        """Mutations on exported ctx:// domains broadcast virtual ws:// events to subscribed workspaces."""
        mock_all_ws.return_value = ["hub", "app"]

        pub_settings = MagicMock()
        pub_settings.get.side_effect = lambda k, default=None: {"prompts": {"allowed": ["app"]}} if k == "export_shared_domains" else default

        sub_settings = MagicMock()
        sub_settings.get.side_effect = lambda k, default=None: [{"workspace_id": "hub", "domain": "prompts"}] if k == "shared_mounts" else default

        mock_settings_mgr.side_effect = lambda ext, ws: pub_settings if ws == "hub" else sub_settings

        mutations = [{"filepath": "ctx://prompts/architect.md", "operation": "save"}]
        broadcast_cross_workspace_mutations(mutations=mutations, workspace_id="hub")

        mock_emit_bg.assert_called_once()
        _, kwargs = mock_emit_bg.call_args
        self.assertEqual(kwargs.get("workspace_id"), "app")
        emitted_mutations = kwargs.get("mutations", [])
        self.assertEqual(len(emitted_mutations), 1)
        self.assertEqual(emitted_mutations[0]["filepath"], "ws://hub/prompts/architect.md")

    @patch("akasa.hooks.hooks.emit_background")
    def test_reentrancy_guard_blocks_ws_echoes(self, mock_emit_bg):
        """Synthetic ws:// mutations are not re-broadcast to prevent recursive event loops."""
        mutations = [{"filepath": "ws://hub/prompts/architect.md", "operation": "save"}]
        broadcast_cross_workspace_mutations(mutations=mutations, workspace_id="app")
        mock_emit_bg.assert_not_called()


if __name__ == "__main__":
    unittest.main()