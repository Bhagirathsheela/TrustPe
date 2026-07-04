/**
 * Borrower's own loan requests.
 *
 * Shows the active request (if any) prominently, then history below it.
 * Empty state nudges the user toward the create flow.
 */
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heading } from '../../../components/Heading';
import { BodyText } from '../../../components/BodyText';
import { Button } from '../../../components/Button';
import { BackHeader } from '../../../components/BackHeader';
import { LoanRequestCard, type LoanRequestSummary } from '../../../components/LoanRequestCard';
import { EmptyState } from '../../../components/EmptyState';
import { SkeletonList } from '../../../components/Skeleton';
import { colors, radii, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth-context';

const ACTIVE_STATUSES = new Set(['open']);

export default function MyLoanRequests() {
  const { apiCall } = useAuth();
  const [items, setItems] = useState<LoanRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiCall<{ items: LoanRequestSummary[] }>({
        path: '/loan-requests/mine',
      });
      setItems(data.items);
    } catch {
      // Empty list on error is fine — header still shows "Request a loan" CTA.
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

  const active = items.find((r) => ACTIVE_STATUSES.has(r.status));
  const history = items.filter((r) => !ACTIVE_STATUSES.has(r.status));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <View style={styles.header}>
          <BackHeader fallback="/home" />
          <Heading>My loan requests</Heading>
        </View>

        {loading ? (
          <SkeletonList count={3} rows={3} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="📝"
            title="No loan requests yet"
            subtitle="Publish a request and lenders in your circle can fund it at the rate you set, up to your state's cap."
            actionLabel="Request a loan"
            onAction={() => router.push('/loan-requests/new')}
          />
        ) : (
          <>
            {active ? (
              <>
                <BodyText
                  variant="caption"
                  color={colors.inkMuted}
                  style={{ marginBottom: spacing.sm }}
                >
                  ACTIVE
                </BodyText>
                <LoanRequestCard
                  item={active}
                  variant="mine"
                  onPress={() => router.push(`/loan-requests/${active.id}`)}
                />
              </>
            ) : (
              <View style={styles.emptyActive}>
                <BodyText variant="bodyMuted" style={{ marginBottom: spacing.md }}>
                  You don&apos;t have an active request right now.
                </BodyText>
                <Button onPress={() => router.push('/loan-requests/new')}>Request a loan</Button>
              </View>
            )}

            {history.length > 0 ? (
              <>
                <BodyText
                  variant="caption"
                  color={colors.inkMuted}
                  style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}
                >
                  HISTORY
                </BodyText>
                {history.map((r) => (
                  <LoanRequestCard
                    key={r.id}
                    item={r}
                    variant="mine"
                    onPress={() => router.push(`/loan-requests/${r.id}`)}
                  />
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, flexGrow: 1 },
  header: { marginBottom: spacing.xl },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.xl,
    alignItems: 'flex-start',
  },
  emptyActive: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
});
