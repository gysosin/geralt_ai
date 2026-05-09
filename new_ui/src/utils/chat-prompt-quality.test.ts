import { describe, expect, it } from 'vitest';
import { evaluateChatPromptQuality } from './chat-prompt-quality';

describe('chat prompt quality', () => {
    it('returns an empty-state guard for blank prompts', () => {
        expect(evaluateChatPromptQuality('   ')).toEqual({
            score: 0,
            label: 'No prompt',
            tone: 'muted',
            suggestions: ['Add a question or task before sending.'],
        });
    });

    it('scores specific grounded prompts higher than vague prompts', () => {
        const vague = evaluateChatPromptQuality('help me');
        const specific = evaluateChatPromptQuality('Summarize the uploaded policy document and cite the top risks for procurement.');

        expect(vague.score).toBeLessThan(specific.score);
        expect(specific.label).toBe('Strong');
        expect(specific.suggestions).toEqual([]);
    });
});
