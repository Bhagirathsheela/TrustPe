/**
 * Terms & Conditions — in-app summary.
 *
 * Mirrors `docs/TERMS_AND_CONDITIONS.md`. Same draft-pending-review caveat.
 */
import type { LegalSection } from './privacy-policy';

export const TERMS: {
  effectiveDate: string;
  intro: string;
  sections: LegalSection[];
  footer: string;
} = {
  effectiveDate: 'Draft — pending legal review',
  intro:
    'TrustPe is a closed-membership platform that helps people who already know each other arrange personal loans. The platform records what you agreed to and tracks repayments. It does NOT move your money — UPI does. It does NOT promise returns. It does NOT guarantee that any loan will be repaid. Loans you arrange through TrustPe are contracts between you and the other member; TrustPe is not a party to them.',
  sections: [
    {
      heading: '1. What TrustPe is and is not',
      bullets: [
        'IS: a software platform that documents personal loans between members of a closed circle.',
        'IS NOT: a bank, NBFC, NBFC-P2P, or any RBI-regulated entity.',
        'IS NOT: an "investment" platform — never describe it that way.',
        'IS NOT: a custodian. Your money never touches us.',
        'IS NOT: a guarantor. If a borrower defaults, the lender bears the loss.',
        'IS NOT: an advice service. We do not tell you who to lend to.',
      ],
    },
    {
      heading: '2. Who can use it',
      bullets: [
        'You must be 18+ and an Indian citizen or resident.',
        'You must have a valid PAN and Aadhaar and a working UPI VPA in your name.',
        'You must have been invited to the closed pilot.',
        'One account per person — duplicate PANs are blocked.',
      ],
    },
    {
      heading: '3. Loans are between you and the other member',
      paragraphs: [
        'When you sign an agreement on TrustPe you enter a legally binding contract with the counter-party. TrustPe records the terms but is not a party to the contract. Only deal with people you actually know and trust.',
      ],
    },
    {
      heading: '4. Interest rate cap',
      paragraphs: [
        'The interest rate you can agree to is limited by the moneylending law of the borrower\'s state. The app shows the applicable cap. Agreements that exceed the cap are unenforceable to that extent (Indian Contract Act §23).',
      ],
    },
    {
      heading: '5. Phase 1 limits',
      bullets: [
        'Minimum loan: ₹5,000.',
        'Maximum loan: ₹50,000.',
        'Tenure: 1 to 6 months.',
      ],
    },
    {
      heading: '6. No promised returns',
      paragraphs: [
        'Lenders: you accept that the borrower may default and that if they do, you bear the loss. TrustPe will not compensate you. Anyone describing TrustPe as offering "guaranteed returns" or "liquidity" is violating these Terms — report to abuse@trustpe.in.',
      ],
    },
    {
      heading: '7. How the money moves',
      paragraphs: [
        'Disbursal and every EMI move from the payer\'s UPI app directly to the receiver\'s VPA. The app only records that the payer claims to have sent the money (with a UTR) and that the receiver has confirmed receipt. Marking a payment as sent without actually sending it is fraud against the receiver.',
      ],
    },
    {
      heading: '8. Disputes',
      paragraphs: [
        'If the receiver disputes a payment, the platform operator reviews both sides\' evidence and updates the app\'s internal state (verify / mark failed / mark loan defaulted). This is about the app\'s state — it does not replace your legal rights and remedies in civil court.',
      ],
    },
    {
      heading: '9. TrustScore and reviews',
      paragraphs: [
        'After a loan completes you can rate and review the counter-party. Reviews are public on TrustPe. Reviews must be truthful and based on real experience. TrustScore is an in-app reputation score on a 300–900 scale — it is not a credit score and is not reported to any bureau.',
      ],
    },
    {
      heading: '10. Things you must not do',
      bullets: [
        'No money laundering, no financing of unlawful activity, no tax evasion.',
        'No fake KYC, no impersonation, no scraping or automation.',
        'No falsely marking a payment as sent or as not received.',
        'No pooling other people\'s money or lending money that isn\'t yours.',
        'No describing TrustPe as an investment or as offering guaranteed returns.',
      ],
    },
    {
      heading: '11. Fees',
      paragraphs: [
        'Phase 1 is free. If we add fees in a future phase we will give you at least 30 days\' notice; you can close your account before they apply at no charge.',
      ],
    },
    {
      heading: '12. Liability',
      paragraphs: [
        'The platform is provided "as is". Subject to mandatory law, the operator\'s total liability to you is capped at the greater of ₹500 or the fees you have paid us in the prior 12 months (Phase 1: ₹0). We are not liable for losses caused by a counter-party\'s default, your UPI app, your bank, or force majeure.',
      ],
    },
    {
      heading: '13. Suspension and closure',
      paragraphs: [
        'We may suspend or close your account for breach of these Terms, for security reasons, or where required by law. You may close your own account once that feature ships; open loans must be settled first.',
      ],
    },
    {
      heading: '14. Changes',
      paragraphs: [
        'We may update these Terms with at least 14 days\' notice for material changes. Continued use after the effective date means you accept the change.',
      ],
    },
    {
      heading: '15. Law and venue',
      paragraphs: [
        'These Terms are governed by Indian law. Disputes are subject to the exclusive jurisdiction of the courts at the operator\'s registered office.',
      ],
    },
  ],
  footer:
    'Support: support@trustpe.in · Abuse / Terms violations: abuse@trustpe.in · Security: security@trustpe.in · Grievance: grievance@trustpe.in. The full canonical Terms (longer, with the legal-review checklist) are at trustpe.in/terms — request by email until that is published.',
};
