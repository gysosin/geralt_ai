import type { Notification } from '../types/notification.types';

export type NotificationCenterFilter = 'all' | 'unread' | 'urgent';

export type NotificationCenterCounts = Record<NotificationCenterFilter, number>;

export const getNotificationCenterCounts = (notifications: Notification[]): NotificationCenterCounts => ({
    all: notifications.length,
    unread: notifications.filter((notification) => !notification.read).length,
    urgent: notifications.filter((notification) => notification.priority === 'urgent').length,
});

export const filterNotifications = (
    notifications: Notification[],
    filter: NotificationCenterFilter,
): Notification[] => {
    if (filter === 'unread') return notifications.filter((notification) => !notification.read);
    if (filter === 'urgent') return notifications.filter((notification) => notification.priority === 'urgent');
    return notifications;
};
