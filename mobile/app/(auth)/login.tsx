/**
 * Login — returning user flow.
 *
 * The backend already supports email-only login via /auth/login, but until
 * now there was no UI surface for it (the welcome screen's "I already have
 * an account" button incorrectly pointed at /signup). This screen asks for
 * the registered email, requests a fresh OTP, and hands off to the same
 * verify-otp screen the signup flow uses.
 *
 * No password — same magic-link / email-OTP pattern as signup.
 */
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from 'trustpe-shared';
import { Screen } from '../../components/Screen';
import { Heading } from '../../components/Heading';
import { BodyText } from '../../components/BodyText';
import { Button } from '../../components/Button';
import { TextInput } from '../../components/TextInput';
import { colors, spacing } from '../../constants/theme';
import { useAuth } from '../../lib/auth-context';
import { ApiError } from '../../lib/api';

export default function Login() {
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '' },
    mode: 'onBlur',
  });

  const onSubmit = async (data: LoginInput) => {
    setSubmitting(true);
    try {
      const result = await login(data);
      router.push({ pathname: '/verify-otp', params: { email: result.otpSentTo } });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'user_not_found' || err.code === 'email_not_registered') {
          setError('email', {
            message: "We couldn't find an account with that email. Sign up instead?",
          });
        } else if (err.code === 'rate_limited') {
          Alert.alert(
            'Too many attempts',
            err.message ?? 'Please wait a few minutes and try again.',
          );
        } else if (err.code === 'validation_error' && err.details && typeof err.details === 'object') {
          for (const [field, msgs] of Object.entries(err.details as Record<string, string[]>)) {
            setError(field as keyof LoginInput, { message: msgs?.[0] ?? 'Invalid' });
          }
        } else {
          Alert.alert("Couldn't send the code", err.message);
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
      <View style={{ marginBottom: spacing.xl, marginTop: spacing.xl }}>
        <Heading>Welcome back</Heading>
        <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm }}>
          Enter the email you signed up with. We&apos;ll send a 6-digit code to verify.
        </BodyText>
      </View>

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
          Send sign-in code
        </Button>
      </View>

      <Pressable
        onPress={() => router.replace('/signup')}
        style={({ pressed }) => [styles.footerLink, pressed && { opacity: 0.6 }]}
        hitSlop={12}
      >
        <BodyText align="center" color={colors.inkMuted}>
          New to TrustPe?{' '}
          <BodyText color={colors.accent} style={{ fontWeight: '700' }}>
            Create an account
          </BodyText>
        </BodyText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footerLink: { marginTop: spacing.xl, paddingVertical: spacing.md, alignSelf: 'center' },
});
