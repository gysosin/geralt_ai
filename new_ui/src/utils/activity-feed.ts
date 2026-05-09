import type { Bot, Collection, ConversationSummary } from '@/types';

export type ActivityFeedItem = {
    id: string;
    type: 'chat' | 'agent' | 'collection';
    title: string;
    description: string;
    timestamp: string;
    path: string;
};

type ActivitySources = {
    conversations: ConversationSummary[];
    bots: Bot[];
    collections: Collection[];
};

const toValidTimestamp = (value?: string): string | null => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
};

export const buildRecentActivityItems = ({
    conversations,
    bots,
    collections,
}: ActivitySources): ActivityFeedItem[] => {
    const chatItems = conversations.flatMap((conversation) => {
        const timestamp = toValidTimestamp(conversation.updated_at || conversation.timestamp || conversation.created_at);
        if (!timestamp) return [];

        const id = conversation.conversation_id || conversation.id;
        return [{
            id: `chat:${id}`,
            type: 'chat' as const,
            title: conversation.title || 'Conversation updated',
            description: conversation.lastMessage || conversation.first_message || 'Conversation activity recorded',
            timestamp,
            path: `/chat?conversation=${id}`,
        }];
    });

    const agentItems = bots.flatMap((bot) => {
        const timestamp = toValidTimestamp(bot.updated_at || bot.created_at);
        if (!timestamp) return [];

        const id = bot.bot_token || bot.id;
        return [{
            id: `agent:${id}`,
            type: 'agent' as const,
            title: bot.bot_name || bot.name || 'Agent updated',
            description: bot.description || 'Agent configuration changed',
            timestamp,
            path: '/bots',
        }];
    });

    const collectionItems = collections.flatMap((collection) => {
        const timestamp = toValidTimestamp(collection.lastUpdated || collection.created_at);
        if (!timestamp) return [];

        const id = collection.id || collection.collection_name;
        return [{
            id: `collection:${id}`,
            type: 'collection' as const,
            title: collection.collection_name || collection.name || 'Collection updated',
            description: `${collection.file_count || collection.fileCount || collection.document_count || 0} documents available`,
            timestamp,
            path: '/collections',
        }];
    });

    return [...chatItems, ...agentItems, ...collectionItems]
        .sort((first, second) => new Date(second.timestamp).getTime() - new Date(first.timestamp).getTime())
        .slice(0, 8);
};
