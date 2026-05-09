export type DependencyStatus = 'ok' | 'unavailable' | 'unknown';

export type ReadinessCheck = {
    status?: string;
    error_type?: string;
};

export type WorkspaceHealthCheck = {
    id: string;
    label: string;
    description: string;
    status: DependencyStatus;
    errorType?: string;
};

const DEPENDENCIES = [
    { id: 'api', label: 'API', description: 'FastAPI gateway' },
    { id: 'mongodb', label: 'MongoDB', description: 'Primary document store' },
    { id: 'redis', label: 'Redis', description: 'Cache and task broker' },
    { id: 'minio', label: 'MinIO', description: 'Object storage' },
    { id: 'elasticsearch', label: 'Search', description: 'Keyword retrieval' },
    { id: 'milvus', label: 'Vector DB', description: 'Embedding retrieval' },
] as const;

const normalizeStatus = (status?: string): DependencyStatus => {
    if (status === 'healthy' || status === 'ok') return 'ok';
    if (status === 'unavailable' || status === 'not_ready') return 'unavailable';
    return 'unknown';
};

export const buildWorkspaceHealthChecks = (
    apiStatus?: string,
    readinessChecks: Record<string, ReadinessCheck> = {},
): WorkspaceHealthCheck[] => DEPENDENCIES.map((dependency) => {
    if (dependency.id === 'api') {
        return {
            ...dependency,
            status: normalizeStatus(apiStatus),
        };
    }

    const check = readinessChecks[dependency.id];
    return {
        ...dependency,
        status: normalizeStatus(check?.status),
        errorType: check?.error_type,
    };
});

export const getWorkspaceHealthSummary = (checks: WorkspaceHealthCheck[]) => {
    const unavailable = checks.filter((check) => check.status === 'unavailable').length;
    const unknown = checks.filter((check) => check.status === 'unknown').length;
    const ok = checks.length - unavailable - unknown;

    return { ok, unavailable, unknown, total: checks.length };
};
