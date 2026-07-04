/**
 * AutocompleteInput — TextInput with an inline suggestion list.
 *
 * Suggestions render directly below the input (no floating overlay) so the
 * surrounding ScrollView handles vertical space naturally. The field always
 * accepts free-text — suggestions are just shortcuts, never enforced.
 *
 * Used by:
 *   - profile.tsx city field (with cities + state + country)
 *   - profile.tsx role field (with common job titles)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  type NativeEventSubscription,
  StyleSheet,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
  type TextInputProps as RNTextInputProps,
} from 'react-native';
import { colors, radii, spacing, typography } from '../constants/theme';
import { BodyText } from './BodyText';

export type AutocompleteSuggestion = {
  /** The value that will populate the input on selection. */
  value: string;
  /** Optional smaller text under the value (e.g., state + country for cities). */
  subtitle?: string;
  /** Stable key for lists with duplicate `value` (e.g., 'Hyderabad,Telangana'). */
  key?: string;
};

type Props = Omit<RNTextInputProps, 'value' | 'onChangeText'> & {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Called with the user's current text; returns suggestions to show. */
  getSuggestions: (query: string) => AutocompleteSuggestion[];
  error?: string;
  hint?: string;
  /** Cap on suggestion rows shown (defaults to 6). */
  maxSuggestions?: number;
};

export function AutocompleteInput({
  label,
  value,
  onChange,
  getSuggestions,
  error,
  hint,
  maxSuggestions = 6,
  ...inputProps
}: Props) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<RNTextInput>(null);
  // Track whether the user just picked a suggestion so we don't immediately
  // re-show the list while the value matches a suggestion exactly.
  const justPickedRef = useRef(false);

  const suggestions = useMemo(() => {
    if (justPickedRef.current) return [];
    return getSuggestions(value).slice(0, maxSuggestions);
  }, [value, getSuggestions, maxSuggestions]);

  const showSuggestions = focused && suggestions.length > 0;

  useEffect(() => {
    // Reset the "just picked" flag once the user edits the field again.
    if (!focused) justPickedRef.current = false;
  }, [focused]);

  // Close suggestions when the keyboard hides. Catches the "tap outside the
  // input" case where Keyboard.dismiss() runs but the input itself doesn't
  // necessarily blur (Android quirk inside ScrollViews).
  useEffect(() => {
    if (!focused) return undefined;
    const sub: NativeEventSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setFocused(false);
    });
    return () => sub.remove();
  }, [focused]);

  const handleChange = (next: string) => {
    justPickedRef.current = false;
    onChange(next);
  };

  const handlePick = (s: AutocompleteSuggestion) => {
    justPickedRef.current = true;
    onChange(s.value);
    Keyboard.dismiss();
    setFocused(false);
  };

  return (
    <View style={styles.field}>
      {label ? (
        <BodyText variant="caption" color={colors.inkMuted} style={styles.label}>
          {label.toUpperCase()}
        </BodyText>
      ) : null}
      <RNTextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          // Defer so a tap on a suggestion can fire before we hide the list.
          setTimeout(() => setFocused(false), 150);
          inputProps.onBlur?.(e);
        }}
        placeholderTextColor={colors.inkSubtle}
        style={[styles.input, error ? styles.inputError : null]}
        {...inputProps}
      />

      {showSuggestions ? (
        <View style={styles.suggestionList}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={s.key ?? `${s.value}-${i}`}
              onPress={() => handlePick(s)}
              activeOpacity={0.6}
              style={[
                styles.suggestionRow,
                i === suggestions.length - 1 && styles.suggestionRowLast,
              ]}
              accessibilityRole="button"
              accessibilityLabel={s.subtitle ? `${s.value}, ${s.subtitle}` : s.value}
            >
              <View style={{ flex: 1 }}>
                <BodyText>{s.value}</BodyText>
                {s.subtitle ? (
                  <BodyText variant="caption" color={colors.inkMuted}>
                    {s.subtitle}
                  </BodyText>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

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
}

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
  suggestionList: {
    marginTop: spacing.xs,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestionRowLast: { borderBottomWidth: 0 },
});
