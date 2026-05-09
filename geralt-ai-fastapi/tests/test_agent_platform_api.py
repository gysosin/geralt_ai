"""
Tests for agent platform API endpoints.
"""
from unittest.mock import patch


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
