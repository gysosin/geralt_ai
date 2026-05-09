import { describe, expect, it } from 'vitest';
import { buildWorkflowSteps, canRunWorkflowAgain, mcpToolToWorkflowStepDraft } from './agent-platform-workflow';

describe('agent platform workflow helpers', () => {
  it('builds validated workflow steps from editable drafts', () => {
    expect(buildWorkflowSteps([
      {
        name: 'Plan route',
        toolName: 'query.plan',
        argumentsJson: '{"query":"{{input.query}}"}',
        dependsOn: '',
        approvalRequired: false,
      },
      {
        name: 'Aggregate extracted data',
        toolName: 'rag.aggregate',
        argumentsJson: '{"query":"{{input.query}}","collection_ids":"{{input.collection_ids}}"}',
        dependsOn: 'step-1',
        approvalRequired: true,
      },
    ])).toEqual({
      errors: [],
      steps: [
        {
          name: 'Plan route',
          tool_name: 'query.plan',
          arguments: { query: '{{input.query}}' },
          depends_on: [],
          approval_required: false,
        },
        {
          name: 'Aggregate extracted data',
          tool_name: 'rag.aggregate',
          arguments: {
            query: '{{input.query}}',
            collection_ids: '{{input.collection_ids}}',
          },
          depends_on: ['step-1'],
          approval_required: true,
        },
      ],
    });
  });

  it('returns clear errors for missing tools and invalid argument JSON', () => {
    const result = buildWorkflowSteps([
      {
        name: 'Broken step',
        toolName: '',
        argumentsJson: '[]',
        dependsOn: 'step-1, step-2',
        approvalRequired: false,
      },
      {
        name: 'Bad JSON',
        toolName: 'query.plan',
        argumentsJson: '{"query"',
        dependsOn: '',
        approvalRequired: false,
      },
    ]);

    expect(result.steps).toEqual([]);
    expect(result.errors).toEqual([
      'Step 1 needs a tool.',
      'Step 1 arguments must be a JSON object.',
      'Step 2 arguments are not valid JSON.',
    ]);
  });

  it('creates an editable mcp.invoke draft from an external MCP tool', () => {
    expect(mcpToolToWorkflowStepDraft({
      server_id: 'mcp-1',
      server_name: 'Filesystem MCP',
      tool_name: 'read_file',
      transport: 'stdio',
      target: 'npx -y @modelcontextprotocol/server-filesystem /tmp',
    }, 2)).toEqual({
      name: 'Call read_file',
      toolName: 'mcp.invoke',
      argumentsJson: JSON.stringify({
        server_id: 'mcp-1',
        tool_name: 'read_file',
        arguments: {},
      }, null, 2),
      dependsOn: 'step-2',
      approvalRequired: true,
    });
  });

  it('allows safe run-again actions for historical workflow run statuses only', () => {
    expect(canRunWorkflowAgain('planned')).toBe(true);
    expect(canRunWorkflowAgain('completed')).toBe(true);
    expect(canRunWorkflowAgain('failed')).toBe(true);
    expect(canRunWorkflowAgain('canceled')).toBe(true);
    expect(canRunWorkflowAgain('pending')).toBe(false);
    expect(canRunWorkflowAgain('pending_approval')).toBe(false);
  });
});
