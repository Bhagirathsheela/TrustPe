/**
 * Low-level fetch wrapper.
 *
 * Auth-aware helpers live in auth-context.tsx — they layer auto-refresh on 401
 * on top of these primitives.
 */
import { API_BASE_URL } from './api-config';

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

type Json = Record<string, unknown> | unknown[] | null;

type RequestInit = {
  path: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: Json;
  accessToken?: string | null;
  headers?: Record<string, string>;
  /** Override default 30s timeout. Pass higher for long-running operations. */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * URL-safe random key for the Idempotency-Key header on money-touching
 * POSTs. Not security-sensitive — only needs uniqueness per action, so
 * Math.random + timestamp is fine (crypto.randomUUID isn't guaranteed on
 * Hermes).
 */
export function newIdempotencyKey(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand()}-${rand()}`;
}

export async function apiRequest<T = unknown>(init: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${init.path}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...init.headers,
  };
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (init.accessToken) {
    headers.Authorization = `Bearer ${init.accessToken}`;
  }

  // Abort if the request hangs — a stuck server should not freeze the UI.
  // 30s is generous for any non-upload call; if a caller needs longer it
  // should pass `timeoutMs` explicitly.
  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
  } catch (err) {
    const isTimeout =
      err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'));
    throw new ApiError(
      isTimeout ? 'timeout' : 'network_error',
      isTimeout
        ? `Request took longer than ${Math.round(timeoutMs / 1000)}s. Check your connection and try again.`
        : 'Cannot reach TrustPe servers. Check your connection and that the backend is running.',
      0,
      { cause: err instanceof Error ? err.message : String(err) },
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // Non-JSON response — treat as raw error
      throw new ApiError(
        'invalid_response',
        `Unexpected non-JSON response (${response.status})`,
        response.status,
      );
    }
  }

  if (!response.ok) {
    // Backend error envelope: { ok: false, error: { code, message, details } }
    const errEnvelope = (parsed as { error?: { code?: string; message?: string; details?: unknown } })
      ?.error;
    throw new ApiError(
      errEnvelope?.code ?? 'unknown_error',
      errEnvelope?.message ?? `Request failed (${response.status})`,
      response.status,
      errEnvelope?.details,
    );
  }

  // Backend success envelope: { ok: true, data: T, meta?: ... }
  const env = parsed as { ok?: boolean; data?: T };
  if (env && typeof env === 'object' && env.ok === true && 'data' in env) {
    return env.data as T;
  }
  // Some endpoints (like logout) return 204 / empty; some legacy may not envelope.
  return parsed as T;
}
