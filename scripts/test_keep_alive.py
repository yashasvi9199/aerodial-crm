import os
import tempfile
import unittest
from unittest import mock
from keep_alive import get_env_var

class TestGetEnvVar(unittest.TestCase):
    def setUp(self):
        # Create a temporary directory for our mock .env file
        self.test_dir = tempfile.TemporaryDirectory()
        self.mock_env_file = os.path.join(self.test_dir.name, ".env")

    def tearDown(self):
        self.test_dir.cleanup()

    @mock.patch.dict(os.environ, {"TEST_VAR": "env_value"})
    def test_var_in_os_environ(self):
        # Should return from os.environ, ignoring the fallback
        self.assertEqual(get_env_var("TEST_VAR", self.mock_env_file), "env_value")

    @mock.patch.dict(os.environ, {}, clear=True)
    def test_var_in_env_file(self):
        # Write to our mock .env file
        with open(self.mock_env_file, "w") as f:
            f.write("VITE_TEST_VAR=file_value\n")
            f.write("OTHER_VAR=other_value\n")

        self.assertEqual(get_env_var("TEST_VAR", self.mock_env_file), "file_value")

    @mock.patch.dict(os.environ, {}, clear=True)
    def test_var_not_in_env_file(self):
        # Write to our mock .env file
        with open(self.mock_env_file, "w") as f:
            f.write("VITE_OTHER_VAR=file_value\n")

        self.assertIsNone(get_env_var("TEST_VAR", self.mock_env_file))

    @mock.patch.dict(os.environ, {}, clear=True)
    def test_env_file_does_not_exist(self):
        # Pass a path that definitely doesn't exist
        non_existent_file = os.path.join(self.test_dir.name, "does_not_exist.env")
        self.assertIsNone(get_env_var("TEST_VAR", non_existent_file))

if __name__ == "__main__":
    unittest.main()
