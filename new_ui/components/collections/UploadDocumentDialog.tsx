import React, { useState, useRef } from 'react';
import { FileUp, X, Upload, Link, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Modal from '../Modal';
import { documentService } from '../../src/services';

interface UploadDocumentDialogProps {
    open: boolean;
    onClose: () => void;
    collectionId: string;
    onSuccess: () => void;
}

export function UploadDocumentDialog({
    open,
    onClose,
    collectionId,
    onSuccess,
}: UploadDocumentDialogProps) {
    const [activeTab, setActiveTab] = useState<'files' | 'urls'>('files');
    const [files, setFiles] = useState<File[]>([]);
    const [urls, setUrls] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
            setError(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files) {
            setFiles(Array.from(e.dataTransfer.files));
            setError(null);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const removeFile = (index: number) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        setIsUploading(true);
        setError(null);
        setUploadProgress(0);

        try {
            if (activeTab === 'files' && files.length > 0) {
                await documentService.uploadDocuments(
                    collectionId,
                    files,
                    (progress) => setUploadProgress(progress)
                );
            } else if (activeTab === 'urls' && urls.trim()) {
                const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean);
                await documentService.uploadUrls(collectionId, urlList);
            }

            setFiles([]);
            setUrls('');
            setUploadProgress(0);
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const canUpload = activeTab === 'files' ? files.length > 0 : urls.trim().length > 0;

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title="Upload Documents"
            maxWidth="max-w-xl"
        >
            <div className="space-y-6">
                {/* Tabs */}
                <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
                    <button
                        onClick={() => setActiveTab('files')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'files'
                                ? 'bg-violet-600 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Upload size={16} /> Files
                    </button>
                    <button
                        onClick={() => setActiveTab('urls')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'urls'
                                ? 'bg-violet-600 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Link size={16} /> URLs
                    </button>
                </div>

                {/* File Upload Area */}
                {activeTab === 'files' && (
                    <div>
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center bg-white/[0.02] hover:bg-white/[0.05] hover:border-violet-500/30 transition-all cursor-pointer group"
                        >
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <FileUp size={32} className="text-violet-400" />
                            </div>
                            <p className="text-white font-medium mb-1">Click to upload or drag and drop</p>
                            <p className="text-sm text-gray-500">PDF, DOCX, TXT, CSV, XLSX (max 25MB each)</p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.mp3,.mp4,.webm"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {/* Selected Files */}
                        {files.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <p className="text-xs text-gray-400 uppercase font-semibold">Selected Files ({files.length})</p>
                                {files.map((file, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-3 bg-white/5 rounded-xl"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <FileUp size={16} className="text-violet-400 shrink-0" />
                                            <span className="text-sm text-white truncate">{file.name}</span>
                                            <span className="text-xs text-gray-500 shrink-0">
                                                {(file.size / 1024 / 1024).toFixed(2)} MB
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                                            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* URL Input */}
                {activeTab === 'urls' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Enter URLs (one per line)
                        </label>
                        <textarea
                            value={urls}
                            onChange={(e) => setUrls(e.target.value)}
                            placeholder={`https://example.com/page\nhttps://youtube.com/watch?v=...`}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors min-h-[150px] resize-none font-mono text-sm"
                        />
                        <p className="mt-2 text-xs text-gray-500">
                            Supports web pages and YouTube videos
                        </p>
                    </div>
                )}

                {/* Upload Progress */}
                {isUploading && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Uploading...</span>
                            <span className="text-violet-400 font-mono">{uploadProgress}%</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isUploading}
                        className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={!canUpload || isUploading}
                        className="px-5 py-2.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-xl shadow-lg shadow-violet-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Upload size={16} />
                                Start Upload
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export default UploadDocumentDialog;
