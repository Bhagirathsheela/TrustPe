/**
 * Onboarding route group — auth-gated, used during the profile → KYC → UPI flow.
 * Sprint 1 ships only /onboarding/profile here; KYC + UPI screens land next.
 */
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../lib/auth-context';

export default function OnboardingLayout() {
  const { ready, isAuthenticated } = useAuth();
  if (!ready) return null;
  if (!isAuthenticated) return <Redirect href="/welcome" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
