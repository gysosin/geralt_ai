import { describe, expect, it } from 'vitest';
import type { Notification } from '../types/notification.types';
import { filterNotifications, getNotificationCenterCounts } from './notification-center';

const notification = (overrides: Partial<Notification>): Notification => ({
    id: 'notification-1',
    type: 'system',
    priority: 'normal',
    title: 'Notification',
    message: 'Message',
    read: false,
    created_at: '2026-05-09T12:00:00.000Z',
    ...overrides,
});

describe('notification center utilities', () => {
    const notifications = [
        notification({ id: 'read-normal', read: true }),
        notification({ id: 'unread-normal', read: false }),
        notification({ id: 'urgent-read', priority: 'urgent', read: true }),
        notification({ id: 'urgent-unread', priority: 'urgent', read: false }),
    ];

    it('counts all, unread, and urgent notifications', () => {
        expect(getNotificationCenterCounts(notifications)).toEqual({
            all: 4,
            unread: 2,
            urgent: 2,
        });
    });

    it('filters notifications by selected center filter', () => {
        expect(filterNotifications(notifications, 'all').map((item) => item.id)).toEqual([
            'read-normal',
            'unread-normal',
            'urgent-read',
            'urgent-unread',
        ]);
        expect(filterNotifications(notifications, 'unread').map((item) => item.id)).toEqual([
            'unread-normal',
            'urgent-unread',
        ]);
        expect(filterNotifications(notifications, 'urgent').map((item) => item.id)).toEqual([
            'urgent-read',
            'urgent-unread',
        ]);
    });
});
