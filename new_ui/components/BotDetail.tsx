import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBotStore, useChatStore } from '../src/store';
import {
   ArrowLeft, Bot, Save, Settings, Database, MessageSquare,
   Sparkles, Sliders, Play, Share2, AlertCircle, BarChart2
} from 'lucide-react';
import { motion } from 'framer-motion';
import ShareBotDialog from './bots/ShareBotDialog';
import ChatInterface from './ChatInterface';

const BotDetail: React.FC = () => {
   const { id } = useParams();
   const navigate = useNavigate();
   const { 
      currentBot, fetchBotByToken, updateBot, shareBot, 
      collections, fetchCollections, isLoading,
      availableModels, fetchModels, analyticsData, fetchAnalytics
   } = useBotStore();
   const { startNewConversation } = useChatStore();
   
   const [activeTab, setActiveTab] = useState('config');
   const [isSaving, setIsSaving] = useState(false);
   const [shareOpen, setShareOpen] = useState(false);
   const [error, setError] = useState<string | null>(null);

   // Form State
   const [name, setName] = useState('');
   const [summary, setSummary] = useState('');
   const [prompt, setPrompt] = useState('');
   const [welcomeMessage, setWelcomeMessage] = useState('');
   const [welcomeButtons, setWelcomeButtons] = useState<{ label: string, action: string }[]>([]);
   const [iconFile, setIconFile] = useState<File | undefined>(undefined);
   const [iconPreview, setIconPreview] = useState<string | null>(null);
   const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
   const [selectedModel, setSelectedModel] = useState('');

   useEffect(() => {
      if (id) {
         fetchBotByToken(id);
         fetchCollections();
         fetchModels();
      }
   }, [id]);

   useEffect(() => {
      if (activeTab === 'analytics' && currentBot?.bot_token) {
         fetchAnalytics(currentBot.bot_token);
      }
   }, [activeTab, currentBot]);

   useEffect(() => {
      if (currentBot) {
         setName(currentBot.name || currentBot.bot_name || '');
         setSummary(currentBot.description || '');
         setPrompt((currentBot as any).prompt || ''); 
         setWelcomeMessage((currentBot as any).welcome_message || '');
         setWelcomeButtons((currentBot as any).welcome_buttons || []);
         setIconPreview(currentBot.icon || null);
         
         setSelectedCollections(currentBot.collectionIds || currentBot.collection_ids || []);
         
         if (availableModels.length > 0 && !selectedModel) {
             setSelectedModel(availableModels[0].id);
         }
         
         if (currentBot.bot_token) {
             startNewConversation(null, currentBot.bot_token);
         }
      }
   }, [currentBot, availableModels]);

   const handleSave = async () => {
      if (!currentBot || !currentBot.bot_token) return;

      setIsSaving(true);
      setError(null);
      try {
         await updateBot({
            bot_token: currentBot.bot_token,
            bot_name: name,
            description: summary,
            prompt: prompt,
            welcome_message: welcomeMessage,
            welcome_buttons: welcomeButtons,
            collection_ids: selectedCollections,
         }, iconFile);
         
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

   const handleAddButton = () => {
      setWelcomeButtons([...welcomeButtons, { label: '', action: '' }]);
   };

   const handleRemoveButton = (index: number) => {
      const newButtons = [...welcomeButtons];
      newButtons.splice(index, 1);
      setWelcomeButtons(newButtons);
   };

   const handleButtonChange = (index: number, field: 'label' | 'action', value: string) => {
      const newButtons = [...welcomeButtons];
      newButtons[index][field] = value;
      setWelcomeButtons(newButtons);
   };

   if (isLoading) {
      return (
         <div className="flex items-center justify-center h-full text-gray-500">
            <div className="flex flex-col items-center gap-2">
               <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
               <span className="text-sm">Loading agent details...</span>
            </div>
         </div>
      );
   }

   if (!currentBot) {
      return (
         <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
               <AlertCircle size={32} />
            </div>
            <h2 className="text-xl font-bold text-white">Agent Not Found</h2>
            <p className="text-gray-400 text-sm max-w-md text-center">
               The agent you are looking for does not exist or you do not have permission to view it.
            </p>
            <button
               onClick={() => navigate('/bots')}
               className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium mt-2"
            >
               Return to Agents
            </button>
         </div>
      );
   }

   return (
      <motion.div
         initial={{ opacity: 0, x: 20 }}
         animate={{ opacity: 1, x: 0 }}
         className="max-w-[1600px] mx-auto h-[calc(100vh-6rem)] flex flex-col gap-4 px-4"
      >
         {/* Header */}
         <div className="flex items-center justify-between shrink-0 bg-surface/30 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
            <div className="flex items-center gap-4">
               <button onClick={() => navigate('/bots')} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                  <ArrowLeft size={20} />
               </button>
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-800 overflow-hidden border border-white/10">
                     <img src={currentBot.icon || 'https://picsum.photos/200'} className="w-full h-full object-cover" alt={currentBot.name} />
                  </div>
                  <div>
                     <h1 className="text-lg font-bold text-white">{name || currentBot.name}</h1>
                     <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Bot size={10} /> {currentBot.bot_token?.substring(0, 8)}...</span>
                        <span>•</span>
                        <span>Updated {currentBot.updated_at ? new Date(currentBot.updated_at).toLocaleDateString() : 'Just now'}</span>
                     </div>
                  </div>
               </div>
            </div>
            <div className="flex gap-2">
               <button
                  onClick={() => setShareOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 text-gray-300 font-medium rounded-xl hover:bg-white/10 transition-colors border border-white/5 text-sm"
               >
                  <Share2 size={16} /> Share
               </button>
               <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20 disabled:opacity-50 text-sm"
               >
                  <Save size={16} /> {isSaving ? 'Saving...' : 'Save Changes'}
               </button>
            </div>
         </div>

         {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm flex items-center gap-2">
               <AlertCircle size={16} /> {error}
            </div>
         )}

         <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
            {/* Configuration Panel (Left) */}
            <div className="w-full lg:w-1/2 xl:w-2/5 bg-surface/30 border border-white/5 rounded-2xl flex flex-col overflow-hidden backdrop-blur-md">
               <div className="flex border-b border-white/5 px-2">
                  <button
                     onClick={() => setActiveTab('config')}
                     className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'config' ? 'border-violet-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                  >
                     <Settings size={14} /> Configuration
                  </button>
                  <button
                     onClick={() => setActiveTab('knowledge')}
                     className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'knowledge' ? 'border-violet-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                  >
                     <Database size={14} /> Knowledge
                  </button>
                  <button
                     onClick={() => setActiveTab('analytics')}
                     className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'analytics' ? 'border-violet-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                  >
                     <BarChart2 size={14} /> Analytics
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                  {activeTab === 'config' && (
                     <>
                        <div className="space-y-3">
                           <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Identity</label>
                           <div className="flex gap-4">
                              <div className="shrink-0">
                                 <label className="block text-xs text-gray-500 mb-1.5">Icon</label>
                                 <div className="relative w-20 h-20 rounded-xl bg-[#18181b] border border-white/10 overflow-hidden cursor-pointer group hover:border-violet-500/50 transition-colors">
                                    <input 
                                       type="file" 
                                       className="absolute inset-0 opacity-0 z-10 cursor-pointer"
                                       accept="image/*"
                                       onChange={(e) => {
                                          if (e.target.files?.[0]) {
                                             setIconFile(e.target.files[0]);
                                             setIconPreview(URL.createObjectURL(e.target.files[0]));
                                          }
                                       }}
                                    />
                                    {iconPreview ? (
                                       <img src={iconPreview} className="w-full h-full object-cover" alt="Icon" />
                                    ) : (
                                       <div className="w-full h-full flex items-center justify-center text-gray-600">
                                          <Bot size={24} />
                                       </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                       <span className="text-[10px] text-white">Change</span>
                                    </div>
                                 </div>
                              </div>
                              <div className="space-y-3 flex-1">
                                 <div>
                                    <label className="block text-xs text-gray-500 mb-1.5">Agent Name</label>
                                    <input
                                       type="text"
                                       value={name}
                                       onChange={(e) => setName(e.target.value)}
                                       className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors text-sm"
                                       placeholder="e.g. Financial Analyst"
                                    />
                                 </div>
                                 <div>
                                    <label className="block text-xs text-gray-500 mb-1.5">Description (Summary)</label>
                                    <input
                                       type="text"
                                       value={summary} 
                                       onChange={(e) => setSummary(e.target.value)}
                                       className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors text-sm"
                                       placeholder="Short description of what this agent does..."
                                    />
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="space-y-3">
                           <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Behavior</label>
                           <div>
                              <label className="block text-xs text-gray-500 mb-1.5">System Instructions (Prompt)</label>
                              <textarea
                                 className="w-full h-64 bg-[#18181b] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-violet-500 font-mono text-sm leading-relaxed resize-none"
                                 value={prompt}
                                 onChange={(e) => setPrompt(e.target.value)}
                                 placeholder="Define how the agent should behave, answer, and think..."
                              />
                              <p className="text-[10px] text-gray-500 mt-1">Use specific instructions to control tone and output format.</p>
                           </div>
                        </div>

                        <div className="space-y-3">
                           <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Interaction</label>
                           <div>
                              <label className="block text-xs text-gray-500 mb-1.5">Welcome Message</label>
                              <textarea
                                 className="w-full h-24 bg-[#18181b] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-violet-500 text-sm resize-none"
                                 value={welcomeMessage}
                                 onChange={(e) => setWelcomeMessage(e.target.value)}
                                 placeholder="Hi! How can I help you today?"
                              />
                           </div>
                           <div>
                              <div className="flex justify-between items-center mb-2">
                                 <label className="text-xs text-gray-500">Welcome Buttons</label>
                                 <button
                                    type="button"
                                    onClick={handleAddButton}
                                    className="text-[10px] flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors"
                                 >
                                    <Plus size={12} /> Add Button
                                 </button>
                              </div>
                              <div className="space-y-2">
                                 {welcomeButtons.map((btn, idx) => (
                                    <div key={idx} className="flex gap-2">
                                       <input
                                          type="text"
                                          value={btn.label}
                                          onChange={(e) => handleButtonChange(idx, 'label', e.target.value)}
                                          placeholder="Label"
                                          className="flex-1 bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                                       />
                                       <input
                                          type="text"
                                          value={btn.action}
                                          onChange={(e) => handleButtonChange(idx, 'action', e.target.value)}
                                          placeholder="Query to send"
                                          className="flex-[2] bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                                       />
                                       <button
                                          type="button"
                                          onClick={() => handleRemoveButton(idx)}
                                          className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                       >
                                          <Trash2 size={14} />
                                       </button>
                                    </div>
                                 ))}
                                 {welcomeButtons.length === 0 && (
                                    <div className="text-center py-4 border border-dashed border-white/10 rounded-lg text-gray-600 text-xs">
                                       No welcome buttons configured
                                    </div>
                                 )}
                              </div>
                           </div>
                        </div>

                        <div className="space-y-3">
                           <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Model Config</label>
                           <div className="bg-[#18181b] rounded-lg p-4 space-y-4 border border-white/5">
                              <div>
                                 <div className="flex justify-between mb-2">
                                    <label className="text-xs text-gray-400">Model</label>
                                    <span className="text-xs text-violet-400 font-mono">{selectedModel}</span>
                                 </div>
                                 <select 
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-white text-xs focus:outline-none"
                                 >
                                    {availableModels.map(model => (
                                        <option key={model.id} value={model.id}>{model.name} ({model.provider})</option>
                                    ))}
                                 </select>
                              </div>
                              <div>
                                 <div className="flex justify-between mb-2">
                                    <label className="text-xs text-gray-400">Temperature</label>
                                    <span className="text-xs text-violet-400 font-mono">0.7</span>
                                 </div>
                                 <input type="range" min="0" max="1" step="0.1" defaultValue="0.7" className="w-full accent-violet-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                              </div>
                           </div>
                        </div>
                     </>
                  )}

                  {activeTab === 'knowledge' && (
                     <div className="space-y-4">
                        <p className="text-sm text-gray-400">Select collections to ground this agent's responses.</p>
                        <div className="space-y-2">
                           {collections.map(col => (
                              <label key={col.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedCollections.includes(col.id) ? 'bg-violet-500/10 border-violet-500/50' : 'bg-[#18181b] border-white/5 hover:border-white/20'}`}>
                                 <input
                                    type="checkbox"
                                    checked={selectedCollections.includes(col.id)}
                                    onChange={() => handleCollectionToggle(col.id)}
                                    className="w-4 h-4 rounded border-gray-600 text-violet-600 focus:ring-violet-500 bg-gray-800"
                                 />
                                 <div className="flex-1 min-w-0">
                                    <h4 className="text-white font-medium text-sm truncate">{col.name}</h4>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                       <span>{col.fileCount} files</span>
                                       <span>•</span>
                                       <span>{col.size}</span>
                                    </div>
                                 </div>
                                 <span className="text-[10px] bg-white/10 text-gray-400 px-1.5 py-0.5 rounded uppercase">{col.type}</span>
                              </label>
                           ))}
                           {collections.length === 0 && (
                              <div className="text-center py-8 text-gray-500 bg-[#18181b] rounded-lg border border-dashed border-white/10">
                                 No collections available. Create one in the Knowledge base.
                              </div>
                           )}
                        </div>
                     </div>
                  )}

                  {activeTab === 'analytics' && (
                     <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                           <div className="bg-[#18181b] p-4 rounded-lg border border-white/5">
                              <span className="text-xs text-gray-500 uppercase">Total Chats</span>
                              <div className="text-2xl font-bold text-white mt-1">
                                  {analyticsData?.unique_users_count || currentBot.stats?.chats || 0}
                              </div>
                           </div>
                           <div className="bg-[#18181b] p-4 rounded-lg border border-white/5">
                              <span className="text-xs text-gray-500 uppercase">Total Tokens</span>
                              <div className="text-2xl font-bold text-white mt-1">
                                  {analyticsData?.total_tokens?.toLocaleString() || 0}
                              </div>
                           </div>
                           <div className="bg-[#18181b] p-4 rounded-lg border border-white/5 col-span-2">
                              <span className="text-xs text-gray-500 uppercase">Est. Cost</span>
                              <div className="text-2xl font-bold text-emerald-400 mt-1">
                                  ${analyticsData?.estimated_cost || '0.00'}
                              </div>
                           </div>
                        </div>
                        {analyticsData?.cost_by_model && Object.keys(analyticsData.cost_by_model).length > 0 && (
                            <div className="bg-[#18181b] p-4 rounded-lg border border-white/5">
                                <span className="text-xs text-gray-500 uppercase block mb-3">Cost Breakdown</span>
                                <div className="space-y-2">
                                    {Object.entries(analyticsData.cost_by_model).map(([model, stats]: [string, any]) => (
                                        <div key={model} className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">{model}</span>
                                            <span className="text-gray-500">${stats.cost}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                     </div>
                  )}
               </div>
            </div>

            {/* Preview Panel (Right) - The Playground */}
            <div className="hidden lg:flex w-1/2 xl:w-3/5 flex-col bg-[#121215] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
               <div className="absolute top-4 right-4 z-10 bg-black/50 backdrop-blur text-xs px-2 py-1 rounded border border-white/10 text-gray-400 pointer-events-none">
                  Preview Mode
               </div>
               <div className="flex-1 h-full">
                  <ChatInterface minimal={true} />
               </div>
            </div>
         </div>

         {currentBot.bot_token && (
            <ShareBotDialog
               isOpen={shareOpen}
               onClose={() => setShareOpen(false)}
               onSubmit={async (data) => {
                  try {
                     await shareBot(data);
                     setShareOpen(false);
                  } catch (err) {
                     setError('Failed to share bot');
                  }
               }}
               botToken={currentBot.bot_token}
               botName={currentBot.name}
            />
         )}
      </motion.div>
   );
};

export default BotDetail;