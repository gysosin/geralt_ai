import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Files, History, Loader2, Search, SearchX } from 'lucide-react';
import { botService, collectionService, conversationService } from '../services';
import { useAuthStore } from '../store/auth.store';
import {
    buildGlobalSearchIndex,
    searchGlobalIndex,
    type GlobalSearchFilter,
    type GlobalSearchResult,
} from '../utils/global-search';

const filterOptions: Array<{ id: GlobalSearchFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'conversation', label: 'Chats' },
    { id: 'agent', label: 'Agents' },
    { id: 'collection', label: 'Knowledge' },
];

const resultIcon = (type: GlobalSearchResult['type']) => {
    if (type === 'agent') return Bot;
    if (type === 'collection') return Files;
    return History;
};

const resultTypeLabel = (type: GlobalSearchResult['type']) => {
    if (type === 'agent') return 'Agent';
    if (type === 'collection') return 'Knowledge';
    return 'Chat';
};

const GlobalSearch: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const tenantId = user?.tenant_id || 'default';
    const [query, setQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<GlobalSearchFilter>('all');
    const [index, setIndex] = useState<GlobalSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadSearchIndex = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [conversations, bots, collections] = await Promise.all([
                conversationService.getAllConversations(),
                botService.getAllBots(tenantId),
                collectionService.getAllCollections(tenantId),
            ]);
            setIndex(buildGlobalSearchIndex({ conversations, bots, collections }));
        } catch {
            setError('Unable to load workspace search data.');
        } finally {
            setIsLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        loadSearchIndex();
    }, [loadSearchIndex]);

    const counts = useMemo(() => ({
        all: index.length,
        conversation: index.filter((item) => item.type === 'conversation').length,
        agent: index.filter((item) => item.type === 'agent').length,
        collection: index.filter((item) => item.type === 'collection').length,
    }), [index]);

    const results = useMemo(() => {
        if (query.trim()) return searchGlobalIndex(index, query, activeFilter);
        return index.filter((item) => activeFilter === 'all' || item.type === activeFilter).slice(0, 12);
    }, [activeFilter, index, query]);

    return (
        <div className="mx-auto max-w-[1200px] space-y-6 pb-10">
            <section className="rounded-3xl border border-white/5 bg-surface/30 p-6 backdrop-blur-xl">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-cyan-300">
                            <Search size={16} />
                            Workspace Search
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Search everything</h1>
                        <p className="mt-2 max-w-2xl text-sm text-gray-400">
                            Find chats, agents, and knowledge collections from one page.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={loadSearchIndex}
                        className="h-10 rounded-xl border border-white/10 px-4 text-sm font-semibold text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                    >
                        Refresh index
                    </button>
                </div>

                <div className="relative mt-6">
                    <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search chats, agents, collections..."
                        className="h-14 w-full rounded-2xl border border-white/10 bg-black/20 pl-12 pr-4 text-base text-white outline-none transition-colors placeholder:text-gray-600 focus:border-cyan-400/50"
                    />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                    {filterOptions.map((filter) => {
                        const isActive = activeFilter === filter.id;
                        return (
                            <button
                                key={filter.id}
                                type="button"
                                onClick={() => setActiveFilter(filter.id)}
                                className={`rounded-2xl border px-4 py-3 text-left transition-colors ${isActive
                                    ? 'border-cyan-400/30 bg-cyan-400/10 text-white'
                                    : 'border-white/10 bg-white/[0.03] text-gray-400 hover:text-white'
                                    }`}
                                aria-pressed={isActive}
                            >
                                <span className="block text-sm font-semibold">{filter.label}</span>
                                <span className="mt-1 block text-xs text-gray-500">{counts[filter.id]} items</span>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="rounded-3xl border border-white/5 bg-surface/30 p-6 backdrop-blur-xl">
                <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">
                        {query.trim() ? 'Search results' : 'Recently indexed workspace items'}
                    </h2>
                    <span className="text-xs font-medium text-gray-500">{results.length} shown</span>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <SearchX className="mb-3 h-10 w-10 text-amber-300" />
                        <p className="text-sm font-medium text-gray-300">{error}</p>
                        <button
                            type="button"
                            onClick={loadSearchIndex}
                            className="mt-4 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                        >
                            Retry
                        </button>
                    </div>
                ) : results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <SearchX className="mb-3 h-10 w-10 text-gray-600" />
                        <p className="text-sm font-medium text-gray-400">No matching workspace items</p>
                        <p className="mt-1 text-xs text-gray-600">Try a broader query or switch filters.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {results.map((item) => {
                            const Icon = resultIcon(item.type);
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => navigate(item.path)}
                                    className="group flex items-start gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4 text-left transition-colors hover:border-cyan-400/20 hover:bg-white/[0.06]"
                                >
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-cyan-200">
                                        <Icon size={18} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="mb-1 inline-flex rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                            {resultTypeLabel(item.type)}
                                        </span>
                                        <span className="block truncate text-sm font-semibold text-white group-hover:text-cyan-200">
                                            {item.title}
                                        </span>
                                        <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-gray-500">
                                            {item.description}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
};

export default GlobalSearch;
