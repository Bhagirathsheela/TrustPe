# Privacy Policy

**Effective date:** [TO BE FILLED ON LAUNCH]
**Last updated:** [TO BE FILLED ON LAUNCH]
**Status:** DRAFT — pending legal review. Do not publish or rely on this
text until a qualified Indian advocate (data-protection + RBI counsel) has
reviewed it. See section 17 below for the open review items.

---

## 1. Who we are

TrustPe ("we", "us", "our") is a closed-membership platform that helps
small groups of people who already know each other arrange personal loans
between themselves. It is operated as a Phase 1 pilot by an individual
operator based in India, not by a registered NBFC, NBFC-P2P, banking
company, or licensed payment system operator.

The platform records the parties' agreed-upon loan terms, lets them sign a
click-wrap agreement, and tracks repayment status. Money moves directly
between the lender and borrower over UPI. TrustPe does not hold member
funds, pool money across loans, promise returns, or guarantee repayment.

This Privacy Policy describes what personal data we collect when you use
the TrustPe mobile app or admin web panel, how we use it, who we share it
with, and your rights under Indian law (the Digital Personal Data
Protection Act, 2023, "DPDP Act" and other applicable statutes).

For questions about this policy, write to **privacy@trustpe.in** (or the
contact address shown in the app's Settings → About).

---

## 2. Scope

This policy applies to:

- The TrustPe Android application
- The TrustPe administrator web panel
- All backend services that store or process your data

This policy does NOT apply to:

- Your UPI app (PhonePe, Google Pay, Paytm, BHIM, etc.) — those apps are
  governed by their own privacy policies
- Your bank — governed by the bank's own privacy policy and RBI rules
- Cloudinary, MongoDB Atlas, Render, Resend, and other infrastructure
  providers we use as processors — each has its own privacy policy, links
  in section 8

---

## 3. Data we collect

### 3.1 Data you give us directly

- **Account identifiers:** full name, mobile phone number, email address,
  chosen handle (optional)
- **Profile information:** city, state, occupation category, declared
  monthly income band, short bio (optional), profile photo (optional)
- **KYC documents:** images of your Aadhaar card (front and back), images
  of your PAN card, a short selfie video, your PAN number, the last 4
  digits of your Aadhaar number, your UPI VPA (Virtual Payment Address)
- **Loan activity:** loan requests you publish, offers you fund, agreement
  signatures, EMI payments you mark as sent or received, chat messages
  between you and the counter-party
- **Reviews and ratings:** the star ratings, written comments, and tags
  you submit about completed loans

### 3.2 Data we collect automatically

- **Device and session data:** device model, OS version, app version, IP
  address used for each request, approximate device fingerprint
  (non-personal hash), session timestamps
- **Push notification token:** your Expo push token, used to send
  notifications to your device. We do not have access to your device's
  hardware identifier.
- **Behavioural signals (Phase 1 minimal):** timestamps of significant
  actions (signup, KYC submit, loan request, agreement sign, payment
  marked sent, payment confirmed). Used for the audit log and for
  computing your TrustScore.

### 3.3 Data we deliberately do NOT collect

- **Full Aadhaar number** — only the image of your Aadhaar card is
  uploaded. We do not OCR or extract the 12-digit Aadhaar number from the
  image and we do not ask you to type it in. We only store the last 4
  digits, separately captured from you. This is to honour Aadhaar Act §29
  ("no Aadhaar number shall be stored in any database except as permitted
  by regulation").
- **Bank account number, IFSC code, or any card number** — we never ask
  for these. UPI moves the money; we don't.
- **Your UPI PIN or any password to your UPI app** — never. We will never
  ask for these and you should never enter them anywhere outside your
  bank's official UPI app.
- **Continuous location** — we do not access your GPS in the background.
  We ask for your city as text input during profile setup; that is all.
- **SMS reading, contact-list scraping, call logs** — Phase 1 does not use
  these permissions at all. Even when we add referral features in a
  future phase, we will ask before reading anything.
- **Browser history, photo library beyond what you pick during KYC, or
  any other on-device data** — never.

---

## 4. How we use your data

We use the data above only for the following purposes:

- **Operate the platform:** verify your identity, show you to potential
  lenders/borrowers in your invited circle, route notifications, render
  your activity history.
- **Compliance and fraud prevention:** detect duplicate PANs across
  accounts, flag inconsistent KYC documents, maintain the audit log
  required by PMLA-equivalent best practice (5-year retention — see
  section 10).
- **Customer support:** respond when you write to us with a question or
  problem.
- **Improve the product:** in aggregate (counts and averages, never
  identified to a person) understand which screens are confusing or which
  flows fail.

We do NOT:

- Sell your data to anyone, ever
- Share your data with advertisers
- Use your data to train AI models without your explicit, separate
  consent for that specific purpose
- Pool your loan funds, lend on your behalf, or take any custody of your
  money

---

## 5. Legal basis (DPDP Act §6 and §7)

Under the DPDP Act, we process your data on the following lawful bases:

- **Your consent** for KYC document capture, profile information, and
  reviews. You give this consent during the signup, KYC, and review flows
  via tickboxes that link to this policy. You can withdraw consent at any
  time by contacting us (see section 9), subject to our duty to retain
  audit-log entries for the periods set out in section 10.
- **Legitimate use under §7** (read narrowly, given the closed pilot
  context) for: operating the loan-tracking service you signed up for,
  fraud prevention, security, complying with legal obligations, and
  responding to legal requests.

---

## 6. Who can see your data

### 6.1 Other members

- **Your public profile page** shows other authenticated TrustPe members:
  your name, profile photo if you uploaded one, city, occupation
  category, your TrustScore and band, the number of loans you have
  completed on each side, and reviews you have received with reviewer
  names visible.
- **Counter-parties on a loan** see additionally: your VPA (so they can
  pay you or so you can pay them) and the chat thread you exchange about
  that loan.
- **Your Aadhaar, PAN, and KYC video are NEVER visible to other
  members.** Only the platform operator and (in future phases) approved
  compliance reviewers can see those.

### 6.2 The platform operator and compliance reviewers

A small number of administrators (during Phase 1 = the founder only) have
access to KYC submissions to approve / reject / request clarification.
Every access of a KYC record is logged in the audit log.

### 6.3 Infrastructure providers (processors, not controllers)

We use:

- **MongoDB Atlas** (database) — hosted in the AWS Mumbai region
- **Cloudinary** (image and video storage for KYC documents) — encrypted at
  rest, signed URLs only
- **Render** (backend hosting)
- **Vercel** (admin web panel hosting)
- **Resend** (transactional email sending — OTP, KYC decision emails)
- **Expo Push Notification Service** (push delivery to your device)

These providers process data on our behalf under their respective data
processing terms. Links to their privacy policies are in section 8.

### 6.4 Law enforcement and courts

If we receive a legally binding request (court order, properly served
notice from an authorized investigating agency under Indian law), we will
disclose the minimum data legally required. Whenever the law allows, we
will notify you first. For Aadhaar-related requests we follow UIDAI's
disclosure norms.

### 6.5 Nobody else

We do not share your data with credit bureaus (TrustPe is not an NBFC and
does not have access to CIBIL/CRIF/Equifax bureau APIs), with advertisers,
or with data brokers.

---

## 7. International data transfer

All data is stored in India (AWS Mumbai region for Atlas + Cloudinary
South-Asia POPs where available). The Expo Push Notification Service is
operated from the United States; only push notification tokens transit
this service, no loan or KYC content.

---

## 8. Sub-processors and their policies

- MongoDB Atlas — https://www.mongodb.com/legal/privacy-policy
- Cloudinary — https://cloudinary.com/privacy
- Render — https://render.com/privacy
- Vercel — https://vercel.com/legal/privacy-policy
- Resend — https://resend.com/legal/privacy-policy
- Expo — https://expo.dev/privacy

(Verify these URLs are still correct at launch; update with the actual
URLs in force on the effective date.)

---

## 9. Your rights

Under DPDP Act §11–14, you have the right to:

- **Access** the personal data we hold about you. Email
  privacy@trustpe.in with the subject line "Access request" and your
  registered email address. We respond within 30 days.
- **Correction** of inaccurate or out-of-date personal data. Profile
  fields you can edit yourself in the app; for KYC details, write to
  privacy@trustpe.in.
- **Erasure** of personal data we no longer need. We will erase what we
  can; audit-log entries we are required to retain (section 10) we will
  not erase. We will tell you what was kept and why.
- **Grievance redressal** — write to our Data Protection Officer at
  dpo@trustpe.in. If we don't respond within 30 days or you are
  unsatisfied with our response, you can escalate to the Data Protection
  Board of India.
- **Nominate** another person to exercise these rights if you are
  incapacitated or deceased — contact us in writing.

You can also delete your account from Settings → Account → Delete account
(once that feature ships — see section 17).

---

## 10. Retention

- **Audit log entries** (every state change touching money or identity):
  retained for **5 years** from the date of the entry, then automatically
  deleted by a MongoDB TTL index. This retention is informed by PMLA's
  5-year recordkeeping norm even though TrustPe is not itself a Reporting
  Entity under PMLA in Phase 1.
- **Active account data** (profile, KYC, loan history): retained while
  your account is active.
- **Closed account data** (you delete your account or we suspend it):
  identifying data is purged within **90 days** except for:
  - Audit log entries (section 10.1 — kept 5 years)
  - Loan records you were a party to that have not reached final state
    (counterparty's view of the loan stays intact)
- **KYC document images** in Cloudinary: deleted within **30 days** of
  account deletion if no live loan is using them as evidence.
- **Push notification tokens:** invalidated immediately on account
  deletion or on Expo returning DeviceNotRegistered.

---

## 11. Security

- All traffic between your device and our backend is encrypted in transit
  with TLS 1.2+.
- KYC images and videos are stored encrypted at rest in Cloudinary and
  served only via short-lived signed URLs to authorised viewers.
- Backend secrets (JWT signing keys, Cloudinary API secret, database
  password) are stored in the hosting platform's secret store, never in
  source code or version control.
- Access tokens are 15-minute JWTs; refresh tokens are 30-day opaque
  tokens with rotation and theft detection.
- Every access to a KYC record by an administrator is logged in the audit
  log.

No security regime is perfect. If you discover a vulnerability, please
write to **security@trustpe.in**.

---

## 12. Children

TrustPe is not for anyone under 18. Indian law also requires KYC and
prohibits financial contracts with minors. If we discover an account that
belongs to a person under 18 we will close it and erase data subject to
section 10.

---

## 13. Changes to this policy

If we change this policy materially we will notify you by:

- An in-app banner the next time you open the app
- An email to the registered address on file
- Posting the change with at least 14 days' notice before it takes
  effect, where the change requires fresh consent

You can review the current policy at any time from Settings → About →
Privacy policy.

---

## 14. Cookies and similar technologies

The mobile app does not use cookies. The admin web panel uses one
necessary session cookie to keep admin reviewers signed in. No tracking
cookies, no third-party analytics cookies.

---

## 15. Contact

- **Privacy questions:** privacy@trustpe.in
- **Grievance Officer (DPDP Act §13):** [Name TBD, India-resident
  individual to be appointed before launch]
- **Email:** dpo@trustpe.in
- **Postal address:** [Operator's registered office address — TBD]

We will publish the Grievance Officer's name and contact details on the
launch date in this section and inside the app.

---

## 16. Jurisdiction

This policy is governed by the laws of India. Disputes are subject to the
exclusive jurisdiction of the courts at [city of operator's registered
office — TBD].

---

## 17. Open items for legal review

The following items are tracked so a reviewing advocate can quickly find
the soft spots in this draft:

1. **NBFC-P2P status.** This draft asserts TrustPe is not an NBFC-P2P
   because it does not move money. Counsel needs to confirm whether the
   RBI's "Master Direction — Non-Banking Financial Company - Peer to Peer
   Lending Platform" (Sep 2017, as amended Aug 2024) catches a platform
   that only tracks bilateral loans without intermediating funds.
2. **DPDP Act Rules.** As of the draft date, the Data Protection Board
   of India is not fully operational and detailed Rules are not in
   force. Update §9 and §15 once the Rules and Board are operational.
3. **Grievance Officer name and contact.** A natural person resident in
   India must be appointed before launch (DPDP Act §10(1) for Significant
   Data Fiduciaries; for non-SDFs §13). Treat as a hard launch blocker.
4. **PMLA position.** TrustPe is not a "Reporting Entity" today, but
   PMLA's definition could be amended. Counsel should add a paragraph if
   the operator's status changes in any future phase.
5. **State moneylending laws.** While TrustPe is a platform and not a
   lender, the per-state ROI caps apply to the borrower-lender
   relationship that the platform documents. Counsel should confirm that
   noting the cap in the agreement (which the app already does) suffices
   and that the operator faces no platform-level liability under those
   acts.
6. **Class of users / closed-user-group disclosure.** The "friends and
   family only" status should be explicit in a launch-day banner inside
   the app and in this policy. Confirm wording with counsel.
7. **Aadhaar Act §29 compliance.** The draft asserts we never store the
   12-digit Aadhaar number. Counsel should confirm storing only the
   image of the Aadhaar card (encrypted at rest, with the operator able
   to view it for KYC) is permissible without UIDAI's Authentication
   User Agency licence.
