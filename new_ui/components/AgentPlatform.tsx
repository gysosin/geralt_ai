import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Bot,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleDashed,
  Copy,
  Download,
  FileCode2,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Route,
  Search,
  Settings2,
  Trash2,
  Workflow,
  XCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  agentPlatformService,
  type AdkManifest,
  type AuditEvent,
  type AgentDefinition,
  type AgentTemplate,
  type AgentTool,
  type ExternalMcpTool,
  type McpServer,
  type PendingApproval,
  type PlatformStats,
  type ToolInvocationResult,
  type WorkflowDefinition,
  type WorkflowRun,
  type WorkflowRunTrace,
  type WorkflowTemplate,
  type WorkflowTrigger,
} from '../src/services/agent-platform.service';
import { getAdkManifestSummary, getAdkToolsetTarget } from '../src/utils/agent-platform-adk';
import { buildMcpServerPayload, isMcpServerFormReady, type McpTransport } from '../src/utils/agent-platform-mcp';
import { getAgentPlatformStats } from '../src/utils/agent-platform-stats';
import {
  buildWorkflowSteps,
  canCancelWorkflowRun,
  canRunWorkflowAgain,
  defaultWorkflowStepDrafts,
  filterWorkflowRunsByStatus,
  mcpToolToWorkflowStepDraft,
  normalizeApprovalRejectionReason,
  workflowStepsToDrafts,
  type WorkflowStepDraft,
} from '../src/utils/agent-platform-workflow';

const splitIds = (value: string) =>
  value.split(',').map((item) => item.trim()).filter(Boolean);

const statusTone: Record<string, string> = {
  completed: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  planned: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  pending: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  blocked: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
  pending_approval: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  canceled: 'text-gray-300 bg-white/5 border-white/10',
  failed: 'text-red-300 bg-red-500/10 border-red-500/20',
};

const RUN_PAGE_SIZE = 8;
const RUN_FETCH_SIZE = RUN_PAGE_SIZE + 1;

