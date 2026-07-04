/**
 * Environment-variable loading and validation.
 *
 * All env reads go through this module. The rest of the code imports `env`
 * and gets typed, validated values.
 */
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGO_URI: z.string().min(1),
  // Redis is optional in Sprint 1 — services fall back to in-memory store when absent.
  REDIS_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Email provider selection — the first configured provider wins:
  //   1. SMTP (nodemailer) if SMTP_HOST + SMTP_USER + SMTP_PASS are all set
  //   2. Resend if RESEND_API_KEY is set
  //   3. Stub mode otherwise (prints OTP to backend logs)
  //
  // For a closed pilot without a verified domain, SMTP via a personal
  // Gmail app-password is the zero-cost path. See docs/EMAIL_PROVIDER_OPTIONS.md.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional().default(465),
  SMTP_SECURE: z.coerce.boolean().optional().default(true),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),

  // The From address on outbound mail.
  // - SMTP mode: recipient sees this as From. If you're using Gmail SMTP
  //   with an app password, Gmail will still show the underlying SMTP_USER
  //   as the actual sender, so either leave the From matching your Gmail
  //   ("Your Name <yourname@gmail.com>") or expect a small "via" line.
  // - Resend mode: must be at a domain verified in Resend (DNS TXT + DKIM).
  EMAIL_FROM: z.string().default('TrustPe <no-reply@trustpe.in>'),
  // Reply-To — where support replies should land. Independent of the
  // sending path, so set it to a mailbox you actually check.
  EMAIL_REPLY_TO: z.string().default('support@trustpe.in'),
  SENTRY_DSN: z.string().optional(),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3001,http://localhost:19006')
    .transform((v) => v.split(',').map((s) => s.trim())),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed. See errors above.');
}

export const env = parsed.data;
export type Env = typeof env;
