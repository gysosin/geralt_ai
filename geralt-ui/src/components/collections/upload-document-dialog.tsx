import { useState, useCallback } from 'react'
import { Upload, X, FileText, Link, Youtube } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { documentService } from '@/services'

interface UploadDocumentDialogProps {
    open: boolean
    onClose: () => void
    collectionId: string
    onSuccess: () => void
}

type UploadMode = 'file' | 'url' | 'youtube'

const ACCEPTED_FILE_TYPES = [
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.csv',
    '.txt',
    '.mp3',
    '.mp4',
    '.wav',
]

export function UploadDocumentDialog({
    open,
    onClose,
    collectionId,
    onSuccess,
}: UploadDocumentDialogProps) {
    const [mode, setMode] = useState<UploadMode>('file')
    const [files, setFiles] = useState<File[]>([])
    const [url, setUrl] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [isDragging, setIsDragging] = useState(false)

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const droppedFiles = Array.from(e.dataTransfer.files)
        setFiles((prev) => [...prev, ...droppedFiles])
    }, [])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files)
            setFiles((prev) => [...prev, ...selectedFiles])
        }
    }

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index))
    }

    const handleUpload = async () => {
        if (mode === 'file' && files.length === 0) {
            toast({
                title: 'Error',
                description: 'Please select at least one file',
                variant: 'destructive',
            })
            return
        }

        if ((mode === 'url' || mode === 'youtube') && !url.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter a URL',
                variant: 'destructive',
            })
            return
        }

        setIsUploading(true)
        setUploadProgress(0)

        try {
            if (mode === 'file') {
                await documentService.uploadDocuments(collectionId, files, (progress) => {
                    setUploadProgress(progress)
                })
            } else {
                await documentService.uploadUrls(collectionId, [url])
            }

            toast({
                title: 'Success',
                description:
                    mode === 'file'
                        ? `${files.length} file(s) uploaded successfully`
                        : 'URL imported successfully',
            })

            // Reset state
            setFiles([])
            setUrl('')
            setUploadProgress(0)
            onSuccess()
            onClose()
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to upload. Please try again.',
                variant: 'destructive',
            })
        } finally {
            setIsUploading(false)
        }
    }

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Add Documents</DialogTitle>
                </DialogHeader>

                {/* Mode Tabs */}
                <div className="flex gap-2 mb-4">
                    <Button
                        variant={mode === 'file' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setMode('file')}
                    >
                        <FileText className="h-4 w-4 mr-2" />
                        Files
                    </Button>
                    <Button
                        variant={mode === 'url' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setMode('url')}
                    >
                        <Link className="h-4 w-4 mr-2" />
                        Web URL
                    </Button>
                    <Button
                        variant={mode === 'youtube' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setMode('youtube')}
                    >
                        <Youtube className="h-4 w-4 mr-2" />
                        YouTube
                    </Button>
                </div>

                {/* File Upload */}
                {mode === 'file' && (
                    <div className="space-y-4">
                        <div
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                                }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground mb-2">
                                Drag and drop files here, or click to browse
                            </p>
                            <p className="text-xs text-muted-foreground mb-4">
                                Supported: PDF, Word, Excel, CSV, Text, Audio, Video
                            </p>
                            <input
                                type="file"
                                id="file-upload"
                                className="hidden"
                                multiple
                                accept={ACCEPTED_FILE_TYPES.join(',')}
                                onChange={handleFileSelect}
                            />
                            <Button
                                variant="outline"
                                onClick={() => document.getElementById('file-upload')?.click()}
                            >
                                Browse Files
                            </Button>
                        </div>

                        {/* File List */}
                        {files.length > 0 && (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {files.map((file, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText className="h-4 w-4 shrink-0 text-primary" />
                                            <span className="text-sm truncate">{file.name}</span>
                                            <span className="text-xs text-muted-foreground shrink-0">
                                                ({formatFileSize(file.size)})
                                            </span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 shrink-0"
                                            onClick={() => removeFile(index)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* URL Input */}
                {mode === 'url' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="url">Web Page URL</Label>
                            <Input
                                id="url"
                                placeholder="https://example.com/article"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Enter a public web page URL to import its content
                            </p>
                        </div>
                    </div>
                )}

                {/* YouTube Input */}
                {mode === 'youtube' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="youtube-url">YouTube Video URL</Label>
                            <Input
                                id="youtube-url"
                                placeholder="https://www.youtube.com/watch?v=..."
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Enter a YouTube video URL to transcribe and import its content
                            </p>
                        </div>
                    </div>
                )}

                {/* Upload Progress */}
                {isUploading && (
                    <div className="space-y-2">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                        <p className="text-xs text-center text-muted-foreground">
                            Uploading... {uploadProgress}%
                        </p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={onClose} disabled={isUploading}>
                        Cancel
                    </Button>
                    <Button onClick={handleUpload} disabled={isUploading}>
                        {isUploading ? 'Uploading...' : 'Upload'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
