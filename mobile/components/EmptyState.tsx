/**
 * Empty state — a friendly placeholder for "no data yet" on list screens.
 *
 * Convention: emoji icon, headline, sub-line, optional primary action.
 * Keep copy human and specific to the screen — "No loans yet" is fine,
 * "Your loans will appear here once you sign one with someone in your
 * circle" is better.
 */
import { StyleSheet, View } from 'react-native';
import { Heading } from './Heading';
import { BodyText } from './BodyText';
import { Button } from './Button';
import { colors, spacing } from '../constants/theme';

export type EmptyStateProps = {
  icon?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export function EmptyState({
  icon = '✨',
  title,
  subtitle,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <BodyText style={styles.iconText}>{icon}</BodyText>
      </View>
      <Heading level="h3" align="center">
        {title}
      </Heading>
      {subtitle ? (
        <BodyText
          align="center"
          color={colors.inkMuted}
          style={{ marginTop: spacing.sm, lineHeight: 22, maxWidth: 300 }}
        >
          {subtitle}
        </BodyText>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.xl, width: '100%', maxWidth: 280 }}>
          <Button onPress={onAction}>{actionLabel}</Button>
          {secondaryLabel && onSecondary ? (
            <>
              <View style={{ height: spacing.sm }} />
              <Button variant="secondary" onPress={onSecondary}>
                {secondaryLabel}
              </Button>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconText: { fontSize: 36 },
});
