import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Heading } from '../../components/Heading';
import { BodyText } from '../../components/BodyText';
import { Button } from '../../components/Button';
import { OtpInput } from '../../components/OtpInput';
import { colors, spacing } from '../../constants/theme';
import { useAuth } from '../../lib/auth-context';
import { ApiError } from '../../lib/api';

/** Seconds to wait before resend is allowed again. */
const RESEND_COOLDOWN_SEC = 30;

export default function VerifyOtp() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { verifyOtp, login } = useAuth();
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SEC);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fullEntered = otp.length === 6;
  const canResend = cooldown === 0 && !resending;

  // Start a cooldown on mount (the OTP was just sent from the previous screen)
  // and on every successful resend. The interval clears itself when it hits 0.
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          if (tickRef.current) clearInterval(tickRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const onSubmit = async () => {
    if (!fullEntered || !email) return;
    setOtpError(undefined);
    setSubmitting(true);
    try {
      await verifyOtp({ email, otp });
      // Successful verify auto-sets the session via auth-context.
      // Redirect to the home dashboard.
      router.replace('/home');
    } catch (err) {
      if (err instanceof ApiError) {
        const messages: Record<string, string> = {
          otp_incorrect: 'Incorrect code. Try again.',
          otp_expired: 'This code has expired. Tap "Resend" for a new one.',
          otp_not_found: 'No code pending. Tap "Resend" to receive a new one.',
          otp_too_many_attempts: 'Too many attempts. Tap "Resend" for a new code.',
        };
        setOtpError(messages[err.code] ?? err.message);
      } else {
        Alert.alert('Something went wrong', 'Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (!email || !canResend) return;
    setResending(true);
    setOtpError(undefined);
    try {
      await login({ email });
      setOtp('');
      // Restart the cooldown so the user can't spam the email service.
      setCooldown(RESEND_COOLDOWN_SEC);
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = setInterval(() => {
        setCooldown((s) => {
          if (s <= 1) {
            if (tickRef.current) clearInterval(tickRef.current);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
      Alert.alert('Code sent', `We've emailed a fresh 6-digit code to ${email}.`);
    } catch (err) {
      Alert.alert(
        "Couldn't resend",
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen>
      <View style={{ marginTop: spacing.xl }}>
        <Heading>Check your email</Heading>
        <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm }}>
          We sent a 6-digit code to{' '}
          <BodyText style={{ fontWeight: '600' }}>{email ?? 'your email'}</BodyText>. Enter it
          below to continue.
        </BodyText>
      </View>

      <OtpInput value={otp} onChange={setOtp} error={otpError} />

      <Button onPress={onSubmit} loading={submitting} disabled={!fullEntered}>
        Verify
      </Button>

      <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
        {canResend ? (
          <Button variant="ghost" onPress={onResend} loading={resending} fullWidth={false}>
            Didn&apos;t get the code? Resend
          </Button>
        ) : (
          <BodyText variant="caption" color={colors.inkMuted}>
            Resend available in {cooldown}s
          </BodyText>
        )}
      </View>

      <View style={{ flex: 1 }} />

      <Button variant="ghost" onPress={() => router.back()}>
        Use a different email
      </Button>
    </Screen>
  );
}
