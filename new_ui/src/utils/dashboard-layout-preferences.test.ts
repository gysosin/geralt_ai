import { describe, expect, it } from 'vitest';
import {
    DEFAULT_DASHBOARD_LAYOUT_PREFERENCES,
    parseDashboardLayoutPreferences,
    setDashboardDensity,
    setDashboardSectionVisibility,
} from './dashboard-layout-preferences';

describe('dashboard layout preferences', () => {
    it('parses persisted preferences while ignoring unknown sections', () => {
        const preferences = parseDashboardLayoutPreferences(JSON.stringify({
            density: 'compact',
            visibleSections: {
                health: false,
                analytics: true,
                legacy: false,
            },
        }));

        expect(preferences.density).toBe('compact');
        expect(preferences.visibleSections.health).toBe(false);
        expect(preferences.visibleSections.analytics).toBe(true);
        expect(preferences.visibleSections).not.toHaveProperty('legacy');
    });

    it('falls back to defaults for malformed values', () => {
        expect(parseDashboardLayoutPreferences('not-json')).toEqual(DEFAULT_DASHBOARD_LAYOUT_PREFERENCES);
        expect(parseDashboardLayoutPreferences(JSON.stringify({ density: 'dense' }))).toEqual(
            DEFAULT_DASHBOARD_LAYOUT_PREFERENCES,
        );
    });

    it('updates density and section visibility immutably', () => {
        const compact = setDashboardDensity(DEFAULT_DASHBOARD_LAYOUT_PREFERENCES, 'compact');
        const hiddenTips = setDashboardSectionVisibility(compact, 'tips', false);

        expect(compact).not.toBe(DEFAULT_DASHBOARD_LAYOUT_PREFERENCES);
        expect(compact.density).toBe('compact');
        expect(hiddenTips.visibleSections.tips).toBe(false);
        expect(DEFAULT_DASHBOARD_LAYOUT_PREFERENCES.visibleSections.tips).toBe(true);
    });
});
