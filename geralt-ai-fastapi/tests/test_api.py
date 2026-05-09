"""
Tests for API Endpoints

Tests for FastAPI endpoints including health checks and basic functionality.
"""
import pytest
from unittest.mock import MagicMock, patch


class TestHealthEndpoints:
    """Test suite for health check endpoints."""
    
    def test_health_check(self):
        """Test /health endpoint returns healthy status."""
        with patch('models.database.MongoClient'):
            with patch('core.clients.redis_client.redis.StrictRedis'):
                with patch('core.clients.minio_client.Minio'):
                    from fastapi.testclient import TestClient
                    from main import app
                    
                    client = TestClient(app)
                    response = client.get("/health")
                    
                    assert response.status_code == 200
                    data = response.json()
                    assert data["status"] == "healthy"
                    assert "version" in data

    def test_ready_check_returns_ready_when_dependencies_are_available(self, monkeypatch):
        """Test /ready returns readiness details for healthy dependencies."""
        with patch('models.database.MongoClient'):
            with patch('core.clients.redis_client.redis.StrictRedis'):
                with patch('core.clients.minio_client.Minio'):
                    from fastapi.testclient import TestClient
                    import main

                    monkeypatch.setattr(
                        main.app_factory,
                        "_readiness_checks",
                        lambda: {
                            "mongodb": {"status": "ok"},
                            "redis": {"status": "ok"},
                            "minio": {"status": "ok"},
                        },
                    )

                    client = TestClient(main.app)
                    response = client.get("/ready")

                    assert response.status_code == 200
                    data = response.json()
                    assert data["status"] == "ready"
                    assert data["checks"]["mongodb"]["status"] == "ok"

    def test_ready_check_returns_503_when_dependency_fails(self, monkeypatch):
        """Test /ready reports not_ready when any dependency fails."""
        with patch('models.database.MongoClient'):
            with patch('core.clients.redis_client.redis.StrictRedis'):
                with patch('core.clients.minio_client.Minio'):
                    from fastapi.testclient import TestClient
                    import main

                    monkeypatch.setattr(
                        main.app_factory,
                        "_readiness_checks",
                        lambda: {
                            "mongodb": {"status": "ok"},
                            "redis": {"status": "unavailable", "error_type": "ConnectionError"},
                            "minio": {"status": "ok"},
                        },
                    )

                    client = TestClient(main.app)
                    response = client.get("/ready")

                    assert response.status_code == 503
                    data = response.json()
                    assert data["status"] == "not_ready"
                    assert data["checks"]["redis"]["error_type"] == "ConnectionError"
    
    def test_root_endpoint(self):
        """Test root endpoint returns API info."""
        with patch('models.database.MongoClient'):
            with patch('core.clients.redis_client.redis.StrictRedis'):
                with patch('core.clients.minio_client.Minio'):
                    from fastapi.testclient import TestClient
                    from main import app
                    
                    client = TestClient(app)
                    response = client.get("/")
                    
                    assert response.status_code == 200
                    data = response.json()
                    assert data["name"] == "GeraltAI API"
                    assert "version" in data
                    assert "docs" in data
                    assert data["ready"] == "/ready"


class TestConfigModule:
    """Test suite for config module."""
    
    def test_config_backwards_compat_class(self):
        """Test Config class provides backwards compatibility."""
        from config import Config
        
        # Check that Config class has expected attributes
        assert hasattr(Config, 'MONGO_URI')
        assert hasattr(Config, 'MONGO_SERVER_SELECTION_TIMEOUT_MS')
        assert hasattr(Config, 'REDIS_HOST')
        assert hasattr(Config, 'REDIS_PORT')
        assert hasattr(Config, 'SECRET_KEY')
        assert hasattr(Config, 'ELASTIC_INDEX')
    
    def test_settings_exported(self):
        """Test that settings is exported from config."""
        from config import settings
        
        assert hasattr(settings, 'MONGO_URI')
        assert hasattr(settings, 'REDIS_HOST')
    
    def test_config_minio_settings(self):
        """Test MinIO settings in Config."""
        from config import Config
        
        assert hasattr(Config, 'MINIO_ENDPOINT')
        assert hasattr(Config, 'MINIO_ACCESS_KEY')
        assert hasattr(Config, 'BUCKET_NAME')
    
    def test_config_ai_settings(self):
        """Test AI settings in Config."""
        from config import Config
        
        assert hasattr(Config, 'DEFAULT_MODEL')
        assert hasattr(Config, 'OPENAI_API_KEY')
        assert hasattr(Config, 'MISTRAL_API_KEY')
        assert hasattr(Config, 'GEMINI_API_KEY')
    
    def test_config_rag_settings(self):
        """Test RAG settings in Config."""
        from config import Config
        
        assert hasattr(Config, 'CHUNK_SIZE')
        assert hasattr(Config, 'CHUNK_OVERLAP')
        assert hasattr(Config, 'RETRIEVAL_TOP_K')


