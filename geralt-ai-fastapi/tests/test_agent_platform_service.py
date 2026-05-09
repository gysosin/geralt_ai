"""
Tests for agent and workflow definition services.
"""
from unittest.mock import MagicMock, patch

from services.agents.agent_platform_service import AgentPlatformService


class FakeToolExecutor:
    def execute(self, tool_name, arguments):
        if tool_name == "rag.aggregate":
            return {
                "answer": "Found 1 vendor totals across 2 documents.",
                "data": [{"vendor": "Acme", "total": 200, "count": 2}],
                "metadata": {"documents_analyzed": 2},
            }
        raise NotImplementedError(f"Execution for {tool_name} is not implemented yet")


def test_create_agent_definition_stores_valid_tool_contract():
    agent_db = MagicMock()
    workflow_db = MagicMock()
    audit_db = MagicMock()
    service = AgentPlatformService(agent_db=agent_db, workflow_db=workflow_db, audit_db=audit_db)

    result = service.create_agent(
        owner="mehul",
        name="Invoice Analyst",
        instruction="Analyze invoices and surface risks.",
        tool_names=["rag.search", "rag.aggregate"],
        description="Finance document agent",
        model="gemini-2.5-flash",
        collection_ids=["collection-1"],
    )

    assert result.success is True
    inserted = agent_db.insert_one.call_args.args[0]
    assert inserted["agent_id"] == result.data["agent_id"]
    assert inserted["tool_names"] == ["rag.search", "rag.aggregate"]
    assert inserted["created_by"] == "mehul"
    assert audit_db.insert_one.call_args.args[0]["event"] == "agent.created"


def test_create_agent_definition_rejects_unknown_tool():
    service = AgentPlatformService(agent_db=MagicMock(), workflow_db=MagicMock())

    result = service.create_agent(
        owner="mehul",
        name="Broken Agent",
        instruction="Use missing tools.",
        tool_names=["rag.search", "missing.tool"],
    )

    assert result.success is False
    assert result.status_code == 400
    assert "missing.tool" in result.error


def test_update_agent_definition_persists_changed_fields():
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
        "created_by": "mehul",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:00:00",
        "deleted": False,
    }
    service = AgentPlatformService(agent_db=agent_db, workflow_db=MagicMock(), run_db=MagicMock())

    result = service.update_agent(
        owner="mehul",
        agent_id="agent-1",
        name="Updated Agent",
        instruction="Use planning and aggregation.",
        tool_names=["query.plan", "rag.aggregate"],
        collection_ids=["collection-1"],
    )

    assert result.success is True
    assert result.data["name"] == "Updated Agent"
    assert result.data["tool_names"] == ["query.plan", "rag.aggregate"]
    update = agent_db.update_one.call_args.args[1]["$set"]
    assert update["instruction"] == "Use planning and aggregation."
    assert update["collection_ids"] == ["collection-1"]


def test_create_agent_from_template_stores_template_metadata():
    agent_db = MagicMock()
    service = AgentPlatformService(agent_db=agent_db, workflow_db=MagicMock(), run_db=MagicMock())

    result = service.create_agent_from_template(
        owner="mehul",
        template_id="document_research",
        name="Research Assistant",
        collection_ids=["collection-1"],
    )

    assert result.success is True
    inserted = agent_db.insert_one.call_args.args[0]
    assert inserted["name"] == "Research Assistant"
    assert inserted["tool_names"] == ["query.plan", "rag.search"]
    assert inserted["metadata"]["template_id"] == "document_research"
    assert inserted["collection_ids"] == ["collection-1"]


def test_create_mcp_server_records_transport_contract():
    mcp_server_db = MagicMock()
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        run_db=MagicMock(),
        mcp_server_db=mcp_server_db,
    )

    result = service.create_mcp_server(
        owner="mehul",
        name="Docs MCP",
        transport="streamable_http",
        url="https://docs.example.com/mcp",
        tool_names=["search_docs"],
        description="External docs tools",
    )

    assert result.success is True
    inserted = mcp_server_db.insert_one.call_args.args[0]
    assert inserted["server_id"] == result.data["server_id"]
    assert inserted["transport"] == "streamable_http"
    assert inserted["url"] == "https://docs.example.com/mcp"
    assert inserted["tool_names"] == ["search_docs"]


def test_create_mcp_server_requires_transport_target():
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        run_db=MagicMock(),
        mcp_server_db=MagicMock(),
    )

    result = service.create_mcp_server(
        owner="mehul",
        name="Broken MCP",
        transport="streamable_http",
    )

    assert result.success is False
    assert result.status_code == 400


def test_update_mcp_server_persists_changed_transport_fields():
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
        "created_by": "mehul",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:00:00",
        "deleted": False,
    }
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        run_db=MagicMock(),
        mcp_server_db=mcp_server_db,
    )

    result = service.update_mcp_server(
        owner="mehul",
        server_id="mcp-1",
        name="Updated MCP",
        url="https://new.example.com/mcp",
        tool_names=["search_docs"],
    )

    assert result.success is True
    assert result.data["name"] == "Updated MCP"
    assert result.data["url"] == "https://new.example.com/mcp"
    update = mcp_server_db.update_one.call_args.args[1]["$set"]
    assert update["tool_names"] == ["search_docs"]


def test_check_mcp_server_records_reachable_streamable_http_status():
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
        "created_by": "mehul",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:00:00",
        "deleted": False,
    }
    response = MagicMock()
    response.status = 405
    response.__enter__.return_value = response
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        run_db=MagicMock(),
        mcp_server_db=mcp_server_db,
    )

    with patch("services.agents.agent_platform_service.urlopen", return_value=response):
        result = service.check_mcp_server(owner="mehul", server_id="mcp-1")

    assert result.success is True
    assert result.data["last_health_status"] == "reachable"
    assert "405" in result.data["last_health_message"]
    update = mcp_server_db.update_one.call_args.args[1]["$set"]
    assert update["last_health_status"] == "reachable"
    assert update["last_health_checked_at"]


