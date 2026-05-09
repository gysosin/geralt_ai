import { describe, expect, it } from 'vitest';
import { buildWorkflowSteps } from './agent-platform-workflow';

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
});
