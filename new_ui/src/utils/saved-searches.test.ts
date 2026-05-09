import { describe, expect, it } from 'vitest';
import {
    addSavedSearchView,
    createSavedSearchView,
    parseSavedSearchViews,
    removeSavedSearchView,
} from './saved-searches';

describe('saved searches', () => {
    it('creates a saved search view from query and filter', () => {
        expect(createSavedSearchView('  vendor risk  ', 'collection', 1000)).toEqual({
            id: 'collection-vendor-risk-1000',
            label: 'vendor risk',
            query: 'vendor risk',
            filter: 'collection',
            createdAt: '1970-01-01T00:00:01.000Z',
        });
    });

    it('parses saved views defensively', () => {
        expect(parseSavedSearchViews(null)).toEqual([]);
        expect(parseSavedSearchViews('not-json')).toEqual([]);
        expect(parseSavedSearchViews(JSON.stringify([
            { id: 'good', label: 'Good', query: 'agent', filter: 'agent', createdAt: '2026-05-09T12:00:00Z' },
            { id: 'bad-filter', label: 'Bad', query: 'agent', filter: 'legacy', createdAt: '2026-05-09T12:00:00Z' },
        ]))).toEqual([
            { id: 'good', label: 'Good', query: 'agent', filter: 'agent', createdAt: '2026-05-09T12:00:00Z' },
        ]);
    });

    it('deduplicates by query and filter while keeping newest first', () => {
        const first = createSavedSearchView('vendor', 'all', 1000);
        const duplicate = createSavedSearchView('vendor', 'all', 2000);
        const next = addSavedSearchView([first], duplicate);

        expect(next).toEqual([duplicate]);
        expect(removeSavedSearchView(next, duplicate.id)).toEqual([]);
    });
});
