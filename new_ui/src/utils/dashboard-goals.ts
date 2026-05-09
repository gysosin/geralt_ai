export const DASHBOARD_GOALS_STORAGE_KEY = 'geralt:dashboard-goals:v1';

export const dashboardGoalDefinitions = [
    {
        id: 'agents',
        title: 'Deploy agents',
        description: 'Reusable assistants ready for team workflows',
        metricKey: 'bots',
        unit: 'agents',
        path: '/bots',
        actionLabel: 'Open agents',
    },
    {
        id: 'knowledge',
        title: 'Build knowledge',
        description: 'Collections available for grounded answers',
        metricKey: 'collections',
        unit: 'collections',
        path: '/collections',
        actionLabel: 'Open knowledge',
    },
    {
        id: 'conversations',
        title: 'Drive adoption',
        description: 'Workspace conversations started by users',
        metricKey: 'conversations',
        unit: 'chats',
        path: '/chat',
        actionLabel: 'Start chat',
    },
    {
        id: 'documents',
        title: 'Index documents',
        description: 'Files processed into searchable context',
        metricKey: 'documents',
        unit: 'docs',
        path: '/collections',
        actionLabel: 'Upload files',
    },
] as const;

export type DashboardGoalId = (typeof dashboardGoalDefinitions)[number]['id'];
export type DashboardStatsSnapshot = Record<'conversations' | 'bots' | 'collections' | 'documents', number>;
export type DashboardGoalTargets = Record<DashboardGoalId, number>;

export type DashboardGoal = {
    id: DashboardGoalId;
    title: string;
    description: string;
    current: number;
    target: number;
    percentage: number;
    unit: string;
    path: string;
    actionLabel: string;
};

export const DEFAULT_DASHBOARD_GOAL_TARGETS: DashboardGoalTargets = {
    agents: 3,
    knowledge: 5,
    conversations: 20,
    documents: 50,
};

const clampTarget = (value: number) => Math.min(999_999, Math.max(1, Math.round(value)));

export const parseDashboardGoalTargets = (rawValue: string | null): DashboardGoalTargets => {
    const defaults = { ...DEFAULT_DASHBOARD_GOAL_TARGETS };
    if (!rawValue) return defaults;

    try {
        const parsed = JSON.parse(rawValue);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults;

        dashboardGoalDefinitions.forEach((definition) => {
            const value = parsed[definition.id];
            if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
                defaults[definition.id] = clampTarget(value);
            }
        });

        return defaults;
    } catch {
        return defaults;
    }
};

export const setDashboardGoalTarget = (
    targets: DashboardGoalTargets,
    goalId: DashboardGoalId,
    target: number,
): DashboardGoalTargets => ({
    ...targets,
    [goalId]: clampTarget(target),
});

export const buildDashboardGoals = (
    stats: DashboardStatsSnapshot,
    targets: DashboardGoalTargets,
): DashboardGoal[] =>
    dashboardGoalDefinitions.map((definition) => {
        const current = Math.max(0, stats[definition.metricKey]);
        const target = clampTarget(targets[definition.id]);
        const percentage = Math.min(100, Math.round((current / target) * 100));

        return {
            id: definition.id,
            title: definition.title,
            description: definition.description,
            current,
            target,
            percentage,
            unit: definition.unit,
            path: definition.path,
            actionLabel: definition.actionLabel,
        };
    });
