export type ChatSendGuardResult = {
    requiresConfirmation: boolean;
    reasons: string[];
};

const riskTerms: Array<{ reason: string; pattern: RegExp }> = [
    { reason: 'approval', pattern: /\b(approve|approval|authorize|sign off)\b/i },
    { reason: 'payment', pattern: /\b(payment|pay|invoice|refund|charge|billing)\b/i },
    { reason: 'deletion', pattern: /\b(delete|remove|destroy|purge)\b/i },
    { reason: 'legal', pattern: /\b(contract|legal|nda|liability|settlement)\b/i },
    { reason: 'external message', pattern: /\b(email|notify|send to|message the client|contact)\b/i },
];

export const evaluateChatSendGuard = (prompt: string): ChatSendGuardResult => {
    const reasons = riskTerms
        .filter(({ pattern }) => pattern.test(prompt))
        .map(({ reason }) => reason);

    return {
        requiresConfirmation: reasons.length > 0,
        reasons,
    };
};
