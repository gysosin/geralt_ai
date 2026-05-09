import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatabaseZap, Loader2, RefreshCw } from 'lucide-react';
import { collectionService } from '../services';
import { useAuthStore } from '../store/auth.store';
import {
    buildCollectionHealthItems,
    getCollectionHealthSummary,
    type CollectionHealthStatus,
} from '../utils/collection-health';

const filters: Array<{ id: 'all' | CollectionHealthStatus; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'healthy', label: 'Healthy' },
    { id: 'empty', label: 'Empty' },
    { id: 'stale', label: 'Stale' },
];

const statusTone: Record<CollectionHealthStatus, string> = {
    healthy: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    empty: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    stale: 'border-red-400/30 bg-red-400/10 text-red-200',
};

const CollectionHealthDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const tenantId = user?.tenant_id || 'default';
    const [activeFilter, setActiveFilter] = useState<'all' | CollectionHealthStatus>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState(() => buildCollectionHealthItems([]));

    const loadCollections = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const collections = await collectionService.getAllCollections(tenantId);
            setItems(buildCollectionHealthItems(collections));
        } catch {
            setError('Unable to load collection health.');
        } finally {
            setIsLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        loadCollections();
    }, [loadCollections]);

    const summary = useMemo(() => getCollectionHealthSummary(items), [items]);
    const visibleItems = useMemo(
        () => items.filter((item) => activeFilter === 'all' || item.status === activeFilter),
        [activeFilter, items],
    );

    return (
        <div className="mx-auto max-w-[1200px] space-y-6 pb-10">
            <section className="rounded-3xl border border-white/5 bg-surface/30 p-6 backdrop-blur-xl">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-300">
                            <DatabaseZap size={16} />
                            Knowledge Operations
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Collection health</h1>
                        <p className="mt-2 max-w-2xl text-sm text-gray-400">
                            Find empty, stale, and healthy knowledge collections before they affect retrieval quality.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={loadCollections}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-semibold text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                        Refresh health
                    </button>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                        ['Total', summary.total],
                        ['Healthy', summary.healthy],
                        ['Empty', summary.empty],
                        ['Stale', summary.stale],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                            <p className="text-xs font-medium text-gray-500">{label}</p>
                            <p className="mt-2 text-2xl font-bold text-white">{value}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                    {filters.map((filter) => (
                        <button
                            key={filter.id}
                            type="button"
                            onClick={() => setActiveFilter(filter.id)}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${activeFilter === filter.id
                                ? 'border-emerald-400/30 bg-emerald-400/10 text-white'
                                : 'border-white/10 bg-white/[0.03] text-gray-400 hover:text-white'
                                }`}
                            aria-pressed={activeFilter === filter.id}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
            </section>

            <section className="rounded-3xl border border-white/5 bg-surface/30 p-6 backdrop-blur-xl">
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                    </div>
                ) : error ? (
                    <div className="py-16 text-center text-sm text-amber-300">{error}</div>
                ) : visibleItems.length === 0 ? (
                    <div className="py-16 text-center text-sm text-gray-500">No collections in this health view.</div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {visibleItems.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => navigate(item.path)}
                                className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 text-left transition-colors hover:border-emerald-400/20 hover:bg-white/[0.06]"
                            >
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="min-w-0">
                                        <div className="mb-2 flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone[item.status]}`}>
                                                {item.status}
                                            </span>
                                            <span className="text-xs text-gray-500">{item.fileCount} files</span>
                                        </div>
                                        <h2 className="truncate text-sm font-semibold text-white">{item.name}</h2>
                                        <p className="mt-1 text-xs text-gray-500">{item.description || `Last updated ${item.lastUpdated}`}</p>
                                    </div>
                                    <span className="text-xs font-semibold text-emerald-300">Open collection</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default CollectionHealthDashboard;
