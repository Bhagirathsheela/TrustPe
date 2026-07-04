/**
 * Extract the audit/security context from a request.
 *
 * Keeps audit-context construction in one place so we don't drift on field
 * naming or forget IP capture.
 */
import type { Request } from 'express';
import type { AuditContext } from './audit.js';

export function ctxFromRequest(req: Request, actorType: AuditContext['actorType']): AuditContext {
  return {
    actorType,
    actorId: req.user?.id,
    ip: clientIp(req),
    deviceFingerprint: req.header('x-device-fingerprint') ?? undefined,
    userAgent: req.header('user-agent') ?? undefined,
    traceId: req.header('x-trace-id') ?? undefined,
  };
}

export function clientIp(req: Request): string | undefined {
  // `trust proxy` is configured in app.ts, so req.ip already resolves the
  // correct client address from X-Forwarded-For. Never parse the header
  // manually — the leftmost entry is attacker-controlled and would let users
  // forge the IP recorded in audit logs and agreement signatures.
  return req.ip ?? req.socket.remoteAddress ?? undefined;
}
