import { describe, expect, it } from 'vitest';
import { getChecklistProgress, onboardingChecklistItems, parseChecklistState } from './onboarding-checklist';

describe('onboarding checklist utilities', () => {
    it('parses persisted checklist state defensively', () => {
        expect(parseChecklistState(null)).toEqual({});
        expect(parseChecklistState('not-json')).toEqual({});
        expect(parseChecklistState('{"create-agent":true,"bad":"yes"}')).toEqual({
            'create-agent': true,
        });
    });

    it('calculates checklist progress from completed items', () => {
        expect(getChecklistProgress(onboardingChecklistItems, {
            'create-agent': true,
            'ask-question': true,
        })).toEqual({
            completedCount: 2,
            total: 5,
            percentage: 40,
        });
    });
});
