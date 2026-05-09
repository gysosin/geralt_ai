import type { Source } from '@/types';

export type SourceConfidenceFilter = 'all' | 'medium' | 'high';

export type SourceConfidenceFilterOption = {
    id: SourceConfidenceFilter;
    label: string;
    minimumPercent: number;
};

export const sourceConfidenceFilters: SourceConfidenceFilterOption[] = [
    { id: 'all', label: 'All', minimumPercent: 0 },
    { id: 'medium', label: '50%+', minimumPercent: 50 },
    { id: 'high', label: '75%+', minimumPercent: 75 },
];

export const getSourceConfidencePercent = (source: Source): number => {
    if (!source.score || source.score < 0) return 0;

    const percent = source.score > 1
        ? Math.round(source.score * 10)
        : Math.round(source.score * 100);

    return Math.min(percent, 100);
};

export const filterSourcesByConfidence = (
    sources: Source[],
    filterId: SourceConfidenceFilter,
): Source[] => {
    const filter = sourceConfidenceFilters.find((item) => item.id === filterId) || sourceConfidenceFilters[0];
    if (filter.id === 'all') return sources;

    return sources.filter((source) => getSourceConfidencePercent(source) >= filter.minimumPercent);
};
