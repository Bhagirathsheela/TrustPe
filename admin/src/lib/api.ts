/**
 * Admin web API client — fetch wrapper with the same envelope semantics
 * as the mobile app. Auto-refresh on 401 is handled here via the access
 * token in module-level state (set/cleared by the auth context).
 */
import type { ApiError as ApiErrorShape } from '@shared/types';

const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/v1';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Module-level token storage. AuthProvider sets these on login/refresh.
let _accessToken: string | null = null;
let _onAuthFail: (() => void) | null = null;
let _refreshFn: (() => Promise<boolean>) | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function setOnAuthFail(fn: (() => void) | null): void {
  _onAuthFail = fn;
}

/** AuthProvider registers its refreshSession here so 401s can retry once. */
export function setRefreshFn(fn: (() => Promise<boolean>) | null): void {
  _refreshFn = fn;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export async function apiRequest<T>(opts: {
  path: string;
  method?: Method;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Internal: set on the post-refresh retry so we never loop. */
  _retried?: boolean;
}): Promise<T> {
  const url = new URL(`${RAW_API_BASE}${opts.path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (_accessToken) headers.Authorization = `Bearer ${_accessToken}`;

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: 'include',
    });
  } catch (err) {
    throw new ApiError(
      'network_error',
      'Cannot reach TrustPe servers',
      0,
      { cause: err instanceof Error ? err.message : String(err) },
    );
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ApiError('invalid_response', 'Server returned non-JSON', res.status);
    }
  }

  if (!res.ok) {
    if (res.status === 401 && !opts.path.startsWith('/auth/')) {
      // Expired access token (15 min TTL) — refresh once and retry instead
      // of force-logging the admin out mid-session.
      if (!opts._retried && _refreshFn) {
        const refreshed = await _refreshFn().catch(() => false);
        if (refreshed) return apiRequest<T>({ ...opts, _retried: true });
      }
      if (_onAuthFail) _onAuthFail();
    }
    const err = (parsed as ApiErrorShape | null)?.error;
    throw new ApiError(
      err?.code ?? 'unknown_error',
      err?.message ?? `Request failed (${res.status})`,
      res.status,
      err?.details,
    );
  }

  const env = parsed as { ok: boolean; data: T; meta?: unknown } | null;
  if (env && typeof env === 'object' && env.ok === true) return env.data;
  return parsed as T;
}
