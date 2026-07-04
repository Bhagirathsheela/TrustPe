/**
 * Review submission screen.
 *
 * Reached via `/reviews/new?loanId=X`. Fetches the loan to determine who
 * the reviewer is reviewing (the other party), then renders:
 *   - Counterparty name + TrustScore badge
 *   - 5-star rating selector
 *   - Tag chips (curated to the reviewer's role)
 *   - Optional comment textarea
 *   - Submit
 *
 * The score impact preview tells the reviewer exactly how their rating will
 * shift the other party's TrustScore — transparent by design.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BORROWER_ON_LENDER_TAGS,
  LENDER_ON_BORROWER_TAGS,
  REVIEW_TAG_LABELS,
  submitReviewSchema,
  type ReviewTag,
  type SubmitReviewInput,
} from 'trustpe-shared';
import { Heading } from '../../../components/Heading';
import { BodyText } from '../../../components/BodyText';
import { Button } from '../../../components/Button';
import { TextInput } from '../../../components/TextInput';
import { BackHeader } from '../../../components/BackHeader';
import { colors, radii, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth-context';
import { ApiError } from '../../../lib/api';

type LoanLite = {
  id: string;
  borrowerId: string;
  lenderId: string;
  status: string;
  borrowerSnapshot: { name: string; trustScore: number; trustBand: string };
  lenderSnapshot: { name: string; trustScore: number; trustBand: string };
};

const RATING_COPY: Record<number, string> = {
  1: 'Very poor experience',
  2: 'Below expectations',
  3: 'Fair — nothing notable',
  4: 'Good experience',
  5: 'Excellent — would recommend',
};

const BAND_LABELS: Record<string, string> = {
  building: 'Building',
  fair: 'Fair',
  good: 'Good',
  very_good: 'Very Good',
  excellent: 'Excellent',
};

export default function NewReview() {
  const params = useLocalSearchParams<{ loanId?: string }>();
  const loanId = params.loanId;
  const { apiCall, user } = useAuth();
  const [loan, setLoan] = useState<LoanLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<ReviewTag[]>([]);

  const load = useCallback(async () => {
    if (!loanId) return;
    try {
      const data = await apiCall<LoanLite>({ path: `/loans/${loanId}` });
      setLoan(data);
      // Check whether the viewer has already left a review for this loan
      try {
        const mine = await apiCall<{ id: string } | null>({
          path: `/loans/${loanId}/reviews/mine`,
        });
        if (mine?.id) {
          Alert.alert(
            'Already reviewed',
            "You've already left a review for this loan.",
            [{ text: 'OK', onPress: () => router.replace(`/loans/${loanId}`) }],
          );
        }
      } catch {
        /* if check fails, allow attempt anyway */
      }
    } catch (err) {
      Alert.alert("Couldn't load loan", err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiCall, loanId]);

  useEffect(() => {
    void load();
  }, [load]);

  const role = useMemo<'borrower' | 'lender' | null>(() => {
    if (!loan || !user) return null;
    if (user.id === loan.borrowerId) return 'borrower';
    if (user.id === loan.lenderId) return 'lender';
    return null;
  }, [loan, user]);

  const reviewee = useMemo(() => {
    if (!loan || !role) return null;
    return role === 'borrower' ? loan.lenderSnapshot : loan.borrowerSnapshot;
  }, [loan, role]);

  const availableTags = role === 'lender' ? LENDER_ON_BORROWER_TAGS : BORROWER_ON_LENDER_TAGS;

  const scoreDelta = rating > 0 ? (rating - 3) * 10 : 0;
  const newScore =
    reviewee && rating > 0
      ? Math.max(300, Math.min(900, reviewee.trustScore + scoreDelta))
      : null;

  const toggleTag = (tag: ReviewTag) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 5) {
        Alert.alert('Up to 5 tags', 'Pick the most descriptive ones.');
        return prev;
      }
      return [...prev, tag];
    });
  };

  const onSubmit = async () => {
    if (!loanId || rating === 0) {
      Alert.alert('Rating needed', 'Pick a 1–5 star rating before submitting.');
      return;
    }
    const payload: SubmitReviewInput = {
      rating,
      comment: comment.trim() || undefined,
      tags: selectedTags.length ? selectedTags : undefined,
    };
    const parsed = submitReviewSchema.safeParse(payload);
    if (!parsed.success) {
      Alert.alert("Couldn't submit", parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setSubmitting(true);
    try {
      await apiCall({ path: `/loans/${loanId}/reviews`, method: 'POST', body: parsed.data });
      Alert.alert('Thanks!', 'Your review is in. The TrustScore impact is now reflected on the other party.', [
        { text: 'OK', onPress: () => router.replace(`/loans/${loanId}`) },
      ]);
    } catch (err) {
      Alert.alert("Couldn't submit", err instanceof ApiError ? err.message : 'Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !loan || !reviewee) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <BodyText variant="bodyMuted">Loading…</BodyText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BackHeader fallback={`/loans/${loan.id}`} />
        <Heading>Rate your experience</Heading>
        <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
          Honest reviews keep the TrustPe network healthy. Your rating directly affects{' '}
          <BodyText style={{ fontWeight: '700' }}>{reviewee.name}</BodyText>&apos;s TrustScore.
        </BodyText>

        <Pressable
          onPress={() =>
            router.push(`/users/${role === 'borrower' ? loan.lenderId : loan.borrowerId}`)
          }
          style={({ pressed }) => [styles.revieweeCard, pressed && { opacity: 0.75 }]}
        >
          <BodyText variant="caption" color={colors.inkMuted}>
            REVIEWING
          </BodyText>
          <BodyText style={{ fontSize: 20, fontWeight: '700', marginTop: spacing.xs }}>
            {reviewee.name}
          </BodyText>
          <BodyText variant="bodyMuted">
            {BAND_LABELS[reviewee.trustBand] ?? reviewee.trustBand} · TrustScore{' '}
            {reviewee.trustScore} ·{' '}
            {role === 'borrower' ? 'as your lender' : 'as your borrower'}
          </BodyText>
          <BodyText variant="caption" color={colors.accent} style={{ marginTop: spacing.sm }}>
            View profile →
          </BodyText>
        </Pressable>

        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              onPress={() => setRating(n)}
              hitSlop={6}
              accessibilityLabel={`Rate ${n} stars`}
              style={({ pressed }) => [styles.starButton, pressed && { opacity: 0.7 }]}
            >
              <BodyText style={[styles.star, rating >= n && styles.starFilled]}>★</BodyText>
            </Pressable>
          ))}
        </View>
        <BodyText
          variant="bodyMuted"
          align="center"
          style={{ marginBottom: spacing.lg, minHeight: 22 }}
        >
          {rating > 0 ? RATING_COPY[rating] : 'Tap a star to rate'}
        </BodyText>

        {/* Score impact preview */}
        {rating > 0 && newScore !== null ? (
          <View
            style={[
              styles.impactCard,
              scoreDelta > 0
                ? styles.impactPositive
                : scoreDelta < 0
                  ? styles.impactNegative
                  : styles.impactNeutral,
            ]}
          >
            <BodyText style={{ fontWeight: '700' }}>
              {scoreDelta >= 0 ? '+' : ''}
              {scoreDelta} TrustScore
            </BodyText>
            <BodyText variant="caption" color={colors.inkMuted}>
              {reviewee.name} goes from {reviewee.trustScore} → {newScore}
            </BodyText>
          </View>
        ) : null}

        {/* Tags */}
        <BodyText variant="caption" color={colors.inkMuted} style={styles.sectionLabel}>
          QUICK TAGS (UP TO 5)
        </BodyText>
        <View style={styles.tagRow}>
          {availableTags.map((tag) => {
            const selected = selectedTags.includes(tag);
            return (
              <Pressable
                key={tag}
                onPress={() => toggleTag(tag)}
                style={({ pressed }) => [
                  styles.tagChip,
                  selected && styles.tagChipSelected,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <BodyText
                  style={{
                    color: selected ? colors.white : colors.ink,
                    fontWeight: '600',
                    fontSize: 13,
                  }}
                >
                  {REVIEW_TAG_LABELS[tag]}
                </BodyText>
              </Pressable>
            );
          })}
        </View>

        {/* Comment */}
        <BodyText variant="caption" color={colors.inkMuted} style={styles.sectionLabel}>
          OPTIONAL COMMENT
        </BodyText>
        <TextInput
          label=""
          value={comment}
          onChangeText={setComment}
          placeholder="Share details that help future borrowers or lenders"
          multiline
          maxLength={500}
        />
        <BodyText variant="caption" color={colors.inkMuted} align="right">
          {comment.length} / 500
        </BodyText>

        <View style={{ marginTop: spacing.xl }}>
          <Button onPress={onSubmit} loading={submitting} disabled={rating === 0}>
            Submit review
          </Button>
        </View>

        <BodyText
          variant="caption"
          color={colors.inkMuted}
          align="center"
          style={{ marginTop: spacing.lg, lineHeight: 18 }}
        >
          Reviews are visible on the other party&apos;s public profile. You can&apos;t edit
          after submitting, so be sure of your rating.
        </BodyText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },

  revieweeCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },

  starRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  starButton: { padding: spacing.xs },
  star: { fontSize: 44, color: colors.border },
  starFilled: { color: '#F59E0B' },

  impactCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  impactPositive: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  impactNegative: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  impactNeutral: { backgroundColor: colors.paper, borderColor: colors.border },

  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm, letterSpacing: 0.5 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  tagChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.paper,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagChipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
});
