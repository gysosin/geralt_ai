"""
Tests for Status Update Service

Tests for helpers/status_updates.py StatusUpdateService class.
"""
import pytest
from unittest.mock import MagicMock, patch


class TestStatusUpdateService:
    """Test suite for StatusUpdateService class."""
    
    @pytest.fixture
    def mock_socketio(self):
        """Create a mock SocketIO instance."""
        return MagicMock()
    
    @pytest.fixture
    def mock_document_collection(self):
        """Create a mock document collection."""
        mock = MagicMock()
        mock.update_one.return_value = MagicMock(modified_count=1)
        return mock
    
    @pytest.fixture
    def status_service(self, mock_socketio, mock_document_collection):
        """Create a StatusUpdateService with mocked dependencies."""
        with patch('helpers.status_updates.socketio', mock_socketio), \
             patch('helpers.status_updates.document_collection', mock_document_collection):
            from helpers.status_updates import StatusUpdateService
            service = StatusUpdateService()
            service._socketio = mock_socketio
            service._document_collection = mock_document_collection
            return service
    
    def test_emit_status_basic(self, status_service, mock_socketio):
        """Test basic status emission."""
        status_service.emit_status("doc123", "Processing", 50)
        
        mock_socketio.emit.assert_called_once()
        call_args = mock_socketio.emit.call_args
        assert call_args[0][0] == "processing_update"
        assert call_args[0][1]["document_id"] == "doc123"
        assert call_args[0][1]["status"] == "Processing"
        assert call_args[0][1]["progress"] == 50
    
    def test_emit_status_with_error(self, status_service, mock_socketio):
        """Test status emission with error."""
        status_service.emit_status("doc123", "Failed", 0, error="Something went wrong")
        
        call_args = mock_socketio.emit.call_args
        assert call_args[0][1]["error"] == "Something went wrong"
    
    def test_update_document_status_success(self, status_service, mock_document_collection):
        """Test successful document status update."""
        result = status_service.update_document_status("doc123", "Processing", 50)
        
        mock_document_collection.update_one.assert_called_once()
        call_args = mock_document_collection.update_one.call_args
        assert call_args[0][0] == {"_id": "doc123"}
        assert call_args[0][1]["$set"]["latest_status"] == "Processing"
        assert call_args[0][1]["$set"]["progress"] == 50
        assert result is True
    
    def test_update_document_status_with_error(self, status_service, mock_document_collection):
        """Test document status update with error message."""
        result = status_service.update_document_status(
            "doc123", "Failed", 0, error_message="Processing failed"
        )
        
        call_args = mock_document_collection.update_one.call_args
        update_data = call_args[0][1]["$set"]
        assert update_data["error_message"] == "Processing failed"
        assert update_data["status"] == "error"
        assert update_data["is_processing"] is False
    
    def test_update_document_status_failure(self, status_service, mock_document_collection):
        """Test document status update when no document is modified."""
        mock_document_collection.update_one.return_value = MagicMock(modified_count=0)
        
        result = status_service.update_document_status("doc123", "Processing", 50)
        assert result is False
    
    def test_update_and_emit(self, status_service, mock_socketio, mock_document_collection):
        """Test combined update and emit operation."""
        status_service.update_and_emit("doc123", "Processing", 50)
        
        mock_socketio.emit.assert_called_once()
        mock_document_collection.update_one.assert_called_once()
    
    def test_finalize_error(self, status_service, mock_socketio, mock_document_collection):
        """Test error finalization."""
        status_service.finalize_error("doc123", "Critical error", "Processing failed", 0)
        
        mock_socketio.emit.assert_called()
        # Should be called twice - once for status update, once for finalizing
        assert mock_document_collection.update_one.call_count == 2
    
    def test_complete_processing(self, status_service, mock_socketio, mock_document_collection):
        """Test processing completion."""
        status_service.complete_processing("doc123")
        
        mock_socketio.emit.assert_called_once()
        call_args = mock_socketio.emit.call_args
        assert call_args[0][1]["progress"] == 100
        
        # Should update with completed status
        assert mock_document_collection.update_one.call_count == 2
    
    def test_complete_processing_custom_message(self, status_service, mock_socketio):
        """Test processing completion with custom message."""
        status_service.complete_processing("doc123", status="Upload complete")
        
        call_args = mock_socketio.emit.call_args
        assert call_args[0][1]["status"] == "Upload complete"
    
    def test_singleton_instance(self):
        """Test that get_instance returns same object."""
        with patch('helpers.status_updates.socketio'), \
             patch('helpers.status_updates.document_collection'):
            from helpers.status_updates import StatusUpdateService
            
            # Reset singleton for test
            StatusUpdateService._instance = None
            
            instance1 = StatusUpdateService.get_instance()
            instance2 = StatusUpdateService.get_instance()
            
            assert instance1 is instance2


class TestBackwardsCompatibilityFunctions:
    """Test backwards compatible function exports."""
    
    @pytest.fixture
    def mock_service(self):
        """Mock the status service."""
        with patch('helpers.status_updates.get_status_service') as mock:
            service = MagicMock()
            mock.return_value = service
            yield service
    
    def test_emit_status_function(self, mock_service):
        """Test backwards compatible emit_status function."""
        from helpers.status_updates import emit_status
        
        emit_status("doc123", "Processing", 50)
        mock_service.emit_status.assert_called_once_with("doc123", "Processing", 50, None)
    
    def test_update_document_status_function(self, mock_service):
        """Test backwards compatible update_document_status function."""
        from helpers.status_updates import update_document_status
        
        update_document_status("doc123", "Processing", 50)
        mock_service.update_document_status.assert_called_once_with(
            "doc123", "Processing", 50, None
        )
    
    def test_finalize_error_function(self, mock_service):
        """Test backwards compatible _finalize_error function."""
        from helpers.status_updates import _finalize_error
        
        _finalize_error("doc123", "Error msg", "Failed", 0)
        mock_service.finalize_error.assert_called_once_with(
            "doc123", "Error msg", "Failed", 0
        )
