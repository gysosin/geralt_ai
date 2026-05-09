import { describe, expect, it } from 'vitest';
import {
    RECENT_PROMPTS_STORAGE_KEY,
    addRecentPrompt,
    parseRecentPrompts,
    removeRecentPrompt,
} from './recent-prompts';

describe('recent prompt utilities', () => {
    it('adds newest prompts first and deduplicates by text', () => {
        const prompts = addRecentPrompt(
            addRecentPrompt([], 'Summarize the policy'),
            'Summarize the policy',
        );

        expect(prompts).toHaveLength(1);
        expect(prompts[0].text).toBe('Summarize the policy');
        expect(prompts[0].id).toContain(RECENT_PROMPTS_STORAGE_KEY);
    });

    it('limits history to the configured max count', () => {
        const prompts = Array.from({ length: 14 }, (_, index) => `Prompt ${index}`)
            .reduce((history, prompt) => addRecentPrompt(history, prompt), parseRecentPrompts(null));

        expect(prompts).toHaveLength(10);
        expect(prompts[0].text).toBe('Prompt 13');
        expect(prompts.at(-1)?.text).toBe('Prompt 4');
    });

    it('removes prompts by id and ignores invalid stored data', () => {
        const prompts = addRecentPrompt([], 'Create a rollout plan');

        expect(removeRecentPrompt(prompts, prompts[0].id)).toEqual([]);
        expect(parseRecentPrompts('[{"id":1},{"id":"ok","text":"Valid","createdAt":"now"}]')).toEqual([
            { id: 'ok', text: 'Valid', createdAt: 'now' },
        ]);
    });
});
