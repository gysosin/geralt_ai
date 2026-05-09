import type { AnalyticsDashboard } from '@/types';

export type UsageAnalyticsCard = {
    id: string;
    label: string;
    value: string;
    detail: string;
    trend?: string;
};

const formatCompactNumber = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return `${value}`;
};

const formatCurrency = (value: number): string => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1 ? 2 : 4,
}).format(value);

const calculateTokenTrend = (dailyUsage: AnalyticsDashboard['daily_usage']): string | undefined => {
    if (dailyUsage.length < 2) return undefined;

    const latest = dailyUsage[dailyUsage.length - 1]?.tokens || 0;
    const previous = dailyUsage[dailyUsage.length - 2]?.tokens || 0;
    if (previous === 0) return latest > 0 ? 'New activity' : undefined;

    const change = Math.round(((latest - previous) / previous) * 100);
    if (change === 0) return 'No change';
    return `${change > 0 ? '+' : ''}${change}% vs prior day`;
};

export const buildUsageAnalyticsCards = (analytics: AnalyticsDashboard | null): UsageAnalyticsCard[] => {
    const summary = analytics?.summary;
    const dailyUsage = analytics?.daily_usage || [];
    const topModels = analytics?.top_models || [];
    const topModel = topModels[0];

    return [
        {
            id: 'tokens',
            label: 'Total tokens',
            value: formatCompactNumber(summary?.total_tokens || 0),
            detail: `${formatCompactNumber(summary?.total_input_tokens || 0)} input / ${formatCompactNumber(summary?.total_output_tokens || 0)} output`,
            trend: calculateTokenTrend(dailyUsage),
        },
        {
            id: 'requests',
            label: 'AI requests',
            value: formatCompactNumber(summary?.total_requests || 0),
            detail: summary?.period ? `Period: ${summary.period}` : 'No usage period yet',
        },
        {
            id: 'cost',
            label: 'Estimated cost',
            value: formatCurrency(summary?.total_cost || 0),
            detail: 'Based on recorded model usage',
        },
        {
            id: 'models',
            label: 'Active models',
            value: formatCompactNumber(topModels.length),
            detail: topModel ? `${topModel.model} leads with ${topModel.percentage}%` : 'No model usage recorded',
        },
    ];
};
