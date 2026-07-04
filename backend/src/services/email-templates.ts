/**
 * Email templates — shared HTML scaffold + per-purpose render functions.
 *
 * Convention: every transactional email gets the same branded shell
 * (logo + body + footer with privacy/terms/support links). Per-purpose
 * helpers compose the body and return both HTML and plain-text variants
 * (some mail clients prefer text).
 *
 * Keep copy warm and human. No marketing fluff. Closed-pilot phrasing
 * everywhere — we explicitly call out "TrustPe team" rather than "the
 * TrustPe Inc. Customer Success Team" or similar.
 */

const PRIMARY_HEX = '#2563EB';
const INK_HEX = '#0F172A';
const MUTED_HEX = '#64748B';
const BG_HEX = '#F8FAFC';
const BORDER_HEX = '#E2E8F0';

const SUPPORT_EMAIL = 'support@trustpe.in';
const PRIVACY_URL = 'https://trustpe.in/privacy';
const TERMS_URL = 'https://trustpe.in/terms';

export type RenderedEmail = { subject: string; html: string; text: string };

/**
 * Wrap arbitrary body HTML in the standard TrustPe shell.
 *
 * `previewText` is the snippet shown in the inbox preview line in Gmail /
 * Apple Mail — keep it short and human, distinct from the subject.
 */
function wrapBranded({
  bodyHtml,
  previewText,
}: {
  bodyHtml: string;
  previewText: string;
}): string {
  // The `display:none` block sits at the top of the document and is what
  // Gmail uses as preview text. The non-breaking spaces after it pad the
  // preview window out so trailing email-client junk doesn't bleed in.
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TrustPe</title>
  </head>
  <body style="margin:0; padding:0; background:${BG_HEX}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:${INK_HEX};">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      ${escapeHtml(previewText)}
      ${'&nbsp;&zwnj;'.repeat(40)}
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BG_HEX};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px; background:#ffffff; border-radius:12px; border:1px solid ${BORDER_HEX};">
            <tr>
              <td style="padding:24px 32px 8px;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <div style="width:32px; height:32px; border-radius:8px; background:${PRIMARY_HEX}; color:white; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:14px;">TP</div>
                  <span style="font-size:18px; font-weight:600; color:${INK_HEX};">TrustPe</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px; line-height:1.55; font-size:15px; color:${INK_HEX};">
                ${bodyHtml}
              </td>
            </tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
            <tr>
              <td style="padding:16px 32px; text-align:center; color:${MUTED_HEX}; font-size:12px; line-height:1.6;">
                TrustPe is a closed friends-and-family lending platform &middot; Phase 1 pilot.<br />
                <a href="${PRIVACY_URL}" style="color:${MUTED_HEX}; text-decoration:underline;">Privacy</a>
                &middot;
                <a href="${TERMS_URL}" style="color:${MUTED_HEX}; text-decoration:underline;">Terms</a>
                &middot;
                <a href="mailto:${SUPPORT_EMAIL}" style="color:${MUTED_HEX}; text-decoration:underline;">${SUPPORT_EMAIL}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// OTP code — signup or login
// ---------------------------------------------------------------------------

export function renderOtp(otp: string, purpose: 'signup' | 'login'): RenderedEmail {
  const subject =
    purpose === 'signup' ? 'Confirm your TrustPe signup' : 'Your TrustPe login code';
  const previewText =
    purpose === 'signup'
      ? `Your TrustPe signup code is ${otp}`
      : `Your TrustPe login code is ${otp}`;
  const purposeLine =
    purpose === 'signup'
      ? "Use this code to finish creating your TrustPe account."
      : 'Use this code to sign in to TrustPe.';

  const bodyHtml = `
    <p style="margin:0 0 16px; font-size:16px;">Hi,</p>
    <p style="margin:0 0 24px;">${purposeLine}</p>
    <div style="background:${BG_HEX}; border:1px solid ${BORDER_HEX}; border-radius:10px; padding:24px; text-align:center; margin-bottom:24px;">
      <div style="font-size:13px; color:${MUTED_HEX}; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Your code</div>
      <div style="font-size:36px; font-weight:700; letter-spacing:10px; color:${INK_HEX}; font-family:'SF Mono', Menlo, Consolas, monospace;">${escapeHtml(
        otp,
      )}</div>
    </div>
    <p style="margin:0 0 8px; color:${MUTED_HEX}; font-size:13px;">This code expires in 5 minutes.</p>
    <p style="margin:0; color:${MUTED_HEX}; font-size:13px;">If you didn't request this, you can safely ignore the email — nothing will happen on your account.</p>
  `;

  const text = `${purposeLine}\n\nYour code: ${otp}\nThis code expires in 5 minutes. If you didn't request it, ignore this email.`;

  return { subject, html: wrapBranded({ bodyHtml, previewText }), text };
}

// ---------------------------------------------------------------------------
// KYC approved
// ---------------------------------------------------------------------------

