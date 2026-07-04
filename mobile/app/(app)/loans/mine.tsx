/**
 * My loans — accepted-offer loans where the viewer is borrower or lender.
 *
 * Sprint 2B emits status='awaiting_disbursal' only. Disbursement and EMI
 * lifecycle land in Sprint 3.
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

type Loan = {
  id: string;
  borrowerId: string;
  lenderId: string;
  amountPaise: number;
  tenureMonths: number;
  roiPercent: number;
  status: string;
  borrowerSnapshot: { name: string };
  lenderSnapshot: { name: string };
  agreedAt: string;
};

const STATUS_PILL: Record<string, { bg: string; ink: string; label: string }> = {
  awaiting_disbursal: { bg: '#FFFBEB', ink: '#92400E', label: 'Awaiting disbursal' },
  awaiting_agreement: { bg: '#EFF6FF', ink: '#1E40AF', label: 'Awaiting agreement' },
  active: { bg: '#ECFDF5', ink: '#065F46', label: 'Active' },
  closed: { bg: '#F1F5F9', ink: '#475569', label: 'Closed' },
  defaulted: { bg: '#FEF2F2', ink: '#991B1B', label: 'Defaulted' },
  cancelled: { bg: '#F1F5F9', ink: '#475569', label: 'Cancelled' },
};

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default function MyLoans() {
  const { apiCall, user } = useAuth();
  const [items, setItems] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiCall<{ items: Loan[] }>({ path: '/loans/mine' });
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
        <Heading>My loans</Heading>
        <BodyText variant="bodyMuted" style={{ marginTop: spacing.xs }}>
          Loans where you&apos;re the borrower or lender, newest first.
        </BodyText>
      </View>

      <FlatList
        data={items}
        keyExtractor={(l) => l.id}
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
              icon="📋"
              title="No loans yet"
              subtitle="Once you fund an offer or get funded, the loan appears here with its current EMI status."
              actionLabel="Browse open requests"
              onAction={() => router.push('/loan-requests/browse')}
              secondaryLabel="Request a loan"
              onSecondary={() => router.push('/loan-requests/new')}
            />
          )
        }
        renderItem={({ item }) => {
          const youAreBorrower = item.borrowerId === user?.id;
          const counterparty = youAreBorrower ? item.lenderSnapshot.name : item.borrowerSnapshot.name;
          const role = youAreBorrower ? 'You owe' : 'You lent';
          const pill = STATUS_PILL[item.status] ?? STATUS_PILL.awaiting_disbursal!;
          return (
            <Pressable
              onPress={() => router.push(`/loans/${item.id}`)}
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
                {role} {counterparty} · agreed {new Date(item.agreedAt).toLocaleDateString()}
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
