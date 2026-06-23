import unittest
from unittest.mock import patch, MagicMock
import os
import sqlite3

# Import the module to be tested
from daemon.whatsapp_handler import sync_whatsapp_history

class TestWhatsAppHandlerSyncErrorRecovery(unittest.TestCase):

    @patch('daemon.whatsapp_handler.os.path.exists')
    @patch('daemon.whatsapp_handler.os.remove')
    @patch('builtins.print')
    def test_adb_failure(self, mock_print, mock_remove, mock_exists):
        """Test error recovery when an ADB command fails."""
        mock_exists.return_value = True # Ensure cleanup is attempted

        def run_cmd_mock(cmd):
            raise Exception("ADB Command Failed")

        mock_supabase = MagicMock()

        sync_whatsapp_history("test_device", run_cmd_mock, mock_supabase)

        mock_print.assert_any_call("⚠️ WhatsApp sync exception: ADB Command Failed")
        mock_remove.assert_called_once_with("daemon/msgstore_sync.db")

    @patch('daemon.whatsapp_handler.sqlite3.connect')
    @patch('daemon.whatsapp_handler.os.path.exists')
    @patch('daemon.whatsapp_handler.os.remove')
    @patch('builtins.print')
    def test_sqlite_connect_failure(self, mock_print, mock_remove, mock_exists, mock_sqlite_connect):
        """Test error recovery when SQLite connect fails or DB is locked."""
        mock_exists.return_value = True # Ensure cleanup is attempted
        mock_sqlite_connect.side_effect = sqlite3.Error("Database locked")

        mock_run_cmd = MagicMock()
        mock_supabase = MagicMock()

        sync_whatsapp_history("test_device", mock_run_cmd, mock_supabase)

        mock_print.assert_any_call("⚠️ WhatsApp sync exception: Database locked")
        mock_remove.assert_called_once_with("daemon/msgstore_sync.db")

    @patch('daemon.whatsapp_handler.sqlite3.connect')
    @patch('daemon.whatsapp_handler.os.path.exists')
    @patch('daemon.whatsapp_handler.os.remove')
    @patch('builtins.print')
    def test_supabase_upsert_failure(self, mock_print, mock_remove, mock_exists, mock_sqlite_connect):
        """Test error recovery when Supabase connection drops during upsert."""
        mock_exists.return_value = True

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_sqlite_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        dummy_row = {
            'key_id': '123',
            'user': '1234567890',
            'from_me': 1,
            'status': 1,
            'text_data': 'hello',
            'timestamp': 1600000000000,
            'message_type': 0
        }
        mock_cursor.fetchall.return_value = [dummy_row]

        mock_run_cmd = MagicMock()
        mock_supabase = MagicMock()

        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        mock_upsert = MagicMock()
        mock_table.upsert.return_value = mock_upsert
        mock_upsert.execute.side_effect = Exception("Network dropped")

        sync_whatsapp_history("test_device", mock_run_cmd, mock_supabase)

        mock_print.assert_any_call("⚠️ WhatsApp sync exception: Network dropped")
        mock_remove.assert_called_once_with("daemon/msgstore_sync.db")

    @patch('daemon.whatsapp_handler.sqlite3.connect')
    @patch('daemon.whatsapp_handler.os.path.exists')
    @patch('daemon.whatsapp_handler.os.remove')
    @patch('builtins.print')
    def test_cleanup_failure_handled_gracefully(self, mock_print, mock_remove, mock_exists, mock_sqlite_connect):
        """Test that if cleanup fails, it does not bubble up and crash the script."""
        mock_exists.return_value = True
        mock_remove.side_effect = Exception("Permission denied to remove file")

        def run_cmd_mock(cmd):
            raise Exception("Some failure")

        mock_supabase = MagicMock()

        try:
            sync_whatsapp_history("test_device", run_cmd_mock, mock_supabase)
        except Exception as e:
            self.fail(f"sync_whatsapp_history raised Exception unexpectedly: {e}")

        mock_remove.assert_called_once_with("daemon/msgstore_sync.db")

if __name__ == '__main__':
    unittest.main()
