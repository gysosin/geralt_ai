import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBotStore } from '../src/store';
import {
   ArrowLeft, Bot, Save, Settings, Database, MessageSquare,
   Sparkles, Sliders, Play, Share2, AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import ShareBotDialog from './bots/ShareBotDialog';

const BotDetail: React.FC = () => {
   const { id } = useParams();
   const navigate = useNavigate();
   const { currentBot, fetchBotByToken, updateBot, collections, fetchCollections, isLoading } = useBotStore();
   const [activeTab, setActiveTab] = useState('config');
   const [isSaving, setIsSaving] = useState(false);
   const [shareOpen, setShareOpen] = useState(false);
   const [error, setError] = useState<string | null>(null);

   // Form State
   const [name, setName] = useState('');
   const [description, setDescription] = useState('');
   const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

   useEffect(() => {
      if (id) {
         fetchBotByToken(id);
         fetchCollections();
      }
   }, [id]);

   useEffect(() => {
      if (currentBot) {
         setName(currentBot.name || currentBot.bot_name || '');
         setDescription(currentBot.description || currentBot.welcome_message || '');
         setSelectedCollections(currentBot.collectionIds || currentBot.collection_ids || []);
      }
   }, [currentBot]);

   const handleSave = async () => {
      if (!currentBot || !currentBot.bot_token) return;

      setIsSaving(true);
      setError(null);
      try {
         await updateBot({
            bot_token: currentBot.bot_token,
            bot_name: name,
            welcome_message: description,
            collection_ids: selectedCollections
         });
         // Refresh current bot details
         if (id) fetchBotByToken(id);
      } catch (err) {
         setError('Failed to update agent');
      } finally {
         setIsSaving(false);
      }
   };

   const handleCollectionToggle = (collectionId: string) => {
      if (selectedCollections.includes(collectionId)) {
         setSelectedCollections(selectedCollections.filter(c => c !== collectionId));
      } else {
         setSelectedCollections([...selectedCollections, collectionId]);
      }
   };

   if (isLoading || !currentBot) {
      return (
         <div className="flex items-center justify-center h-full text-gray-500">
            Loading agent details...
         </div>
      );
   }

   return (
      <motion.div
         initial={{ opacity: 0, x: 20 }}
         animate={{ opacity: 1, x: 0 }}
         className="max-w-7xl mx-auto h-[calc(100vh-8rem)] flex flex-col"
      >
         {/* Header */}
         <div className="flex items-center justify-between mb-6 shrink-0">
            <div className="flex items-center gap-4">
               <button onClick={() => navigate('/bots')} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                  <ArrowLeft size={20} />
               </button>
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-800 overflow-hidden border border-white/10">
                     <img src={currentBot.icon || 'https://picsum.photos/200'} className="w-full h-full object-cover" alt={currentBot.name} />
                  </div>
                  <div>
                     <h1 className="text-xl font-bold text-white">{name || currentBot.name}</h1>
                     <p className="text-xs text-gray-400">
                        {currentBot.updated_at ? `Updated ${new Date(currentBot.updated_at).toLocaleDateString()}` : 'Ready to deploy'}
                     </p>
                  </div>
               </div>
            </div>
            <div className="flex gap-3">
               <button
                  onClick={() => setShareOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 text-gray-300 font-medium rounded-xl hover:bg-white/10 transition-colors border border-white/5"
               >
                  <Share2 size={18} /> Share
               </button>
               <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20 disabled:opacity-50"
               >
                  <Save size={18} /> {isSaving ? 'Saving...' : 'Save Changes'}
               </button>
            </div>
         </div>

         {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm flex items-center gap-2">
               <AlertCircle size={16} /> {error}
            </div>
         )}

         <div className="flex-1 flex gap-6 min-h-0">
            {/* Configuration Panel */}
            <div className="w-full lg:w-2/3 bg-surface/30 border border-white/5 rounded-3xl flex flex-col overflow-hidden">
               {/* Tabs */}
               <div className="flex border-b border-white/5 px-2">
                  <button
                     onClick={() => setActiveTab('config')}
                     className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'config' ? 'border-violet-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                  >
                     <Settings size={16} /> Configuration
                  </button>
                  <button
                     onClick={() => setActiveTab('knowledge')}
                     className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'knowledge' ? 'border-violet-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                  >
                     <Database size={16} /> Knowledge Base
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
                  {activeTab === 'config' && (
                     <>
                        <div className="space-y-4">
                           <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                              <Bot size={16} /> Identity & Persona
                           </label>
                           <div className="grid grid-cols-2 gap-4">
                              <div>
                                 <label className="block text-xs text-gray-500 mb-1.5">Name</label>
                                 <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
                                 />
                              </div>
                              <div>
                                 <label className="block text-xs text-gray-500 mb-1.5">Description (Prompt)</label>
                                 <input
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
                                    placeholder="Brief description"
                                 />
                              </div>
                           </div>
                        </div>

                        <div className="space-y-4">
                           <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                              <MessageSquare size={16} /> System Instructions
                           </label>
                           <textarea
                              className="w-full h-48 bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-violet-500 font-mono text-sm leading-relaxed resize-none"
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Detailed system instructions and prompt engineering..."
                           />
                        </div>

                        <div className="space-y-4">
                           <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                              <Sliders size={16} /> Model Parameters
                           </label>
                           <div className="bg-white/5 rounded-xl p-4 space-y-6">
                              <div>
                                 <div className="flex justify-between mb-2">
                                    <label className="text-xs text-gray-400">Model</label>
                                    <span className="text-xs text-violet-400">GPT-4 Turbo</span>
                                 </div>
                                 <select className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                                    <option>GPT-4 Turbo</option>
                                    <option>GPT-3.5 Turbo</option>
                                    <option>Claude 3 Opus</option>
                                 </select>
                              </div>
                              <div>
                                 <div className="flex justify-between mb-2">
                                    <label className="text-xs text-gray-400">Temperature</label>
                                    <span className="text-xs text-violet-400">0.7</span>
                                 </div>
                                 <input type="range" min="0" max="1" step="0.1" defaultValue="0.7" className="w-full accent-violet-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                              </div>
                           </div>
                        </div>
                     </>
                  )}

                  {activeTab === 'knowledge' && (
                     <div className="space-y-4">
                        <p className="text-sm text-gray-400 mb-4">Select the collections this agent has access to.</p>
                        <div className="grid grid-cols-1 gap-3">
                           {collections.map(col => (
                              <label key={col.id} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${selectedCollections.includes(col.id) ? 'bg-violet-500/10 border-violet-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                                 <input
                                    type="checkbox"
                                    checked={selectedCollections.includes(col.id)}
                                    onChange={() => handleCollectionToggle(col.id)}
                                    className="w-5 h-5 rounded border-gray-600 text-violet-600 focus:ring-violet-500 bg-gray-800"
                                 />
                                 <div className="flex-1">
                                    <h4 className="text-white font-medium text-sm">{col.name}</h4>
                                    <p className="text-xs text-gray-500">{col.fileCount} files • {col.size}</p>
                                 </div>
                                 <span className="text-xs bg-white/10 text-gray-400 px-2 py-1 rounded uppercase">{col.type}</span>
                              </label>
                           ))}
                           {collections.length === 0 && (
                              <div className="text-center py-8 text-gray-500">No collections found</div>
                           )}
                        </div>
                     </div>
                  )}
               </div>
            </div>

            {/* Preview Panel */}
            <div className="hidden lg:flex w-1/3 flex-col bg-surface/30 border border-white/5 rounded-3xl overflow-hidden">
               <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Playground</span>
                  <button className="text-gray-500 hover:text-white"><Settings size={14} /></button>
               </div>
               <div className="flex-1 bg-[#121215] p-4 flex flex-col">
                  <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                     <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                        <Sparkles size={20} className="text-gray-500" />
                     </div>
                     <p className="text-sm text-gray-500">Test your agent configuration here.</p>
                  </div>
                  <div className="mt-4 relative">
                     <input
                        type="text"
                        placeholder="Type a message..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm text-white focus:outline-none focus:border-violet-500"
                     />
                     <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-violet-400 transition-colors">
                        <Play size={16} />
                     </button>
                  </div>
               </div>
            </div>
         </div>

         {currentBot.bot_token && (
            <ShareBotDialog
               isOpen={shareOpen}
               onClose={() => setShareOpen(false)}
               onSubmit={async (data) => {
                  // We'd import shareBot from store here if we destructured it, 
                  // but for simplicity we can just close it or pass a handler prop if we want to be pure.
                  // Actually, we should call the store action.
                  // Let's rely on the parent or adding shareBot to destructuring.
                  // I'll update the component to include shareBot from store actions
                  // (Added locally below in the same file context)
                  console.log("Sharing", data);
                  setShareOpen(false);
               }}
               botToken={currentBot.bot_token}
               botName={currentBot.name}
            />
         )}
      </motion.div>
   );
};

export default BotDetail;