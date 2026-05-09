import { describe, expect, it } from 'vitest';
import { evaluateChatSendGuard } from './chat-send-guard';

describe('chat send guard', () => {
    it('does not require confirmation for ordinary prompts', () => {
        expect(evaluateChatSendGuard('Summarize this document')).toEqual({
            requiresConfirmation: false,
            reasons: [],
        });
    });

    it('requires confirmation for high-impact prompts', () => {
        expect(evaluateChatSendGuard('Approve the vendor payment and delete the old draft')).toEqual({
            requiresConfirmation: true,
            reasons: ['approval', 'payment', 'deletion'],
        });
    });
});
