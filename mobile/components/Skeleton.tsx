/**
 * Loading skeletons — placeholder bars and cards while data fetches.
 *
 * Subtle pulse via Animated. Reach for these on the first load of a screen
 * (when there's nothing yet to show); use the existing spinner on pull-to-
 * refresh or list-pagination loads.
 *
 *   <SkeletonLine />          // single bar at default width
 *   <SkeletonLine width={120} height={10} />
 *   <SkeletonCard rows={3} />  // a card-shaped block with N rows
 */
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';

function usePulse(): Animated.Value {
  const value = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  return value;
}

export function SkeletonLine({
  width = '100%' as ViewStyle['width'],
  height = 14,
  style,
}: {
  width?: ViewStyle['width'];
  height?: number;
  style?: ViewStyle;
}) {
  const opacity = usePulse();
  return (
    <Animated.View
      style={[
        styles.bar,
        { width, height, opacity, borderRadius: height / 2 },
        style,
      ]}
    />
  );
}

export function SkeletonCircle({ size = 40 }: { size?: number }) {
  const opacity = usePulse();
  return (
    <Animated.View
      style={[styles.bar, { width: size, height: size, borderRadius: size / 2, opacity }]}
    />
  );
}

export function SkeletonCard({
  rows = 2,
  showAvatar = false,
  style,
}: {
  rows?: number;
  showAvatar?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.card, style]}>
      {showAvatar ? (
        <View style={styles.cardRow}>
          <SkeletonCircle size={36} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <SkeletonLine width="50%" height={12} />
            <SkeletonLine width="30%" height={10} />
          </View>
        </View>
      ) : null}
      <View style={{ gap: spacing.sm, marginTop: showAvatar ? spacing.md : 0 }}>
        {Array.from({ length: rows }).map((_, idx) => (
          <SkeletonLine
            key={idx}
            width={idx === rows - 1 ? '60%' : '100%'}
            height={12}
          />
        ))}
      </View>
    </View>
  );
}

export function SkeletonList({
  count = 3,
  showAvatar = false,
  rows = 2,
}: {
  count?: number;
  showAvatar?: boolean;
  rows?: number;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonCard key={idx} showAvatar={showAvatar} rows={rows} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#E2E8F0',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