def test_check_mcp_server_records_missing_stdio_command():
    mcp_server_db = MagicMock()
    mcp_server_db.find_one.return_value = {
        "server_id": "mcp-1",
        "name": "Local MCP",
        "description": "",
        "transport": "stdio",
        "url": "",
        "command": "missing-geralt-mcp",
        "args": [],
        "tool_names": [],
        "metadata": {},
        "created_by": "mehul",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:00:00",
        "deleted": False,
    }
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        run_db=MagicMock(),
        mcp_server_db=mcp_server_db,
    )

    with patch("services.agents.agent_platform_service.shutil.which", return_value=None):
        result = service.check_mcp_server(owner="mehul", server_id="mcp-1")

    assert result.success is True
    assert result.data["last_health_status"] == "unreachable"
    assert "not found" in result.data["last_health_message"]


def test_list_external_mcp_tools_flattens_registered_servers():
    mcp_server_db = MagicMock()
    mcp_server_db.find.return_value = [
        {
            "server_id": "mcp-1",
            "name": "Docs MCP",
            "transport": "streamable_http",
            "url": "https://docs.example.com/mcp",
            "command": "",
            "tool_names": ["search_docs", "read_doc"],
            "last_health_status": "reachable",
        },
        {
            "server_id": "mcp-2",
            "name": "Local MCP",
            "transport": "stdio",
            "url": "",
            "command": "local-mcp",
            "tool_names": ["local_lookup"],
        },
    ]
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        run_db=MagicMock(),
        mcp_server_db=mcp_server_db,
    )

    result = service.list_external_mcp_tools(owner="mehul")

    assert result.success is True
    assert result.data == [
        {
            "server_id": "mcp-1",
            "server_name": "Docs MCP",
            "tool_name": "read_doc",
            "transport": "streamable_http",
            "target": "https://docs.example.com/mcp",
            "health_status": "reachable",
        },
        {
            "server_id": "mcp-1",
            "server_name": "Docs MCP",
            "tool_name": "search_docs",
            "transport": "streamable_http",
            "target": "https://docs.example.com/mcp",
            "health_status": "reachable",
        },
        {
            "server_id": "mcp-2",
            "server_name": "Local MCP",
            "tool_name": "local_lookup",
            "transport": "stdio",
            "target": "local-mcp",
            "health_status": None,
        },
    ]


def test_adk_manifest_exports_agents_workflows_and_mcp_pointer():
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
            "created_by": "mehul",
        }
    ]
    workflow_db.find.return_value = [
        {
            "workflow_id": "workflow-1",
            "name": "Document Flow",
            "description": "Plan then aggregate",
            "triggers": ["document.uploaded"],
            "steps": [{"tool_name": "query.plan"}],
            "created_by": "mehul",
        }
    ]
    mcp_server_db.find.return_value = [
        {
            "server_id": "mcp-1",
            "name": "Docs MCP",
            "transport": "streamable_http",
            "url": "https://docs.example.com/mcp",
            "tool_names": ["search_docs"],
            "created_by": "mehul",
        }
    ]
    service = AgentPlatformService(
        agent_db=agent_db,
        workflow_db=workflow_db,
        run_db=MagicMock(),
        mcp_server_db=mcp_server_db,
    )

    result = service.get_adk_manifest(owner="mehul")

    assert result.success is True
    assert result.data["name"] == "GeraltAI Agent Platform"
    assert result.data["mcp"]["manifest_path"] == "/api/v1/agent-platform/mcp/manifest"
    assert result.data["agents"][0]["tools"] == ["query.plan"]
    assert result.data["agents"][0]["instruction"] == "Plan document questions."
    assert result.data["external_mcp_servers"][0]["name"] == "Docs MCP"
    assert result.data["workflows"][0]["triggers"] == ["document.uploaded"]


def test_platform_stats_counts_definitions_and_run_statuses():
    agent_db = MagicMock()
    workflow_db = MagicMock()
    run_db = MagicMock()
    mcp_server_db = MagicMock()
    agent_db.count_documents.return_value = 2
    workflow_db.count_documents.return_value = 3
    mcp_server_db.find.return_value = [
        {"server_id": "mcp-1", "last_health_status": "reachable"},
        {"server_id": "mcp-2", "last_health_status": "unreachable"},
    ]
    run_db.find.return_value = [
        {"run_id": "run-1", "status": "completed"},
        {"run_id": "run-2", "status": "pending"},
        {"run_id": "run-3", "status": "pending"},
        {
            "run_id": "run-4",
            "status": "canceled",
            "steps": [{"status": "pending_approval"}],
        },
    ]
    service = AgentPlatformService(
        agent_db=agent_db,
        workflow_db=workflow_db,
        run_db=run_db,
        mcp_server_db=mcp_server_db,
    )

    result = service.get_platform_stats(owner="mehul")

    assert result.success is True
    assert result.data["agents"] == 2
    assert result.data["workflows"] == 3
    assert result.data["mcp_servers"] == 2
    assert result.data["reachable_mcp_servers"] == 1
    assert result.data["pending_approvals"] == 1
    assert result.data["runs"] == 4
    assert result.data["run_statuses"] == {
        "completed": 1,
        "pending": 2,
        "canceled": 1,
    }