class TestCoreSettings:
    """Test suite for core settings module."""
    
    def test_settings_instance(self):
        """Test settings singleton."""
        from core.config import settings, get_settings
        
        settings1 = get_settings()
        settings2 = get_settings()
        
        # lru_cache should return same instance
        assert settings1 is settings2
    
    def test_settings_defaults(self):
        """Test settings have sensible defaults."""
        from core.config import settings
        
        assert settings.API_VERSION == "v1"
        assert settings.JWT_ALGORITHM == "HS256"
        assert settings.AUTO_START_CELERY_WORKER is True
        assert settings.CHUNK_SIZE >= 100
        assert settings.CHUNK_SIZE <= 2000
    
    def test_settings_redis_url_property(self):
        """Test redis_url property."""
        from core.config import settings
        
        redis_url = settings.redis_url
        assert "redis://" in redis_url

    def test_startup_configuration_rejects_placeholder_secret_in_production(self):
        """Production startup should reject placeholder JWT secrets."""
        from core.config import Settings

        settings = Settings(
            ENVIRONMENT="production",
            SECRET_KEY="your_jwt_secret",
            CORS_ORIGINS=["https://app.example.com"],
        )

        with pytest.raises(ValueError, match="SECRET_KEY"):
            settings.validate_startup_configuration()

    def test_startup_configuration_rejects_wildcard_cors_in_production(self):
        """Production startup should reject wildcard CORS origins."""
        from core.config import Settings

        settings = Settings(
            ENVIRONMENT="production",
            SECRET_KEY="a-production-secret-with-enough-entropy",
            CORS_ORIGINS=["*"],
        )

        with pytest.raises(ValueError, match="CORS_ORIGINS"):
            settings.validate_startup_configuration()

    def test_startup_configuration_allows_development_defaults(self):
        """Development startup can keep local placeholder defaults."""
        from core.config import Settings

        settings = Settings(
            ENVIRONMENT="development",
            SECRET_KEY="your_jwt_secret",
            CORS_ORIGINS=["*"],
        )

        settings.validate_startup_configuration()

    def test_startup_configuration_rejects_missing_ai_keys_in_production(self):
        """Production startup should reject missing active AI provider keys."""
        from core.config import Settings

        settings = Settings(
            ENVIRONMENT="production",
            SECRET_KEY="a-production-secret-with-enough-entropy",
            CORS_ORIGINS=["https://app.example.com"],
            AUTO_START_CELERY_WORKER=False,
            MINIO_ACCESS_KEY="prod-access",
            MINIO_SECRET_KEY="prod-secret",
            DEFAULT_AI_MODEL="gemini",
            DEFAULT_RERANKER="none",
            GEMINI_API_KEY="",
        )

        with pytest.raises(ValueError, match="GEMINI_API_KEY"):
            settings.validate_startup_configuration()

    def test_startup_configuration_rejects_default_minio_credentials_in_production(self):
        """Production startup should reject public MinIO defaults."""
        from core.config import Settings

        settings = Settings(
            ENVIRONMENT="production",
            SECRET_KEY="a-production-secret-with-enough-entropy",
            CORS_ORIGINS=["https://app.example.com"],
            AUTO_START_CELERY_WORKER=False,
            GEMINI_API_KEY="gemini-key",
            DEFAULT_RERANKER="none",
            MINIO_ACCESS_KEY="minioadmin",
            MINIO_SECRET_KEY="minioadmin",
        )

        with pytest.raises(ValueError, match="MINIO"):
            settings.validate_startup_configuration()

    def test_startup_configuration_allows_secure_production_config(self):
        """Production startup accepts explicit non-default security settings."""
        from core.config import Settings

        settings = Settings(
            ENVIRONMENT="production",
            SECRET_KEY="a-production-secret-with-enough-entropy",
            CORS_ORIGINS=["https://app.example.com"],
            AUTO_START_CELERY_WORKER=False,
            MINIO_ACCESS_KEY="prod-access",
            MINIO_SECRET_KEY="prod-secret",
            GEMINI_API_KEY="gemini-key",
            DEFAULT_RERANKER="none",
        )

        settings.validate_startup_configuration()

    def test_startup_configuration_rejects_worker_autostart_in_production(self):
        """Production startup should use a separately supervised Celery worker."""
        from core.config import Settings

        settings = Settings(
            ENVIRONMENT="production",
            SECRET_KEY="a-production-secret-with-enough-entropy",
            CORS_ORIGINS=["https://app.example.com"],
            AUTO_START_CELERY_WORKER=True,
            MINIO_ACCESS_KEY="prod-access",
            MINIO_SECRET_KEY="prod-secret",
            GEMINI_API_KEY="gemini-key",
            DEFAULT_RERANKER="none",
        )

        with pytest.raises(ValueError, match="AUTO_START_CELERY_WORKER"):
            settings.validate_startup_configuration()


