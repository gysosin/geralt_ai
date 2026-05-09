import { describe, expect, it } from 'vitest';
import {
    applyChatPromptTemplate,
    chatPromptTemplates,
    filterChatPromptTemplates,
    getChatPromptTemplateSummary,
} from './chat-prompt-templates';

describe('chat prompt templates', () => {
    it('filters templates by category and query', () => {
        expect(filterChatPromptTemplates('risk', 'all').map((template) => template.id)).toContain('risk-review');
        expect(filterChatPromptTemplates('', 'analysis').every((template) => template.category === 'analysis')).toBe(true);
    });

    it('applies a template with optional context', () => {
        const template = chatPromptTemplates.find((item) => item.id === 'source-summary')!;

        expect(applyChatPromptTemplate(template, 'Q2 financial report')).toContain('Q2 financial report');
        expect(applyChatPromptTemplate(template)).toContain('Summarize the selected knowledge');
    });

    it('summarizes available prompt coverage', () => {
        expect(getChatPromptTemplateSummary()).toEqual({
            total: 7,
            categories: 4,
        });
    });
});
