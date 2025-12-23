import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ExternalLink, ChevronDown, ChevronUp, Layers, Eye, X } from 'lucide-react';
import type { Source } from '@/types';
import { HighlightedSnapshot } from './highlighted-snapshot';

interface SourcesListProps {
    sources: Source[];
    className?: string;
}

export function SourcesList({ sources, className = '' }: SourcesListProps) {
    const [isListExpanded, setIsListExpanded] = useState(false);
    const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
    const [mediaPreview, setMediaPreview] = useState<{ type: 'pdf' | 'image'; url: string; title: string; pages?: number[]; bbox?: number[]; bboxes?: number[][]; imageDimensions?: { width: number; height: number } } | null>(null);

    if (!sources || sources.length === 0) {
        return null;
    }

    const displayedSources = isListExpanded ? sources : sources.slice(0, 3);
    const hasMore = sources.length > 3;

    const formatScore = (score: number) => {
        if (!score || score === 0) return null;
        const percentage = score > 1 ? Math.min(Math.round(score * 10), 100) : Math.round(score * 100);
        return `${percentage}%`;
    };

    const formatPageNumbers = (pageNumbers?: number[]) => {
        if (!pageNumbers || pageNumbers.length === 0) return null;
        if (pageNumbers.length === 1) return `Page ${pageNumbers[0]}`;
        if (pageNumbers.length <= 3) return `Pages ${pageNumbers.join(', ')}`;
        return `Pages ${pageNumbers.slice(0, 3).join(', ')}...`;
    };

    const handleViewPdf = (url: string, title: string, pages?: number[], e?: React.MouseEvent) => {
        e?.stopPropagation();
        let pdfUrl = url;
        if (pages && pages.length > 0) {
            pdfUrl = `${url}#page=${pages[0]}`;
        }
        setMediaPreview({ type: 'pdf', url: pdfUrl, title, pages });
    };

    const handleViewImage = (path: string, title: string, bbox?: number[], imageDimensions?: { width: number; height: number }, e?: React.MouseEvent, bboxes?: number[][]) => {
        e?.stopPropagation();
        // Construct API URL if it's a relative path
        const fullUrl = path.startsWith('http') ? path : `/api/v1/files/${path}`;
        setMediaPreview({ type: 'image', url: fullUrl, title, bbox, bboxes, imageDimensions });
    };

    return (
        <>
            <div className={`mt-3 pt-3 border-t border-white/10 ${className}`}>
                {/* Collapsed state */}
                {!isListExpanded ? (
                    <button
                        onClick={() => setIsListExpanded(true)}
                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        <div className="h-6 w-6 rounded bg-violet-500/20 flex items-center justify-center">
                            <FileText className="h-3.5 w-3.5 text-violet-400" />
                        </div>
                        <span className="text-xs">{sources.length} source{sources.length > 1 ? 's' : ''}</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                ) : (
                    <>
                        {/* Header when expanded */}
                        <button
                            onClick={() => setIsListExpanded(false)}
                            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-2"
                        >
                            <FileText className="h-4 w-4" />
                            <span className="font-medium">Sources ({sources.length})</span>
                            <ChevronUp className="h-4 w-4" />
                        </button>

                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-2"
                        >
                            {displayedSources.map((source, index) => {
                                const pageNumbers = source.metadata?.page_numbers as number[] | undefined;
                                const chunkSnippets = source.metadata?.chunk_snippets as string[] | undefined;
                                const chunkDetails = source.metadata?.chunk_details as {
                                    text: string;
                                    page?: number;
                                    page_image?: string;
                                    bbox?: number[];
                                    image_dimensions?: { width: number; height: number };
                                }[] | undefined;
                                const chunkCount = source.metadata?.chunk_count as number | undefined;
                                const sourceUrl = source.metadata?.url as string | undefined;
                                // page_images is now an array with bbox and image_dimensions
                                const pageImages = source.metadata?.page_images as {
                                    page: number;
                                    path: string;
                                    bbox?: number[];
                                    image_dimensions?: { width: number; height: number };
                                }[] | undefined;
                                const firstPageImage = pageImages?.[0]?.path;
                                const fileType = source.metadata?.file_type as string | undefined;
                                const isSourceExpanded = expandedSourceId === (source.id || `source-${index}`);
                                const scoreDisplay = formatScore(source.score);
                                const pagesDisplay = formatPageNumbers(pageNumbers);
                                const isPdf = fileType === 'pdf' || source.title?.toLowerCase().endsWith('.pdf');

                                return (
                                    <motion.div
                                        key={source.id || index}
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="rounded-lg bg-white/5 hover:bg-white/10 transition-colors group overflow-hidden border border-white/5"
                                    >
                                        {/* Main row */}
                                        <div
                                            className="flex items-start gap-3 p-2 cursor-pointer"
                                            onClick={() => setExpandedSourceId(isSourceExpanded ? null : (source.id || `source-${index}`))}
                                        >
                                            <div className="h-7 w-7 rounded bg-violet-500/20 flex items-center justify-center shrink-0 text-xs font-medium text-violet-400">
                                                {index + 1}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-sm font-medium truncate text-gray-200">
                                                        {source.title || `Source ${index + 1}`}
                                                    </p>
                                                    {scoreDisplay && (
                                                        <span className="text-xs text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                                                            {scoreDisplay}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    {pagesDisplay && (
                                                        <span className="text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                            <FileText className="h-3 w-3" />
                                                            {pagesDisplay}
                                                        </span>
                                                    )}
                                                    {chunkCount && chunkCount > 1 && (
                                                        <span className="text-xs text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                            <Layers className="h-3 w-3" />
                                                            {chunkCount} chunks
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                {firstPageImage && (
                                                    <button
                                                        onClick={(e) => {
                                                            const firstImage = pageImages?.[0];
                                                            // Collect all bboxes for this page
                                                            const pageBBoxes = chunkDetails
                                                                ?.filter(cd => cd.page === firstImage?.page || cd.page_image === firstPageImage)
                                                                .map(cd => cd.bbox)
                                                                .filter((b): b is number[] => !!b) || (firstImage?.bbox ? [firstImage.bbox] : []);
                                                            
                                                            handleViewImage(
                                                                firstPageImage,
                                                                source.title || 'Snapshot',
                                                                undefined, // Don't send single bbox if sending multiple
                                                                firstImage?.image_dimensions,
                                                                e,
                                                                pageBBoxes
                                                            );
                                                        }}
                                                        className="p-1.5 hover:bg-white/10 rounded text-emerald-400 transform hover:scale-105 transition-all"
                                                        title="View Page Snapshot with Highlighting"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                )}

                                                {/* Only show PDF eye if it's a PDF AND we didn't just show the snapshot eye 
                                                    (or show both? User might want PDF view if available). 
                                                    Let's show PDF view if URL exists. */}
                                                {isPdf && sourceUrl && !firstPageImage && (
                                                    <button
                                                        onClick={(e) => handleViewPdf(sourceUrl, source.title || 'Document', pageNumbers, e)}
                                                        className="p-1.5 hover:bg-white/10 rounded text-blue-400"
                                                        title="View PDF"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                )}

                                                {sourceUrl && (
                                                    <a
                                                        href={sourceUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-1.5 hover:bg-white/10 rounded"
                                                        title="Open in new tab"
                                                    >
                                                        <ExternalLink className="h-4 w-4 text-gray-500" />
                                                    </a>
                                                )}
                                                {(chunkSnippets && chunkSnippets.length > 0) && (
                                                    isSourceExpanded ? (
                                                        <ChevronUp className="h-4 w-4 text-gray-500" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-gray-500" />
                                                    )
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded content with chunks */}
                                        <AnimatePresence>
                                            {isSourceExpanded && (chunkDetails || chunkSnippets) && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="border-t border-white/5"
                                                >
                                                    <div className="p-3 space-y-2">
                                                        <p className="text-xs font-medium text-gray-500">
                                                            Relevant Excerpts:
                                                        </p>
                                                        {chunkDetails ? (
                                                            chunkDetails.map((chunk, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="text-xs text-gray-400 bg-black/30 p-2 rounded border-l-2 border-violet-500/30 flex flex-col gap-2"
                                                                >
                                                                    <span>"{chunk.text}"</span>
                                                                    {chunk.page_image && (
                                                                        <div className="flex justify-end">
                                                                            <button
                                                                                onClick={(e) => handleViewImage(
                                                                                    chunk.page_image!, 
                                                                                    `Page ${chunk.page || '?'}`,
                                                                                    chunk.bbox,
                                                                                    chunk.image_dimensions,
                                                                                    e
                                                                                )}
                                                                                className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 px-2 py-1 rounded"
                                                                            >
                                                                                <Eye className="h-3 w-3" />
                                                                                View Highlight
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))
                                                        ) : (
                                                            chunkSnippets?.map((snippet, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="text-xs text-gray-400 bg-black/30 p-2 rounded border-l-2 border-violet-500/30"
                                                                >
                                                                    "{snippet}"
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}

                            {hasMore && !isListExpanded && (
                                <button
                                    onClick={() => setIsListExpanded(true)}
                                    className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                                >
                                    Show {sources.length - 3} more sources
                                </button>
                            )}
                        </motion.div>
                    </>
                )}
            </div>

            {/* Media Preview Modal */}
            {mediaPreview && (
                <>
                    {mediaPreview.type === 'image' ? (
                        <HighlightedSnapshot
                            imageUrl={mediaPreview.url}
                            title={mediaPreview.title}
                            bbox={mediaPreview.bbox}
                            bboxes={mediaPreview.bboxes}
                            imageDimensions={mediaPreview.imageDimensions}
                            onClose={() => setMediaPreview(null)}
                        />
                    ) : (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
                            <div className="w-full max-w-5xl h-[85vh] bg-surface rounded-xl border border-white/10 overflow-hidden flex flex-col shadow-2xl">
                                <div className="flex items-center justify-between p-3 border-b border-white/10 bg-black/30">
                                    <div>
                                        <h3 className="font-medium text-sm text-gray-200">{mediaPreview.title}</h3>
                                        {mediaPreview.pages && mediaPreview.pages.length > 0 && (
                                            <p className="text-xs text-gray-500">
                                                Highlighted: {formatPageNumbers(mediaPreview.pages)}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setMediaPreview(null)}
                                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="flex-1 bg-black/50 flex items-center justify-center overflow-auto p-4 relative">
                                    <object
                                        data={mediaPreview.url}
                                        type="application/pdf"
                                        className="w-full h-full"
                                    >
                                        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                                            <FileText className="h-12 w-12 text-gray-500" />
                                            <p className="text-gray-400">
                                                Unable to display PDF preview.
                                            </p>
                                            <a
                                                href={mediaPreview.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-violet-400 hover:underline flex items-center gap-2"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                                Open in new tab
                                            </a>
                                        </div>
                                    </object>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </>
    );
}

export default SourcesList;
