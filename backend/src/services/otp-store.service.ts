/**
 * OTP storage service.
 *
 * Phase 1 default: in-memory Map keyed by email. Single-process Render free
 * tier means this is fine — restart wipes pending OTPs which is acceptable UX
 * (user requests a new one).
 *
 * Phase 3 (Redis online): swap implementation to Redis without touching auth
 * service. See ARCHITECTURE.md §6.2 adapter discipline.
 */
import { hashSha256, safeEqual } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

type StoredOtp = {
  hash: string;
  attempts: number;
  expiresAt: number; // epoch ms
};

const MAX_ATTEMPTS = 5;
const TTL_MS = 5 * 60 * 1000;

const store = new Map<string, StoredOtp>();

/** Issue a new OTP for the key (typically email). Returns the raw OTP for delivery. */
export const otpStoreService = {
  set(key: string, otp: string): void {
    store.set(key, {
      hash: hashSha256(otp),
      attempts: 0,
      expiresAt: Date.now() + TTL_MS,
    });
  },

  /**
   * Try to consume an OTP. Returns:
   *  - 'verified' on match (entry deleted)
   *  - 'incorrect' on mismatch (attempts incremented)
   *  - 'expired' if past TTL (entry deleted)
   *  - 'too_many_attempts' if attempts maxed (entry deleted)
   *  - 'not_found' if no entry for the key
   */
  verify(key: string, otp: string): 'verified' | 'incorrect' | 'expired' | 'too_many_attempts' | 'not_found' {
    const entry = store.get(key);
    if (!entry) return 'not_found';

    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return 'expired';
    }

    entry.attempts += 1;
    if (entry.attempts > MAX_ATTEMPTS) {
      store.delete(key);
      return 'too_many_attempts';
    }

    if (safeEqual(hashSha256(otp), entry.hash)) {
      store.delete(key);
      return 'verified';
    }
    return 'incorrect';
  },

  clear(key: string): void {
    store.delete(key);
  },

  // Test-only — wipe everything between tests.
  _reset(): void {
    store.clear();
  },
};

// Periodic cleanup of expired entries (non-essential — verify() also handles it).
setInterval(() => {
  const now = Date.now();
  let removed = 0;
  for (const [k, v] of store.entries()) {
    if (v.expiresAt < now) {
      store.delete(k);
      removed += 1;
    }
  }
  if (removed > 0) logger.debug({ removed }, 'Swept expired OTP entries');
}, 60 * 1000).unref();
