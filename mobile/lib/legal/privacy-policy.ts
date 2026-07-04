/**
 * Privacy Policy — in-app summary.
 *
 * Mirrors `docs/PRIVACY_POLICY.md` in plain-language form for the mobile
 * screen. The canonical text lives in `docs/` and is what counsel reviews;
 * this file is what users see. When the canonical changes, update both.
 *
 * Status: DRAFT — pending legal review. See section 17 of the canonical
 * doc for open review items.
 */
export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export const PRIVACY_POLICY: {
  effectiveDate: string;
  intro: string;
  sections: LegalSection[];
  footer: string;
} = {
  effectiveDate: 'Draft — pending legal review',
  intro:
    'TrustPe is a closed-membership platform for arranging personal loans between people who already know each other. We do not move money, hold money, pool money, or guarantee repayment — UPI does that, directly between you and the other person. This policy explains what data we collect, what we do with it, and the rights you have.',
  sections: [
    {
      heading: '1. Data we collect',
      paragraphs: [
        'You give us your name, phone, email, profile information, KYC documents (Aadhaar + PAN images, selfie video, UPI VPA), and your loan activity (requests, offers, payments, reviews, chat).',
        'We collect device and session metadata automatically (model, OS, app version, IP, push token).',
      ],
    },
    {
      heading: '2. Data we deliberately do NOT collect',
      bullets: [
        'Your full Aadhaar number — only the card image, in line with Aadhaar Act §29.',
        'Your bank account number, IFSC, or any card number.',
        'Your UPI PIN — we will never ask, you should never share it.',
        'Continuous location, SMS contents, your contact list, or your call logs.',
      ],
    },
    {
      heading: '3. What we use your data for',
      bullets: [
        'Operating the platform (KYC, matching you with counter-parties in your circle, notifications, history).',
        'Compliance and fraud prevention (duplicate-PAN checks, audit log).',
        'Customer support.',
        'Improving the product in aggregate (counts and averages, never identified).',
      ],
    },
    {
      heading: '4. What we DO NOT do',
      bullets: [
        'Sell your data — ever.',
        'Share your data with advertisers.',
        'Train AI models on your data without separate consent.',
        'Pool your loan funds or take any custody of your money.',
        'Report you to credit bureaus (we have no bureau access in Phase 1).',
      ],
    },
    {
      heading: '5. Who can see what',
      paragraphs: [
        'Other members see your name, photo (if uploaded), city, occupation category, TrustScore + band, completed-loan counts, and reviews you have received with reviewer names visible.',
        'Your loan counter-parties additionally see your VPA and your private chat about that loan.',
        'Nobody else sees your KYC documents. Only the platform operator (during Phase 1, the founder) reviews them, and every access is audit-logged.',
      ],
    },
    {
      heading: '6. Sub-processors',
      paragraphs: [
        'We use MongoDB Atlas (India region) for the database, Cloudinary for KYC images and videos (encrypted at rest), Render for backend hosting, Vercel for the admin panel, Resend for email, and Expo for push notifications. Each processes data on our behalf under their own privacy terms.',
      ],
    },
    {
      heading: '7. Retention',
      bullets: [
        'Audit log entries: 5 years (PMLA-informed retention), then auto-deleted.',
        'Active account data: kept while the account is active.',
        'On account deletion: identifying data purged within 90 days, KYC images within 30 days, except where required by audit-log retention.',
      ],
    },
    {
      heading: '8. Security',
      bullets: [
        'TLS 1.2+ in transit, encryption at rest.',
        'KYC images served only via short-lived signed URLs to authorised viewers.',
        '15-minute access tokens, rotating refresh tokens with theft detection.',
        'Every admin access of KYC is audit-logged.',
      ],
      paragraphs: [
        'If you find a vulnerability, write to security@trustpe.in.',
      ],
    },
    {
      heading: '9. Your rights under the DPDP Act',
      bullets: [
        'Access — see what we have. Email privacy@trustpe.in.',
        'Correction — fix anything inaccurate.',
        'Erasure — delete what we no longer need (subject to audit-log retention).',
        'Grievance — write to dpo@trustpe.in. Escalate to the Data Protection Board of India if unsatisfied.',
        'Nominate — designate someone to exercise rights for you if incapacitated.',
      ],
    },
    {
      heading: '10. Children',
      paragraphs: [
        'TrustPe is for people 18 and over. If we find an account belonging to a minor we close it.',
      ],
    },
    {
      heading: '11. Changes',
      paragraphs: [
        'If we change this policy materially we notify you in-app and by email at least 14 days before it takes effect.',
      ],
    },
  ],
  footer:
    'Privacy questions: privacy@trustpe.in · Data Protection Officer: dpo@trustpe.in · Security: security@trustpe.in. The full canonical policy (longer, with sub-processor links and the legal-review checklist) is available at trustpe.in/privacy. Until that is published, request it by email.',
};
