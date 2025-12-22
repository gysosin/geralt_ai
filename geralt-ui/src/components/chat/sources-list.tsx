import { motion, AnimatePresence } from 'framer-motion'
import { FileText, ExternalLink, ChevronDown, ChevronUp, FileType, Layers, Eye } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import type { Source } from '@/types'

interface SourcesListProps {
    sources: Source[]
    className?: string
}

export function SourcesList({ sources, className }: SourcesListProps) {
    const [isListExpanded, setIsListExpanded] = useState(false)
    const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null)
    const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string; pages?: number[] } | null>(null)

    if (!sources || sources.length === 0) {
        return null
    }

    const displayedSources = isListExpanded ? sources : sources.slice(0, 3)
    const hasMore = sources.length > 3

    const formatScore = (score: number) => {
        if (!score || score === 0) return null
        // If score is already > 1, it's a raw ES score - normalize it
        const percentage = score > 1 ? Math.min(Math.round(score * 10), 100) : Math.round(score * 100)
        return `${percentage}%`
    }

    const formatPageNumbers = (pageNumbers?: number[]) => {
        if (!pageNumbers || pageNumbers.length === 0) return null
        if (pageNumbers.length === 1) return `Page ${pageNumbers[0]}`
        if (pageNumbers.length <= 3) return `Pages ${pageNumbers.join(', ')}`
        return `Pages ${pageNumbers.slice(0, 3).join(', ')}...`
    }

    const handleViewPdf = (url: string, title: string, pages?: number[], e?: React.MouseEvent) => {
        e?.stopPropagation()
        // Add page parameter if available
        let pdfUrl = url
        if (pages && pages.length > 0) {
            pdfUrl = `${url}#page=${pages[0]}`
        }
        setPdfPreview({ url: pdfUrl, title, pages })
    }

    return (
        <>
            <div className={cn("mt-3 pt-3 border-t border-border/50", className)}>
                {/* Collapsed state - just an icon with source count */}
                {!isListExpanded ? (
                    <button
                        onClick={() => setIsListExpanded(true)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
                            <FileText className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="text-xs">{sources.length} source{sources.length > 1 ? 's' : ''}</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                ) : (
                    <>
                        {/* Header when expanded */}
                        <button
                            onClick={() => setIsListExpanded(false)}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
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
                                const pageNumbers = source.metadata?.page_numbers as number[] | undefined
                                const chunkSnippets = source.metadata?.chunk_snippets as string[] | undefined
                                const chunkCount = source.metadata?.chunk_count as number | undefined
                                const sourceUrl = source.metadata?.url as string | undefined
                                const fileType = source.metadata?.file_type as string | undefined
                                const isSourceExpanded = expandedSourceId === (source.id || `source-${index}`)
                                const scoreDisplay = formatScore(source.score)
                                const pagesDisplay = formatPageNumbers(pageNumbers)
                                const isPdf = fileType === 'pdf' || source.title?.toLowerCase().endsWith('.pdf')

                                return (
                                    <motion.div
                                        key={source.id || index}
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group overflow-hidden"
                                    >
                                        {/* Main row */}
                                        <div
                                            className="flex items-start gap-3 p-2 cursor-pointer"
                                            onClick={() => setExpandedSourceId(isSourceExpanded ? null : (source.id || `source-${index}`))}
                                        >
                                            <div className="h-7 w-7 rounded bg-primary/10 flex items-center justify-center shrink-0 text-xs font-medium text-primary">
                                                {index + 1}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-sm font-medium truncate">
                                                        {source.title || `Source ${index + 1}`}
                                                    </p>
                                                    {scoreDisplay && (
                                                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                            {scoreDisplay}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    {pagesDisplay && (
                                                        <span className="text-xs text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                            <FileType className="h-3 w-3" />
                                                            {pagesDisplay}
                                                        </span>
                                                    )}
                                                    {chunkCount && chunkCount > 1 && (
                                                        <span className="text-xs text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                            <Layers className="h-3 w-3" />
                                                            {chunkCount} chunks
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                {isPdf && sourceUrl && (
                                                    <button
                                                        onClick={(e) => handleViewPdf(sourceUrl, source.title || 'Document', pageNumbers, e)}
                                                        className="p-1.5 hover:bg-muted rounded text-blue-500"
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
                                                        className="p-1.5 hover:bg-muted rounded"
                                                        title="Open in new tab"
                                                    >
                                                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                                    </a>
                                                )}
                                                {(chunkSnippets && chunkSnippets.length > 0) && (
                                                    isSourceExpanded ? (
                                                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                    )
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded content with chunks */}
                                        <AnimatePresence>
                                            {isSourceExpanded && chunkSnippets && chunkSnippets.length > 0 && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="border-t border-border/30"
                                                >
                                                    <div className="p-3 space-y-2">
                                                        <p className="text-xs font-medium text-muted-foreground">
                                                            Relevant Excerpts:
                                                        </p>
                                                        {chunkSnippets.map((snippet, i) => (
                                                            <div
                                                                key={i}
                                                                className="text-xs text-muted-foreground bg-background/50 p-2 rounded border-l-2 border-primary/30"
                                                            >
                                                                "{snippet}"
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                )
                            })}

                            {hasMore && (
                                <button
                                    onClick={() => setIsListExpanded(true)}
                                    className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Show {sources.length - 3} more sources
                                </button>
                            )}
                        </motion.div>
                    </>
                )}
            </div>

            {/* PDF Preview Dialog */}
            <Dialog open={!!pdfPreview} onOpenChange={() => setPdfPreview(null)}>
                <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0 [&>button]:hidden">
                    <VisuallyHidden>
                        <DialogTitle>Document Preview: {pdfPreview?.title}</DialogTitle>
                    </VisuallyHidden>
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                            <div>
                                <h3 className="font-medium text-sm">{pdfPreview?.title}</h3>
                                {pdfPreview?.pages && pdfPreview.pages.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        Highlighted: {formatPageNumbers(pdfPreview.pages)}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => setPdfPreview(null)}
                                className="px-3 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
                            >
                                Close
                            </button>
                        </div>
                        <div className="flex-1 bg-muted/50">
                            {pdfPreview && (
                                <object
                                    data={pdfPreview.url}
                                    type="application/pdf"
                                    className="w-full h-full"
                                >
                                    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                                        <FileText className="h-12 w-12 text-muted-foreground" />
                                        <p className="text-muted-foreground">
                                            Unable to display PDF preview.
                                        </p>
                                        <a
                                            href={pdfPreview.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline flex items-center gap-2"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            Open in new tab
                                        </a>
                                    </div>
                                </object>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default SourcesList
