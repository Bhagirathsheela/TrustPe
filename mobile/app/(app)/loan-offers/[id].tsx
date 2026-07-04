/**
 * Offer detail — read-only view of a funded offer.
 *
 * With the fixed-rate model, offers don't sit in a pending state. Every
 * offer in the live database is either `accepted` (the funded one), or a
 * terminal legacy state. The action is on the linked Loan, not here.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heading } from '../../../components/Heading';
import { BodyText } from '../../../components/BodyText';
import { Button } from '../../../components/Button';
import { BackHeader } from '../../../components/BackHeader';
import { colors, radii, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth-context';

type Offer = {
  id: string;
  loanRequestId: string;
  borrowerId: string;
  lenderId: string;
  senderRole: 'lender' | 'borrower';
  senderId: string;
  amountPaise: number;
  tenureMonths: number;
  roiPercent: number;
  message?: string;
  status: string;
  senderSnapshot: { name: string; city?: string; trustScore: number; trustBand: string };
  sentAt: string;
  loanId?: string;
};

const STATUS_PILL: Record<string, { bg: string; ink: string; label: string }> = {
  accepted: { bg: '#ECFDF5', ink: '#065F46', label: '✓ Funded' },
  pending: { bg: '#FFFBEB', ink: '#92400E', label: 'Pending (legacy)' },
  countered: { bg: '#EFF6FF', ink: '#1E40AF', label: 'Countered (legacy)' },
  rejected: { bg: '#FEF2F2', ink: '#991B1B', label: 'Rejected' },
  withdrawn: { bg: '#F1F5F9', ink: '#475569', label: 'Withdrawn' },
  expired: { bg: '#F1F5F9', ink: '#475569', label: 'Expired' },
  auto_rejected: { bg: '#F1F5F9', ink: '#475569', label: 'Auto-rejected' },
};

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default function OfferDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const { apiCall, user } = useAuth();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiCall<Offer>({ path: `/loan-offers/${id}` });
      setOffer(data);
    } catch (err) {
      Alert.alert("Couldn't load offer", err instanceof Error ? err.message : 'Unknown error');
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
  if (!offer) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <BodyText variant="bodyMuted">Offer not found.</BodyText>
        </View>
      </SafeAreaView>
    );
  }

  const youAreSender = user?.id === offer.senderId;
  const statusStyle = STATUS_PILL[offer.status] ?? STATUS_PILL.accepted!;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BackHeader fallback="/loan-offers/mine" />

        <View style={styles.headerRow}>
          <BodyText variant="bodyMuted" style={{ fontSize: 13 }}>
            {youAreSender ? 'Your offer' : `From ${offer.senderSnapshot.name}`}
          </BodyText>
          <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
            <BodyText style={[styles.statusText, { color: statusStyle.ink }]}>
              {statusStyle.label}
            </BodyText>
          </View>
        </View>

        <Heading style={{ marginTop: spacing.sm }}>{formatRupees(offer.amountPaise)}</Heading>
        <BodyText variant="bodyMuted">
          {offer.tenureMonths} month{offer.tenureMonths > 1 ? 's' : ''} · {offer.roiPercent}% p.a.
        </BodyText>

        {offer.message ? (
          <View style={styles.messageCard}>
            <BodyText variant="caption" color={colors.inkMuted} style={{ marginBottom: spacing.xs }}>
              MESSAGE
            </BodyText>
            <BodyText>{offer.message}</BodyText>
          </View>
        ) : null}

        <View style={styles.factsCard}>
          <Row label="Counterparty" value={offer.senderSnapshot.name} />
          <Row
            label="Trust"
            value={`${offer.senderSnapshot.trustBand} · ${offer.senderSnapshot.trustScore}`}
          />
          {offer.senderSnapshot.city ? <Row label="From" value={offer.senderSnapshot.city} /> : null}
          <Row label="Sent" value={new Date(offer.sentAt).toLocaleString()} />
        </View>

        <View style={{ marginTop: spacing.xl }}>
          {offer.loanId ? (
            <Button onPress={() => router.push(`/loans/${offer.loanId}`)}>Open the loan</Button>
          ) : null}
          <View style={{ height: spacing.sm }} />
          <Button
            variant="secondary"
            onPress={() => router.push(`/loan-requests/${offer.loanRequestId}`)}
          >
            View original request
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <BodyText variant="caption" color={colors.inkMuted}>
        {label}
      </BodyText>
      <BodyText style={{ fontWeight: '600' }}>{value}</BodyText>
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
  messageCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
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
});
