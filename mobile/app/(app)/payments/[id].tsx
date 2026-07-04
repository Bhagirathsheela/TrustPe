/**
 * Payment intent screen — the operational surface of a UPI payment.
 *
 * Role-aware:
 *   PAYER, status=awaiting_payer_evidence  → "Open UPI app to pay" + "I paid" / "Failed" buttons
 *   PAYER, status=payer_confirmed          → "Awaiting receiver confirmation"
 *   PAYEE, status=awaiting_payer_evidence  → "Waiting for payer to send"
 *   PAYEE, status=payer_confirmed          → "Confirm receipt?" Yes / Not received
 *   ANY,   status=verified | failed | disputed → terminal state copy
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { Heading } from '../../../components/Heading';
import { BodyText } from '../../../components/BodyText';
import { Button } from '../../../components/Button';
import { TextInput } from '../../../components/TextInput';
import { BackHeader } from '../../../components/BackHeader';
import { UtrGuideSheet } from '../../../components/UtrGuideSheet';
import { colors, radii, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth-context';
import { ApiError } from '../../../lib/api';
import { openUpiIntent } from '../../../lib/upi-intent';

type Intent = {
  id: string;
  loanId: string;
  kind: 'disbursal' | 'emi' | 'preclose';
  emiNumber?: number;
  payerId: string;
  payeeId: string;
  payerVpa: string;
  payeeVpa: string;
  payeeName: string;
  amountPaise: number;
  referenceId: string;
  status:
    | 'awaiting_payer_evidence'
    | 'payer_confirmed'
    | 'verified'
    | 'failed'
    | 'expired'
    | 'disputed';
  upiUrl: string;
  payerEvidence?: { utr?: string; note?: string; submittedAt?: string };
  receiverAttestation?: { decision: 'received' | 'not_received'; submittedAt?: string };
  failureReason?: string;
  createdAt: string;
  expiresAt: string;
};

const STATUS_PILL: Record<string, { bg: string; ink: string; label: string }> = {
  awaiting_payer_evidence: { bg: '#FFFBEB', ink: '#92400E', label: 'Awaiting payment' },
  payer_confirmed: { bg: '#EFF6FF', ink: '#1E40AF', label: 'Awaiting confirmation' },
  verified: { bg: '#ECFDF5', ink: '#065F46', label: '✓ Verified' },
  failed: { bg: '#FEF2F2', ink: '#991B1B', label: 'Failed' },
  expired: { bg: '#F1F5F9', ink: '#475569', label: 'Expired' },
  disputed: { bg: '#FEF2F2', ink: '#991B1B', label: 'Disputed' },
};

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

type EvidenceForm = { utr: string; note: string; amountConfirmed: boolean };
type FailureForm = { reason: string };
type AttestationForm = { reason: string };

export default function PaymentDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const { apiCall, user } = useAuth();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | 'launch' | 'paid' | 'failed' | 'received' | 'not_received'>(
    null,
  );
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [utrGuideOpen, setUtrGuideOpen] = useState(false);
  const [failureOpen, setFailureOpen] = useState(false);
  const [notRecvOpen, setNotRecvOpen] = useState(false);

  const evidenceForm = useForm<EvidenceForm>({
    defaultValues: { utr: '', note: '', amountConfirmed: true },
  });
  const failureForm = useForm<FailureForm>({ defaultValues: { reason: '' } });
  const notRecvForm = useForm<AttestationForm>({ defaultValues: { reason: '' } });

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiCall<Intent>({ path: `/payments/${id}` });
      setIntent(data);
    } catch (err) {
      Alert.alert("Couldn't load payment", err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiCall, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <BodyText variant="bodyMuted">Loading…</BodyText>
        </View>
      </SafeAreaView>
    );
  }
  if (!intent) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <BodyText variant="bodyMuted">Payment not found.</BodyText>
        </View>
      </SafeAreaView>
    );
  }

  const youArePayer = user?.id === intent.payerId;
  const youArePayee = user?.id === intent.payeeId;
  const statusStyle = STATUS_PILL[intent.status] ?? STATUS_PILL.awaiting_payer_evidence!;

  const onLaunchUpi = async () => {
    setBusy('launch');
    try {
      const result = await openUpiIntent(intent.upiUrl);
      if (!result.launched) {
        Alert.alert("Couldn't open UPI app", result.error ?? 'Unknown error');
      }
    } finally {
      setBusy(null);
    }
  };

  const onSubmitEvidence = evidenceForm.handleSubmit(async (form) => {
    setBusy('paid');
    try {
      const updated = await apiCall<Intent>({
        path: `/payments/${intent.id}/payer-evidence`,
        method: 'POST',
        body: {
          utr: form.utr.trim() || undefined,
          amountConfirmed: form.amountConfirmed,
          note: form.note.trim() || undefined,
        },
        idempotency: true,
      });
      setIntent(updated);
      setEvidenceOpen(false);
    } catch (err) {
      Alert.alert("Couldn't submit", err instanceof ApiError ? err.message : 'Try again.');
    } finally {
      setBusy(null);
    }
  });

  const onSubmitFailure = failureForm.handleSubmit(async (form) => {
    if (!form.reason.trim()) {
      Alert.alert('Reason needed', 'Tell us briefly what went wrong.');
      return;
    }
    setBusy('failed');
    try {
      const updated = await apiCall<Intent>({
        path: `/payments/${intent.id}/payer-failure`,
        method: 'POST',
        body: { reason: form.reason.trim() },
        idempotency: true,
      });
      setIntent(updated);
      setFailureOpen(false);
    } catch (err) {
      Alert.alert("Couldn't submit", err instanceof ApiError ? err.message : 'Try again.');
    } finally {
      setBusy(null);
    }
  });

  const onAttest = async (decision: 'received' | 'not_received', reason?: string) => {
    setBusy(decision);
    try {
      const updated = await apiCall<Intent>({
        path: `/payments/${intent.id}/attestation`,
        method: 'POST',
        body: { decision, reason },
        idempotency: true,
      });
      setIntent(updated);
      setNotRecvOpen(false);
      if (decision === 'received' && intent.kind === 'disbursal') {
        Alert.alert(
          'Loan activated',
          'You confirmed receipt. The loan is now active and your EMI schedule is generated.',
        );
      }
    } catch (err) {
      Alert.alert("Couldn't submit", err instanceof ApiError ? err.message : 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const onAttestNotReceived = notRecvForm.handleSubmit(async (form) => {
    if (!form.reason.trim()) {
      Alert.alert('Reason needed', 'Tell us why you didn’t receive the payment.');
      return;
    }
    await onAttest('not_received', form.reason.trim());
  });

  const title =
    intent.kind === 'disbursal'
      ? 'Disbursal'
      : intent.kind === 'emi'
        ? `EMI #${intent.emiNumber}`
        : intent.kind;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BackHeader fallback={`/loans/${intent.loanId}`} />

        <View style={styles.headerRow}>
          <BodyText variant="bodyMuted">{title}</BodyText>
          <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
            <BodyText style={[styles.statusText, { color: statusStyle.ink }]}>
              {statusStyle.label}
            </BodyText>
          </View>
        </View>

        <Heading style={{ marginTop: spacing.sm }}>{formatRupees(intent.amountPaise)}</Heading>
        <BodyText variant="bodyMuted">
          {youArePayer
            ? `You pay · ${intent.payeeName} (${intent.payeeVpa})`
            : `You receive · from ${intent.payerVpa}`}
        </BodyText>

        <View style={styles.factsCard}>
          <Row label="Payer VPA" value={intent.payerVpa} mono />
          <Row label="Payee VPA" value={intent.payeeVpa} mono />
          <Row label="Reference" value={intent.referenceId.slice(0, 8)} mono />
          <Row label="Created" value={new Date(intent.createdAt).toLocaleString()} />
          <Row label="Expires" value={new Date(intent.expiresAt).toLocaleString()} />
          {intent.payerEvidence?.submittedAt ? (
            <Row
              label="Marked sent"
              value={new Date(intent.payerEvidence.submittedAt).toLocaleString()}
            />
          ) : null}
          {intent.payerEvidence?.utr ? <Row label="UTR" value={intent.payerEvidence.utr} mono /> : null}
          {intent.receiverAttestation?.submittedAt ? (
            <Row
              label="Receiver attested"
              value={new Date(intent.receiverAttestation.submittedAt).toLocaleString()}
            />
          ) : null}
        </View>

        {/* PAYER, awaiting evidence */}
        {youArePayer && intent.status === 'awaiting_payer_evidence' ? (
          <View style={styles.actionStack}>
            <Heading level="h3">Pay via UPI</Heading>
            <BodyText variant="bodyMuted" style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
              Tap below to open your UPI app with the amount and recipient pre-filled. Complete
              the payment, then return to TrustPe and mark it.
            </BodyText>
            <Button onPress={onLaunchUpi} loading={busy === 'launch'}>
              Open UPI app · {formatRupees(intent.amountPaise)}
            </Button>
            <View style={{ height: spacing.md }} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  variant="secondary"
                  onPress={() => setEvidenceOpen((v) => !v)}
                  disabled={busy !== null}
                >
                  I paid
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  variant="secondary"
                  onPress={() => setFailureOpen((v) => !v)}
                  disabled={busy !== null}
                >
                  Payment failed
                </Button>
              </View>
            </View>

            {evidenceOpen ? (
              <View style={styles.inlineForm}>
                <BodyText variant="caption" color={colors.inkMuted}>
                  CONFIRM PAYMENT
                </BodyText>
                <Controller
                  control={evidenceForm.control}
                  name="utr"
                  rules={{
                    validate: (v) =>
                      !v || /^\d{12}$/.test(v.trim()) || 'UTR must be 12 digits (or leave blank)',
                  }}
                  render={({ field }) => (
                    <TextInput
                      label="UTR (12-digit reference)"
                      value={field.value}
                      onChangeText={(t) => field.onChange(t.replace(/\D/g, '').slice(0, 12))}
                      onBlur={field.onBlur}
                      keyboardType="number-pad"
                      placeholder="Optional"
                      error={evidenceForm.formState.errors.utr?.message}
                      hint="Optional — makes disputes easier to resolve."
                    />
                  )}
                />
                <Pressable
                  onPress={() => setUtrGuideOpen(true)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Where do I find my UTR?"
                  style={{ marginTop: -spacing.xs, marginBottom: spacing.md }}
                >
                  <BodyText variant="caption" color={colors.accent}>
                    Where do I find my UTR? →
                  </BodyText>
                </Pressable>
                <Controller
                  control={evidenceForm.control}
                  name="note"
                  render={({ field }) => (
                    <TextInput
                      label="Note (optional)"
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      multiline
                      placeholder="e.g. PhonePe shows successful"
                    />
                  )}
                />
                <Button onPress={onSubmitEvidence} loading={busy === 'paid'}>
                  Mark as paid
                </Button>
              </View>
            ) : null}

            {failureOpen ? (
              <View style={[styles.inlineForm, { borderColor: '#FECACA' }]}>
                <BodyText variant="caption" color={colors.inkMuted}>
                  WHAT WENT WRONG?
                </BodyText>
                <Controller
                  control={failureForm.control}
                  name="reason"
                  render={({ field }) => (
                    <TextInput
                      label=""
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      multiline
                      placeholder="e.g. UPI app showed failure, insufficient balance"
                      accessibilityLabel="What went wrong?"
                    />
                  )}
                />
                <Button variant="secondary" onPress={onSubmitFailure} loading={busy === 'failed'}>
                  Mark as failed
                </Button>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* PAYER, payer_confirmed (waiting for receiver) */}
        {youArePayer && intent.status === 'payer_confirmed' ? (
          <View style={styles.actionStack}>
            <Heading level="h3">⏳ Awaiting receiver confirmation</Heading>
            <BodyText variant="bodyMuted" style={{ marginTop: spacing.xs }}>
              You marked the payment as sent. The receiver will confirm receipt in their app.
              We'll notify you when they do.
            </BodyText>
          </View>
        ) : null}

        {/* PAYEE, awaiting evidence */}
        {youArePayee && intent.status === 'awaiting_payer_evidence' ? (
          <View style={styles.actionStack}>
            <Heading level="h3">⏳ Waiting for payer</Heading>
            <BodyText variant="bodyMuted" style={{ marginTop: spacing.xs }}>
              The payer hasn't marked this payment yet. You'll be able to confirm receipt once
              they do.
            </BodyText>
          </View>
        ) : null}

        {/* PAYEE, payer_confirmed → attestation */}
        {youArePayee && intent.status === 'payer_confirmed' ? (
          <View style={styles.actionStack}>
            <Heading level="h3">Did you receive {formatRupees(intent.amountPaise)}?</Heading>
            <BodyText variant="bodyMuted" style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
              Check your UPI app for the credit. Confirm to{' '}
              {intent.kind === 'disbursal'
                ? 'activate the loan and generate the EMI schedule.'
                : `settle EMI #${intent.emiNumber}.`}
            </BodyText>
            <Button onPress={() => void onAttest('received')} loading={busy === 'received'}>
              Yes, I received it
            </Button>
            <View style={{ height: spacing.md }} />
            <Button
              variant="secondary"
              onPress={() => setNotRecvOpen((v) => !v)}
              disabled={busy !== null}
            >
              No, I didn't receive it
            </Button>

            {notRecvOpen ? (
              <View style={[styles.inlineForm, { borderColor: '#FECACA' }]}>
                <BodyText variant="caption" color={colors.inkMuted}>
                  WHAT HAPPENED?
                </BodyText>
                <Controller
                  control={notRecvForm.control}
                  name="reason"
                  render={({ field }) => (
                    <TextInput
                      label=""
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      multiline
                      placeholder="Briefly describe what's missing or wrong"
                      accessibilityLabel="What happened?"
                    />
                  )}
                />
                <Button variant="secondary" onPress={onAttestNotReceived} loading={busy === 'not_received'}>
                  Submit dispute
                </Button>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Terminal states */}
        {intent.status === 'verified' ? (
          <View style={[styles.actionStack, styles.terminalGood]}>
            <Heading level="h3">✓ Payment verified</Heading>
            <BodyText variant="bodyMuted" style={{ marginTop: spacing.xs }}>
              Both sides confirmed. This payment is settled.
            </BodyText>
          </View>
        ) : null}

        {intent.status === 'failed' ? (
          <View style={[styles.actionStack, styles.terminalBad]}>
            <Heading level="h3">Payment failed</Heading>
            <BodyText variant="bodyMuted" style={{ marginTop: spacing.xs }}>
              {intent.failureReason}
            </BodyText>
            {youArePayer ? (
              <View style={{ marginTop: spacing.md }}>
                <Button variant="secondary" onPress={() => router.replace(`/loans/${intent.loanId}`)}>
                  Try again from the loan screen
                </Button>
              </View>
            ) : null}
          </View>
        ) : null}

        {intent.status === 'disputed' ? (
          <View style={[styles.actionStack, styles.terminalBad]}>
            <Heading level="h3">Under dispute</Heading>
            <BodyText variant="bodyMuted" style={{ marginTop: spacing.xs }}>
              The receiver said they didn't get the money. TrustPe admin will review and reach
              out to both of you. Use chat to coordinate in the meantime.
            </BodyText>
            <View style={{ marginTop: spacing.md }}>
              <Button variant="secondary" onPress={() => router.push(`/chat/${intent.loanId}`)}>
                Open chat
              </Button>
            </View>
          </View>
        ) : null}
      </ScrollView>
      <UtrGuideSheet open={utrGuideOpen} onClose={() => setUtrGuideOpen(false)} />
    </SafeAreaView>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
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
  actionStack: {
    marginTop: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  terminalGood: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  terminalBad: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  inlineForm: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.paper,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
