import { describe, expect, it } from 'vitest';
import {
    applyChatResponseMode,
    chatResponseModes,
    getChatResponseModeById,
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
});
