/**
 * Eligibility service — the single source of truth for "can this user
 * borrow / lend up to X?"
 *
 * Phase 1 rules — simple ladder mapped to TrustScore bands:
 *
 *   Building   (300-549) → T0  ₹5,000
 *   Fair       (550-649) → T1  ₹10,000
 *   Good       (650-749) → T2  ₹25,000
 *   Very Good  (750-849) → T3  ₹50,000
 *   Excellent  (850-900) → T3  ₹50,000 in Phase 1 (T4 ₹1,00,000 in Phase 3+)
 *
 * The borrower's max is the lower of (their tier cap, the global cap from
 * shared constants). KYC must be approved and the account must be active.
 *
 * See ARCHITECTURE.md §6.4.
 */
import { TIER_CAPS_PAISE, MAX_LOAN_AMOUNT_PAISE } from 'trustpe-shared';
import type { UserDocument } from '../models/User.js';

export type EligibilityResult = {
  ok: boolean;
  reason?: string;
  reasonCode?: string;
  tier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4';
  maxBorrowPaise: number;
};

function tierFromTrustScore(score: number): EligibilityResult['tier'] {
  if (score >= 750) return 'T3';
  if (score >= 650) return 'T2';
  if (score >= 550) return 'T1';
  return 'T0';
}

export const eligibilityService = {
  /**
   * Returns the user's borrow eligibility. `ok=false` carries the human-
   * readable reason; the tier and cap are always returned so the UI can show
   * "you're cleared up to ₹X."
   */
  forBorrow(user: UserDocument): EligibilityResult {
    const score = user.trustScore ?? 300;
    const tier = tierFromTrustScore(score);
    const tierCap = TIER_CAPS_PAISE[tier];
    const maxBorrowPaise = Math.min(tierCap, MAX_LOAN_AMOUNT_PAISE);

    if (user.status === 'suspended') {
      return {
        ok: false,
        reason: 'Your account is suspended. Contact support.',
        reasonCode: 'user_suspended',
        tier,
        maxBorrowPaise,
      };
    }
    if (user.status !== 'active') {
      return {
        ok: false,
        reason: 'Complete onboarding before requesting a loan.',
        reasonCode: 'user_not_active',
        tier,
        maxBorrowPaise,
      };
    }
    if (user.kycStatus !== 'approved') {
      return {
        ok: false,
        reason: 'Your KYC must be approved before requesting a loan.',
        reasonCode: 'kyc_not_approved',
        tier,
        maxBorrowPaise,
      };
    }

    return { ok: true, tier, maxBorrowPaise };
  },

  /**
   * Lenders need to be active + KYC-approved (same as borrowers). We don't
   * gate by TrustScore for lenders in Phase 1 — anyone can offer if they're
   * cleared.
   */
  forLend(user: UserDocument): { ok: boolean; reason?: string; reasonCode?: string } {
    if (user.status === 'suspended') {
      return {
        ok: false,
        reason: 'Your account is suspended. Contact support.',
        reasonCode: 'user_suspended',
      };
    }
    if (user.status !== 'active') {
      return {
        ok: false,
        reason: 'Complete onboarding before making an offer.',
        reasonCode: 'user_not_active',
      };
    }
    if (user.kycStatus !== 'approved') {
      return {
        ok: false,
        reason: 'Your KYC must be approved before making an offer.',
        reasonCode: 'kyc_not_approved',
      };
    }
    return { ok: true };
  },
};
