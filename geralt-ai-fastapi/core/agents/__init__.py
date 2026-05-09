"""Agent platform primitives."""

from core.agents.tool_executor import AgentToolExecutor, get_agent_tool_executor
from core.agents.tool_registry import AgentToolSpec, get_agent_tool_registry
from core.agents.agent_templates import AgentTemplateRegistry, get_agent_template_registry
from core.agents.workflow_templates import WorkflowTemplateRegistry, get_workflow_template_registry

__all__ = [
    "AgentTemplateRegistry",
    "AgentToolExecutor",
    "AgentToolSpec",
    "WorkflowTemplateRegistry",
    "get_agent_template_registry",
    "get_agent_tool_executor",
    "get_agent_tool_registry",
    "get_workflow_template_registry",
]
