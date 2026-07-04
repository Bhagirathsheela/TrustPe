/**
 * Shared TypeScript types not directly derived from zod schemas.
 */

/**
 * Paise — integer money type. Always store and transmit money as integer paise.
 * Variable names that hold paise values must end with `Paise` per convention.
 */
export type Paise = number;

/**
 * ISO 8601 datetime string on the wire. Converted to/from Date by zod at boundaries.
 */
export type IsoDateString = string;

/**
 * Mongo ObjectId string at the API boundary. Never expose raw ObjectIds in API responses.
 */
export type Id = string;

/**
 * Standard envelopes for API responses.
 */
export type ApiSuccess<T> = {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  traceId?: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
