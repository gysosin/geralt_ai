import type { ExternalMcpTool } from '../services/agent-platform.service';

export type WorkflowStepDraft = {
  name: string;
  toolName: string;
  argumentsJson: string;
  dependsOn: string;
  approvalRequired: boolean;
};

export type WorkflowStepPayload = {
  name: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  depends_on: string[];
  approval_required: boolean;
};

export const defaultWorkflowStepDrafts: WorkflowStepDraft[] = [
  {
    name: 'Plan route',
    toolName: 'query.plan',
    argumentsJson: '{\n  "query": "{{input.query}}"\n}',
    dependsOn: '',
    approvalRequired: false,
  },
  {
    name: 'Aggregate extracted data',
    toolName: 'rag.aggregate',
    argumentsJson: '{\n  "query": "{{input.query}}",\n  "collection_ids": "{{input.collection_ids}}"\n}',
    dependsOn: 'step-1',
    approvalRequired: false,
  },
];

const splitDependencies = (value: string) =>
  value.split(',').map((item) => item.trim()).filter(Boolean);

export const workflowStepsToDrafts = (steps: Array<Record<string, unknown>>): WorkflowStepDraft[] => {
  if (steps.length === 0) return defaultWorkflowStepDrafts;

  return steps.map((step, index) => ({
    name: typeof step.name === 'string' && step.name.trim() ? step.name : `Step ${index + 1}`,
    toolName: typeof step.tool_name === 'string' ? step.tool_name : '',
    argumentsJson: JSON.stringify(step.arguments || {}, null, 2),
    dependsOn: Array.isArray(step.depends_on) ? step.depends_on.join(', ') : '',
    approvalRequired: Boolean(step.approval_required),
  }));
};

export const mcpToolToWorkflowStepDraft = (
  tool: Pick<ExternalMcpTool, 'server_id' | 'tool_name'>,
  existingStepCount = 0
): WorkflowStepDraft => ({
  name: `Call ${tool.tool_name}`,
  toolName: 'mcp.invoke',
  argumentsJson: JSON.stringify({
    server_id: tool.server_id,
    tool_name: tool.tool_name,
    arguments: {},
  }, null, 2),
  dependsOn: existingStepCount > 0 ? `step-${existingStepCount}` : '',
  approvalRequired: true,
});

export const canRunWorkflowAgain = (status: string) => (
  ['planned', 'completed', 'failed', 'canceled', 'blocked'].includes(status)
);

export const canCancelWorkflowRun = (status: string) => status === 'pending';

export const normalizeApprovalRejectionReason = (reason: string) => {
  const trimmedReason = reason.trim();
  return trimmedReason || 'Rejected from approval queue';
};

export const filterWorkflowRunsByStatus = <TRun extends { status: string }>(
  runs: TRun[],
  status: string
) => {
  if (status === 'all') return runs;
  return runs.filter((run) => run.status === status);
};

export type WorkflowRunListQueryOptions = {
  workflowId?: string;
  includeArchived?: boolean;
  status?: string;
  limit?: number;
  offset?: number;
};

export const DEFAULT_WORKFLOW_RUN_LIST_LIMIT = 50;

export const buildWorkflowRunListQuery = ({
  workflowId,
  includeArchived = false,
  status = 'all',
  limit = DEFAULT_WORKFLOW_RUN_LIST_LIMIT,
  offset = 0,
}: WorkflowRunListQueryOptions = {}) => {
  const params = new URLSearchParams();
  if (workflowId) params.set('workflow_id', workflowId);
  if (includeArchived) params.set('include_archived', 'true');
  if (status !== 'all') params.set('status', status);
  params.set('limit', String(limit));
  if (offset > 0) params.set('offset', String(offset));
  return `?${params.toString()}`;
};

export const buildWorkflowSteps = (drafts: WorkflowStepDraft[]) => {
  const errors: string[] = [];
  const steps: WorkflowStepPayload[] = [];

  drafts.forEach((draft, index) => {
    const stepNumber = index + 1;
    const toolName = draft.toolName.trim();
    let parsedArguments: unknown = {};

    if (!toolName) {
      errors.push(`Step ${stepNumber} needs a tool.`);
    }

    try {
      parsedArguments = draft.argumentsJson.trim() ? JSON.parse(draft.argumentsJson) : {};
      if (
        typeof parsedArguments !== 'object' ||
        parsedArguments === null ||
        Array.isArray(parsedArguments)
      ) {
        errors.push(`Step ${stepNumber} arguments must be a JSON object.`);
      }
    } catch {
      errors.push(`Step ${stepNumber} arguments are not valid JSON.`);
    }

    if (errors.length === 0) {
      steps.push({
        name: draft.name.trim() || `Step ${stepNumber}`,
        tool_name: toolName,
        arguments: parsedArguments as Record<string, unknown>,
        depends_on: splitDependencies(draft.dependsOn),
        approval_required: draft.approvalRequired,
      });
    }
  });

  return {
    errors,
    steps: errors.length === 0 ? steps : [],
  };
};
