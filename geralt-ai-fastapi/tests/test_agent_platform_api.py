"""
Tests for agent platform API endpoints.
"""
from unittest.mock import MagicMock, patch


class FakeToolExecutor:
    def execute(self, tool_name, arguments):
        if tool_name == "rag.aggregate":
            return {
                "answer": "Found 1 vendor totals across 2 documents.",
                "data": [{"vendor": "Acme", "total": 200, "count": 2}],
                "metadata": {"documents_analyzed": 2},
            }
        raise NotImplementedError(f"Execution for {tool_name} is not implemented yet")


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
        "mcp.invoke",
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


def test_update_agent_definition_endpoint_returns_updated_agent():
    agent_db = MagicMock()
    agent_db.find_one.return_value = {
        "agent_id": "agent-1",
        "name": "Old Agent",
        "description": "",
        "instruction": "Old instruction.",
        "tool_names": ["query.plan"],
        "model": "default",
        "collection_ids": [],
        "metadata": {},
        "created_by": "anonymous",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:00:00",
        "deleted": False,
    }

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=agent_db,
                    workflow_db=MagicMock(),
                    run_db=MagicMock(),
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.patch(
                    "/api/v1/agent-platform/agents/agent-1",
                    json={
                        "name": "Updated Agent",
                        "instruction": "Use planning and aggregation.",
                        "tool_names": ["query.plan", "rag.aggregate"],
                    },
                )
                app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Agent"
    assert data["tool_names"] == ["query.plan", "rag.aggregate"]


def test_agent_templates_endpoint_returns_built_ins():
    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app

                client = TestClient(app)
                response = client.get("/api/v1/agent-platform/agent-templates")

    assert response.status_code == 200
    data = response.json()
    assert {template["template_id"] for template in data} >= {
        "document_research",
        "structured_data_analyst",
        "collection_summarizer",
    }


def test_create_agent_from_template_endpoint():
    agent_db = MagicMock()

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(agent_db=agent_db, workflow_db=MagicMock())
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.post(
                    "/api/v1/agent-platform/agents/from-template",
                    json={
                        "template_id": "document_research",
                        "name": "Research Assistant",
                        "collection_ids": ["collection-1"],
                    },
                )
                app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Research Assistant"
    assert data["tool_names"] == ["query.plan", "rag.search"]
    assert data["metadata"]["template_id"] == "document_research"


def test_create_mcp_server_endpoint_records_external_tool_source():
    mcp_server_db = MagicMock()

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=MagicMock(),
                    run_db=MagicMock(),
                    mcp_server_db=mcp_server_db,
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.post(
                    "/api/v1/agent-platform/mcp-servers",
                    json={
                        "name": "Docs MCP",
                        "transport": "streamable_http",
                        "url": "https://docs.example.com/mcp",
                        "tool_names": ["search_docs"],
                    },
                )
                app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["server_id"]
    assert data["transport"] == "streamable_http"
    assert data["tool_names"] == ["search_docs"]


def test_update_mcp_server_endpoint_returns_updated_server():
    mcp_server_db = MagicMock()
    mcp_server_db.find_one.return_value = {
        "server_id": "mcp-1",
        "name": "Old MCP",
        "description": "",
        "transport": "streamable_http",
        "url": "https://old.example.com/mcp",
        "command": "",
        "args": [],
        "tool_names": [],
        "metadata": {},
        "created_by": "anonymous",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:00:00",
        "deleted": False,
    }

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=MagicMock(),
                    run_db=MagicMock(),
                    mcp_server_db=mcp_server_db,
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.patch(
                    "/api/v1/agent-platform/mcp-servers/mcp-1",
                    json={
                        "name": "Updated MCP",
                        "url": "https://new.example.com/mcp",
                        "tool_names": ["search_docs"],
                    },
                )
                app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated MCP"
    assert data["tool_names"] == ["search_docs"]


