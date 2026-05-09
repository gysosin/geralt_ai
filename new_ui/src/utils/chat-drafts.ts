export const CHAT_DRAFT_STORAGE_KEY = 'geralt.chatDraft';

type DraftStorage = {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
};

export type ChatDraftContext = {
    conversationId?: string | null;
    botToken?: string | null;
    collectionId?: string | null;
};

const getLocalStorage = (): DraftStorage | undefined => {
    if (typeof window === 'undefined') return undefined;
    return window.localStorage;
};

export const buildChatDraftKey = ({ conversationId, botToken, collectionId }: ChatDraftContext): string => {
    if (conversationId) return `${CHAT_DRAFT_STORAGE_KEY}:conversation:${conversationId}`;

    return [
        CHAT_DRAFT_STORAGE_KEY,
        botToken ? `bot:${botToken}` : 'bot:default',
        collectionId ? `collection:${collectionId}` : 'collection:all',
    ].join(':');
};

export const readChatDraft = (
    key: string,
    storage: DraftStorage | undefined = getLocalStorage(),
): string => storage?.getItem(key) || '';

export const writeChatDraft = (
    key: string,
    draft: string,
    storage: DraftStorage | undefined = getLocalStorage(),
) => {
    const normalizedDraft = draft.trimEnd();
    if (!storage) return;

    if (!normalizedDraft.trim()) {
        storage.removeItem(key);
        return;
    }

    storage.setItem(key, normalizedDraft);
};

export const clearChatDraft = (
    key: string,
    storage: DraftStorage | undefined = getLocalStorage(),
) => {
    storage?.removeItem(key);
};
