import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
   ArrowLeft, FileText, UploadCloud, Search, Edit2, Check, X,
   Share2, MessageSquare, Loader2, Database, Tag
} from 'lucide-react';
import { motion } from 'framer-motion';
import { documentService, socketService } from '../src/services';
import { useAuthStore } from '../src/store';
import { DocumentList, UploadDocumentDialog, ShareCollectionDialog } from './collections';
import Modal from './Modal';
import type { Document, CollectionDetail as CollectionDetailType } from '../types';

const CollectionDetail: React.FC = () => {
   const { id: collectionId } = useParams<{ id: string }>();
   const navigate = useNavigate();
   const { user } = useAuthStore();

   const [collection, setCollection] = useState<CollectionDetailType | null>(null);
   const [documents, setDocuments] = useState<Document[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [isDocsLoading, setIsDocsLoading] = useState(true);
   const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
   const [shareDialogOpen, setShareDialogOpen] = useState(false);
   const [searchQuery, setSearchQuery] = useState('');

   // Edit mode state
   const [isEditing, setIsEditing] = useState(false);
   const [editName, setEditName] = useState('');
   const [editDescription, setEditDescription] = useState('');
   const [editType, setEditType] = useState('');
   const [isSaving, setIsSaving] = useState(false);

   const tenantId = user?.tenant_id || 'default';

   // SocketIO Integration for real-time updates
   useEffect(() => {
      socketService.connect();

      const handleProcessingUpdate = (data: any) => {
         setDocuments((prevDocs) =>
            prevDocs.map((doc) => {
               if (doc.document_id === data.document_id) {
                  const isCompleted = data.progress === 100;
                  const isFailed = !!data.error;

                  return {
                     ...doc,
                     progress: data.progress,
                     latest_status: data.status,
                     error_message: data.error,
                     is_processing: !isCompleted && !isFailed,
                     processed: isCompleted,
                     status: isFailed ? 'failed' : (isCompleted ? 'completed' : 'processing')
                  } as Document;
               }
               return doc;
            })
         );
      };

      const handleDeletionUpdate = (data: any) => {
         if (data.status === 'Deletion completed') {
            setDocuments((prevDocs) =>
               prevDocs.filter((doc) => doc.document_id !== data.document_id)
            );
         } else {
            setDocuments((prevDocs) =>
               prevDocs.map((doc) => {
                  if (doc.document_id === data.document_id) {
                     return {
                        ...doc,
                        latest_status: data.status,
                        status: 'processing' as const
                     };
                  }
                  return doc;
               })
            );
         }
      };

      socketService.on('processing_update', handleProcessingUpdate);
      socketService.on('deletion_update', handleDeletionUpdate);

      return () => {
         socketService.off('processing_update', handleProcessingUpdate);
         socketService.off('deletion_update', handleDeletionUpdate);
         socketService.disconnect();
      };
   }, []);

   const fetchCollection = useCallback(async () => {
      if (!collectionId) return;
      try {
         const details = await documentService.getCollectionDetails(collectionId);
         setCollection(details);
         setEditName(details.collection_name);
         setEditDescription(details.description || '');
         setEditType(details.type || 'general');
      } catch (error) {
         console.error('Failed to load collection:', error);
      } finally {
         setIsLoading(false);
      }
   }, [collectionId]);

   const fetchDocuments = useCallback(async () => {
      if (!collectionId) return;
      setIsDocsLoading(true);
      try {
         const docs = await documentService.listDocuments(collectionId);
         setDocuments(docs);
      } catch (error) {
         console.error('Failed to load documents:', error);
      } finally {
         setIsDocsLoading(false);
      }
   }, [collectionId]);

   useEffect(() => {
      fetchCollection();
      fetchDocuments();
   }, [fetchCollection, fetchDocuments]);

   const handleSaveEdit = async () => {
      if (!collectionId || !editName.trim()) return;
      setIsSaving(true);
      try {
         await documentService.updateCollection({
            collection_id: collectionId,
            name: editName,
            description: editDescription,
            type: editType,
            tenant_id: tenantId,
         });
         setIsEditing(false);
         fetchCollection();
      } catch (error) {
         console.error('Failed to update collection:', error);
      } finally {
         setIsSaving(false);
      }
   };

   const handleCancelEdit = () => {
      setIsEditing(false);
      if (collection) {
         setEditName(collection.collection_name);
         setEditDescription(collection.description || '');
         setEditType(collection.type || 'general');
      }
   };

   const handleProcess = async (documentId: string) => {
      try {
         await documentService.processDocument(documentId);
         fetchDocuments();
      } catch (error) {
         console.error('Failed to start processing:', error);
      }
   };

   const handleDownload = async (documentId: string, fileName: string) => {
      try {
         const blob = await documentService.downloadDocument(documentId);
         const url = window.URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = fileName;
         document.body.appendChild(a);
         a.click();
         window.URL.revokeObjectURL(url);
         document.body.removeChild(a);
      } catch (error) {
         console.error('Failed to download document:', error);
      }
   };

   const handleDelete = async (documentIds: string[]) => {
      if (!confirm(`Delete ${documentIds.length} document(s)?`)) return;
      if (!collectionId) return;
      try {
         await documentService.deleteDocuments(documentIds, collectionId);
         fetchDocuments();
      } catch (error) {
         console.error('Failed to delete documents:', error);
      }
   };

   const handleChat = () => {
      if (!collectionId) return;
      navigate('/chat', { state: { collectionId } });
   };

   const filteredDocuments = documents.filter(doc => {
      const name = doc.original_file_name || doc.file_name || '';
      return name.toLowerCase().includes(searchQuery.toLowerCase());
   });

   // Get file type counts
   const fileTypeCounts = documents.reduce((acc, doc) => {
      const type = doc.resource_type || doc.type || 'Other';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
   }, {} as Record<string, number>);

   if (isLoading) {
      return (
         <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-20"
         >
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
         </motion.div>
      );
   }

   if (!collection) {
      return (
         <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
         >
            <Database className="h-16 w-16 mx-auto mb-4 text-gray-600" />
            <h3 className="text-lg font-semibold text-white mb-2">Collection not found</h3>
            <button
               onClick={() => navigate('/collections')}
               className="px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-500 transition-colors"
            >
               Back to Collections
            </button>
         </motion.div>
      );
   }

   return (
      <motion.div
         initial={{ opacity: 0, x: 20 }}
         animate={{ opacity: 1, x: 0 }}
         className="max-w-6xl mx-auto space-y-6"
      >
         {/* Navigation & Header */}
         <div className="flex items-center gap-4 mb-4">
            <button
               onClick={() => navigate('/collections')}
               className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
               <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
               <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-white">
                     {collection.collection_name}
                  </h1>
                  {collection.public && (
                     <span className="text-xs font-normal text-gray-500 bg-white/5 px-2 py-1 rounded uppercase tracking-wider">Public</span>
                  )}
                  {collection.type && (
                     <span className="text-xs font-normal text-violet-400 bg-violet-500/10 px-2 py-1 rounded flex items-center gap-1">
                        <Tag size={10} /> {collection.type.charAt(0).toUpperCase() + collection.type.slice(1)}
                     </span>
                  )}
                  {collection.is_owner && (
                     <button
                        onClick={() => setIsEditing(true)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                     >
                        <Edit2 size={16} />
                     </button>
                  )}
               </div>
               <p className="text-sm text-gray-400 mt-1">
                  {documents.length} documents • Created by {collection.full_name || collection.created_by}
               </p>
               {collection.description && (
                  <p className="text-sm text-gray-500 mt-1 max-w-xl truncate">{collection.description}</p>
               )}
            </div>
            <div className="flex gap-3">
               {collection.is_owner && (
                  <button
                     onClick={() => setShareDialogOpen(true)}
                     className="flex items-center gap-2 px-4 py-2 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-white/5"
                  >
                     <Share2 size={16} /> Share
                  </button>
               )}
               <button
                  onClick={handleChat}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-white/5"
               >
                  <MessageSquare size={16} /> Chat
               </button>
               <button
                  onClick={() => setUploadDialogOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-500 transition-colors shadow-lg shadow-violet-900/20"
               >
                  <UploadCloud size={18} /> Add Documents
               </button>
            </div>
         </div>

         {/* Stats Cards */}
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-surface/30 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
               <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <FileText size={20} />
               </div>
               <div>
                  <p className="text-gray-400 text-xs font-medium uppercase">Total Files</p>
                  <p className="text-xl font-bold text-white">{documents.length}</p>
               </div>
            </div>
            {Object.entries(fileTypeCounts).slice(0, 3).map(([type, count]) => (
               <div key={type} className="bg-surface/30 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
                     <FileText size={20} />
                  </div>
                  <div>
                     <p className="text-gray-400 text-xs font-medium uppercase">{type.replace(/_/g, ' ')}</p>
                     <p className="text-xl font-bold text-white">{count}</p>
                  </div>
               </div>
            ))}
         </div>

         {/* Content Area */}
         <div className="bg-surface/30 border border-white/5 rounded-3xl overflow-hidden min-h-[400px]">
            {/* Toolbar */}
            <div className="p-4 border-b border-white/5 flex items-center gap-4">
               <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input
                     type="text"
                     placeholder="Search documents..."
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all placeholder-gray-600"
                  />
               </div>
            </div>

            {/* Document List */}
            <div className="p-4">
               <DocumentList
                  documents={filteredDocuments}
                  isLoading={isDocsLoading}
                  onProcess={handleProcess}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
               />
            </div>
         </div>

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

         {/* Edit Collection Modal */}
         <Modal
            isOpen={isEditing}
            onClose={handleCancelEdit}
            title="Edit Collection"
         >
            <div className="space-y-5">
               <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Name *</label>
                  <input
                     type="text"
                     value={editName}
                     onChange={(e) => setEditName(e.target.value)}
                     className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors"
                     placeholder="Collection name"
                  />
               </div>

               <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                  <textarea
                     value={editDescription}
                     onChange={(e) => setEditDescription(e.target.value)}
                     className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors min-h-[100px] resize-none"
                     placeholder="What is this collection used for?"
                  />
               </div>

               <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                  <input
                     type="text"
                     value={editType}
                     onChange={(e) => setEditType(e.target.value)}
                     className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors mb-3"
                     placeholder="e.g. Finance, Legal, Research..."
                  />
                  <div className="flex flex-wrap gap-2">
                     {['finance', 'legal', 'technical', 'general', 'research', 'marketing'].map(type => (
                        <button
                           key={type}
                           type="button"
                           onClick={() => setEditType(type)}
                           className={`px-3 py-1.5 text-xs rounded-lg transition-all ${editType === type
                              ? 'bg-violet-600 text-white'
                              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                              }`}
                        >
                           {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                     ))}
                  </div>
               </div>

               <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                  <button
                     onClick={handleCancelEdit}
                     disabled={isSaving}
                     className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50"
                  >
                     Cancel
                  </button>
                  <button
                     onClick={handleSaveEdit}
                     disabled={isSaving || !editName.trim()}
                     className="px-5 py-2.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-xl shadow-lg shadow-violet-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                     {isSaving && <Loader2 size={16} className="animate-spin" />}
                     {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
               </div>
            </div>
         </Modal>
      </motion.div>
   );
};

export default CollectionDetail;