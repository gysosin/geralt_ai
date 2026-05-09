import { describe, expect, it } from 'vitest';
import {
    applyChatResponseMode,
    CHAT_RESPONSE_MODE_STORAGE_KEY,
    chatResponseModes,
    getChatResponseModeById,
    readStoredChatResponseMode,
    writeStoredChatResponseMode,
} from './chat-response-modes';

describe('chat response modes', () => {
    it('keeps direct mode prompts unchanged', () => {
        expect(applyChatResponseMode('Summarize this file', 'direct')).toBe('Summarize this file');
    });

    it('wraps prompts with mode instructions', () => {
        const prompt = applyChatResponseMode('Review vendor risk', 'cited');

        expect(prompt).toContain('Review vendor risk');
        expect(prompt).toContain('Use citations');
    });

    it('looks up configured modes', () => {
        expect(chatResponseModes).toHaveLength(4);
        expect(getChatResponseModeById('plan')?.label).toBe('Plan');
        expect(getChatResponseModeById('missing')?.id).toBe('direct');
    });

    it('stores only valid response mode preferences', () => {
        const storage = new Map<string, string>();
        const localStorageLike = {
            getItem: (key: string) => storage.get(key) || null,
            setItem: (key: string, value: string) => storage.set(key, value),
        };

        writeStoredChatResponseMode('cited', localStorageLike);
        expect(storage.get(CHAT_RESPONSE_MODE_STORAGE_KEY)).toBe('cited');
        expect(readStoredChatResponseMode(localStorageLike)).toBe('cited');

        storage.set(CHAT_RESPONSE_MODE_STORAGE_KEY, 'missing');
        expect(readStoredChatResponseMode(localStorageLike)).toBe('direct');
    });
});
