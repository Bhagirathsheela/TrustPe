/**
 * Crypto helpers for OTP and refresh tokens.
 *
 * - Refresh tokens are 32 raw random bytes (256 bits) → hex string sent to client.
 *   We persist only the SHA-256 hash, so the database doesn't expose tokens
 *   even on dump.
 * - OTPs are 6-digit numeric for human entry; we persist a SHA-256 hash.
 * - Use timingSafeEqual for any comparison of secret material.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

export function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashSha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function generateOtp(): string {
  // 6 digits, leading zeros preserved.
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function generateFamilyId(): string {
  return uuidv4();
}

/** Constant-time comparison for two equal-length strings. Returns false if lengths differ. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
