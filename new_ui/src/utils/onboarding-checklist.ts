export type OnboardingChecklistItem = {
    id: string;
    label: string;
    description: string;
    actionLabel: string;
    path: string;
};

export const ONBOARDING_CHECKLIST_STORAGE_KEY = 'geralt:onboarding-checklist:v1';

export const onboardingChecklistItems: OnboardingChecklistItem[] = [
    {
        id: 'create-agent',
        label: 'Create an AI agent',
        description: 'Set up a reusable assistant for one team workflow.',
        actionLabel: 'Open agents',
        path: '/bots',
    },
    {
        id: 'upload-knowledge',
        label: 'Upload knowledge',
        description: 'Add documents so answers can use workspace context.',
        actionLabel: 'Open knowledge',
        path: '/collections',
    },
    {
        id: 'ask-question',
        label: 'Ask a workspace question',
        description: 'Run one chat against your indexed knowledge.',
        actionLabel: 'Start chat',
        path: '/chat',
    },
    {
        id: 'review-health',
        label: 'Review workspace health',
        description: 'Confirm API, storage, search, and vector systems are ready.',
        actionLabel: 'View dashboard',
        path: '/',
    },
    {
        id: 'configure-settings',
        label: 'Configure providers',
        description: 'Review model, API, and security settings before rollout.',
        actionLabel: 'Open settings',
        path: '/settings',
    },
];

export const parseChecklistState = (rawValue: string | null): Record<string, boolean> => {
    if (!rawValue) return {};

    try {
        const parsed = JSON.parse(rawValue);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

        return Object.fromEntries(
            Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
        );
    } catch {
        return {};
    }
};

export const getChecklistProgress = (
    items: OnboardingChecklistItem[],
    completed: Record<string, boolean>,
) => {
    const completedCount = items.filter((item) => completed[item.id]).length;
    const total = items.length;
    const percentage = total === 0 ? 0 : Math.round((completedCount / total) * 100);

    return { completedCount, total, percentage };
};
