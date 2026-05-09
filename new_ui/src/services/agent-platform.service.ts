import api from './api'

export interface AgentTool {
    name: string
    title: string
    description: string
    category: string
    input_schema: Record<string, unknown>
    output_schema: Record<string, unknown>
    auth_required: boolean
    safe_for_automation: boolean
}

export interface AgentDefinition {
    agent_id: string
    name: string
    description: string
    instruction: string
    tool_names: string[]
    model: string
    collection_ids: string[]
    metadata: Record<string, unknown>
    created_by: string
    created_at: string
    updated_at: string
}

export interface WorkflowDefinition {
    workflow_id: string
    name: string
    description: string
    agent_id?: string
    steps: Array<Record<string, unknown>>
    triggers: string[]
    metadata: Record<string, unknown>
    created_by: string
    created_at: string
    updated_at: string
}

export interface WorkflowTemplate {
    template_id: string
    name: string
    description: string
    required_inputs: string[]
    steps: Array<Record<string, unknown>>
}

export interface WorkflowRun {
    run_id: string
    workflow_id: string
    status: string
    dry_run: boolean
    inputs: Record<string, unknown>
    steps: Array<Record<string, unknown>>
    created_by: string
    created_at: string
    updated_at: string
}

export interface AuditEvent {
    event: string
    subject_type: string
    subject_id: string
    metadata: Record<string, unknown>
    created_by: string
    created_at: string
}

export interface ToolInvocationResult {
    step_id: string
    name: string
    tool_name: string
    arguments: Record<string, unknown>
    depends_on: string[]
    approval_required: boolean
    status: string
    output: unknown
    message: string
}

const BASE_PATH = '/api/v1/agent-platform'

export const agentPlatformService = {
    async getTools(): Promise<{ tools: AgentTool[]; mcp_tools: Array<Record<string, unknown>> }> {
        const response = await api.get(`${BASE_PATH}/tools`)
        return response.data
    },

    async getMcpManifest(): Promise<{ name: string; version: string; tools: Array<Record<string, unknown>> }> {
        const response = await api.get(`${BASE_PATH}/mcp/manifest`)
        return response.data
    },

    async invokeTool(data: {
        tool_name: string
        arguments: Record<string, unknown>
        dry_run?: boolean
    }): Promise<ToolInvocationResult> {
        const response = await api.post(`${BASE_PATH}/tool-invocations`, data)
        return response.data
    },

    async createAgent(data: {
        name: string
        instruction: string
        tool_names: string[]
        description?: string
        model?: string
        collection_ids?: string[]
        metadata?: Record<string, unknown>
    }): Promise<AgentDefinition> {
        const response = await api.post(`${BASE_PATH}/agents`, data)
        return response.data
    },

    async listAgents(): Promise<AgentDefinition[]> {
        const response = await api.get(`${BASE_PATH}/agents`)
        return response.data
    },

    async deleteAgent(agentId: string): Promise<void> {
        await api.delete(`${BASE_PATH}/agents/${agentId}`)
    },

    async createWorkflow(data: {
        name: string
        description?: string
        agent_id?: string
        steps: Array<Record<string, unknown>>
        triggers?: string[]
        metadata?: Record<string, unknown>
    }): Promise<WorkflowDefinition> {
        const response = await api.post(`${BASE_PATH}/workflows`, data)
        return response.data
    },

    async listWorkflowTemplates(): Promise<WorkflowTemplate[]> {
        const response = await api.get(`${BASE_PATH}/workflow-templates`)
        return response.data
    },

    async createWorkflowFromTemplate(data: {
        template_id: string
        name?: string
        description?: string
        agent_id?: string
        triggers?: string[]
        metadata?: Record<string, unknown>
    }): Promise<WorkflowDefinition> {
        const response = await api.post(`${BASE_PATH}/workflows/from-template`, data)
        return response.data
    },

    async listWorkflows(): Promise<WorkflowDefinition[]> {
        const response = await api.get(`${BASE_PATH}/workflows`)
        return response.data
    },

    async deleteWorkflow(workflowId: string): Promise<void> {
        await api.delete(`${BASE_PATH}/workflows/${workflowId}`)
    },

    async startWorkflowRun(
        workflowId: string,
        data: { inputs: Record<string, unknown>; dry_run: boolean }
    ): Promise<WorkflowRun> {
        const response = await api.post(`${BASE_PATH}/workflows/${workflowId}/runs`, data)
        return response.data
    },

    async listWorkflowRuns(workflowId?: string): Promise<WorkflowRun[]> {
        const params = workflowId ? `?workflow_id=${encodeURIComponent(workflowId)}` : ''
        const response = await api.get(`${BASE_PATH}/workflow-runs${params}`)
        return response.data
    },

    async listAuditEvents(limit = 25): Promise<AuditEvent[]> {
        const response = await api.get(`${BASE_PATH}/audit-events?limit=${limit}`)
        return response.data
    },
}

export default agentPlatformService
