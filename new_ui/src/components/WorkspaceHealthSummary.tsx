import React from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Database, HardDrive, RefreshCw, Search, Server, Waypoints } from 'lucide-react';
import type { WorkspaceHealthSnapshot } from '@/src/services/health.service';
import type { DependencyStatus, WorkspaceHealthCheck } from '@/src/utils/workspace-health';

interface WorkspaceHealthSummaryProps {
    snapshot: WorkspaceHealthSnapshot | null;
    isLoading: boolean;
    error: string | null;
    onRefresh: () => void;
}

const icons = {
    api: Server,
    mongodb: Database,
    redis: Clock3,
    minio: HardDrive,
    elasticsearch: Search,
    milvus: Waypoints,
};

const statusStyles: Record<DependencyStatus, string> = {
    ok: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    unavailable: 'border-red-500/20 bg-red-500/10 text-red-300',
    unknown: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
};

const statusText: Record<DependencyStatus, string> = {
    ok: 'Healthy',
    unavailable: 'Down',
    unknown: 'Unknown',
};

const HealthCheckPill: React.FC<{ check: WorkspaceHealthCheck }> = ({ check }) => {
    const Icon = icons[check.id as keyof typeof icons] || Server;

    return (
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-gray-300">
                        <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{check.label}</p>
                        <p className="mt-0.5 truncate text-xs text-gray-500">{check.description}</p>
                    </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusStyles[check.status]}`}>
                    {statusText[check.status]}
                </span>
            </div>
            {check.errorType && (
                <p className="mt-3 truncate text-xs text-red-300/80">{check.errorType}</p>
            )}
        </div>
    );
};

export const WorkspaceHealthSummary: React.FC<WorkspaceHealthSummaryProps> = ({
    snapshot,
    isLoading,
    error,
    onRefresh,
}) => {
    const isReady = snapshot?.status === 'ready';
    const StatusIcon = error || snapshot?.status === 'degraded' ? AlertTriangle : CheckCircle2;

    return (
        <section className="rounded-3xl border border-white/5 bg-surface/30 p-5 backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                    <div className={`rounded-2xl border p-3 ${isReady ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300'}`}>
                        <StatusIcon size={22} />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-bold text-white">Workspace health</h2>
                            {snapshot?.version && (
                                <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                    v{snapshot.version}
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-sm text-gray-400">
                            {error
                                ? error
                                : snapshot
                                    ? `${snapshot.summary.ok}/${snapshot.summary.total} systems healthy, checked in ${snapshot.responseTimeMs}ms`
                                    : 'Checking API, storage, search, and vector dependencies.'}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onRefresh}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    Check now
                </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                {isLoading && !snapshot
                    ? Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="h-[90px] rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                            <div className="h-5 w-24 animate-pulse rounded bg-white/10" />
                            <div className="mt-3 h-3 w-32 animate-pulse rounded bg-white/5" />
                        </div>
                    ))
                    : snapshot?.checks.map((check) => (
                        <HealthCheckPill key={check.id} check={check} />
                    ))}
            </div>
        </section>
    );
};
