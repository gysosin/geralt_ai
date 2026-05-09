import { describe, expect, it } from 'vitest';
import { buildRecentActivityItems } from './activity-feed';

describe('buildRecentActivityItems', () => {
    it('combines real conversations, agents, and collections in reverse chronological order', () => {
        const items = buildRecentActivityItems({
            conversations: [{
                id: 'chat-1',
                conversation_id: 'chat-1',
                title: 'Policy chat',
                lastMessage: 'Last answer',
                timestamp: '2026-05-09T09:00:00.000Z',
            }],
            bots: [{
                id: 'bot-1',
                name: 'Policy agent',
                description: 'Answers policy questions',
                icon: '',
                collectionIds: [],
                stats: { chats: 0, rating: 0 },
                created_at: '2026-05-09T10:00:00.000Z',
            }],
            collections: [{
                id: 'collection-1',
                name: 'HR Docs',
                fileCount: 3,
                size: '10 MB',
                lastUpdated: '2026-05-09T08:00:00.000Z',
                type: 'general',
            }],
        });

        expect(items.map((item) => item.type)).toEqual(['agent', 'chat', 'collection']);
        expect(items[0]).toMatchObject({
            title: 'Policy agent',
            path: '/bots',
        });
    });

    it('skips records without usable timestamps instead of inventing activity', () => {
        const items = buildRecentActivityItems({
            conversations: [{ id: 'chat-1', title: '', lastMessage: '', timestamp: 'invalid' }],
            bots: [],
            collections: [],
        });

        expect(items).toEqual([]);
    });
});
