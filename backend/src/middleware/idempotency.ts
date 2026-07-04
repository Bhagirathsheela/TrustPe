/**
 * Idempotency middleware for money-touching endpoints.
 *
 * Contract (CLAUDE.md "Idempotency on money-touching endpoints"):
 *   - Client sends `Idempotency-Key: <uuid>` on POSTs that move money state.
 *   - First request executes normally; the JSON response is stored for 24h.
 *   - A retry with the same key replays the stored response verbatim
 *     (header `Idempotency-Replayed: true` added for observability).
 *   - A retry that arrives while the first is still in flight gets 409
 *     `idempotency_in_flight` — safer than double-executing.
 *
 * Rollout note: the header is OPTIONAL for now so existing clients keep
 * working; requests without it pass straight through. Tighten to required
 * once the mobile release that sends keys has full adoption.
 */
import type { RequestHandler, Response } from 'express';
import { IdempotencyKey } from '../models/IdempotencyKey.js';
import { logger } from '../utils/logger.js';

const KEY_HEADER = 'idempotency-key';
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export const idempotency: RequestHandler = async (req, res, next) => {
  const key = req.header(KEY_HEADER);
  if (!key) return next(); // optional during rollout — see header comment
  if (!req.user) return next(); // requireAuth runs first; nothing to scope to
  if (!KEY_PATTERN.test(key)) {
    res.status(400).json({
      ok: false,
      error: { code: 'invalid_idempotency_key', message: 'Idempotency-Key must be 8–128 URL-safe characters.' },
    });
    return;
  }

  const route = `${req.method} ${req.baseUrl}${req.route?.path ?? req.path}`;

  // Claim the key. Unique index makes this atomic: exactly one request per
  // (user, key, route) wins the insert; the rest observe the existing doc.
  // Express 4 doesn't catch async rejections, so every await stays inside
  // try/catch → next(err).
  try {
    await IdempotencyKey.create([{ userId: req.user.id, key, route, state: 'pending' }]);
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) return next(err);
    try {
      const existing = await IdempotencyKey.findOne({ userId: req.user.id, key, route });
      if (existing?.state === 'completed' && existing.statusCode && existing.responseBody) {
        res.setHeader('Idempotency-Replayed', 'true');
        res.status(existing.statusCode).type('application/json').send(existing.responseBody);
        return;
      }
      res.status(409).json({
        ok: false,
        error: {
          code: 'idempotency_in_flight',
          message: 'The original request with this key is still processing. Retry shortly.',
        },
      });
      return;
    } catch (lookupErr) {
      return next(lookupErr);
    }
  }

  // Capture the JSON response so a retry can replay it.
  const originalJson = res.json.bind(res) as Response['json'];
  res.json = ((body: unknown) => {
    const result = originalJson(body);
    void IdempotencyKey.updateOne(
      { userId: req.user!.id, key, route },
      { $set: { state: 'completed', statusCode: res.statusCode, responseBody: JSON.stringify(body) } },
    ).catch((err) => logger.warn({ err, key }, '[idempotency] failed to store response'));
    return result;
  }) as Response['json'];

  next();
};
