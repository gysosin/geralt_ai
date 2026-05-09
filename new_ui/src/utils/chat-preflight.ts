export type ChatPreflightStatus = 'waiting' | 'ready' | 'sending';

export type ChatPreflightItem = {
    label: string;
    value: string;
};

export type ChatPreflightSummary = {
    status: ChatPreflightStatus;
    statusLabel: string;
    canSend: boolean;
    items: ChatPreflightItem[];
};

type ChatPreflightInput = {
    agentName: string;
    collectionLabel: string;
    responseModeLabel: string;
    draft: string;
    isSending: boolean;
};

export const buildChatPreflightSummary = ({
    agentName,
    collectionLabel,
    responseModeLabel,
    draft,
    isSending,
}: ChatPreflightInput): ChatPreflightSummary => {
    const hasPrompt = Boolean(draft.trim());
    const status: ChatPreflightStatus = isSending ? 'sending' : hasPrompt ? 'ready' : 'waiting';

    return {
        status,
        statusLabel: status === 'sending'
            ? 'Sending'
            : status === 'ready'
                ? 'Ready'
                : 'Waiting for prompt',
        canSend: status === 'ready',
        items: [
            { label: 'Agent', value: agentName },
            { label: 'Knowledge', value: collectionLabel },
            { label: 'Mode', value: responseModeLabel },
            { label: 'Send', value: status === 'ready' ? 'Ready' : status === 'sending' ? 'In progress' : 'Add a prompt' },
        ],
    };
};
