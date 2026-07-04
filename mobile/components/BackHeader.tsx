/**
 * BackHeader — bigger, more reliable back affordance than the previous
 * `<BodyText onPress>` pattern.
 *
 * Fixes:
 *   - Tap target is now 44pt minimum (Apple HIG + Material guideline)
 *   - hitSlop expands the touch area further so fat thumbs work
 *   - Falls back to a sensible route when `router.canGoBack()` is false
 *     (e.g. when this screen was opened via deep-link or as the first stack
 *     entry, plain `router.back()` would do nothing)
 *
 * Drop this near the top of any screen instead of writing back logic inline.
 */
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing } from '../constants/theme';

type Props = {
  /** Path to navigate to if there's no history. Defaults to '/home'. */
  fallback?: string;
  /** Custom label; default '← Back'. */
  label?: string;
  /**
   * Custom handler. When provided, the component skips the
   * canGoBack / router.back / fallback chain entirely and just calls
   * this. Use for screens that manage internal state (e.g. multi-step
   * wizards that "go back" to a previous step, not a previous route).
   */
  onPress?: () => void;
};

export function BackHeader({ fallback = '/home', label = '← Back', onPress }: Props) {
  const onBack =
    onPress ??
    (() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        // `as never` — Expo Router's typed routes don't know our fallback param
        // shape at the call site; runtime navigation is fine either way.
        router.replace(fallback as never);
      }
    });

  return (
    <Pressable
      onPress={onBack}
      hitSlop={{ top: 12, right: 16, bottom: 12, left: 16 }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginLeft: -spacing.md, // visually align with screen padding while keeping the touch area generous
    marginBottom: spacing.sm,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.55 },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
  },
});
