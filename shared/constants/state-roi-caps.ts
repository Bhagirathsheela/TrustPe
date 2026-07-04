/**
 * State-wise interest rate caps under various Indian Moneylending Acts.
 *
 * Money lending is a State List subject (Entry 30, List II, Seventh Schedule).
 * Each state's Moneylending Act caps the interest rate that can be charged
 * to a borrower resident in that state. Conservative interpretation: the
 * borrower's state cap binds, regardless of where the lender or platform
 * sits.
 *
 * Values below are INDICATIVE and based on commonly cited public summaries
 * of each state's Act. Verify with current statute text before any
 * production use. See docs/REGULATIONS_AND_MONETIZATION.md §8.
 *
 * States not listed default to DEFAULT_STATE_ROI_CAP_PERCENT (36%, which
 * mirrors RBI's broader fair-practices guidance for unsecured personal
 * loans).
 */

export const STATE_ROI_CAPS_PERCENT: Record<string, number> = {
  Karnataka: 18, // Karnataka Prohibition of Charging Exorbitant Interest Act 2004
  Maharashtra: 21, // Bombay Moneylenders Act 1946 (unsecured personal)
  'Tamil Nadu': 15, // TN Moneylenders Act
  'West Bengal': 15, // Bengal Moneylenders Act
  Bengal: 15, // alias
  'Andhra Pradesh': 24, // AP Moneylenders Act
  Telangana: 24,
  Kerala: 24, // Kerala Money Lenders Act
  Gujarat: 24, // Bombay Moneylenders Act (Gujarat retains)
  'Madhya Pradesh': 24,
  Rajasthan: 24,
  Punjab: 24,
  Haryana: 24,
  'Uttar Pradesh': 24,
  Bihar: 24,
  Odisha: 24,
  Jharkhand: 24,
  Chhattisgarh: 24,
  Assam: 24,
  Delhi: 24, // NCT of Delhi — no specific cap law; RBI fair-practices guidance applied
};

/**
 * Default cap applied when the borrower's state is unknown or has no listed
 * statute. RBI's "fair practices" guidance and Supreme Court jurisprudence
 * on usurious rates both gravitate around 36% p.a. for unsecured personal
 * lending. This is also TrustPe's hard ceiling.
 */
export const DEFAULT_STATE_ROI_CAP_PERCENT = 36;

/**
 * Pull the state out of TrustPe's canonical "City, State, Country" city
 * string format. Returns null if the string doesn't have that shape.
 */
export function extractStateFromCity(cityString: string | null | undefined): string | null {
  if (!cityString) return null;
  const parts = cityString.split(',').map((p) => p.trim());
  return parts[1] ?? null;
}

export type RoiCapResolution = {
  /** State the borrower is in, or null if we couldn't determine it. */
  state: string | null;
  /** The effective cap to enforce, in % p.a. */
  cap: number;
  /** True if we matched the state to an explicit statute entry above. */
  hasExplicitCap: boolean;
};

/**
 * Resolve the binding ROI cap from a borrower's city string.
 *
 * Always returns a usable number — falls back to DEFAULT_STATE_ROI_CAP_PERCENT
 * when the state is unknown. `hasExplicitCap=false` means the cap came from
 * the default, not from a state-specific entry.
 */
export function getStateRoiCap(cityString: string | null | undefined): RoiCapResolution {
  const state = extractStateFromCity(cityString);
  if (!state) {
    return { state: null, cap: DEFAULT_STATE_ROI_CAP_PERCENT, hasExplicitCap: false };
  }
  const cap = STATE_ROI_CAPS_PERCENT[state];
  return {
    state,
    cap: cap ?? DEFAULT_STATE_ROI_CAP_PERCENT,
    hasExplicitCap: cap !== undefined,
  };
}
