import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileSearch, Files, Loader2, PlayCircle, RefreshCw } from 'lucide-react';
import { collectionService, documentService } from '../services';
import { useAuthStore } from '../store/auth.store';
import {
    buildDocumentReviewQueue,
    getDocumentReviewSummary,
    type DocumentReviewStatus,
} from '../utils/document-review-queue';
import type { Collection } from '@/types';

const filters: Array<{ id: 'all' | DocumentReviewStatus; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'failed', label: 'Failed' },
    { id: 'needs-review', label: 'Needs review' },
    { id: 'processing', label: 'Processing' },
    { id: 'ready', label: 'Ready' },
];

const statusTone: Record<DocumentReviewStatus, string> = {
    failed: 'border-red-400/30 bg-red-400/10 text-red-200',
    'needs-review': 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    processing: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
    ready: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
};

const DocumentReviewQueue: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const tenantId = user?.tenant_id || 'default';
    const [collections, setCollections] = useState<Collection[]>([]);
    const [documentsByCollection, setDocumentsByCollection] = useState<Record<string, any[]>>({});
    const [activeFilter, setActiveFilter] = useState<'all' | DocumentReviewStatus>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadQueue = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const nextCollections = await collectionService.getAllCollections(tenantId);
            const documentPairs = await Promise.all(
                nextCollections.map(async (collection) => [
                    collection.id,
                    await collectionService.getDocuments(collection.id),
                ] as const),
            );
            setCollections(nextCollections);
            setDocumentsByCollection(Object.fromEntries(documentPairs));
        } catch {
            setError('Unable to load document review queue.');
        } finally {
            setIsLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        loadQueue();
    }, [loadQueue]);

    const queue = useMemo(
        () => buildDocumentReviewQueue(collections, documentsByCollection),
        [collections, documentsByCollection],
    );
    const summary = useMemo(() => getDocumentReviewSummary(queue), [queue]);
    const visibleQueue = useMemo(
        () => queue.filter((item) => activeFilter === 'all' || item.reviewStatus === activeFilter),
        [activeFilter, queue],
    );

    const processDocument = async (documentId: string) => {
        await documentService.processDocument(documentId);
        await loadQueue();
    };

    return (
        <div className="mx-auto max-w-[1300px] space-y-6 pb-10">
            <section className="rounded-3xl border border-white/5 bg-surface/30 p-6 backdrop-blur-xl">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-300">
                            <FileSearch size={16} />
                            Document Operations
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Document review queue</h1>
                        <p className="mt-2 max-w-2xl text-sm text-gray-400">
                            Review failed, pending, processing, and ready documents across all knowledge collections.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={loadQueue}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-semibold text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                        Refresh queue
                    </button>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
                    {[
                        ['Total', summary.total],
                        ['Needs review', summary.needsReview],
                        ['Processing', summary.processing],
                        ['Failed', summary.failed],
                        ['Ready', summary.ready],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                            <p className="text-xs font-medium text-gray-500">{label}</p>
                            <p className="mt-2 text-2xl font-bold text-white">{value}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                    {filters.map((filter) => {
                        const isActive = activeFilter === filter.id;
                        return (
                            <button
                                key={filter.id}
                                type="button"
                                onClick={() => setActiveFilter(filter.id)}
                                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${isActive
                                    ? 'border-amber-400/30 bg-amber-400/10 text-white'
                                    : 'border-white/10 bg-white/[0.03] text-gray-400 hover:text-white'
                                    }`}
                                aria-pressed={isActive}
                            >
                                {filter.label}
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="rounded-3xl border border-white/5 bg-surface/30 p-6 backdrop-blur-xl">
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <AlertTriangle className="mb-3 h-10 w-10 text-amber-300" />
                        <p className="text-sm font-medium text-gray-300">{error}</p>
                    </div>
                ) : visibleQueue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Files className="mb-3 h-10 w-10 text-gray-600" />
                        <p className="text-sm font-medium text-gray-400">No documents in this review view</p>
                        <button
                            type="button"
                            onClick={() => navigate('/collections')}
                            className="mt-4 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                        >
                            Open knowledge
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {visibleQueue.map((item) => (
                            <div key={`${item.collectionId}-${item.id}`} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="min-w-0">
                                        <div className="mb-2 flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone[item.reviewStatus]}`}>
                                                {item.reviewStatus.replace('-', ' ')}
                                            </span>
                                            <span className="text-xs text-gray-500">{item.collectionName}</span>
                                        </div>
                                        <h2 className="truncate text-sm font-semibold text-white">{item.fileName}</h2>
                                        {item.errorMessage && <p className="mt-1 text-xs text-red-300">{item.errorMessage}</p>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-24">
                                            <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                                <div className="h-full rounded-full bg-amber-300" style={{ width: `${item.progress}%` }} />
                                            </div>
                                        </div>
                                        {item.reviewStatus === 'needs-review' && (
                                            <button
                                                type="button"
                                                onClick={() => processDocument(item.id)}
                                                className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                                            >
                                                <PlayCircle size={14} />
                                                Process
                                            </button>
                                        )}
                                        {item.reviewStatus === 'ready' && <CheckCircle2 className="h-5 w-5 text-emerald-300" />}
                                        <button
                                            type="button"
                                            onClick={() => navigate(item.path)}
                                            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                                        >
                                            Open collection
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default DocumentReviewQueue;
