import { describe, expect, it } from 'vitest';
import { buildGlobalSearchIndex, searchGlobalIndex } from './global-search';

describe('global search utilities', () => {
    const index = buildGlobalSearchIndex({
        conversations: [
            { id: 'c1', title: 'Budget planning chat', lastMessage: 'Review procurement spend', timestamp: '2026-05-09T12:00:00Z' },
        ],
        bots: [
            { id: 'b1', name: 'Procurement Agent', description: 'Compares vendors', icon: '', collectionIds: [], stats: { chats: 0, rating: 0 }, bot_token: 'bot-token' },
        ],
        collections: [
            { id: 'k1', name: 'Vendor Contracts', fileCount: 4, size: '10 MB', lastUpdated: 'today', type: 'legal', description: 'Legal terms' },
        ],
    });

    it('builds searchable workspace records with routes', () => {
        expect(index.map((item) => ({ type: item.type, title: item.title, path: item.path }))).toEqual([
            { type: 'conversation', title: 'Budget planning chat', path: '/history/c1' },
            { type: 'agent', title: 'Procurement Agent', path: '/bots/bot-token' },
            { type: 'collection', title: 'Vendor Contracts', path: '/collections/k1' },
        ]);
    });

    it('ranks title matches above body matches and supports type filters', () => {
        expect(searchGlobalIndex(index, 'procurement').map((item) => item.id)).toEqual([
            'agent-bot-token',
            'conversation-c1',
        ]);
        expect(searchGlobalIndex(index, 'vendor', 'collection').map((item) => item.id)).toEqual([
            'collection-k1',
        ]);
    });

    it('returns an empty array for blank queries', () => {
        expect(searchGlobalIndex(index, '   ')).toEqual([]);
    });
});
