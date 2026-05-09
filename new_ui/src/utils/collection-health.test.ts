import { describe, expect, it } from 'vitest';
import { buildCollectionHealthItems, getCollectionHealthSummary } from './collection-health';

describe('collection health utilities', () => {
    it('classifies collections by document coverage and freshness', () => {
        const items = buildCollectionHealthItems([
            { id: 'empty', name: 'Empty', fileCount: 0, size: '0 MB', lastUpdated: '2026-05-09T12:00:00Z', type: 'general' },
            { id: 'active', name: 'Active', fileCount: 3, size: '1 MB', lastUpdated: '2026-05-01T12:00:00Z', type: 'tech' },
            { id: 'stale', name: 'Stale', fileCount: 2, size: '1 MB', lastUpdated: '2026-01-01T12:00:00Z', type: 'legal' },
        ], new Date('2026-05-09T12:00:00Z'));

        expect(items.map((item) => ({ id: item.id, status: item.status }))).toEqual([
            { id: 'empty', status: 'empty' },
            { id: 'active', status: 'healthy' },
            { id: 'stale', status: 'stale' },
        ]);
    });

    it('summarizes health counts', () => {
        const items = buildCollectionHealthItems([
            { id: 'empty', name: 'Empty', fileCount: 0, size: '0 MB', lastUpdated: '2026-05-09T12:00:00Z', type: 'general' },
            { id: 'active', name: 'Active', fileCount: 3, size: '1 MB', lastUpdated: '2026-05-01T12:00:00Z', type: 'tech' },
        ], new Date('2026-05-09T12:00:00Z'));

        expect(getCollectionHealthSummary(items)).toEqual({
            total: 2,
            healthy: 1,
            empty: 1,
            stale: 0,
        });
    });
});
