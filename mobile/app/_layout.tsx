/**
 * Root layout — wraps every route in the AuthProvider and SafeAreaProvider.
 * Sets up the global Stack navigator + the notification handlers (banner +
 * tap-to-deep-link).
 */
import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth-context';
import {
  attachNotificationTapListener,
  setupNotificationHandler,
} from '../lib/push-notifications';
import { tracker } from '../lib/tracker';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { colors } from '../constants/theme';

// Fires once on module load — well before any screen mounts. Configures
// foreground notification rendering (alert + sound + badge).
setupNotificationHandler();

// Telemetry — Sentry-shaped abstraction. DSN comes from app config; when
// the user later wires a real Sentry DSN into `extra.sentryDsn`, this
// picks it up automatically.
tracker.init({
  dsn: (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn,
  environment: __DEV__ ? 'development' : 'production',
  release:
    (Constants.expoConfig?.version as string | undefined) ?? 'unknown',
});

export default function RootLayout() {
  // Tap-to-deep-link: when the user taps a notification (foreground or
  // tray), if the notification carries `deepLink` in data, navigate to it.
  useEffect(() => {
    return attachNotificationTapListener((deepLink) => {
      if (deepLink) {
        // `as never` — Expo Router typed routes don't know dynamic deep-link strings.
        router.push(deepLink as never);
      }
    });
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.paper },
            }}
          />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
