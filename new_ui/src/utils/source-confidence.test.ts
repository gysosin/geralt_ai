import { describe, expect, it } from 'vitest';
import type { Source } from '@/types';
import {
    filterSourcesByConfidence,
    getSourceConfidencePercent,
    sourceConfidenceFilters,
} from './source-confidence';

const source = (id: string, score: number): Source => ({
    id,
    title: `Source ${id}`,
    content: '',
    score,
});

describe('source confidence', () => {
    it('normalizes decimal and retriever scores into display percentages', () => {
        expect(getSourceConfidencePercent(source('decimal', 0.82))).toBe(82);
        expect(getSourceConfidencePercent(source('retriever', 7.4))).toBe(74);
        expect(getSourceConfidencePercent(source('over', 18))).toBe(100);
    });

    it('filters sources by confidence threshold', () => {
        const sources = [
            source('low', 0.32),
            source('medium', 0.58),
            source('high', 8.6),
        ];

        expect(filterSourcesByConfidence(sources, 'all').map((item) => item.id)).toEqual(['low', 'medium', 'high']);
        expect(filterSourcesByConfidence(sources, 'medium').map((item) => item.id)).toEqual(['medium', 'high']);
        expect(filterSourcesByConfidence(sources, 'high').map((item) => item.id)).toEqual(['high']);
    });

    it('exposes stable filter labels for the UI', () => {
        expect(sourceConfidenceFilters).toEqual([
            { id: 'all', label: 'All', minimumPercent: 0 },
            { id: 'medium', label: '50%+', minimumPercent: 50 },
            { id: 'high', label: '75%+', minimumPercent: 75 },
        ]);
    });
});
