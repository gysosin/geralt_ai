import type { Source } from '@/types';
import { getSourceConfidencePercent } from './source-confidence';

export type SourceCoverageSummary = {
    totalSources: number;
    averageConfidence: number;
    highConfidenceSources: number;
    mediumConfidenceSources: number;
    lowConfidenceSources: number;
    pageBackedSources: number;
    excerptBackedSources: number;
    evidenceBackedSources: number;
};

const hasValues = (value: unknown): value is unknown[] => Array.isArray(value) && value.length > 0;

export const buildSourceCoverageSummary = (sources: Source[]): SourceCoverageSummary => {
    if (sources.length === 0) {
        return {
            totalSources: 0,
            averageConfidence: 0,
            highConfidenceSources: 0,
            mediumConfidenceSources: 0,
            lowConfidenceSources: 0,
            pageBackedSources: 0,
            excerptBackedSources: 0,
            evidenceBackedSources: 0,
        };
    }

    const confidenceScores = sources.map(getSourceConfidencePercent);
    const averageConfidence = Math.round(
        confidenceScores.reduce((total, score) => total + score, 0) / confidenceScores.length,
    );

    const pageBackedSources = sources.filter((source) => hasValues(source.metadata?.page_numbers)).length;
    const excerptBackedSources = sources.filter((source) => hasValues(source.metadata?.chunk_snippets)).length;
    const evidenceBackedSources = sources.filter((source) => (
        hasValues(source.metadata?.page_numbers) || hasValues(source.metadata?.chunk_snippets)
    )).length;

    return {
        totalSources: sources.length,
        averageConfidence,
        highConfidenceSources: confidenceScores.filter((score) => score >= 75).length,
        mediumConfidenceSources: confidenceScores.filter((score) => score >= 50 && score < 75).length,
        lowConfidenceSources: confidenceScores.filter((score) => score < 50).length,
        pageBackedSources,
        excerptBackedSources,
        evidenceBackedSources,
    };
};