def test_check_mcp_server_endpoint_records_health_status():
    mcp_server_db = MagicMock()
    mcp_server_db.find_one.return_value = {
        "server_id": "mcp-1",
        "name": "Docs MCP",
        "description": "",
        "transport": "streamable_http",
        "url": "https://docs.example.com/mcp",
        "command": "",
        "args": [],
        "tool_names": ["search_docs"],
        "metadata": {},
        "created_by": "anonymous",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:00:00",
        "deleted": False,
    }
    health_response = MagicMock()
    health_response.status = 200
    health_response.__enter__.return_value = health_response

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                with patch("services.agents.agent_platform_service.urlopen", return_value=health_response):
                    from fastapi.testclient import TestClient
                    from main import app
                    from services.agents import AgentPlatformService, get_agent_platform_service

                    service = AgentPlatformService(
                        agent_db=MagicMock(),
                        workflow_db=MagicMock(),
                        run_db=MagicMock(),
                        mcp_server_db=mcp_server_db,
                    )
                    app.dependency_overrides[get_agent_platform_service] = lambda: service

                    client = TestClient(app)
                    response = client.post("/api/v1/agent-platform/mcp-servers/mcp-1/health-check")
                    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["server_id"] == "mcp-1"
    assert data["last_health_status"] == "reachable"


def test_check_all_mcp_servers_endpoint_returns_checked_servers():
    mcp_server_db = MagicMock()
    mcp_server_db.find.return_value = [
        {
            "server_id": "mcp-1",
            "name": "Docs MCP",
            "description": "",
            "transport": "streamable_http",
            "url": "https://docs.example.com/mcp",
            "command": "",
            "args": [],
            "tool_names": ["search_docs"],
            "metadata": {},
            "created_by": "anonymous",
            "created_at": "2026-05-09T00:00:00",
            "updated_at": "2026-05-09T00:00:00",
            "deleted": False,
        }
    ]

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=MagicMock(),
                    run_db=MagicMock(),
                    mcp_server_db=mcp_server_db,
                )
                service._probe_mcp_server = MagicMock(return_value=(
                    "reachable",
                    "HTTP 200 response received from MCP endpoint",
                ))
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.post("/api/v1/agent-platform/mcp-servers/health-checks")
                app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data[0]["server_id"] == "mcp-1"
    assert data[0]["last_health_status"] == "reachable"


def test_external_mcp_tools_endpoint_returns_flat_catalog():
    mcp_server_db = MagicMock()
    mcp_server_db.find.return_value = [
        {
            "server_id": "mcp-1",
            "name": "Docs MCP",
            "transport": "streamable_http",
            "url": "https://docs.example.com/mcp",
            "command": "",
            "tool_names": ["search_docs"],
            "last_health_status": "reachable",
        }
    ]

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=MagicMock(),
                    run_db=MagicMock(),
                    mcp_server_db=mcp_server_db,
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.get("/api/v1/agent-platform/mcp-servers/tools")
                app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data[0]["tool_name"] == "search_docs"
    assert data[0]["server_name"] == "Docs MCP"


def test_start_agent_run_endpoint_executes_agent_tool_plan():
    agent_db = MagicMock()
    agent_db.find_one.return_value = {
        "agent_id": "agent-1",
        "name": "Planner",
        "description": "",
        "instruction": "Plan document questions.",
        "tool_names": ["query.plan"],
        "model": "default",
        "collection_ids": [],
        "metadata": {},
        "created_by": "anonymous",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:00:00",
        "deleted": False,
    }

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=agent_db,
                    workflow_db=MagicMock(),
                    run_db=MagicMock(),
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.post(
                    "/api/v1/agent-platform/agents/agent-1/runs",
                    json={"query": "summarize documents", "dry_run": False},
                )
                app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["workflow_id"] == "agent:agent-1"
    assert data["agent_id"] == "agent-1"
    assert data["status"] == "completed"
    assert data["steps"][0]["output"]["query_type"] == "summary"


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


def test_update_workflow_definition_endpoint_returns_updated_workflow():
    workflow_db = MagicMock()
    workflow_db.find_one.return_value = {
        "workflow_id": "workflow-1",
        "name": "Old Workflow",
        "description": "",
        "agent_id": None,
        "steps": [
            {
                "step_id": "step-1",
                "name": "Plan",
                "tool_name": "query.plan",
                "arguments": {"query": "{{input.query}}"},
                "depends_on": [],
                "approval_required": False,
            }
        ],
        "triggers": [],
        "metadata": {},
        "created_by": "anonymous",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:00:00",
        "deleted": False,
    }

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=workflow_db,
                    run_db=MagicMock(),
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.patch(
                    "/api/v1/agent-platform/workflows/workflow-1",
                    json={
                        "name": "Updated Workflow",
                        "triggers": ["document.uploaded"],
                    },
                )
                app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Workflow"
    assert data["triggers"] == ["document.uploaded"]