def test_import_platform_creates_fresh_agents_and_workflows():
    agent_db = MagicMock()
    workflow_db = MagicMock()
    mcp_server_db = MagicMock()
    service = AgentPlatformService(
        agent_db=agent_db,
        workflow_db=workflow_db,
        run_db=MagicMock(),
        mcp_server_db=mcp_server_db,
    )
    payload = {
        "agents": [
            {
                "agent_id": "old-agent",
                "name": "Imported Planner",
                "instruction": "Plan document work.",
                "tool_names": ["query.plan"],
                "model": "default",
                "collection_ids": ["collection-1"],
            }
        ],
        "workflows": [
            {
                "workflow_id": "old-workflow",
                "name": "Imported Flow",
                "description": "Imported workflow",
                "agent_id": "old-agent",
                "triggers": ["document.uploaded"],
                "steps": [
                    {
                        "step_id": "step-1",
                        "name": "Plan",
                        "tool_name": "query.plan",
                        "arguments": {"query": "{{input.query}}"},
                    }
                ],
            }
        ],
        "mcp_servers": [
            {
                "server_id": "old-mcp",
                "name": "Docs MCP",
                "transport": "streamable_http",
                "url": "https://docs.example.com/mcp",
                "tool_names": ["search_docs"],
            }
        ],
    }

    result = service.import_platform(owner="mehul", payload=payload)

    assert result.success is True
    assert result.data["agents_imported"] == 1
    assert result.data["workflows_imported"] == 1
    assert result.data["mcp_servers_imported"] == 1
    new_agent_id = result.data["agent_id_map"]["old-agent"]
    new_workflow_id = result.data["workflow_id_map"]["old-workflow"]
    new_mcp_server_id = result.data["mcp_server_id_map"]["old-mcp"]
    assert new_agent_id != "old-agent"
    assert new_workflow_id != "old-workflow"
    assert new_mcp_server_id != "old-mcp"
    assert agent_db.insert_one.call_args.args[0]["agent_id"] == new_agent_id
    assert mcp_server_db.insert_one.call_args.args[0]["server_id"] == new_mcp_server_id
    inserted_workflow = workflow_db.insert_one.call_args.args[0]
    assert inserted_workflow["agent_id"] == new_agent_id
    assert inserted_workflow["triggers"] == ["document.uploaded"]


def test_import_platform_rejects_unknown_agent_tool():
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        run_db=MagicMock(),
    )

    result = service.import_platform(
        owner="mehul",
        payload={
            "agents": [
                {
                    "name": "Broken Import",
                    "instruction": "Use missing tools.",
                    "tool_names": ["missing.tool"],
                }
            ]
        },
    )

    assert result.success is False
    assert result.status_code == 400


def test_start_agent_run_executes_agent_tool_plan():
    agent_db = MagicMock()
    run_db = MagicMock()
    agent_db.find_one.return_value = {
        "agent_id": "agent-1",
        "name": "Planner",
        "instruction": "Plan document questions.",
        "tool_names": ["query.plan"],
        "collection_ids": [],
        "created_by": "mehul",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:00:00",
        "deleted": False,
    }
    service = AgentPlatformService(
        agent_db=agent_db,
        workflow_db=MagicMock(),
        run_db=run_db,
    )

    result = service.start_agent_run(
        owner="mehul",
        agent_id="agent-1",
        query="summarize these documents",
        dry_run=False,
    )

    assert result.success is True
    inserted = run_db.insert_one.call_args.args[0]
    assert inserted["workflow_id"] == "agent:agent-1"
    assert inserted["agent_id"] == "agent-1"
    assert inserted["status"] == "completed"
    assert inserted["steps"][0]["tool_name"] == "query.plan"
    assert inserted["steps"][0]["output"]["query_type"] == "summary"


def test_start_agent_run_uses_agent_collection_defaults():
    agent_db = MagicMock()
    run_db = MagicMock()
    agent_db.find_one.return_value = {
        "agent_id": "agent-1",
        "name": "Aggregator",
        "instruction": "Aggregate documents.",
        "tool_names": ["rag.aggregate"],
        "collection_ids": ["collection-1"],
        "created_by": "mehul",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:00:00",
        "deleted": False,
    }
    service = AgentPlatformService(
        agent_db=agent_db,
        workflow_db=MagicMock(),
        run_db=run_db,
    )

    result = service.start_agent_run(
        owner="mehul",
        agent_id="agent-1",
        query="total amount by vendor",
        dry_run=True,
    )

    assert result.success is True
    inserted = run_db.insert_one.call_args.args[0]
    assert inserted["status"] == "planned"
    assert inserted["steps"][0]["arguments"] == {
        "query": "total amount by vendor",
        "collection_ids": ["collection-1"],
    }


def test_create_workflow_definition_validates_step_tools():
    workflow_db = MagicMock()
    service = AgentPlatformService(agent_db=MagicMock(), workflow_db=workflow_db)

    result = service.create_workflow(
        owner="mehul",
        name="Invoice Review Flow",
        steps=[
            {
                "name": "Plan query",
                "tool_name": "query.plan",
                "arguments": {"query": "{{input.query}}"},
            },
            {
                "name": "Search source documents",
                "tool_name": "rag.search",
                "arguments": {
                    "query": "{{input.query}}",
                    "collection_ids": "{{input.collection_ids}}",
                },
            },
        ],
        description="Plan, search, then answer",
    )

    assert result.success is True
    inserted = workflow_db.insert_one.call_args.args[0]
    assert inserted["workflow_id"] == result.data["workflow_id"]
    assert inserted["steps"][0]["tool_name"] == "query.plan"
    assert inserted["steps"][0]["step_id"]


def test_update_workflow_definition_persists_changed_steps_and_triggers():
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
        "created_by": "mehul",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:00:00",
        "deleted": False,
    }
    service = AgentPlatformService(agent_db=MagicMock(), workflow_db=workflow_db, run_db=MagicMock())

    result = service.update_workflow(
        owner="mehul",
        workflow_id="workflow-1",
        name="Updated Workflow",
        triggers=["document.uploaded"],
        steps=[
            {
                "step_id": "step-1",
                "name": "Plan",
                "tool_name": "query.plan",
                "arguments": {"query": "{{input.query}}"},
            },
            {
                "step_id": "step-2",
                "name": "Aggregate",
                "tool_name": "rag.aggregate",
                "arguments": {
                    "query": "{{input.query}}",
                    "collection_ids": "{{input.collection_ids}}",
                },
                "depends_on": ["step-1"],
            },
        ],
    )

    assert result.success is True
    assert result.data["name"] == "Updated Workflow"
    assert result.data["triggers"] == ["document.uploaded"]
    update = workflow_db.update_one.call_args.args[1]["$set"]
    assert [step["tool_name"] for step in update["steps"]] == ["query.plan", "rag.aggregate"]
    assert update["steps"][1]["depends_on"] == ["step-1"]


