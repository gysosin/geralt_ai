/**
 * Notification Panel Component
 * 
 * Dropdown panel for viewing notification history.
 */
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    Check,
    CheckCheck,
    Trash2,
    X,
    FileText,
    FolderOpen,
    MessageSquare,
    Bot,
    Settings,
    User,
    Loader2
} from 'lucide-react';
import { useNotificationStore } from '../store';
import type { Notification, NotificationType } from '../types/notification.types';
import { formatDistanceToNow } from 'date-fns';

const getIcon = (type: NotificationType) => {
    const iconClass = "w-4 h-4";
    switch (type) {
        case 'document':
            return <FileText className={iconClass} />;
        case 'collection':
            return <FolderOpen className={iconClass} />;
        case 'chat':
            return <MessageSquare className={iconClass} />;
        case 'bot':
            return <Bot className={iconClass} />;
        case 'system':
            return <Settings className={iconClass} />;
        case 'user':
            return <User className={iconClass} />;
        default:
            return <Bell className={iconClass} />;
    }
};

interface NotificationItemProps {
    notification: Notification;
    onMarkRead: () => void;
    onDelete: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
    notification,
    onMarkRead,
    onDelete
}) => {
    const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });

    return (
        <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`
                p-3 border-b border-white/5 last:border-b-0
                ${notification.read ? 'opacity-60' : ''}
                hover:bg-white/5 transition-colors
            `}
        >
            <div className="flex items-start gap-3">
                <div className={`
                    mt-0.5 p-1.5 rounded-lg
                    ${notification.read ? 'bg-white/5 text-gray-500' : 'bg-violet-500/20 text-violet-400'}
                `}>
                    {getIcon(notification.type)}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="text-white text-sm font-medium truncate">
                            {notification.title}
                        </h4>
                        {!notification.read && (
                            <span className="w-2 h-2 bg-violet-500 rounded-full flex-shrink-0" />
                        )}
                    </div>
                    <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">
                        {notification.message}
                    </p>
                    <p className="text-gray-500 text-[10px] mt-1">
                        {timeAgo}
                    </p>
                </div>

                <div className="flex items-center gap-1">
                    {!notification.read && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onMarkRead(); }}
                            className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                            title="Mark as read"
                        >
                            <Check className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title="Delete"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

interface NotificationPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose }) => {
    const {
        notifications,
        unreadCount,
        isLoading,
        fetchNotifications: fetchNotificationsAction,
        markAsRead: markAsReadAction,
        markAllAsRead: markAllAsReadAction,
        deleteNotification: deleteNotificationAction
    } = useNotificationStore();

    useEffect(() => {
        if (isOpen) {
            fetchNotificationsAction();
        }
    }, [isOpen, fetchNotificationsAction]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40"
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="
                            fixed top-16 right-4 z-50
                            w-[380px] max-h-[500px]
                            bg-[#1a1a1d] border border-white/10 rounded-2xl
                            shadow-2xl overflow-hidden
                        "
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Bell className="w-5 h-5 text-violet-400" />
                                <h3 className="text-white font-medium">Notifications</h3>
                                {unreadCount > 0 && (
                                    <span className="bg-violet-600 text-white text-xs px-2 py-0.5 rounded-full">
                                        {unreadCount}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsReadAction}
                                        className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
                                    >
                                        <CheckCheck className="w-3.5 h-3.5" />
                                        Mark all read
                                    </button>
                                )}
                                <button
                                    onClick={onClose}
                                    className="p-1 text-gray-500 hover:text-white transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="max-h-[400px] overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Bell className="w-10 h-10 text-gray-600 mb-3" />
                                    <p className="text-gray-500 text-sm">No notifications yet</p>
                                    <p className="text-gray-600 text-xs mt-1">
                                        You'll see updates about your documents here
                                    </p>
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {notifications.map((notification) => (
                                        <NotificationItem
                                            key={notification.id}
                                            notification={notification}
                                            onMarkRead={() => markAsReadAction(notification.id)}
                                            onDelete={() => deleteNotificationAction(notification.id)}
                                        />
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default NotificationPanel;
