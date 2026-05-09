import { describe, expect, it } from 'vitest';
import { buildWorkspaceHealthChecks, getWorkspaceHealthSummary } from './workspace-health';

describe('workspace health utilities', () => {
    it('maps health and readiness dependencies into ordered checks', () => {
        const checks = buildWorkspaceHealthChecks('healthy', {
            mongodb: { status: 'ok' },
            redis: { status: 'ok' },
            minio: { status: 'ok' },
            elasticsearch: { status: 'ok' },
            milvus: { status: 'ok' },
        });

        expect(checks.map((check) => check.id)).toEqual([
            'api',
            'mongodb',
            'redis',
            'minio',
            'elasticsearch',
            'milvus',
        ]);
        expect(checks.every((check) => check.status === 'ok')).toBe(true);
    });

    it('tracks unavailable and unknown dependencies separately', () => {
        const checks = buildWorkspaceHealthChecks('healthy', {
            mongodb: { status: 'ok' },
            redis: { status: 'unavailable', error_type: 'ConnectionError' },
        });

        expect(checks.find((check) => check.id === 'redis')?.errorType).toBe('ConnectionError');
        expect(getWorkspaceHealthSummary(checks)).toEqual({
            ok: 2,
            unavailable: 1,
            unknown: 3,
            total: 6,
        });
    });
});
