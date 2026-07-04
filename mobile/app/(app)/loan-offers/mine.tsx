/**
 * My offers — flat list of every offer the viewer is a party to.
 *
 * With the fixed-rate model, the negotiation thread concept is gone. This
 * is just a chronological list of fund events.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heading } from '../../../components/Heading';
import { BodyText } from '../../../components/BodyText';
import { BackHeader } from '../../../components/BackHeader';
import { EmptyState } from '../../../components/EmptyState';
import { SkeletonList } from '../../../components/Skeleton';
import { colors, radii, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth-context';

type Offer = {
  id: string;
  loanRequestId: string;
  senderRole: 'lender' | 'borrower';
  senderId: string;
  amountPaise: number;
  tenureMonths: number;
  roiPercent: number;
  status: string;
  senderSnapshot: { name: string; trustBand: string; trustScore: number };
  sentAt: string;
  loanId?: string;
};

const STATUS_PILL: Record<string, { bg: string; ink: string; label: string }> = {
  accepted: { bg: '#ECFDF5', ink: '#065F46', label: 'Funded' },
  pending: { bg: '#FFFBEB', ink: '#92400E', label: 'Pending' },
  countered: { bg: '#EFF6FF', ink: '#1E40AF', label: 'Countered' },
  rejected: { bg: '#FEF2F2', ink: '#991B1B', label: 'Rejected' },
  withdrawn: { bg: '#F1F5F9', ink: '#475569', label: 'Withdrawn' },
  expired: { bg: '#F1F5F9', ink: '#475569', label: 'Expired' },
  auto_rejected: { bg: '#F1F5F9', ink: '#475569', label: 'Auto-rejected' },
};

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default function MyOffers() {
  const { apiCall, user } = useAuth();
  const [items, setItems] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiCall<{ items: Offer[] }>({ path: '/loan-offers/mine' });
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackHeader fallback="/home" />
        <Heading>My offers</Heading>
        <BodyText variant="bodyMuted" style={{ marginTop: spacing.xs }}>
          Every loan you&apos;ve funded or had funded. Tap to open.
        </BodyText>
      </View>

      <FlatList
        data={items}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ padding: spacing.xl }}>
              <SkeletonList count={3} rows={3} />
            </View>
          ) : (
            <EmptyState
              icon="🤝"
              title="No offers yet"
              subtitle="Fund an open request and it'll appear here. You can keep track of every offer you've made or received."
              actionLabel="Browse open requests"
              onAction={() => router.push('/loan-requests/browse')}
            />
          )
        }
        renderItem={({ item }) => {
          const youSent = item.senderId === user?.id;
          const pill = STATUS_PILL[item.status] ?? STATUS_PILL.accepted!;
          // Funded offers route to the loan; legacy non-accepted offers route to the offer page
          const onPress = () =>
            item.loanId
              ? router.push(`/loans/${item.loanId}`)
              : router.push(`/loan-offers/${item.id}`);
          return (
            <Pressable
              onPress={onPress}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.rowTop}>
                <BodyText style={styles.amount}>{formatRupees(item.amountPaise)}</BodyText>
                <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                  <BodyText style={[styles.pillText, { color: pill.ink }]}>{pill.label}</BodyText>
                </View>
              </View>
              <BodyText variant="bodyMuted" style={{ marginBottom: spacing.sm }}>
                {item.tenureMonths} mo · {item.roiPercent}% p.a.
              </BodyText>
              <BodyText variant="caption" color={colors.inkMuted}>
                {youSent ? 'You funded ' : 'Funded by '}
                {item.senderSnapshot.name} · {new Date(item.sentAt).toLocaleDateString()}
              </BodyText>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listContent: { padding: spacing.xl, paddingTop: spacing.md, flexGrow: 1 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  amount: { fontSize: 20, fontWeight: '700', color: colors.ink },
  pill: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.pill },
  pillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  empty: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
});