def test_workflow_templates_endpoint_returns_built_ins():
    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app

                client = TestClient(app)
                response = client.get("/api/v1/agent-platform/workflow-templates")

    assert response.status_code == 200
    data = response.json()
    assert {template["template_id"] for template in data} >= {
        "document_aggregation",
        "document_search",
        "collection_summary",
    }


def test_create_workflow_from_template_endpoint():
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
                    "/api/v1/agent-platform/workflows/from-template",
                    json={"template_id": "document_aggregation", "name": "Invoice Totals"},
                )
                app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Invoice Totals"
    assert [step["tool_name"] for step in data["steps"]] == ["query.plan", "rag.aggregate"]


def test_start_workflow_run_endpoint_returns_dry_run_plan():
    workflow_db = MagicMock()
    workflow_db.find_one.return_value = {
        "workflow_id": "workflow-1",
        "created_by": "anonymous",
        "steps": [
            {
                "step_id": "step-1",
                "name": "Plan",
                "tool_name": "query.plan",
                "arguments": {"query": "{{input.query}}"},
                "depends_on": [],
                "approval_required": False,
            }
        ],
        "deleted": False,
    }

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=workflow_db,
                    run_db=MagicMock(),
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.post(
                    "/api/v1/agent-platform/workflows/workflow-1/runs",
                    json={"inputs": {"query": "list all vendors"}, "dry_run": True},
                )
                app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "planned"
    assert data["steps"][0]["arguments"] == {"query": "list all vendors"}


def test_run_workflow_trigger_endpoint_starts_matching_workflows():
    workflow_db = MagicMock()
    workflow_db.find.return_value = [
        {
            "workflow_id": "workflow-1",
            "name": "Triggered Flow",
            "created_by": "anonymous",
            "triggers": ["document.uploaded"],
            "steps": [
                {
                    "step_id": "step-1",
                    "name": "Plan",
                    "tool_name": "query.plan",
                    "arguments": {"query": "{{input.query}}"},
                    "depends_on": [],
                    "approval_required": False,
                }
            ],
            "deleted": False,
        }
    ]

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=workflow_db,
                    run_db=MagicMock(),
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.post(
                    "/api/v1/agent-platform/triggers/document.uploaded/runs",
                    json={"inputs": {"query": "summarize documents"}, "dry_run": False},
                )
                app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert len(data) == 1
    assert data[0]["workflow_id"] == "workflow-1"
    assert data[0]["steps"][0]["output"]["query_type"] == "summary"


def test_workflow_triggers_endpoint_returns_catalog():
    workflow_db = MagicMock()
    workflow_db.find.return_value = [
        {"workflow_id": "workflow-1", "triggers": ["document.uploaded"]},
        {"workflow_id": "workflow-2", "triggers": ["document.uploaded", "daily.summary"]},
    ]

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=workflow_db,
                    run_db=MagicMock(),
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.get("/api/v1/agent-platform/triggers")
                app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data[0]["trigger"] == "daily.summary"
    assert data[1]["workflow_count"] == 2


def test_start_workflow_run_endpoint_executes_query_plan_step():
    workflow_db = MagicMock()
    workflow_db.find_one.return_value = {
        "workflow_id": "workflow-1",
        "created_by": "anonymous",
        "steps": [
            {
                "step_id": "step-1",
                "name": "Plan",
                "tool_name": "query.plan",
                "arguments": {"query": "{{input.query}}"},
                "depends_on": [],
                "approval_required": False,
            }
        ],
        "deleted": False,
    }

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=workflow_db,
                    run_db=MagicMock(),
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.post(
                    "/api/v1/agent-platform/workflows/workflow-1/runs",
                    json={"inputs": {"query": "summarize documents"}, "dry_run": False},
                )
                app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "completed"
    assert data["steps"][0]["output"]["query_type"] == "summary"


def test_get_workflow_run_endpoint_returns_run_record():
    run_db = MagicMock()
    run_db.find_one.return_value = {
        "run_id": "run-1",
        "workflow_id": "workflow-1",
        "status": "completed",
        "dry_run": False,
        "inputs": {"query": "summary"},
        "steps": [],
        "created_by": "anonymous",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:00:00",
    }

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=MagicMock(),
                    run_db=run_db,
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.get("/api/v1/agent-platform/workflow-runs/run-1")
                app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["run_id"] == "run-1"


