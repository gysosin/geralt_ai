import type { Source } from '@/types';
import { getSourceConfidencePercent } from './source-confidence';

const formatPageNumbers = (pageNumbers: unknown): string | null => {
    if (!Array.isArray(pageNumbers) || pageNumbers.length === 0) return null;
    return pageNumbers.length === 1 ? `Page ${pageNumbers[0]}` : `Pages ${pageNumbers.join(', ')}`;
};

export const buildSourceExportSummary = (sources: Source[]): string => {
    if (sources.length === 0) return 'Citation summary\n\nNo sources available.';

    const lines = ['Citation summary', ''];

    sources.forEach((source, index) => {
        const confidence = `${getSourceConfidencePercent(source)}%`;
        const pages = formatPageNumbers(source.metadata?.page_numbers);
        const details = [confidence, pages].filter(Boolean).join(' - ');
        const snippets = Array.isArray(source.metadata?.chunk_snippets)
            ? source.metadata.chunk_snippets.slice(0, 2)
            : [];

        lines.push(`${index + 1}. ${source.title || `Source ${index + 1}`} - ${details}`);
        snippets.forEach((snippet) => {
            lines.push(`   - ${String(snippet)}`);
        });
    });

    return lines.join('\n');
};
