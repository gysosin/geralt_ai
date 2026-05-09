export type ChatResponseModeId = 'direct' | 'cited' | 'plan' | 'extract';

export const CHAT_RESPONSE_MODE_STORAGE_KEY = 'geralt.chatResponseMode';

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

type ResponseModeStorage = {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
};

const getLocalStorage = (): ResponseModeStorage | undefined => {
    if (typeof window === 'undefined') return undefined;
    return window.localStorage;
};

const isChatResponseModeId = (modeId: string | null): modeId is ChatResponseModeId =>
    Boolean(modeId && chatResponseModes.some((mode) => mode.id === modeId));

export const readStoredChatResponseMode = (
    storage: ResponseModeStorage | undefined = getLocalStorage(),
): ChatResponseModeId => {
    const modeId = storage?.getItem(CHAT_RESPONSE_MODE_STORAGE_KEY) || null;
    return isChatResponseModeId(modeId) ? modeId : 'direct';
};

export const writeStoredChatResponseMode = (
    modeId: ChatResponseModeId,
    storage: ResponseModeStorage | undefined = getLocalStorage(),
) => {
    storage?.setItem(CHAT_RESPONSE_MODE_STORAGE_KEY, modeId);
};

export const applyChatResponseMode = (prompt: string, modeId: ChatResponseModeId): string => {
    const mode = getChatResponseModeById(modeId);
    if (mode.id === 'direct') return prompt;

    return `${mode.instruction}\n\nUser request: ${prompt}`;
};