const AgentPlatform: React.FC = () => {
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [agentTemplates, setAgentTemplates] = useState<AgentTemplate[]>([]);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [externalMcpTools, setExternalMcpTools] = useState<ExternalMcpTool[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [automationTriggers, setAutomationTriggers] = useState<WorkflowTrigger[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [showArchivedRuns, setShowArchivedRuns] = useState(false);
  const [runStatusFilter, setRunStatusFilter] = useState('all');
  const [runPage, setRunPage] = useState(0);
  const [hasMoreRuns, setHasMoreRuns] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [approvalRejectionReasons, setApprovalRejectionReasons] = useState<Record<string, string>>({});
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [toolResult, setToolResult] = useState<ToolInvocationResult | null>(null);
  const [runTrace, setRunTrace] = useState<WorkflowRunTrace | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [adkManifest, setAdkManifest] = useState<AdkManifest | null>(null);
  const [exportSummary, setExportSummary] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [adkCopied, setAdkCopied] = useState(false);

  const [agentName, setAgentName] = useState('Document Operations Agent');
  const [agentInstruction, setAgentInstruction] = useState('Plan the user request, search or aggregate selected document collections, and return grounded results.');
  const [selectedTools, setSelectedTools] = useState<string[]>(['query.plan', 'rag.aggregate']);
  const [agentCollections, setAgentCollections] = useState('');
  const [editingAgentId, setEditingAgentId] = useState('');
  const [selectedAgentTemplateId, setSelectedAgentTemplateId] = useState('');
  const [mcpName, setMcpName] = useState('Docs MCP');
  const [mcpTransport, setMcpTransport] = useState<McpTransport>('streamable_http');
  const [mcpUrl, setMcpUrl] = useState('');
  const [mcpCommand, setMcpCommand] = useState('');
  const [mcpArgs, setMcpArgs] = useState('');
  const [mcpToolNames, setMcpToolNames] = useState('');
  const [editingMcpServerId, setEditingMcpServerId] = useState('');

  const [workflowName, setWorkflowName] = useState('Document Aggregation Workflow');
  const [workflowAgentId, setWorkflowAgentId] = useState('');
  const [workflowTriggers, setWorkflowTriggers] = useState('document.uploaded');
  const [workflowStepDrafts, setWorkflowStepDrafts] = useState<WorkflowStepDraft[]>(defaultWorkflowStepDrafts);
  const [editingWorkflowId, setEditingWorkflowId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('document_aggregation');
  const [runAgentId, setRunAgentId] = useState('');
  const [runWorkflowId, setRunWorkflowId] = useState('');
  const [triggerName, setTriggerName] = useState('document.uploaded');
  const [runQuery, setRunQuery] = useState('total amount by vendor');
  const [runCollections, setRunCollections] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [invokeToolName, setInvokeToolName] = useState('query.plan');
  const [invokeQuery, setInvokeQuery] = useState('list all vendors');

  const applyRunPageResult = (pageRuns: WorkflowRun[]) => {
    setHasMoreRuns(pageRuns.length > RUN_PAGE_SIZE);
    setRuns(pageRuns.slice(0, RUN_PAGE_SIZE));
  };

  const loadRunsPage = async (
    page = runPage,
    includeArchived = showArchivedRuns,
    status = runStatusFilter
  ) => {
    const pageRuns = await agentPlatformService.listWorkflowRuns(
      undefined,
      includeArchived,
      status,
      RUN_FETCH_SIZE,
      page * RUN_PAGE_SIZE
    );
    setRunPage(page);
    applyRunPageResult(pageRuns || []);
  };

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [toolResult, agentTemplateResult, agentResult, mcpServerResult, externalMcpToolResult, workflowResult, templateResult, triggerResult, runResult, approvalResult, auditResult, statsResult] = await Promise.allSettled([
        agentPlatformService.getTools(),
        agentPlatformService.listAgentTemplates(),
        agentPlatformService.listAgents(),
        agentPlatformService.listMcpServers(),
        agentPlatformService.listExternalMcpTools(),
        agentPlatformService.listWorkflows(),
        agentPlatformService.listWorkflowTemplates(),
        agentPlatformService.listWorkflowTriggers(),
        agentPlatformService.listWorkflowRuns(
          undefined,
          showArchivedRuns,
          runStatusFilter,
          RUN_FETCH_SIZE,
          runPage * RUN_PAGE_SIZE
        ),
        agentPlatformService.listPendingApprovals(),
        agentPlatformService.listAuditEvents(),
        agentPlatformService.getStats(),
      ]);
      setTools(toolResult.status === 'fulfilled' ? toolResult.value.tools || [] : []);
      setAgentTemplates(agentTemplateResult.status === 'fulfilled' ? agentTemplateResult.value || [] : []);
      const loadedAgents = agentResult.status === 'fulfilled' ? agentResult.value || [] : [];
      setAgents(loadedAgents);
      setMcpServers(mcpServerResult.status === 'fulfilled' ? mcpServerResult.value || [] : []);
      setExternalMcpTools(externalMcpToolResult.status === 'fulfilled' ? externalMcpToolResult.value || [] : []);
      const loadedWorkflows = workflowResult.status === 'fulfilled' ? workflowResult.value || [] : [];
      setWorkflows(loadedWorkflows);
      const loadedTemplates = templateResult.status === 'fulfilled' ? templateResult.value || [] : [];
      setTemplates(loadedTemplates);
      if (!selectedTemplateId && loadedTemplates?.[0]?.template_id) {
        setSelectedTemplateId(loadedTemplates[0].template_id);
      }
      setAutomationTriggers(triggerResult.status === 'fulfilled' ? triggerResult.value || [] : []);
      applyRunPageResult(runResult.status === 'fulfilled' ? runResult.value || [] : []);
      setPendingApprovals(approvalResult.status === 'fulfilled' ? approvalResult.value || [] : []);
      setAuditEvents(auditResult.status === 'fulfilled' ? auditResult.value || [] : []);
      setPlatformStats(statsResult.status === 'fulfilled' ? statsResult.value : null);
      if (!runWorkflowId && loadedWorkflows?.[0]?.workflow_id) {
        setRunWorkflowId(loadedWorkflows[0].workflow_id);
      }
      if (!runAgentId && loadedAgents?.[0]?.agent_id) {
        setRunAgentId(loadedAgents[0].agent_id);
      }
      if ([toolResult, agentTemplateResult, agentResult, mcpServerResult, externalMcpToolResult, workflowResult, templateResult, triggerResult, runResult, approvalResult, auditResult, statsResult].some((result) => result.status === 'rejected')) {
        setError('Some platform records are unavailable. Tool registry is still loaded when the API is reachable.');
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load agent platform data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toolCategories = useMemo(() => {
    return tools.reduce<Record<string, AgentTool[]>>((acc, tool) => {
      acc[tool.category] = acc[tool.category] || [];
      acc[tool.category].push(tool);
      return acc;
    }, {});
  }, [tools]);

  const displayStats = useMemo(() => getAgentPlatformStats({
    tools,
    agents,
    workflows,
    mcpServers,
    runs,
    pendingApprovals,
    platformStats,
  }), [tools, agents, workflows, mcpServers, runs, pendingApprovals, platformStats]);
  const visibleRuns = useMemo(
    () => filterWorkflowRunsByStatus(runs, runStatusFilter),
    [runs, runStatusFilter]
  );
  const adkSummary = useMemo(() => getAdkManifestSummary(adkManifest), [adkManifest]);
  const adkManifestJson = useMemo(() => (
    adkManifest ? JSON.stringify(adkManifest, null, 2) : ''
  ), [adkManifest]);

  const handleToolToggle = (toolName: string) => {
    setSelectedTools((current) =>
      current.includes(toolName)
        ? current.filter((name) => name !== toolName)
        : [...current, toolName]
    );
  };

  const applyAgentTemplate = (templateId: string) => {
    setSelectedAgentTemplateId(templateId);
    const template = agentTemplates.find((item) => item.template_id === templateId);
    if (!template) return;
    setAgentName(template.name);
    setAgentInstruction(template.instruction);
    setSelectedTools(template.tool_names);
  };

  const createAgent = async () => {
    if (!agentName.trim() || !agentInstruction.trim() || selectedTools.length === 0) return;
    setIsSubmitting(true);
    setError('');
    try {
      const payload = {
        name: agentName,
        instruction: agentInstruction,
        tool_names: selectedTools,
        collection_ids: splitIds(agentCollections),
        model: 'default',
      };
      if (editingAgentId) {
        const updated = await agentPlatformService.updateAgent(editingAgentId, payload);
        setAgents((current) => current.map((agent) => (agent.agent_id === updated.agent_id ? updated : agent)));
        setEditingAgentId('');
      } else {
        const created = selectedAgentTemplateId
          ? await agentPlatformService.createAgentFromTemplate({
            template_id: selectedAgentTemplateId,
            ...payload,
          })
          : await agentPlatformService.createAgent(payload);
        setAgents((current) => [created, ...current]);
        setWorkflowAgentId(created.agent_id);
        setRunAgentId(created.agent_id);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save agent');
    } finally {
      setIsSubmitting(false);
    }
  };

  const editAgent = (agent: AgentDefinition) => {
    setEditingAgentId(agent.agent_id);
    setAgentName(agent.name);
    setAgentInstruction(agent.instruction);
    setSelectedTools(agent.tool_names);
    setAgentCollections(agent.collection_ids.join(', '));
    setSelectedAgentTemplateId('');
  };

  const createWorkflow = async () => {
    if (!workflowName.trim()) return;
    setIsSubmitting(true);
    setError('');
    try {
      const customStepResult = selectedTemplateId ? null : buildWorkflowSteps(workflowStepDrafts);
      if (customStepResult?.errors.length) {
        setError(customStepResult.errors.join(' '));
        return;
      }

      if (editingWorkflowId) {
        const selectedSteps = selectedTemplateId ? selectedTemplate?.steps : customStepResult?.steps;
        const updated = await agentPlatformService.updateWorkflow(editingWorkflowId, {
          name: workflowName,
          agent_id: workflowAgentId || undefined,
          triggers: splitIds(workflowTriggers),
          steps: selectedSteps,
        });
        setWorkflows((current) => current.map((workflow) => (
          workflow.workflow_id === updated.workflow_id ? updated : workflow
        )));
        setEditingWorkflowId('');
        return;
      }

      const created = selectedTemplateId
        ? await agentPlatformService.createWorkflowFromTemplate({
          template_id: selectedTemplateId,
          name: workflowName,
          agent_id: workflowAgentId || undefined,
          triggers: splitIds(workflowTriggers),
        })
        : await agentPlatformService.createWorkflow({
          name: workflowName,
          agent_id: workflowAgentId || undefined,
          triggers: splitIds(workflowTriggers),
          steps: customStepResult?.steps || [],
        });
      setWorkflows((current) => [created, ...current]);
      setRunWorkflowId(created.workflow_id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create workflow');
    } finally {
      setIsSubmitting(false);
    }
  };

  const editWorkflow = (workflow: WorkflowDefinition) => {
    setEditingWorkflowId(workflow.workflow_id);
    setWorkflowName(workflow.name);
    setWorkflowAgentId(workflow.agent_id || '');
    setWorkflowTriggers(workflow.triggers.join(', '));
    setWorkflowStepDrafts(workflowStepsToDrafts(workflow.steps));
    setSelectedTemplateId('');
  };

  const cloneAgent = async (agent: AgentDefinition) => {
    setIsSubmitting(true);
    setError('');
    try {
      const created = await agentPlatformService.cloneAgent(agent.agent_id, {
        name: `${agent.name} Copy`,
      });
      setAgents((current) => [created, ...current]);
      setRunAgentId(created.agent_id);
      const [auditResult, statsResult] = await Promise.all([
        agentPlatformService.listAuditEvents(),
        agentPlatformService.getStats(),
      ]);
      setAuditEvents(auditResult);
      setPlatformStats(statsResult);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to clone agent');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cloneWorkflow = async (workflow: WorkflowDefinition) => {
    setIsSubmitting(true);
    setError('');
    try {
      const created = await agentPlatformService.cloneWorkflow(workflow.workflow_id, {
        name: `${workflow.name} Copy`,
      });
      setWorkflows((current) => [created, ...current]);
      setRunWorkflowId(created.workflow_id);
      const [auditResult, statsResult] = await Promise.all([
        agentPlatformService.listAuditEvents(),
        agentPlatformService.getStats(),
      ]);
      setAuditEvents(auditResult);
      setPlatformStats(statsResult);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to clone workflow');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateWorkflowStepDraft = (index: number, updates: Partial<WorkflowStepDraft>) => {
    setWorkflowStepDrafts((current) => current.map((draft, draftIndex) => (
      draftIndex === index ? { ...draft, ...updates } : draft
    )));
  };

  const addWorkflowStepDraft = () => {
    setWorkflowStepDrafts((current) => [
      ...current,
      {
        name: `Step ${current.length + 1}`,
        toolName: tools.find((tool) => tool.name !== 'agent.run')?.name || 'query.plan',
        argumentsJson: '{}',
        dependsOn: current.length > 0 ? `step-${current.length}` : '',
        approvalRequired: false,
      },
    ]);
  };

  const addMcpWorkflowStepDraft = (tool: ExternalMcpTool) => {
    setSelectedTemplateId('');
    setWorkflowStepDrafts((current) => [
      ...current,
      mcpToolToWorkflowStepDraft(tool, current.length),
    ]);
  };

  const removeWorkflowStepDraft = (index: number) => {
    setWorkflowStepDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index));
  };

  const createMcpServer = async () => {
    if (!isMcpServerFormReady({
      name: mcpName,
      transport: mcpTransport,
      url: mcpUrl,
      command: mcpCommand,
    })) return;
    setIsSubmitting(true);
    setError('');
    try {
      const payload = buildMcpServerPayload({
        name: mcpName,
        url: mcpUrl,
        transport: mcpTransport,
        command: mcpCommand,
        args: mcpArgs,
        toolNames: mcpToolNames,
      });
      if (editingMcpServerId) {
        const updated = await agentPlatformService.updateMcpServer(editingMcpServerId, payload);
        setMcpServers((current) => current.map((server) => (
          server.server_id === updated.server_id ? updated : server
        )));
        setEditingMcpServerId('');
      } else {
        const created = await agentPlatformService.createMcpServer(payload);
        setMcpServers((current) => [created, ...current]);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save MCP server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const editMcpServer = (server: McpServer) => {
    setEditingMcpServerId(server.server_id);
    setMcpName(server.name);
    setMcpTransport(server.transport === 'stdio' ? 'stdio' : 'streamable_http');
    setMcpUrl(server.url);
    setMcpCommand(server.command);
    setMcpArgs(server.args.join(', '));
    setMcpToolNames(server.tool_names.join(', '));
  };

  const selectedTemplate = templates.find((template) => template.template_id === selectedTemplateId);

  const startAgentRun = async () => {
    if (!runAgentId) return;
    setIsSubmitting(true);
    setError('');
    try {
      const collectionIds = splitIds(runCollections);
      await agentPlatformService.startAgentRun(runAgentId, {
        dry_run: dryRun,
        query: runQuery,
        collection_ids: collectionIds.length > 0 ? collectionIds : undefined,
      });
      await loadRunsPage(0);
      setPendingApprovals(await agentPlatformService.listPendingApprovals());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to start agent run');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startRun = async () => {
    if (!runWorkflowId) return;
    setIsSubmitting(true);
    setError('');
    try {
      await agentPlatformService.startWorkflowRun(runWorkflowId, {
        dry_run: dryRun,
        inputs: {
          query: runQuery,
          collection_ids: splitIds(runCollections),
        },
      });
      await loadRunsPage(0);
      setPendingApprovals(await agentPlatformService.listPendingApprovals());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to start workflow run');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startTriggerRuns = async (selectedTrigger = triggerName) => {
    const nextTrigger = selectedTrigger.trim();
    if (!nextTrigger) return;
    setIsSubmitting(true);
    setError('');
    try {
      setTriggerName(nextTrigger);
      await agentPlatformService.startTriggerRuns(nextTrigger, {
        dry_run: dryRun,
        inputs: {
          query: runQuery,
          collection_ids: splitIds(runCollections),
        },
      });
      await loadRunsPage(0);
      setPendingApprovals(await agentPlatformService.listPendingApprovals());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to start trigger runs');
    } finally {
      setIsSubmitting(false);
    }
  };

  const approveWorkflowStep = async (runId: string, stepId: string) => {
    setIsSubmitting(true);
    setError('');
    try {
      const updated = await agentPlatformService.approveWorkflowStep(runId, stepId);
      setRuns((current) => current.map((run) => (run.run_id === updated.run_id ? updated : run)));
      setPendingApprovals(await agentPlatformService.listPendingApprovals());
      setAuditEvents(await agentPlatformService.listAuditEvents());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to approve workflow step');
    } finally {
      setIsSubmitting(false);
    }
  };

  const approvalKey = (runId: string, stepId: string) => `${runId}:${stepId}`;

  const rejectWorkflowStep = async (runId: string, stepId: string) => {
    setIsSubmitting(true);
    setError('');
    try {
      const rejectionKey = approvalKey(runId, stepId);
      const updated = await agentPlatformService.rejectWorkflowStep(
        runId,
        stepId,
        normalizeApprovalRejectionReason(approvalRejectionReasons[rejectionKey] || '')
      );
      setRuns((current) => current.map((run) => (run.run_id === updated.run_id ? updated : run)));
      setPendingApprovals(await agentPlatformService.listPendingApprovals());
      setAuditEvents(await agentPlatformService.listAuditEvents());
      setApprovalRejectionReasons((current) => {
        const next = { ...current };
        delete next[rejectionKey];
        return next;
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to reject workflow step');
    } finally {
      setIsSubmitting(false);
    }
  };

  const approveAllPendingWorkflowSteps = async () => {
    if (pendingApprovals.length === 0) return;
    setIsSubmitting(true);
    setError('');
    try {
      const result = await agentPlatformService.approveAllPendingWorkflowSteps();
      setRuns((current) => {
        const approvedById = new Map(result.runs.map((run) => [run.run_id, run]));
        const merged = current.map((run) => approvedById.get(run.run_id) || run);
        const currentIds = new Set(current.map((run) => run.run_id));
        return [
          ...result.runs.filter((run) => !currentIds.has(run.run_id)),
          ...merged,
        ];
      });
      setPendingApprovals(await agentPlatformService.listPendingApprovals());
      setAuditEvents(await agentPlatformService.listAuditEvents());
      setExportSummary(`${result.approved_count} approval${result.approved_count === 1 ? '' : 's'} cleared`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to approve pending workflow steps');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelWorkflowRun = async (runId: string) => {
    setIsSubmitting(true);
    setError('');
    try {
      await agentPlatformService.cancelWorkflowRun(runId);
      await loadRunsPage(runPage);
      setAuditEvents(await agentPlatformService.listAuditEvents());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to cancel workflow run');
    } finally {
      setIsSubmitting(false);
    }
  };

  const archiveWorkflowRuns = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const result = await agentPlatformService.archiveWorkflowRuns();
      await loadRunsPage(0);
      setPlatformStats(await agentPlatformService.getStats());
      setAuditEvents(await agentPlatformService.listAuditEvents());
      setExportSummary(`${result.archived_count} run${result.archived_count === 1 ? '' : 's'} archived`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to archive workflow runs');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleArchivedRuns = async (checked: boolean) => {
    setShowArchivedRuns(checked);
    setIsSubmitting(true);
    setError('');
    try {
      await loadRunsPage(0, checked, runStatusFilter);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to load workflow runs');
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeRunStatusFilter = async (status: string) => {
    setRunStatusFilter(status);
    setIsSubmitting(true);
    setError('');
    try {
      await loadRunsPage(0, showArchivedRuns, status);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to load workflow runs');
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeRunPage = async (page: number) => {
    if (page < 0) return;
    setIsSubmitting(true);
    setError('');
    try {
      await loadRunsPage(page);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to load workflow runs');
    } finally {
      setIsSubmitting(false);
    }
  };

  const retryWorkflowRun = async (runId: string) => {
    setIsSubmitting(true);
    setError('');
    try {
      await agentPlatformService.retryWorkflowRun(runId, dryRun);
      await loadRunsPage(0);
      const [approvalResult, auditResult, statsResult] = await Promise.all([
        agentPlatformService.listPendingApprovals(),
        agentPlatformService.listAuditEvents(),
        agentPlatformService.getStats(),
      ]);
      setPendingApprovals(approvalResult);
      setAuditEvents(auditResult);
      setPlatformStats(statsResult);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to retry workflow run');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadRunTrace = async (runId: string) => {
    setIsSubmitting(true);
    setError('');
    try {
      setRunTrace(await agentPlatformService.getWorkflowRunTrace(runId));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to load run trace');
    } finally {
      setIsSubmitting(false);
    }
  };

  const invokeTool = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const result = await agentPlatformService.invokeTool({
        tool_name: invokeToolName,
        arguments: invokeToolName === 'query.plan'
          ? { query: invokeQuery }
          : invokeToolName === 'collection.summarize'
            ? { collection_id: splitIds(runCollections)[0] || '' }
            : { query: invokeQuery, collection_ids: splitIds(runCollections) },
      });
      setToolResult(result);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to invoke tool');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteAgent = async (agentId: string) => {
    setIsSubmitting(true);
    setError('');
    try {
      await agentPlatformService.deleteAgent(agentId);
      setAgents((current) => current.filter((agent) => agent.agent_id !== agentId));
      if (workflowAgentId === agentId) setWorkflowAgentId('');
      if (runAgentId === agentId) setRunAgentId('');
      if (editingAgentId === agentId) setEditingAgentId('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to delete agent');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteWorkflow = async (workflowId: string) => {
    setIsSubmitting(true);
    setError('');
    try {
      await agentPlatformService.deleteWorkflow(workflowId);
      setWorkflows((current) => current.filter((workflow) => workflow.workflow_id !== workflowId));
      if (runWorkflowId === workflowId) setRunWorkflowId('');
      if (editingWorkflowId === workflowId) setEditingWorkflowId('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to delete workflow');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteMcpServer = async (serverId: string) => {
    setIsSubmitting(true);
    setError('');
    try {
      await agentPlatformService.deleteMcpServer(serverId);
      setMcpServers((current) => current.filter((server) => server.server_id !== serverId));
      if (editingMcpServerId === serverId) setEditingMcpServerId('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to delete MCP server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkMcpServer = async (serverId: string) => {
    setIsSubmitting(true);
    setError('');
    try {
      const updated = await agentPlatformService.checkMcpServer(serverId);
      setMcpServers((current) => current.map((server) => (
        server.server_id === updated.server_id ? updated : server
      )));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to check MCP server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkAllMcpServers = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const updated = await agentPlatformService.checkAllMcpServers();
      setMcpServers(updated);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to check MCP servers');
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportPlatform = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const exported = await agentPlatformService.exportPlatform();
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `geralt-agent-platform-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setExportSummary(`${exported.agents.length} agents, ${exported.workflows.length} workflows, ${exported.runs.length} runs`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to export platform data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadAdkManifestPreview = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const manifest = await agentPlatformService.getAdkManifest();
      setAdkManifest(manifest);
      setExportSummary(`ADK manifest loaded: ${manifest.adk_toolsets.length} toolsets`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to load ADK manifest');
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportAdkManifest = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const manifest = adkManifest || await agentPlatformService.getAdkManifest();
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `geralt-adk-manifest-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setExportSummary('ADK manifest ready');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to export ADK manifest');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyAdkManifest = async () => {
    if (!adkManifestJson) return;
    await navigator.clipboard.writeText(adkManifestJson);
    setAdkCopied(true);
    window.setTimeout(() => setAdkCopied(false), 1800);
  };

  const importPlatformFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsSubmitting(true);
    setError('');
    try {
      const payload = JSON.parse(await file.text());
      const result = await agentPlatformService.importPlatform({
        agents: Array.isArray(payload.agents) ? payload.agents : [],
        workflows: Array.isArray(payload.workflows) ? payload.workflows : [],
        mcp_servers: Array.isArray(payload.mcp_servers) ? payload.mcp_servers : [],
      });
      setExportSummary(`${result.agents_imported} agents, ${result.workflows_imported} workflows, ${result.mcp_servers_imported} MCP servers imported`);
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to import platform data');
    } finally {
      setIsSubmitting(false);
      event.target.value = '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1600px] mx-auto space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold uppercase tracking-[0.18em] mb-2">
            <Workflow size={16} />
            Agent Platform
          </div>
          <h1 className="text-3xl font-bold text-white">Agents, Tools, Workflows</h1>
          <p className="text-gray-400 mt-2">Create reusable agents and run deterministic document workflows.</p>
        </div>
        <button
          onClick={loadData}
          className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white flex items-center gap-2"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
        <button
          onClick={exportPlatform}
          className="h-10 px-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15 text-sm text-emerald-100 flex items-center gap-2"
        >
          <CheckCircle2 size={16} />
          Export
        </button>
        <button
          onClick={loadAdkManifestPreview}
          className="h-10 px-4 rounded-xl border border-sky-500/20 bg-sky-500/10 hover:bg-sky-500/15 text-sm text-sky-100 flex items-center gap-2"
        >
          <FileCode2 size={16} />
          ADK Preview
        </button>
        <label className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white flex items-center gap-2 cursor-pointer">
          <Workflow size={16} />
          Import
          <input
            type="file"
            accept="application/json,.json"
            onChange={importPlatformFile}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <div className="border border-red-500/20 bg-red-500/10 text-red-200 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {exportSummary && (
        <div className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-100 rounded-xl px-4 py-3 text-sm">
          Export ready: {exportSummary}
        </div>
      )}

      {adkManifest && (
        <section className="border border-sky-500/10 bg-surface/30 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <p className="text-xs text-sky-300 uppercase tracking-[0.18em]">ADK Manifest</p>
              <h2 className="text-xl font-semibold text-white mt-1">{adkManifest.name}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={copyAdkManifest}
                className="h-9 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white flex items-center gap-2"
              >
                {adkCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                {adkCopied ? 'Copied' : 'Copy JSON'}
              </button>
              <button
                onClick={exportAdkManifest}
                disabled={isSubmitting}
                className="h-9 px-3 rounded-xl border border-sky-500/20 bg-sky-500/10 hover:bg-sky-500/15 disabled:opacity-60 text-xs text-sky-100 flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Download JSON
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            {[
              { label: 'Tools', value: adkSummary.tools },
              { label: 'Agents', value: adkSummary.agents },
              { label: 'Workflows', value: adkSummary.workflows },
              { label: 'MCP Servers', value: adkSummary.externalMcpServers },
              { label: 'Toolsets', value: adkSummary.toolsets },
              { label: 'HTTP', value: adkSummary.httpToolsets },
              { label: 'Stdio', value: adkSummary.stdioToolsets },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                <p className="text-[11px] text-gray-500 uppercase tracking-wider">{item.label}</p>
                <p className="text-2xl font-semibold text-white mt-1">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {adkManifest.adk_toolsets.map((toolset) => (
              <div key={toolset.server_id || toolset.name} className="rounded-xl border border-white/5 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-white truncate">{toolset.name || toolset.server_id}</p>
                  <span className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-200">
                    {toolset.connection_params?.type || toolset.transport}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500 font-mono truncate">{getAdkToolsetTarget(toolset)}</p>
                <p className="mt-2 text-[11px] text-gray-400">
                  {(toolset.tool_filter || []).length || 'All'} tool{(toolset.tool_filter || []).length === 1 ? '' : 's'}
                </p>
              </div>
            ))}
            {adkManifest.adk_toolsets.length === 0 && (
              <div className="rounded-xl border border-white/5 bg-black/20 p-4 text-sm text-gray-500">
                No external ADK toolsets
              </div>
            )}
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/5 bg-black/30 p-4 text-[11px] leading-relaxed text-gray-400 font-mono">
            {adkManifestJson}
          </pre>
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Registered Tools', value: displayStats.tools, icon: Settings2 },
              { label: 'Agents', value: displayStats.agents, icon: Bot },
              { label: 'Workflows', value: displayStats.workflows, icon: Route },
              { label: 'MCP Servers', value: displayStats.mcpServers, icon: Settings2 },
              {
                label: 'Reachable MCP',
                value: `${displayStats.reachableMcpServers}/${displayStats.mcpServers}`,
                icon: CheckCircle2,
              },
              { label: 'Runs', value: displayStats.runs, icon: Play },
              { label: 'Active Runs', value: displayStats.activeRuns, icon: CircleDashed },
              { label: 'Approvals', value: displayStats.pendingApprovals, icon: CheckCircle2 },
            ].map((item) => (
              <div key={item.label} className="border border-white/5 bg-surface/30 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">{item.label}</p>
                    <p className="text-3xl text-white font-bold mt-2">{item.value}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/5 text-gray-300 flex items-center justify-center">
                    <item.icon size={20} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <section className="border border-white/5 bg-surface/30 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Tool Registry</h2>
              {isLoading && <Loader2 size={18} className="text-gray-500 animate-spin" />}
            </div>
            <div className="space-y-5">
              {Object.entries(toolCategories).map(([category, categoryTools]) => (
                <div key={category}>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">{category}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {categoryTools.map((tool) => {
                      const isWorkflowOnlyTool = tool.name === 'agent.run';
                      return (
                        <label
                          key={tool.name}
                          className={`flex gap-3 p-4 rounded-xl border border-white/5 bg-black/20 hover:border-white/10 transition-colors ${
                            isWorkflowOnlyTool ? 'cursor-default opacity-75' : 'cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!isWorkflowOnlyTool && selectedTools.includes(tool.name)}
                            onChange={() => !isWorkflowOnlyTool && handleToolToggle(tool.name)}
                            disabled={isWorkflowOnlyTool}
                            className="mt-1 accent-emerald-500 disabled:opacity-40"
                          />
                          <span>
                            <span className="block text-white font-medium">{tool.title}</span>
                            <span className="block text-xs text-gray-500 font-mono mt-1">{tool.name}</span>
                            <span className="block text-sm text-gray-400 mt-2">{tool.description}</span>
                            {isWorkflowOnlyTool && (
                              <span className="inline-flex mt-3 rounded-lg border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-200">
                                Workflow step only
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-white/5 bg-surface/30 rounded-2xl p-5 space-y-4">
              <h2 className="text-lg font-semibold text-white">New Agent</h2>
              <select
                value={selectedAgentTemplateId}
                onChange={(event) => applyAgentTemplate(event.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
              >
                <option value="">Custom agent</option>
                {agentTemplates.map((template) => (
                  <option key={template.template_id} value={template.template_id}>{template.name}</option>
                ))}
              </select>
              <input
                value={agentName}
                onChange={(event) => setAgentName(event.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
              />
              <textarea
                value={agentInstruction}
                onChange={(event) => setAgentInstruction(event.target.value)}
                rows={5}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/60 resize-none"
              />
              <input
                value={agentCollections}
                onChange={(event) => setAgentCollections(event.target.value)}
                placeholder="collection-id-1, collection-id-2"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
              />
              <button
                onClick={createAgent}
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
                {editingAgentId ? 'Save Agent' : selectedAgentTemplateId ? 'Create From Template' : 'Create Agent'}
              </button>
            </div>

            <div className="border border-white/5 bg-surface/30 rounded-2xl p-5 space-y-4">
              <h2 className="text-lg font-semibold text-white">New Workflow</h2>
              <input
                value={workflowName}
                onChange={(event) => setWorkflowName(event.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-sky-500/60"
              />
              <select
                value={workflowAgentId}
                onChange={(event) => setWorkflowAgentId(event.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-sky-500/60"
              >
                <option value="">No agent binding</option>
                {agents.map((agent) => (
                  <option key={agent.agent_id} value={agent.agent_id}>{agent.name}</option>
                ))}
              </select>
              <select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-sky-500/60"
              >
                <option value="">Keep/custom steps</option>
                {templates.map((template) => (
                  <option key={template.template_id} value={template.template_id}>{template.name}</option>
                ))}
              </select>
              <input
                value={workflowTriggers}
                onChange={(event) => setWorkflowTriggers(event.target.value)}
                placeholder="document.uploaded, daily.summary"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-sky-500/60"
              />
              {selectedTemplate ? (
                <div className="space-y-2">
                  {selectedTemplate.steps.map((step: any, index) => (
                    <div key={`${step.tool_name}-${index}`} className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                      <span className="w-6 h-6 rounded-lg bg-white/5 text-xs text-gray-300 flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="font-mono text-sm text-gray-300">{step.tool_name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {workflowStepDrafts.map((draft, index) => (
                    <div key={`${index}-${draft.toolName}`} className="rounded-xl border border-white/5 bg-black/20 p-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
                        <input
                          value={draft.name}
                          onChange={(event) => updateWorkflowStepDraft(index, { name: event.target.value })}
                          className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-sky-500/60"
                        />
                        <select
                          value={draft.toolName}
                          onChange={(event) => updateWorkflowStepDraft(index, { toolName: event.target.value })}
                          className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-sky-500/60"
                        >
                          {draft.toolName && !tools.some((tool) => tool.name === draft.toolName) && (
                            <option value={draft.toolName}>{draft.toolName}</option>
                          )}
                          {tools.map((tool) => (
                            <option key={tool.name} value={tool.name}>{tool.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeWorkflowStepDraft(index)}
                          disabled={workflowStepDrafts.length === 1}
                          className="h-11 px-3 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/15 disabled:opacity-40 text-red-100 flex items-center justify-center"
                          aria-label={`Remove workflow step ${index + 1}`}
                          title={`Remove workflow step ${index + 1}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <textarea
                        value={draft.argumentsJson}
                        onChange={(event) => updateWorkflowStepDraft(index, { argumentsJson: event.target.value })}
                        rows={4}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-mono outline-none focus:border-sky-500/60 resize-none"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                        <input
                          value={draft.dependsOn}
                          onChange={(event) => updateWorkflowStepDraft(index, { dependsOn: event.target.value })}
                          placeholder={index > 0 ? `step-${index}` : 'depends_on'}
                          className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-sky-500/60"
                        />
                        <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">
                          Approval
                          <input
                            type="checkbox"
                            checked={draft.approvalRequired}
                            onChange={(event) => updateWorkflowStepDraft(index, { approvalRequired: event.target.checked })}
                            className="accent-sky-500"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={addWorkflowStepDraft}
                    className="w-full h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Add Step
                  </button>
                  {externalMcpTools.length > 0 && (
                    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                      <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-3">Add MCP Step</p>
                      <div className="flex flex-wrap gap-2">
                        {externalMcpTools.slice(0, 8).map((tool) => (
                          <button
                            key={`${tool.server_id}-${tool.tool_name}`}
                            onClick={() => addMcpWorkflowStepDraft(tool)}
                            className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-[11px] text-sky-100 hover:bg-sky-500/15"
                          >
                            {tool.server_name}: {tool.tool_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={createWorkflow}
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-medium flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Workflow size={18} />}
                {editingWorkflowId ? 'Save Workflow' : 'Create Workflow'}
              </button>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-white/5 bg-surface/30 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-white mb-4">Agent Definitions</h2>
              <div className="space-y-2">
                {agents.map((agent) => (
                  <div key={agent.agent_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{agent.name}</p>
                      <p className="text-xs text-gray-500 font-mono truncate">{agent.tool_names.join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => editAgent(agent)}
                        aria-label={`Edit ${agent.name}`}
                        title={`Edit ${agent.name}`}
                        className="p-2 rounded-lg text-gray-500 hover:text-emerald-300 hover:bg-emerald-500/10"
                      >
                        <Settings2 size={16} />
                      </button>
                      <button
                        onClick={() => cloneAgent(agent)}
                        disabled={isSubmitting}
                        aria-label={`Clone ${agent.name}`}
                        title={`Clone ${agent.name}`}
                        className="p-2 rounded-lg text-gray-500 hover:text-violet-300 hover:bg-violet-500/10 disabled:opacity-60"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => deleteAgent(agent.agent_id)}
                        aria-label={`Delete ${agent.name}`}
                        title={`Delete ${agent.name}`}
                        className="p-2 rounded-lg text-gray-500 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              {agents.length === 0 && <p className="text-sm text-gray-500">No agents</p>}
              </div>
            </div>

            <div className="border border-white/5 bg-surface/30 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-white mb-4">Workflow Definitions</h2>
              <div className="space-y-2">
                {workflows.map((workflow) => (
                  <div key={workflow.workflow_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{workflow.name}</p>
                      <p className="text-xs text-gray-500 font-mono truncate">
                        {workflow.steps.length} steps{workflow.triggers.length ? ` / ${workflow.triggers.join(', ')}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => editWorkflow(workflow)}
                        aria-label={`Edit ${workflow.name}`}
                        title={`Edit ${workflow.name}`}
                        className="p-2 rounded-lg text-gray-500 hover:text-sky-300 hover:bg-sky-500/10"
                      >
                        <Settings2 size={16} />
                      </button>
                      <button
                        onClick={() => cloneWorkflow(workflow)}
                        disabled={isSubmitting}
                        aria-label={`Clone ${workflow.name}`}
                        title={`Clone ${workflow.name}`}
                        className="p-2 rounded-lg text-gray-500 hover:text-violet-300 hover:bg-violet-500/10 disabled:opacity-60"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => deleteWorkflow(workflow.workflow_id)}
                        aria-label={`Delete ${workflow.name}`}
                        title={`Delete ${workflow.name}`}
                        className="p-2 rounded-lg text-gray-500 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {workflows.length === 0 && <p className="text-sm text-gray-500">No workflows</p>}
              </div>
            </div>
          </section>

          <section className="border border-white/5 bg-surface/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">External MCP Servers</h2>
              <button
                onClick={checkAllMcpServers}
                disabled={isSubmitting || mcpServers.length === 0}
                className="h-9 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60 text-xs text-white flex items-center gap-2"
              >
                <RefreshCw size={14} className={isSubmitting ? 'animate-spin' : ''} />
                Check All
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.9fr_1.4fr_1fr_auto] gap-3">
              <input
                value={mcpName}
                onChange={(event) => setMcpName(event.target.value)}
                className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
              />
              <select
                value={mcpTransport}
                onChange={(event) => setMcpTransport(event.target.value === 'stdio' ? 'stdio' : 'streamable_http')}
                className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
              >
                <option value="streamable_http">HTTP</option>
                <option value="stdio">Stdio</option>
              </select>
              {mcpTransport === 'stdio' ? (
                <div className="grid grid-cols-1 sm:grid-cols-[0.8fr_1.2fr] gap-3">
                  <input
                    value={mcpCommand}
                    onChange={(event) => setMcpCommand(event.target.value)}
                    placeholder="npx"
                    className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
                  />
                  <input
                    value={mcpArgs}
                    onChange={(event) => setMcpArgs(event.target.value)}
                    placeholder="-y, @modelcontextprotocol/server-filesystem, /workspace"
                    className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
                  />
                </div>
              ) : (
                <input
                  value={mcpUrl}
                  onChange={(event) => setMcpUrl(event.target.value)}
                  placeholder="https://server.example.com/mcp"
                  className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
                />
              )}
              <input
                value={mcpToolNames}
                onChange={(event) => setMcpToolNames(event.target.value)}
                placeholder="tool_a, tool_b"
                className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
              />
              <button
                onClick={createMcpServer}
                disabled={isSubmitting || !isMcpServerFormReady({
                  name: mcpName,
                  transport: mcpTransport,
                  url: mcpUrl,
                  command: mcpCommand,
                })}
                className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Settings2 size={18} />}
                {editingMcpServerId ? 'Save' : 'Register'}
              </button>
            </div>
            {externalMcpTools.length > 0 && (
              <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">External Tools</p>
                <div className="flex flex-wrap gap-2">
                  {externalMcpTools.slice(0, 12).map((tool) => (
                    <span
                      key={`${tool.server_id}-${tool.tool_name}`}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-gray-300"
                    >
                      {tool.tool_name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mcpServers.map((server) => (
                <div key={server.server_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{server.name}</p>
                    <p className="text-xs text-gray-500 font-mono truncate">
                      {server.transport === 'stdio'
                        ? [server.command, ...(server.args || [])].filter(Boolean).join(' ')
                        : server.url}
                    </p>
                    {server.last_health_status && (
                      <p className={`mt-1 text-[11px] truncate ${
                        server.last_health_status === 'reachable' ? 'text-emerald-300' : 'text-red-300'
                      }`}>
                        {server.last_health_status}: {server.last_health_message}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => checkMcpServer(server.server_id)}
                      aria-label={`Check ${server.name}`}
                      title={`Check ${server.name}`}
                      className="p-2 rounded-lg text-gray-500 hover:text-sky-300 hover:bg-sky-500/10"
                    >
                      <RefreshCw size={16} />
                    </button>
                    <button
                      onClick={() => editMcpServer(server)}
                      aria-label={`Edit ${server.name}`}
                      title={`Edit ${server.name}`}
                      className="p-2 rounded-lg text-gray-500 hover:text-emerald-300 hover:bg-emerald-500/10"
                    >
                      <Settings2 size={16} />
                    </button>
                    <button
                      onClick={() => deleteMcpServer(server.server_id)}
                      aria-label={`Delete ${server.name}`}
                      title={`Delete ${server.name}`}
                      className="p-2 rounded-lg text-gray-500 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {mcpServers.length === 0 && <p className="text-sm text-gray-500">No external MCP servers</p>}
            </div>
          </section>
        </section>

        <aside className="space-y-6">
          <section className="border border-white/5 bg-surface/30 rounded-2xl p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white">Run Agent or Workflow</h2>
            <div className="relative">
              <Search size={16} className="absolute left-4 top-3.5 text-gray-500" />
              <input
                value={runQuery}
                onChange={(event) => setRunQuery(event.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-violet-500/60"
              />
            </div>
            <input
              value={runCollections}
              onChange={(event) => setRunCollections(event.target.value)}
              placeholder="collection-id-1, collection-id-2"
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500/60"
            />
            <label className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-3 text-sm text-gray-300">
              Dry run
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(event) => setDryRun(event.target.checked)}
                className="accent-violet-500"
              />
            </label>
            <select
              value={runAgentId}
              onChange={(event) => setRunAgentId(event.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
            >
              <option value="">Select agent</option>
              {agents.map((agent) => (
                <option key={agent.agent_id} value={agent.agent_id}>{agent.name}</option>
              ))}
            </select>
            <button
              onClick={startAgentRun}
              disabled={isSubmitting || !runAgentId}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
              Run Agent
            </button>
            <select
              value={runWorkflowId}
              onChange={(event) => setRunWorkflowId(event.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500/60"
            >
              <option value="">Select workflow</option>
              {workflows.map((workflow) => (
                <option key={workflow.workflow_id} value={workflow.workflow_id}>{workflow.name}</option>
              ))}
            </select>
            <button
              onClick={startRun}
              disabled={isSubmitting || !runWorkflowId}
              className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-medium flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              Start Run
            </button>
            <input
              value={triggerName}
              onChange={(event) => setTriggerName(event.target.value)}
              placeholder="document.uploaded"
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-amber-500/60"
            />
            <button
              onClick={() => startTriggerRuns()}
              disabled={isSubmitting || !triggerName.trim()}
              className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-medium flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Route size={18} />}
              Run Trigger
            </button>
            {automationTriggers.length > 0 && (
              <div className="space-y-2 pt-1">
                {automationTriggers.slice(0, 5).map((trigger) => (
                  <button
                    key={trigger.trigger}
                    onClick={() => startTriggerRuns(trigger.trigger)}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-white/5 bg-black/20 hover:border-amber-500/20 px-4 py-3 text-left disabled:opacity-60"
                  >
                    <span className="block text-sm text-white truncate">{trigger.trigger}</span>
                    <span className="block text-xs text-gray-500">{trigger.workflow_count} workflow{trigger.workflow_count === 1 ? '' : 's'}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="border border-white/5 bg-surface/30 rounded-2xl p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white">Tool Console</h2>
            <select
              value={invokeToolName}
              onChange={(event) => setInvokeToolName(event.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
            >
              {tools.map((tool) => (
                <option key={tool.name} value={tool.name}>{tool.name}</option>
              ))}
            </select>
            <input
              value={invokeQuery}
              onChange={(event) => setInvokeQuery(event.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
            />
            <button
              onClick={invokeTool}
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              Invoke Tool
            </button>
            {toolResult && (
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/5 bg-black/20 p-3 text-[11px] leading-relaxed text-gray-500 font-mono">
                {JSON.stringify(toolResult, null, 2)}
              </pre>
            )}
          </section>

          <section className="border border-white/5 bg-surface/30 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-white">Approval Queue</h2>
              <button
                onClick={approveAllPendingWorkflowSteps}
                disabled={isSubmitting || pendingApprovals.length === 0}
                className="h-8 px-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15 disabled:opacity-60 flex items-center gap-1"
              >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Approve All
              </button>
            </div>
            <div className="space-y-3">
              {pendingApprovals.slice(0, 6).map((approval) => (
                <div key={`${approval.run_id}-${approval.step_id}`} className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{approval.step_name}</p>
                      <p className="text-xs text-gray-500 font-mono truncate">{approval.tool_name} / {approval.run_id.slice(0, 8)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => rejectWorkflowStep(approval.run_id, approval.step_id)}
                        disabled={isSubmitting}
                        className="h-8 px-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-100 hover:bg-red-500/15 disabled:opacity-60 flex items-center gap-1"
                      >
                        <XCircle size={14} />
                        Reject
                      </button>
                      <button
                        onClick={() => approveWorkflowStep(approval.run_id, approval.step_id)}
                        disabled={isSubmitting}
                        className="h-8 px-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15 disabled:opacity-60 flex items-center gap-1"
                      >
                        <CheckCircle2 size={14} />
                        Approve
                      </button>
                    </div>
                  </div>
                  {approval.message && (
                    <p className="mt-2 text-[11px] leading-relaxed text-amber-300">{approval.message}</p>
                  )}
                  <textarea
                    value={approvalRejectionReasons[approvalKey(approval.run_id, approval.step_id)] || ''}
                    onChange={(event) => setApprovalRejectionReasons((current) => ({
                      ...current,
                      [approvalKey(approval.run_id, approval.step_id)]: event.target.value,
                    }))}
                    placeholder="Rejection reason"
                    className="mt-3 min-h-20 w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-gray-600 focus:border-red-500/40"
                  />
                  <div className="mt-3 grid grid-cols-1 gap-2 text-[11px]">
                    <div className="rounded-lg border border-white/5 bg-black/20 p-2">
                      <p className="mb-1 text-gray-500 uppercase tracking-widest">Arguments</p>
                      <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-gray-400">
                        {JSON.stringify(approval.arguments || {}, null, 2)}
                      </pre>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-black/20 p-2">
                      <p className="mb-1 text-gray-500 uppercase tracking-widest">Run Inputs</p>
                      <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-gray-400">
                        {JSON.stringify(approval.run_inputs || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
              {pendingApprovals.length === 0 && (
                <div className="rounded-xl border border-white/5 bg-black/20 p-6 text-center text-sm text-gray-500">
                  No pending approvals
                </div>
              )}
            </div>
          </section>

          <section className="border border-white/5 bg-surface/30 rounded-2xl p-5">
            <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-white">Runs</h2>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <select
                  value={runStatusFilter}
                  onChange={(event) => changeRunStatusFilter(event.target.value)}
                  className="h-8 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-gray-200 outline-none focus:border-sky-500/50"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="blocked">Blocked</option>
                  <option value="failed">Failed</option>
                  <option value="planned">Planned</option>
                  <option value="completed">Completed</option>
                  <option value="canceled">Canceled</option>
                </select>
                <label className="h-8 px-3 rounded-lg border border-white/10 bg-white/5 text-gray-200 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={showArchivedRuns}
                    onChange={(event) => toggleArchivedRuns(event.target.checked)}
                    className="accent-violet-500"
                  />
                  Archived
                </label>
                <button
                  onClick={archiveWorkflowRuns}
                  disabled={isSubmitting || runs.length === 0}
                  className="h-8 px-3 rounded-lg border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 disabled:opacity-60 flex items-center gap-1"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                  Archive Done
                </button>
                <div className="h-8 rounded-lg border border-white/10 bg-white/5 text-gray-200 flex items-center overflow-hidden text-xs">
                  <button
                    onClick={() => changeRunPage(runPage - 1)}
                    disabled={isSubmitting || runPage === 0}
                    title="Previous page"
                    className="h-full w-8 flex items-center justify-center hover:bg-white/10 disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="min-w-14 px-2 text-center border-x border-white/10">Page {runPage + 1}</span>
                  <button
                    onClick={() => changeRunPage(runPage + 1)}
                    disabled={isSubmitting || !hasMoreRuns}
                    title="Next page"
                    className="h-full w-8 flex items-center justify-center hover:bg-white/10 disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {visibleRuns.map((run) => (
                <div key={run.run_id} className="rounded-xl border border-white/5 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white font-mono truncate">{run.run_id.slice(0, 8)}</span>
                    <div className="flex items-center gap-2">
                      {canRunWorkflowAgain(run.status) && (
                        <button
                          onClick={() => retryWorkflowRun(run.run_id)}
                          disabled={isSubmitting}
                          title={dryRun ? 'Run again as a dry run' : 'Run again live'}
                          className="h-7 px-2 rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-100 hover:bg-sky-500/15 disabled:opacity-60 flex items-center gap-1"
                        >
                          <RefreshCw size={13} />
                          Run Again
                        </button>
                      )}
                      <button
                        onClick={() => loadRunTrace(run.run_id)}
                        disabled={isSubmitting}
                        className="h-7 px-2 rounded-lg border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 disabled:opacity-60 flex items-center gap-1"
                      >
                        <Route size={13} />
                        Trace
                      </button>
                      {canCancelWorkflowRun(run.status) && (
                        <button
                          onClick={() => cancelWorkflowRun(run.run_id)}
                          disabled={isSubmitting}
                          className="h-7 px-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-100 hover:bg-red-500/15 disabled:opacity-60 flex items-center gap-1"
                        >
                          <XCircle size={13} />
                          Cancel
                        </button>
                      )}
                      <span className={`text-xs border rounded-full px-2 py-1 ${statusTone[run.status] || 'text-gray-300 bg-white/5 border-white/10'}`}>
                        {run.status}
                      </span>
                    </div>
                  </div>
                  {(run.agent_id || run.retried_from) && (
                    <p className="mt-2 text-[11px] text-gray-500 font-mono truncate">
                      {run.agent_id ? `agent:${run.agent_id.slice(0, 8)}` : ''}
                      {run.agent_id && run.retried_from ? ' / ' : ''}
                      {run.retried_from ? `retry:${run.retried_from.slice(0, 8)}` : ''}
                    </p>
                  )}
                  <div className="mt-3 space-y-2">
                    {run.steps.map((step: any) => (
                      <div key={step.step_id} className="rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-gray-400 truncate">{step.name}</span>
                          <div className="flex items-center gap-2">
                            {step.status === 'pending_approval' && (
                              <button
                                onClick={() => approveWorkflowStep(run.run_id, step.step_id)}
                                disabled={isSubmitting}
                                className="h-7 px-2 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15 disabled:opacity-60 flex items-center gap-1"
                              >
                                <CheckCircle2 size={13} />
                                Approve
                              </button>
                            )}
                            <span className={`border rounded-full px-2 py-1 ${statusTone[step.status] || 'text-gray-300 bg-white/5 border-white/10'}`}>
                              {step.status}
                            </span>
                            <span className="flex items-center gap-1 text-gray-500">
                              {step.status === 'completed' ? <CheckCircle2 size={13} className="text-emerald-400" /> : <CircleDashed size={13} />}
                              {step.tool_name}
                            </span>
                          </div>
                        </div>
                        {step.message && (
                          <p className="mt-2 text-[11px] leading-relaxed text-amber-300">{step.message}</p>
                        )}
                        {step.output && (
                          <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-gray-500 font-mono">
                            {JSON.stringify(step.output, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {visibleRuns.length === 0 && (
                <div className="rounded-xl border border-white/5 bg-black/20 p-6 text-center text-sm text-gray-500">
                  No runs match this view
                </div>
              )}
            </div>
          </section>

          {runTrace && (
            <section className="border border-white/5 bg-surface/30 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-white mb-4">Run Trace</h2>
              <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-white font-mono truncate">{runTrace.run_id.slice(0, 8)}</span>
                  <span className={`text-xs border rounded-full px-2 py-1 ${statusTone[runTrace.status] || 'text-gray-300 bg-white/5 border-white/10'}`}>
                    {runTrace.status}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {runTrace.steps.map((step: any) => (
                    <div key={step.step_id} className="rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-gray-400 truncate">{step.name}</span>
                        <span className={`border rounded-full px-2 py-1 ${statusTone[step.status] || 'text-gray-300 bg-white/5 border-white/10'}`}>
                          {step.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500 font-mono truncate">{step.tool_name}</p>
                      {step.message && (
                        <p className="mt-2 text-[11px] leading-relaxed text-amber-300">{step.message}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          <section className="border border-white/5 bg-surface/30 rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Audit</h2>
            <div className="space-y-3">
              {auditEvents.slice(0, 8).map((event) => (
                <div key={`${event.event}-${event.subject_id}-${event.created_at}`} className="rounded-xl border border-white/5 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white truncate">{event.event}</span>
                    <span className="text-[11px] text-gray-500">{event.subject_type}</span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono mt-1 truncate">{event.subject_id}</p>
                </div>
              ))}
              {auditEvents.length === 0 && (
                <div className="rounded-xl border border-white/5 bg-black/20 p-6 text-center text-sm text-gray-500">
                  No audit events
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </motion.div>
  );
};

export default AgentPlatform;
