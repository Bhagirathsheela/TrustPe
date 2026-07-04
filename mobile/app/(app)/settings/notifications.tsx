/**
 * Notification preferences.
 *
 * One toggle per category. Muted categories don't generate push notifications,
 * but the in-app feed always still records so users can review history.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  NOTIFICATION_CATEGORY_HINTS,
  NOTIFICATION_CATEGORY_LABELS,
  notificationCategorySchema,
  type NotificationCategory,
} from 'trustpe-shared';
import { Heading } from '../../../components/Heading';
import { BodyText } from '../../../components/BodyText';
import { Button } from '../../../components/Button';
import { BackHeader } from '../../../components/BackHeader';
import { colors, radii, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth-context';
import { ApiError } from '../../../lib/api';

const CATEGORY_ORDER = notificationCategorySchema.options as NotificationCategory[];

export default function NotificationPreferences() {
  const { apiCall } = useAuth();
  const [muted, setMuted] = useState<Set<NotificationCategory>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiCall<{ mutedCategories: NotificationCategory[] }>({
        path: '/me/notification-preferences',
      });
      setMuted(new Set(data.mutedCategories));
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (category: NotificationCategory) => {
    setMuted((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiCall({
        path: '/me/notification-preferences',
        method: 'PATCH',
        body: { mutedCategories: Array.from(muted) },
      });
      setDirty(false);
      Alert.alert('Saved', 'Your notification preferences have been updated.');
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof ApiError ? err.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BackHeader fallback="/settings" />
        <Heading>Notifications</Heading>
        <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
          Turn off the categories you don&apos;t want push notifications for. You&apos;ll still
          see everything in your in-app notifications history.
        </BodyText>

        {loading ? (
          <BodyText variant="bodyMuted">Loading…</BodyText>
        ) : (
          CATEGORY_ORDER.map((category) => {
            const enabled = !muted.has(category);
            return (
              <Pressable
                key={category}
                onPress={() => toggle(category)}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.paper }]}
              >
                <View style={{ flex: 1 }}>
                  <BodyText style={{ fontWeight: '600', fontSize: 15 }}>
                    {NOTIFICATION_CATEGORY_LABELS[category]}
                  </BodyText>
                  <BodyText variant="caption" color={colors.inkMuted} style={{ marginTop: 2 }}>
                    {NOTIFICATION_CATEGORY_HINTS[category]}
                  </BodyText>
                </View>
                <View style={[styles.track, enabled && styles.trackOn]}>
                  <View style={[styles.thumb, enabled && styles.thumbOn]} />
                </View>
              </Pressable>
            );
          })
        )}

        {dirty ? (
          <View style={{ marginTop: spacing.xl }}>
            <Button onPress={save} loading={saving}>
              Save preferences
            </Button>
          </View>
        ) : null}

        <BodyText
          variant="caption"
          color={colors.inkMuted}
          align="center"
          style={{ marginTop: spacing.xl, lineHeight: 18 }}
        >
          We always notify you in-app for critical events like dispute resolutions and KYC
          decisions even if a category is muted, so you don&apos;t miss anything important on
          your account.
        </BodyText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: colors.accent },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignSelf: 'flex-start',
  },
  thumbOn: { alignSelf: 'flex-end' },
});
