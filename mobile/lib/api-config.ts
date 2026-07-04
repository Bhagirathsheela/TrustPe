/**
 * API base URL resolution.
 *
 * Three-tier fallback:
 * 1. `EXPO_PUBLIC_API_BASE_URL` env var — set in mobile/.env or via app.config.ts
 *    for production / staging builds.
 * 2. Auto-derived from Expo's dev-server `hostUri` (e.g., 192.168.1.x). This
 *    lets a real Android device on the same Wi-Fi reach the backend running
 *    on your laptop without you typing in an IP.
 * 3. Plain localhost — only works for the iOS simulator / Android emulator
 *    via the emulator's host-loopback alias.
 */
import Constants from 'expo-constants';

const DEFAULT_BACKEND_PORT = 4000;
const API_VERSION_PREFIX = '/v1';

function deriveLanHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Constants as any).expoGoConfig?.hostUri ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ??
    null;
  if (!hostUri || typeof hostUri !== 'string') return null;
  const host = hostUri.split(':')[0];
  return host && host.length > 0 ? host : null;
}

function resolveApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (explicit && explicit.length > 0) return explicit;

  const lanHost = deriveLanHost();
  if (lanHost) return `http://${lanHost}:${DEFAULT_BACKEND_PORT}${API_VERSION_PREFIX}`;

  return `http://localhost:${DEFAULT_BACKEND_PORT}${API_VERSION_PREFIX}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

// Log the resolved base URL once at module load so it's visible in Metro
// and the user can confirm the LAN IP the app is actually using.
// eslint-disable-next-line no-console
console.log('[api-config] API_BASE_URL =', API_BASE_URL);
