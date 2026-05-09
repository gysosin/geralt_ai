import type { Collection } from '../../types';

export type ChatAttachmentOption = {
    id: string;
    label: string;
    description?: string;
    documentCount: number;
    type: string;
};

export const buildChatAttachmentOptions = (collections: Collection[]): ChatAttachmentOption[] =>
    collections
        .filter((collection) => Boolean(collection.id))
        .map((collection) => ({
            id: collection.id,
            label: collection.name || collection.collection_name || 'Untitled collection',
            description: collection.description,
            documentCount: collection.fileCount || collection.file_count || collection.document_count || 0,
            type: collection.type || 'general',
        }));

export const getSelectedAttachmentLabel = (
    options: ChatAttachmentOption[],
    selectedCollectionId: string | null,
): string => {
    if (!selectedCollectionId) return 'All collections';
    return options.find((option) => option.id === selectedCollectionId)?.label || 'All collections';
};
