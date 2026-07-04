/**
 * Home dashboard.
 *
 * Onboarding is a single KYC step (Aadhaar + PAN + selfie + UPI ID). Once
 * admin approves, the user is fully set up — no separate UPI registration.
 *
 * CTA matrix:
 *  - status='onboarding' and profile incomplete → "Complete your profile"
 *  - profile complete but KYC not started → "Submit your KYC"
 *  - kycStatus='needs_clarification' → "Reviewer needs more info — re-submit"
 *  - status='pending_review' → "Awaiting admin review" card + auto-poll
 *  - status='active' → "You're all set" (loans/EMIs land in Sprint 2+)
 *  - status='suspended' → suspended notice
 *
 * Auto-refetch hooks:
 *  - On mount + on pull-to-refresh
 *  - Every 15 seconds while status='pending_review' (so the user sees the
 *    approval the moment admin clicks Approve)
 *  - When the app returns from background (AppState 'active')
 *
 * When status transitions out of 'pending_review' we surface a one-shot Alert
 * so the change is unmissable.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MeProfile } from 'trustpe-shared';
import { Heading } from '../../components/Heading';
import { BodyText } from '../../components/BodyText';
import { Button } from '../../components/Button';
import { TrustScoreBadge } from '../../components/TrustScoreBadge';
import { colors, radii, spacing } from '../../constants/theme';
import { useAuth, type AuthUser } from '../../lib/auth-context';
import { onRealtimeEvent } from '../../lib/socket';

/** How often to re-check /me while waiting for the admin decision. */
const PENDING_REVIEW_POLL_MS = 15_000;

type StatusTone = 'neutral' | 'warning' | 'info' | 'success' | 'danger';

const STATUS_LABELS: Record<string, { label: string; tone: StatusTone }> = {
  unverified: { label: 'Email not verified', tone: 'warning' },
  onboarding: { label: 'Onboarding', tone: 'warning' },
  pending_review: { label: 'Under review', tone: 'info' },
  active: { label: 'Active', tone: 'success' },
  suspended: { label: 'Suspended', tone: 'danger' },
};

