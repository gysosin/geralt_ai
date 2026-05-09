export const RECENT_PROMPTS_STORAGE_KEY = 'geralt.recentPrompts';
const MAX_RECENT_PROMPTS = 10;

export type RecentPrompt = {
    id: string;
    text: string;
    createdAt: string;
};

const normalizePrompt = (value: string) => value.trim().replace(/\s+/g, ' ');

export const parseRecentPrompts = (rawValue: string | null): RecentPrompt[] => {
    if (!rawValue) return [];

    try {
        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed)) return [];

        return parsed.filter((item): item is RecentPrompt => (
            item &&
            typeof item.id === 'string' &&
            typeof item.text === 'string' &&
            typeof item.createdAt === 'string'
        ));
    } catch {
        return [];
    }
};

export const addRecentPrompt = (
    prompts: RecentPrompt[],
    promptText: string,
    now = new Date(),
): RecentPrompt[] => {
    const text = normalizePrompt(promptText);
    if (!text) return prompts;

    const nextPrompt: RecentPrompt = {
        id: `${RECENT_PROMPTS_STORAGE_KEY}-${now.getTime()}-${text.slice(0, 16).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        text,
        createdAt: now.toISOString(),
    };

    return [
        nextPrompt,
        ...prompts.filter((prompt) => prompt.text.toLowerCase() !== text.toLowerCase()),
    ].slice(0, MAX_RECENT_PROMPTS);
};

export const removeRecentPrompt = (prompts: RecentPrompt[], promptId: string): RecentPrompt[] =>
    prompts.filter((prompt) => prompt.id !== promptId);