def test_create_workflow_rejects_unknown_dependency():
    service = AgentPlatformService(agent_db=MagicMock(), workflow_db=MagicMock())

    result = service.create_workflow(
        owner="mehul",
        name="Bad Dependency Flow",
        steps=[
            {
                "step_id": "step-1",
                "name": "Plan",
                "tool_name": "query.plan",
                "depends_on": ["missing-step"],
                "arguments": {"query": "{{input.query}}"},
            }
        ],
    )

    assert result.success is False
    assert result.status_code == 400
    assert "missing-step" in result.error


def test_create_workflow_from_template_uses_template_steps():
    workflow_db = MagicMock()
    service = AgentPlatformService(agent_db=MagicMock(), workflow_db=workflow_db)

    result = service.create_workflow_from_template(
        owner="mehul",
        template_id="document_aggregation",
        name="Invoice Totals",
    )

    assert result.success is True
    inserted = workflow_db.insert_one.call_args.args[0]
    assert inserted["name"] == "Invoice Totals"
    assert [step["tool_name"] for step in inserted["steps"]] == ["query.plan", "rag.aggregate"]
    assert inserted["metadata"]["template_id"] == "document_aggregation"


def test_create_workflow_from_template_rejects_unknown_template():
    service = AgentPlatformService(agent_db=MagicMock(), workflow_db=MagicMock())

    result = service.create_workflow_from_template(
        owner="mehul",
        template_id="missing_template",
    )

    assert result.success is False
    assert result.status_code == 404


def test_create_workflow_definition_rejects_unknown_step_tool():
    service = AgentPlatformService(agent_db=MagicMock(), workflow_db=MagicMock())

    result = service.create_workflow(
        owner="mehul",
        name="Bad Flow",
        steps=[{"name": "Missing", "tool_name": "missing.tool"}],
    )

    assert result.success is False
    assert result.status_code == 400
    assert "missing.tool" in result.error


def test_start_workflow_run_dry_run_records_planned_steps():
    workflow_db = MagicMock()
    run_db = MagicMock()
    workflow_db.find_one.return_value = {
        "workflow_id": "workflow-1",
        "created_by": "mehul",
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
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=workflow_db,
        run_db=run_db,
    )

    result = service.start_workflow_run(
        owner="mehul",
        workflow_id="workflow-1",
        inputs={"query": "list all vendors"},
        dry_run=True,
    )

    assert result.success is True
    inserted = run_db.insert_one.call_args.args[0]
    assert inserted["status"] == "planned"
    assert inserted["dry_run"] is True
    assert inserted["steps"][0]["status"] == "planned"
    assert inserted["steps"][0]["arguments"] == {"query": "list all vendors"}


def test_run_workflow_trigger_starts_matching_workflows():
    workflow_db = MagicMock()
    run_db = MagicMock()
    workflow_db.find.return_value = [
        {
            "workflow_id": "workflow-1",
            "name": "Triggered Flow",
            "created_by": "mehul",
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
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=workflow_db,
        run_db=run_db,
    )

    result = service.run_workflow_trigger(
        owner="mehul",
        trigger_name="document.uploaded",
        inputs={"query": "summarize these documents"},
        dry_run=False,
    )

    assert result.success is True
    assert len(result.data) == 1
    inserted = run_db.insert_one.call_args.args[0]
    assert inserted["workflow_id"] == "workflow-1"
    assert inserted["status"] == "completed"
    assert inserted["steps"][0]["output"]["query_type"] == "summary"
    workflow_db.find.assert_called_once()


def test_list_workflow_triggers_counts_matching_workflows():
    workflow_db = MagicMock()
    workflow_db.find.return_value = [
        {
            "workflow_id": "workflow-1",
            "name": "Upload Flow",
            "triggers": ["document.uploaded", "daily.summary"],
        },
        {
            "workflow_id": "workflow-2",
            "name": "Second Upload Flow",
            "triggers": ["document.uploaded"],
        },
    ]
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=workflow_db,
        run_db=MagicMock(),
    )

    result = service.list_workflow_triggers(owner="mehul")

    assert result.success is True
    assert result.data == [
        {
            "trigger": "daily.summary",
            "workflow_count": 1,
            "workflow_ids": ["workflow-1"],
        },
        {
            "trigger": "document.uploaded",
            "workflow_count": 2,
            "workflow_ids": ["workflow-1", "workflow-2"],
        },
    ]


def test_start_workflow_run_executes_query_plan_step():
    workflow_db = MagicMock()
    run_db = MagicMock()
    workflow_db.find_one.return_value = {
        "workflow_id": "workflow-1",
        "created_by": "mehul",
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
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=workflow_db,
        run_db=run_db,
    )

    result = service.start_workflow_run(
        owner="mehul",
        workflow_id="workflow-1",
        inputs={"query": "summarize these documents"},
        dry_run=False,
    )

    assert result.success is True
    inserted = run_db.insert_one.call_args.args[0]
    assert inserted["status"] == "completed"
    assert inserted["steps"][0]["status"] == "completed"
    assert inserted["steps"][0]["output"]["query_type"] == "summary"


def test_start_workflow_run_executes_agent_run_step():
    agent_db = MagicMock()
    workflow_db = MagicMock()
    run_db = MagicMock()
    agent_db.find_one.return_value = {
        "agent_id": "agent-1",
        "name": "Planner",
        "instruction": "Plan document questions.",
        "tool_names": ["query.plan"],
        "collection_ids": ["collection-1"],
        "created_by": "mehul",
        "deleted": False,
    }
    workflow_db.find_one.return_value = {
        "workflow_id": "workflow-1",
        "created_by": "mehul",
        "steps": [
            {
                "step_id": "step-1",
                "name": "Run planner",
                "tool_name": "agent.run",
                "arguments": {
                    "agent_id": "agent-1",
                    "query": "{{input.query}}",
                    "collection_ids": "{{input.collection_ids}}",
                },
                "depends_on": [],
                "approval_required": False,
            }
        ],
        "deleted": False,
    }
    service = AgentPlatformService(
        agent_db=agent_db,
        workflow_db=workflow_db,
        run_db=run_db,
    )

    result = service.start_workflow_run(
        owner="mehul",
        workflow_id="workflow-1",
        inputs={"query": "summarize these documents", "collection_ids": ["collection-1"]},
        dry_run=False,
    )

    assert result.success is True
    inserted = run_db.insert_one.call_args.args[0]
    assert inserted["status"] == "completed"
    output = inserted["steps"][0]["output"]
    assert output["agent_id"] == "agent-1"
    assert output["steps"][0]["tool_name"] == "query.plan"
    assert output["steps"][0]["status"] == "completed"


