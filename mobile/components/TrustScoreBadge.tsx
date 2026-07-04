/**
 * TrustScoreBadge — circular score + band label.
 *
 * Used on home dashboard, public profile pages, and on every user reference
 * across the app. Reads band colors from the shared theme.
 */
import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing, typography } from '../constants/theme';
import { BodyText } from './BodyText';

type Band = 'building' | 'fair' | 'good' | 'very_good' | 'excellent';

const BAND_LABELS: Record<Band, string> = {
  building: 'Building',
  fair: 'Fair',
  good: 'Good',
  very_good: 'Very Good',
  excellent: 'Excellent',
};

const BAND_COLORS: Record<Band, string> = {
  building: colors.band.building,
  fair: colors.band.fair,
  good: colors.band.good,
  very_good: colors.band.veryGood,
  excellent: colors.band.excellent,
};

type Props = {
  score: number;
  band?: string;
  size?: 'sm' | 'md' | 'lg';
};

export function TrustScoreBadge({ score, band, size = 'md' }: Props) {
  const normalizedBand = (band ?? 'building') as Band;
  const color = BAND_COLORS[normalizedBand] ?? colors.band.building;
  const label = BAND_LABELS[normalizedBand] ?? 'Building';

  const dims = SIZES[size];

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.ring,
          {
            width: dims.ring,
            height: dims.ring,
            borderRadius: dims.ring / 2,
            borderColor: color,
            borderWidth: dims.border,
          },
        ]}
      >
        <BodyText style={{ ...typography.h1, fontSize: dims.scoreFont, color: colors.ink }}>
          {score}
        </BodyText>
        <BodyText variant="caption" color={colors.inkMuted}>
          TrustScore
        </BodyText>
      </View>
      <View style={[styles.pill, { backgroundColor: color }]}>
        <BodyText variant="caption" color={colors.white}>
          {label}
        </BodyText>
      </View>
    </View>
  );
}

const SIZES = {
  sm: { ring: 80, border: 3, scoreFont: 20 },
  md: { ring: 120, border: 4, scoreFont: 28 },
  lg: { ring: 160, border: 5, scoreFont: 36 },
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm },
  ring: {
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
});
