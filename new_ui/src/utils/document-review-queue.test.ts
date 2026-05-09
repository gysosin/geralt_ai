import { describe, expect, it } from 'vitest';
import { buildDocumentReviewQueue, getDocumentReviewSummary } from './document-review-queue';

describe('document review queue utilities', () => {
    const collections = [
        { id: 'c1', name: 'Contracts', fileCount: 2, size: '1 MB', lastUpdated: 'today', type: 'legal' as const },
    ];

    it('classifies documents by review status and priority', () => {
        const queue = buildDocumentReviewQueue(collections, {
            c1: [
                { document_id: 'ready', original_file_name: 'ready.pdf', status: 'completed', processed: true, is_processing: false, progress: 100 },
                { document_id: 'pending', original_file_name: 'pending.pdf', status: 'pending', processed: false, is_processing: false, progress: 0 },
                { document_id: 'failed', original_file_name: 'failed.pdf', status: 'failed', processed: false, is_processing: false, progress: 0, error_message: 'OCR failed' },
                { document_id: 'processing', original_file_name: 'processing.pdf', status: 'processing', processed: false, is_processing: true, progress: 35 },
            ],
        });

        expect(queue.map((item) => ({ id: item.id, reviewStatus: item.reviewStatus }))).toEqual([
            { id: 'failed', reviewStatus: 'failed' },
            { id: 'pending', reviewStatus: 'needs-review' },
            { id: 'processing', reviewStatus: 'processing' },
            { id: 'ready', reviewStatus: 'ready' },
        ]);
    });

    it('summarizes the queue by status', () => {
        const queue = buildDocumentReviewQueue(collections, {
            c1: [
                { document_id: 'pending', original_file_name: 'pending.pdf', status: 'pending', processed: false, is_processing: false, progress: 0 },
                { document_id: 'ready', original_file_name: 'ready.pdf', status: 'completed', processed: true, is_processing: false, progress: 100 },
            ],
        });

        expect(getDocumentReviewSummary(queue)).toEqual({
            total: 2,
            needsReview: 1,
            processing: 0,
            failed: 0,
            ready: 1,
        });
    });
});
