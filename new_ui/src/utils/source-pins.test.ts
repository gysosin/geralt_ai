import { describe, expect, it } from 'vitest';
import type { Source } from '@/types';
import { getPinnedSources, getSourcePinId, togglePinnedSourceId } from './source-pins';

const source = (id: string, title: string, metadata: Source['metadata'] = {}): Source => ({
    id,
    title,
    content: '',
    score: 0.7,
    metadata,
});

describe('source pins', () => {
    it('toggles a source id in a pinned list', () => {
        expect(togglePinnedSourceId([], 'policy')).toEqual(['policy']);
        expect(togglePinnedSourceId(['policy', 'memo'], 'policy')).toEqual(['memo']);
    });

    it('uses stable source identifiers from id, metadata, title, then index', () => {
        expect(getSourcePinId(source('primary', 'Policy'), 0)).toBe('primary');
        expect(getSourcePinId(source('', 'Policy', { document_id: 'doc-42' }), 0)).toBe('doc-42');
        expect(getSourcePinId(source('', 'Policy'), 0)).toBe('Policy');
        expect(getSourcePinId(source('', ''), 2)).toBe('source-3');
    });

    it('returns pinned sources in pin order and skips missing ids', () => {
        const sources = [
            source('policy', 'Policy.pdf'),
            source('memo', 'Memo.pdf'),
        ];

        expect(getPinnedSources(sources, ['memo', 'missing', 'policy']).map((item) => item.title))
            .toEqual(['Memo.pdf', 'Policy.pdf']);
    });
});
