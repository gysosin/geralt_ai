import React, { memo, useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, MoreHorizontal, Trash2, Loader2, MessageSquare, Edit2, Check, X, Bot } from 'lucide-react';
import type { ConversationSummary } from '@/types';

interface ConversationSidebarProps {
    conversations: ConversationSummary[];
    currentId?: string;
    onSelect: (id: string) => void;
    onNew: () => void;
    onDelete: (id: string) => void;
    onRename?: (id: string, title: string) => Promise<void>;
    isLoading: boolean;
    onClose?: () => void;
    className?: string;
}

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

export const ConversationSidebar = memo(function ConversationSidebar({
    conversations,
    currentId,
    onSelect,
    onNew,
    onDelete,
    onRename,
    isLoading,
    onClose,
    className = ''
}: ConversationSidebarProps) {
    const [menuOpen, setMenuOpen] = React.useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const groupedConversations = groupConversationsByDate(conversations);

    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingId]);

    const handleStartEdit = (conv: ConversationSummary) => {
        setEditingId(conv.id);
        setEditTitle(conv.title || conv.first_message || 'New Conversation');
        setMenuOpen(null);
    };

    const handleSaveEdit = async () => {
        if (editingId && onRename && editTitle.trim()) {
            await onRename(editingId, editTitle.trim());
            setEditingId(null);
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditTitle('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSaveEdit();
        if (e.key === 'Escape') handleCancelEdit();
    };

    return (
        <div className={`flex flex-col h-full bg-black/30 ${className}`}>
            {/* Header with New Chat Button */}
            <div className="p-3 border-b border-white/5">
                <button
                    onClick={onNew}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-lg text-white text-sm font-medium transition-all shadow-lg shadow-violet-500/20"
                >
                    <Plus className="h-4 w-4" />
                    New Chat
                </button>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto p-2">
                {isLoading ? (
                    <div className="flex flex-col gap-2 p-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="animate-pulse p-3 space-y-2">
                                <div className="h-4 bg-white/5 rounded w-3/4" />
                                <div className="h-3 bg-white/5 rounded w-1/2" />
                            </div>
                        ))}
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <MessageSquare className="h-8 w-8 text-gray-600 mb-3" />
                        <p className="text-sm text-gray-500">No conversations yet</p>
                        <p className="text-xs text-gray-600 mt-1">Start a new chat to begin</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {groupedConversations.map((group) => (
                            <div key={group.label}>
                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider px-2 mb-2">
                                    {group.label}
                                </div>
                                <div className="space-y-1">
                                    {group.items.map((conv) => (
                                        <div key={conv.id} className="relative group">
                                            {editingId === conv.id ? (
                                                <div className="flex items-center gap-1 p-2 rounded-lg bg-white/5 border border-violet-500/50">
                                                    <input
                                                        ref={inputRef}
                                                        value={editTitle}
                                                        onChange={(e) => setEditTitle(e.target.value)}
                                                        onKeyDown={handleKeyDown}
                                                        className="flex-1 bg-transparent border-none text-sm text-white focus:outline-none min-w-0"
                                                        placeholder="Conversation name..."
                                                    />
                                                    <button onClick={handleSaveEdit} className="p-1 text-emerald-400 hover:bg-white/10 rounded">
                                                        <Check size={14} />
                                                    </button>
                                                    <button onClick={handleCancelEdit} className="p-1 text-red-400 hover:bg-white/10 rounded">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className={`
                            relative flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all
                            ${currentId === conv.id
                                                            ? 'bg-violet-500/20 border border-violet-500/30'
                                                            : 'hover:bg-white/5 border border-transparent'}
                          `}
                                                    onClick={() => {
                                                        onSelect(conv.id);
                                                        onClose?.();
                                                    }}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            {conv.botId && <Bot className="shrink-0 text-violet-400" size={14} />}
                                                            <p className={`text-sm font-medium truncate ${currentId === conv.id ? 'text-violet-300' : 'text-gray-200'}`}>
                                                                {conv.title || conv.first_message || 'New Conversation'}
                                                            </p>
                                                        </div>
                                                        <p className="text-xs text-gray-500 truncate">
                                                            {formatRelativeTime(conv.timestamp || conv.created_at || new Date())}
                                                        </p>
                                                    </div>

                                                    {/* Actions Menu */}
                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setMenuOpen(menuOpen === conv.id ? null : conv.id);
                                                            }}
                                                            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                                                        >
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </button>

                                                        {menuOpen === conv.id && (
                                                            <>
                                                                <div className="fixed inset-0 z-40" onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setMenuOpen(null);
                                                                }} />
                                                                <div className="absolute right-0 top-full mt-1 w-36 bg-[#1a1a1e] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden py-1">
                                                                    {onRename && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleStartEdit(conv);
                                                                            }}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:bg-white/5 transition-colors text-sm"
                                                                        >
                                                                            <Edit2 className="h-3.5 w-3.5" />
                                                                            Rename
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onDelete(conv.id);
                                                                            setMenuOpen(null);
                                                                        }}
                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 transition-colors text-sm"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});

export default ConversationSidebar;
