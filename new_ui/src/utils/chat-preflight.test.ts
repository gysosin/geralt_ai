import { describe, expect, it } from 'vitest';
import { buildChatPreflightSummary } from './chat-preflight';

describe('chat preflight summary', () => {
    it('marks an empty prompt as waiting with the selected context', () => {
        expect(buildChatPreflightSummary({
            agentName: 'Geralt AI',
            collectionLabel: 'All collections',
            responseModeLabel: 'Direct',
            draft: '   ',
            isSending: false,
        })).toEqual({
            status: 'waiting',
            statusLabel: 'Waiting for prompt',
            canSend: false,
            items: [
                { label: 'Agent', value: 'Geralt AI' },
                { label: 'Knowledge', value: 'All collections' },
                { label: 'Mode', value: 'Direct' },
                { label: 'Send', value: 'Add a prompt' },
            ],
        });
    });

    it('marks a non-empty prompt as ready unless a send is in progress', () => {
        expect(buildChatPreflightSummary({
            agentName: 'Policy Agent',
            collectionLabel: 'Policies',
            responseModeLabel: 'Cited',
            draft: 'Summarize the policy',
            isSending: false,
        }).status).toBe('ready');

        expect(buildChatPreflightSummary({
            agentName: 'Policy Agent',
            collectionLabel: 'Policies',
            responseModeLabel: 'Cited',
            draft: 'Summarize the policy',
            isSending: true,
        }).status).toBe('sending');
    });
});
