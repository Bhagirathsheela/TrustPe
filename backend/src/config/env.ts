/**
 * Environment-variable loading and validation.
 *
 * All env reads go through this module. The rest of the code imports
 * `env` and gets typed, validated values.
 */
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGO_URI: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Email — Nodemailer SMTP. Configure all three of SMTP_HOST + SMTP_USER
  // + SMTP_PASS to enable real sends. See docs/PRODUCTION_EMAIL_SETUP.md
  // for Gmail app-password setup.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional().default(465),
  SMTP_SECURE: z.coerce.boolean().optional().default(true),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // Sender + reply. For Gmail SMTP, keep EMAIL_FROM matching SMTP_USER
  // so recipients don't see the "via" line.
  EMAIL_FROM: z.string().default('TrustPe <no-reply@trustpe.in>'),
  EMAIL_REPLY_TO: z.string().default('support@trustpe.in'),

  // Sentry — optional, currently stub-mode only.
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
