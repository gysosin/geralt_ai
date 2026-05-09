import { describe, expect, it } from 'vitest';
import {
    CHAT_DRAFT_STORAGE_KEY,
    buildChatDraftKey,
    clearChatDraft,
    readChatDraft,
    writeChatDraft,
} from './chat-drafts';

describe('chat draft utilities', () => {
    it('builds stable draft keys by chat context', () => {
        expect(buildChatDraftKey({ conversationId: 'c1', botToken: null, collectionId: null })).toBe(`${CHAT_DRAFT_STORAGE_KEY}:conversation:c1`);
        expect(buildChatDraftKey({ conversationId: null, botToken: 'bot1', collectionId: 'col1' })).toBe(`${CHAT_DRAFT_STORAGE_KEY}:bot:bot1:collection:col1`);
    });

    it('writes, reads, and clears a draft', () => {
        const storage = new Map<string, string>();
        const localStorageLike = {
            getItem: (key: string) => storage.get(key) || null,
            setItem: (key: string, value: string) => storage.set(key, value),
            removeItem: (key: string) => storage.delete(key),
        };
        const key = buildChatDraftKey({ conversationId: null, botToken: null, collectionId: null });

        writeChatDraft(key, 'Draft prompt', localStorageLike);

        expect(readChatDraft(key, localStorageLike)).toBe('Draft prompt');
        clearChatDraft(key, localStorageLike);
        expect(readChatDraft(key, localStorageLike)).toBe('');
    });
});
