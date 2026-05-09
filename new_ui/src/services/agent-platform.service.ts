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

export interface AgentTemplate {
    template_id: string
    name: string
    description: string
    instruction: string
    tool_names: string[]
    model: string
}

export interface McpServer {
    server_id: string
    name: string
    description: string
    transport: string
    url: string
    command: string
    args: string[]
    tool_names: string[]
    metadata: Record<string, unknown>
    last_health_status?: string
    last_health_message?: string
    last_health_checked_at?: string
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
    agent_id?: string
    retried_from?: string
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

export interface PlatformExport {
    schema_version: string
    exported_at: string
    owner: string
    mcp_manifest: Record<string, unknown>
    agents: AgentDefinition[]
    workflows: WorkflowDefinition[]
    mcp_servers: McpServer[]
    runs: WorkflowRun[]
    audit_events: AuditEvent[]
}

export interface PlatformImportSummary {
    agents_imported: number
    workflows_imported: number
    mcp_servers_imported: number
    agent_id_map: Record<string, string>
    workflow_id_map: Record<string, string>
    mcp_server_id_map: Record<string, string>
}

export interface PlatformStats {
    agents: number
    workflows: number
    tools: number
    runs: number
    active_runs: number
    run_statuses: Record<string, number>
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

    async getAdkManifest(): Promise<Record<string, unknown>> {
        const response = await api.get(`${BASE_PATH}/adk/manifest`)
        return response.data
    },

    async getStats(): Promise<PlatformStats> {
        const response = await api.get(`${BASE_PATH}/stats`)
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

    async listAgentTemplates(): Promise<AgentTemplate[]> {
        const response = await api.get(`${BASE_PATH}/agent-templates`)
        return response.data
    },

    async createAgentFromTemplate(data: {
        template_id: string
        name?: string
        description?: string
        instruction?: string
        tool_names?: string[]
        model?: string
        collection_ids?: string[]
        metadata?: Record<string, unknown>
    }): Promise<AgentDefinition> {
        const response = await api.post(`${BASE_PATH}/agents/from-template`, data)
        return response.data
    },

    async updateAgent(
        agentId: string,
        data: {
            name?: string
            instruction?: string
            tool_names?: string[]
            description?: string
            model?: string
            collection_ids?: string[]
            metadata?: Record<string, unknown>
        }
    ): Promise<AgentDefinition> {
        const response = await api.patch(`${BASE_PATH}/agents/${agentId}`, data)
        return response.data
    },

    async listAgents(): Promise<AgentDefinition[]> {
        const response = await api.get(`${BASE_PATH}/agents`)
        return response.data
    },

    async deleteAgent(agentId: string): Promise<void> {
        await api.delete(`${BASE_PATH}/agents/${agentId}`)
    },

    async createMcpServer(data: {
        name: string
        transport: string
        url?: string
        command?: string
        args?: string[]
        tool_names?: string[]
        description?: string
        metadata?: Record<string, unknown>
    }): Promise<McpServer> {
        const response = await api.post(`${BASE_PATH}/mcp-servers`, data)
        return response.data
    },

    async updateMcpServer(
        serverId: string,
        data: {
            name?: string
            transport?: string
            url?: string
            command?: string
            args?: string[]
            tool_names?: string[]
            description?: string
            metadata?: Record<string, unknown>
        }
    ): Promise<McpServer> {
        const response = await api.patch(`${BASE_PATH}/mcp-servers/${serverId}`, data)
        return response.data
    },

    async listMcpServers(): Promise<McpServer[]> {
        const response = await api.get(`${BASE_PATH}/mcp-servers`)
        return response.data
    },

    async deleteMcpServer(serverId: string): Promise<void> {
        await api.delete(`${BASE_PATH}/mcp-servers/${serverId}`)
    },

    async checkMcpServer(serverId: string): Promise<McpServer> {
        const response = await api.post(`${BASE_PATH}/mcp-servers/${serverId}/health-check`)
        return response.data
    },

    async startAgentRun(
        agentId: string,
        data: { query: string; collection_ids?: string[]; dry_run: boolean }
    ): Promise<WorkflowRun> {
        const response = await api.post(`${BASE_PATH}/agents/${agentId}/runs`, data)
        return response.data
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

    async updateWorkflow(
        workflowId: string,
        data: {
            name?: string
            description?: string
            agent_id?: string
            steps?: Array<Record<string, unknown>>
            triggers?: string[]
            metadata?: Record<string, unknown>
        }
    ): Promise<WorkflowDefinition> {
        const response = await api.patch(`${BASE_PATH}/workflows/${workflowId}`, data)
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

    async startTriggerRuns(
        triggerName: string,
        data: { inputs: Record<string, unknown>; dry_run: boolean }
    ): Promise<WorkflowRun[]> {
        const response = await api.post(`${BASE_PATH}/triggers/${encodeURIComponent(triggerName)}/runs`, data)
        return response.data
    },

    async listWorkflowRuns(workflowId?: string): Promise<WorkflowRun[]> {
        const params = workflowId ? `?workflow_id=${encodeURIComponent(workflowId)}` : ''
        const response = await api.get(`${BASE_PATH}/workflow-runs${params}`)
        return response.data
    },

    async approveWorkflowStep(runId: string, stepId: string): Promise<WorkflowRun> {
        const response = await api.post(`${BASE_PATH}/workflow-runs/${runId}/steps/${stepId}/approve`)
        return response.data
    },

    async cancelWorkflowRun(runId: string): Promise<WorkflowRun> {
        const response = await api.post(`${BASE_PATH}/workflow-runs/${runId}/cancel`)
        return response.data
    },

    async retryWorkflowRun(runId: string, dryRun?: boolean): Promise<WorkflowRun> {
        const response = await api.post(`${BASE_PATH}/workflow-runs/${runId}/retry`, {
            dry_run: dryRun,
        })
        return response.data
    },

    async listAuditEvents(limit = 25): Promise<AuditEvent[]> {
        const response = await api.get(`${BASE_PATH}/audit-events?limit=${limit}`)
        return response.data
    },

    async exportPlatform(): Promise<PlatformExport> {
        const response = await api.get(`${BASE_PATH}/export`)
        return response.data
    },

    async importPlatform(data: {
        agents?: Array<Record<string, unknown>>
        workflows?: Array<Record<string, unknown>>
        mcp_servers?: Array<Record<string, unknown>>
    }): Promise<PlatformImportSummary> {
        const response = await api.post(`${BASE_PATH}/import`, data)
        return response.data
    },
}

export default agentPlatformService
