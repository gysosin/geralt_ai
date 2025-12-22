"""
Tests for Collection Service

Tests for services/collections/collection_service.py CollectionService class.
"""
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime


class TestCollectionService:
    """Test suite for CollectionService class."""
    
    @pytest.fixture
    def mock_collections(self):
        """Create mock database collections."""
        collections_db = MagicMock()
        documents_db = MagicMock()
        tokens_db = MagicMock()
        public_db = MagicMock()
        return collections_db, documents_db, tokens_db, public_db
    
    @pytest.fixture
    def collection_service(self, mock_collections):
        """Create a CollectionService with mocked dependencies."""
        collections_db, documents_db, tokens_db, public_db = mock_collections
        
        with patch('services.collections.collection_service.collection_collection', collections_db), \
             patch('services.collections.collection_service.document_collection', documents_db), \
             patch('services.collections.collection_service.tokens_collection', tokens_db), \
             patch('services.collections.collection_service.public_collection', public_db), \
             patch('services.collections.collection_service.invalidate_collections_cache'):
            from services.collections.collection_service import CollectionService
            service = CollectionService()
            service.db = collections_db
            service.documents_db = documents_db
            service.tokens_db = tokens_db
            service.public_db = public_db
            return service, mock_collections
    
    def test_create_success(self, collection_service):
        """Test successful collection creation."""
        service, (collections_db, _, _, _) = collection_service
        collections_db.find_one.return_value = None  # No duplicate
        collections_db.insert_one.return_value = MagicMock(inserted_id="test_id")
        
        result = service.create(
            identity="testuser@example.com",
            collection_name="Test Collection",
            tenant_id="tenant123"
        )
        
        assert result.success is True
        assert result.data["collection_id"] is not None
        assert result.data["message"] == "Collection created successfully"
    
    def test_create_duplicate_name(self, collection_service):
        """Test collection creation with duplicate name."""
        service, (collections_db, _, _, _) = collection_service
        collections_db.find_one.return_value = {"collection_id": "existing"}
        
        result = service.create(
            identity="testuser@example.com",
            collection_name="Test Collection",
            tenant_id="tenant123"
        )
        
        assert result.success is False
        assert "already exists" in result.error
    
    def test_create_missing_tenant_id(self, collection_service):
        """Test collection creation without tenant_id."""
        service, _ = collection_service
        
        result = service.create(
            identity="testuser@example.com",
            collection_name="Test Collection",
            tenant_id=""
        )
        
        assert result.success is False
        assert "Tenant ID is required" in result.error
    
    def test_create_missing_collection_name(self, collection_service):
        """Test collection creation without collection name."""
        service, _ = collection_service
        
        result = service.create(
            identity="testuser@example.com",
            collection_name="",
            tenant_id="tenant123"
        )
        
        assert result.success is False
        assert "Collection name is required" in result.error
    
    def test_list_collections(self, collection_service):
        """Test listing collections for a user."""
        service, (collections_db, documents_db, tokens_db, _) = collection_service
        
        # Mock user collections
        collections_db.find.return_value = [
            {
                "collection_id": "coll1",
                "name": "Collection 1",
                "created_by": "testuser",
                "created_at": "2024-01-01T00:00:00",
                "public": False,
            }
        ]
        
        # Mock document aggregation
        documents_db.aggregate.return_value = []
        
        # Mock bot count
        tokens_db.count_documents.return_value = 0
        
        result = service.list(
            identity="testuser@example.com",
            tenant_id="tenant123"
        )
        
        assert result.success is True
        assert isinstance(result.data, list)
    
    def test_delete_own_collection(self, collection_service):
        """Test deleting own collection."""
        service, (collections_db, _, _, _) = collection_service
        
        collections_db.find_one.return_value = {
            "collection_id": "coll1",
            "created_by": "testuser",
        }
        collections_db.delete_one.return_value = MagicMock(deleted_count=1)
        
        result = service.delete(
            identity="testuser@example.com",
            collection_id="coll1"
        )
        
        assert result.success is True
        assert "deleted" in result.data["message"].lower()
    
    def test_delete_shared_collection(self, collection_service):
        """Test removing access from shared collection."""
        service, (collections_db, _, _, _) = collection_service
        
        collections_db.find_one.return_value = {
            "collection_id": "coll1",
            "created_by": "otheruser",
            "shared_with": [{"username": "testuser", "role": "read-only"}]
        }
        collections_db.update_one.return_value = MagicMock(modified_count=1)
        
        result = service.delete(
            identity="testuser@example.com",
            collection_id="coll1"
        )
        
        assert result.success is True
        assert "removed access" in result.data["message"].lower()
    
    def test_delete_not_found(self, collection_service):
        """Test deleting non-existent collection."""
        service, (collections_db, _, _, _) = collection_service
        collections_db.find_one.return_value = None
        
        result = service.delete(
            identity="testuser@example.com",
            collection_id="nonexistent"
        )
        
        assert result.success is False
        assert result.status_code == 404
    
    def test_create_public_collection(self, collection_service):
        """Test creating public collection."""
        service, (_, _, _, public_db) = collection_service
        public_db.find_one.return_value = None  # No duplicate
        public_db.insert_one.return_value = MagicMock(inserted_id="pub_id")
        
        result = service.create_public(
            identity="admin@example.com",
            collection_name="Public Collection"
        )
        
        assert result.success is True
        assert "collection_id" in result.data
    
    def test_list_public_collections(self, collection_service):
        """Test listing public collections."""
        service, (_, _, _, public_db) = collection_service
        
        public_db.find.return_value = [
            {
                "collection_id": "pub1",
                "name": "Public Collection 1",
                "created_by": "admin",
                "created_at": "2024-01-01T00:00:00",
            }
        ]
        
        result = service.list_public(identity="testuser@example.com")
        
        assert result.success is True
        assert len(result.data) == 1


class TestServiceResult:
    """Test suite for ServiceResult class."""
    
    def test_ok_result(self):
        """Test creating successful result."""
        from services.collections import ServiceResult
        
        result = ServiceResult.ok({"key": "value"})
        
        assert result.success is True
        assert result.data == {"key": "value"}
        assert result.error is None
        assert result.status_code == 200
    
    def test_ok_result_custom_status(self):
        """Test creating successful result with custom status."""
        from services.collections import ServiceResult
        
        result = ServiceResult.ok({"key": "value"}, status_code=201)
        
        assert result.status_code == 201
    
    def test_fail_result(self):
        """Test creating failed result."""
        from services.collections import ServiceResult
        
        result = ServiceResult.fail("Something went wrong", 400)
        
        assert result.success is False
        assert result.error == "Something went wrong"
        assert result.status_code == 400
        assert result.data is None
    
    def test_fail_result_default_status(self):
        """Test creating failed result with default status."""
        from services.collections import ServiceResult
        
        result = ServiceResult.fail("Error")
        
        assert result.status_code == 400


class TestBaseService:
    """Test suite for BaseService class."""
    
    def test_extract_username_with_email(self):
        """Test extracting username from email."""
        from services.collections import BaseService
        
        username = BaseService.extract_username("user@example.com")
        assert username == "user"
    
    def test_extract_username_without_email(self):
        """Test extracting username from plain string."""
        from services.collections import BaseService
        
        username = BaseService.extract_username("plainuser")
        assert username == "plainuser"
    
    def test_extract_username_complex_email(self):
        """Test extracting username from complex email."""
        from services.collections import BaseService
        
        username = BaseService.extract_username("first.last@subdomain.example.com")
        assert username == "first.last"
