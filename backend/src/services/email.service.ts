/**
 * Email delivery service — SMTP via Nodemailer.
 *
 * Why SMTP: Phase 1 is zero-cost, zero-domain. Gmail SMTP with an app
 * password lets us send real transactional email from a personal Gmail
 * account — no DNS records, no monthly bill, ~500 sends/day cap which
 * is orders of magnitude above pilot need.
 *
 * Modes:
 *   - Stub (default in dev/test): `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`
 *     not all set → logs OTP to the terminal.
 *   - Live: all three set → sends via nodemailer, retries once on
 *     transient failures.
 *
 * Templates live in `email-templates.ts`. When we need Resend (verified
 * domain, higher deliverability, dedicated IP) that's a documented
 * swap — see docs/PRODUCTION_EMAIL_SETUP.md.
 *
 * See ARCHITECTURE.md §6.2 adapter discipline — controllers never
 * import Nodemailer directly; they go through this service.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { tracker } from '../utils/tracker.js';
import {
  renderKycApproved,
  renderKycClarification,
  renderKycRejected,
  renderOtp,
} from './email-templates.js';

type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type SendResult = { id: string; mode: 'sent' | 'stubbed' };

function isConfigured(): boolean {
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

let cachedTransporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!isConfigured()) return null;
  if (cachedTransporter) return cachedTransporter;

  // Dev escape hatch — if the local network intercepts TLS (antivirus,
  // corporate proxy), Node rejects the swapped cert with
  // "self-signed certificate in certificate chain". Setting
  // SMTP_TLS_INSECURE=true skips verification. Refuses to take effect
  // when NODE_ENV=production so it can't leak.
  const insecure = env.SMTP_TLS_INSECURE && env.NODE_ENV !== 'production';
  if (env.SMTP_TLS_INSECURE && env.NODE_ENV === 'production') {
    logger.warn('[email] SMTP_TLS_INSECURE ignored in production');
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST!,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER!,
      pass: env.SMTP_PASS!,
    },
    ...(insecure ? { tls: { rejectUnauthorized: false } } : {}),
  });
  return cachedTransporter;
}

function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/^5\d\d/.test(msg)) return true;
  if (/timeout|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|ECONNREFUSED/i.test(msg)) return true;
  return false;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export const emailService = {
  async send(input: EmailInput): Promise<SendResult> {
    const transporter = getTransporter();
    if (!transporter) {
      logger.info(
        { to: input.to, subject: input.subject },
        '[email:stub] Would send (configure SMTP_* to enable)',
      );
      logger.debug({ html: input.html }, '[email:stub] body');
      return { id: `stub-${Date.now()}`, mode: 'stubbed' };
    }

    const payload = {
      from: env.EMAIL_FROM,
      replyTo: env.EMAIL_REPLY_TO,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    };

    try {
      const info = await transporter.sendMail(payload);
      logger.info(
        { to: input.to, subject: input.subject, id: info.messageId },
        '[email] sent',
      );
      return { id: info.messageId, mode: 'sent' };
    } catch (firstErr) {
      if (!isTransient(firstErr)) {
        logger.warn({ err: firstErr, to: input.to }, '[email] failed');
        throw firstErr;
      }
      logger.warn({ err: firstErr, to: input.to }, '[email] transient — retrying once');
      await sleep(750);
      try {
        const info = await transporter.sendMail(payload);
        logger.info(
          { to: input.to, subject: input.subject, id: info.messageId, retried: true },
          '[email] sent on retry',
        );
        return { id: info.messageId, mode: 'sent' };
      } catch (retryErr) {
        logger.error({ err: retryErr, to: input.to }, '[email] failed after retry');
        tracker.captureException(retryErr, {
          route: 'email.send',
          extra: { to: input.to, subject: input.subject },
        });
        throw retryErr;
      }
    }
  },

  /** Pre-templated OTP email — used by auth flows. */
  async sendOtp(to: string, otp: string, purpose: 'signup' | 'login'): Promise<void> {
    // In stub mode, print the OTP prominently so the developer sees it.
    if (!isConfigured()) {
      logger.info(
        { to, otp, purpose },
        `\n=====================================\n  OTP for ${to}: ${otp}\n  (purpose: ${purpose}, expires in 5 min)\n=====================================`,
      );
    }
    const { subject, html, text } = renderOtp(otp, purpose);
    await this.send({ to, subject, html, text });
  },

  /**
   * KYC decision email. Best-effort: failures are logged but don't bubble up
   * so a flaky provider can't abort the admin's decision-apply transaction.
   * Call after the transaction has committed.
   */
  async sendKycDecision(
    to: string,
    name: string,
    decision: 'approve' | 'reject' | 'request_clarification',
    reason?: string,
  ): Promise<void> {
    try {
      const rendered =
        decision === 'approve'
          ? renderKycApproved(name)
          : decision === 'request_clarification'
            ? renderKycClarification(name, reason)
            : renderKycRejected(name, reason);
      await this.send({ to, subject: rendered.subject, html: rendered.html, text: rendered.text });
    } catch (err) {
      logger.warn({ err, to, decision }, '[email] KYC decision email failed');
    }
  },

  /** Health probe — used by /health/ready. */
  status(): { live: boolean; from: string; replyTo: string } {
    return {
      live: isConfigured(),
      from: env.EMAIL_FROM,
      replyTo: env.EMAIL_REPLY_TO,
    };
  },
};
