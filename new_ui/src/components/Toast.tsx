/**
 * Toast Component
 * 
 * Displays toast notifications with auto-dismiss and animations.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle,
    XCircle,
    AlertTriangle,
    Info,
    X,
    FileText,
    FolderOpen,
    MessageSquare,
    Bot,
    Settings,
    User
} from 'lucide-react';
import { useNotificationStore } from '../store';
import type { Toast as ToastType, NotificationType } from '../types/notification.types';

const getIcon = (type: NotificationType) => {
    switch (type) {
        case 'document':
            return <FileText className="w-5 h-5" />;
        case 'collection':
            return <FolderOpen className="w-5 h-5" />;
        case 'chat':
            return <MessageSquare className="w-5 h-5" />;
        case 'bot':
            return <Bot className="w-5 h-5" />;
        case 'system':
            return <Settings className="w-5 h-5" />;
        case 'user':
            return <User className="w-5 h-5" />;
        default:
            return <Info className="w-5 h-5" />;
    }
};

const getIconColor = (priority: string, type: NotificationType) => {
    // Use priority for color
    switch (priority) {
        case 'urgent':
            return 'text-red-400';
        case 'high':
            return 'text-orange-400';
        case 'low':
            return 'text-gray-400';
        default:
            // For normal priority, use type-based colors
            switch (type) {
                case 'document':
                    return 'text-blue-400';
                case 'collection':
                    return 'text-violet-400';
                case 'chat':
                    return 'text-green-400';
                case 'bot':
                    return 'text-cyan-400';
                default:
                    return 'text-gray-400';
            }
    }
};

const getBorderColor = (priority: string) => {
    switch (priority) {
        case 'urgent':
            return 'border-l-red-500';
        case 'high':
            return 'border-l-orange-500';
        case 'low':
            return 'border-l-gray-500';
        default:
            return 'border-l-violet-500';
    }
};

interface ToastItemProps {
    toast: ToastType;
    onClose: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`
                bg-[#1a1a1d] border border-white/10 rounded-xl shadow-2xl overflow-hidden
                min-w-[320px] max-w-[420px]
                border-l-4 ${getBorderColor(toast.priority)}
            `}
        >
            <div className="p-4 flex items-start gap-3">
                <div className={`mt-0.5 ${getIconColor(toast.priority, toast.type)}`}>
                    {getIcon(toast.type)}
                </div>

                <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium text-sm truncate">
                        {toast.title}
                    </h4>
                    <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">
                        {toast.message}
                    </p>
                </div>

                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-white transition-colors p-1 -m-1"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Progress bar for auto-dismiss */}
            {toast.duration && toast.duration > 0 && (
                <motion.div
                    initial={{ scaleX: 1 }}
                    animate={{ scaleX: 0 }}
                    transition={{ duration: toast.duration / 1000, ease: 'linear' }}
                    className="h-0.5 bg-white/20 origin-left"
                />
            )}
        </motion.div>
    );
};

export const ToastContainer: React.FC = () => {
    const { toasts, removeToast } = useNotificationStore();

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onClose={() => removeToast(toast.id)}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
};

export default ToastContainer;