class TestAPIRouterStructure:
    """Test suite for API router structure."""
    
    def test_api_v1_router_exists(self):
        """Test that API v1 router is properly configured."""
        with patch('models.database.MongoClient'):
            with patch('core.clients.redis_client.redis.StrictRedis'):
                with patch('core.clients.minio_client.Minio'):
                    from api.v1.router import api_router
                    
                    # Check router has routes
                    assert len(api_router.routes) > 0
    
    def test_docs_endpoint_available(self):
        """Test that docs endpoint is available."""
        with patch('models.database.MongoClient'):
            with patch('core.clients.redis_client.redis.StrictRedis'):
                with patch('core.clients.minio_client.Minio'):
                    from fastapi.testclient import TestClient
                    from main import app
                    
                    client = TestClient(app)
                    response = client.get("/docs")
                    
                    # Docs should redirect or return HTML
                    assert response.status_code in [200, 307]

    def test_app_factory_starts_one_celery_worker(self, monkeypatch):
        """App startup should create one Celery worker process."""
        import main

        calls = []

        class DummyProcess:
            pid = 12345

        def fake_popen(args, **kwargs):
            calls.append((args, kwargs))
            return DummyProcess()

        monkeypatch.setattr(main.subprocess, "Popen", fake_popen)

        process = main.AppFactory()._start_celery_worker()

        assert process.pid == 12345
        assert len(calls) == 1
        assert calls[0][0] == [
            main.sys.executable,
            "-m",
            "celery",
            "-A",
            "core.tasks",
            "worker",
            "--loglevel=info",
        ]
        assert calls[0][1] == {}

    def test_app_factory_skips_celery_worker_when_disabled(self, monkeypatch):
        """App startup should not spawn Celery when auto-start is disabled."""
        import main

        calls = []

        def fake_popen(args, **kwargs):
            calls.append((args, kwargs))
            raise AssertionError("Celery worker should not be started")

        monkeypatch.setattr(main.settings, "AUTO_START_CELERY_WORKER", False)
        monkeypatch.setattr(main.subprocess, "Popen", fake_popen)

        process = main.AppFactory()._start_celery_worker_if_enabled()

        assert process is None
        assert calls == []


class TestServicesStructure:
    """Test suite for services package structure."""
    
    def test_collections_service_base_classes(self):
        """Test that ServiceResult and BaseService exist."""
        from services.collections import ServiceResult, BaseService
        
        # Test ServiceResult factory methods
        ok_result = ServiceResult.ok({"test": "data"})
        assert ok_result.success is True
        assert ok_result.data == {"test": "data"}
        
        fail_result = ServiceResult.fail("Error message", 400)
        assert fail_result.success is False
        assert fail_result.error == "Error message"
        assert fail_result.status_code == 400
    
    def test_collection_service_exists(self):
        """Test that CollectionService can be imported."""
        with patch('models.database.MongoClient'):
            from services.collections.collection_service import CollectionService
            
            assert hasattr(CollectionService, 'create')
            assert hasattr(CollectionService, 'list')
            assert hasattr(CollectionService, 'delete')
    
    def test_service_getters_exist(self):
        """Test that service getter functions exist."""
        from services.collections import (
            get_collection_service,
            get_document_service,
            get_sharing_service,
        )
        
        # Functions should be callable
        assert callable(get_collection_service)
        assert callable(get_document_service)
        assert callable(get_sharing_service)


class TestHelpersPackageStructure:
    """Test suite for helpers package structure."""
    
    def test_helpers_exports_services(self):
        """Test that helpers __init__ exports services."""
        with patch('models.database.MongoClient'):
            with patch('core.clients.redis_client.redis.StrictRedis'):
                from helpers import (
                    CacheInvalidationService,
                    StatusUpdateService,
                    UtilityService,
                )
                
                # Should be classes
                assert callable(CacheInvalidationService)
                assert callable(StatusUpdateService)
                assert callable(UtilityService)
    
    def test_helpers_exports_getters(self):
        """Test that helper getters are exported."""
        from helpers import (
            get_cache_service,
            get_status_service,
            get_utility_service,
        )
        assert callable(get_cache_service)
        assert callable(get_status_service)
        assert callable(get_utility_service)
