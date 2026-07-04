/**
 * Audit log helper — single place we write to `audit_logs`.
 *
 * Callers MUST pass the `ctx` from the request so actor + IP + device + traceId
 * are captured. See CLAUDE.md "Audit logging — never bypass".
 */
import type { ClientSession } from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';
import { logger } from './logger.js';

export type AuditActorType = 'user' | 'admin' | 'system' | 'webhook';

export type AuditContext = {
  actorType: AuditActorType;
  actorId?: string;
  ip?: string;
  deviceFingerprint?: string;
  userAgent?: string;
  traceId?: string;
};

export type AuditEntry = {
  action: string; // 'user.signup', 'auth.otp.verified', etc.
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(
  ctx: AuditContext,
  entry: AuditEntry,
  session?: ClientSession,
): Promise<void> {
  try {
    await AuditLog.create(
      [
        {
          at: new Date(),
          actorType: ctx.actorType,
          actorId: ctx.actorId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          before: entry.before ?? null,
          after: entry.after ?? null,
          ip: ctx.ip,
          deviceFingerprint: ctx.deviceFingerprint,
          userAgent: ctx.userAgent,
          traceId: ctx.traceId,
          metadata: entry.metadata,
        },
      ],
      session ? { session } : {},
    );
  } catch (err) {
    if (session) {
      // Inside a money/identity transaction the audit row is part of the
      // atomic unit — failing to write it must abort the whole transition.
      // See CLAUDE.md "Audit everything that touches money or identity".
      throw err;
    }
    // Outside transactions, audit failures must not block the business
    // operation. Log loudly.
    logger.error({ err, entry }, 'Failed to write audit log entry');
  }
}
