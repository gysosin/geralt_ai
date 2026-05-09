import { describe, expect, it } from 'vitest';
import {
    buildDashboardGoals,
    DEFAULT_DASHBOARD_GOAL_TARGETS,
    parseDashboardGoalTargets,
    setDashboardGoalTarget,
} from './dashboard-goals';

describe('dashboard goals', () => {
    it('builds progress from real dashboard stats and persisted targets', () => {
        const goals = buildDashboardGoals(
            { conversations: 8, bots: 2, collections: 1, documents: 20 },
            { ...DEFAULT_DASHBOARD_GOAL_TARGETS, conversations: 10, documents: 40 },
        );

        expect(goals.map((goal) => ({ id: goal.id, current: goal.current, percentage: goal.percentage }))).toEqual([
            { id: 'agents', current: 2, percentage: 67 },
            { id: 'knowledge', current: 1, percentage: 20 },
            { id: 'conversations', current: 8, percentage: 80 },
            { id: 'documents', current: 20, percentage: 50 },
        ]);
    });

    it('parses saved targets defensively', () => {
        expect(parseDashboardGoalTargets(null)).toEqual(DEFAULT_DASHBOARD_GOAL_TARGETS);
        expect(parseDashboardGoalTargets('not-json')).toEqual(DEFAULT_DASHBOARD_GOAL_TARGETS);
        expect(parseDashboardGoalTargets(JSON.stringify({
            agents: 10,
            knowledge: 'bad',
            conversations: 0,
            documents: 250,
            legacy: 999,
        }))).toEqual({
            ...DEFAULT_DASHBOARD_GOAL_TARGETS,
            agents: 10,
            documents: 250,
        });
    });

    it('updates one target while clamping invalid values', () => {
        const next = setDashboardGoalTarget(DEFAULT_DASHBOARD_GOAL_TARGETS, 'agents', -5);

        expect(next.agents).toBe(1);
        expect(next.knowledge).toBe(DEFAULT_DASHBOARD_GOAL_TARGETS.knowledge);
        expect(DEFAULT_DASHBOARD_GOAL_TARGETS.agents).toBe(3);
    });
});
