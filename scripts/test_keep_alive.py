import unittest
from unittest.mock import patch, mock_open
import os
import sys

# Ensure scripts directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import keep_alive

class TestGetEnvVar(unittest.TestCase):
    @patch.dict(os.environ, {"TEST_ENV_VAR": "test_value"}, clear=True)
    def test_get_env_var_from_os(self):
        """Test retrieving variable directly from os.environ"""
        self.assertEqual(keep_alive.get_env_var("TEST_ENV_VAR"), "test_value")

    @patch.dict(os.environ, {}, clear=True)
    @patch("os.path.exists", return_value=True)
    @patch("builtins.open", new_callable=mock_open, read_data="VITE_TEST_ENV_VAR=file_test_value\n")
    def test_get_env_var_from_file(self, mock_file, mock_exists):
        """Test retrieving variable from a mock .env file"""
        self.assertEqual(keep_alive.get_env_var("TEST_ENV_VAR", "mock/.env"), "file_test_value")
        mock_exists.assert_called_once_with("mock/.env")
        mock_file.assert_called_once_with("mock/.env", "r")

    @patch.dict(os.environ, {}, clear=True)
    @patch("os.path.exists", return_value=False)
    def test_get_env_var_missing(self, mock_exists):
        """Test retrieving variable when it is missing from both os.environ and file"""
        self.assertIsNone(keep_alive.get_env_var("MISSING_VAR", "mock/.env"))
        mock_exists.assert_called_once_with("mock/.env")

class TestMain(unittest.TestCase):
    @patch("keep_alive.create_client")
    @patch("urllib.request.urlopen")
    @patch("builtins.open", new_callable=mock_open)
    @patch("keep_alive.get_env_var")
    @patch.dict(os.environ, {
        "CLOUDFLARE_URL": "https://test.pages.dev",
        "GITHUB_REPOSITORY": "test/repo"
    }, clear=True)
    def test_main_happy_path(self, mock_get_env_var, mock_file, mock_urlopen, mock_create_client):
        """Test the main function with successful pings and environment variables"""
        # Mock get_env_var to return valid supabase credentials
        mock_get_env_var.side_effect = lambda key: "test_url" if key == "SUPABASE_URL" else "test_key"

        # Mock the context manager for urllib.request.urlopen
        mock_response = mock_urlopen.return_value.__enter__.return_value
        mock_response.status = 200

        # Execute main
        keep_alive.main()

        # Supabase assertions
        mock_create_client.assert_called_once_with("test_url", "test_key")

        # Cloudflare and GitHub assertions
        self.assertEqual(mock_urlopen.call_count, 2)

        # File assertions
        mock_file.assert_called_once_with("scripts/last_ping.txt", "w")
        mock_file().write.assert_called_once()
        self.assertTrue(mock_file().write.call_args[0][0].startswith("Last Keep-Alive Ping:"))

    @patch("keep_alive.create_client")
    @patch("urllib.request.urlopen")
    @patch("keep_alive.get_env_var")
    @patch.dict(os.environ, {}, clear=True)
    @patch("builtins.open", new_callable=mock_open)
    def test_main_conditional_skips_and_defaults(self, mock_file, mock_get_env_var, mock_urlopen, mock_create_client):
        """Test the main function with missing optional environment variables"""
        # Mock get_env_var to return None for supabase credentials
        mock_get_env_var.return_value = None

        # Mock the context manager for urllib.request.urlopen
        mock_response = mock_urlopen.return_value.__enter__.return_value
        mock_response.status = 200

        # Execute main
        keep_alive.main()

        # Supabase assertions - should be skipped
        mock_create_client.assert_not_called()

        # Cloudflare assertions - should use default URL
        self.assertEqual(mock_urlopen.call_count, 1) # Only CF called, no GitHub
        cf_request = mock_urlopen.call_args[0][0]
        self.assertEqual(cf_request.full_url, "https://aerodial.pages.dev")

        # File assertions
        mock_file.assert_called_once()

    @patch("keep_alive.create_client")
    @patch("urllib.request.urlopen")
    @patch("keep_alive.get_env_var")
    @patch.dict(os.environ, {"CLOUDFLARE_URL": "https://test.pages.dev"}, clear=True)
    @patch("builtins.open", new_callable=mock_open)
    def test_main_error_handling(self, mock_file, mock_get_env_var, mock_urlopen, mock_create_client):
        """Test the main function's error handling by raising exceptions"""
        # Mock get_env_var to return valid supabase credentials
        mock_get_env_var.return_value = "test_val"

        # Make supabase client raise an exception
        mock_supabase = mock_create_client.return_value
        mock_supabase.table().select().eq().execute.side_effect = Exception("Supabase Error")

        # Make urlopen raise an exception
        mock_urlopen.side_effect = Exception("Network Error")

        # Make file writing raise an exception
        mock_file.side_effect = Exception("File Error")

        # Execute main - should not raise unhandled exceptions
        keep_alive.main()

if __name__ == "__main__":
    unittest.main()