def test_start_workflow_run_uses_bound_agent_for_agent_run_input():
    agent_db = MagicMock()
    workflow_db = MagicMock()
    run_db = MagicMock()
    agent_db.find_one.return_value = {
        "agent_id": "agent-1",
        "name": "Planner",
        "instruction": "Plan document questions.",
        "tool_names": ["query.plan"],
        "collection_ids": ["collection-1"],
        "created_by": "mehul",
        "deleted": False,
    }
    workflow_db.find_one.return_value = {
        "workflow_id": "workflow-1",
        "created_by": "mehul",
        "agent_id": "agent-1",
        "steps": [
            {
                "step_id": "step-1",
                "name": "Run planner",
                "tool_name": "agent.run",
                "arguments": {
                    "agent_id": "{{input.agent_id}}",
                    "query": "{{input.query}}",
                    "collection_ids": "{{input.collection_ids}}",
                },
                "depends_on": [],
                "approval_required": False,
            }
        ],
        "deleted": False,
    }
    service = AgentPlatformService(
        agent_db=agent_db,
        workflow_db=workflow_db,
        run_db=run_db,
    )

    result = service.start_workflow_run(
        owner="mehul",
        workflow_id="workflow-1",
        inputs={"query": "summarize these documents", "collection_ids": ["collection-1"]},
        dry_run=False,
    )

    assert result.success is True
    inserted = run_db.insert_one.call_args.args[0]
    assert inserted["steps"][0]["arguments"]["agent_id"] == "agent-1"
    assert inserted["steps"][0]["status"] == "completed"


def test_start_workflow_run_resolves_step_output_arguments():
    workflow_db = MagicMock()
    run_db = MagicMock()
    workflow_db.find_one.return_value = {
        "workflow_id": "workflow-1",
        "created_by": "mehul",
        "steps": [
            {
                "step_id": "step-1",
                "name": "Plan",
                "tool_name": "query.plan",
                "arguments": {"query": "{{input.query}}"},
                "depends_on": [],
                "approval_required": False,
            },
            {
                "step_id": "step-2",
                "name": "Plan from previous output",
                "tool_name": "query.plan",
                "arguments": {"query": "{{step.step-1.output.query_type}}"},
                "depends_on": ["step-1"],
                "approval_required": False,
            },
        ],
        "deleted": False,
    }
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=workflow_db,
        run_db=run_db,
    )

    result = service.start_workflow_run(
        owner="mehul",
        workflow_id="workflow-1",
        inputs={"query": "summarize these documents"},
        dry_run=False,
    )

    assert result.success is True
    inserted = run_db.insert_one.call_args.args[0]
    assert inserted["status"] == "completed"
    assert inserted["steps"][1]["arguments"]["query"] == "summary"
    assert inserted["steps"][1]["status"] == "completed"


def test_start_workflow_run_stops_at_approval_gate():
    workflow_db = MagicMock()
    run_db = MagicMock()
    workflow_db.find_one.return_value = {
        "workflow_id": "workflow-1",
        "created_by": "mehul",
        "steps": [
            {
                "step_id": "step-1",
                "name": "Plan",
                "tool_name": "query.plan",
                "arguments": {"query": "{{input.query}}"},
                "depends_on": [],
                "approval_required": True,
            }
        ],
        "deleted": False,
    }
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=workflow_db,
        run_db=run_db,
    )

    result = service.start_workflow_run(
        owner="mehul",
        workflow_id="workflow-1",
        inputs={"query": "summarize these documents"},
        dry_run=False,
    )

    assert result.success is True
    inserted = run_db.insert_one.call_args.args[0]
    assert inserted["status"] == "pending"
    assert inserted["steps"][0]["status"] == "pending_approval"
    assert inserted["steps"][0]["output"] is None


def test_list_pending_approvals_flattens_waiting_steps():
    run_db = MagicMock()
    run_db.find.return_value = [
        {
            "run_id": "run-1",
            "workflow_id": "workflow-1",
            "created_by": "mehul",
            "created_at": "2026-05-09T00:00:00",
            "steps": [
                {
                    "step_id": "step-1",
                    "name": "Human review",
                    "tool_name": "rag.aggregate",
                    "status": "pending_approval",
                    "message": "Approval required before execution",
                },
                {
                    "step_id": "step-2",
                    "name": "Done",
                    "tool_name": "query.plan",
                    "status": "completed",
                },
            ],
        }
    ]
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        run_db=run_db,
    )

    result = service.list_pending_approvals(owner="mehul")

    assert result.success is True
    assert result.data == [
        {
            "run_id": "run-1",
            "workflow_id": "workflow-1",
            "step_id": "step-1",
            "step_name": "Human review",
            "tool_name": "rag.aggregate",
            "message": "Approval required before execution",
            "created_at": "2026-05-09T00:00:00",
        }
    ]


