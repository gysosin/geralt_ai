import React from 'react';
import { Eye, EyeOff, LayoutDashboard, Minimize2, RotateCcw } from 'lucide-react';
import {
    createDefaultDashboardLayoutPreferences,
    dashboardSectionDefinitions,
    type DashboardDensity,
    type DashboardLayoutPreferences,
    setDashboardDensity,
    setDashboardSectionVisibility,
} from '@/src/utils/dashboard-layout-preferences';

interface DashboardLayoutControlsProps {
    preferences: DashboardLayoutPreferences;
    saveError: string | null;
    onChange: (preferences: DashboardLayoutPreferences) => void;
}

export const DashboardLayoutControls: React.FC<DashboardLayoutControlsProps> = ({
    preferences,
    saveError,
    onChange,
}) => {
    const updateDensity = (density: DashboardDensity) => {
        onChange(setDashboardDensity(preferences, density));
    };

    return (
        <section className="rounded-3xl border border-white/5 bg-surface/30 p-5 backdrop-blur-xl">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-cyan-200">
                        <LayoutDashboard size={22} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-white">Dashboard layout</h2>
                        <p className="mt-1 text-sm text-gray-400">Saved display controls for this browser</p>
                        {saveError && <p className="mt-2 text-xs text-amber-300">{saveError}</p>}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-2xl border border-white/10 bg-black/20 p-1" aria-label="Dashboard density">
                        {(['comfortable', 'compact'] as const).map((density) => {
                            const isActive = preferences.density === density;
                            return (
                                <button
                                    key={density}
                                    type="button"
                                    onClick={() => updateDensity(density)}
                                    className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold capitalize transition-colors ${isActive
                                        ? 'bg-cyan-400 text-black'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                        }`}
                                    aria-pressed={isActive}
                                >
                                    <Minimize2 size={14} />
                                    {density}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        type="button"
                        onClick={() => onChange(createDefaultDashboardLayoutPreferences())}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                    >
                        <RotateCcw size={14} />
                        Reset
                    </button>
                </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
                {dashboardSectionDefinitions.map((section) => {
                    const isVisible = preferences.visibleSections[section.id];
                    const Icon = isVisible ? Eye : EyeOff;

                    return (
                        <button
                            key={section.id}
                            type="button"
                            onClick={() => onChange(setDashboardSectionVisibility(preferences, section.id, !isVisible))}
                            className={`flex min-h-12 items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${isVisible
                                ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'
                                : 'border-white/10 bg-white/[0.03] text-gray-500 hover:text-gray-300'
                                }`}
                            aria-label={`${isVisible ? 'Hide' : 'Show'} ${section.label} section`}
                            aria-pressed={isVisible}
                        >
                            <span className="leading-tight">{section.label}</span>
                            <Icon size={14} className="shrink-0" />
                        </button>
                    );
                })}
            </div>
        </section>
    );
};
