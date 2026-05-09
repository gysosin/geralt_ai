import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, GitCompareArrows, Loader2, MessageSquare, RefreshCw, Star, Zap } from 'lucide-react';
import { botService, collectionService } from '../services';
import { useAuthStore } from '../store/auth.store';
import {
    buildAgentComparisonRows,
    filterAgentComparisonRows,
    getAgentComparisonSummary,
    sortAgentComparisonRows,
    type AgentComparisonFilter,
    type AgentComparisonSortKey,
    type AgentComparisonStatus,
} from '../utils/agent-comparison';

const filters: Array<{ id: AgentComparisonFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'ready', label: 'Ready' },
    { id: 'training', label: 'Training' },
    { id: 'needs-knowledge', label: 'Needs knowledge' },
    { id: 'draft', label: 'Draft' },
];

const sortOptions: Array<{ id: AgentComparisonSortKey; label: string }> = [
    { id: 'readiness', label: 'Readiness' },
    { id: 'collections', label: 'Knowledge' },
    { id: 'chats', label: 'Chats' },
    { id: 'rating', label: 'Rating' },
    { id: 'name', label: 'Name' },
];

const statusTone: Record<AgentComparisonStatus, string> = {
    ready: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    training: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
    'needs-knowledge': 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    draft: 'border-zinc-400/30 bg-zinc-400/10 text-zinc-200',
};

const AgentComparison: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const tenantId = user?.tenant_id || 'default';
    const [activeFilter, setActiveFilter] = useState<AgentComparisonFilter>('all');
    const [sortKey, setSortKey] = useState<AgentComparisonSortKey>('readiness');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState(() => buildAgentComparisonRows([]));

    const loadComparison = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [bots, collections] = await Promise.all([
                botService.getAllBots(tenantId),
                collectionService.getAllCollections(tenantId),
            ]);
            setRows(buildAgentComparisonRows(bots, collections));
        } catch {
            setError('Unable to load agent comparison data.');
        } finally {
            setIsLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        loadComparison();
    }, [loadComparison]);

    const summary = useMemo(() => getAgentComparisonSummary(rows), [rows]);
    const visibleRows = useMemo(
        () => sortAgentComparisonRows(filterAgentComparisonRows(rows, activeFilter), sortKey),
        [activeFilter, rows, sortKey],
    );

    return (
        <div className="mx-auto max-w-[1240px] space-y-6 pb-10">
            <section className="rounded-3xl border border-white/5 bg-surface/30 p-6 backdrop-blur-xl">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fuchsia-300">
                            <GitCompareArrows size={16} />
                            Agent Operations
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Agent comparison</h1>
                        <p className="mt-2 max-w-2xl text-sm text-gray-400">
                            Compare production readiness, knowledge coverage, engagement, and quality signals across every agent.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={loadComparison}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-semibold text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                        Refresh agents
                    </button>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                        ['Agents', summary.total],
                        ['Ready', summary.ready],
                        ['Need knowledge', summary.needsKnowledge],
                        ['Avg readiness', `${summary.averageReadiness}%`],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                            <p className="text-xs font-medium text-gray-500">{label}</p>
                            <p className="mt-2 text-2xl font-bold text-white">{value}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_auto]">
                    <div className="flex flex-wrap gap-2">
                        {filters.map((filter) => (
                            <button
                                key={filter.id}
                                type="button"
                                onClick={() => setActiveFilter(filter.id)}
                                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${activeFilter === filter.id
                                    ? 'border-fuchsia-400/30 bg-fuchsia-400/10 text-white'
                                    : 'border-white/10 bg-white/[0.03] text-gray-400 hover:text-white'
                                    }`}
                                aria-pressed={activeFilter === filter.id}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Sort</span>
                        {sortOptions.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => setSortKey(option.id)}
                                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${sortKey === option.id
                                    ? 'border-white/20 bg-white/10 text-white'
                                    : 'border-white/10 bg-white/[0.03] text-gray-400 hover:text-white'
                                    }`}
                                aria-pressed={sortKey === option.id}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="rounded-3xl border border-white/5 bg-surface/30 p-6 backdrop-blur-xl">
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                    </div>
                ) : error ? (
                    <div className="py-16 text-center text-sm text-amber-300">{error}</div>
                ) : rows.length === 0 ? (
                    <div className="py-16 text-center">
                        <Bot className="mx-auto h-10 w-10 text-gray-600" />
                        <h2 className="mt-4 text-lg font-semibold text-white">No agents to compare</h2>
                        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                            Create an agent, connect knowledge, and return here to compare production readiness.
                        </p>
                        <button
                            type="button"
                            onClick={() => navigate('/bots')}
                            className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-200"
                        >
                            Create agent
                        </button>
                    </div>
                ) : visibleRows.length === 0 ? (
                    <div className="py-16 text-center text-sm text-gray-500">No agents match this comparison view.</div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {visibleRows.map((row) => (
                            <article
                                key={row.id}
                                className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition-colors hover:border-fuchsia-400/20 hover:bg-white/[0.06]"
                            >
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                            <img
                                                src={row.icon}
                                                alt=""
                                                className="h-12 w-12 rounded-xl border border-white/10 object-cover"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone[row.status]}`}>
                                                        {row.statusLabel}
                                                    </span>
                                                    <span className="text-xs text-gray-500">{row.readinessScore}% ready</span>
                                                </div>
                                                <h2 className="mt-2 truncate text-base font-semibold text-white">{row.name}</h2>
                                                <p className="mt-1 line-clamp-2 text-sm text-gray-500">{row.description}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 sm:min-w-[340px]">
                                        <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                                            <Zap className="mb-2 h-4 w-4 text-amber-300" />
                                            <p className="font-semibold text-white">{row.collectionCount}</p>
                                            <p className="text-gray-600">Knowledge</p>
                                        </div>
                                        <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                                            <MessageSquare className="mb-2 h-4 w-4 text-sky-300" />
                                            <p className="font-semibold text-white">{row.chatCount.toLocaleString()}</p>
                                            <p className="text-gray-600">Chats</p>
                                        </div>
                                        <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                                            <Star className="mb-2 h-4 w-4 text-fuchsia-300" />
                                            <p className="font-semibold text-white">{row.rating.toFixed(1)}</p>
                                            <p className="text-gray-600">Rating</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 sm:min-w-[190px]">
                                        <button
                                            type="button"
                                            onClick={() => navigate(row.detailPath)}
                                            className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-gray-200 transition-colors hover:bg-white/5 hover:text-white"
                                        >
                                            Open agent
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => navigate(row.chatPath)}
                                            className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-200"
                                        >
                                            Start chat
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-3 border-t border-white/5 pt-4 lg:grid-cols-[1fr_1.5fr]">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Knowledge collections</p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {row.collectionNames.length > 0 ? (
                                                row.collectionNames.map((name) => (
                                                    <span key={name} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-gray-300">
                                                        {name}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-xs text-amber-200">
                                                    No knowledge attached
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Recommended next action</p>
                                        <p className="mt-2 text-sm text-gray-400">{row.recommendation}</p>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default AgentComparison;
