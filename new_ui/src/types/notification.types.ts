/**
 * Notification Types
 * 
 * TypeScript interfaces for the notification system.
 */

export type NotificationType = 'document' | 'collection' | 'chat' | 'bot' | 'system' | 'user';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
    id: string;
    type: NotificationType;
    priority: NotificationPriority;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    read: boolean;
    created_at: string;
    read_at?: string;
}

export interface NotificationListResponse {
    notifications: Notification[];
    total: number;
    unread_count: number;
}

export interface UnreadCountResponse {
    count: number;
}

// Toast-specific types
export interface Toast extends Notification {
    duration?: number;
    onClose?: () => void;
}