def test_start_workflow_run_blocks_steps_until_dependencies_complete():
    workflow_db = MagicMock()
    run_db = MagicMock()
    workflow_db.find_one.return_value = {
        "workflow_id": "workflow-1",
        "created_by": "mehul",
        "steps": [
            {
                "step_id": "step-1",
                "name": "Review first",
                "tool_name": "query.plan",
                "arguments": {"query": "{{input.query}}"},
                "depends_on": [],
                "approval_required": True,
            },
            {
                "step_id": "step-2",
                "name": "Run after review",
                "tool_name": "query.plan",
                "arguments": {"query": "{{input.query}}"},
                "depends_on": ["step-1"],
                "approval_required": False,
            },
        ],
        "deleted": False,
    }
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=workflow_db,
        run_db=run_db,
    )

    result = service.start_workflow_run(
        owner="mehul",
        workflow_id="workflow-1",
        inputs={"query": "summarize these documents"},
        dry_run=False,
    )

    assert result.success is True
    inserted = run_db.insert_one.call_args.args[0]
    assert inserted["status"] == "pending"
    assert inserted["steps"][0]["status"] == "pending_approval"
    assert inserted["steps"][1]["status"] == "blocked"
    assert inserted["steps"][1]["output"] is None
    assert "step-1" in inserted["steps"][1]["message"]


def test_approve_workflow_step_executes_pending_step():
    run_db = MagicMock()
    run_db.find_one.return_value = {
        "run_id": "run-1",
        "workflow_id": "workflow-1",
        "created_by": "mehul",
        "status": "pending",
        "steps": [
            {
                "step_id": "step-1",
                "name": "Plan",
                "tool_name": "query.plan",
                "arguments": {"query": "summarize these documents"},
                "depends_on": [],
                "approval_required": True,
                "status": "pending_approval",
                "output": None,
                "message": "Approval required before execution",
            }
        ],
    }
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        run_db=run_db,
    )

    result = service.approve_workflow_step(
        owner="mehul",
        run_id="run-1",
        step_id="step-1",
    )

    assert result.success is True
    assert result.data["status"] == "completed"
    assert result.data["steps"][0]["status"] == "completed"
    assert result.data["steps"][0]["output"]["query_type"] == "summary"
    update = run_db.update_one.call_args.args[1]["$set"]
    assert update["status"] == "completed"


def test_approve_workflow_step_resumes_dependent_steps():
    run_db = MagicMock()
    run_db.find_one.return_value = {
        "run_id": "run-1",
        "workflow_id": "workflow-1",
        "created_by": "mehul",
        "status": "pending",
        "steps": [
            {
                "step_id": "step-1",
                "name": "Review first",
                "tool_name": "query.plan",
                "arguments": {"query": "summarize these documents"},
                "depends_on": [],
                "approval_required": True,
                "status": "pending_approval",
                "output": None,
                "message": "Approval required before execution",
            },
            {
                "step_id": "step-2",
                "name": "Run after review",
                "tool_name": "query.plan",
                "arguments": {"query": "summarize these documents"},
                "depends_on": ["step-1"],
                "approval_required": False,
                "status": "blocked",
                "output": None,
                "message": "Waiting for dependency: step-1",
            },
        ],
    }
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        run_db=run_db,
    )

    result = service.approve_workflow_step(
        owner="mehul",
        run_id="run-1",
        step_id="step-1",
    )

    assert result.success is True
    assert result.data["status"] == "completed"
    assert [step["status"] for step in result.data["steps"]] == ["completed", "completed"]
    assert result.data["steps"][1]["output"]["query_type"] == "summary"


def test_approve_workflow_step_rejects_non_pending_step():
    run_db = MagicMock()
    run_db.find_one.return_value = {
        "run_id": "run-1",
        "workflow_id": "workflow-1",
        "created_by": "mehul",
        "status": "completed",
        "steps": [{"step_id": "step-1", "status": "completed"}],
    }
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        run_db=run_db,
    )

    result = service.approve_workflow_step(
        owner="mehul",
        run_id="run-1",
        step_id="step-1",
    )

    assert result.success is False
    assert result.status_code == 400


def test_cancel_workflow_run_marks_non_terminal_steps_canceled():
    run_db = MagicMock()
    run_db.find_one.return_value = {
        "run_id": "run-1",
        "workflow_id": "workflow-1",
        "created_by": "mehul",
        "status": "pending",
        "steps": [
            {"step_id": "step-1", "status": "completed", "message": ""},
            {"step_id": "step-2", "status": "pending_approval", "message": "Approval required"},
            {"step_id": "step-3", "status": "blocked", "message": "Waiting for dependency"},
        ],
    }
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        run_db=run_db,
    )

    result = service.cancel_workflow_run(owner="mehul", run_id="run-1")

    assert result.success is True
    assert result.data["status"] == "canceled"
    assert [step["status"] for step in result.data["steps"]] == [
        "completed",
        "canceled",
        "canceled",
    ]
    update = run_db.update_one.call_args.args[1]["$set"]
    assert update["status"] == "canceled"


def test_cancel_workflow_run_rejects_completed_run():
    run_db = MagicMock()
    run_db.find_one.return_value = {
        "run_id": "run-1",
        "workflow_id": "workflow-1",
        "created_by": "mehul",
        "status": "completed",
        "steps": [],
    }
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        run_db=run_db,
    )

    result = service.cancel_workflow_run(owner="mehul", run_id="run-1")

    assert result.success is False
    assert result.status_code == 400


def test_retry_workflow_run_creates_new_run_from_recorded_steps():
    run_db = MagicMock()
    run_db.find_one.return_value = {
        "run_id": "run-1",
        "workflow_id": "workflow-1",
        "created_by": "mehul",
        "status": "canceled",
        "dry_run": False,
        "inputs": {"query": "summarize these documents"},
        "steps": [
            {
                "step_id": "step-1",
                "name": "Plan",
                "tool_name": "query.plan",
                "arguments": {"query": "summarize these documents"},
                "depends_on": [],
                "approval_required": False,
                "status": "canceled",
                "output": None,
                "message": "Run canceled",
            }
        ],
    }
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        run_db=run_db,
    )

    result = service.retry_workflow_run(owner="mehul", run_id="run-1", dry_run=False)

    assert result.success is True
    inserted = run_db.insert_one.call_args.args[0]
    assert inserted["run_id"] != "run-1"
    assert inserted["retried_from"] == "run-1"
    assert inserted["status"] == "completed"
    assert inserted["steps"][0]["status"] == "completed"
    assert inserted["steps"][0]["output"]["query_type"] == "summary"


