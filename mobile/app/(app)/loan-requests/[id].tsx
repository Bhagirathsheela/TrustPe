/**
 * Loan request detail.
 *
 * Role-aware:
 *   - Borrower (owner): sees the request, can cancel while still open. If
 *     someone funded it, link to the new loan.
 *   - Lender: sees borrower info + state ROI cap context + a single "Fund"
 *     button that routes to the confirm screen.
 *
 * No more thread / negotiation UI — the simplified fixed-rate flow is a
 * single decision.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LOAN_PURPOSE_LABELS, type LoanPurpose } from 'trustpe-shared';
import { Heading } from '../../../components/Heading';
import { BodyText } from '../../../components/BodyText';
import { Button } from '../../../components/Button';
import { BackHeader } from '../../../components/BackHeader';
import { colors, radii, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth-context';
import { ApiError } from '../../../lib/api';

type DetailResponse = {
  id: string;
  borrowerId: string;
  amountPaise: number;
  tenureMonths: number;
  roiPercent: number;
  purpose: LoanPurpose;
  purposeDetail?: string;
  status: string;
  snapshot: {
    borrowerName: string;
    borrowerCity?: string;
    borrowerState?: string;
    borrowerStateRoiCap: number;
    borrowerTrustScore: number;
    borrowerTrustBand: string;
  };
  offersCount: number;
  publishedAt: string;
  expiresAt: string;
  matchedAt?: string;
  cancelledAt?: string;
  cancelledReason?: string;
};

const STATUS_STYLES: Record<string, { bg: string; ink: string; label: string }> = {
  open: { bg: '#ECFDF5', ink: '#065F46', label: 'Open' },
  matched: { bg: '#F5F3FF', ink: '#5B21B6', label: 'Funded' },
  cancelled: { bg: '#F1F5F9', ink: '#475569', label: 'Cancelled' },
  expired: { bg: '#F1F5F9', ink: '#475569', label: 'Expired' },
};

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default function LoanRequestDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const { apiCall, user } = useAuth();
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loanId, setLoanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiCall<DetailResponse>({ path: `/loan-requests/${id}` });
      setDetail(data);

      // If matched, try to surface the loan id for both parties.
      if (data.status === 'matched' && user) {
        try {
          const mine = await apiCall<{ items: { id: string; loanRequestId: string }[] }>({
            path: '/loans/mine',
          });
          const here = mine.items.find((l) => l.loanRequestId === data.id);
          setLoanId(here?.id ?? null);
        } catch {
          setLoanId(null);
        }
      }
    } catch (err) {
      Alert.alert("Couldn't load request", err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiCall, id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCancel = async () => {
    if (!detail) return;
    Alert.alert(
      'Cancel this request?',
      'Lenders will no longer see this request. You can publish a new one anytime.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel request',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await apiCall({
                path: `/loan-requests/${detail.id}/cancel`,
                method: 'POST',
                body: { reason: 'borrower_cancelled' },
              });
              router.replace('/loan-requests/mine');
            } catch (err) {
              const message =
                err instanceof ApiError
                  ? err.message
                  : err instanceof Error
                    ? err.message
                    : 'Something went wrong.';
              Alert.alert("Couldn't cancel", message);
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <BodyText variant="bodyMuted">Loading…</BodyText>
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <BodyText variant="bodyMuted">Request not found.</BodyText>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = user?.id === detail.borrowerId;
  const statusStyle = STATUS_STYLES[detail.status] ?? STATUS_STYLES.open!;
  const canCancel = isOwner && detail.status === 'open';
  const canFund = !isOwner && detail.status === 'open';
  const isMatched = detail.status === 'matched';
  const showStateChip =
    !!detail.snapshot.borrowerState &&
    detail.snapshot.borrowerStateRoiCap <= 36;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BackHeader fallback={isOwner ? '/loan-requests/mine' : '/loan-requests/browse'} />

        <View style={styles.row}>
          <Heading>{formatRupees(detail.amountPaise)}</Heading>
          <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
            <BodyText style={[styles.statusText, { color: statusStyle.ink }]}>
              {statusStyle.label}
            </BodyText>
          </View>
        </View>

        <BodyText variant="bodyMuted" style={{ marginBottom: spacing.lg }}>
          for {detail.tenureMonths} month{detail.tenureMonths > 1 ? 's' : ''} ·{' '}
          {detail.roiPercent}% p.a.
        </BodyText>

        {!isOwner ? (
          <View style={styles.borrowerCard}>
            <BodyText variant="caption" color={colors.inkMuted}>
              BORROWER
            </BodyText>
            <Heading level="h3" style={{ marginTop: spacing.xs }}>
              {detail.snapshot.borrowerName}
            </Heading>
            <BodyText variant="bodyMuted">
              {detail.snapshot.borrowerCity ? `${detail.snapshot.borrowerCity} · ` : ''}
              TrustScore {detail.snapshot.borrowerTrustScore} · {detail.snapshot.borrowerTrustBand}
            </BodyText>
            {showStateChip ? (
              <View style={styles.capChip}>
                <BodyText style={styles.capChipText}>
                  📜 {detail.snapshot.borrowerState} caps moneylender interest at{' '}
                  {detail.snapshot.borrowerStateRoiCap}% p.a.
                </BodyText>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.factsGrid}>
          <Fact label="Purpose" value={LOAN_PURPOSE_LABELS[detail.purpose] ?? detail.purpose} />
          <Fact label="Interest" value={`${detail.roiPercent}% p.a.`} />
          <Fact label="Published" value={new Date(detail.publishedAt).toLocaleDateString()} />
          <Fact label="Expires" value={new Date(detail.expiresAt).toLocaleDateString()} />
        </View>

        {detail.purposeDetail ? (
          <View style={styles.notesCard}>
            <BodyText variant="caption" color={colors.inkMuted} style={{ marginBottom: spacing.xs }}>
              NOTES FROM BORROWER
            </BodyText>
            <BodyText>{detail.purposeDetail}</BodyText>
          </View>
        ) : null}

        {detail.cancelledReason ? (
          <BodyText variant="bodyMuted" style={{ marginTop: spacing.lg }}>
            Cancellation reason: {detail.cancelledReason}
          </BodyText>
        ) : null}

        {isMatched ? (
          <View style={styles.matchedCard}>
            <Heading level="h3">Funded</Heading>
            <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm }}>
              {isOwner
                ? 'A lender funded your request. Open the loan to track agreement, disbursal, and EMIs.'
                : 'This request was funded. Open the loan to track agreement, disbursal, and EMIs.'}
            </BodyText>
            {loanId ? (
              <View style={{ marginTop: spacing.md }}>
                <Button onPress={() => router.push(`/loans/${loanId}`)}>Open loan</Button>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ marginTop: spacing.xl }}>
          {canFund ? (
            <Button onPress={() => router.push(`/loan-offers/new?requestId=${detail.id}`)}>
              Fund this loan · {formatRupees(detail.amountPaise)}
            </Button>
          ) : null}
          {canCancel ? (
            <>
              <View style={{ height: spacing.md }} />
              <Button variant="secondary" onPress={onCancel} loading={cancelling}>
                Cancel request
              </Button>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <BodyText variant="caption" color={colors.inkMuted}>
        {label.toUpperCase()}
      </BodyText>
      <BodyText style={{ marginTop: spacing.xs, fontWeight: '600' }}>{value}</BodyText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  borrowerCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  capChip: {
    marginTop: spacing.md,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  capChipText: { fontSize: 12, color: '#1E40AF', fontWeight: '600' },
  factsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  fact: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  notesCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  matchedCard: {
    marginTop: spacing.lg,
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
});
