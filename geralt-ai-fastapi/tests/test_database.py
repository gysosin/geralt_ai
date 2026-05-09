"""
Tests for Database Models

Tests for models/database.py DatabaseManager, DocumentDatabase, and BotDatabase classes.
"""
import pytest
from unittest.mock import MagicMock, patch


class TestDatabaseManager:
    """Test suite for DatabaseManager class."""
    
    @pytest.fixture
    def mock_mongo_client(self):
        """Create a mock MongoDB client."""
        mock = MagicMock()
        mock.admin.command.return_value = {"ok": 1}
        mock.server_info.return_value = {"version": "4.4.0"}
        return mock
    
    @pytest.fixture
    def db_manager(self, mock_mongo_client):
        """Create a DatabaseManager with mocked client."""
        with patch('models.database.MongoClient', return_value=mock_mongo_client):
            from models.database import DatabaseManager
            # Reset singleton for test
            DatabaseManager._instance = None
            manager = DatabaseManager()
            manager._client = mock_mongo_client
            return manager
    
    def test_client_property(self, db_manager, mock_mongo_client):
        """Test that client property returns the MongoDB client."""
        assert db_manager.client is mock_mongo_client

    def test_client_uses_configured_server_selection_timeout(self, mock_mongo_client):
        """Test MongoDB client fails fast when the server is unavailable."""
        with patch('models.database.MongoClient', return_value=mock_mongo_client) as mongo_client:
            from config import Config
            from models.database import DatabaseManager

            DatabaseManager._instance = None
            DatabaseManager()

            assert mongo_client.call_args.kwargs["serverSelectionTimeoutMS"] == (
                Config.MONGO_SERVER_SELECTION_TIMEOUT_MS
            )
    
    def test_get_database(self, db_manager, mock_mongo_client):
        """Test getting a database by name."""
        mock_db = MagicMock()
        mock_mongo_client.__getitem__.return_value = mock_db
        
        result = db_manager.get_database("test_db")
        mock_mongo_client.__getitem__.assert_called_with("test_db")
    
    def test_get_collection(self, db_manager, mock_mongo_client):
        """Test getting a collection."""
        mock_collection = MagicMock()
        mock_db = MagicMock()
        mock_db.__getitem__.return_value = mock_collection
        mock_mongo_client.__getitem__.return_value = mock_db
        
        result = db_manager.get_collection("test_collection", "test_db")
        mock_mongo_client.__getitem__.assert_called_with("test_db")
    
    def test_ping_success(self, db_manager, mock_mongo_client):
        """Test successful ping."""
        mock_mongo_client.admin.command.return_value = {"ok": 1}
        
        result = db_manager.ping()
        assert result is True
        mock_mongo_client.admin.command.assert_called_with("ping")
    
    def test_ping_failure(self, db_manager, mock_mongo_client):
        """Test ping failure."""
        mock_mongo_client.admin.command.side_effect = Exception("Connection failed")
        
        result = db_manager.ping()
        assert result is False
    
    def test_get_server_info_success(self, db_manager, mock_mongo_client):
        """Test getting server info."""
        mock_info = {"version": "4.4.0", "gitVersion": "abc123"}
        mock_mongo_client.server_info.return_value = mock_info
        
        result = db_manager.get_server_info()
        assert result == mock_info
    
    def test_get_server_info_failure(self, db_manager, mock_mongo_client):
        """Test server info failure."""
        mock_mongo_client.server_info.side_effect = Exception("Error")
        
        result = db_manager.get_server_info()
        assert result == {}
    
    def test_close(self, db_manager, mock_mongo_client):
        """Test closing connection."""
        db_manager.close()
        mock_mongo_client.close.assert_called_once()
    
    def test_singleton_instance(self, mock_mongo_client):
        """Test that get_instance returns same object."""
        with patch('models.database.MongoClient', return_value=mock_mongo_client):
            from models.database import DatabaseManager
            # Reset singleton for test
            DatabaseManager._instance = None
            
            instance1 = DatabaseManager.get_instance()
            instance2 = DatabaseManager.get_instance()
            
            assert instance1 is instance2


