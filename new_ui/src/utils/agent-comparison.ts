import type { Bot, Collection } from '@/types';

export type AgentComparisonStatus = 'ready' | 'training' | 'needs-knowledge' | 'draft';
export type AgentComparisonFilter = 'all' | AgentComparisonStatus;
export type AgentComparisonSortKey = 'readiness' | 'collections' | 'chats' | 'rating' | 'name';

export type AgentComparisonRow = {
    id: string;
    token?: string;
    name: string;
    description: string;
    icon: string;
    collectionCount: number;
    collectionNames: string[];
    chatCount: number;
    rating: number;
    readinessScore: number;
    status: AgentComparisonStatus;
    statusLabel: string;
    recommendation: string;
    updatedAt?: string;
    detailPath: string;
    chatPath: string;
};

export type AgentComparisonSummary = {
    total: number;
    ready: number;
    needsKnowledge: number;
    averageReadiness: number;
};

const getBotToken = (bot: Bot) => bot.bot_token || bot.id;

const normalizeCollectionIds = (bot: Bot): string[] => {
    const ids = bot.collectionIds || bot.collection_ids || [];
    return [...new Set(ids.filter(Boolean))];
};

const normalizeRating = (rating: number | undefined) => {
    if (!Number.isFinite(rating)) return 0;
    return Math.max(0, Math.min(5, Number(rating)));
};

const getEngagementScore = (chatCount: number) => {
    if (chatCount >= 1000) return 20;
    if (chatCount >= 100) return 15;
    if (chatCount >= 50) return 10;
    if (chatCount > 0) return 5;
    return 0;
};

const getReadinessScore = (bot: Bot, collectionCount: number) => {
    const rating = normalizeRating(bot.stats?.rating);
    const chatCount = Math.max(0, bot.stats?.chats || 0);
    const knowledgeScore = Math.min(collectionCount * 15, 30);
    const profileScore = (bot.description ? 10 : 0) + (bot.welcome_message ? 10 : 0);
    const ratingScore = Math.round((rating / 5) * 25);
    const score = 10 + knowledgeScore + profileScore + ratingScore + getEngagementScore(chatCount);

    return Math.min(100, score);
};

const getStatus = (row: Pick<AgentComparisonRow, 'collectionCount' | 'readinessScore'>): AgentComparisonStatus => {
    if (row.collectionCount === 0) return 'needs-knowledge';
    if (row.readinessScore >= 80) return 'ready';
    if (row.readinessScore >= 55) return 'training';
    return 'draft';
};

const statusCopy: Record<AgentComparisonStatus, { label: string; recommendation: string }> = {
    ready: {
        label: 'Ready',
        recommendation: 'Agent has knowledge coverage and enough signal to use in production workflows.',
    },
    training: {
        label: 'Training',
        recommendation: 'Agent is usable, but more conversations or a richer welcome flow would improve confidence.',
    },
    'needs-knowledge': {
        label: 'Needs knowledge',
        recommendation: 'Attach at least one knowledge collection before routing production questions here.',
    },
    draft: {
        label: 'Draft',
        recommendation: 'Complete the profile and validate the agent with a small internal test run.',
    },
};

export const buildAgentComparisonRows = (bots: Bot[], collections: Collection[] = []): AgentComparisonRow[] => {
    const collectionNames = new Map(
        collections.map((collection) => [
            collection.id,
            collection.name || collection.collection_name || 'Untitled collection',
        ]),
    );

    return bots.map((bot) => {
        const token = getBotToken(bot);
        const collectionIds = normalizeCollectionIds(bot);
        const collectionCount = collectionIds.length;
        const readinessScore = getReadinessScore(bot, collectionCount);
        const status = getStatus({ collectionCount, readinessScore });
        const copy = statusCopy[status];

        return {
            id: bot.id || token,
            token,
            name: bot.name || bot.bot_name || 'Unnamed agent',
            description: bot.description || bot.welcome_message || 'No description provided.',
            icon: bot.icon || bot.icon_url || 'https://picsum.photos/id/1/200/200',
            collectionCount,
            collectionNames: collectionIds.map((id) => collectionNames.get(id) || id),
            chatCount: Math.max(0, bot.stats?.chats || 0),
            rating: normalizeRating(bot.stats?.rating),
            readinessScore,
            status,
            statusLabel: copy.label,
            recommendation: copy.recommendation,
            updatedAt: bot.updated_at || bot.created_at,
            detailPath: `/bots/${token}`,
            chatPath: `/chat?bot=${token}&new=true`,
        };
    });
};

export const getAgentComparisonSummary = (rows: AgentComparisonRow[]): AgentComparisonSummary => ({
    total: rows.length,
    ready: rows.filter((row) => row.status === 'ready').length,
    needsKnowledge: rows.filter((row) => row.status === 'needs-knowledge').length,
    averageReadiness: rows.length
        ? Math.round(rows.reduce((total, row) => total + row.readinessScore, 0) / rows.length)
        : 0,
});

export const filterAgentComparisonRows = (
    rows: AgentComparisonRow[],
    filter: AgentComparisonFilter,
): AgentComparisonRow[] => {
    if (filter === 'all') return rows;
    return rows.filter((row) => row.status === filter);
};

export const sortAgentComparisonRows = (
    rows: AgentComparisonRow[],
    sortKey: AgentComparisonSortKey,
): AgentComparisonRow[] => {
    const nextRows = [...rows];

    return nextRows.sort((left, right) => {
        if (sortKey === 'name') return left.name.localeCompare(right.name);
        if (sortKey === 'collections') {
            if (right.collectionCount !== left.collectionCount) return right.collectionCount - left.collectionCount;
        }
        if (sortKey === 'chats') {
            if (right.chatCount !== left.chatCount) return right.chatCount - left.chatCount;
        }
        if (sortKey === 'rating') {
            if (right.rating !== left.rating) return right.rating - left.rating;
        }
        if (right.readinessScore !== left.readinessScore) return right.readinessScore - left.readinessScore;
        return left.name.localeCompare(right.name);
    });
};
