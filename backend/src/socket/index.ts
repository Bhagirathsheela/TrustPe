/**
 * Socket.io /realtime namespace.
 *
 * Auth: clients pass their JWT access token in `socket.handshake.auth.token`.
 * We verify the token in middleware, attach the user id to the socket, and
 * have the socket auto-join a personal room `user:<userId>`. Services can
 * then broadcast to either party of a loan by emitting to both participants'
 * personal rooms — no need for the client to subscribe per loan.
 *
 * Real-time events emitted:
 *   message:new   { id, loanId, senderId, senderRole, kind, content, ... }
 *
 * Client-emitted events: none in Phase 1. Messages go over REST (POST
 * /v1/loans/:loanId/messages); the server-side write triggers a Socket.io
 * broadcast. Keeps the surface tiny and avoids dual-channel write races.
 */
import { Server as HttpServer } from 'node:http';
import { Server as IoServer, type Socket } from 'socket.io';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import { setRealtimeEmitter } from '../services/chat.service.js';
import { setNotificationEmitter } from '../services/notification.service.js';

type AuthedSocket = Socket & { data: { userId: string } };

export function attachRealtime(httpServer: HttpServer): IoServer {
  const io = new IoServer(httpServer, {
    // Same allowlist as the REST API. RN clients don't send an Origin header
    // so the mobile app is unaffected; this only locks out browser origins.
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    transports: ['websocket', 'polling'],
  });

  const realtime = io.of('/realtime');

  realtime.use((socket, next) => {
    const token = (socket.handshake.auth?.token as string | undefined) ?? '';
    if (!token) return next(new Error('missing_token'));
    try {
      const payload = verifyAccessToken(token);
      (socket as AuthedSocket).data.userId = payload.sub;
      next();
    } catch (err) {
      logger.warn({ err }, '[socket] auth failed');
      next(new Error('invalid_token'));
    }
  });

  realtime.on('connection', (socket: Socket) => {
    const userId = (socket as AuthedSocket).data.userId;
    void socket.join(`user:${userId}`);
    logger.info({ userId, socketId: socket.id }, '[socket] connected');

    socket.on('disconnect', (reason) => {
      logger.info({ userId, reason }, '[socket] disconnected');
    });
  });

  // Wire the chat service's emit hook so services can broadcast without
  // knowing about Socket.io directly.
  setRealtimeEmitter((recipientIds, event, payload) => {
    for (const id of recipientIds) {
      realtime.to(`user:${id}`).emit(event, payload);
    }
  });

  // Same wiring for the notification service.
  setNotificationEmitter((recipientIds, event, payload) => {
    for (const id of recipientIds) {
      realtime.to(`user:${id}`).emit(event, payload);
    }
  });

  logger.info('[socket] /realtime namespace attached');
  return io;
}
