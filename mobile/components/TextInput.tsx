/**
 * Labeled text input with error state.
 *
 * Stateless wrapper around React Native's TextInput. Used inside React Hook
 * Form's <Controller>; the form library passes value/onChange/onBlur and this
 * just renders.
 *
 * IMPORTANT: any `style` passed from the parent is MERGED with the base
 * input style (not replaced). The earlier version spread `{...rest}` after
 * the explicit `style=` prop, which meant any caller-supplied style replaced
 * the entire base style — including the border. Now we explicitly destructure
 * `style` so the merge order is preserved.
 */
import { forwardRef } from 'react';
import {
  StyleSheet,
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
  View,
} from 'react-native';
import { colors, radii, spacing, typography } from '../constants/theme';
import { BodyText } from './BodyText';

export type TextInputProps = RNTextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
};

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  { label, error, hint, style, ...rest },
  ref,
) {
  return (
    <View style={styles.field}>
      {label ? (
        <BodyText variant="caption" color={colors.inkMuted} style={styles.label}>
          {label.toUpperCase()}
        </BodyText>
      ) : null}
      <RNTextInput
        ref={ref}
        placeholderTextColor={colors.inkSubtle}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
        // TalkBack: read the label + any error/hint so context is clear
        // even when the visual label is offscreen. Spread comes first so
        // caller-provided values in `rest` still override these defaults
        // — but if rest.accessibility{Label,Hint} is undefined, we fall
        // back to the visible label / error / hint.
        accessibilityLabel={rest.accessibilityLabel ?? label}
        accessibilityHint={rest.accessibilityHint ?? error ?? hint}
      />
      {error ? (
        <BodyText variant="caption" color={colors.danger} style={styles.helper}>
          {error}
        </BodyText>
      ) : hint ? (
        <BodyText variant="caption" color={colors.inkMuted} style={styles.helper}>
          {hint}
        </BodyText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { marginBottom: spacing.lg },
  label: { marginBottom: spacing.xs, letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.ink,
    minHeight: 48,
  },
  inputError: { borderColor: colors.danger },
  helper: { marginTop: spacing.xs },
});
