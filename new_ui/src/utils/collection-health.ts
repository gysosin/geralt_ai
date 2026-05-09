import type { Collection } from '@/types';

export type CollectionHealthStatus = 'healthy' | 'empty' | 'stale';

export type CollectionHealthItem = {
    id: string;
    name: string;
    status: CollectionHealthStatus;
    fileCount: number;
    lastUpdated: string;
    description?: string;
    path: string;
};

export type CollectionHealthSummary = {
    total: number;
    healthy: number;
    empty: number;
    stale: number;
};

const STALE_AFTER_DAYS = 60;

const daysBetween = (left: Date, right: Date) =>
    Math.floor((left.getTime() - right.getTime()) / 86_400_000);

const getCollectionStatus = (collection: Collection, now: Date): CollectionHealthStatus => {
    const fileCount = collection.fileCount || collection.file_count || collection.document_count || 0;
    if (fileCount === 0) return 'empty';

    const updatedAt = new Date(collection.lastUpdated || collection.created_at || '');
    if (!Number.isNaN(updatedAt.getTime()) && daysBetween(now, updatedAt) > STALE_AFTER_DAYS) {
        return 'stale';
    }

    return 'healthy';
};

export const buildCollectionHealthItems = (
    collections: Collection[],
    now = new Date(),
): CollectionHealthItem[] =>
    collections.map((collection) => {
        const fileCount = collection.fileCount || collection.file_count || collection.document_count || 0;

        return {
            id: collection.id,
            name: collection.name || collection.collection_name || 'Untitled collection',
            status: getCollectionStatus(collection, now),
            fileCount,
            lastUpdated: collection.lastUpdated || collection.created_at || 'Unknown',
            description: collection.description,
            path: `/collections/${collection.id}`,
        };
    });

export const getCollectionHealthSummary = (items: CollectionHealthItem[]): CollectionHealthSummary => ({
    total: items.length,
    healthy: items.filter((item) => item.status === 'healthy').length,
    empty: items.filter((item) => item.status === 'empty').length,
    stale: items.filter((item) => item.status === 'stale').length,
});
