/**
 * Six-digit OTP entry with auto-advance.
 *
 * Renders six individual boxes; typing a digit advances focus to the next box,
 * backspace on an empty box jumps back. Pasting a 6-digit code spreads across
 * all boxes (Android paste from SMS or clipboard).
 */
import { useRef, useState, useEffect } from 'react';
import { StyleSheet, TextInput as RNTextInput, View } from 'react-native';
import { colors, radii, spacing, typography } from '../constants/theme';
import { BodyText } from './BodyText';

type Props = {
  value: string;
  onChange: (next: string) => void;
  error?: string;
  autoFocus?: boolean;
};

export function OtpInput({ value, onChange, error, autoFocus = true }: Props) {
  const refs = useRef<Array<RNTextInput | null>>([]);
  const [focused, setFocused] = useState(0);

  // Pad/truncate to 6 chars for rendering.
  const digits = value.slice(0, 6).padEnd(6, ' ').split('');

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const handleChange = (index: number, text: string) => {
    // Strip non-digits and handle paste case (more than 1 char).
    const stripped = text.replace(/\D/g, '');
    if (!stripped) {
      // backspace cleared this box
      const next = value.slice(0, index) + value.slice(index + 1);
      onChange(next);
      return;
    }
    if (stripped.length > 1) {
      // paste — spread across boxes starting at `index`
      const padded = (value.slice(0, index) + stripped).slice(0, 6);
      onChange(padded);
      const last = Math.min(padded.length, 5);
      refs.current[last]?.focus();
      return;
    }
    // Single digit typed
    const next = value.slice(0, index) + stripped + value.slice(index + 1);
    onChange(next.slice(0, 6));
    if (index < 5) refs.current[index + 1]?.focus();
  };

  const handleKey = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index]?.trim() && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {digits.map((d, i) => (
          <RNTextInput
            key={i}
            ref={(r) => {
              refs.current[i] = r;
            }}
            value={d.trim()}
            onChangeText={(t) => handleChange(i, t)}
            onKeyPress={(e) => handleKey(i, e.nativeEvent.key)}
            onFocus={() => setFocused(i)}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={1}
            style={[
              styles.box,
              focused === i && styles.boxFocused,
              error ? styles.boxError : null,
            ]}
            selectionColor={colors.accent}
          />
        ))}
      </View>
      {error ? (
        <BodyText variant="caption" color={colors.danger} style={styles.helper}>
          {error}
        </BodyText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  box: {
    flex: 1,
    minHeight: 56,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    textAlign: 'center',
    fontSize: typography.h2.fontSize,
    fontWeight: '600',
    color: colors.ink,
  },
  boxFocused: { borderColor: colors.accent, borderWidth: 2 },
  boxError: { borderColor: colors.danger },
  helper: { marginTop: spacing.sm, textAlign: 'center' },
});
