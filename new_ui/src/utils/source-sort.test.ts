import { describe, expect, it } from 'vitest';
import type { Source } from '@/types';
import { sortSources, sourceSortOptions } from './source-sort';

const source = (id: string, title: string, score: number, metadata: Source['metadata'] = {}): Source => ({
    id,
    title,
    content: '',
    score,
    metadata,
});

describe('source sort', () => {
    it('sorts sources by relevance without mutating the original list', () => {
        const sources = [
            source('low', 'Low note', 0.28),
            source('high', 'High policy', 8.8),
            source('medium', 'Medium memo', 0.62),
        ];

        expect(sortSources(sources, 'relevance').map((item) => item.id)).toEqual(['high', 'medium', 'low']);
        expect(sources.map((item) => item.id)).toEqual(['low', 'high', 'medium']);
    });

    it('sorts sources by title', () => {
        expect(sortSources([
            source('b', 'Zeta policy', 0.9),
            source('a', 'Alpha memo', 0.2),
        ], 'title').map((item) => item.id)).toEqual(['a', 'b']);
    });

    it('sorts evidence-backed sources first', () => {
        expect(sortSources([
            source('none', 'No evidence', 0.95),
            source('excerpt', 'Excerpt evidence', 0.5, { chunk_snippets: ['Quote'] }),
            source('page', 'Page evidence', 0.6, { page_numbers: [3] }),
        ], 'evidence').map((item) => item.id)).toEqual(['page', 'excerpt', 'none']);
    });

    it('exposes stable sort options for the UI', () => {
        expect(sourceSortOptions).toEqual([
            { id: 'relevance', label: 'Relevance' },
            { id: 'title', label: 'Title' },
            { id: 'evidence', label: 'Evidence' },
        ]);
    });
});