export function renderKycApproved(name: string): RenderedEmail {
  const subject = "You're verified on TrustPe";
  const previewText = "Your KYC has been approved — you're ready to lend or borrow.";

  const bodyHtml = `
    <p style="margin:0 0 16px; font-size:16px;">Hi ${escapeHtml(firstName(name))},</p>
    <p style="margin:0 0 16px;">
      Good news — your KYC has been approved by the TrustPe team. You can now request a
      loan, fund someone else's, and start building your TrustScore.
    </p>
    <p style="margin:0 0 24px;">
      As a thank-you, we've bumped your TrustScore from 300 to 550 (Fair band). From here
      it grows with every loan you successfully complete.
    </p>
    <div style="margin:24px 0;">
      <a href="https://trustpe.in/get-started" style="background:${PRIMARY_HEX}; color:#ffffff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">Open TrustPe</a>
    </div>
    <p style="margin:0; color:${MUTED_HEX}; font-size:13px;">
      Reminder: TrustPe doesn't move money. Disbursals and EMIs happen directly between
      lender and borrower over UPI. See the agreement before you sign.
    </p>
  `;

  const text = `Hi ${firstName(name)},\n\nYour KYC has been approved. You can now request loans, fund others, and start building TrustScore. We've bumped your TrustScore to 550 (Fair band).\n\nOpen the TrustPe app to get started.\n\nReminder: TrustPe doesn't move money. Disbursals and EMIs happen directly between lender and borrower over UPI.`;

  return { subject, html: wrapBranded({ bodyHtml, previewText }), text };
}

// ---------------------------------------------------------------------------
// KYC needs clarification
// ---------------------------------------------------------------------------

export function renderKycClarification(name: string, reason?: string): RenderedEmail {
  const subject = 'TrustPe KYC — we need a little more from you';
  const previewText = 'The reviewer needs you to re-submit a document.';

  const reasonBlock = reason
    ? `
    <div style="background:#EFF6FF; border:1px solid #BFDBFE; border-left:4px solid ${PRIMARY_HEX}; border-radius:8px; padding:16px; margin:24px 0;">
      <div style="font-size:13px; color:${PRIMARY_HEX}; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; font-weight:600;">Reviewer note</div>
      <div>${escapeHtml(reason)}</div>
    </div>`
    : '';

  const bodyHtml = `
    <p style="margin:0 0 16px; font-size:16px;">Hi ${escapeHtml(firstName(name))},</p>
    <p style="margin:0 0 16px;">
      The reviewer looked at your KYC submission and needs one more thing before we can
      approve you.
    </p>
    ${reasonBlock}
    <p style="margin:0 0 24px;">
      Open the TrustPe app and tap <strong>Re-submit KYC</strong> on the home screen.
      You'll capture only what's flagged — your other documents stay as-is.
    </p>
    <p style="margin:0; color:${MUTED_HEX}; font-size:13px;">
      Questions? Reply to this email and the team will get back to you within 24 hours.
    </p>
  `;

  const text = `Hi ${firstName(name)},\n\nThe reviewer needs one more thing before approving your KYC.\n${reason ? `\nReviewer note: ${reason}\n` : ''}\nOpen the TrustPe app and tap "Re-submit KYC" on the home screen. Questions? Reply to this email.`;

  return { subject, html: wrapBranded({ bodyHtml, previewText }), text };
}

// ---------------------------------------------------------------------------
// KYC rejected (account suspended)
// ---------------------------------------------------------------------------

export function renderKycRejected(name: string, reason?: string): RenderedEmail {
  const subject = 'TrustPe KYC — outcome of your review';
  const previewText = 'The team has reviewed your submission.';

  const reasonBlock = reason
    ? `
    <div style="background:#FEF2F2; border:1px solid #FECACA; border-left:4px solid #DC2626; border-radius:8px; padding:16px; margin:24px 0;">
      <div style="font-size:13px; color:#DC2626; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; font-weight:600;">Reason</div>
      <div>${escapeHtml(reason)}</div>
    </div>`
    : '';

  const bodyHtml = `
    <p style="margin:0 0 16px; font-size:16px;">Hi ${escapeHtml(firstName(name))},</p>
    <p style="margin:0 0 16px;">
      Thanks for submitting your KYC. The reviewer has gone through it and unfortunately
      we're not able to approve your account at this time.
    </p>
    ${reasonBlock}
    <p style="margin:0 0 24px;">
      If you believe this is a mistake — or if circumstances change — write to us at
      <a href="mailto:${SUPPORT_EMAIL}" style="color:${PRIMARY_HEX};">${SUPPORT_EMAIL}</a>
      and we'll take another look.
    </p>
    <p style="margin:0; color:${MUTED_HEX}; font-size:13px;">
      Your account is suspended in the app. Any data we hold is governed by our
      <a href="${PRIVACY_URL}" style="color:${MUTED_HEX}; text-decoration:underline;">Privacy Policy</a>.
    </p>
  `;

  const text = `Hi ${firstName(name)},\n\nThanks for submitting your KYC. Unfortunately we're not able to approve your account at this time.\n${reason ? `\nReason: ${reason}\n` : ''}\nIf you believe this is a mistake, write to ${SUPPORT_EMAIL} and we'll take another look.`;

  return { subject, html: wrapBranded({ bodyHtml, previewText }), text };
}

function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0] ?? 'there';
}
