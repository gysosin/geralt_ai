import { useState } from 'react'
import {
    FileText,
    FileSpreadsheet,
    Video,
    Music,
    Globe,
    Youtube,
    Download,
    RefreshCw,
    Trash2,
    MoreVertical,
    CheckCircle2,
    Clock,
    AlertCircle,
    Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import type { Document, DocumentStatus, ResourceType } from '@/types'

interface DocumentListProps {
    documents: Document[]
    isLoading: boolean
    onProcess: (documentId: string) => void
    onDownload: (documentId: string, fileName: string) => void
    onDelete: (documentIds: string[]) => void
}

export function DocumentList({
    documents,
    isLoading,
    onProcess,
    onDownload,
    onDelete,
}: DocumentListProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    const getFileIcon = (type: ResourceType | string) => {
        const iconClass = 'h-5 w-5'
        switch (type) {
            case 'PDF_Document':
                return <FileText className={`${iconClass} text-red-500`} />
            case 'Word_Document':
                return <FileText className={`${iconClass} text-blue-500`} />
            case 'Excel_Spreadsheet':
            case 'CSV_File':
                return <FileSpreadsheet className={`${iconClass} text-green-500`} />
            case 'Video_File':
                return <Video className={`${iconClass} text-purple-500`} />
            case 'Audio_File':
                return <Music className={`${iconClass} text-orange-500`} />
            case 'Web_Page':
                return <Globe className={`${iconClass} text-cyan-500`} />
            case 'Youtube':
                return <Youtube className={`${iconClass} text-red-600`} />
            default:
                return <FileText className={`${iconClass} text-muted-foreground`} />
        }
    }

    const getStatusBadge = (doc: Document) => {
        if (doc.is_processing || doc.status === 'processing') {
            return (
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Processing {doc.progress > 0 ? `${doc.progress}%` : ''}
                </Badge>
            )
        }
        if (doc.processed || doc.status === 'completed') {
            return (
                <Badge variant="outline" className="text-green-600 border-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Ready
                </Badge>
            )
        }
        if (doc.status === 'failed') {
            return (
                <Badge variant="outline" className="text-red-600 border-red-600">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Failed
                </Badge>
            )
        }
        return (
            <Badge variant="outline" className="text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" />
                Pending
            </Badge>
        )
    }

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            newSelected.add(id)
        }
        setSelectedIds(newSelected)
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === documents.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(documents.map((d) => d.document_id)))
        }
    }

    const handleBulkDelete = () => {
        if (selectedIds.size > 0) {
            onDelete(Array.from(selectedIds))
            setSelectedIds(new Set())
        }
    }

    const formatFileSize = (size: string) => {
        const bytes = parseInt(size, 10)
        if (isNaN(bytes)) return size
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (documents.length === 0) {
        return (
            <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
                <p className="text-muted-foreground">
                    Upload documents to add them to this collection
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">
                        {selectedIds.size} selected
                    </span>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDelete}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Selected
                    </Button>
                </div>
            )}

            {/* Document Table */}
            <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="w-10 p-3">
                                <Checkbox
                                    checked={selectedIds.size === documents.length}
                                    onCheckedChange={toggleSelectAll}
                                />
                            </th>
                            <th className="text-left p-3 text-sm font-medium">Document</th>
                            <th className="text-left p-3 text-sm font-medium w-32">Size</th>
                            <th className="text-left p-3 text-sm font-medium w-32">Status</th>
                            <th className="text-left p-3 text-sm font-medium w-32">Date</th>
                            <th className="w-16 p-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {documents.map((doc) => (
                            <tr
                                key={doc.document_id}
                                className="hover:bg-muted/30 transition-colors"
                            >
                                <td className="p-3">
                                    <Checkbox
                                        checked={selectedIds.has(doc.document_id)}
                                        onCheckedChange={() => toggleSelect(doc.document_id)}
                                    />
                                </td>
                                <td className="p-3">
                                    <div className="flex items-center gap-3">
                                        {getFileIcon(doc.resource_type || doc.type)}
                                        <div className="min-w-0">
                                            <p className="font-medium truncate">
                                                {doc.original_file_name || doc.file_name}
                                            </p>
                                            {doc.full_name && (
                                                <p className="text-xs text-muted-foreground">
                                                    By {doc.full_name}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-3 text-sm text-muted-foreground">
                                    {formatFileSize(doc.file_size)}
                                </td>
                                <td className="p-3">{getStatusBadge(doc)}</td>
                                <td className="p-3 text-sm text-muted-foreground">
                                    {formatDate(doc.upload_time)}
                                </td>
                                <td className="p-3">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {!doc.processed && !doc.is_processing && (
                                                <DropdownMenuItem
                                                    onClick={() => onProcess(doc.document_id)}
                                                >
                                                    <RefreshCw className="h-4 w-4 mr-2" />
                                                    Process
                                                </DropdownMenuItem>
                                            )}
                                            {doc.isShowDownload !== false && (
                                                <DropdownMenuItem
                                                    onClick={() =>
                                                        onDownload(doc.document_id, doc.original_file_name || doc.file_name)
                                                    }
                                                >
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Download
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem
                                                className="text-destructive"
                                                onClick={() => onDelete([doc.document_id])}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
