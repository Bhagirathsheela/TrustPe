/**
 * LoanRequestCard — reusable summary card used in browse + mine lists.
 *
 * Fixed-rate model: shows the single ROI prominently. Optionally surfaces the
 * borrower's state moneylending cap as a small context chip so lenders
 * understand the legal ceiling.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { BodyText } from './BodyText';
import { colors, radii, spacing } from '../constants/theme';

export type LoanRequestSummary = {
  id: string;
  amountPaise: number;
  tenureMonths: number;
  roiPercent: number;
  purpose: string;
  status: string;
  snapshot: {
    borrowerName: string;
    borrowerCity?: string;
    borrowerState?: string;
    borrowerStateRoiCap?: number;
    borrowerTrustScore: number;
    borrowerTrustBand: string;
  };
  offersCount: number;
  publishedAt: string;
};

const PURPOSE_LABELS: Record<string, string> = {
  medical: 'Medical',
  education: 'Education',
  home_improvement: 'Home repair',
  business: 'Business',
  debt_consolidation: 'Debt consolidation',
  family_event: 'Family event',
  emergency: 'Emergency',
  travel: 'Travel',
  electronics: 'Electronics',
  other: 'Other',
};

const STATUS_STYLES: Record<string, { bg: string; ink: string; label: string }> = {
  open: { bg: '#ECFDF5', ink: '#065F46', label: 'Open' },
  matched: { bg: '#F5F3FF', ink: '#5B21B6', label: 'Funded' },
  cancelled: { bg: '#F1F5F9', ink: '#475569', label: 'Cancelled' },
  expired: { bg: '#F1F5F9', ink: '#475569', label: 'Expired' },
};

const BAND_LABELS: Record<string, string> = {
  building: 'Building',
  fair: 'Fair',
  good: 'Good',
  very_good: 'Very Good',
  excellent: 'Excellent',
};

const BAND_COLORS: Record<string, string> = {
  building: '#94A3B8',
  fair: '#F59E0B',
  good: '#10B981',
  very_good: '#059669',
  excellent: '#FBBF24',
};

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function LoanRequestCard({
  item,
  variant = 'browse',
  onPress,
}: {
  item: LoanRequestSummary;
  variant?: 'browse' | 'mine';
  onPress: () => void;
}) {
  const statusStyle = STATUS_STYLES[item.status] ?? STATUS_STYLES.open!;
  const showStateChip =
    variant === 'browse' &&
    !!item.snapshot.borrowerState &&
    typeof item.snapshot.borrowerStateRoiCap === 'number' &&
    item.snapshot.borrowerStateRoiCap < 36;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>
      <View style={styles.row}>
        <BodyText style={styles.amount}>{formatRupees(item.amountPaise)}</BodyText>
        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
          <BodyText style={[styles.statusText, { color: statusStyle.ink }]}>
            {statusStyle.label}
          </BodyText>
        </View>
      </View>

      <BodyText variant="bodyMuted" style={styles.meta}>
        {item.tenureMonths} mo · <BodyText style={{ fontWeight: '700', color: colors.ink }}>{item.roiPercent}% p.a.</BodyText> ·{' '}
        {PURPOSE_LABELS[item.purpose] ?? item.purpose}
      </BodyText>

      <View style={styles.footer}>
        {variant === 'browse' ? (
          <View style={styles.borrowerRow}>
            <BodyText style={styles.borrowerName}>{item.snapshot.borrowerName}</BodyText>
            {item.snapshot.borrowerCity ? (
              <BodyText variant="caption" color={colors.inkMuted}>
                {' · '}
                {item.snapshot.borrowerCity}
              </BodyText>
            ) : null}
            <View
              style={[
                styles.bandPill,
                { backgroundColor: BAND_COLORS[item.snapshot.borrowerTrustBand] ?? colors.border },
              ]}
            >
              <BodyText style={styles.bandText}>
                {BAND_LABELS[item.snapshot.borrowerTrustBand] ?? item.snapshot.borrowerTrustBand} ·{' '}
                {item.snapshot.borrowerTrustScore}
              </BodyText>
            </View>
          </View>
        ) : (
          <BodyText variant="caption" color={colors.inkMuted}>
            {item.offersCount > 0 ? `${item.offersCount} viewed` : 'Awaiting funding'}
          </BodyText>
        )}
        <BodyText variant="caption" color={colors.inkMuted}>
          {timeAgo(item.publishedAt)}
        </BodyText>
      </View>

      {showStateChip ? (
        <View style={styles.capChip}>
          <BodyText style={styles.capChipText}>
            📜 {item.snapshot.borrowerState} cap: {item.snapshot.borrowerStateRoiCap}% p.a.
          </BodyText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  amount: { fontSize: 22, fontWeight: '700', color: colors.ink },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  meta: { marginBottom: spacing.md },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  borrowerRow: { flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'wrap', gap: 6 },
  borrowerName: { fontWeight: '600', fontSize: 14, color: colors.ink },
  bandPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    marginLeft: spacing.sm,
  },
  bandText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  capChip: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#EFF6FF',
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
  },
  capChipText: { fontSize: 11, color: '#1E40AF', fontWeight: '600' },
});
