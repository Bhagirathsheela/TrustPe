/**
 * Notification orchestrator.
 *
 * Single entry point — `notify(userId, kind, title, body, options)` —
 * routes the event to three channels:
 *   1. In-app persisted record (Notification model)
 *   2. Expo Push to all of the user's active devices
 *   3. (Phase 2) Email via Resend
 *
 * Also emits a Socket.io 'notification:new' event so the mobile bell badge
 * updates live without re-fetching the list.
 *
 * Fire-and-forget by design: callers don't await; failures are logged but
 * don't block the business operation. The notify call itself is async but
 * the channel sends are wrapped so one channel failing doesn't take down
 * the others.
 */
import { Types } from 'mongoose';
import {
  NOTIFICATION_KIND_TO_CATEGORY,
  type NotificationCategory,
  type NotificationKind,
  type NotificationQuery,
} from 'trustpe-shared';
import { Notification, type NotificationDocument } from '../models/Notification.js';
import { PushToken } from '../models/PushToken.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/error-handler.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export type NotificationPayload = {
  id: string;
  kind: string;
  title: string;
  body: string;
  deepLink?: string;
  metadata?: unknown;
  read: boolean;
  readAt?: string;
  createdAt: string;
};

function toPayload(n: NotificationDocument): NotificationPayload {
  return {
    id: String(n._id),
    kind: n.kind,
    title: n.title,
    body: n.body,
    deepLink: n.deepLink ?? undefined,
    metadata: n.metadata,
    read: n.read,
    readAt: n.readAt?.toISOString(),
    createdAt: n.createdAt.toISOString(),
  };
}

/**
 * Pluggable real-time emitter. Set at boot by socket/index.ts so the
 * notification service can broadcast to the user's room without importing
 * Socket.io directly.
 */
type Emit = (recipientIds: string[], event: 'notification:new', payload: NotificationPayload) => void;
let emit: Emit = () => {};
export function setNotificationEmitter(fn: Emit) {
  emit = fn;
}

async function sendExpoPush(
  tokens: string[],
  message: { title: string; body: string; data?: unknown },
): Promise<void> {
  if (tokens.length === 0) return;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        tokens.map((to) => ({
          to,
          title: message.title,
          body: message.body,
          data: message.data ?? {},
          sound: 'default',
          priority: 'high',
        })),
      ),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn({ status: res.status, text: text.slice(0, 200) }, '[push] non-OK response');
      return;
    }
    const result = (await res.json().catch(() => null)) as {
      data?: Array<{ status: string; message?: string; details?: { error?: string } }>;
    } | null;
    if (result?.data) {
      // Mark invalid tokens so we stop sending to them next time.
      const failed: string[] = [];
      result.data.forEach((entry, i) => {
        if (entry.status === 'error') {
          const reason = entry.details?.error;
          if (reason === 'DeviceNotRegistered') {
            const token = tokens[i];
            if (token) failed.push(token);
          }
        }
      });
      if (failed.length) {
        await PushToken.updateMany(
          { token: { $in: failed } },
          { $set: { invalidatedAt: new Date() } },
        );
      }
    }
  } catch (err) {
    logger.warn({ err }, '[push] send failed');
  }
}

export type NotifyOptions = {
  deepLink?: string;
  metadata?: unknown;
  /** Push notification payload (defaults to title/body if not provided). */
  push?: { title?: string; body?: string; data?: unknown } | false;
};

