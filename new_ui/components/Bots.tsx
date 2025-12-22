import React, { useEffect, useState } from 'react';
import { Plus, MessageSquare, Share2, MoreVertical, Zap, Trash2, Code } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBotStore } from '../src/store';
import { Bot, CreateBotCommand, ShareBotCommand } from '../types';
import CreateBotDialog from './bots/CreateBotDialog';
import ShareBotDialog from './bots/ShareBotDialog';
import EmbedCodeDialog from './bots/EmbedCodeDialog';

const BotCard = ({
  bot,
  onEdit,
  onDelete,
  onShare,
  onEmbed
}: {
  bot: Bot;
  onEdit: (bot: Bot) => void;
  onDelete: (bot: Bot) => void;
  onShare: (bot: Bot) => void;
  onEmbed: (bot: Bot) => void;
}) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      onClick={() => navigate(`/bots/${bot.id}`)}
      className="bg-surface/40 border border-white/5 rounded-2xl p-6 hover:border-violet-500/30 transition-all group relative overflow-visible flex flex-col h-full cursor-pointer hover:bg-white/[0.03]"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-800 border border-white/10">
          <img src={bot.icon || 'https://picsum.photos/200'} alt={bot.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="relative">
          <button
            className="text-gray-500 hover:text-white transition-colors p-1"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          >
            <MoreVertical size={18} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 w-48 bg-[#18181b] border border-white/10 rounded-xl shadow-xl z-50 py-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { setShowMenu(false); onShare(bot); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white"
              >
                <Share2 size={16} /> Share
              </button>
              <button
                onClick={() => { setShowMenu(false); onEmbed(bot); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white"
              >
                <Code size={16} /> Embed Code
              </button>
              <button
                onClick={() => { setShowMenu(false); onDelete(bot); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
          )}
          {showMenu && (
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
          )}
        </div>
      </div>

      <h3 className="text-lg font-bold text-white mb-2 relative z-10 group-hover:text-violet-300 transition-colors">{bot.name}</h3>
      <p className="text-sm text-gray-400 mb-6 flex-1 relative z-10 line-clamp-2">{bot.description}</p>

      <div className="flex items-center gap-4 text-xs text-gray-500 mb-6 relative z-10">
        <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded">
          <MessageSquare size={12} /> {bot.stats?.chats || 0} chats
        </span>
        <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded">
          <Zap size={12} /> {bot.collectionIds?.length || 0} KB
        </span>
      </div>

      <div className="flex gap-2 relative z-10 mt-auto">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(bot); }}
          className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg border border-white/5 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/chat?bot=${bot.bot_token}`); }}
          className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-violet-900/20 transition-all"
        >
          Chat
        </button>
      </div>
    </div>
  );
};

const Bots: React.FC = () => {
  const {
    bots,
    isLoading,
    fetchBots,
    createBot,
    updateBot,
    deleteBot,
    shareBot,
    generateEmbedCode,
    collections,
    fetchCollections
  } = useBotStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [selectedBot, setSelectedBot] = useState<Bot | undefined>();
  const [embedCode, setEmbedCode] = useState('');

  useEffect(() => {
    fetchBots();
    fetchCollections();
  }, []);

  const handleCreate = () => {
    setSelectedBot(undefined);
    setCreateOpen(true);
  };

  const handleEdit = (bot: Bot) => {
    setSelectedBot(bot);
    setCreateOpen(true);
  };

  const handleDelete = async (bot: Bot) => {
    if (confirm(`Are you sure you want to delete ${bot.name}?`)) {
      if (bot.bot_token) {
        await deleteBot(bot.bot_token);
      }
    }
  };

  const handleShare = (bot: Bot) => {
    setSelectedBot(bot);
    setShareOpen(true);
  };

  const handleEmbed = async (bot: Bot) => {
    if (bot.bot_token) {
      const code = await generateEmbedCode(bot.bot_token);
      setEmbedCode(code);
      setSelectedBot(bot);
      setEmbedOpen(true);
    }
  };

  const handleSubmitBot = async (data: CreateBotCommand, iconFile?: File) => {
    if (selectedBot && selectedBot.bot_token) {
      await updateBot({ ...data, bot_token: selectedBot.bot_token }, iconFile);
    } else {
      await createBot(data, iconFile);
    }
    await fetchBots();
  };

  const handleShareSubmit = async (data: ShareBotCommand) => {
    await shareBot(data);
  };

  if (isLoading && bots.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading agents...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">AI Agents</h1>
          <p className="text-gray-400">Manage your custom GPTs and deployment configurations.</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 transition-colors"
        >
          <Plus size={18} />
          Create Agent
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {bots.map((bot) => (
          <BotCard
            key={bot.id}
            bot={bot}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onShare={handleShare}
            onEmbed={handleEmbed}
          />
        ))}

        {/* Create New Card Placeholder */}
        <button
          onClick={handleCreate}
          className="border border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 text-gray-500 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all h-full min-h-[300px]"
        >
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
            <Plus size={24} />
          </div>
          <span className="font-medium">Create New Agent</span>
        </button>
      </div>

      <CreateBotDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleSubmitBot}
        bot={selectedBot}
        collections={collections}
      />

      {selectedBot && selectedBot.bot_token && (
        <ShareBotDialog
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          onSubmit={handleShareSubmit}
          botToken={selectedBot.bot_token}
          botName={selectedBot.name}
        />
      )}

      {selectedBot && (
        <EmbedCodeDialog
          isOpen={embedOpen}
          onClose={() => setEmbedOpen(false)}
          embedCode={embedCode}
          botName={selectedBot.name}
        />
      )}
    </div>
  );
};

export default Bots;