import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Bell, Search, LogOut, ChevronLeft, Plus, Command, MessageSquare, Bot, Files, PieChart, History, Settings, Workflow, BarChart3, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MENU_ITEMS, APP_NAME } from '../constants';
import CommandPalette, { type CommandPaletteItem } from '../src/components/CommandPalette';
import { NotificationPanel } from '../src/components/NotificationPanel';
import { useNotificationStore } from '../src/store';

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadCount, fetchUnreadCount } = useNotificationStore();

  const commandItems = useMemo<CommandPaletteItem[]>(() => [
    {
      id: 'dashboard',
      label: 'Open dashboard',
      description: 'Review KPIs, usage, activity, and workspace health.',
      group: 'Navigation',
      path: '/',
      icon: <BarChart3 size={18} />,
      keywords: ['home', 'overview', 'metrics'],
    },
    {
      id: 'global-search',
      label: 'Open global search',
      description: 'Search chats, agents, and knowledge collections.',
      group: 'Navigation',
      path: '/search',
      icon: <Search size={18} />,
      keywords: ['search', 'find', 'global', 'workspace'],
    },
    {
      id: 'new-chat',
      label: 'Start new chat',
      description: 'Ask questions against your document collections.',
      group: 'RAG and Chat',
      path: '/chat',
      icon: <MessageSquare size={18} />,
      keywords: ['conversation', 'assistant', 'rag', 'ask'],
    },
    {
      id: 'agents',
      label: 'Manage agents',
      description: 'Create, deploy, and tune AI bots.',
      group: 'Agents',
      path: '/bots',
      icon: <Bot size={18} />,
      keywords: ['bots', 'assistants', 'deploy'],
    },
    {
      id: 'agent-platform',
      label: 'Open agent platform',
      description: 'Build tools, MCP servers, workflows, and agent runs.',
      group: 'AI Automation',
      path: '/agent-platform',
      icon: <Workflow size={18} />,
      keywords: ['workflow', 'mcp', 'tools', 'automation'],
    },
    {
      id: 'collections',
      label: 'Open knowledge collections',
      description: 'Upload, index, and manage document knowledge bases.',
      group: 'Documents',
      path: '/collections',
      icon: <Files size={18} />,
      keywords: ['documents', 'files', 'knowledge', 'upload'],
    },
    {
      id: 'analytics',
      label: 'Open analytics',
      description: 'Inspect usage, cost, and workspace trends.',
      group: 'Reports',
      path: '/analytics',
      icon: <PieChart size={18} />,
      keywords: ['usage', 'cost', 'reporting', 'charts'],
    },
    {
      id: 'history',
      label: 'Open chat history',
      description: 'Resume prior conversations and review past answers.',
      group: 'RAG and Chat',
      path: '/history',
      icon: <History size={18} />,
      keywords: ['conversations', 'past', 'archive'],
    },
    {
      id: 'settings',
      label: 'Open settings',
      description: 'Manage profile, providers, preferences, and security.',
      group: 'Workspace',
      path: '/settings',
      icon: <Settings size={18} />,
      keywords: ['profile', 'preferences', 'configuration'],
    },
    {
      id: 'deploy-agent',
      label: 'Deploy an agent',
      description: 'Jump to agent creation and management.',
      group: 'Agents',
      path: '/bots',
      icon: <Sparkles size={18} />,
      keywords: ['create bot', 'new agent', 'assistant'],
    },
  ], []);

  // Fetch unread count on mount
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      if (event.key === '/' && !isTypingTarget(event.target)) {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen bg-[#09090b] text-gray-100 overflow-hidden font-sans selection:bg-violet-500/30">
      {/* Sidebar - Floating Style */}
      <motion.aside
        initial={{ width: 280 }}
        animate={{ width: sidebarOpen ? 280 : 88 }}
        transition={{ duration: 0.3, type: "spring", stiffness: 200, damping: 25 }}
        className="relative z-30 h-full hidden md:flex flex-col p-4 pr-0"
      >
        <div className="flex-1 flex flex-col bg-[#121214] border border-white/5 rounded-3xl shadow-2xl relative">

          {/* Toggle Button - Floating on Edge */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute -right-3 top-10 w-6 h-6 bg-[#18181b] border border-white/10 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-violet-600 hover:border-violet-500 transition-all z-50 shadow-lg group"
          >
            <ChevronLeft size={14} className={`transition-transform duration-300 group-hover:scale-110 ${!sidebarOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Sidebar Header */}
          <div className={`h-20 flex items-center ${sidebarOpen ? 'justify-start px-6' : 'justify-center'} mb-2 border-b border-white/5 mx-2`}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20">
                <span className="font-bold text-white text-xl">G</span>
              </div>
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex flex-col overflow-hidden whitespace-nowrap"
                  >
                    <span className="font-bold text-lg tracking-tight text-white">{APP_NAME}</span>
                    <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Enterprise</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* New Chat Action */}
          <div className="px-3 mb-6 mt-4">
            <button
              onClick={() => navigate('/chat')}
              className={`flex items-center justify-center gap-3 w-full py-3 rounded-xl font-semibold transition-all shadow-lg group relative overflow-hidden
                ${sidebarOpen ? 'bg-white text-black hover:bg-gray-200' : 'bg-white/10 text-white hover:bg-white/20 aspect-square p-0'}`}
              title={!sidebarOpen ? "New Chat" : ""}
            >
              <Plus size={20} className={`relative z-10 transition-transform ${sidebarOpen ? '' : 'group-hover:rotate-90'}`} />
              {sidebarOpen && <span className="relative z-10">New Chat</span>}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 space-y-1.5 scrollbar-hide">
            {MENU_ITEMS.map((item) => {
              const isActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== '/');
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 group relative
                    ${isActive
                      ? 'text-white bg-white/5 shadow-inner'
                      : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.02]'
                    }
                    ${!sidebarOpen ? 'justify-center' : ''}
                  `}
                >
                  {/* Active Indicator Background */}
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-violet-500/10 rounded-xl border border-violet-500/10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}

                  <div className={`relative z-10 ${isActive ? 'text-violet-400 drop-shadow-[0_0_8px_rgba(167,139,250,0.5)]' : 'group-hover:text-white'} transition-colors`}>
                    {item.icon}
                  </div>

                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="relative z-10 text-sm font-medium tracking-wide"
                    >
                      {item.label}
                    </motion.span>
                  )}

                  {/* Tooltip for collapsed state */}
                  {!sidebarOpen && (
                    <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#18181b] border border-white/10 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50 shadow-xl translate-x-2 group-hover:translate-x-0 transition-all">
                      {item.label}
                      <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-[#18181b] border-l border-b border-white/10 transform rotate-45"></div>
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="p-4 mt-auto border-t border-white/5 bg-black/20 mx-2 mb-2 rounded-2xl">
            <div className={`flex items-center gap-3 ${!sidebarOpen ? 'justify-center' : ''}`}>
              <div className="relative cursor-pointer hover:opacity-80 transition-opacity shrink-0">
                <img src="https://picsum.photos/id/64/100/100" alt="User" className="w-9 h-9 rounded-lg border border-white/10" />
                <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#121214] rounded-full"></span>
              </div>
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex-1 overflow-hidden"
                  >
                    <p className="text-sm font-semibold text-white truncate">Geralt User</p>
                    <button onClick={onLogout} className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1 transition-colors mt-0.5">
                      <LogOut size={12} /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-[#09090b]">
        {/* Ambient Background */}
        <div className="absolute top-0 left-0 w-full h-[500px] bg-violet-900/5 blur-[120px] pointer-events-none" />

        {/* Mobile Header */}
        <header className="h-16 flex md:hidden items-center justify-between px-4 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md z-30 sticky top-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <span className="font-bold text-white">G</span>
            </div>
            <span className="font-bold text-white">{APP_NAME}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="rounded-xl border border-white/10 p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Open command palette"
            >
              <Search size={20} />
            </button>
            <button className="text-gray-400" aria-label="Open navigation menu"><Menu /></button>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex h-20 items-center justify-between px-8 z-20">
          <div className="flex flex-col">
            <h2 className="text-white font-semibold text-lg capitalize tracking-tight">
              {location.pathname === '/' ? 'Dashboard' : location.pathname.substring(1).split('/')[0]}
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Workspace</span>
              <span>/</span>
              <span className="text-gray-400">Production</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="flex w-72 items-center rounded-xl border border-white/5 bg-[#18181b] py-2.5 pl-10 pr-12 text-left text-sm text-gray-500 transition-all hover:border-violet-500/40 hover:bg-[#202023] hover:text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
                aria-label="Open command palette"
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors group-hover:text-violet-400" size={16} />
                Search pages and actions...
              </button>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/10 bg-black/20">
                <Command size={10} className="text-gray-500" />
                <span className="text-[10px] text-gray-500 font-mono">K</span>
              </div>
            </div>
            <button
              onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
              className="relative p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
              aria-label="Open notifications"
              aria-expanded={notificationPanelOpen}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 min-w-[18px] h-[18px] bg-red-500 rounded-full ring-2 ring-[#09090b] flex items-center justify-center text-[10px] text-white font-bold">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationPanel
              isOpen={notificationPanelOpen}
              onClose={() => setNotificationPanelOpen(false)}
            />
          </div>
        </header>

        <CommandPalette
          isOpen={commandPaletteOpen}
          items={commandItems}
          onClose={() => setCommandPaletteOpen(false)}
          onNavigate={navigate}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-8 z-10 scrollbar-thin">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname.startsWith('/chat') ? 'chat' : location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default Layout;
