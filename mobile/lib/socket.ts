/**
 * Socket.io client manager.
 *
 * One singleton connection per app session. Lifecycle is driven by
 * `auth-context.tsx`:
 *   - On login / refresh / verify-otp → connectRealtime(accessToken)
 *   - On logout / refresh failure     → disconnectRealtime()
 *
 * Consumers register event handlers via `onRealtimeEvent('message:new', cb)`
 * and clean them up by calling the returned `off()` function. The handler
 * survives reconnects because we re-attach on every new socket.
 */
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api-config';

let socket: Socket | null = null;
let currentToken: string | null = null;

// Handlers registered by consumers; we re-attach to new socket on reconnect.
type Handler = (payload: unknown) => void;
const handlers = new Map<string, Set<Handler>>();

function realtimeUrl(): string {
  // API_BASE_URL is like "http://192.168.1.5:4000/v1" — strip /v1 for socket root.
  return API_BASE_URL.replace(/\/v1\/?$/, '');
}

function reattachHandlers(s: Socket) {
  for (const [event, set] of handlers.entries()) {
    for (const handler of set) {
      s.on(event, handler);
    }
  }
}

export function connectRealtime(accessToken: string): Socket {
  if (socket && currentToken === accessToken && socket.connected) {
    return socket;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  currentToken = accessToken;
  socket = io(`${realtimeUrl()}/realtime`, {
    auth: { token: accessToken },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });
  socket.on('connect', () => {
    // eslint-disable-next-line no-console
    console.log('[socket] connected');
  });
  socket.on('connect_error', (err) => {
    // eslint-disable-next-line no-console
    console.warn('[socket] connect_error', err.message);
  });
  reattachHandlers(socket);
  return socket;
}

export function disconnectRealtime(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}

/**
 * Subscribe to a realtime event. Returns an unsubscribe function.
 * Survives socket reconnects.
 */
export function onRealtimeEvent<T>(event: string, handler: (payload: T) => void): () => void {
  const wrapped = handler as Handler;
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(wrapped);
  socket?.on(event, wrapped);
  return () => {
    handlers.get(event)?.delete(wrapped);
    socket?.off(event, wrapped);
  };
}