def test_start_workflow_run_keeps_unsafe_tool_pending():
    workflow_db = MagicMock()
    run_db = MagicMock()
    workflow_db.find_one.return_value = {
        "workflow_id": "workflow-1",
        "created_by": "mehul",
        "steps": [
            {
                "step_id": "step-1",
                "name": "Search",
                "tool_name": "rag.search",
                "arguments": {
                    "query": "{{input.query}}",
                    "collection_ids": "{{input.collection_ids}}",
                },
                "depends_on": [],
                "approval_required": False,
            }
        ],
        "deleted": False,
    }
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=workflow_db,
        run_db=run_db,
    )

    result = service.start_workflow_run(
        owner="mehul",
        workflow_id="workflow-1",
        inputs={"query": "find warranty", "collection_ids": ["collection-1"]},
        dry_run=False,
    )

    assert result.success is True
    inserted = run_db.insert_one.call_args.args[0]
    assert inserted["status"] == "pending"
    assert inserted["steps"][0]["status"] == "pending"
    assert "not implemented" in inserted["steps"][0]["message"]


def test_start_workflow_run_executes_aggregation_step():
    workflow_db = MagicMock()
    run_db = MagicMock()
    workflow_db.find_one.return_value = {
        "workflow_id": "workflow-1",
        "created_by": "mehul",
        "steps": [
            {
                "step_id": "step-1",
                "name": "Aggregate",
                "tool_name": "rag.aggregate",
                "arguments": {
                    "query": "{{input.query}}",
                    "collection_ids": "{{input.collection_ids}}",
                },
                "depends_on": [],
                "approval_required": False,
            }
        ],
        "deleted": False,
    }
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=workflow_db,
        run_db=run_db,
        tool_executor=FakeToolExecutor(),
    )

    result = service.start_workflow_run(
        owner="mehul",
        workflow_id="workflow-1",
        inputs={"query": "total amount by vendor", "collection_ids": ["collection-1"]},
        dry_run=False,
    )

    assert result.success is True
    inserted = run_db.insert_one.call_args.args[0]
    assert inserted["status"] == "completed"
    assert inserted["steps"][0]["status"] == "completed"
    assert inserted["steps"][0]["output"]["data"][0]["total"] == 200


def test_start_workflow_run_rejects_missing_required_tool_argument():
    workflow_db = MagicMock()
    run_db = MagicMock()
    workflow_db.find_one.return_value = {
        "workflow_id": "workflow-1",
        "created_by": "mehul",
        "steps": [
            {
                "step_id": "step-1",
                "name": "Aggregate",
                "tool_name": "rag.aggregate",
                "arguments": {
                    "query": "{{input.query}}",
                    "collection_ids": "{{input.collection_ids}}",
                },
                "depends_on": [],
                "approval_required": False,
            }
        ],
        "deleted": False,
    }
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=workflow_db,
        run_db=run_db,
        tool_executor=FakeToolExecutor(),
    )

    result = service.start_workflow_run(
        owner="mehul",
        workflow_id="workflow-1",
        inputs={"query": "total amount by vendor"},
        dry_run=False,
    )

    assert result.success is False
    assert result.status_code == 400
    assert "collection_ids" in result.error
    run_db.insert_one.assert_not_called()


def test_start_workflow_run_rejects_wrong_argument_type():
    workflow_db = MagicMock()
    run_db = MagicMock()
    workflow_db.find_one.return_value = {
        "workflow_id": "workflow-1",
        "created_by": "mehul",
        "steps": [
            {
                "step_id": "step-1",
                "name": "Aggregate",
                "tool_name": "rag.aggregate",
                "arguments": {
                    "query": "{{input.query}}",
                    "collection_ids": "collection-1",
                },
                "depends_on": [],
                "approval_required": False,
            }
        ],
        "deleted": False,
    }
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=workflow_db,
        run_db=run_db,
        tool_executor=FakeToolExecutor(),
    )

    result = service.start_workflow_run(
        owner="mehul",
        workflow_id="workflow-1",
        inputs={"query": "total amount by vendor"},
        dry_run=False,
    )

    assert result.success is False
    assert result.status_code == 400
    assert "collection_ids" in result.error
    assert "array" in result.error
    run_db.insert_one.assert_not_called()


def test_get_workflow_run_returns_owned_run():
    run_db = MagicMock()
    run_db.find_one.return_value = {
        "run_id": "run-1",
        "workflow_id": "workflow-1",
        "created_by": "mehul",
        "status": "completed",
        "steps": [],
    }
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        run_db=run_db,
    )

    result = service.get_workflow_run(owner="mehul", run_id="run-1")

    assert result.success is True
    assert result.data["run_id"] == "run-1"
    run_db.find_one.assert_called_once()


def test_get_workflow_run_trace_returns_step_timeline():
    run_db = MagicMock()
    run_db.find_one.return_value = {
        "run_id": "run-1",
        "workflow_id": "workflow-1",
        "agent_id": "agent-1",
        "retried_from": "run-0",
        "status": "pending",
        "dry_run": False,
        "inputs": {"query": "summary"},
        "created_by": "mehul",
        "created_at": "2026-05-09T00:00:00",
        "updated_at": "2026-05-09T00:01:00",
        "steps": [
            {
                "step_id": "step-1",
                "name": "Plan",
                "tool_name": "query.plan",
                "depends_on": [],
                "approval_required": False,
                "status": "completed",
                "output": {"query_type": "summary"},
                "message": "",
            },
            {
                "step_id": "step-2",
                "name": "Review",
                "tool_name": "rag.aggregate",
                "depends_on": ["step-1"],
                "approval_required": True,
                "status": "pending_approval",
                "output": None,
                "message": "Approval required before execution",
            },
        ],
    }
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        run_db=run_db,
    )

    result = service.get_workflow_run_trace(owner="mehul", run_id="run-1")

    assert result.success is True
    assert result.data["run_id"] == "run-1"
    assert result.data["lineage"] == {"agent_id": "agent-1", "retried_from": "run-0"}
    assert result.data["steps"][0]["has_output"] is True
    assert result.data["steps"][1]["status"] == "pending_approval"


