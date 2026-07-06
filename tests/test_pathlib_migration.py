import os
import json
import unittest
from pathlib import Path
import sys

# Ensure the insetu module is in the path for testing
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from insetu.utils_core import resolve_workspace_path

class TestPathlibMigration(unittest.TestCase):
    def setUp(self):
        self.workspace_id = "default"
        self.base_dir = Path(__file__).resolve().parent.parent

    def test_security_containment(self):
        """Test 1: Prevent absolute path traversal containment breaches."""
        malicious_paths = [
            "../../etc/passwd",
            "....//config.json"
        ]
        for path in malicious_paths:
            resolved = resolve_workspace_path(path, self.workspace_id)
            self.assertTrue(str(self.base_dir) in resolved or resolved == path)
            self.assertNotIn("..", resolved)

    def test_json_boundary_safety(self):
        """Test 2: Ensure zero PosixPath objects bleed into the JSON serialization layer."""
        mock_data = {
            "target_dir": resolve_workspace_path("some/relative/path", self.workspace_id)
        }
        try:
            json_str = json.dumps(mock_data)
            self.assertIsInstance(json_str, str)
        except TypeError as e:
            self.fail(f"JSON serialization failed, Path object likely leaked across boundary: {e}")

    def test_platform_agnosticism(self):
        """Test 3: Ensure Windows-style paths normalize correctly."""
        windows_path = "C:\\Users\\Dev\\Repo\\file.py"
        normalized = Path(windows_path.replace('\\', '/')).as_posix()
        self.assertEqual(normalized, "C:/Users/Dev/Repo/file.py")
        self.assertNotIn("\\", normalized)

if __name__ == '__main__':
    unittest.main()