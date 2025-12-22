import React, { useState } from 'react';
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
    CheckCircle,
    Clock,
    AlertCircle,
    Loader2,
} from 'lucide-react';
import type { Document, ResourceType } from '../../types';

interface DocumentListProps {
    documents: Document[];
    isLoading: boolean;
    onProcess: (documentId: string) => void;
    onDownload: (documentId: string, fileName: string) => void;
    onDelete: (documentIds: string[]) => void;
}

export function DocumentList({
    documents,
    isLoading,
    onProcess,
    onDownload,
    onDelete,
}: DocumentListProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const getFileIcon = (type: ResourceType | string) => {
        const iconClass = 'h-5 w-5';
        switch (type) {
            case 'PDF_Document':
                return <FileText className={`${iconClass} text-red-500`} />;
            case 'Word_Document':
                return <FileText className={`${iconClass} text-blue-500`} />;
            case 'Excel_Spreadsheet':
            case 'CSV_File':
                return <FileSpreadsheet className={`${iconClass} text-green-500`} />;
            case 'Video_File':
                return <Video className={`${iconClass} text-purple-500`} />;
            case 'Audio_File':
                return <Music className={`${iconClass} text-orange-500`} />;
            case 'Web_Page':
                return <Globe className={`${iconClass} text-cyan-500`} />;
            case 'Youtube':
                return <Youtube className={`${iconClass} text-red-600`} />;
            default:
                return <FileText className={`${iconClass} text-gray-400`} />;
        }
    };

    const getStatusBadge = (doc: Document) => {
        if (doc.is_processing || doc.status === 'processing') {
            return (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing {doc.progress > 0 ? `${doc.progress}%` : ''}
                </span>
            );
        }
        if (doc.processed || doc.status === 'completed') {
            return (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle className="h-3 w-3" />
                    Ready
                </span>
            );
        }
        if (doc.status === 'failed') {
            return (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                    <AlertCircle className="h-3 w-3" />
                    Failed
                </span>
            );
        }
        return (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
                <Clock className="h-3 w-3" />
                Pending
            </span>
        );
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === documents.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(documents.map((d) => d.document_id)));
        }
    };

    const handleBulkDelete = () => {
        if (selectedIds.size > 0) {
            onDelete(Array.from(selectedIds));
            setSelectedIds(new Set());
        }
    };

    const formatFileSize = (size: string) => {
        const bytes = parseInt(size, 10);
        if (isNaN(bytes)) return size;
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            </div>
        );
    }

    if (documents.length === 0) {
        return (
            <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <h3 className="text-lg font-semibold text-white mb-2">No documents yet</h3>
                <p className="text-gray-500">
                    Upload documents to add them to this collection
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-4 p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                    <span className="text-sm text-violet-300">
                        {selectedIds.size} selected
                    </span>
                    <button
                        onClick={handleBulkDelete}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete Selected
                    </button>
                </div>
            )}

            {/* Document Table */}
            <div className="bg-surface/30 border border-white/5 rounded-2xl overflow-hidden">
                <table className="w-full">
                    <thead className="bg-white/[0.02] border-b border-white/5">
                        <tr>
                            <th className="w-10 p-4">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.size === documents.length && documents.length > 0}
                                    onChange={toggleSelectAll}
                                    className="rounded border-gray-600 bg-gray-800 text-violet-500 focus:ring-violet-500"
                                />
                            </th>
                            <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Document</th>
                            <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider w-24">Size</th>
                            <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider w-32">Status</th>
                            <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider w-28">Date</th>
                            <th className="w-20 p-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {documents.map((doc) => (
                            <tr
                                key={doc.document_id}
                                className="hover:bg-white/[0.02] transition-colors group"
                            >
                                <td className="p-4">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(doc.document_id)}
                                        onChange={() => toggleSelect(doc.document_id)}
                                        className="rounded border-gray-600 bg-gray-800 text-violet-500 focus:ring-violet-500"
                                    />
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-white/5">
                                            {getFileIcon(doc.resource_type || doc.type)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium text-white truncate max-w-[300px]">
                                                {doc.original_file_name || doc.file_name}
                                            </p>
                                            {doc.full_name && (
                                                <p className="text-xs text-gray-500">
                                                    By {doc.full_name}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-sm text-gray-400 font-mono">
                                    {formatFileSize(doc.file_size)}
                                </td>
                                <td className="p-4">{getStatusBadge(doc)}</td>
                                <td className="p-4 text-sm text-gray-400">
                                    {formatDate(doc.upload_time)}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!doc.processed && !doc.is_processing && (
                                            <button
                                                onClick={() => onProcess(doc.document_id)}
                                                className="p-1.5 text-gray-400 hover:text-white bg-white/5 rounded hover:bg-white/10 transition-colors"
                                                title="Process"
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                            </button>
                                        )}
                                        {doc.isShowDownload !== false && (
                                            <button
                                                onClick={() =>
                                                    onDownload(doc.document_id, doc.original_file_name || doc.file_name)
                                                }
                                                className="p-1.5 text-gray-400 hover:text-white bg-white/5 rounded hover:bg-white/10 transition-colors"
                                                title="Download"
                                            >
                                                <Download className="h-4 w-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onDelete([doc.document_id])}
                                            className="p-1.5 text-gray-400 hover:text-red-400 bg-white/5 rounded hover:bg-white/10 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default DocumentList;
