import api from './api';
import {
    buildWorkspaceHealthChecks,
    getWorkspaceHealthSummary,
    type ReadinessCheck,
    type WorkspaceHealthCheck,
} from '@/src/utils/workspace-health';

type HealthResponse = {
    status?: string;
    version?: string;
};

type ReadyResponse = {
    status?: string;
    version?: string;
    checks?: Record<string, ReadinessCheck>;
};

export type WorkspaceHealthSnapshot = {
    status: 'ready' | 'degraded' | 'unknown';
    version?: string;
    checkedAt: string;
    responseTimeMs: number;
    checks: WorkspaceHealthCheck[];
    summary: ReturnType<typeof getWorkspaceHealthSummary>;
};

const getResponseData = <T>(error: unknown): T | null => {
    if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = (error as { response?: { data?: T } }).response;
        return response?.data || null;
    }

    return null;
};

export const healthService = {
    async getWorkspaceHealth(): Promise<WorkspaceHealthSnapshot> {
        const startedAt = performance.now();
        let health: HealthResponse | null = null;
        let readiness: ReadyResponse | null = null;

        try {
            const response = await api.get<HealthResponse>('/health');
            health = response.data;
        } catch (error) {
            health = getResponseData<HealthResponse>(error);
        }

        try {
            const response = await api.get<ReadyResponse>('/ready');
            readiness = response.data;
        } catch (error) {
            readiness = getResponseData<ReadyResponse>(error);
        }

        const checks = buildWorkspaceHealthChecks(health?.status, readiness?.checks || {});
        const summary = getWorkspaceHealthSummary(checks);
        const status = health?.status === 'healthy' && readiness?.status === 'ready'
            ? 'ready'
            : summary.unavailable > 0
                ? 'degraded'
                : 'unknown';

        return {
            status,
            version: health?.version || readiness?.version,
            checkedAt: new Date().toISOString(),
            responseTimeMs: Math.max(1, Math.round(performance.now() - startedAt)),
            checks,
            summary,
        };
    },
};
