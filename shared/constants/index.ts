/**
 * Shared constants used by backend + mobile + admin.
 *
 * All values that drive business behavior (tier caps, score thresholds, penalties,
 * grace periods, expiry windows) live here OR in the backend `feature_flags`
 * collection. Things in this file are compile-time constants the frontend uses
 * for input validation and display.
 */

// Loan amount limits in paise
export const MIN_LOAN_AMOUNT_PAISE = 500_000; // ₹5,000
export const MAX_LOAN_AMOUNT_PAISE = 5_000_000; // ₹50,000

// Loan tenure limits in months
export const MIN_LOAN_TENURE_MONTHS = 1;
export const MAX_LOAN_TENURE_MONTHS = 6;

// Interest rate cap (annual percentage)
export const MAX_LOAN_ROI_PERCENT = 36;

// TrustScore bands (300–900 CIBIL-style)
export const TRUST_SCORE_MIN = 300;
export const TRUST_SCORE_MAX = 900;
export const TRUST_SCORE_BANDS = {
  building: { min: 300, max: 549, label: 'Building' },
  fair: { min: 550, max: 649, label: 'Fair' },
  good: { min: 650, max: 749, label: 'Good' },
  veryGood: { min: 750, max: 849, label: 'Very Good' },
  excellent: { min: 850, max: 900, label: 'Excellent' },
} as const;

export type TrustBand = 'building' | 'fair' | 'good' | 'very_good' | 'excellent';

/** Resolve a band from a numeric TrustScore. Inputs outside [300,900] clamp. */
export function bandFromScore(score: number): TrustBand {
  const s = Math.max(TRUST_SCORE_MIN, Math.min(TRUST_SCORE_MAX, score));
  if (s >= 850) return 'excellent';
  if (s >= 750) return 'very_good';
  if (s >= 650) return 'good';
  if (s >= 550) return 'fair';
  return 'building';
}

/** Clamp a TrustScore into the valid [300, 900] range. */
export function clampTrustScore(score: number): number {
  return Math.max(TRUST_SCORE_MIN, Math.min(TRUST_SCORE_MAX, Math.round(score)));
}

// Re-export curated lists used by the mobile UI
export * from './cities';
export * from './occupation-roles';
export * from './state-roi-caps';

// Eligibility tier caps in paise
export const TIER_CAPS_PAISE = {
  T0: 500_000, // ₹5,000
  T1: 1_000_000, // ₹10,000
  T2: 2_500_000, // ₹25,000
  T3: 5_000_000, // ₹50,000
  T4: 10_000_000, // ₹1,00,000 (Phase 3+)
} as const;
