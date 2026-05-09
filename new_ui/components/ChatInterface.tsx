import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Send, Paperclip, Mic, Bot, User, Sparkles,
  MoreHorizontal, ChevronDown, X,
  Maximize2, Share, ThumbsUp, ThumbsDown, Copy,
  ArrowRight, Menu, Loader2, Edit
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../src/store/auth.store';
import { useBotStore } from '../src/store/bot.store';
import { useChatStore } from '../src/store/chat.store';
import { MarkdownRenderer, SourcesList, SuggestionChips, CollectionPicker, ConversationSidebar } from '../src/components/chat';
import CreateBotDialog from './bots/CreateBotDialog';
import type { Message, Source, CreateBotCommand } from '../types';

const SUGGESTIONS = [
  { title: "Analyze Financials", desc: "Review Q3 profit margins vs Q2" },
  { title: "Draft Legal Contract", desc: "Create a standard NDA for vendors" },
  { title: "Debug Code", desc: "Find memory leaks in React useEffect" },
  { title: "Summarize Docs", desc: "Key takeaways from uploaded PDFs" },
];

const ChatInterface: React.FC<{ minimal?: boolean }> = ({ minimal = false }) => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const {
    conversations,
    currentConversation,
    messages,
    isConversationLoading,
    areConversationsLoading,
    isSending,
    currentCollectionId,
    currentBotToken,
    fetchConversations,
    fetchConversation,
    sendMessage,
    deleteConversation,
    renameConversation,
    startNewConversation,
    setCollectionId,
    setBotToken,
  } = useChatStore();

  const { bots, fetchBots, updateBot, collections, fetchCollections } = useBotStore();

  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(!minimal);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showBotMenu, setShowBotMenu] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Derived state for active bot
  const activeBot = useMemo(() => 
    bots.find(b => b.bot_token === currentBotToken), 
    [bots, currentBotToken]
  );

  // Fetch conversations and bots on mount or when bot context changes
  useEffect(() => {
    if (!minimal) {
        fetchConversations();
        if (bots.length === 0) fetchBots();
    }
  }, [fetchConversations, fetchBots, bots.length, currentBotToken, minimal]);

  // Fetch collections for edit dialog if bot is active
  useEffect(() => {
    if (activeBot && collections.length === 0) {
      fetchCollections();
    }
  }, [activeBot, collections.length, fetchCollections]);

  // Handle URL params for conversation or bot
  useEffect(() => {
    if (minimal) return; // Skip URL logic in minimal mode

    const botParam = searchParams.get('bot');
    const isNew = searchParams.get('new');

    if (conversationId) {
      fetchConversation(conversationId);
    } else if (isNew) {
       // Force new conversation
       startNewConversation(null, botParam);
       // Remove 'new' param to prevent loops
       const newParams = new URLSearchParams(searchParams);
       newParams.delete('new');
       navigate(`/chat?${newParams.toString()}`, { replace: true });
    } else if (botParam && botParam !== currentBotToken) {
      // Switch bot context if different
      startNewConversation(null, botParam);
    } else if (!conversationId && !botParam && !currentBotToken && messages.length === 0) {
      // Default new conversation if nothing specified
      startNewConversation(null);
    }
  }, [conversationId, searchParams, currentBotToken, fetchConversation, startNewConversation, messages.length, minimal, navigate]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isSending) return;

    const query = text.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    await sendMessage(query);
  };

  const handleSelectConversation = useCallback((id: string) => {
    // Fetch conversation directly without waiting for URL change effect
    fetchConversation(id);
    // Update URL without causing full navigation  
    if (!minimal) navigate(`/chat/${id}`, { replace: true });
    setMobileSidebarOpen(false);
  }, [fetchConversation, navigate, minimal]);

  const handleNewChat = useCallback(() => {
    startNewConversation(currentCollectionId, currentBotToken); // Preserve context in minimal mode
    if (!minimal) navigate('/chat', { replace: true });
    setMobileSidebarOpen(false);
  }, [startNewConversation, navigate, minimal, currentCollectionId, currentBotToken]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    await deleteConversation(id);
    if (!minimal && conversationId === id) {
      navigate('/chat');
    }
  }, [deleteConversation, conversationId, navigate, minimal]);

  const handleSuggestionClick = async (suggestion: string) => {
    if (isSending) return;
    await sendMessage(suggestion);
  };

  const handleCopyMessage = async (content: string) => {
    await navigator.clipboard.writeText(content);
  };

  const handleBotSelect = (botToken: string | null) => {
    setShowBotMenu(false);
    if (botToken !== currentBotToken) {
        startNewConversation(null, botToken);
        // Clean URL
        if (!minimal) navigate('/chat', { replace: true });
    }
  };

  const handleUpdateBot = async (data: CreateBotCommand, iconFile?: File) => {
    if (activeBot && activeBot.bot_token) {
      await updateBot({ ...data, bot_token: activeBot.bot_token }, iconFile);
      await fetchBots(); // Refresh bots list to get updated info
    }
  };

  return (
    <div className={`flex h-full gap-0 relative overflow-hidden ${minimal ? 'bg-transparent' : 'rounded-2xl bg-surface/30 border border-white/5 shadow-2xl backdrop-blur-sm h-[calc(100vh-6rem)]'}`}>

      {/* Desktop History Sidebar - Hide in minimal mode */}
      <AnimatePresence mode="wait">
        {!minimal && sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="hidden lg:flex flex-col border-r border-white/5"
          >
            <ConversationSidebar
              conversations={conversations}
              currentId={conversationId}
              onSelect={handleSelectConversation}
              onNew={handleNewChat}
              onDelete={handleDeleteConversation}
              onRename={renameConversation}
              isLoading={areConversationsLoading}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Overlay - Hide in minimal mode */}
      <AnimatePresence>
        {!minimal && mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              className="fixed left-0 top-0 h-full w-72 z-50 lg:hidden"
            >
              <ConversationSidebar
                conversations={conversations}
                currentId={conversationId}
                onSelect={handleSelectConversation}
                onNew={handleNewChat}
                onDelete={handleDeleteConversation}
                onRename={renameConversation}
                isLoading={areConversationsLoading}
                onClose={() => setMobileSidebarOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative min-w-0">

        {/* Header - Hide in minimal mode */}
        {!minimal && (
        <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 lg:px-6 bg-surface/20 backdrop-blur-md z-10">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
            >
              <Menu size={20} />
            </button>

            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="hidden lg:block mr-2 text-gray-400 hover:text-white">
                <MoreHorizontal size={20} />
              </button>
            )}

            <div className="relative">
                <button 
                    onClick={() => setShowBotMenu(!showBotMenu)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group"
                >
                    {activeBot ? (
                        <>
                            <div className="w-6 h-6 rounded-md bg-gray-800 border border-white/10 overflow-hidden shrink-0">
                                <img src={activeBot.icon || 'https://picsum.photos/200'} alt={activeBot.name} className="w-full h-full object-cover" />
                            </div>
                            <span className="font-semibold text-gray-200 truncate max-w-[120px] sm:max-w-none">{activeBot.name}</span>
                        </>
                    ) : (
                        <>
                            <span className="font-semibold text-gray-200">Geralt AI</span>
                        </>
                    )}
                    <span className="text-gray-500 group-hover:text-gray-300"><ChevronDown size={14} /></span>
                </button>

                {showBotMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowBotMenu(false)} />
                        <div className="absolute top-full left-0 mt-2 w-64 bg-[#18181b] border border-white/10 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                            <button
                                onClick={() => handleBotSelect(null)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/5 transition-colors ${!activeBot ? 'bg-white/5' : ''}`}
                            >
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
                                    <Bot size={16} className="text-white" />
                                </div>
                                <div className="text-left">
                                    <div className="font-medium text-white">Geralt AI</div>
                                    <div className="text-xs text-gray-500">Default Assistant</div>
                                </div>
                                {!activeBot && <div className="ml-auto text-violet-400">●</div>}
                            </button>

                            {bots.length > 0 && <div className="h-[1px] bg-white/5 my-1" />}

                            {bots.map((bot) => (
                                <button
                                    key={bot.id}
                                    onClick={() => handleBotSelect(bot.bot_token || null)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/5 transition-colors ${activeBot?.id === bot.id ? 'bg-white/5' : ''}`}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-gray-800 border border-white/10 overflow-hidden shrink-0">
                                        <img src={bot.icon || 'https://picsum.photos/200'} alt={bot.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="text-left flex-1 min-w-0">
                                        <div className="font-medium text-white truncate">{bot.name}</div>
                                        <div className="text-xs text-gray-500 truncate">{bot.description}</div>
                                    </div>
                                    {activeBot?.id === bot.id && <div className="ml-auto text-violet-400">●</div>}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <div className="h-4 w-[1px] bg-white/10 mx-1 hidden sm:block" />

            {activeBot && (
                <button 
                  onClick={() => setIsEditDialogOpen(true)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-md transition-all border border-violet-500/20"
                >
                    <Edit size={12} />
                    <span>Edit Agent</span>
                </button>
            )}

            {!activeBot && (
                <div className="hidden sm:flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                    <Sparkles size={12} />
                    <span>RAG Enabled</span>
                </div>
            )}

            {/* Collection Picker (Only show if no bot is selected, or let user override) */}
            {!activeBot && (
              <div className="hidden md:block">
                <CollectionPicker
                  selectedId={currentCollectionId}
                  onSelect={setCollectionId}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <IconButton icon={Share} />
            <IconButton icon={Maximize2} />
            {sidebarOpen && (
              <button onClick={() => setSidebarOpen(false)} className="hidden lg:block p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg">
                <X size={18} />
              </button>
            )}
          </div>
        </div>
        )}

        {/* Messages Content */}
        <div className="flex-1 overflow-y-auto scroll-smooth scrollbar-hide">
          {isConversationLoading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="animate-spin text-violet-500" size={32} />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">

              {/* Empty State */}
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center min-h-[60vh]"
                >
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center mb-6 shadow-2xl shadow-violet-500/20 overflow-hidden">
                    {activeBot ? (
                        <img src={activeBot.icon || 'https://picsum.photos/200'} alt="Bot" className="w-full h-full object-cover" />
                    ) : (
                        <Bot className="text-white" size={40} />
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {activeBot ? `How can ${activeBot.name} help you?` : "How can I help you today?"}
                  </h2>
                  <p className="text-gray-400 mb-10 text-center max-w-md">
                    {activeBot 
                        ? activeBot.description || "I'm ready to assist you." 
                        : "I can analyze documents, write code, or help you plan your next project."
                    }
                    {currentCollectionId && " I'm searching within your selected collection."}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                    {SUGGESTIONS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(s.title + " " + s.desc)}
                        className="text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-violet-500/50 transition-all group"
                      >
                        <span className="block font-medium text-gray-200 mb-1 group-hover:text-violet-300">{s.title}</span>
                        <span className="block text-sm text-gray-500">{s.desc}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Message List */}
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  user={user}
                  onCopy={handleCopyMessage}
                  onSuggestionClick={handleSuggestionClick}
                  isSending={isSending}
                />
              ))}

              {/* Typing Indicator */}
              {messages.some(m => m.isLoading) && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-900/20">
                    <Sparkles size={16} className="text-white animate-pulse" />
                  </div>
                  <div className="flex items-center gap-1 h-8">
                    <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce delay-100"></span>
                    <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce delay-200"></span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-gradient-to-t from-background via-background to-transparent pb-6">
          <div className="max-w-3xl mx-auto relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl opacity-20 group-focus-within:opacity-50 blur transition duration-500"></div>
            <div className="relative bg-[#121215] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={activeBot ? `Message ${activeBot.name}...` : "Ask anything..."}
                className="bg-transparent border-none text-gray-200 placeholder-gray-500 text-[15px] p-4 w-full resize-none focus:ring-0 focus:outline-none max-h-48 min-h-[56px] scrollbar-hide"
                rows={1}
                disabled={isSending}
              />
              <div className="flex justify-between items-center px-3 pb-3 pt-1">
                <div className="flex gap-1">
                  <TooltipBtn icon={Paperclip} tooltip="Attach" />
                  <TooltipBtn icon={Mic} tooltip="Voice Mode" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-600 hidden sm:block">Enter to send</span>
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isSending}
                    className={`p-2 rounded-lg transition-all duration-200 ${input.trim() && !isSending
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20 hover:bg-violet-500'
                      : 'bg-white/5 text-gray-500 cursor-not-allowed'
                      }`}
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center mt-3">
            <p className="text-[10px] text-gray-500">Geralt AI can make mistakes. Verify important information.</p>
          </div>
        </div>
      </div>

      <CreateBotDialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSubmit={handleUpdateBot}
        bot={activeBot}
        collections={collections}
      />
    </div>
  );
};

// Message Bubble Component
interface MessageBubbleProps {
  message: Message;
  user: any;
  onCopy: (content: string) => void;
  onSuggestionClick: (suggestion: string) => void;
  isSending: boolean;
}

function MessageBubble({ message, user, onCopy, onSuggestionClick, isSending }: MessageBubbleProps) {
  if (message.isLoading) return null;

  const isUser = message.role === 'user';
  const sources = message.sources as Source[] | undefined;
  const suggestions = message.suggestions;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* AI Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 mt-1 shadow-lg shadow-violet-900/20">
          <Bot size={16} className="text-white" />
        </div>
      )}

      <div className={`flex flex-col max-w-[85%] lg:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`relative px-5 py-3.5 text-[15px] leading-relaxed ${isUser
          ? 'bg-surface border border-white/10 text-gray-100 rounded-2xl rounded-tr-sm'
          : 'text-gray-300 pl-0'
          }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>

        {/* Sources / Metadata for AI */}
        {!isUser && (
          <div className="mt-3 flex flex-col gap-3 animate-fade-in w-full">
            {/* Sources */}
            {sources && sources.length > 0 && (
              <SourcesList sources={sources} />
            )}

            {/* Suggestions */}
            {suggestions && suggestions.length > 0 && (
              <SuggestionChips
                suggestions={suggestions}
                onSelect={onSuggestionClick}
                disabled={isSending}
              />
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <ActionIcon icon={Copy} onClick={() => onCopy(message.content)} />
              <ActionIcon icon={ThumbsUp} onClick={() => { }} />
              <ActionIcon icon={ThumbsDown} onClick={() => { }} />
            </div>
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-surface border border-white/10 flex items-center justify-center shrink-0 mt-1 overflow-hidden">
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <User size={16} className="text-gray-400" />
          )}
        </div>
      )}
    </motion.div>
  );
}

const IconButton = ({ icon: Icon }: { icon: any }) => (
  <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
    <Icon size={18} />
  </button>
);

const ActionIcon = ({ icon: Icon, onClick }: { icon: any; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-md transition-colors"
  >
    <Icon size={14} />
  </button>
);

const TooltipBtn = ({ icon: Icon, tooltip }: { icon: any; tooltip: string }) => (
  <button className="group relative p-2 text-gray-400 hover:text-violet-400 hover:bg-white/5 rounded-lg transition-colors">
    <Icon size={18} />
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
      {tooltip}
    </span>
  </button>
);

export default ChatInterface;
