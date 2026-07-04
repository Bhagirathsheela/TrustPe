/**
 * Notifications feed.
 *
 * Paginated list of in-app notifications. Unread items get an accent dot
 * and a tinted background. Tap → marks read + navigates to the deep link
 * if present.
 *
 * Real-time: subscribes to 'notification:new' over Socket.io so new items
 * appear at the top instantly without re-fetching.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heading } from '../../components/Heading';
import { BodyText } from '../../components/BodyText';
import { BackHeader } from '../../components/BackHeader';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { colors, radii, spacing } from '../../constants/theme';
import { useAuth } from '../../lib/auth-context';
import { onRealtimeEvent } from '../../lib/socket';

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  deepLink?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
};

const KIND_ICON: Record<string, string> = {
  offer_funded: '🎉',
  agreement_pending: '✍️',
  agreement_signed: '✓',
  disbursal_initiated: '💸',
  payment_sent: '💸',
  attest_needed: '⚡',
  payment_verified: '✓',
  loan_active: '🚀',
  emi_due: '📅',
  emi_overdue: '⚠️',
  loan_closed: '🎉',
  review_received: '⭐',
  dispute_opened: '⚠️',
  dispute_resolved: '⚖️',
  loan_defaulted: '⚠️',
  kyc_approved: '✓',
  kyc_rejected: '✗',
  kyc_clarification: '📝',
};

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

export default function NotificationsScreen() {
  const { apiCall } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiCall<{
        items: Notification[];
        nextCursor: string | null;
        unreadCount: number;
      }>({ path: '/me/notifications?limit=50' });
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live updates: new notifications appear at top
  useEffect(() => {
    const off = onRealtimeEvent<Notification>('notification:new', (n) => {
      setItems((prev) => {
        if (prev.some((x) => x.id === n.id)) return prev;
        return [n, ...prev];
      });
      setUnreadCount((c) => c + 1);
    });
    return off;
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const onTap = async (n: Notification) => {
    // Mark read locally + remotely (don't wait)
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      apiCall({ path: `/me/notifications/${n.id}/read`, method: 'POST' }).catch(() => {});
    }
    if (n.deepLink) router.push(n.deepLink as never);
  };

  const onMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setMarking(true);
    try {
      await apiCall({ path: '/me/notifications/read-all', method: 'POST' });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      /* */
    } finally {
      setMarking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackHeader fallback="/home" />
        <View style={styles.headerRow}>
          <Heading>Notifications</Heading>
          {unreadCount > 0 ? (
            <Pressable
              onPress={onMarkAllRead}
              disabled={marking}
              style={({ pressed }) => [styles.markAllBtn, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel={`Mark all ${unreadCount} notifications as read`}
              accessibilityState={{ busy: marking }}
              hitSlop={8}
            >
              <BodyText style={styles.markAllText}>
                Mark all read ({unreadCount})
              </BodyText>
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <SkeletonList count={4} showAvatar rows={2} />
            </View>
          ) : (
            <EmptyState
              icon="🔔"
              title="All caught up"
              subtitle="Activity from your loans, offers, agreements, and reviews shows up here. Pull down to refresh."
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void onTap(item)}
            style={({ pressed }) => [
              styles.card,
              !item.read && styles.cardUnread,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.title}. ${item.body}`}
            accessibilityHint={item.deepLink ? 'Opens the related screen' : 'Marks as read'}
          >
            <View style={styles.iconCol}>
              <BodyText style={styles.icon}>{KIND_ICON[item.kind] ?? '🔔'}</BodyText>
              {!item.read ? <View style={styles.unreadDot} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <BodyText style={[styles.title, !item.read && { fontWeight: '700' }]}>
                {item.title}
              </BodyText>
              <BodyText variant="bodyMuted" style={{ marginTop: 2 }}>
                {item.body}
              </BodyText>
              <BodyText variant="caption" color={colors.inkMuted} style={{ marginTop: spacing.xs }}>
                {timeAgo(item.createdAt)}
                {item.deepLink ? ' · Tap to open' : ''}
              </BodyText>
            </View>
          </Pressable>
        )}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  markAllBtn: { padding: spacing.xs },
  markAllText: { color: colors.accent, fontWeight: '600', fontSize: 13 },

  listContent: { padding: spacing.lg, flexGrow: 1 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: spacing.md,
  },
  cardUnread: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  iconCol: { alignItems: 'center', justifyContent: 'flex-start', width: 32, position: 'relative' },
  icon: { fontSize: 24 },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  title: { fontSize: 15 },

  empty: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.xxl,
    marginTop: spacing.lg,
  },
});