def test_get_workflow_run_trace_endpoint_returns_timeline():
    run_db = MagicMock()
    run_db.find_one.return_value = {
        "run_id": "run-1",
        "workflow_id": "workflow-1",
        "status": "pending",
        "dry_run": False,
        "inputs": {"query": "summary"},
        "steps": [
            {
                "step_id": "step-1",
                "name": "Plan",
                "tool_name": "query.plan",
                "status": "completed",
                "output": {"query_type": "summary"},
                "message": "",
            }
        ],
        "created_by": "anonymous",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:01:00",
    }

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=MagicMock(),
                    run_db=run_db,
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.get("/api/v1/agent-platform/workflow-runs/run-1/trace")
                app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["run_id"] == "run-1"
    assert data["steps"][0]["has_output"] is True


def test_pending_approvals_endpoint_returns_waiting_steps():
    run_db = MagicMock()
    run_db.find.return_value = [
        {
            "run_id": "run-1",
            "workflow_id": "workflow-1",
            "steps": [
                {
                    "step_id": "step-1",
                    "name": "Review",
                    "tool_name": "rag.aggregate",
                    "status": "pending_approval",
                    "message": "Approval required before execution",
                }
            ],
            "created_by": "anonymous",
            "created_at": "2026-05-09T00:00:00",
        }
    ]

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=MagicMock(),
                    run_db=run_db,
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.get("/api/v1/agent-platform/workflow-runs/pending-approvals")
                app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data[0]["run_id"] == "run-1"
    assert data[0]["step_id"] == "step-1"


def test_approve_workflow_step_endpoint_executes_pending_step():
    run_db = MagicMock()
    run_db.find_one.return_value = {
        "run_id": "run-1",
        "workflow_id": "workflow-1",
        "status": "pending",
        "dry_run": False,
        "inputs": {"query": "summarize documents"},
        "steps": [
            {
                "step_id": "step-1",
                "name": "Plan",
                "tool_name": "query.plan",
                "arguments": {"query": "summarize documents"},
                "depends_on": [],
                "approval_required": True,
                "status": "pending_approval",
                "output": None,
                "message": "Approval required before execution",
            }
        ],
        "created_by": "anonymous",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:00:00",
    }

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=MagicMock(),
                    run_db=run_db,
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.post(
                    "/api/v1/agent-platform/workflow-runs/run-1/steps/step-1/approve"
                )
                app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["steps"][0]["status"] == "completed"
    assert data["steps"][0]["output"]["query_type"] == "summary"


def test_approve_all_pending_workflow_steps_endpoint():
    run_db = MagicMock()
    pending_run = {
        "run_id": "run-1",
        "workflow_id": "workflow-1",
        "status": "pending",
        "dry_run": False,
        "inputs": {"query": "summarize documents"},
        "steps": [
            {
                "step_id": "step-1",
                "name": "Plan",
                "tool_name": "query.plan",
                "arguments": {"query": "summarize documents"},
                "depends_on": [],
                "approval_required": True,
                "status": "pending_approval",
                "output": None,
                "message": "Approval required before execution",
            }
        ],
        "created_by": "anonymous",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:00:00",
    }
    run_db.find.return_value = [pending_run]
    run_db.find_one.return_value = pending_run

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=MagicMock(),
                    run_db=run_db,
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.post(
                    "/api/v1/agent-platform/workflow-runs/pending-approvals/approve"
                )
                app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["approved_count"] == 1
    assert data["runs"][0]["status"] == "completed"
    assert data["runs"][0]["steps"][0]["output"]["query_type"] == "summary"


def test_archive_workflow_runs_endpoint_marks_terminal_runs_archived():
    run_db = MagicMock()
    run_db.update_many.return_value.modified_count = 4

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=MagicMock(),
                    run_db=run_db,
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.post("/api/v1/agent-platform/workflow-runs/archive")
                app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["archived_count"] == 4
    assert data["statuses"] == ["canceled", "completed", "failed", "planned"]


