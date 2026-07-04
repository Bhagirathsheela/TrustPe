'use client';

/**
 * Admin auth context.
 *
 * The refresh token lives in an httpOnly cookie set by the backend
 * (path=/v1/auth) — never in localStorage, so XSS can't exfiltrate it.
 * The short-lived access token stays in module memory (lib/api.ts).
 *
 * Exposes:
 *   - login(email) — triggers OTP email
 *   - verifyOtp({ email, otp })
 *   - logout()
 *   - isAdmin (derived from user.roles)
 *
 * Bootstrap calls /auth/refresh on mount (cookie carries the token) before
 * deciding whether to send the user to /login.
 *
 * MIGRATION: sessions created before the cookie switch stored the refresh
 * token under LEGACY_LS_REFRESH_KEY. We send it in the body once, then
 * delete it — the response sets the cookie and the localStorage copy is gone.
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
import { useRouter } from 'next/navigation';
import { apiRequest, ApiError, setAccessToken, setOnAuthFail, setRefreshFn } from './api';

const LEGACY_LS_REFRESH_KEY = 'trustpe.admin.refresh';

export type AdminUser = {
  id: string;
  email: string;
  phone: string;
  name: string;
  handle?: string;
  status: string;
  kycStatus: string;
  roles: string[];
  trustScore?: number;
  trustBand?: string;
};

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
};

type AuthState = {
  user: AdminUser | null;
  ready: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string) => Promise<{ otpSentTo: string }>;
  verifyOtp: (input: { email: string; otp: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
};

const AuthContext = createContext<AuthState | null>(null);

const ADMIN_ROLES = new Set(['super_admin', 'admin', 'compliance']);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  // De-dupe simultaneous refreshes: a burst of parallel 401s must share ONE
  // round-trip — a second refresh replaying the just-rotated token would trip
  // the backend's own theft detection and kill the whole session chain.
  const refreshInFlight = useRef<Promise<boolean> | null>(null);

  const clearLocal = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LEGACY_LS_REFRESH_KEY);
    }
  }, []);

  const persistTokens = useCallback((data: AuthTokens) => {
    setUser(data.user);
    setAccessToken(data.accessToken);
    // Refresh token: httpOnly cookie set by the backend. Drop any legacy
    // localStorage copy now that the cookie is in place.
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LEGACY_LS_REFRESH_KEY);
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    if (refreshInFlight.current) return refreshInFlight.current;
    refreshInFlight.current = (async () => {
      // Legacy migration: pre-cookie sessions stored the token here.
      const legacy = window.localStorage.getItem(LEGACY_LS_REFRESH_KEY);
      try {
        const data = await apiRequest<AuthTokens>({
          path: '/auth/refresh',
          method: 'POST',
          body: legacy ? { refreshToken: legacy } : {},
        });
        persistTokens(data);
        return true;
      } catch (err) {
        // Keep the cookie/session on network blips; only a definitive auth
        // rejection clears local state (the cookie dies server-side anyway).
        if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
          clearLocal();
        }
        return false;
      } finally {
        refreshInFlight.current = null;
      }
    })();
    return refreshInFlight.current;
  }, [persistTokens, clearLocal]);

  // Bootstrap on mount.
  useEffect(() => {
    (async () => {
      await refreshSession();
      setReady(true);
    })();
  }, [refreshSession]);

  // Hook auth-fail + refresh handlers into the API client.
  useEffect(() => {
    setOnAuthFail(() => {
      clearLocal();
      router.replace('/login');
    });
    setRefreshFn(refreshSession);
    return () => {
      setOnAuthFail(null);
      setRefreshFn(null);
    };
  }, [clearLocal, router, refreshSession]);

  const login = useCallback(
    async (email: string) =>
      apiRequest<{ otpSentTo: string }>({
        path: '/auth/login',
        method: 'POST',
        body: { email },
      }),
    [],
  );

  const verifyOtp = useCallback(
    async (input: { email: string; otp: string }) => {
      const data = await apiRequest<AuthTokens>({
        path: '/auth/verify-otp',
        method: 'POST',
        body: input,
      });
      persistTokens(data);
    },
    [persistTokens],
  );

  const logout = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const legacy = window.localStorage.getItem(LEGACY_LS_REFRESH_KEY);
    try {
      // Cookie identifies the token server-side; legacy body covers
      // pre-cookie sessions. Backend clears the cookie in its response.
      await apiRequest({
        path: '/auth/logout',
        method: 'POST',
        body: legacy ? { refreshToken: legacy } : {},
      });
    } catch {
      /* ignore — clearing local state is what logs the user out */
    }
    clearLocal();
  }, [clearLocal]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      isAuthenticated: user !== null,
      isAdmin: !!user && Array.isArray(user.roles) && user.roles.some((r) => ADMIN_ROLES.has(r)),
      login,
      verifyOtp,
      logout,
      refreshSession,
    }),
    [user, ready, login, verifyOtp, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>');
  return ctx;
}

/** Helper used by ApiError handler to know the API error class identity. */
export { ApiError };
