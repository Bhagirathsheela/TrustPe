/**
 * Email delivery service — provider-agnostic transport.
 *
 * Chooses the first provider whose env vars are configured:
 *   1. SMTP (nodemailer) — set SMTP_HOST + SMTP_USER + SMTP_PASS
 *   2. Resend             — set RESEND_API_KEY (needs domain verification)
 *   3. Stub               — nothing set; prints OTP to backend logs
 *
 * See docs/EMAIL_PROVIDER_OPTIONS.md for the trade-offs and setup steps
 * for each provider.
 *
 * Templates live in `email-templates.ts`. Each template returns
 * `{ subject, html, text }`; this service is just the transport.
 *
 * See ARCHITECTURE.md §6.2 adapter discipline — controllers never import
 * Nodemailer or Resend directly; they go through this service.
 */
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

type SendResult = { id: string; mode: 'sent' | 'stubbed'; provider: Provider };
type Provider = 'smtp' | 'resend' | 'stub';

function chooseProvider(): Provider {
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) return 'smtp';
  if (env.RESEND_API_KEY) return 'resend';
  return 'stub';
}

// Cached transports so we don't re-instantiate on every send.
let smtpTransporter: import('nodemailer').Transporter | null = null;
async function getSmtpTransporter(): Promise<import('nodemailer').Transporter | null> {
  if (smtpTransporter) return smtpTransporter;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;
  try {
    const nodemailer = await import('nodemailer');
    smtpTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
    return smtpTransporter;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      '[email] SMTP configured but nodemailer not installed — falling back',
    );
    return null;
  }
}

let resendClient: import('resend').Resend | null = null;
async function getResendClient(): Promise<import('resend').Resend | null> {
  if (resendClient) return resendClient;
  if (!env.RESEND_API_KEY) return null;
  try {
    const { Resend } = await import('resend');
    resendClient = new Resend(env.RESEND_API_KEY);
    return resendClient;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      '[email] RESEND_API_KEY set but resend not installed — falling back',
    );
    return null;
  }
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

async function sendViaSmtp(input: EmailInput): Promise<SendResult> {
  const transporter = await getSmtpTransporter();
  if (!transporter) throw new Error('SMTP transporter unavailable');

  const payload = {
    from: env.EMAIL_FROM,
    replyTo: env.EMAIL_REPLY_TO,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  };

  const info = await transporter.sendMail(payload);
  logger.info(
    { to: input.to, subject: input.subject, id: info.messageId },
    '[email:smtp] sent',
  );
  return { id: info.messageId, mode: 'sent', provider: 'smtp' };
}

async function sendViaResend(input: EmailInput): Promise<SendResult> {
  const client = await getResendClient();
  if (!client) throw new Error('Resend client unavailable');

  const payload = {
    from: env.EMAIL_FROM,
    replyTo: env.EMAIL_REPLY_TO,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  };

  const result = await client.emails.send(payload);
  if (result.error) throw new Error(String(result.error.message ?? 'resend error'));
  logger.info(
    { to: input.to, subject: input.subject, id: result.data?.id },
    '[email:resend] sent',
  );
  return { id: result.data?.id ?? 'unknown', mode: 'sent', provider: 'resend' };
}

async function withRetry<T>(fn: () => Promise<T>, context: EmailInput): Promise<T> {
  try {
    return await fn();
  } catch (firstErr) {
    if (!isTransient(firstErr)) {
      logger.warn(
        { err: firstErr, to: context.to, subject: context.subject },
        '[email] failed',
      );
      throw firstErr;
    }
    logger.warn(
      { err: firstErr, to: context.to },
      '[email] transient failure — retrying once',
    );
    await sleep(750);
    try {
      return await fn();
    } catch (retryErr) {
      logger.error(
        { err: retryErr, to: context.to, subject: context.subject },
        '[email] failed after retry',
      );
      tracker.captureException(retryErr, {
        route: 'email.send',
        extra: { to: context.to, subject: context.subject },
      });
      throw retryErr;
    }
  }
}

export const emailService = {
  async send(input: EmailInput): Promise<SendResult> {
    const provider = chooseProvider();

    if (provider === 'stub') {
      logger.info(
        { to: input.to, subject: input.subject },
        '[email:stub] Would send (configure SMTP_* or RESEND_API_KEY to enable)',
      );
      logger.debug({ html: input.html }, '[email:stub] body');
      return { id: `stub-${Date.now()}`, mode: 'stubbed', provider: 'stub' };
    }

    if (provider === 'smtp') {
      return await withRetry(() => sendViaSmtp(input), input);
    }

    return await withRetry(() => sendViaResend(input), input);
  },

  /** Pre-templated OTP email — used by auth flows. */
  async sendOtp(to: string, otp: string, purpose: 'signup' | 'login'): Promise<void> {
    // In stub mode, print the OTP prominently so the developer sees it.
    if (chooseProvider() === 'stub') {
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

  /**
   * Health probe — reports which provider is live. Used by `/health/ready`
   * so ops can see at a glance whether OTPs are going to real users.
   */
  status(): { live: boolean; provider: Provider; from: string; replyTo: string } {
    const provider = chooseProvider();
    return {
      live: provider !== 'stub',
      provider,
      from: env.EMAIL_FROM,
      replyTo: env.EMAIL_REPLY_TO,
    };
  },
};
