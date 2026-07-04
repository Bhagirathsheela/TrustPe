/**
 * Loan detail — the operational hub for a live loan.
 *
 * Role + status aware:
 *   awaiting_agreement → both: sign the agreement
 *   awaiting_disbursal → lender: disburse; borrower: waiting copy
 *   active            → EMI schedule visible; borrower can pay next due EMI;
 *                       lender attests EMI receipts when they arrive
 *   closed            → completed schedule; loan archive view
 *
 * In-flight PaymentIntent gets surfaced as a banner with one-tap navigation
 * to the payment screen, regardless of which party initiated it.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heading } from '../../../components/Heading';
import { BodyText } from '../../../components/BodyText';
import { Button } from '../../../components/Button';
import { BackHeader } from '../../../components/BackHeader';
import { colors, radii, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth-context';
import { ApiError } from '../../../lib/api';

type Loan = {
  id: string;
  loanRequestId: string;
  acceptedOfferId: string;
  borrowerId: string;
  lenderId: string;
  amountPaise: number;
  tenureMonths: number;
  roiPercent: number;
  status: string;
  borrowerSnapshot: {
    name: string;
    city?: string;
    trustScore: number;
    trustBand: string;
  };
  lenderSnapshot: {
    name: string;
    city?: string;
    trustScore: number;
    trustBand: string;
  };
  agreedAt: string;
  disbursedAt?: string;
  closedAt?: string;
  agreementId?: string;
};

const STATUS_PILL: Record<string, { bg: string; ink: string; label: string }> = {
  awaiting_agreement: { bg: '#EFF6FF', ink: '#1E40AF', label: 'Awaiting agreement' },
  awaiting_disbursal: { bg: '#FFFBEB', ink: '#92400E', label: 'Awaiting disbursal' },
  active: { bg: '#ECFDF5', ink: '#065F46', label: 'Active' },
  closed: { bg: '#F1F5F9', ink: '#475569', label: 'Closed' },
  defaulted: { bg: '#FEF2F2', ink: '#991B1B', label: 'Defaulted' },
  cancelled: { bg: '#F1F5F9', ink: '#475569', label: 'Cancelled' },
};

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

type PaymentIntent = {
  id: string;
  kind: 'disbursal' | 'emi' | 'preclose';
  emiNumber?: number;
  payerId: string;
  payeeId: string;
  amountPaise: number;
  status:
    | 'awaiting_payer_evidence'
    | 'payer_confirmed'
    | 'verified'
    | 'failed'
    | 'expired'
    | 'disputed';
};

type EmiInstallment = {
  emiNumber: number;
  dueDate: string;
  amountPaise: number;
  principalPaise: number;
  interestPaise: number;
  status: 'pending' | 'paid' | 'overdue';
  paidAt?: string;
};

type EmiSchedule = {
  totalMonths: number;
  monthlyAmountPaise: number;
  totalInterestPaise: number;
  installments: EmiInstallment[];
};

export default function LoanDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const { apiCall, user } = useAuth();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<PaymentIntent[]>([]);
  const [schedule, setSchedule] = useState<EmiSchedule | null>(null);
  const [myReviewExists, setMyReviewExists] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [disbursing, setDisbursing] = useState(false);
  const [payingEmi, setPayingEmi] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiCall<Loan>({ path: `/loans/${id}` });
      setLoan(data);

      // Fetch payments unconditionally — most loans will have at least the
      // disbursal intent once the lender taps the button.
      try {
        const p = await apiCall<{ items: PaymentIntent[] }>({
          path: `/loans/${id}/payments`,
        });
        setPayments(p.items);
      } catch {
        setPayments([]);
      }

      // EMI schedule exists only after the loan goes active.
      if (data.status === 'active' || data.status === 'closed') {
        try {
          const s = await apiCall<EmiSchedule>({ path: `/loans/${id}/emis` });
          setSchedule(s);
        } catch {
          setSchedule(null);
        }
      }

      // For closed loans, check whether the viewer has already left a review.
      if (data.status === 'closed' || data.status === 'defaulted') {
        try {
          const mine = await apiCall<{ id: string } | null>({
            path: `/loans/${id}/reviews/mine`,
          });
          setMyReviewExists(!!mine?.id);
        } catch {
          setMyReviewExists(false);
        }
      }
    } catch (err) {
      Alert.alert("Couldn't load loan", err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiCall, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDisburse = async () => {
    if (!loan) return;
    setDisbursing(true);
    try {
      const intent = await apiCall<PaymentIntent>({
        path: `/loans/${loan.id}/disburse`,
        method: 'POST',
        idempotency: true,
      });
      router.push(`/payments/${intent.id}`);
    } catch (err) {
      Alert.alert(
        "Couldn't start disbursal",
        err instanceof ApiError ? err.message : 'Try again.',
      );
    } finally {
      setDisbursing(false);
    }
  };

  const onPayEmi = async (emiNumber: number) => {
    if (!loan) return;
    setPayingEmi(emiNumber);
    try {
      const intent = await apiCall<PaymentIntent>({
        path: `/loans/${loan.id}/emi-payments`,
        method: 'POST',
        body: { emiNumber },
        idempotency: true,
      });
      router.push(`/payments/${intent.id}`);
    } catch (err) {
      Alert.alert(
        "Couldn't start EMI payment",
        err instanceof ApiError ? err.message : 'Try again.',
      );
    } finally {
      setPayingEmi(null);
    }
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
  if (!loan) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <BodyText variant="bodyMuted">Loan not found.</BodyText>
        </View>
      </SafeAreaView>
    );
  }

  const isBorrower = user?.id === loan.borrowerId;
  const statusStyle = STATUS_PILL[loan.status] ?? STATUS_PILL.awaiting_disbursal!;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BackHeader fallback="/loans/mine" />

        <View style={styles.statusRow}>
          <BodyText variant="bodyMuted">{isBorrower ? 'You owe' : 'You lent'}</BodyText>
          <View style={[styles.pill, { backgroundColor: statusStyle.bg }]}>
            <BodyText style={[styles.pillText, { color: statusStyle.ink }]}>
              {statusStyle.label}
            </BodyText>
          </View>
        </View>

        <Heading style={{ marginTop: spacing.sm }}>{formatRupees(loan.amountPaise)}</Heading>
        <BodyText variant="bodyMuted">
          {loan.tenureMonths} month{loan.tenureMonths > 1 ? 's' : ''} · {loan.roiPercent}% p.a.
        </BodyText>

        <View style={styles.partiesCard}>
          <PartyRow
            role="Borrower"
            name={loan.borrowerSnapshot.name}
            city={loan.borrowerSnapshot.city}
            trust={`${loan.borrowerSnapshot.trustBand} · ${loan.borrowerSnapshot.trustScore}`}
            you={isBorrower}
            onPress={() => router.push(`/users/${loan.borrowerId}`)}
          />
          <View style={styles.divider} />
          <PartyRow
            role="Lender"
            name={loan.lenderSnapshot.name}
            city={loan.lenderSnapshot.city}
            trust={`${loan.lenderSnapshot.trustBand} · ${loan.lenderSnapshot.trustScore}`}
            you={!isBorrower}
            onPress={() => router.push(`/users/${loan.lenderId}`)}
          />
        </View>

        <View style={styles.factsCard}>
          <Row label="Agreed" value={new Date(loan.agreedAt).toLocaleString()} />
          {loan.disbursedAt ? (
            <Row label="Disbursed" value={new Date(loan.disbursedAt).toLocaleString()} />
          ) : null}
          {loan.closedAt ? (
            <Row label="Closed" value={new Date(loan.closedAt).toLocaleString()} />
          ) : null}
          <Row label="Loan ID" value={loan.id} mono />
        </View>

        {loan.status === 'awaiting_agreement' ? (
          <View style={styles.nextCard}>
            <Heading level="h3">Sign the agreement</Heading>
            <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
              Both parties need to sign the loan agreement before disbursal. You can read,
              sign, and check the other party&apos;s status on the agreement screen.
            </BodyText>
            <Button onPress={() => router.push(`/agreement/${loan.id}`)}>
              Open agreement
            </Button>
          </View>
        ) : null}

        {/* Open payment intent banner — surface any non-terminal in-flight payment */}
        {(() => {
          const live = payments.find(
            (p) => p.status === 'awaiting_payer_evidence' || p.status === 'payer_confirmed',
          );
          if (!live) return null;
          const youArePayer = user?.id === live.payerId;
          const youArePayee = user?.id === live.payeeId;
          let copy = '';
          if (live.status === 'awaiting_payer_evidence') {
            copy = youArePayer
              ? `Action needed: pay ${formatRupees(live.amountPaise)} via UPI`
              : `Awaiting payment of ${formatRupees(live.amountPaise)}`;
          } else if (live.status === 'payer_confirmed') {
            copy = youArePayee
              ? `Action needed: confirm ${formatRupees(live.amountPaise)} receipt`
              : `Awaiting receiver confirmation of ${formatRupees(live.amountPaise)}`;
          }
          const tone = (youArePayer && live.status === 'awaiting_payer_evidence') ||
            (youArePayee && live.status === 'payer_confirmed')
            ? 'action'
            : 'wait';
          return (
            <Pressable
              onPress={() => router.push(`/payments/${live.id}`)}
              style={({ pressed }) => [
                styles.intentBanner,
                tone === 'action' ? styles.intentBannerAction : styles.intentBannerWait,
                pressed && { opacity: 0.85 },
              ]}
            >
              <BodyText style={styles.intentBannerText}>
                {tone === 'action' ? '⚡ ' : '⏳ '}
                {copy}
              </BodyText>
              <BodyText variant="caption" color={colors.inkMuted}>
                Tap to open
              </BodyText>
            </Pressable>
          );
        })()}

        {loan.status === 'awaiting_disbursal' && !isBorrower ? (
          <View style={styles.nextCard}>
            <Heading level="h3">Disburse via UPI</Heading>
            <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
              Both parties signed the agreement. Send {formatRupees(loan.amountPaise)} to the
              borrower's UPI ID. After they confirm receipt, the loan goes active and the EMI
              schedule begins.
            </BodyText>
            <Button onPress={onDisburse} loading={disbursing}>
              Start disbursal · {formatRupees(loan.amountPaise)}
            </Button>
          </View>
        ) : null}

        {loan.status === 'awaiting_disbursal' && isBorrower ? (
          <View style={styles.nextCard}>
            <Heading level="h3">Awaiting disbursal</Heading>
            <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm }}>
              Both sides signed. The lender will disburse {formatRupees(loan.amountPaise)} via
              UPI. You'll be asked to confirm receipt as soon as the lender marks it sent.
            </BodyText>
          </View>
        ) : null}

        {/* Loan-closed review prompt */}
        {(loan.status === 'closed' || loan.status === 'defaulted') && !myReviewExists ? (
          <View style={styles.reviewPromptCard}>
            <Heading level="h3">⭐ Rate your experience</Heading>
            <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
              The loan is complete. Leave a review for{' '}
              {isBorrower ? loan.lenderSnapshot.name : loan.borrowerSnapshot.name} — your rating
              directly affects their TrustScore and helps the rest of the network.
            </BodyText>
            <Button onPress={() => router.push(`/reviews/new?loanId=${loan.id}`)}>
              Leave a review
            </Button>
          </View>
        ) : null}

        {(loan.status === 'closed' || loan.status === 'defaulted') && myReviewExists ? (
          <View style={[styles.reviewPromptCard, styles.reviewDoneCard]}>
            <BodyText style={{ fontWeight: '700' }}>✓ You reviewed this loan</BodyText>
            <BodyText variant="bodyMuted" style={{ marginTop: spacing.xs }}>
              Tap the {isBorrower ? "lender's" : "borrower's"} name above to see your review on
              their public profile.
            </BodyText>
          </View>
        ) : null}

        {/* EMI schedule — active or closed loans */}
        {schedule ? (
          <View style={styles.scheduleCard}>
            <View style={styles.scheduleHeader}>
              <Heading level="h3">EMI schedule</Heading>
              <BodyText variant="caption" color={colors.inkMuted}>
                {schedule.installments.filter((i) => i.status === 'paid').length}/
                {schedule.totalMonths} paid
              </BodyText>
            </View>
            <BodyText variant="bodyMuted" style={{ marginBottom: spacing.md }}>
              Monthly EMI {formatRupees(schedule.monthlyAmountPaise)} · Total interest{' '}
              {formatRupees(schedule.totalInterestPaise)}
            </BodyText>

            {schedule.installments.map((inst) => {
              const isPaid = inst.status === 'paid';
              const isOverdue =
                !isPaid && new Date(inst.dueDate).getTime() < Date.now();
              const intentForThis = payments.find(
                (p) =>
                  p.kind === 'emi' &&
                  p.emiNumber === inst.emiNumber &&
                  (p.status === 'awaiting_payer_evidence' || p.status === 'payer_confirmed'),
              );
              return (
                <View
                  key={inst.emiNumber}
                  style={[
                    styles.installmentRow,
                    isPaid && styles.installmentPaid,
                    isOverdue && styles.installmentOverdue,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <BodyText style={{ fontWeight: '700' }}>
                      EMI #{inst.emiNumber} · {formatRupees(inst.amountPaise)}
                    </BodyText>
                    <BodyText variant="caption" color={colors.inkMuted}>
                      Due {new Date(inst.dueDate).toLocaleDateString()}
                      {isPaid && inst.paidAt
                        ? ` · Paid ${new Date(inst.paidAt).toLocaleDateString()}`
                        : isOverdue
                          ? ' · Overdue'
                          : ''}
                    </BodyText>
                  </View>
                  {isPaid ? (
                    <BodyText style={{ color: '#065F46', fontWeight: '700' }}>✓</BodyText>
                  ) : intentForThis ? (
                    <Pressable
                      onPress={() => router.push(`/payments/${intentForThis.id}`)}
                      style={({ pressed }) => [styles.emiAction, pressed && { opacity: 0.7 }]}
                    >
                      <BodyText style={styles.emiActionText}>Open</BodyText>
                    </Pressable>
                  ) : isBorrower && loan.status === 'active' ? (
                    <Pressable
                      onPress={() => onPayEmi(inst.emiNumber)}
                      disabled={payingEmi !== null}
                      style={({ pressed }) => [
                        styles.emiAction,
                        styles.emiActionPrimary,
                        pressed && { opacity: 0.85 },
                        payingEmi !== null && { opacity: 0.5 },
                      ]}
                    >
                      <BodyText style={[styles.emiActionText, { color: colors.white }]}>
                        {payingEmi === inst.emiNumber ? 'Starting…' : 'Pay'}
                      </BodyText>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={{ marginTop: spacing.lg }}>
          <Button onPress={() => router.push(`/chat/${loan.id}`)}>
            Open chat with {isBorrower ? loan.lenderSnapshot.name : loan.borrowerSnapshot.name}
          </Button>
          {/* "View agreement" lives in the prominent yellow card above when
              the agreement is still pending — no need to duplicate the action
              here. After signing, the same agreement is read-only and a
              secondary "View" link makes sense. */}
          {loan.status !== 'awaiting_agreement' ? (
            <>
              <View style={{ height: spacing.sm }} />
              <Button variant="secondary" onPress={() => router.push(`/agreement/${loan.id}`)}>
                View signed agreement
              </Button>
            </>
          ) : null}
          <View style={{ height: spacing.sm }} />
          <Button variant="secondary" onPress={() => router.push(`/loan-requests/${loan.loanRequestId}`)}>
            View original request
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PartyRow({
  role,
  name,
  city,
  trust,
  you,
  onPress,
}: {
  role: string;
  name: string;
  city?: string;
  trust: string;
  you: boolean;
  onPress?: () => void;
}) {
  const Wrapper: typeof View = onPress ? (Pressable as unknown as typeof View) : View;
  const wrapperProps = onPress ? { onPress } : {};
  return (
    <Wrapper {...wrapperProps}>
      <BodyText variant="caption" color={colors.inkMuted}>
        {role.toUpperCase()}
        {you ? ' · YOU' : ''}
        {onPress && !you ? '  →  TAP TO VIEW PROFILE' : ''}
      </BodyText>
      <BodyText style={{ marginTop: spacing.xs, fontWeight: '700', fontSize: 16 }}>{name}</BodyText>
      <BodyText variant="bodyMuted" style={{ marginTop: 2 }}>
        {city ? `${city} · ` : ''}TrustScore {trust}
      </BodyText>
    </Wrapper>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <BodyText variant="caption" color={colors.inkMuted}>
        {label}
      </BodyText>
      <BodyText
        style={{
          fontWeight: '600',
          fontFamily: mono ? 'monospace' : undefined,
          flexShrink: 1,
          marginLeft: spacing.lg,
          textAlign: 'right',
        }}
        numberOfLines={1}
      >
        {value}
      </BodyText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  pill: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.pill },
  pillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  partiesCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  factsCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  nextCard: {
    marginTop: spacing.lg,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  intentBanner: {
    marginTop: spacing.lg,
    borderRadius: radii.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  intentBannerAction: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
  },
  intentBannerWait: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
  },
  intentBannerText: { fontWeight: '700', flex: 1 },
  scheduleCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  installmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  installmentPaid: { backgroundColor: '#ECFDF5' },
  installmentOverdue: { backgroundColor: '#FEF2F2' },
  emiAction: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emiActionPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  emiActionText: { fontWeight: '700', fontSize: 13 },
  reviewPromptCard: {
    marginTop: spacing.lg,
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  reviewDoneCard: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
});
