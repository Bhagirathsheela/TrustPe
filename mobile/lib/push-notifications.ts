/**
 * Push notification registration + handler setup.
 *
 * - `setupNotificationHandler()` configures how foreground notifications
 *   render (alert + sound + badge). Call once at app boot.
 * - `attachNotificationTapListener(handler)` runs `handler` with the
 *   deep-link path when the user taps a notification. Returns a cleanup fn.
 * - `registerForPushNotifications()` asks for permission and returns an
 *   Expo Push token, or null if the user denies.
 *
 * Expo Go limitation: push works in Expo Go for Android *only* up to a
 * point — for reliable production push the user needs an EAS dev client or
 * a real EAS build. Phase 1 closed-pilot is fine on Expo Go; production
 * launch needs a build.
 */
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export function attachNotificationTapListener(
  handler: (deepLink: string | undefined, data: Record<string, unknown>) => void,
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
    const deepLink = typeof data.deepLink === 'string' ? data.deepLink : undefined;
    handler(deepLink, data);
  });
  return () => sub.remove();
}

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'TrustPe',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      (Constants.easConfig as { projectId?: string } | undefined)?.projectId;

    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token; // ExponentPushToken[XXXXX]
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[push] registration failed', err);
    return null;
  }
}
