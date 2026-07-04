/**
 * Auth Context — global auth state + wire to backend.
 *
 * Exposes:
 *   - user, accessToken, isAuthenticated, ready
 *   - signup({ phone, email, name })
 *   - verifyOtp({ email, otp }) — sets session
 *   - login({ email })
 *   - logout()
 *   - apiCall(opts) — auth-aware fetch with auto-refresh on 401
 *
 * On launch, `bootstrap` reads the persisted refresh token and calls
 * /auth/refresh to obtain a fresh access token + user.
 *
 * Closure-safety: the in-memory access token lives in a `useRef` in addition
 * to React state. State drives renders; the ref is what `apiCall` and
 * `refreshMe` read from. This is critical because `setAccessToken` is async,
 * so after a 401 → refresh → retry, the captured `accessToken` in the React
 * closure is still the expired one. Reading from the ref means the retry
 * always uses the freshest token.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SignupInput, VerifyOtpInput, LoginInput } from 'trustpe-shared';
import { secureStore } from './secure-store';
import { apiRequest, ApiError, newIdempotencyKey } from './api';
import { connectRealtime, disconnectRealtime } from './socket';
import { registerForPushNotifications } from './push-notifications';
import { tracker } from './tracker';
import { Platform } from 'react-native';

export type AuthUser = {
  id: string;
  phone: string;
  email: string;
  name: string;
  handle?: string;
  status: string;
  kycStatus: string;
  roles?: string[];
  trustScore?: number;
  trustBand?: string;
};

type AuthApiPayload = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  user: AuthUser;
};

type ApiCallOpts = {
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown> | unknown[] | null;
  headers?: Record<string, string>;
  /** Override default 30s timeout for long-running calls. */
  timeoutMs?: number;
  /**
   * Money-touching POSTs set this so the backend can de-duplicate retries.
   * One key is generated per apiCall invocation; the internal post-refresh
   * retry reuses it, so a 401 → refresh → retry can never double-execute.
   */
  idempotency?: boolean;
};

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  ready: boolean;
  isAuthenticated: boolean;
  signup: (input: SignupInput) => Promise<{ otpSentTo: string }>;
  verifyOtp: (input: VerifyOtpInput) => Promise<void>;
  login: (input: LoginInput) => Promise<{ otpSentTo: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  /** Re-fetch /me and update the cached user (called after profile / KYC updates). */
  refreshMe: () => Promise<AuthUser | null>;
  apiCall: <T = unknown>(opts: ApiCallOpts) => Promise<T>;
  /** Read the current access token synchronously — for callers (like
   *  binary file downloads) that need to build their own fetch. */
  getAccessToken: () => string | null;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // accessTokenRef mirrors the React state but is written synchronously so
  // post-refresh retries always read the new token. See module-level note.
  const accessTokenRef = useRef<string | null>(null);

  // De-dupe simultaneous refresh attempts so a burst of 401s shares one round-trip.
  const refreshInFlight = useRef<Promise<boolean> | null>(null);

  const persistSession = useCallback(async (data: AuthApiPayload) => {
    setUser(data.user);
    setAccessToken(data.accessToken);
    accessTokenRef.current = data.accessToken; // sync ref ahead of next render
    await secureStore.setRefreshToken(data.refreshToken);
    // Attach the authenticated user to crash reports (Sentry-shaped).
    tracker.setUser({ id: data.user.id, email: data.user.email });
    tracker.addBreadcrumb({ category: 'auth', message: 'session restored' });
    // (Re)connect the realtime socket whenever we get a fresh access token.
    connectRealtime(data.accessToken);
    // Register for push notifications (idempotent — backend upserts on token).
    // Don't await — we don't want push setup latency blocking the login flow.
    void (async () => {
      const token = await registerForPushNotifications();
      if (!token) return;
      try {
        await apiRequest({
          path: '/me/push-tokens',
          method: 'POST',
          body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
          accessToken: data.accessToken,
        });
      } catch {
        /* non-critical */
      }
    })();
  }, []);

  const clearLocalSession = useCallback(async () => {
    setUser(null);
    setAccessToken(null);
    accessTokenRef.current = null;
    await secureStore.clearRefreshToken();
    tracker.clearUser();
    tracker.addBreadcrumb({ category: 'auth', message: 'session cleared' });
    disconnectRealtime();
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    refreshInFlight.current = (async () => {
      const stored = await secureStore.getRefreshToken();
      if (!stored) return false;
      try {
        const data = await apiRequest<AuthApiPayload>({
          path: '/auth/refresh',
          method: 'POST',
          body: { refreshToken: stored },
        });
        await persistSession(data);
        return true;
      } catch (err) {
        // Only a DEFINITIVE auth rejection destroys the stored refresh token.
        // Network failures / 5xx (e.g. app launched in airplane mode) keep
        // the session so the next online launch can retry.
        const isAuthRejection =
          err instanceof ApiError && (err.status === 401 || err.status === 404);
        // eslint-disable-next-line no-console
        console.warn('[auth] refresh failed', err);
        if (isAuthRejection) await clearLocalSession();
        return false;
      } finally {
        refreshInFlight.current = null;
      }
    })();
    return refreshInFlight.current;
  }, [persistSession, clearLocalSession]);

  // Bootstrap once on launch.
  useEffect(() => {
    (async () => {
      await refreshSession();
      setReady(true);
    })();
  }, [refreshSession]);

  const signup = useCallback(async (input: SignupInput) => {
    return apiRequest<{ otpSentTo: string }>({
      path: '/auth/signup',
      method: 'POST',
      body: { ...input },
    });
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    return apiRequest<{ otpSentTo: string }>({
      path: '/auth/login',
      method: 'POST',
      body: { ...input },
    });
  }, []);

  const verifyOtp = useCallback(
    async (input: VerifyOtpInput) => {
      const data = await apiRequest<AuthApiPayload>({
        path: '/auth/verify-otp',
        method: 'POST',
        body: { ...input },
      });
      await persistSession(data);
    },
    [persistSession],
  );

  const logout = useCallback(async () => {
    const stored = await secureStore.getRefreshToken();
    if (stored) {
      try {
        await apiRequest({
          path: '/auth/logout',
          method: 'POST',
          body: { refreshToken: stored },
        });
      } catch {
        // ignore — clearing local state is what actually logs the user out
      }
    }
    await clearLocalSession();
  }, [clearLocalSession]);

  const apiCall = useCallback(
    async <T,>(opts: ApiCallOpts): Promise<T> => {
      // Always read from the ref — `accessToken` state would be the stale,
      // closure-captured value on a post-refresh retry.
      const headers = opts.idempotency
        ? { 'Idempotency-Key': newIdempotencyKey(), ...opts.headers }
        : opts.headers;
      const doRequest = () =>
        apiRequest<T>({
          path: opts.path,
          method: opts.method ?? 'GET',
          body: opts.body,
          headers,
          accessToken: accessTokenRef.current,
          timeoutMs: opts.timeoutMs,
        });

      try {
        return await doRequest();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401 && err.code !== 'refresh_chain_killed') {
          const refreshed = await refreshSession();
          if (refreshed) {
            // accessTokenRef is now the new token thanks to persistSession.
            return await doRequest();
          }
        }
        throw err;
      }
    },
    [refreshSession],
  );

  const refreshMe = useCallback(async (): Promise<AuthUser | null> => {
    // Reuse apiCall so refreshMe inherits the 401-retry behaviour and the
    // closure-safe token read.
    try {
      const data = await apiCall<AuthUser>({ path: '/me', method: 'GET' });
      setUser(data);
      return data;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[auth] refreshMe failed', err);
      return null;
    }
  }, [apiCall]);

  const getAccessToken = useCallback(() => accessTokenRef.current, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      accessToken,
      ready,
      isAuthenticated: user !== null && accessToken !== null,
      signup,
      verifyOtp,
      login,
      logout,
      refreshSession,
      refreshMe,
      apiCall,
      getAccessToken,
    }),
    [
      user,
      accessToken,
      ready,
      signup,
      verifyOtp,
      login,
      logout,
      refreshSession,
      refreshMe,
      apiCall,
      getAccessToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
