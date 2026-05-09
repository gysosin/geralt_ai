import { describe, expect, it } from 'vitest';
import type { Source } from '@/types';
import { buildSourceExportSummary } from './source-export';

const source = (title: string, score: number, metadata: Source['metadata'] = {}): Source => ({
    id: title.toLowerCase().replace(/\s+/g, '-'),
    title,
    content: '',
    score,
    metadata,
});

describe('source export', () => {
    it('builds a markdown citation summary with score, pages, and excerpts', () => {
        expect(buildSourceExportSummary([
            source('Policy.pdf', 8.8, {
                page_numbers: [1, 2],
                chunk_snippets: ['Use approved vendors for renewals.'],
            }),
            source('Memo.txt', 0.62),
        ])).toBe([
            'Citation summary',
            '',
            '1. Policy.pdf - 88% - Pages 1, 2',
            '   - Use approved vendors for renewals.',
            '2. Memo.txt - 62%',
        ].join('\n'));
    });

    it('returns an empty-state summary when there are no sources', () => {
        expect(buildSourceExportSummary([])).toBe('Citation summary\n\nNo sources available.');
    });
});