def test_cancel_workflow_run_endpoint_marks_run_canceled():
    run_db = MagicMock()
    run_db.find_one.return_value = {
        "run_id": "run-1",
        "workflow_id": "workflow-1",
        "status": "pending",
        "dry_run": False,
        "inputs": {"query": "summarize documents"},
        "steps": [
            {
                "step_id": "step-1",
                "name": "Approval",
                "tool_name": "query.plan",
                "arguments": {"query": "summarize documents"},
                "depends_on": [],
                "approval_required": True,
                "status": "pending_approval",
                "output": None,
                "message": "Approval required before execution",
            }
        ],
        "created_by": "anonymous",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:00:00",
    }

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=MagicMock(),
                    run_db=run_db,
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.post("/api/v1/agent-platform/workflow-runs/run-1/cancel")
                app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "canceled"
    assert data["steps"][0]["status"] == "canceled"


def test_retry_workflow_run_endpoint_creates_new_run():
    run_db = MagicMock()
    run_db.find_one.return_value = {
        "run_id": "run-1",
        "workflow_id": "workflow-1",
        "status": "canceled",
        "dry_run": False,
        "inputs": {"query": "summarize documents"},
        "steps": [
            {
                "step_id": "step-1",
                "name": "Plan",
                "tool_name": "query.plan",
                "arguments": {"query": "summarize documents"},
                "depends_on": [],
                "approval_required": False,
                "status": "canceled",
                "output": None,
                "message": "Run canceled",
            }
        ],
        "created_by": "anonymous",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:00:00",
    }

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=MagicMock(),
                    run_db=run_db,
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.post(
                    "/api/v1/agent-platform/workflow-runs/run-1/retry",
                    json={"dry_run": False},
                )
                app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["run_id"] != "run-1"
    assert data["retried_from"] == "run-1"
    assert data["status"] == "completed"
    assert data["steps"][0]["output"]["query_type"] == "summary"


def test_delete_workflow_endpoint_soft_deletes_definition():
    workflow_db = MagicMock()
    workflow_db.update_one.return_value = MagicMock(modified_count=1)

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=workflow_db,
                    run_db=MagicMock(),
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.delete("/api/v1/agent-platform/workflows/workflow-1")
                app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["message"] == "Workflow deleted successfully"


def test_delete_agent_endpoint_soft_deletes_definition():
    agent_db = MagicMock()
    agent_db.update_one.return_value = MagicMock(modified_count=1)

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=agent_db,
                    workflow_db=MagicMock(),
                    run_db=MagicMock(),
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.delete("/api/v1/agent-platform/agents/agent-1")
                app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["message"] == "Agent deleted successfully"


def test_agent_platform_audit_endpoint_returns_events():
    audit_db = MagicMock()
    cursor = MagicMock()
    cursor.sort.return_value = cursor
    cursor.limit.return_value = [
        {
            "event": "workflow.created",
            "subject_type": "workflow",
            "subject_id": "workflow-1",
            "metadata": {},
            "created_by": "anonymous",
            "created_at": "2026-05-09T00:00:00",
        }
    ]
    audit_db.find.return_value = cursor

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=MagicMock(),
                    run_db=MagicMock(),
                    audit_db=audit_db,
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.get("/api/v1/agent-platform/audit-events")
                app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()[0]["event"] == "workflow.created"


def test_mcp_manifest_endpoint_returns_tool_declarations():
    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app

                client = TestClient(app)
                response = client.get("/api/v1/agent-platform/mcp/manifest")

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "GeraltAI Agent Platform"
    assert any(tool["name"] == "rag.aggregate" for tool in data["tools"])


def test_platform_stats_endpoint_returns_counts():
    agent_db = MagicMock()
    workflow_db = MagicMock()
    run_db = MagicMock()
    mcp_server_db = MagicMock()
    agent_db.count_documents.return_value = 2
    workflow_db.count_documents.return_value = 1
    mcp_server_db.find.return_value = [{"server_id": "mcp-1", "last_health_status": "reachable"}]
    run_db.find.return_value = [
        {"run_id": "run-1", "status": "completed"},
        {"run_id": "run-2", "status": "pending", "steps": [{"status": "pending_approval"}]},
    ]

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=agent_db,
                    workflow_db=workflow_db,
                    run_db=run_db,
                    mcp_server_db=mcp_server_db,
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.get("/api/v1/agent-platform/stats")
                app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["agents"] == 2
    assert data["workflows"] == 1
    assert data["mcp_servers"] == 1
    assert data["reachable_mcp_servers"] == 1
    assert data["pending_approvals"] == 1
    assert data["run_statuses"]["pending"] == 1