const KYC_LABELS: Record<string, { label: string; tone: StatusTone }> = {
  not_started: { label: 'Not started', tone: 'warning' },
  submitted: { label: 'Under review', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  needs_clarification: { label: 'Needs more info', tone: 'warning' },
};

const TONE_STYLES: Record<StatusTone, { border: string; bg: string; ink: string }> = {
  neutral: { border: colors.border, bg: colors.white, ink: colors.ink },
  warning: { border: colors.warning, bg: '#FFFBEB', ink: '#92400E' },
  info: { border: colors.accent, bg: '#EFF6FF', ink: '#1E40AF' },
  success: { border: colors.success, bg: '#ECFDF5', ink: '#065F46' },
  danger: { border: colors.danger, bg: '#FEF2F2', ink: '#991B1B' },
};

export default function Home() {
  const { user, apiCall } = useAuth();
  const [me, setMe] = useState<AuthUser | null>(user);
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Tracks the previously-seen status so we can fire a one-shot Alert on the
  // transition out of pending_review. Initialised to null (first load
  // establishes the baseline without alerting).
  const prevStatusRef = useRef<string | null>(null);
  const prevKycStatusRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const [meRes, profileRes] = await Promise.allSettled([
      apiCall<AuthUser>({ path: '/me' }),
      apiCall<MeProfile>({ path: '/me/profile' }),
    ]);
    if (meRes.status === 'fulfilled') {
      const next = meRes.value;
      const prevStatus = prevStatusRef.current;
      const prevKyc = prevKycStatusRef.current;

      // KYC transition alerts (only on genuine transition — not first load).
      if (prevStatus === 'pending_review' && next.status !== 'pending_review') {
        if (next.status === 'active') {
          Alert.alert(
            'KYC approved 🎉',
            `Welcome to TrustPe. Your TrustScore is now ${next.trustScore ?? 550}. Your UPI ID is verified and ready to use.`,
          );
        } else if (next.status === 'suspended') {
          Alert.alert(
            'KYC was rejected',
            'Please contact the TrustPe team for next steps.',
          );
        } else if (next.kycStatus === 'needs_clarification' && prevKyc !== 'needs_clarification') {
          Alert.alert(
            'Reviewer needs more info',
            'Please re-submit your KYC with the requested changes.',
          );
        }
      }

      prevStatusRef.current = next.status;
      prevKycStatusRef.current = next.kycStatus;
      setMe(next);
    }
    if (profileRes.status === 'fulfilled') setProfile(profileRes.value);
  }, [apiCall]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll /me every 15s while the user is waiting on KYC review so the
  // decision lands on the home screen automatically — no manual refresh
  // required.
  useEffect(() => {
    if (me?.status !== 'pending_review') return;
    const interval = setInterval(() => {
      void load();
    }, PENDING_REVIEW_POLL_MS);
    return () => clearInterval(interval);
  }, [me?.status, load]);

  // Refetch when the app returns from background — covers the common case
  // where the user backgrounds the app, admin approves, user reopens.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => sub.remove();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  // Notification bell unread count — load once on mount + live updates.
  const [unreadCount, setUnreadCount] = useState(0);
  const loadUnread = useCallback(async () => {
    try {
      const data = await apiCall<{ unreadCount: number }>({
        path: '/me/notifications?limit=1&unreadOnly=true',
      });
      setUnreadCount(data.unreadCount);
    } catch {
      /* */
    }
  }, [apiCall]);
  useEffect(() => {
    void loadUnread();
  }, [loadUnread]);
  // Live increments when a new notification arrives via Socket.io.
  useEffect(() => {
    const off = onRealtimeEvent<{ id: string }>('notification:new', () => {
      setUnreadCount((c) => c + 1);
    });
    return off;
  }, []);
  // Reset on app foreground so we don't drift if a tap was missed.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadUnread();
    });
    return () => sub.remove();
  }, [loadUnread]);

  if (!me) return null;

  const score = me.trustScore ?? 300;
  const band = me.trustBand ?? 'building';

  const showProfileCta =
    me.status === 'onboarding' && (!profile || !profile.isComplete);
  const showKycCta =
    me.status === 'onboarding' &&
    profile?.isComplete &&
    me.kycStatus === 'not_started';
  const showClarificationCta =
    me.status === 'onboarding' &&
    profile?.isComplete &&
    me.kycStatus === 'needs_clarification';
  const showPendingCard = me.status === 'pending_review';
  const showSuspendedCard = me.status === 'suspended';
  const showReadyCard = me.status === 'active';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <BodyText variant="bodyMuted">Welcome</BodyText>
              <Heading>{me.name}</Heading>
              {profile?.city ? (
                <BodyText variant="bodyMuted" style={{ marginTop: spacing.xs }}>
                  {profile.city}
                </BodyText>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                onPress={() => router.push('/notifications')}
                style={({ pressed }) => [styles.bellButton, pressed && { opacity: 0.65 }]}
                hitSlop={10}
                accessibilityLabel="Notifications"
              >
                <BodyText style={styles.bellIcon}>🔔</BodyText>
                {unreadCount > 0 ? (
                  <View style={styles.bellBadge}>
                    <BodyText style={styles.bellBadgeText}>
                      {unreadCount > 99 ? '99+' : String(unreadCount)}
                    </BodyText>
                  </View>
                ) : null}
              </Pressable>
              <Pressable
                onPress={() => router.push('/settings')}
                style={({ pressed }) => [styles.bellButton, pressed && { opacity: 0.65 }]}
                hitSlop={10}
                accessibilityLabel="Settings"
              >
                <BodyText style={styles.bellIcon}>⚙️</BodyText>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.scoreCard}>
          <TrustScoreBadge score={score} band={band} size="md" />
          <BodyText variant="bodyMuted" align="center" style={styles.scoreNote}>
            Your TrustScore grows as you complete loans on time.
          </BodyText>
        </View>

        <View style={styles.statusGrid}>
          <StatusCard
            label="Account"
            value={STATUS_LABELS[me.status]?.label ?? me.status}
            tone={STATUS_LABELS[me.status]?.tone ?? 'neutral'}
          />
          <StatusCard
            label="KYC"
            value={KYC_LABELS[me.kycStatus]?.label ?? me.kycStatus}
            tone={KYC_LABELS[me.kycStatus]?.tone ?? 'neutral'}
          />
        </View>

        {showProfileCta ? (
          <ActionCard
            title="Complete your profile"
            body="Tell us your city, occupation, and income band. Takes about a minute."
            ctaLabel="Set up profile"
            onPress={() => router.push('/profile')}
          />
        ) : null}

        {showKycCta ? (
          <ActionCard
            title="Submit your KYC"
            body="Capture your Aadhaar, PAN, and a quick selfie video so we can verify you. Admin review usually completes in 24 hours."
            ctaLabel="Start KYC"
            onPress={() => router.push('/kyc')}
          />
        ) : null}

        {showClarificationCta ? (
          <ActionCard
            title="Reviewer needs more info"
            body="The TrustPe team needs you to re-submit your KYC. Tap below to capture again."
            ctaLabel="Re-submit KYC"
            onPress={() => router.push('/kyc')}
          />
        ) : null}

        {showPendingCard ? (
          <ActionCard
            title="Awaiting review"
            body="Your KYC is with the TrustPe team. This screen checks for updates automatically — you'll see the result here as soon as it's decided (usually within 24 hours)."
            tone="info"
          />
        ) : null}

        {showSuspendedCard ? (
          <ActionCard
            title="Account suspended"
            body="Your account is suspended after KYC review. Please contact the TrustPe team for next steps — we usually reply within 24 hours."
            ctaLabel="Email support"
            onPress={() => {
              void Linking.openURL(
                'mailto:support@trustpe.in?subject=Account%20suspended%20-%20appeal',
              );
            }}
            tone="info"
          />
        ) : null}

        {showReadyCard ? (
          <>
            <View style={styles.actionsRow}>
              <View style={styles.actionTile}>
                <Heading level="h3">Borrow</Heading>
                <BodyText variant="bodyMuted" style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
                  Publish a request, let lenders in your circle offer terms.
                </BodyText>
                <Button onPress={() => router.push('/loan-requests/mine')}>My requests</Button>
                <View style={{ height: spacing.sm }} />
                <Button variant="secondary" onPress={() => router.push('/loan-requests/new')}>
                  Request a loan
                </Button>
              </View>
              <View style={styles.actionTile}>
                <Heading level="h3">Lend</Heading>
                <BodyText variant="bodyMuted" style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
                  Browse open requests from people in your circle.
                </BodyText>
                <Button onPress={() => router.push('/loan-requests/browse')}>
                  Browse requests
                </Button>
              </View>
              <View style={styles.actionTile}>
                <Heading level="h3">Activity</Heading>
                <BodyText variant="bodyMuted" style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
                  Loans you&apos;ve agreed to and offers you&apos;ve funded.
                </BodyText>
                <Button onPress={() => router.push('/loans/mine')}>My loans</Button>
                <View style={{ height: spacing.sm }} />
                <Button variant="secondary" onPress={() => router.push('/loan-offers/mine')}>
                  My offers
                </Button>
              </View>
            </View>
          </>
        ) : null}

        <View style={styles.footer}>
          <BodyText variant="caption" color={colors.inkMuted} align="center">
            {me.email}
            {refreshing ? ' · refreshing…' : ''}
          </BodyText>
          <BodyText
            variant="caption"
            color={colors.inkMuted}
            align="center"
            style={{ marginTop: spacing.xs }}
          >
            Account settings & logout now live in{' '}
            <BodyText variant="caption" color={colors.accent} onPress={() => router.push('/settings')}>
              Settings ⚙️
            </BodyText>
          </BodyText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: StatusTone;
}) {
  const t = TONE_STYLES[tone];
  return (
    <View
      style={[
        styles.statusCard,
        {
          backgroundColor: t.bg,
          borderLeftWidth: 4,
          borderLeftColor: t.border,
        },
      ]}
    >
      <BodyText variant="caption" color={colors.inkMuted}>
        {label.toUpperCase()}
      </BodyText>
      <BodyText
        style={{ marginTop: spacing.xs, fontWeight: '600', color: t.ink }}
        numberOfLines={2}
      >
        {value}
      </BodyText>
    </View>
  );
}

function ActionCard({
  title,
  body,
  ctaLabel,
  onPress,
  tone = 'action',
}: {
  title: string;
  body: string;
  ctaLabel?: string;
  onPress?: () => void;
  tone?: 'action' | 'info';
}) {
  return (
    <View style={[styles.actionCard, tone === 'info' && styles.actionCardInfo]}>
      <Heading level="h3">{title}</Heading>
      <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm }}>
        {body}
      </BodyText>
      {ctaLabel && onPress ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button onPress={onPress}>{ctaLabel}</Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    flexGrow: 1,
  },
  header: { marginBottom: spacing.xl },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  bellIcon: { fontSize: 20 },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.paper,
  },
  bellBadgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  scoreCard: {
    backgroundColor: colors.white,
    padding: spacing.xl,
    borderRadius: radii.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  scoreNote: { marginTop: spacing.md, maxWidth: 280 },
  statusGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statusCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radii.md,
  },
  actionCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    marginBottom: spacing.lg,
  },
  actionCardInfo: { borderLeftColor: colors.warning },
  placeholderCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radii.md,
    marginBottom: spacing.xl,
  },
  actionsRow: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  actionTile: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footer: { marginTop: spacing.xl },
});
