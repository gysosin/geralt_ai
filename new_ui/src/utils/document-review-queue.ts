import type { Collection } from '@/types';

export type DocumentReviewStatus = 'failed' | 'needs-review' | 'processing' | 'ready';

export type DocumentReviewQueueItem = {
    id: string;
    fileName: string;
    collectionId: string;
    collectionName: string;
    reviewStatus: DocumentReviewStatus;
    progress: number;
    errorMessage?: string;
    uploadedAt?: string;
    path: string;
};

export type DocumentReviewSummary = {
    total: number;
    needsReview: number;
    processing: number;
    failed: number;
    ready: number;
};

const reviewPriority: Record<DocumentReviewStatus, number> = {
    failed: 0,
    'needs-review': 1,
    processing: 2,
    ready: 3,
};

const getReviewStatus = (document: any): DocumentReviewStatus => {
    if (document.status === 'failed' || document.error_message) return 'failed';
    if (document.is_processing || document.status === 'processing') return 'processing';
    if (document.processed || document.status === 'completed') return 'ready';
    return 'needs-review';
};

export const buildDocumentReviewQueue = (
    collections: Collection[],
    documentsByCollection: Record<string, any[]>,
): DocumentReviewQueueItem[] =>
    collections
        .flatMap((collection) =>
            (documentsByCollection[collection.id] || []).map((document) => {
                const id = document.document_id || document.id;
                const fileName = document.original_file_name || document.file_name || document.name || 'Untitled document';
                const reviewStatus = getReviewStatus(document);

                return {
                    id,
                    fileName,
                    collectionId: collection.id,
                    collectionName: collection.name || collection.collection_name || 'Untitled collection',
                    reviewStatus,
                    progress: typeof document.progress === 'number' ? document.progress : reviewStatus === 'ready' ? 100 : 0,
                    errorMessage: document.error_message,
                    uploadedAt: document.upload_time || document.created_at,
                    path: `/collections/${collection.id}`,
                };
            }),
        )
        .sort((left, right) => {
            const priority = reviewPriority[left.reviewStatus] - reviewPriority[right.reviewStatus];
            if (priority !== 0) return priority;
            return left.fileName.localeCompare(right.fileName);
        });

export const getDocumentReviewSummary = (queue: DocumentReviewQueueItem[]): DocumentReviewSummary => ({
    total: queue.length,
    needsReview: queue.filter((item) => item.reviewStatus === 'needs-review').length,
    processing: queue.filter((item) => item.reviewStatus === 'processing').length,
    failed: queue.filter((item) => item.reviewStatus === 'failed').length,
    ready: queue.filter((item) => item.reviewStatus === 'ready').length,
});
