export const DASHBOARD_LAYOUT_STORAGE_KEY = 'geralt:dashboard-layout:v1';

export const dashboardSectionDefinitions = [
    { id: 'health', label: 'Workspace health' },
    { id: 'analytics', label: 'Usage analytics' },
    { id: 'onboarding', label: 'Quick start' },
    { id: 'goals', label: 'Goals' },
    { id: 'kpis', label: 'KPI cards' },
    { id: 'usageChart', label: 'Token chart' },
    { id: 'activity', label: 'Activity feed' },
    { id: 'quickActions', label: 'Quick actions' },
    { id: 'tips', label: 'AI tips' },
] as const;

export type DashboardSectionId = (typeof dashboardSectionDefinitions)[number]['id'];
export type DashboardDensity = 'comfortable' | 'compact';

export type DashboardLayoutPreferences = {
    density: DashboardDensity;
    visibleSections: Record<DashboardSectionId, boolean>;
};

const defaultVisibleSections = dashboardSectionDefinitions.reduce((sections, section) => {
    sections[section.id] = true;
    return sections;
}, {} as Record<DashboardSectionId, boolean>);

export const DEFAULT_DASHBOARD_LAYOUT_PREFERENCES: DashboardLayoutPreferences = {
    density: 'comfortable',
    visibleSections: defaultVisibleSections,
};

export const createDefaultDashboardLayoutPreferences = (): DashboardLayoutPreferences => ({
    density: DEFAULT_DASHBOARD_LAYOUT_PREFERENCES.density,
    visibleSections: { ...DEFAULT_DASHBOARD_LAYOUT_PREFERENCES.visibleSections },
});

const isDashboardDensity = (value: unknown): value is DashboardDensity =>
    value === 'comfortable' || value === 'compact';

export const parseDashboardLayoutPreferences = (rawValue: string | null): DashboardLayoutPreferences => {
    const defaults = createDefaultDashboardLayoutPreferences();
    if (!rawValue) return defaults;

    try {
        const parsed = JSON.parse(rawValue);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults;

        const density = isDashboardDensity(parsed.density) ? parsed.density : defaults.density;
        const visibleSections = { ...defaults.visibleSections };

        if (
            parsed.visibleSections &&
            typeof parsed.visibleSections === 'object' &&
            !Array.isArray(parsed.visibleSections)
        ) {
            dashboardSectionDefinitions.forEach((section) => {
                const value = parsed.visibleSections[section.id];
                if (typeof value === 'boolean') {
                    visibleSections[section.id] = value;
                }
            });
        }

        return { density, visibleSections };
    } catch {
        return defaults;
    }
};

export const setDashboardDensity = (
    preferences: DashboardLayoutPreferences,
    density: DashboardDensity,
): DashboardLayoutPreferences => ({
    density,
    visibleSections: { ...preferences.visibleSections },
});

export const setDashboardSectionVisibility = (
    preferences: DashboardLayoutPreferences,
    sectionId: DashboardSectionId,
    isVisible: boolean,
): DashboardLayoutPreferences => ({
    density: preferences.density,
    visibleSections: {
        ...preferences.visibleSections,
        [sectionId]: isVisible,
    },
});
