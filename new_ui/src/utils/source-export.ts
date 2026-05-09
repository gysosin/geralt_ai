import type { Source } from '@/types';
import { getSourceConfidencePercent } from './source-confidence';
import { getSourcePinId } from './source-pins';
import type { SourceNotes } from './source-notes';

const formatPageNumbers = (pageNumbers: unknown): string | null => {
    if (!Array.isArray(pageNumbers) || pageNumbers.length === 0) return null;
    return pageNumbers.length === 1 ? `Page ${pageNumbers[0]}` : `Pages ${pageNumbers.join(', ')}`;
};

export const buildSourceExportSummary = (sources: Source[], sourceNotes: SourceNotes = {}): string => {
    if (sources.length === 0) return 'Citation summary\n\nNo sources available.';

    const lines = ['Citation summary', ''];

    sources.forEach((source, index) => {
        const confidence = `${getSourceConfidencePercent(source)}%`;
        const pages = formatPageNumbers(source.metadata?.page_numbers);
        const details = [confidence, pages].filter(Boolean).join(' - ');
        const snippets = Array.isArray(source.metadata?.chunk_snippets)
            ? source.metadata.chunk_snippets.slice(0, 2)
            : [];
        const sourceNote = sourceNotes[getSourcePinId(source, index)]?.trim();

        lines.push(`${index + 1}. ${source.title || `Source ${index + 1}`} - ${details}`);
        if (sourceNote) {
            lines.push(`   - Note: ${sourceNote}`);
        }
        snippets.forEach((snippet) => {
            lines.push(`   - ${String(snippet)}`);
        });
    });

    return lines.join('\n');
};

export const buildSingleSourceExportSummary = (
    source: Source,
    sourceNotes: SourceNotes = {},
): string => buildSourceExportSummary([source], sourceNotes);
