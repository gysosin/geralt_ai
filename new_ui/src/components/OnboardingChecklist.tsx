import React, { useMemo, useState } from 'react';
import { Check, Circle, ExternalLink, Rocket } from 'lucide-react';
import {
    getChecklistProgress,
    ONBOARDING_CHECKLIST_STORAGE_KEY,
    onboardingChecklistItems,
    parseChecklistState,
} from '@/src/utils/onboarding-checklist';

interface OnboardingChecklistProps {
    onNavigate: (path: string) => void;
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ onNavigate }) => {
    const [completed, setCompleted] = useState<Record<string, boolean>>(() =>
        parseChecklistState(window.localStorage.getItem(ONBOARDING_CHECKLIST_STORAGE_KEY)),
    );

    const progress = useMemo(() => getChecklistProgress(onboardingChecklistItems, completed), [completed]);

    const toggleItem = (id: string) => {
        setCompleted((current) => {
            const next = { ...current, [id]: !current[id] };
            window.localStorage.setItem(ONBOARDING_CHECKLIST_STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };

    return (
        <section className="rounded-3xl border border-white/5 bg-surface/30 p-6 backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-3 text-violet-200">
                        <Rocket size={22} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Quick-start checklist</h2>
                        <p className="mt-1 text-sm text-gray-400">
                            {progress.completedCount}/{progress.total} setup steps complete
                        </p>
                    </div>
                </div>
                <div className="min-w-[180px]">
                    <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                        <span>Progress</span>
                        <span>{progress.percentage}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                            className="h-full rounded-full bg-violet-400 transition-all"
                            style={{ width: `${progress.percentage}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-5">
                {onboardingChecklistItems.map((item) => {
                    const isCompleted = Boolean(completed[item.id]);

                    return (
                        <div key={item.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                            <button
                                type="button"
                                onClick={() => toggleItem(item.id)}
                                className="mb-3 flex items-center gap-2 text-left"
                                aria-label={`${isCompleted ? 'Mark incomplete' : 'Mark complete'}: ${item.label}`}
                                aria-pressed={isCompleted}
                            >
                                <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${isCompleted ? 'border-emerald-400 bg-emerald-400 text-black' : 'border-white/15 text-gray-500'}`}>
                                    {isCompleted ? <Check size={14} /> : <Circle size={14} />}
                                </span>
                                <span className="text-sm font-semibold text-white">{item.label}</span>
                            </button>
                            <p className="min-h-[40px] text-xs leading-relaxed text-gray-500">{item.description}</p>
                            <button
                                type="button"
                                onClick={() => onNavigate(item.path)}
                                className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-violet-300 transition-colors hover:text-violet-200"
                            >
                                {item.actionLabel}
                                <ExternalLink size={12} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};
