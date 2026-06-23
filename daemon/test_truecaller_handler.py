import unittest
from unittest.mock import MagicMock, patch
import os

from truecaller_handler import handle_truecaller_json

class TestTruecallerHandler(unittest.TestCase):

    def setUp(self):
        self.device = "test_device"
        self.data = {"phone": "9876543210"}
        self.mock_run_cmd = MagicMock()
        self.mock_supabase = MagicMock()

    @patch('truecaller_handler.datetime')
    def test_adb_run_cmd_exception(self, mock_datetime):
        mock_datetime.datetime.now.return_value.astimezone.return_value.isoformat.return_value = "2023-01-01T00:00:00Z"
        self.mock_run_cmd.side_effect = Exception("ADB failed")

        # We need to make os.path.exists return False to avoid os.remove exception in finally
        with patch('truecaller_handler.os.path.exists', return_value=False):
            handle_truecaller_json(self.device, self.data, self.mock_run_cmd, self.mock_supabase)

        self.mock_run_cmd.assert_called()
        self.mock_supabase.table.assert_called_with('truecaller_cache')
        self.mock_supabase.table().upsert.assert_called()
        args, _ = self.mock_supabase.table().upsert.call_args
        self.assertEqual(args[0]['name'], 'Not Found')
        self.assertEqual(args[0]['phone_number'], '+919876543210')

    @patch('truecaller_handler.sqlite3.connect')
    @patch('truecaller_handler.os.path.exists')
    @patch('truecaller_handler.os.remove')
    def test_sqlite3_connect_exception(self, mock_remove, mock_exists, mock_connect):
        self.mock_run_cmd.return_value = None
        # Make os.path.exists return True so it enters the sqlite connection block and finally os.remove
        mock_exists.return_value = True
        mock_connect.side_effect = Exception("SQLite connect failed")

        handle_truecaller_json(self.device, self.data, self.mock_run_cmd, self.mock_supabase)

        mock_connect.assert_called_once_with("daemon/tc_sync.db")
        mock_remove.assert_called_once_with("daemon/tc_sync.db")

        self.mock_supabase.table.assert_called_with('truecaller_cache')
        self.mock_supabase.table().upsert.assert_called()
        args, _ = self.mock_supabase.table().upsert.call_args
        self.assertEqual(args[0]['name'], 'Not Found')

    @patch('truecaller_handler.sqlite3.connect')
    @patch('truecaller_handler.os.path.exists')
    @patch('truecaller_handler.os.remove')
    def test_os_remove_exception(self, mock_remove, mock_exists, mock_connect):
        self.mock_run_cmd.return_value = None
        mock_exists.return_value = True
        # SQLite passes
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        mock_remove.side_effect = Exception("OS Remove Failed")

        handle_truecaller_json(self.device, self.data, self.mock_run_cmd, self.mock_supabase)

        mock_remove.assert_called_once_with("daemon/tc_sync.db")

        self.mock_supabase.table.assert_called_with('truecaller_cache')
        self.mock_supabase.table().upsert.assert_called()
        args, _ = self.mock_supabase.table().upsert.call_args
        self.assertEqual(args[0]['name'], 'Not Found')

    @patch('truecaller_handler.os.path.exists')
    def test_supabase_upsert_exception(self, mock_exists):
        self.mock_run_cmd.return_value = None
        mock_exists.return_value = False

        # Supabase raises Exception
        self.mock_supabase.table().upsert().execute.side_effect = Exception("Supabase error")

        # This should not raise any unhandled exceptions
        try:
            handle_truecaller_json(self.device, self.data, self.mock_run_cmd, self.mock_supabase)
        except Exception as e:
            self.fail(f"handle_truecaller_json raised an exception: {e}")

        self.mock_supabase.table.assert_called_with('truecaller_cache')

if __name__ == '__main__':
    unittest.main()
