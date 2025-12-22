import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    ArrowLeft,
    Upload,
    Share2,
    Database,
    Loader2,
    Edit2,
    Check,
    X,
    MessageSquare,
} from 'lucide-react'
import { PageTransition } from '@/components/layout/page-transition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { documentService } from '@/services'
import { socketService } from '@/services/socketService'
import { useChatStore } from '@/store'
import { UploadDocumentDialog, DocumentList, ShareCollectionDialog } from '@/components/collections'
import type { Document, CollectionDetail } from '@/types'

export default function CollectionDetailPage() {
    const { id: collectionId } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { startNewConversation, setCollectionId } = useChatStore()

    const [collection, setCollection] = useState<CollectionDetail | null>(null)
    const [documents, setDocuments] = useState<Document[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDocsLoading, setIsDocsLoading] = useState(true)
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
    const [shareDialogOpen, setShareDialogOpen] = useState(false)

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState('')
    const [isPublic, setIsPublic] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // SocketIO Integration
    useEffect(() => {
        socketService.connect()

        const handleProcessingUpdate = (data: any) => {
            setDocuments((prevDocs) =>
                prevDocs.map((doc) => {
                    if (doc.document_id === data.document_id) {
                        const isCompleted = data.progress === 100
                        const isFailed = !!data.error

                        return {
                            ...doc,
                            progress: data.progress,
                            latest_status: data.status,
                            error_message: data.error,
                            is_processing: !isCompleted && !isFailed,
                            processed: isCompleted,
                            status: isFailed ? 'failed' : (isCompleted ? 'completed' : 'processing')
                        }
                    }
                    return doc
                })
            )
        }

        const handleDeletionUpdate = (data: any) => {
            if (data.status === 'Deletion completed') {
                setDocuments((prevDocs) =>
                    prevDocs.filter((doc) => doc.document_id !== data.document_id)
                )
            } else {
                setDocuments((prevDocs) =>
                    prevDocs.map((doc) => {
                        if (doc.document_id === data.document_id) {
                            return {
                                ...doc,
                                latest_status: data.status,
                                status: 'processing' as const // Use valid status instead of 'deleting'
                            }
                        }
                        return doc
                    })
                )
            }
        }

        socketService.on('processing_update', handleProcessingUpdate)
        socketService.on('deletion_update', handleDeletionUpdate)

        return () => {
            socketService.off('processing_update', handleProcessingUpdate)
            socketService.off('deletion_update', handleDeletionUpdate)
            socketService.disconnect()
        }
    }, [])

    const fetchCollection = useCallback(async () => {
        if (!collectionId) return
        try {
            const details = await documentService.getCollectionDetails(collectionId)
            setCollection(details)
            setEditName(details.collection_name)
            setIsPublic(details.public)
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load collection details',
                variant: 'destructive',
            })
        } finally {
            setIsLoading(false)
        }
    }, [collectionId])

    const fetchDocuments = useCallback(async () => {
        if (!collectionId) return
        setIsDocsLoading(true)
        try {
            const docs = await documentService.listDocuments(collectionId)
            setDocuments(docs)
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load documents',
                variant: 'destructive',
            })
        } finally {
            setIsDocsLoading(false)
        }
    }, [collectionId])

    useEffect(() => {
        fetchCollection()
        fetchDocuments()
    }, [fetchCollection, fetchDocuments])

    const handleSaveEdit = async () => {
        if (!collectionId || !editName.trim()) return
        setIsSaving(true)
        try {
            await documentService.updateCollection({
                collection_id: collectionId,
                name: editName,
                public: isPublic,
            })
            toast({
                title: 'Success',
                description: 'Collection updated successfully',
            })
            setIsEditing(false)
            fetchCollection()
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to update collection',
                variant: 'destructive',
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancelEdit = () => {
        setIsEditing(false)
        if (collection) {
            setEditName(collection.collection_name)
            setIsPublic(collection.public)
        }
    }

    const handleProcess = async (documentId: string) => {
        try {
            await documentService.processDocument(documentId)
            toast({
                title: 'Processing Started',
                description: 'Document is being processed',
            })
            fetchDocuments()
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to start processing',
                variant: 'destructive',
            })
        }
    }

    const handleDownload = async (documentId: string, fileName: string) => {
        try {
            const blob = await documentService.downloadDocument(documentId)
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = fileName
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to download document',
                variant: 'destructive',
            })
        }
    }

    const handleDelete = async (documentIds: string[]) => {
        if (!confirm(`Delete ${documentIds.length} document(s)?`)) return
        if (!collectionId) return
        try {
            await documentService.deleteDocuments(documentIds, collectionId)
            toast({
                title: 'Success',
                description: `${documentIds.length} document(s) deleted`,
            })
            fetchDocuments()
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete documents',
                variant: 'destructive',
            })
        }
    }

    const handleChat = () => {
        if (!collectionId) return
        navigate('/chat', { state: { collectionId } })
    }

    if (isLoading) {
        return (
            <PageTransition>
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </PageTransition>
        )
    }

    if (!collection) {
        return (
            <PageTransition>
                <div className="text-center py-20">
                    <Database className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">Collection not found</h3>
                    <Button onClick={() => navigate('/collections')}>
                        Back to Collections
                    </Button>
                </div>
            </PageTransition>
        )
    }

    return (
        <PageTransition>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/collections')}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>

                        {isEditing ? (
                            <div className="space-y-3">
                                <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="text-2xl font-bold h-auto py-1 px-2"
                                    autoFocus
                                />
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="public"
                                        checked={isPublic}
                                        onCheckedChange={setIsPublic}
                                    />
                                    <Label htmlFor="public">Public Collection</Label>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={handleSaveEdit} disabled={isSaving}>
                                        <Check className="h-4 w-4 mr-1" />
                                        Save
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleCancelEdit}
                                        disabled={isSaving}
                                    >
                                        <X className="h-4 w-4 mr-1" />
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-3xl font-bold tracking-tight">
                                        {collection.collection_name}
                                    </h1>
                                    {collection.public && (
                                        <Badge variant="secondary">Public</Badge>
                                    )}
                                    {collection.is_owner && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => setIsEditing(true)}
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                <p className="text-muted-foreground">
                                    {documents.length} documents • Created by {collection.full_name || collection.created_by}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {collection.is_owner && (
                            <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)}>
                                <Share2 className="h-4 w-4 mr-2" />
                                Share
                            </Button>
                        )}
                        <Button variant="secondary" onClick={handleChat}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Chat
                        </Button>
                        <Button onClick={() => setUploadDialogOpen(true)}>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Documents
                        </Button>
                    </div>
                </div>

                {/* File Type Stats */}
                {collection.file_types && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <Card className="p-4">
                            <div className="flex flex-wrap gap-4">
                                {Object.entries(collection.file_types).map(
                                    ([type, count]) =>
                                        count > 0 && (
                                            <div
                                                key={type}
                                                className="flex items-center gap-2 text-sm"
                                            >
                                                <span className="font-medium">
                                                    {type.replace(/_/g, ' ')}:
                                                </span>
                                                <Badge variant="secondary">{count}</Badge>
                                            </div>
                                        )
                                )}
                            </div>
                        </Card>
                    </motion.div>
                )}

                {/* Documents */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <DocumentList
                        documents={documents}
                        isLoading={isDocsLoading}
                        onProcess={handleProcess}
                        onDownload={handleDownload}
                        onDelete={handleDelete}
                    />
                </motion.div>

                {/* Upload Dialog */}
                <UploadDocumentDialog
                    open={uploadDialogOpen}
                    onClose={() => setUploadDialogOpen(false)}
                    collectionId={collectionId!}
                    onSuccess={fetchDocuments}
                />

                {/* Share Dialog */}
                {collection && (
                    <ShareCollectionDialog
                        open={shareDialogOpen}
                        onClose={() => setShareDialogOpen(false)}
                        collectionId={collectionId!}
                        collectionName={collection.collection_name}
                    />
                )}
            </div>
        </PageTransition>
    )
}
