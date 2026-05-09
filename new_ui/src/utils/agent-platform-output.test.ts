import { describe, expect, it } from 'vitest';
import { summarizeWorkflowStepOutput } from './agent-platform-output';

describe('agent platform output helpers', () => {
  it('summarizes RAG search output for run steps', () => {
    const summary = summarizeWorkflowStepOutput({
      answer: 'Found 1 matching document in extracted evidence.',
      sources: [
        {
          document_id: 'doc-1',
          title: 'Warranty Agreement',
          document_type: 'contract',
          summary: 'Acme warranty terms.',
          score: 7,
        },
      ],
      routing: {
        method: 'deterministic_extraction_search',
        source: 'extractions',
        matched_count: 1,
        documents_scanned: 3,
      },
    });

    expect(summary.hasStructuredSummary).toBe(true);
    expect(summary.answer).toContain('matching document');
    expect(summary.sources[0]).toMatchObject({
      documentId: 'doc-1',
      title: 'Warranty Agreement',
      documentType: 'contract',
      score: 7,
    });
    expect(summary.routing).toMatchObject({
      source: 'extractions',
      matchedCount: 1,
      documentsScanned: 3,
    });
  });

  it('falls back to raw JSON for unsupported output shapes', () => {
    const summary = summarizeWorkflowStepOutput(['unexpected']);

    expect(summary.hasStructuredSummary).toBe(false);
    expect(summary.sources).toEqual([]);
    expect(summary.rawJson).toContain('unexpected');
  });
});
