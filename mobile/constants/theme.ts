/**
 * Theme tokens — single source of truth for colors, spacing, type.
 * Mirrors what `apps/admin/tailwind.config.ts` uses on the web side.
 */

export const colors = {
  ink: '#0F172A',
  inkMuted: '#475569',
  inkSubtle: '#94A3B8',
  border: '#E2E8F0',
  paper: '#F8FAFC',
  white: '#FFFFFF',
  accent: '#2563EB',
  accentMuted: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  // TrustScore band colors — used by TrustScoreBadge later.
  band: {
    building: '#94A3B8',
    fair: '#F59E0B',
    good: '#10B981',
    veryGood: '#059669',
    excellent: '#FBBF24',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  h1: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  h2: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  h3: { fontSize: 17, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyMuted: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
} as const;