def test_get_workflow_run_rejects_missing_run():
    run_db = MagicMock()
    run_db.find_one.return_value = None
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        run_db=run_db,
    )

    result = service.get_workflow_run(owner="mehul", run_id="missing")

    assert result.success is False
    assert result.status_code == 404


def test_delete_agent_soft_deletes_owned_agent():
    agent_db = MagicMock()
    audit_db = MagicMock()
    agent_db.update_one.return_value = MagicMock(modified_count=1)
    service = AgentPlatformService(agent_db=agent_db, workflow_db=MagicMock(), audit_db=audit_db)

    result = service.delete_agent(owner="mehul", agent_id="agent-1")

    assert result.success is True
    update = agent_db.update_one.call_args.args[1]["$set"]
    assert update["deleted"] is True
    assert "updated_at" in update
    assert audit_db.insert_one.call_args.args[0]["event"] == "agent.deleted"


def test_delete_workflow_soft_deletes_owned_workflow():
    workflow_db = MagicMock()
    audit_db = MagicMock()
    workflow_db.update_one.return_value = MagicMock(modified_count=1)
    service = AgentPlatformService(agent_db=MagicMock(), workflow_db=workflow_db, audit_db=audit_db)

    result = service.delete_workflow(owner="mehul", workflow_id="workflow-1")

    assert result.success is True
    update = workflow_db.update_one.call_args.args[1]["$set"]
    assert update["deleted"] is True
    assert "updated_at" in update
    assert audit_db.insert_one.call_args.args[0]["event"] == "workflow.deleted"


def test_delete_workflow_returns_not_found_when_no_match():
    workflow_db = MagicMock()
    workflow_db.update_one.return_value = MagicMock(modified_count=0)
    service = AgentPlatformService(agent_db=MagicMock(), workflow_db=workflow_db)

    result = service.delete_workflow(owner="mehul", workflow_id="missing")

    assert result.success is False
    assert result.status_code == 404


def test_list_audit_events_returns_recent_events():
    audit_db = MagicMock()
    cursor = MagicMock()
    cursor.sort.return_value = cursor
    cursor.limit.return_value = [
        {
            "event": "workflow.created",
            "subject_type": "workflow",
            "subject_id": "workflow-1",
            "created_by": "mehul",
        }
    ]
    audit_db.find.return_value = cursor
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        audit_db=audit_db,
    )

    result = service.list_audit_events(owner="mehul", limit=10)

    assert result.success is True
    assert result.data[0]["event"] == "workflow.created"
    audit_db.find.assert_called_once()


def test_audit_write_failure_does_not_break_agent_creation():
    agent_db = MagicMock()
    audit_db = MagicMock()
    audit_db.insert_one.side_effect = Exception("audit unavailable")
    service = AgentPlatformService(
        agent_db=agent_db,
        workflow_db=MagicMock(),
        audit_db=audit_db,
    )

    result = service.create_agent(
        owner="mehul",
        name="Invoice Analyst",
        instruction="Analyze invoices.",
        tool_names=["query.plan"],
    )

    assert result.success is True
    agent_db.insert_one.assert_called_once()


def test_invoke_tool_executes_deterministic_tool():
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        tool_executor=FakeToolExecutor(),
    )

    result = service.invoke_tool(
        owner="mehul",
        tool_name="rag.aggregate",
        arguments={"query": "total amount by vendor", "collection_ids": ["collection-1"]},
    )

    assert result.success is True
    assert result.data["status"] == "completed"
    assert result.data["output"]["data"][0]["total"] == 200


def test_invoke_tool_rejects_missing_argument():
    service = AgentPlatformService(
        agent_db=MagicMock(),
        workflow_db=MagicMock(),
        tool_executor=FakeToolExecutor(),
    )

    result = service.invoke_tool(
        owner="mehul",
        tool_name="rag.aggregate",
        arguments={"query": "total amount by vendor"},
    )

    assert result.success is False
    assert result.status_code == 400
    assert "collection_ids" in result.error


def test_mcp_manifest_uses_registered_tool_declarations():
    service = AgentPlatformService(agent_db=MagicMock(), workflow_db=MagicMock())

    result = service.get_mcp_manifest()

    assert result.success is True
    assert result.data["name"] == "GeraltAI Agent Platform"
    assert any(tool["name"] == "rag.aggregate" for tool in result.data["tools"])


def test_export_platform_returns_tools_definitions_runs_and_audit():
    agent_db = MagicMock()
    workflow_db = MagicMock()
    run_db = MagicMock()
    audit_db = MagicMock()
    mcp_server_db = MagicMock()
    agent_db.find.return_value = [{"agent_id": "agent-1", "created_by": "mehul"}]
    workflow_db.find.return_value = [{"workflow_id": "workflow-1", "created_by": "mehul"}]
    mcp_server_db.find.return_value = [{"server_id": "mcp-1", "created_by": "mehul"}]
    run_db.find.return_value = [{"run_id": "run-1", "created_by": "mehul"}]
    audit_cursor = MagicMock()
    audit_cursor.sort.return_value = audit_cursor
    audit_cursor.limit.return_value = [{"event": "workflow.created", "created_by": "mehul"}]
    audit_db.find.return_value = audit_cursor
    service = AgentPlatformService(
        agent_db=agent_db,
        workflow_db=workflow_db,
        run_db=run_db,
        audit_db=audit_db,
        mcp_server_db=mcp_server_db,
    )

    result = service.export_platform(owner="mehul")

    assert result.success is True
    assert result.data["agents"][0]["agent_id"] == "agent-1"
    assert result.data["workflows"][0]["workflow_id"] == "workflow-1"
    assert result.data["mcp_servers"][0]["server_id"] == "mcp-1"
    assert result.data["runs"][0]["run_id"] == "run-1"
    assert result.data["audit_events"][0]["event"] == "workflow.created"
    assert any(tool["name"] == "rag.aggregate" for tool in result.data["mcp_manifest"]["tools"])
