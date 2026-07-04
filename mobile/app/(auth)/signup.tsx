import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Pressable, StyleSheet, TextInput as RNTextInput, View } from 'react-native';
import { router } from 'expo-router';
import { signupSchema, type SignupInput } from 'trustpe-shared';
import { Screen } from '../../components/Screen';
import { Heading } from '../../components/Heading';
import { BodyText } from '../../components/BodyText';
import { Button } from '../../components/Button';
import { TextInput } from '../../components/TextInput';
import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../lib/auth-context';
import { ApiError } from '../../lib/api';

export default function Signup() {
  const { signup } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { phone: '', email: '', name: '' },
    mode: 'onBlur',
  });

  const onSubmit = async (data: SignupInput) => {
    setSubmitting(true);
    try {
      const result = await signup(data);
      router.push({ pathname: '/verify-otp', params: { email: result.otpSentTo } });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'phone_already_registered') {
          setError('phone', { message: err.message });
        } else if (err.code === 'otp_delivery_failed') {
          setError('email', {
            message: "Couldn't send the code to this address. Double-check it or try again.",
          });
        } else if (err.code === 'rate_limited') {
          Alert.alert(
            'Too many attempts',
            err.message ?? 'Please wait a few minutes and try again.',
          );
        } else if (err.code === 'validation_error' && err.details && typeof err.details === 'object') {
          for (const [field, msgs] of Object.entries(err.details as Record<string, string[]>)) {
            setError(field as keyof SignupInput, { message: msgs?.[0] ?? 'Invalid' });
          }
        } else {
          Alert.alert("Couldn't sign up", err.message);
        }
      } else {
        Alert.alert('Something went wrong', 'Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll>
      <View style={{ marginBottom: spacing.xl }}>
        <Heading>Create your account</Heading>
        <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm }}>
          We'll email you a 6-digit code to verify. No password needed.
        </BodyText>
      </View>

      <Controller
        control={control}
        name="name"
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            label="Your name"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="words"
            autoComplete="name"
            placeholder="As on your Aadhaar / PAN"
            error={errors.name?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="phone"
        render={({ field: { value, onChange, onBlur } }) => (
          <PhoneInput
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            error={errors.phone?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="email"
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            label="Email"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@gmail.com"
            error={errors.email?.message}
          />
        )}
      />

      <View style={{ marginTop: spacing.md }}>
        <Button onPress={handleSubmit(onSubmit)} loading={submitting}>
          Send verification code
        </Button>
      </View>

      <Pressable
        onPress={() => router.replace('/login')}
        style={({ pressed }) => [styles.footerLink, pressed && { opacity: 0.6 }]}
        hitSlop={12}
      >
        <BodyText align="center" color={colors.inkMuted}>
          Already have an account?{' '}
          <BodyText color={colors.accent} style={{ fontWeight: '700' }}>
            Sign in
          </BodyText>
        </BodyText>
      </Pressable>

      <BodyText
        variant="caption"
        align="center"
        style={{ marginTop: spacing.xl, lineHeight: 18 }}
      >
        By continuing you agree to our{' '}
        <BodyText
          variant="caption"
          color={colors.accent}
          onPress={() => router.push('/legal/terms')}
        >
          Terms
        </BodyText>{' '}
        and{' '}
        <BodyText
          variant="caption"
          color={colors.accent}
          onPress={() => router.push('/legal/privacy')}
        >
          Privacy Policy
        </BodyText>
        . Approval requires KYC review by the TrustPe team.
      </BodyText>
    </Screen>
  );
}

/**
 * PhoneInput — 10-digit Indian mobile entry with a fixed "+91" prefix.
 * Strips non-digits and clamps to 10 chars while typing.
 */
function PhoneInput({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error?: string;
}) {
  // Display value: just the local digits (no +91 prefix). The Zod transform
  // re-adds +91 server-side.
  const display = value.replace(/\D/g, '').slice(-10);

  const handleChange = (text: string) => {
    // Accept only digits and cap at 10.
    const digits = text.replace(/\D/g, '').slice(0, 10);
    onChange(digits);
  };

  return (
    <View style={styles.fieldWrap}>
      <BodyText variant="caption" color={colors.inkMuted} style={styles.label}>
        MOBILE NUMBER
      </BodyText>
      <View style={[styles.row, error ? styles.rowError : null]}>
        <View style={styles.prefixBox}>
          <BodyText style={styles.prefixText}>+91</BodyText>
        </View>
        <RNTextInput
          value={display}
          onChangeText={handleChange}
          onBlur={onBlur}
          keyboardType="number-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="10-digit mobile"
          placeholderTextColor={colors.inkSubtle}
          maxLength={10}
          style={styles.input}
        />
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
  footerLink: { marginTop: spacing.lg, paddingVertical: spacing.md, alignSelf: 'center' },
  fieldWrap: { marginBottom: spacing.lg },
  label: { marginBottom: spacing.xs, letterSpacing: 0.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
    minHeight: 48,
  },
  rowError: { borderColor: colors.danger },
  prefixBox: {
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    backgroundColor: colors.paper,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  prefixText: { ...typography.body, color: colors.inkMuted, fontWeight: '600' },
  input: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    fontSize: typography.body.fontSize,
    color: colors.ink,
  },
  helper: { marginTop: spacing.xs },
});
