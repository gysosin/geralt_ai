import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Play,
  RefreshCw,
  Route,
  Search,
  Settings2,
  Trash2,
  Workflow,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  agentPlatformService,
  type AuditEvent,
  type AgentDefinition,
  type AgentTool,
  type ToolInvocationResult,
  type WorkflowDefinition,
  type WorkflowRun,
  type WorkflowTemplate,
} from '../src/services/agent-platform.service';

const splitIds = (value: string) =>
  value.split(',').map((item) => item.trim()).filter(Boolean);

const statusTone: Record<string, string> = {
  completed: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  planned: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  pending: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  blocked: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
  pending_approval: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  failed: 'text-red-300 bg-red-500/10 border-red-500/20',
};

const AgentPlatform: React.FC = () => {
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [toolResult, setToolResult] = useState<ToolInvocationResult | null>(null);
  const [exportSummary, setExportSummary] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [agentName, setAgentName] = useState('Document Operations Agent');
  const [agentInstruction, setAgentInstruction] = useState('Plan the user request, search or aggregate selected document collections, and return grounded results.');
  const [selectedTools, setSelectedTools] = useState<string[]>(['query.plan', 'rag.aggregate']);
  const [agentCollections, setAgentCollections] = useState('');

  const [workflowName, setWorkflowName] = useState('Document Aggregation Workflow');
  const [workflowAgentId, setWorkflowAgentId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('document_aggregation');
  const [runWorkflowId, setRunWorkflowId] = useState('');
  const [runQuery, setRunQuery] = useState('total amount by vendor');
  const [runCollections, setRunCollections] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [invokeToolName, setInvokeToolName] = useState('query.plan');
  const [invokeQuery, setInvokeQuery] = useState('list all vendors');

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [toolResult, agentResult, workflowResult, templateResult, runResult, auditResult] = await Promise.allSettled([
        agentPlatformService.getTools(),
        agentPlatformService.listAgents(),
        agentPlatformService.listWorkflows(),
        agentPlatformService.listWorkflowTemplates(),
        agentPlatformService.listWorkflowRuns(),
        agentPlatformService.listAuditEvents(),
      ]);
      setTools(toolResult.status === 'fulfilled' ? toolResult.value.tools || [] : []);
      setAgents(agentResult.status === 'fulfilled' ? agentResult.value || [] : []);
      const loadedWorkflows = workflowResult.status === 'fulfilled' ? workflowResult.value || [] : [];
      setWorkflows(loadedWorkflows);
      const loadedTemplates = templateResult.status === 'fulfilled' ? templateResult.value || [] : [];
      setTemplates(loadedTemplates);
      if (!selectedTemplateId && loadedTemplates?.[0]?.template_id) {
        setSelectedTemplateId(loadedTemplates[0].template_id);
      }
      setRuns(runResult.status === 'fulfilled' ? runResult.value || [] : []);
      setAuditEvents(auditResult.status === 'fulfilled' ? auditResult.value || [] : []);
      if (!runWorkflowId && loadedWorkflows?.[0]?.workflow_id) {
        setRunWorkflowId(loadedWorkflows[0].workflow_id);
      }
      if ([toolResult, agentResult, workflowResult, templateResult, runResult, auditResult].some((result) => result.status === 'rejected')) {
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

  const handleToolToggle = (toolName: string) => {
    setSelectedTools((current) =>
      current.includes(toolName)
        ? current.filter((name) => name !== toolName)
        : [...current, toolName]
    );
  };

  const createAgent = async () => {
    if (!agentName.trim() || !agentInstruction.trim() || selectedTools.length === 0) return;
    setIsSubmitting(true);
    setError('');
    try {
      const created = await agentPlatformService.createAgent({
        name: agentName,
        instruction: agentInstruction,
        tool_names: selectedTools,
        collection_ids: splitIds(agentCollections),
        model: 'default',
      });
      setAgents((current) => [created, ...current]);
      setWorkflowAgentId(created.agent_id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create agent');
    } finally {
      setIsSubmitting(false);
    }
  };

  const createWorkflow = async () => {
    if (!workflowName.trim()) return;
    setIsSubmitting(true);
    setError('');
    try {
      const created = selectedTemplateId
        ? await agentPlatformService.createWorkflowFromTemplate({
          template_id: selectedTemplateId,
          name: workflowName,
          agent_id: workflowAgentId || undefined,
        })
        : await agentPlatformService.createWorkflow({
          name: workflowName,
          agent_id: workflowAgentId || undefined,
          steps: [
            {
              name: 'Plan route',
              tool_name: 'query.plan',
              arguments: { query: '{{input.query}}' },
            },
            {
              name: 'Aggregate extracted data',
              tool_name: 'rag.aggregate',
              arguments: {
                query: '{{input.query}}',
                collection_ids: '{{input.collection_ids}}',
              },
            },
          ],
        });
      setWorkflows((current) => [created, ...current]);
      setRunWorkflowId(created.workflow_id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create workflow');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTemplate = templates.find((template) => template.template_id === selectedTemplateId);

  const startRun = async () => {
    if (!runWorkflowId) return;
    setIsSubmitting(true);
    setError('');
    try {
      const created = await agentPlatformService.startWorkflowRun(runWorkflowId, {
        dry_run: dryRun,
        inputs: {
          query: runQuery,
          collection_ids: splitIds(runCollections),
        },
      });
      setRuns((current) => [created, ...current]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to start workflow run');
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
      setAuditEvents(await agentPlatformService.listAuditEvents());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to approve workflow step');
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
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to delete workflow');
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Registered Tools', value: tools.length, icon: Settings2 },
              { label: 'Agents', value: agents.length, icon: Bot },
              { label: 'Workflows', value: workflows.length, icon: Route },
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
                    {categoryTools.map((tool) => (
                      <label
                        key={tool.name}
                        className="flex gap-3 p-4 rounded-xl border border-white/5 bg-black/20 hover:border-white/10 transition-colors cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTools.includes(tool.name)}
                          onChange={() => handleToolToggle(tool.name)}
                          className="mt-1 accent-emerald-500"
                        />
                        <span>
                          <span className="block text-white font-medium">{tool.title}</span>
                          <span className="block text-xs text-gray-500 font-mono mt-1">{tool.name}</span>
                          <span className="block text-sm text-gray-400 mt-2">{tool.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-white/5 bg-surface/30 rounded-2xl p-5 space-y-4">
              <h2 className="text-lg font-semibold text-white">New Agent</h2>
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
                Create Agent
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
                {templates.map((template) => (
                  <option key={template.template_id} value={template.template_id}>{template.name}</option>
                ))}
              </select>
              <div className="space-y-2">
                {(selectedTemplate?.steps || [
                  { tool_name: 'query.plan' },
                  { tool_name: 'rag.aggregate' },
                ]).map((step: any, index) => (
                  <div key={`${step.tool_name}-${index}`} className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                    <span className="w-6 h-6 rounded-lg bg-white/5 text-xs text-gray-300 flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="font-mono text-sm text-gray-300">{step.tool_name}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={createWorkflow}
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-medium flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Workflow size={18} />}
                Create Workflow
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
                    <button
                      onClick={() => deleteAgent(agent.agent_id)}
                      className="p-2 rounded-lg text-gray-500 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 size={16} />
                    </button>
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
                      <p className="text-xs text-gray-500 font-mono truncate">{workflow.steps.length} steps</p>
                    </div>
                    <button
                      onClick={() => deleteWorkflow(workflow.workflow_id)}
                      className="p-2 rounded-lg text-gray-500 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {workflows.length === 0 && <p className="text-sm text-gray-500">No workflows</p>}
              </div>
            </div>
          </section>
        </section>

        <aside className="space-y-6">
          <section className="border border-white/5 bg-surface/30 rounded-2xl p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white">Run Workflow</h2>
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
            <button
              onClick={startRun}
              disabled={isSubmitting || !runWorkflowId}
              className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-medium flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              Start Run
            </button>
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
            <h2 className="text-lg font-semibold text-white mb-4">Runs</h2>
            <div className="space-y-3">
              {runs.slice(0, 8).map((run) => (
                <div key={run.run_id} className="rounded-xl border border-white/5 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white font-mono truncate">{run.run_id.slice(0, 8)}</span>
                    <span className={`text-xs border rounded-full px-2 py-1 ${statusTone[run.status] || 'text-gray-300 bg-white/5 border-white/10'}`}>
                      {run.status}
                    </span>
                  </div>
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
              {runs.length === 0 && (
                <div className="rounded-xl border border-white/5 bg-black/20 p-6 text-center text-sm text-gray-500">
                  No runs yet
                </div>
              )}
            </div>
          </section>

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
