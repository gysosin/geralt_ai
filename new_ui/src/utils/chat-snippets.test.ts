import { describe, expect, it } from 'vitest';
import {
    addChatSnippet,
    parseChatSnippets,
    removeChatSnippet,
} from './chat-snippets';

describe('chat snippets', () => {
    it('parses only valid persisted snippets', () => {
        expect(parseChatSnippets(JSON.stringify([
            { id: 'valid', title: 'Valid', text: 'Summarize this policy', createdAt: '2026-05-09T10:00:00.000Z' },
            { id: 'missing-text', title: 'Invalid', createdAt: '2026-05-09T10:00:00.000Z' },
            null,
        ]))).toEqual([
            { id: 'valid', title: 'Valid', text: 'Summarize this policy', createdAt: '2026-05-09T10:00:00.000Z' },
        ]);
    });

    it('adds a normalized snippet and deduplicates by text', () => {
        const first = addChatSnippet([], '  Summarize   this policy  ', new Date('2026-05-09T10:00:00.000Z'));
        const second = addChatSnippet(first, 'summarize this policy', new Date('2026-05-09T11:00:00.000Z'));

        expect(second).toHaveLength(1);
        expect(second[0]).toMatchObject({
            title: 'summarize this policy',
            text: 'summarize this policy',
            createdAt: '2026-05-09T11:00:00.000Z',
        });
    });

    it('keeps the newest eight snippets and removes by id', () => {
        const snippets = Array.from({ length: 10 }).reduce(
            (current, _, index) => addChatSnippet(current, `Snippet ${index}`, new Date(2026, 4, 9, 10, index)),
            [],
        );

        expect(snippets).toHaveLength(8);
        expect(snippets[0].text).toBe('Snippet 9');
        expect(removeChatSnippet(snippets, snippets[0].id)).toHaveLength(7);
    });
});
