/**
 * Notification Provider
 * 
 * Context provider that initializes socket listeners and wraps app with toast container.
 */
import React, { useEffect, useCallback } from 'react';
import { socketService } from '../services/socket.service';
import { useNotificationStore } from '../store';
import { ToastContainer } from './Toast';
import type { Notification } from '../types/notification.types';

interface NotificationProviderProps {
    children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
    const { handleNotification, handleNotificationRead, fetchUnreadCount } = useNotificationStore();

    // Handle incoming notification from socket
    const onNotification = useCallback((data: Notification) => {
        handleNotification(data);
    }, [handleNotification]);

    // Handle notification read event from socket
    const onNotificationRead = useCallback((data: { id: string }) => {
        handleNotificationRead(data);
    }, [handleNotificationRead]);

    useEffect(() => {
        // Connect to socket if not already connected
        socketService.connect();

        // Subscribe to notification events
        socketService.on('notification', onNotification);
        socketService.on('notification_read', onNotificationRead);
        socketService.on('notification_broadcast', onNotification);

        // Fetch initial unread count
        fetchUnreadCount();

        // Cleanup on unmount
        return () => {
            socketService.off('notification', onNotification);
            socketService.off('notification_read', onNotificationRead);
            socketService.off('notification_broadcast', onNotification);
        };
    }, [onNotification, onNotificationRead, fetchUnreadCount]);

    return (
        <>
            {children}
            <ToastContainer />
        </>
    );
};

export default NotificationProvider;
