"""
Tests for agent platform API endpoints.
"""
from unittest.mock import MagicMock, patch


def test_agent_tools_endpoint_returns_mcp_ready_specs():
    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app

                client = TestClient(app)
                response = client.get("/api/v1/agent-platform/tools")

    assert response.status_code == 200
    data = response.json()
    assert "tools" in data
    assert "mcp_tools" in data
    assert {tool["name"] for tool in data["tools"]} >= {
        "rag.search",
        "rag.aggregate",
        "collection.summarize",
        "query.plan",
    }
    assert all("inputSchema" in tool for tool in data["mcp_tools"])


def test_agent_query_plan_endpoint_returns_deterministic_route():
    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app

                client = TestClient(app)
                response = client.post(
                    "/api/v1/agent-platform/query-plan",
                    json={"query": "list all vendors and amounts"},
                )

    assert response.status_code == 200
    data = response.json()
    assert data["query_type"] == "listing"
    assert data["needs_all_docs"] is True
    assert data["suggested_top_k"] >= 25


def test_create_agent_definition_endpoint_uses_registered_tools():
    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(agent_db=MagicMock(), workflow_db=MagicMock())
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.post(
                    "/api/v1/agent-platform/agents",
                    json={
                        "name": "Invoice Analyst",
                        "instruction": "Review invoices and cite sources.",
                        "tool_names": ["rag.search", "rag.aggregate"],
                        "collection_ids": ["collection-1"],
                    },
                )
                app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["agent_id"]
    assert data["name"] == "Invoice Analyst"
    assert data["tool_names"] == ["rag.search", "rag.aggregate"]


def test_create_workflow_definition_endpoint_validates_step_tools():
    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(agent_db=MagicMock(), workflow_db=MagicMock())
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.post(
                    "/api/v1/agent-platform/workflows",
                    json={
                        "name": "Document Answer Flow",
                        "steps": [
                            {
                                "name": "Plan",
                                "tool_name": "query.plan",
                                "arguments": {"query": "{{input.query}}"},
                            },
                            {
                                "name": "Search",
                                "tool_name": "rag.search",
                                "arguments": {
                                    "query": "{{input.query}}",
                                    "collection_ids": "{{input.collection_ids}}",
                                },
                            },
                        ],
                    },
                )
                app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["workflow_id"]
    assert data["steps"][0]["step_id"] == "step-1"
    assert data["steps"][1]["tool_name"] == "rag.search"
