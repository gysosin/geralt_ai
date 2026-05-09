import type { Source } from '@/types';
import { getSourceConfidencePercent } from './source-confidence';

export type SourceSortId = 'relevance' | 'title' | 'evidence';

export type SourceSortOption = {
    id: SourceSortId;
    label: string;
};

export const sourceSortOptions: SourceSortOption[] = [
    { id: 'relevance', label: 'Relevance' },
    { id: 'title', label: 'Title' },
    { id: 'evidence', label: 'Evidence' },
];

const hasEvidence = (source: Source) => (
    (Array.isArray(source.metadata?.page_numbers) && source.metadata.page_numbers.length > 0)
    || (Array.isArray(source.metadata?.chunk_snippets) && source.metadata.chunk_snippets.length > 0)
);

const getEvidenceRank = (source: Source) => {
    if (Array.isArray(source.metadata?.page_numbers) && source.metadata.page_numbers.length > 0) return 2;
    if (hasEvidence(source)) return 1;
    return 0;
};

export const sortSources = (sources: Source[], sortId: SourceSortId): Source[] => {
    const nextSources = [...sources];

    if (sortId === 'title') {
        return nextSources.sort((first, second) => (
            (first.title || '').localeCompare(second.title || '')
        ));
    }

    if (sortId === 'evidence') {
        return nextSources.sort((first, second) => (
            getEvidenceRank(second) - getEvidenceRank(first)
            || getSourceConfidencePercent(second) - getSourceConfidencePercent(first)
            || (first.title || '').localeCompare(second.title || '')
        ));
    }

    return nextSources.sort((first, second) => (
        getSourceConfidencePercent(second) - getSourceConfidencePercent(first)
        || (first.title || '').localeCompare(second.title || '')
    ));
};
