export type ChatResponseModeId = 'direct' | 'cited' | 'plan' | 'extract';

export type ChatResponseMode = {
    id: ChatResponseModeId;
    label: string;
    description: string;
    instruction: string;
};

export const chatResponseModes: ChatResponseMode[] = [
    {
        id: 'direct',
        label: 'Direct',
        description: 'Answer normally.',
        instruction: '',
    },
    {
        id: 'cited',
        label: 'Cited',
        description: 'Require sources and uncertainty.',
        instruction: 'Use citations from the available sources when possible. Separate confirmed facts from assumptions and state when source evidence is missing.',
    },
    {
        id: 'plan',
        label: 'Plan',
        description: 'Return steps, owners, and checks.',
        instruction: 'Respond as an action plan with phases, owners if known, dependencies, validation checks, risks, and next steps.',
    },
    {
        id: 'extract',
        label: 'Extract',
        description: 'Return structured fields.',
        instruction: 'Extract structured information. Prefer concise tables or JSON-like fields, include confidence, and cite source evidence when available.',
    },
];

export const getChatResponseModeById = (modeId: string): ChatResponseMode =>
    chatResponseModes.find((mode) => mode.id === modeId) || chatResponseModes[0];

export const applyChatResponseMode = (prompt: string, modeId: ChatResponseModeId): string => {
    const mode = getChatResponseModeById(modeId);
    if (mode.id === 'direct') return prompt;

    return `${mode.instruction}\n\nUser request: ${prompt}`;
};
