import type { Bot, Collection, ConversationSummary } from '@/types';

export type GlobalSearchResultType = 'conversation' | 'agent' | 'collection';
export type GlobalSearchFilter = 'all' | GlobalSearchResultType;

export type GlobalSearchResult = {
    id: string;
    sourceId: string;
    type: GlobalSearchResultType;
    title: string;
    description: string;
    path: string;
    updatedAt?: string;
    searchText: string;
};

interface BuildGlobalSearchIndexInput {
    conversations: ConversationSummary[];
    bots: Bot[];
    collections: Collection[];
}

const normalize = (value: unknown) => String(value || '').toLowerCase();

export const buildGlobalSearchIndex = ({
    conversations,
    bots,
    collections,
}: BuildGlobalSearchIndexInput): GlobalSearchResult[] => [
        ...conversations.map((conversation) => {
            const sourceId = conversation.id || conversation.conversation_id || '';
            const title = conversation.title || conversation.first_message || 'Untitled conversation';
            const description = conversation.lastMessage || conversation.first_message || 'Conversation history';

            return {
                id: `conversation-${sourceId}`,
                sourceId,
                type: 'conversation' as const,
                title,
                description,
                path: `/history/${sourceId}`,
                updatedAt: conversation.updated_at || conversation.created_at || conversation.timestamp,
                searchText: normalize(`${title} ${description} ${conversation.botId || ''}`),
            };
        }),
        ...bots.map((bot) => {
            const sourceId = bot.bot_token || bot.id;
            const title = bot.name || bot.bot_name || 'Unnamed agent';
            const description = bot.description || bot.welcome_message || 'AI agent';

            return {
                id: `agent-${sourceId}`,
                sourceId,
                type: 'agent' as const,
                title,
                description,
                path: `/bots/${sourceId}`,
                updatedAt: bot.updated_at || bot.created_at,
                searchText: normalize(`${title} ${description} ${(bot.collectionIds || bot.collection_ids || []).join(' ')}`),
            };
        }),
        ...collections.map((collection) => {
            const sourceId = collection.id;
            const title = collection.name || collection.collection_name || 'Untitled collection';
            const description = collection.description || `${collection.fileCount || collection.file_count || 0} indexed files`;

            return {
                id: `collection-${sourceId}`,
                sourceId,
                type: 'collection' as const,
                title,
                description,
                path: `/collections/${sourceId}`,
                updatedAt: collection.created_at || collection.lastUpdated,
                searchText: normalize(`${title} ${description} ${collection.type || ''}`),
            };
        }),
    ];

export const searchGlobalIndex = (
    index: GlobalSearchResult[],
    query: string,
    filter: GlobalSearchFilter = 'all',
): GlobalSearchResult[] => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    return index
        .filter((item) => filter === 'all' || item.type === filter)
        .map((item) => {
            const title = normalize(item.title);
            const description = normalize(item.description);
            const score = terms.reduce((total, term) => {
                if (title.includes(term)) return total + 5;
                if (description.includes(term)) return total + 3;
                if (item.searchText.includes(term)) return total + 1;
                return total;
            }, 0);

            return { item, score };
        })
        .filter(({ score }) => score > 0)
        .sort((left, right) => {
            if (right.score !== left.score) return right.score - left.score;
            return left.item.title.localeCompare(right.item.title);
        })
        .map(({ item }) => item);
};