class TestDocumentDatabase:
    """Test suite for DocumentDatabase class."""
    
    @pytest.fixture
    def mock_db_manager(self):
        """Create a mock DatabaseManager."""
        mock = MagicMock()
        mock_db = MagicMock()
        mock.get_database.return_value = mock_db
        return mock, mock_db
    
    @pytest.fixture
    def doc_db(self, mock_db_manager):
        """Create a DocumentDatabase with mocked manager."""
        mock_manager, mock_db = mock_db_manager
        
        with patch('models.database.DatabaseManager.get_instance', return_value=mock_manager):
            from models.database import DocumentDatabase
            # Reset singleton for test
            DocumentDatabase._instance = None
            db = DocumentDatabase()
            db._db = mock_db
            return db, mock_db
    
    def test_embeddings_property(self, doc_db):
        """Test embeddings collection access."""
        db, mock_db = doc_db
        mock_collection = MagicMock()
        mock_db.embeddings = mock_collection
        
        assert db.embeddings is mock_collection
    
    def test_public_embeddings_property(self, doc_db):
        """Test public_embeddings collection access."""
        db, mock_db = doc_db
        mock_collection = MagicMock()
        mock_db.public_embeddings = mock_collection
        
        assert db.public_embeddings is mock_collection
    
    def test_collections_property(self, doc_db):
        """Test collections collection access."""
        db, mock_db = doc_db
        mock_collection = MagicMock()
        mock_db.collections = mock_collection
        
        assert db.collections is mock_collection
    
    def test_documents_property(self, doc_db):
        """Test documents collection access."""
        db, mock_db = doc_db
        mock_collection = MagicMock()
        mock_db.documents = mock_collection
        
        assert db.documents is mock_collection
    
    def test_conversations_property(self, doc_db):
        """Test conversations collection access."""
        db, mock_db = doc_db
        mock_collection = MagicMock()
        mock_db.conversations = mock_collection
        
        assert db.conversations is mock_collection


class TestBotDatabase:
    """Test suite for BotDatabase class."""
    
    @pytest.fixture
    def mock_db_manager(self):
        """Create a mock DatabaseManager."""
        mock = MagicMock()
        mock_db = MagicMock()
        mock.get_database.return_value = mock_db
        return mock, mock_db
    
    @pytest.fixture
    def bot_db(self, mock_db_manager):
        """Create a BotDatabase with mocked manager."""
        mock_manager, mock_db = mock_db_manager
        
        with patch('models.database.DatabaseManager.get_instance', return_value=mock_manager):
            from models.database import BotDatabase
            # Reset singleton for test
            BotDatabase._instance = None
            db = BotDatabase()
            db._db = mock_db
            return db, mock_db
    
    def test_tokens_property(self, bot_db):
        """Test tokens collection access."""
        db, mock_db = bot_db
        mock_collection = MagicMock()
        mock_db.tokens = mock_collection
        
        assert db.tokens is mock_collection
    
    def test_embed_codes_property(self, bot_db):
        """Test embed_codes collection access."""
        db, mock_db = bot_db
        mock_collection = MagicMock()
        mock_db.embed_codes = mock_collection
        
        assert db.embed_codes is mock_collection
    
    def test_templates_property(self, bot_db):
        """Test templates collection access."""
        db, mock_db = bot_db
        mock_collection = MagicMock()
        mock_db.templates = mock_collection
        
        assert db.templates is mock_collection
    
    def test_quizzes_property(self, bot_db):
        """Test quizzes collection access."""
        db, mock_db = bot_db
        mock_collection = MagicMock()
        mock_db.quizzes = mock_collection
        
        assert db.quizzes is mock_collection
    
    def test_quiz_attempts_property(self, bot_db):
        """Test quiz_attempts collection access."""
        db, mock_db = bot_db
        mock_collection = MagicMock()
        mock_db.quiz_attempts = mock_collection
        
        assert db.quiz_attempts is mock_collection


class TestBackwardsCompatibility:
    """Test backwards compatible exports."""
    
    def test_mongo_client_exported(self):
        """Test that mongo_client is exported for backwards compatibility."""
        with patch('models.database.MongoClient'):
            from models.database import mongo_client
            # Should not raise ImportError
    
    def test_collection_collections_exported(self):
        """Test that collection objects are exported."""
        with patch('models.database.MongoClient'):
            from models.database import (
                embedding_collection,
                public_embedding_collection,
                collection_collection,
                document_collection,
                conversation_collection,
            )
            # Should not raise ImportError
    
    def test_bot_collections_exported(self):
        """Test that bot collection objects are exported."""
        with patch('models.database.MongoClient'):
            from models.database import (
                tokens_collection,
                embed_code_collection,
                templates_collection,
                quiz_collection,
            )
            # Should not raise ImportError
