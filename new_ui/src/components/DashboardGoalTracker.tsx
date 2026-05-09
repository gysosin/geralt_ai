import React, { useMemo, useState } from 'react';
import { ArrowRight, Minus, Plus, Target } from 'lucide-react';
import {
    buildDashboardGoals,
    DASHBOARD_GOALS_STORAGE_KEY,
    parseDashboardGoalTargets,
    setDashboardGoalTarget,
    type DashboardGoalId,
    type DashboardGoalTargets,
    type DashboardStatsSnapshot,
} from '@/src/utils/dashboard-goals';

interface DashboardGoalTrackerProps {
    stats: DashboardStatsSnapshot;
    isLoading: boolean;
    onNavigate: (path: string) => void;
}

export const DashboardGoalTracker: React.FC<DashboardGoalTrackerProps> = ({ stats, isLoading, onNavigate }) => {
    const [saveError, setSaveError] = useState<string | null>(null);
    const [targets, setTargets] = useState<DashboardGoalTargets>(() => {
        if (typeof window === 'undefined') return parseDashboardGoalTargets(null);

        try {
            return parseDashboardGoalTargets(window.localStorage.getItem(DASHBOARD_GOALS_STORAGE_KEY));
        } catch {
            return parseDashboardGoalTargets(null);
        }
    });

    const goals = useMemo(() => buildDashboardGoals(stats, targets), [stats, targets]);

    const updateTarget = (goalId: DashboardGoalId, nextTarget: number) => {
        setTargets((current) => {
            const next = setDashboardGoalTarget(current, goalId, nextTarget);

            try {
                window.localStorage.setItem(DASHBOARD_GOALS_STORAGE_KEY, JSON.stringify(next));
                setSaveError(null);
            } catch {
                setSaveError('Goal target could not be saved in this browser.');
            }

            return next;
        });
    };

    return (
        <section className="rounded-3xl border border-white/5 bg-surface/30 p-6 backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-200">
                        <Target size={22} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Workspace goals</h2>
                        <p className="mt-1 text-sm text-gray-400">Track adoption targets against live workspace stats</p>
                        {saveError && <p className="mt-2 text-xs text-amber-300">{saveError}</p>}
                    </div>
                </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-4">
                {goals.map((goal) => (
                    <div key={goal.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-semibold text-white">{goal.title}</h3>
                                <p className="mt-1 min-h-9 text-xs leading-relaxed text-gray-500">{goal.description}</p>
                            </div>
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-200">
                                {goal.percentage}%
                            </span>
                        </div>

                        <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                                className="h-full rounded-full bg-emerald-400 transition-all"
                                style={{ width: `${goal.percentage}%` }}
                            />
                        </div>

                        <div className="flex items-center justify-between gap-3">
                            {isLoading ? (
                                <div className="h-7 w-20 animate-pulse rounded-lg bg-white/5" />
                            ) : (
                                <p className="text-sm font-semibold text-white">
                                    {goal.current}/{goal.target} <span className="text-xs font-medium text-gray-500">{goal.unit}</span>
                                </p>
                            )}
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => updateTarget(goal.id, goal.target - 1)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                                    aria-label={`Decrease ${goal.title} target`}
                                >
                                    <Minus size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateTarget(goal.id, goal.target + 1)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                                    aria-label={`Increase ${goal.title} target`}
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => onNavigate(goal.path)}
                            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-emerald-300 transition-colors hover:text-emerald-200"
                        >
                            {goal.actionLabel}
                            <ArrowRight size={12} />
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
};
