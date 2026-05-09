export interface WorkflowStepSourceSummary {
  documentId: string;
  title: string;
  documentType: string;
  summary: string;
  score?: number;
}

export interface WorkflowStepRoutingSummary {
  method: string;
  source: string;
  matchedCount?: number;
  documentsScanned?: number;
}

export interface WorkflowStepOutputSummary {
  answer: string;
  sources: WorkflowStepSourceSummary[];
  routing: WorkflowStepRoutingSummary | null;
  rawJson: string;
  hasStructuredSummary: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export const summarizeWorkflowStepOutput = (output: unknown): WorkflowStepOutputSummary => {
  const rawJson = output == null ? '' : JSON.stringify(output, null, 2);
  if (!isRecord(output)) {
    return {
      answer: '',
      sources: [],
      routing: null,
      rawJson,
      hasStructuredSummary: false,
    };
  }

  const sources = Array.isArray(output.sources)
    ? output.sources.filter(isRecord).slice(0, 3).map((source) => ({
      documentId: asString(source.document_id),
      title: asString(source.title) || asString(source.document_id) || 'Untitled document',
      documentType: asString(source.document_type) || 'document',
      summary: asString(source.summary),
      score: asNumber(source.score),
    }))
    : [];

  const routingRecord = isRecord(output.routing) ? output.routing : null;
  const routing = routingRecord ? {
    method: asString(routingRecord.method),
    source: asString(routingRecord.source),
    matchedCount: asNumber(routingRecord.matched_count),
    documentsScanned: asNumber(routingRecord.documents_scanned),
  } : null;

  const answer = asString(output.answer);
  return {
    answer,
    sources,
    routing,
    rawJson,
    hasStructuredSummary: Boolean(answer || sources.length || routing),
  };
};
