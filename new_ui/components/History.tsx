import React, { useEffect, useState } from 'react';
import { Search, MessageSquare, ArrowRight, Archive, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../src/store';
import type { ConversationSummary } from '../types';

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

// Group conversations by date
function groupConversationsByDate(conversations: ConversationSummary[]) {
   const today = new Date();
   today.setHours(0, 0, 0, 0);
   const yesterday = new Date(today);
   yesterday.setDate(yesterday.getDate() - 1);
   const weekAgo = new Date(today);
   weekAgo.setDate(weekAgo.getDate() - 7);

   const groups: { label: string; items: ConversationSummary[] }[] = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'Previous 7 Days', items: [] },
      { label: 'Older', items: [] },
   ];

   conversations.forEach((conv) => {
      const date = new Date(conv.timestamp || conv.created_at || Date.now());
      date.setHours(0, 0, 0, 0);

      if (date >= today) {
         groups[0].items.push(conv);
      } else if (date >= yesterday) {
         groups[1].items.push(conv);
      } else if (date >= weekAgo) {
         groups[2].items.push(conv);
      } else {
         groups[3].items.push(conv);
      }
   });

   return groups.filter((g) => g.items.length > 0);
}

const HistoryItem = ({ chat, onDelete }: { chat: ConversationSummary; onDelete: (id: string) => void }) => {
   const navigate = useNavigate();

   return (
      <motion.div
         initial={{ opacity: 0, x: -10 }}
         animate={{ opacity: 1, x: 0 }}
         onClick={() => navigate(`/chat/${chat.id}`)}
         className="group flex gap-4 p-4 rounded-2xl hover:bg-white/[0.03] border-b border-white/5 last:border-0 transition-colors cursor-pointer"
      >
         <div className="mt-1">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 group-hover:bg-violet-600 group-hover:text-white transition-colors">
               <MessageSquare size={18} />
            </div>
         </div>

         <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-1">
               <h3 className="text-white font-medium truncate pr-4 group-hover:text-violet-300 transition-colors">
                  {chat.title || chat.first_message || 'New Conversation'}
               </h3>
               <span className="text-xs text-gray-500 whitespace-nowrap">
                  {formatRelativeTime(chat.timestamp || chat.created_at || new Date())}
               </span>
            </div>
            <p className="text-sm text-gray-400 truncate mb-2">
               {chat.lastMessage || chat.first_message || 'No messages'}
            </p>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button
                  className="p-1.5 text-gray-500 hover:text-white bg-white/5 rounded-md transition-colors"
                  title="Continue conversation"
                  onClick={(e) => { e.stopPropagation(); navigate(`/chat/${chat.id}`); }}
               >
                  <ExternalLink size={12} />
               </button>
               <button
                  className="p-1.5 text-gray-500 hover:text-red-400 bg-white/5 rounded-md transition-colors"
                  title="Delete"
                  onClick={(e) => {
                     e.stopPropagation();
                     onDelete(chat.id);
                  }}
               >
                  <Trash2 size={12} />
               </button>
            </div>
         </div>
      </motion.div>
   );
};

const History: React.FC = () => {
   const navigate = useNavigate();
   const { conversations, areConversationsLoading, fetchConversations, deleteConversation } = useChatStore();
   const [searchQuery, setSearchQuery] = useState('');

   useEffect(() => {
      fetchConversations();
   }, [fetchConversations]);

   const filteredConversations = searchQuery
      ? conversations.filter(c =>
         (c.title || c.first_message || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
         (c.lastMessage || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
      : conversations;

   const groupedConversations = groupConversationsByDate(filteredConversations);

   const handleDelete = async (id: string) => {
      await deleteConversation(id);
   };

   return (
      <div className="max-w-4xl mx-auto min-h-screen">
         <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">History</h1>
            <p className="text-gray-400">Review your past conversations and continue where you left off.</p>
         </div>

         <div className="bg-surface/30 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden flex flex-col h-[calc(100vh-12rem)]">
            {/* Toolbar */}
            <div className="p-4 border-b border-white/5 flex gap-4">
               <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input
                     type="text"
                     placeholder="Search conversations..."
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                  />
               </div>
               <button
                  onClick={() => navigate('/chat')}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-violet-500/20"
               >
                  New Chat
               </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
               {areConversationsLoading ? (
                  <div className="flex items-center justify-center py-12">
                     <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                  </div>
               ) : groupedConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                     <MessageSquare className="h-12 w-12 text-gray-600 mb-4" />
                     <h3 className="text-lg font-medium text-gray-300 mb-2">
                        {searchQuery ? 'No matching conversations' : 'No conversations yet'}
                     </h3>
                     <p className="text-gray-500 text-sm mb-4">
                        {searchQuery ? 'Try a different search term' : 'Start a new chat to begin'}
                     </p>
                     {!searchQuery && (
                        <button
                           onClick={() => navigate('/chat')}
                           className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                           Start a Conversation
                        </button>
                     )}
                  </div>
               ) : (
                  groupedConversations.map((group) => (
                     <div key={group.label}>
                        <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                           {group.label}
                        </div>
                        {group.items.map(chat => (
                           <HistoryItem key={chat.id} chat={chat} onDelete={handleDelete} />
                        ))}
                     </div>
                  ))
               )}
            </div>

            {conversations.length > 0 && (
               <div className="p-4 border-t border-white/5 bg-black/20 text-center">
                  <p className="text-xs text-gray-500">
                     {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} in total
                  </p>
               </div>
            )}
         </div>
      </div>
   );
};

export default History;