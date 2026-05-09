import { describe, expect, it } from 'vitest';
import { buildUsageAnalyticsCards } from './usage-analytics';

describe('buildUsageAnalyticsCards', () => {
    it('formats empty analytics as zero-value usage cards', () => {
        expect(buildUsageAnalyticsCards(null).map((card) => card.value)).toEqual(['0', '0', '$0.00', '0']);
    });

    it('formats token, cost, request, and model metrics from analytics data', () => {
        const cards = buildUsageAnalyticsCards({
            summary: {
                total_tokens: 12500,
                total_input_tokens: 8000,
                total_output_tokens: 4500,
                total_cost: 0.0375,
                total_requests: 42,
                period: 'All Time',
            },
            daily_usage: [
                { date: '2026-05-08', tokens: 1000, requests: 10, cost: 0.003 },
                { date: '2026-05-09', tokens: 1500, requests: 12, cost: 0.0045 },
            ],
            top_users: [],
            top_models: [
                { model: 'mistral-small', total_tokens: 9000, total_requests: 30, percentage: 72, cost: 0.027 },
            ],
        });

        expect(cards.find((card) => card.id === 'tokens')).toMatchObject({
            value: '12.5K',
            detail: '8.0K input / 4.5K output',
            trend: '+50% vs prior day',
        });
        expect(cards.find((card) => card.id === 'cost')?.value).toBe('$0.0375');
        expect(cards.find((card) => card.id === 'models')?.detail).toBe('mistral-small leads with 72%');
    });
});
