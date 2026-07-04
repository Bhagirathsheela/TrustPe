/**
 * Fund this loan — single-tap confirmation.
 *
 * Fixed-rate model: the lender doesn't propose terms — they accept the
 * borrower's published terms. This screen is just a confirmation card.
 * On tap, backend creates the LoanOffer (status=accepted) and the Loan
 * atomically; the user lands on the new loan detail.
 */
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { Screen } from '../../../components/Screen';
import { Heading } from '../../../components/Heading';
import { BodyText } from '../../../components/BodyText';
import { Button } from '../../../components/Button';
import { TextInput } from '../../../components/TextInput';
import { BackHeader } from '../../../components/BackHeader';
import { colors, radii, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth-context';
import { ApiError } from '../../../lib/api';

type RequestSnapshot = {
  id: string;
  amountPaise: number;
  tenureMonths: number;
  roiPercent: number;
  snapshot: {
    borrowerName: string;
    borrowerCity?: string;
    borrowerState?: string;
    borrowerStateRoiCap?: number;
    borrowerTrustScore: number;
    borrowerTrustBand: string;
  };
  status: string;
};

type FormShape = { message: string };

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

/** Total interest over the tenure at simple-interest approximation. */
function approximateInterest(amountPaise: number, roiPercent: number, tenureMonths: number): number {
  return Math.round((amountPaise * roiPercent * tenureMonths) / (100 * 12));
}

export default function FundRequest() {
  const params = useLocalSearchParams<{ requestId?: string }>();
  const requestId = params.requestId;
  const { apiCall } = useAuth();

  const [request, setRequest] = useState<RequestSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit } = useForm<FormShape>({
    defaultValues: { message: '' },
  });

  useEffect(() => {
    if (!requestId) return;
    (async () => {
      try {
        const data = await apiCall<RequestSnapshot>({ path: `/loan-requests/${requestId}` });
        setRequest(data);
      } catch (err) {
        Alert.alert("Couldn't load request", err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [apiCall, requestId]);

  const onConfirm = handleSubmit(async (form) => {
    if (!request) return;
    setSubmitting(true);
    try {
      const result = await apiCall<{ loan: { id: string } }>({
        path: `/loan-requests/${request.id}/offers`,
        method: 'POST',
        body: form.message.trim() ? { message: form.message.trim() } : {},
        idempotency: true,
      });
      router.replace(`/loans/${result.loan.id}`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Something went wrong.';
      Alert.alert("Couldn't fund this loan", message);
    } finally {
      setSubmitting(false);
    }
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <BodyText variant="bodyMuted">Loading…</BodyText>
        </View>
      </SafeAreaView>
    );
  }
  if (!request) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <BodyText variant="bodyMuted">Request not found.</BodyText>
        </View>
      </SafeAreaView>
    );
  }

  const interest = approximateInterest(
    request.amountPaise,
    request.roiPercent,
    request.tenureMonths,
  );

  return (
    <Screen scroll>
      <BackHeader fallback={`/loan-requests/${request.id}`} />
      <Heading>Fund this loan</Heading>
      <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
        You&apos;re lending {formatRupees(request.amountPaise)} to{' '}
        <BodyText style={{ fontWeight: '700' }}>{request.snapshot.borrowerName}</BodyText>
        {request.snapshot.borrowerCity ? ` from ${request.snapshot.borrowerCity}` : ''} at the
        borrower&apos;s published rate. One tap and the loan is yours — no negotiation.
      </BodyText>

      <View style={styles.summaryCard}>
        <SummaryRow label="Principal" value={formatRupees(request.amountPaise)} highlight />
        <SummaryRow label="Tenure" value={`${request.tenureMonths} month${request.tenureMonths > 1 ? 's' : ''}`} />
        <SummaryRow label="Interest rate" value={`${request.roiPercent}% p.a.`} />
        <SummaryRow
          label="Estimated interest"
          value={formatRupees(interest)}
          hint="Approximate, simple interest"
        />
        <SummaryRow
          label="You receive at close"
          value={formatRupees(request.amountPaise + interest)}
          highlight
        />
      </View>

      {request.snapshot.borrowerState ? (
        <View style={styles.capCard}>
          <BodyText variant="caption" color={colors.inkMuted} style={{ marginBottom: spacing.xs }}>
            REGULATORY CONTEXT
          </BodyText>
          <BodyText variant="bodyMuted" style={{ fontSize: 13 }}>
            {request.snapshot.borrowerState} caps moneylender interest at{' '}
            <BodyText style={{ fontWeight: '700' }}>
              {request.snapshot.borrowerStateRoiCap}% p.a.
            </BodyText>{' '}
            This loan is at {request.roiPercent}%, within the cap.
          </BodyText>
        </View>
      ) : null}

      <View style={{ marginTop: spacing.lg }}>
        <Controller
          control={control}
          name="message"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              label="Message (optional)"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="A short note for the borrower"
              multiline
              hint="Goodwill goes a long way."
            />
          )}
        />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Button onPress={onConfirm} loading={submitting}>
          Confirm and fund · {formatRupees(request.amountPaise)}
        </Button>
        <View style={{ height: spacing.md }} />
        <Button variant="ghost" onPress={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
      </View>

      <BodyText
        variant="caption"
        color={colors.inkMuted}
        align="center"
        style={{ marginTop: spacing.lg, lineHeight: 18 }}
      >
        After you fund, an agreement gets generated. Both sides sign it, then you disburse over UPI.
      </BodyText>
    </Screen>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
  hint,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  hint?: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <View style={{ flex: 1 }}>
        <BodyText variant="bodyMuted" style={{ fontSize: 13 }}>
          {label}
        </BodyText>
        {hint ? (
          <BodyText variant="caption" color={colors.inkMuted}>
            {hint}
          </BodyText>
        ) : null}
      </View>
      <BodyText
        style={{
          fontWeight: highlight ? '700' : '600',
          fontSize: highlight ? 18 : 15,
          color: colors.ink,
        }}
      >
        {value}
      </BodyText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  capCard: {
    marginTop: spacing.lg,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
});