def test_adk_manifest_endpoint_returns_agents_and_toolset_pointer():
    agent_db = MagicMock()
    workflow_db = MagicMock()
    mcp_server_db = MagicMock()
    agent_db.find.return_value = [
        {
            "agent_id": "agent-1",
            "name": "Planner",
            "instruction": "Plan document questions.",
            "tool_names": ["query.plan"],
            "model": "gemini-2.5-flash",
            "collection_ids": [],
            "created_by": "anonymous",
        }
    ]
    workflow_db.find.return_value = []
    mcp_server_db.find.return_value = []

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=agent_db,
                    workflow_db=workflow_db,
                    run_db=MagicMock(),
                    mcp_server_db=mcp_server_db,
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.get("/api/v1/agent-platform/adk/manifest")
                app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["adk_version_hint"] == "google-adk"
    assert data["agents"][0]["name"] == "Planner"
    assert data["mcp"]["toolset_name"] == "geraltai_mcp_tools"


def test_tool_invocation_endpoint_executes_tool():
    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=MagicMock(),
                    run_db=MagicMock(),
                    tool_executor=FakeToolExecutor(),
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.post(
                    "/api/v1/agent-platform/tool-invocations",
                    json={
                        "tool_name": "rag.aggregate",
                        "arguments": {
                            "query": "total amount by vendor",
                            "collection_ids": ["collection-1"],
                        },
                    },
                )
                app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["output"]["data"][0]["total"] == 200


def test_platform_export_endpoint_returns_structured_payload():
    agent_db = MagicMock()
    workflow_db = MagicMock()
    run_db = MagicMock()
    audit_db = MagicMock()
    mcp_server_db = MagicMock()
    agent_db.find.return_value = [{"agent_id": "agent-1", "created_by": "anonymous"}]
    workflow_db.find.return_value = [{"workflow_id": "workflow-1", "created_by": "anonymous"}]
    mcp_server_db.find.return_value = [{"server_id": "mcp-1", "created_by": "anonymous"}]
    run_db.find.return_value = [{"run_id": "run-1", "created_by": "anonymous"}]
    audit_cursor = MagicMock()
    audit_cursor.sort.return_value = audit_cursor
    audit_cursor.limit.return_value = [{"event": "workflow.created", "created_by": "anonymous"}]
    audit_db.find.return_value = audit_cursor

    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=agent_db,
                    workflow_db=workflow_db,
                    run_db=run_db,
                    audit_db=audit_db,
                    mcp_server_db=mcp_server_db,
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.get("/api/v1/agent-platform/export")
                app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["schema_version"] == "1.0"
    assert data["agents"][0]["agent_id"] == "agent-1"
    assert data["mcp_servers"][0]["server_id"] == "mcp-1"
    assert data["mcp_manifest"]["name"] == "GeraltAI Agent Platform"


def test_platform_import_endpoint_returns_id_maps():
    with patch("models.database.MongoClient"):
        with patch("core.clients.redis_client.redis.StrictRedis"):
            with patch("core.clients.minio_client.Minio"):
                from fastapi.testclient import TestClient
                from main import app
                from services.agents import AgentPlatformService, get_agent_platform_service

                service = AgentPlatformService(
                    agent_db=MagicMock(),
                    workflow_db=MagicMock(),
                    run_db=MagicMock(),
                )
                app.dependency_overrides[get_agent_platform_service] = lambda: service

                client = TestClient(app)
                response = client.post(
                    "/api/v1/agent-platform/import",
                    json={
                        "agents": [
                            {
                                "agent_id": "old-agent",
                                "name": "Imported Planner",
                                "instruction": "Plan document work.",
                                "tool_names": ["query.plan"],
                            }
                        ],
                        "workflows": [],
                        "mcp_servers": [
                            {
                                "server_id": "old-mcp",
                                "name": "Docs MCP",
                                "transport": "streamable_http",
                                "url": "https://docs.example.com/mcp",
                            }
                        ],
                    },
                )
                app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["agents_imported"] == 1
    assert data["agent_id_map"]["old-agent"]
    assert data["mcp_servers_imported"] == 1
    assert data["mcp_server_id_map"]["old-mcp"]
