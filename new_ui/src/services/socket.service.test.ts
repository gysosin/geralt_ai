import { beforeEach, describe, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { SocketService } from './socket.service';

vi.mock('socket.io-client', () => ({
  io: vi.fn(),
}));

type SocketHandler = (...args: unknown[]) => void;

const createSocket = () => {
  const handlers = new Map<string, SocketHandler>();
  const socket = {
    active: true,
    connected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
    off: vi.fn(),
    on: vi.fn((event: string, handler: SocketHandler) => {
      handlers.set(event, handler);
      return socket;
    }),
  };
  return { socket, handlers };
};

describe('SocketService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => 'token-1'),
    });
  });

  it('reuses an existing socket while it reconnects', () => {
    const { socket } = createSocket();
    vi.mocked(io).mockReturnValue(socket as any);
    const service = new SocketService();

    service.connect();
    service.connect();

    expect(io).toHaveBeenCalledTimes(1);
    expect(socket.connect).toHaveBeenCalledTimes(1);
  });

  it('registers stored listeners once when connecting', () => {
    const { socket } = createSocket();
    vi.mocked(io).mockReturnValue(socket as any);
    const service = new SocketService();
    const callback = vi.fn();

    service.on('notification', callback);
    service.connect();
    service.connect();

    expect(socket.on).toHaveBeenCalledWith('notification', callback);
    expect(socket.on.mock.calls.filter(([event]) => event === 'notification')).toHaveLength(1);
  });

  it('logs a temporary connection failure once until a connection succeeds', () => {
    const { socket, handlers } = createSocket();
    vi.mocked(io).mockReturnValue(socket as any);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = new SocketService();

    service.connect();
    handlers.get('connect_error')?.(new Error('backend unavailable'));
    handlers.get('connect_error')?.(new Error('backend unavailable'));
    handlers.get('connect')?.();
    handlers.get('connect_error')?.(new Error('backend unavailable'));

    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy.mock.calls[0][0]).toContain('Socket connection unavailable');
    warnSpy.mockRestore();
  });
});
