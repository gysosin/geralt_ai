import { describe, expect, it } from 'vitest';
import {
    buildAgentComparisonRows,
    filterAgentComparisonRows,
    getAgentComparisonSummary,
    sortAgentComparisonRows,
} from './agent-comparison';

describe('agent comparison utilities', () => {
    const bots = [
        {
            id: 'research',
            name: 'Research Agent',
            description: 'Answers policy questions.',
            icon: '',
            collectionIds: ['policies', 'reports'],
            welcome_message: 'Ask about company knowledge.',
            stats: { chats: 1200, rating: 4.8 },
            bot_token: 'research-token',
            updated_at: '2026-05-01T12:00:00Z',
        },
        {
            id: 'draft',
            name: 'Draft Agent',
            description: '',
            icon: '',
            collectionIds: [],
            stats: { chats: 4, rating: 3.4 },
            bot_token: 'draft-token',
        },
        {
            id: 'support',
            name: 'Support Agent',
            description: 'Handles support handoffs.',
            icon: '',
            collectionIds: ['support'],
            stats: { chats: 80, rating: 4.2 },
            bot_token: 'support-token',
        },
    ];

    const collections = [
        { id: 'policies', name: 'Policies', fileCount: 4, size: '1 MB', lastUpdated: 'today', type: 'general' },
        { id: 'reports', name: 'Reports', fileCount: 7, size: '3 MB', lastUpdated: 'today', type: 'finance' },
        { id: 'support', name: 'Support KB', fileCount: 3, size: '2 MB', lastUpdated: 'today', type: 'tech' },
    ];

    it('builds comparable rows with readiness status and linked collections', () => {
        const rows = buildAgentComparisonRows(bots, collections);

        expect(rows[0]).toMatchObject({
            id: 'research',
            name: 'Research Agent',
            collectionCount: 2,
            collectionNames: ['Policies', 'Reports'],
            status: 'ready',
            detailPath: '/bots/research-token',
            chatPath: '/chat?bot=research-token&new=true',
        });
        expect(rows[1]).toMatchObject({
            id: 'draft',
            collectionCount: 0,
            status: 'needs-knowledge',
        });
    });

    it('summarizes catalog readiness', () => {
        const rows = buildAgentComparisonRows(bots, collections);

        expect(getAgentComparisonSummary(rows)).toEqual({
            total: 3,
            ready: 1,
            needsKnowledge: 1,
            averageReadiness: 66,
        });
    });

    it('filters and sorts rows for the comparison table', () => {
        const rows = buildAgentComparisonRows(bots, collections);

        expect(filterAgentComparisonRows(rows, 'needs-knowledge').map((row) => row.id)).toEqual(['draft']);
        expect(sortAgentComparisonRows(rows, 'collections').map((row) => row.id)).toEqual([
            'research',
            'support',
            'draft',
        ]);
        expect(sortAgentComparisonRows(rows, 'name').map((row) => row.id)).toEqual([
            'draft',
            'research',
            'support',
        ]);
    });
});
