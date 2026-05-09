import { describe, expect, it } from 'vitest';
import type { Source } from '@/types';
import { buildSourceCoverageSummary } from './source-coverage';

const source = (id: string, score: number, metadata: Source['metadata'] = {}): Source => ({
    id,
    title: `Source ${id}`,
    content: '',
    score,
    metadata,
});

describe('source coverage', () => {
    it('summarizes confidence mix and page-backed sources', () => {
        expect(buildSourceCoverageSummary([
            source('high', 8.8, { page_numbers: [1, 2] }),
            source('medium', 0.62, { chunk_snippets: ['Relevant quote'] }),
            source('low', 0.28),
        ])).toEqual({
            totalSources: 3,
            averageConfidence: 59,
            highConfidenceSources: 1,
            mediumConfidenceSources: 1,
            lowConfidenceSources: 1,
            pageBackedSources: 1,
            excerptBackedSources: 1,
            evidenceBackedSources: 2,
        });
    });

    it('returns an empty summary when there are no sources', () => {
        expect(buildSourceCoverageSummary([])).toEqual({
            totalSources: 0,
            averageConfidence: 0,
            highConfidenceSources: 0,
            mediumConfidenceSources: 0,
            lowConfidenceSources: 0,
            pageBackedSources: 0,
            excerptBackedSources: 0,
            evidenceBackedSources: 0,
        });
    });
});
