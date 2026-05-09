"""
Tests for agent and workflow definition services.
"""
from unittest.mock import MagicMock

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
    agent_db.find.return_value = [{"agent_id": "agent-1", "created_by": "mehul"}]
    workflow_db.find.return_value = [{"workflow_id": "workflow-1", "created_by": "mehul"}]
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
    )

    result = service.export_platform(owner="mehul")

    assert result.success is True
    assert result.data["agents"][0]["agent_id"] == "agent-1"
    assert result.data["workflows"][0]["workflow_id"] == "workflow-1"
    assert result.data["runs"][0]["run_id"] == "run-1"
    assert result.data["audit_events"][0]["event"] == "workflow.created"
    assert any(tool["name"] == "rag.aggregate" for tool in result.data["mcp_manifest"]["tools"])
