/**
 * Notification Store
 * 
 * Zustand store for managing notifications and toasts.
 */
import { create } from 'zustand';
import api from '../services/api';
import type { Notification, Toast, NotificationListResponse } from '../types/notification.types';

const MAX_TOASTS = 5;
const DEFAULT_TOAST_DURATION = 5000;

interface NotificationState {
    // Persisted notifications from server
    notifications: Notification[];
    unreadCount: number;
    isLoading: boolean;
    error: string | null;

    // Transient toasts for UI
    toasts: Toast[];

    // Actions
    fetchNotifications: () => Promise<void>;
    fetchUnreadCount: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;

    // Toast actions
    addToast: (toast: Omit<Toast, 'id' | 'read' | 'created_at'>) => void;
    removeToast: (id: string) => void;

    // Socket event handlers
    handleNotification: (notification: Notification) => void;
    handleNotificationRead: (data: { id: string }) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
    toasts: [],

    fetchNotifications: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get<NotificationListResponse>('/api/v1/notifications?limit=50');
            set({
                notifications: response.data.notifications,
                unreadCount: response.data.unread_count,
                isLoading: false,
            });
        } catch (error: any) {
            set({
                error: error.response?.data?.detail || 'Failed to fetch notifications',
                isLoading: false,
            });
        }
    },

    fetchUnreadCount: async () => {
        try {
            const response = await api.get<{ count: number }>('/api/v1/notifications/unread');
            set({ unreadCount: response.data.count });
        } catch (error) {
            console.error('Failed to fetch unread count:', error);
        }
    },

    markAsRead: async (id: string) => {
        try {
            await api.put(`/api/v1/notifications/${id}/read`);
            set((state) => ({
                notifications: state.notifications.map((n) =>
                    n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n
                ),
                unreadCount: Math.max(0, state.unreadCount - 1),
            }));
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    },

    markAllAsRead: async () => {
        try {
            await api.put('/api/v1/notifications/read-all');
            set((state) => ({
                notifications: state.notifications.map((n) => ({
                    ...n,
                    read: true,
                    read_at: new Date().toISOString(),
                })),
                unreadCount: 0,
            }));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    },

    deleteNotification: async (id: string) => {
        try {
            await api.delete(`/api/v1/notifications/${id}`);
            set((state) => ({
                notifications: state.notifications.filter((n) => n.id !== id),
            }));
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    },

    addToast: (toast) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newToast: Toast = {
            ...toast,
            id,
            read: false,
            created_at: new Date().toISOString(),
            duration: toast.duration ?? DEFAULT_TOAST_DURATION,
        };

        set((state) => ({
            toasts: [...state.toasts.slice(-MAX_TOASTS + 1), newToast],
        }));

        // Auto-remove after duration
        if (newToast.duration && newToast.duration > 0) {
            setTimeout(() => {
                get().removeToast(id);
            }, newToast.duration);
        }
    },

    removeToast: (id: string) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
        }));
    },

    handleNotification: (notification: Notification) => {
        // Add to notifications list
        set((state) => ({
            notifications: [notification, ...state.notifications].slice(0, 100),
            unreadCount: state.unreadCount + 1,
        }));

        // Show as toast
        get().addToast({
            type: notification.type,
            priority: notification.priority,
            title: notification.title,
            message: notification.message,
            data: notification.data,
        });
    },

    handleNotificationRead: (data: { id: string }) => {
        set((state) => ({
            notifications: state.notifications.map((n) =>
                n.id === data.id ? { ...n, read: true } : n
            ),
        }));
    },
}));
