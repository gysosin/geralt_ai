import api from './api';
import type {
    Document,
    CollectionDetail,
    DocumentStatusUpdate,
    CollectionShare,
    ShareCollectionCommand,
    UpdateCollectionCommand,
} from '../../types';

export const documentService = {
    /**
     * Get collection details including documents
     */
    async getCollectionDetails(collectionId: string): Promise<CollectionDetail> {
        const response = await api.get<CollectionDetail>(
            `/api/v1/collections/${collectionId}`
        );
        return response.data;
    },

    /**
     * List all documents in a collection
     */
    async listDocuments(
        collectionId: string,
        unprocessedOnly = false,
        addedByOnly = false
    ): Promise<Document[]> {
        const response = await api.post<any>(
            '/api/v1/collections/documents',
            {
                collection_id: collectionId,
                unprocessed_only: unprocessedOnly,
                added_by_only: addedByOnly,
            }
        );
        // Handle both array response and object with documents property
        return Array.isArray(response.data) ? response.data : (response.data.documents || []);
    },

    /**
     * Upload documents to a collection
     */
    async uploadDocuments(
        collectionId: string,
        files: File[],
        onProgress?: (progress: number) => void
    ): Promise<{ message: string }> {
        const formData = new FormData();
        formData.append('collection_id', collectionId);
        files.forEach((file) => {
            formData.append('files', file);
        });

        const response = await api.post<{ message: string }>(
            '/api/v1/collections/upload',
            formData,
            {
                headers: { 'Content-Type': undefined },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total && onProgress) {
                        const progress = Math.round(
                            (progressEvent.loaded * 100) / progressEvent.total
                        );
                        onProgress(progress);
                    }
                },
            }
        );
        return response.data;
    },

    /**
     * Upload URLs (web pages or YouTube) to a collection
     */
    async uploadUrls(
        collectionId: string,
        urls: string[]
    ): Promise<{ message: string }> {
        const formData = new FormData();
        formData.append('collection_id', collectionId);
        urls.forEach((url) => {
            formData.append('urls', url);
        });

        const response = await api.post<{ message: string }>(
            '/api/v1/collections/upload',
            formData,
            { headers: { 'Content-Type': undefined } }
        );
        return response.data;
    },

    /**
     * Process a document (trigger embedding generation)
     */
    async processDocument(documentId: string): Promise<{ message: string }> {
        const response = await api.post<{ message: string }>(
            '/api/v1/collections/process',
            { document_id: documentId }
        );
        return response.data;
    },

    /**
     * Get document processing status
     */
    async getDocumentStatus(documentId: string): Promise<DocumentStatusUpdate> {
        const response = await api.get<DocumentStatusUpdate>(
            `/api/v1/collections/documents/${documentId}/status`
        );
        return response.data;
    },

    /**
     * Delete documents from a collection
     */
    async deleteDocuments(documentIds: string[], collectionId: string): Promise<{ message: string }> {
        const response = await api.delete<{ message: string }>(
            '/api/v1/collections/documents',
            { data: { document_ids: documentIds, collection_id: collectionId } }
        );
        return response.data;
    },

    /**
     * Download a document
     */
    async downloadDocument(documentId: string): Promise<Blob> {
        const response = await api.get(`/api/v1/collections/documents/${documentId}/download`, {
            responseType: 'blob',
        });
        return response.data;
    },

    /**
     * Update collection details
     */
    async updateCollection(
        data: UpdateCollectionCommand
    ): Promise<{ message: string }> {
        const response = await api.put<{ message: string }>(
            '/api/v1/collections/',
            data
        );
        return response.data;
    },

    /**
     * Share collection with a user
     */
    async shareCollection(data: ShareCollectionCommand): Promise<{ message: string }> {
        const response = await api.post<{ message: string }>(
            '/api/v1/collections/share',
            data
        );
        return response.data;
    },

    /**
     * Get shared users for a collection
     */
    async getSharedUsers(collectionId: string): Promise<CollectionShare[]> {
        const response = await api.get<any>(
            `/api/v1/collections/${collectionId}/shared-users`
        );
        // Handle both array response and object with shared_users property
        return Array.isArray(response.data) ? response.data : (response.data.shared_users || []);
    },

    /**
     * Remove shared user access
     */
    async removeSharedUser(
        collectionId: string,
        user: string
    ): Promise<{ message: string }> {
        const response = await api.post<{ message: string }>(
            '/api/v1/collections/remove-shared-user',
            {
                collection_id: collectionId,
                shared_user: user,
            }
        );
        return response.data;
    },
};

export default documentService;
