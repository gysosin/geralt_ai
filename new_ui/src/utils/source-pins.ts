import type { Source } from '@/types';

export const getSourcePinId = (source: Source, index: number): string => {
    if (source.id) return source.id;

    const documentId = source.metadata?.document_id;
    if (typeof documentId === 'string' && documentId.trim()) return documentId;

    if (source.title) return source.title;

    return `source-${index + 1}`;
};

export const togglePinnedSourceId = (pinnedSourceIds: string[], sourceId: string): string[] => {
    if (pinnedSourceIds.includes(sourceId)) {
        return pinnedSourceIds.filter((pinnedSourceId) => pinnedSourceId !== sourceId);
    }

    return [...pinnedSourceIds, sourceId];
};

export const getPinnedSources = (sources: Source[], pinnedSourceIds: string[]): Source[] => {
    const sourceById = new Map(
        sources.map((source, index) => [getSourcePinId(source, index), source]),
    );

    return pinnedSourceIds
        .map((sourceId) => sourceById.get(sourceId))
        .filter((source): source is Source => Boolean(source));
};
