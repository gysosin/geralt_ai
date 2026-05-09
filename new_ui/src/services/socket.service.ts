import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class SocketService {
    private socket: Socket | null = null;
    private listeners: Map<string, Set<(data: any) => void>> = new Map();
    private hasLoggedConnectionError = false;

    connect(): void {
        if (this.socket) {
            if (!this.socket.connected) {
                this.socket.connect();
            }
            return;
        }

        const token = localStorage.getItem('token');

        this.socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            autoConnect: true,
            auth: { token },
        });

        this.socket.on('connect_error', (error) => {
            if (import.meta.env.DEV && !this.hasLoggedConnectionError) {
                console.warn(
                    'Socket connection unavailable; retrying in background:',
                    error instanceof Error ? error.message : error
                );
                this.hasLoggedConnectionError = true;
            }
        });

        this.socket.on('connect', () => {
            this.hasLoggedConnectionError = false;
        });

        this.listeners.forEach((callbacks, event) => {
            callbacks.forEach(callback => {
                this.socket?.on(event, callback);
            });
        });
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    on(event: string, callback: (data: any) => void): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);

        if (this.socket) {
            this.socket.on(event, callback);
        }
    }

    off(event: string, callback: (data: any) => void): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                this.listeners.delete(event);
            }
        }

        if (this.socket) {
            this.socket.off(event, callback);
        }
    }

    emit(event: string, data: any): void {
        if (this.socket) {
            this.socket.emit(event, data);
        }
    }

    isConnected(): boolean {
        return this.socket?.connected ?? false;
    }
}

export const socketService = new SocketService();
export default socketService;