export const notificationService = {
  /**
   * Create + persist + deliver. Best-effort; never throws to caller.
   */
  async notify(
    userId: string,
    kind: NotificationKind,
    title: string,
    body: string,
    options: NotifyOptions = {},
  ): Promise<NotificationPayload | null> {
    // Bail early on invalid recipients so callers can't accidentally
    // poison the audit trail with bogus rows or trigger Mongoose casts.
    if (!userId || !Types.ObjectId.isValid(userId)) {
      logger.warn({ userId, kind }, '[notification] dropped — invalid userId');
      return null;
    }
    try {
      const [created] = await Notification.create([
        {
          userId,
          kind,
          title,
          body,
          deepLink: options.deepLink,
          metadata: options.metadata,
          read: false,
          createdAt: new Date(),
        },
      ]);
      if (!created) return null;
      const payload = toPayload(created);

      // Live broadcast
      emit([userId], 'notification:new', payload);

      // Push (unless explicitly disabled OR the user has muted this category)
      if (options.push !== false) {
        const muted = await isCategoryMuted(userId, kind);
        if (!muted) {
          const tokens = await PushToken.find({
            userId: new Types.ObjectId(userId),
            invalidatedAt: { $exists: false },
          });
          if (tokens.length > 0) {
            const pushTitle = options.push?.title ?? title;
            const pushBody = options.push?.body ?? body;
            const pushData = options.push?.data ?? {
              kind,
              deepLink: options.deepLink,
              ...(options.metadata as Record<string, unknown> | undefined),
            };
            await sendExpoPush(
              tokens.map((t) => t.token),
              { title: pushTitle, body: pushBody, data: pushData },
            );
          }
        }
      }

      return payload;
    } catch (err) {
      logger.error({ err, userId, kind }, '[notification] notify failed');
      return null;
    }
  },

  /** Fire-and-forget shortcut for callers who don't want to await. */
  enqueue(
    userId: string,
    kind: NotificationKind,
    title: string,
    body: string,
    options: NotifyOptions = {},
  ): void {
    void this.notify(userId, kind, title, body, options);
  },

  /** Register or refresh a device's push token. */
  async registerToken(
    userId: string,
    token: string,
    platform: 'android' | 'ios',
  ): Promise<void> {
    await PushToken.findOneAndUpdate(
      { token },
      {
        $set: { userId, platform, lastSeenAt: new Date() },
        // $unset, NOT `$set: { invalidatedAt: undefined }` — Mongoose silently
        // drops undefined in $set, which left tokens dead forever after a
        // logout → login cycle on the same device.
        $unset: { invalidatedAt: 1 },
      },
      { upsert: true, new: true },
    );
  },

  /** Drop a token (e.g. on logout). */
  async unregisterToken(token: string): Promise<void> {
    await PushToken.updateOne({ token }, { $set: { invalidatedAt: new Date() } });
  },

  async list(
    userId: string,
    query: NotificationQuery,
  ): Promise<{ items: NotificationPayload[]; nextCursor: string | null; unreadCount: number }> {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (query.unreadOnly) filter.read = false;
    if (query.before) {
      if (!/^[0-9a-fA-F]{24}$/.test(query.before)) {
        throw new AppError('invalid_cursor', 'Cursor is not a valid id', 400);
      }
      filter._id = { $lt: new Types.ObjectId(query.before) };
    }

    const [docs, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ _id: -1 })
        .limit(query.limit + 1),
      Notification.countDocuments({ userId: new Types.ObjectId(userId), read: false }),
    ]);

    const hasMore = docs.length > query.limit;
    const pageItems = hasMore ? docs.slice(0, query.limit) : docs;
    const nextCursor =
      hasMore && pageItems.length > 0 ? String(pageItems[pageItems.length - 1]!._id) : null;

    return {
      items: pageItems.map(toPayload),
      nextCursor,
      unreadCount,
    };
  },

  async markRead(userId: string, notificationId: string): Promise<NotificationPayload> {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new AppError('invalid_id', 'Notification id is not a valid ObjectId', 400);
    }
    const doc = await Notification.findOne({
      _id: notificationId,
      userId: new Types.ObjectId(userId),
    });
    if (!doc) throw new AppError('not_found', 'Notification not found', 404);
    if (!doc.read) {
      doc.read = true;
      doc.readAt = new Date();
      await doc.save();
    }
    return toPayload(doc);
  },

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await Notification.updateMany(
      { userId: new Types.ObjectId(userId), read: false },
      { $set: { read: true, readAt: new Date() } },
    );
    return { updated: result.modifiedCount };
  },

  /** Get the user's current notification preferences. */
  async getPreferences(userId: string): Promise<{ mutedCategories: NotificationCategory[] }> {
    const user = await User.findById(userId);
    if (!user) throw new AppError('user_not_found', 'User not found', 404);
    const muted = ((user.notificationPreferences?.mutedCategories ?? []) as string[]) as NotificationCategory[];
    return { mutedCategories: muted };
  },

  /** Replace the user's muted-categories list. */
  async updatePreferences(
    userId: string,
    categories: NotificationCategory[],
  ): Promise<{ mutedCategories: NotificationCategory[] }> {
    const user = await User.findById(userId);
    if (!user) throw new AppError('user_not_found', 'User not found', 404);
    user.notificationPreferences = {
      mutedCategories: categories as unknown as string[],
    };
    await user.save();
    return { mutedCategories: categories };
  },
};

async function isCategoryMuted(userId: string, kind: NotificationKind): Promise<boolean> {
  try {
    const user = await User.findById(userId, { notificationPreferences: 1 });
    if (!user) return false;
    const muted = (user.notificationPreferences?.mutedCategories ?? []) as string[];
    if (muted.length === 0) return false;
    const category = NOTIFICATION_KIND_TO_CATEGORY[kind];
    return muted.includes(category);
  } catch {
    return false;
  }
}
