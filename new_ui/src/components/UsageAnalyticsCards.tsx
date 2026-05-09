import React, { useMemo } from 'react';
import { Activity, BadgeDollarSign, BrainCircuit, Gauge, TrendingUp } from 'lucide-react';
import type { AnalyticsDashboard } from '@/types';
import { buildUsageAnalyticsCards } from '@/src/utils/usage-analytics';

interface UsageAnalyticsCardsProps {
    analytics: AnalyticsDashboard | null;
    isLoading: boolean;
}

const icons = {
    tokens: BrainCircuit,
    requests: Activity,
    cost: BadgeDollarSign,
    models: Gauge,
};

export const UsageAnalyticsCards: React.FC<UsageAnalyticsCardsProps> = ({ analytics, isLoading }) => {
    const cards = useMemo(() => buildUsageAnalyticsCards(analytics), [analytics]);

    return (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => {
                const Icon = icons[card.id as keyof typeof icons] || Activity;

                return (
                    <div
                        key={card.id}
                        className="rounded-3xl border border-white/5 bg-surface/30 p-5 backdrop-blur-xl"
                    >
                        <div className="mb-5 flex items-start justify-between gap-3">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-violet-200">
                                <Icon size={20} />
                            </div>
                            {card.trend && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                                    <TrendingUp size={12} />
                                    {card.trend}
                                </span>
                            )}
                        </div>
                        <p className="text-sm font-medium text-gray-400">{card.label}</p>
                        {isLoading ? (
                            <div className="mt-2 h-9 w-24 animate-pulse rounded-lg bg-white/10" />
                        ) : (
                            <p className="mt-1 text-3xl font-bold tracking-tight text-white">{card.value}</p>
                        )}
                        <p className="mt-2 truncate text-xs text-gray-500">{card.detail}</p>
                    </div>
                );
            })}
        </section>
    );
};
