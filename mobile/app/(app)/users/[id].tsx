/**
 * Public user profile.
 *
 * Visible to any authenticated TrustPe user. Shows TrustScore, member-since,
 * loan counts, aggregate review stats with distribution, and the most recent
 * reviews. Use case: tap a borrower's name in browse to read their reviews
 * before deciding to fund.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { REVIEW_TAG_LABELS, type ReviewTag } from 'trustpe-shared';
import { Heading } from '../../../components/Heading';
import { BodyText } from '../../../components/BodyText';
import { BackHeader } from '../../../components/BackHeader';
import { colors, radii, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth-context';

type Distribution = { 1: number; 2: number; 3: number; 4: number; 5: number };

type Profile = {
  id: string;
  name: string;
  handle?: string;
  city?: string;
  trustScore: number;
  trustBand: string;
  memberSince?: string;
  stats: {
    averageRating: number | null;
    totalReviews: number;
    distribution: Distribution;
    loansAsBorrower: number;
    loansAsLender: number;
    defaultedAsBorrower: number;
    defaultedAsLender: number;
  };
  recentDefaults: Array<{
    id: string;
    amountPaise: number;
    tenureMonths: number;
    roiPercent: number;
    defaultedBy: 'borrower' | 'lender';
    defaultedAt?: string;
    defaultReason?: string;
    counterpartyName: string;
  }>;
};

type Review = {
  id: string;
  rating: number;
  comment?: string;
  tags: string[];
  reviewerRole: 'borrower' | 'lender';
  reviewerSnapshot: { name: string; trustBand: string; trustScore: number };
  createdAt: string;
};

const BAND_LABELS: Record<string, string> = {
  building: 'Building',
  fair: 'Fair',
  good: 'Good',
  very_good: 'Very Good',
  excellent: 'Excellent',
};

const BAND_COLORS: Record<string, string> = {
  building: '#94A3B8',
  fair: '#F59E0B',
  good: '#10B981',
  very_good: '#059669',
  excellent: '#FBBF24',
};

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function UserProfile() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const { apiCall, user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [p, r] = await Promise.all([
        apiCall<Profile>({ path: `/users/${id}/profile` }),
        apiCall<{ items: Review[] }>({ path: `/users/${id}/reviews?limit=20` }),
      ]);
      setProfile(p);
      setReviews(r.items);
    } catch (err) {
      Alert.alert("Couldn't load profile", err instanceof Error ? err.message : 'Unknown');
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
  if (!profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <BodyText variant="bodyMuted">Profile not found.</BodyText>
        </View>
      </SafeAreaView>
    );
  }

  const isMe = user?.id === profile.id;
  const initials = profile.name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');

  const maxDist = Math.max(
    profile.stats.distribution[1],
    profile.stats.distribution[2],
    profile.stats.distribution[3],
    profile.stats.distribution[4],
    profile.stats.distribution[5],
    1,
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <FlatList
        data={reviews}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <BackHeader fallback="/home" />

            {/* Identity card */}
            <View style={styles.identityCard}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: BAND_COLORS[profile.trustBand] ?? colors.border },
                ]}
              >
                <BodyText style={styles.avatarText}>{initials || '?'}</BodyText>
              </View>
              <Heading>{profile.name}</Heading>
              {profile.city ? (
                <BodyText variant="bodyMuted">{profile.city}</BodyText>
              ) : null}
              <View
                style={[
                  styles.bandPill,
                  { backgroundColor: BAND_COLORS[profile.trustBand] ?? colors.border },
                ]}
              >
                <BodyText style={styles.bandPillText}>
                  {BAND_LABELS[profile.trustBand] ?? profile.trustBand} · TrustScore{' '}
                  {profile.trustScore}
                </BodyText>
              </View>
              {isMe ? (
                <BodyText variant="caption" color={colors.inkMuted} style={{ marginTop: spacing.sm }}>
                  This is your public profile
                </BodyText>
              ) : null}
            </View>

            {/* Stats grid */}
            <View style={styles.statsRow}>
              <StatTile
                label="Loans borrowed"
                value={String(profile.stats.loansAsBorrower)}
              />
              <StatTile label="Loans lent" value={String(profile.stats.loansAsLender)} />
              <StatTile
                label="Member since"
                value={
                  profile.memberSince
                    ? new Date(profile.memberSince).toLocaleDateString('en-IN', {
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'
                }
              />
            </View>

            {/* Default registry — only surfaces if there are defaults */}
            {profile.stats.defaultedAsBorrower + profile.stats.defaultedAsLender > 0 ? (
              <View style={styles.defaultsCard}>
                <View style={styles.defaultsHeader}>
                  <BodyText style={styles.defaultsTitle}>⚠️ Default registry</BodyText>
                  <BodyText variant="caption" color="#991B1B">
                    {profile.stats.defaultedAsBorrower + profile.stats.defaultedAsLender}{' '}
                    total
                  </BodyText>
                </View>
                <BodyText variant="caption" color={colors.inkMuted} style={{ marginBottom: spacing.sm }}>
                  Loans where TrustPe admin defaulted this user. Public for honesty.
                </BodyText>
                {profile.recentDefaults.length > 0 ? (
                  profile.recentDefaults.map((d) => (
                    <View key={d.id} style={styles.defaultRow}>
                      <View style={{ flex: 1 }}>
                        <BodyText style={{ fontWeight: '700' }}>
                          ₹{(d.amountPaise / 100).toLocaleString('en-IN')} ·{' '}
                          {d.tenureMonths} mo · {d.roiPercent}%
                        </BodyText>
                        <BodyText variant="caption" color={colors.inkMuted}>
                          With {d.counterpartyName} ·{' '}
                          {d.defaultedAt
                            ? new Date(d.defaultedAt).toLocaleDateString()
                            : '—'}
                        </BodyText>
                        {d.defaultReason ? (
                          <BodyText
                            variant="caption"
                            color={colors.inkMuted}
                            style={{ marginTop: 2, fontStyle: 'italic' }}
                          >
                            &ldquo;{d.defaultReason}&rdquo;
                          </BodyText>
                        ) : null}
                      </View>
                      <View style={styles.defaultRoleBadge}>
                        <BodyText style={styles.defaultRoleBadgeText}>
                          as {d.defaultedBy}
                        </BodyText>
                      </View>
                    </View>
                  ))
                ) : null}
              </View>
            ) : null}

            {/* Ratings card */}
            <View style={styles.ratingsCard}>
              <View style={styles.ratingsHeader}>
                <View>
                  <BodyText variant="caption" color={colors.inkMuted}>
                    AVERAGE RATING
                  </BodyText>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                    <Heading style={{ marginTop: spacing.xs }}>
                      {profile.stats.averageRating !== null
                        ? profile.stats.averageRating.toFixed(1)
                        : '—'}
                    </Heading>
                    <BodyText variant="bodyMuted">/ 5</BodyText>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <BodyText variant="caption" color={colors.inkMuted}>
                    TOTAL REVIEWS
                  </BodyText>
                  <Heading level="h3" style={{ marginTop: spacing.xs }}>
                    {profile.stats.totalReviews}
                  </Heading>
                </View>
              </View>

              {profile.stats.totalReviews > 0 ? (
                <View style={{ marginTop: spacing.md }}>
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = profile.stats.distribution[stars as 1 | 2 | 3 | 4 | 5];
                    const widthPct = (count / maxDist) * 100;
                    return (
                      <View key={stars} style={styles.distRow}>
                        <BodyText variant="caption" color={colors.inkMuted} style={{ width: 30 }}>
                          {stars}★
                        </BodyText>
                        <View style={styles.distBarBg}>
                          <View style={[styles.distBarFill, { width: `${widthPct}%` }]} />
                        </View>
                        <BodyText
                          variant="caption"
                          color={colors.inkMuted}
                          style={{ width: 30, textAlign: 'right' }}
                        >
                          {count}
                        </BodyText>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>

            <BodyText
              variant="caption"
              color={colors.inkMuted}
              style={{ marginTop: spacing.lg, marginBottom: spacing.sm, letterSpacing: 0.5 }}
            >
              {reviews.length > 0 ? 'RECENT REVIEWS' : ''}
            </BodyText>
          </View>
        }
        renderItem={({ item }) => <ReviewCard review={item} />}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Heading level="h3">No reviews yet</Heading>
            <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm }}>
              {isMe
                ? 'Reviews left by other users will appear here after your loans close.'
                : 'No completed loans yet, or no reviews submitted.'}
            </BodyText>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statTile}>
      <BodyText variant="caption" color={colors.inkMuted}>
        {label.toUpperCase()}
      </BodyText>
      <BodyText style={{ marginTop: spacing.xs, fontSize: 16, fontWeight: '700' }}>
        {value}
      </BodyText>
    </View>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={{ flex: 1 }}>
          <BodyText style={{ fontWeight: '700' }}>{review.reviewerSnapshot.name}</BodyText>
          <BodyText variant="caption" color={colors.inkMuted}>
            {review.reviewerRole === 'borrower' ? 'as borrower' : 'as lender'} ·{' '}
            {timeAgo(review.createdAt)}
          </BodyText>
        </View>
        <BodyText style={{ color: '#F59E0B', fontSize: 16 }}>{stars}</BodyText>
      </View>
      {review.comment ? (
        <BodyText style={{ marginTop: spacing.sm }}>{review.comment}</BodyText>
      ) : null}
      {review.tags.length > 0 ? (
        <View style={styles.reviewTagRow}>
          {review.tags.map((t) => (
            <View key={t} style={styles.reviewTagChip}>
              <BodyText variant="caption" color={colors.inkMuted} style={{ fontWeight: '600' }}>
                {REVIEW_TAG_LABELS[t as ReviewTag] ?? t}
              </BodyText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  listContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },

  identityCard: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { color: colors.white, fontSize: 32, fontWeight: '700' },
  bandPill: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  bandPillText: { color: colors.white, fontWeight: '700', fontSize: 12 },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statTile: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'flex-start',
  },

  ratingsCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  ratingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  distBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: colors.paper,
    borderRadius: 4,
    overflow: 'hidden',
  },
  distBarFill: { height: 8, backgroundColor: '#F59E0B', borderRadius: 4 },

  reviewCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  reviewTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  reviewTagChip: {
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },

  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.xl,
  },
  defaultsCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  defaultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  defaultsTitle: { fontWeight: '700', color: '#991B1B' },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#FECACA',
    gap: spacing.sm,
  },
  defaultRoleBadge: {
    backgroundColor: '#991B1B',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  defaultRoleBadgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
});
