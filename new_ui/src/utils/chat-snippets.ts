export const CHAT_SNIPPETS_STORAGE_KEY = 'geralt.chatSnippets';
const MAX_CHAT_SNIPPETS = 8;

export type ChatSnippet = {
    id: string;
    title: string;
    text: string;
    createdAt: string;
};

const normalizeSnippetText = (value: string) => value.trim().replace(/\s+/g, ' ');

const buildSnippetTitle = (text: string) => {
    if (text.length <= 56) return text;
    return `${text.slice(0, 53).trim()}...`;
};

export const parseChatSnippets = (rawValue: string | null): ChatSnippet[] => {
    if (!rawValue) return [];

    try {
        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed)) return [];

        return parsed.filter((item): item is ChatSnippet => (
            item &&
            typeof item.id === 'string' &&
            typeof item.title === 'string' &&
            typeof item.text === 'string' &&
            typeof item.createdAt === 'string'
        ));
    } catch {
        return [];
    }
};

export const addChatSnippet = (
    snippets: ChatSnippet[],
    promptText: string,
    now = new Date(),
): ChatSnippet[] => {
    const text = normalizeSnippetText(promptText);
    if (!text) return snippets;

    const nextSnippet: ChatSnippet = {
        id: `${CHAT_SNIPPETS_STORAGE_KEY}-${now.getTime()}-${text.slice(0, 16).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title: buildSnippetTitle(text),
        text,
        createdAt: now.toISOString(),
    };

    return [
        nextSnippet,
        ...snippets.filter((snippet) => snippet.text.toLowerCase() !== text.toLowerCase()),
    ].slice(0, MAX_CHAT_SNIPPETS);
};

export const removeChatSnippet = (snippets: ChatSnippet[], snippetId: string): ChatSnippet[] =>
    snippets.filter((snippet) => snippet.id !== snippetId);
