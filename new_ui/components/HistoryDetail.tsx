import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Bot, RotateCcw, Download, Calendar, Loader2, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useChatStore } from '../src/store';
import { MarkdownRenderer } from '../src/components/chat';
import type { Source } from '../types';

function formatRelativeTime(dateString: string | Date): string {
   const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
   const now = new Date();
   const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

   if (diffInSeconds < 60) return 'just now';
   if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
   if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
   if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
   return date.toLocaleDateString();
}

const HistoryDetail: React.FC = () => {
   const { id } = useParams<{ id: string }>();
   const navigate = useNavigate();
   const { currentConversation, messages, isConversationLoading, fetchConversation } = useChatStore();

   useEffect(() => {
      if (id) {
         fetchConversation(id);
      }
   }, [id, fetchConversation]);

   const handleResume = () => {
      navigate(`/chat/${id}`);
   };

   const handleDownload = () => {
      // Export conversation as text
      const content = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${id}.txt`;
      a.click();
      URL.revokeObjectURL(url);
   };

   if (isConversationLoading) {
      return (
         <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
         </div>
      );
   }

   if (!id) {
      return (
         <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)] text-center">
            <MessageSquare className="h-12 w-12 text-gray-600 mb-4" />
            <p className="text-gray-500">Conversation not found</p>
            <button
               onClick={() => navigate('/history')}
               className="mt-4 text-violet-400 hover:text-violet-300"
            >
               Go back to History
            </button>
         </div>
      );
   }

   const conversationTitle = currentConversation?.title || messages[0]?.content?.slice(0, 50) || 'Conversation';
   const conversationDate = currentConversation?.createdAt || currentConversation?.updatedAt || new Date().toISOString();

   return (
      <motion.div
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         className="max-w-4xl mx-auto h-[calc(100vh-6rem)] flex flex-col"
      >
         {/* Header */}
         <div className="flex items-center justify-between mb-6 shrink-0">
            <div className="flex items-center gap-4">
               <button
                  onClick={() => navigate('/history')}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
               >
                  <ArrowLeft size={20} />
               </button>
               <div>
                  <h1 className="text-xl font-bold text-white truncate max-w-md">{conversationTitle}</h1>
                  <p className="text-xs text-gray-400 flex items-center gap-2 mt-1">
                     <Calendar size={12} /> {formatRelativeTime(conversationDate)} • {messages.length} messages
                  </p>
               </div>
            </div>
            <div className="flex gap-3">
               <button
                  onClick={handleDownload}
                  className="p-2 text-gray-400 hover:text-white bg-surface/50 rounded-lg border border-white/5 transition-colors"
                  title="Download conversation"
               >
                  <Download size={18} />
               </button>
               <button
                  onClick={handleResume}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-500 transition-colors shadow-lg shadow-violet-900/20"
               >
                  <RotateCcw size={18} /> Resume Chat
               </button>
            </div>
         </div>

         {/* Transcript */}
         <div className="flex-1 bg-surface/30 backdrop-blur-sm border border-white/5 rounded-3xl overflow-hidden flex flex-col relative">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
               {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                     <MessageSquare className="h-12 w-12 text-gray-600 mb-4" />
                     <p className="text-gray-500">No messages in this conversation</p>
                  </div>
               ) : (
                  messages.map((msg) => (
                     <div
                        key={msg.id}
                        className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                     >
                        {msg.role === 'assistant' && (
                           <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center shrink-0 mt-1">
                              <Bot size={16} className="text-violet-400" />
                           </div>
                        )}

                        <div className={`px-5 py-3.5 rounded-2xl max-w-[80%] text-sm leading-relaxed ${msg.role === 'user'
                           ? 'bg-white/10 text-white rounded-tr-sm'
                           : 'text-gray-300 bg-transparent pl-0'
                           }`}>
                           {msg.role === 'user' ? (
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                           ) : (
                              <MarkdownRenderer content={msg.content} />
                           )}

                           {/* Sources indicator */}
                           {msg.role === 'assistant' && msg.sources && (msg.sources as Source[]).length > 0 && (
                              <p className="text-xs text-gray-500 mt-2">
                                 {(msg.sources as Source[]).length} source{(msg.sources as Source[]).length > 1 ? 's' : ''} referenced
                              </p>
                           )}
                        </div>

                        {msg.role === 'user' && (
                           <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-1">
                              <User size={16} className="text-gray-400" />
                           </div>
                        )}
                     </div>
                  ))
               )}
               <div className="h-10"></div>
            </div>

            <div className="p-4 bg-black/20 border-t border-white/5 text-center">
               <p className="text-xs text-gray-500">Click "Resume Chat" to continue this conversation.</p>
            </div>
         </div>
      </motion.div>
   );
};

export default HistoryDetail;