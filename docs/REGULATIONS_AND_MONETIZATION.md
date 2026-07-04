# TrustPe — Indian P2P Regulation, Competitor Analysis, and Monetization

**Date:** 2026-06-07
**Status:** Research deliverable — informs Phase 1 + Phase 2 strategy
**Author:** Bhagirath + Claude (research)

> **Disclaimer.** This document is a working research note, not legal advice. The Indian P2P lending regulatory environment changed materially in August 2024 and has continued to evolve. Before implementing any monetization model or scaling beyond friends-and-family, engage an Indian financial-services lawyer. Citations at the end.

---

## 1. Executive summary

Three things that determine TrustPe's product roadmap:

1. **The "closed user group" rule (RBI, August 2024) explicitly outlaws TrustPe's friends-and-family matching model for licensed NBFC-P2P platforms.** This is not negotiable for licensed platforms. CRED Mint, BharatPe's 12% Club, and MobiKwik Xtra were all shut down for exactly this. The only way a closed-group model survives is to stay **outside the NBFC-P2P framework entirely**, which is the architectural stance already documented in `ARCHITECTURE.md` §3.
2. **TrustPe's current 36% ROI ceiling is not the problem.** Competitors are *lower* (Faircent starts at 9.99%, Lendbox advertises up to ~25%, IndiaP2P up to 18%). The reason lenders find P2P unattractive is the **net yield after platform fees and defaults**, not the gross cap.
3. **The most powerful compliant lever for TrustPe is who pays the platform fee.** Routing all platform economics to the borrower side (origination fee) keeps the lender's gross = net, which is what materially improves perceived returns. RBI's August 2024 rules explicitly prohibit anything that smells like the platform providing credit enhancement or guaranteed returns to lenders.

---

## 2. Regulatory landscape (Indian P2P, mid-2026)

### 2.1 RBI Master Direction NBFC-P2P (2017, amended Aug 2024)

The 2017 directions classified P2P platforms as a sub-class of NBFC. The August 2024 amendments tightened them dramatically after platforms like LiquiLoans and LenDen Club were found to be operating as quasi-banks (pooled funds, fixed returns, liquidity options). Headline rules now in force for licensed NBFC-P2Ps:

| Rule | What it means |
|---|---|
| **No credit enhancement or guarantee** | Platform cannot bear any principal/interest loss. Loss is the lender's. |
| **No closed user groups** | Cannot match borrowers and lenders sourced from an affiliate or service provider; matching must be non-discriminatory and policy-driven. |
| **No promotion as "investment"** | No "tenure-linked assured minimum returns," no "liquidity options," no investment-product marketing. |
| **No cross-selling** | Except loan-related insurance products that are not credit enhancement. |
| **T+1 escrow** | Funds in escrow must move within one business day of receipt. |
| **No fund replacement** | Cannot use one lender's funds to replace another's. |
| **Lender cap** | ₹50 lakh aggregate exposure across all P2P platforms. If a lender invests >₹10 lakh, they need a CA-certified net worth of ₹50 lakh. |
| **Borrower cap** | ₹10 lakh across all platforms. |
| **Disclosure** | Must caveat that RBI registration does not imply RBI guarantee of loans. |

**Enforcement (Aug 2024):** RBI fined NDX P2P (LiquiLoans' parent) ₹1.92 crore and Innofin Solutions (LenDen Club) close to ₹2 crore for violating exactly these rules. RBI also issued show-cause notices to six P2P platforms in October 2024.

### 2.2 NBFC-P2P license requirements

- **Minimum Net Owned Funds:** ₹2 crore
- **Capital adequacy ratio:** 15% minimum
- **Process:** RBI approval through Department of Non-Banking Regulation; typically 6–12 months
- **Compliance overhead:** quarterly reporting, board-approved policies, dedicated compliance officer, audited financials, risk management framework

### 2.3 State moneylending laws (operate in parallel to RBI)

Money lending is a **State List** subject (Entry 30 of List II, Seventh Schedule). State Acts apply on top of any central rules:

- **Karnataka:** Karnataka Prohibition of Charging Exorbitant Interest Act 2004 caps interest at **18% p.a.** for moneylenders
- **Maharashtra (Bombay Moneylenders Act 1946):** ~9% p.a. for secured loans; higher for unsecured
- **Most states:** require a moneylender's license; transactions by unlicensed lenders may not be enforceable in court

**Penalty for unlicensed money lending (state-specific, indicative):** First offence — up to 1 year imprisonment + fine. The **draft Banning of Unregulated Lending Activities (BULA) Bill, 2024** proposes up to **10 years imprisonment** for unregulated lending — this would be a sea change if enacted.

### 2.4 The friends-and-family question

This is the single most important regulatory question for TrustPe:

> **If TrustPe is a matching platform between friends-and-family lenders and borrowers, and money flows direct UPI (not through TrustPe), is TrustPe a "P2P lending platform" under RBI rules?**

The honest answer:
- **Probably yes**, if TrustPe presents itself as a lending marketplace and actively matches users.
- The RBI's definition of "P2P lending platform" is "an intermediary providing the services of loan facilitation via online medium." Matching qualifies.
- Holding NBFC-P2P license + violating closed-user-group rule = penalty.
- Operating without license = state moneylending act violations + possible BULA exposure if enacted.

The architectural stance (`ARCHITECTURE.md` §3) — *"Phase 1 operates as a trust and matching platform that does not move money, at a scale (30–50 friends-and-family users) that is structurally below regulatory radar"* — is the **only viable path in Phase 1**. The mitigations need to be:

1. **No public marketing** as "lending platform" or "investment opportunity"
2. **Invite-only**, capped at <100 users
3. **Money flow stays direct** (UPI lender → UPI borrower, no escrow)
4. **No platform fee tied to lending economics** (no % cut of interest)
5. **Language matters** — call it a "lending circle," "trust-based personal lending network," "private mutual aid network." Avoid "P2P," "investment," "returns," "platform."

If TrustPe wants to scale beyond pilot, the realistic paths are:

- **A. Register as NBFC-P2P** (₹2 cr capital, license process, full compliance) and pivot the matching model away from closed groups
- **B. Stay as pure record-keeping/communication tool** without matching role (much smaller business)
- **C. Partner with a licensed NBFC** that takes the lending role; TrustPe stays as tech only

---

## 3. Competitor benchmark (as of 2025–2026)

### 3.1 Active licensed players

| Platform | Gross ROI (lender) | Platform fee | Tenure | Notes |
|---|---|---|---|---|
| **Faircent** | 9.99% start, up to ~24% | 1–2% on lender's interest income | Up to 3 years | One of the oldest NBFC-P2Ps. Diversified borrower base. |
| **Lendbox** | Advertised "up to 25%" | ~1% on investment or interest | 3–36 months | Aggressive on yield marketing pre-2024. |
| **LenDenClub** | 12–30% | Various (fined Aug 2024 for non-disclosure) | 1 month – 5 years | Operates large book. |
| **LiquiLoans** | Variable | Various (fined Aug 2024) | 1–3 years | Was offering "assured-return" style products that triggered crackdown. |
| **IndiaP2P** | Up to ~18% | ~1% | Up to 36 months | RBI-registered NBFC-P2P. |

### 3.2 Shut down or pivoted

- **CRED Mint, BharatPe 12% Club, MobiKwik Xtra:** all closed-user-group P2P partnerships. Wound down after Aug 2024 directions.

### 3.3 Net-yield math (lender's real return)

A representative model for an unsecured P2P loan:

```
Gross interest rate                   18.0% p.a.
─ Platform service fee (on interest) − 1.5%
─ Realised default rate               − 3.0%  (varies 2–8% by tier)
─ TDS withholding (already counted)   − 0.0%
Net yield to lender                  ~13.5%
```

Lenders compare this to alternatives:

| Alternative | Typical net yield |
|---|---|
| Bank FD | 6.5–7.5% |
| Government bonds (10y) | 7.0–7.5% |
| Corporate bonds (AAA) | 7.5–8.5% |
| Equity index SIP (long horizon) | 11–13% (volatile) |
| Equity mutual funds | 10–14% |
| Real estate / REITs | 7–10% |
| **P2P (post-fees, post-defaults)** | **11–18%** |

**Conclusion:** P2P is only attractive when the **net yield clears ~14–15%**. The lever isn't the gross rate cap (36% is already higher than the field); it's keeping more of the gross with the lender.

---

## 4. Compliant monetization and incentive models

For each, I've flagged **safe** (Phase 1, unlicensed friends-and-family) / **safe with caveats** / **requires NBFC-P2P license** / **prohibited**.

### 4.1 Platform revenue

| Model | Mechanism | Compliance |
|---|---|---|
| **Borrower origination fee** | Borrower pays 1–6% of loan amount up-front; lender's gross = net | ✅ **Safe** — standard across industry |
| **Lender service fee (% of interest)** | Platform takes 1–2% of interest paid | ⚠️ **Safe with caveats** — RBI requires fee transparency; once you take a cut you become more clearly a "platform" in regulatory eyes |
| **Listing fee** | Borrower pays a small fee to publish a request | ✅ **Safe** |
| **Late payment processing** | Platform processes late fees; per RBI must pass to lender | ✅ **Safe** |
| **Subscription** | ₹49–199/month for advanced features (analytics, multi-loan, priority browse) | ✅ **Safe** — keep economics separate from lending |
| **KYC / verification fee** | One-time at onboarding | ✅ **Safe** |
| **Cross-sell loan insurance** | Borrower-paid term/PMJDY insurance attached to loan | ⚠️ **Safe with caveats** — RBI allows this if not credit enhancement |
| **Cross-sell other products** | Mutual funds, FDs, etc. | ❌ **Prohibited** for licensed NBFC-P2Ps |

### 4.2 Lender incentives — increasing perceived attractiveness

| Incentive | Mechanism | Compliance |
|---|---|---|
| **Borrower-paid origination → lender's gross = net** | Effectively bumps lender yield by 1–2% vs interest-cut model | ✅ **Safe** — the highest-leverage compliant move |
| **Risk-based pricing** | Lender prices based on borrower's TrustScore; higher risk = higher rate | ✅ **Safe** — market-determined, not platform-guaranteed |
| **Diversification engine** | Recommend spreading capital across borrowers | ✅ **Safe** — defaults averaged down |
| **Auto-invest with criteria** | Lender sets rules; system matches | ⚠️ **Safe with caveats** — RBI says matching must be non-discriminatory; rules-based is fine but pre-approval requirements apply |
| **First-loss capital from borrower** | Borrower posts security or has co-signer with skin in the game | ✅ **Safe** — this is collateralisation, not platform guarantee |
| **Tiered platform fees by lender volume** | High-volume lenders pay lower service fee | ✅ **Safe** — pricing structure |
| **Subscription that waives platform fees** | Members get reduced cuts | ✅ **Safe** — subscription is separate revenue |
| **Loyalty / referral rewards** | Platform credits, TrustScore boost, subscription discounts (NOT money) | ✅ **Safe** — non-monetary rewards don't constitute returns |
| **Cashback as % of investment** | Lender gets X% of capital back from platform | ❌ **Prohibited** — credit enhancement |
| **Assured minimum returns** | Platform makes up shortfall | ❌ **Prohibited** — Aug 2024 directions explicitly ban this; LiquiLoans was fined for similar |
| **Liquidity / early exit** | Lender can withdraw before tenure ends | ❌ **Prohibited** — 12% Club / Mint shut down for this |
| **Referral cash bonus paid by platform** | Refer a lender → ₹X cash | ⚠️ **Safe with caveats** — fine if framed as marketing reward, not return enhancement; document carefully |

### 4.3 Borrower incentives — reducing churn and default

| Incentive | Mechanism | Compliance |
|---|---|---|
| **Auto-pay discount** | 0.5% rate reduction for borrower who sets up UPI Autopay | ✅ **Safe** — reduces operational risk, justified |
| **Early repayment without penalty** | Standard | ✅ **Safe** |
| **Loyalty pricing** | Repeat borrowers with clean history get rate discount on next loan | ✅ **Safe** |
| **TrustScore-based pricing** | Higher score → access to lower-rate offers | ✅ **Safe** |
| **Referral bonus** | Bring a borrower friend → both get ₹100 platform credit | ⚠️ **Safe with caveats** — keep small, document it's marketing not interest discount |
| **Skip-a-payment** during emergencies | Restructure with admin approval | ⚠️ **Safe with caveats** — must not constitute platform-funded payment |

### 4.4 Risk management

| Lever | Mechanism | Compliance |
|---|---|---|
| **TrustScore-based tier caps** | Already implemented — tier caps borrow amount | ✅ **Safe** |
| **Mandatory diversification** | Auto-cap any single loan as % of lender's portfolio | ✅ **Safe** |
| **Borrower-paid loan insurance** | Single-premium credit insurance bundled with loan | ⚠️ **Safe with caveats** — insurance partner required; complex |
| **Collection escalation** | Reminders → admin manual collection → external agency | ✅ **Safe** — must be RBI's Fair Practices Code-compliant |
| **Public default registry** | Defaulted borrowers visible on profile | ✅ **Safe** — already in architecture; aligns with TrustPe's social-pressure model |
| **Co-signer / guarantor** | Friends-and-family naturally have social co-signers | ✅ **Safe** — borrower-side, not platform-side |
| **Cross-platform default sharing** | Defaulters reported to credit bureaus | ⚠️ **Safe with caveats** — credit bureau reporting requires NBFC license |

---

## 5. Practical recommendations for TrustPe

### 5.1 Phase 1 (now → 100 users): stay below the radar

- **Branding language:** "Trust-based personal lending network." Avoid "P2P," "investment," "platform fee on returns," "lender returns" in any marketing.
- **Membership:** invite-only. Cap at 50–100 users in the closed pilot. No public app store listing yet.
- **Money flow:** keep UPI Intent direct (lender → borrower), no escrow. Already architected this way.
- **Platform economics:** **no fee tied to lending interest** in Phase 1. The platform is free. This avoids being characterised as a financial intermediary.
- **ROI cap:** keep at 36% for the schema. State-specific cap warnings should appear at request creation (e.g., warn if borrower is in Karnataka and ROI > 18%).
- **TrustScore-based borrower tiers:** already implemented — keep enforcing.
- **Documentation:** every loan agreement includes the click-wrap statement "this loan is a private bilateral arrangement between two individuals; TrustPe is a record-keeping tool and not a party to this loan."

### 5.2 Phase 1.5 (100 → 500 users): monetize without crossing lines

Once the product is proven:

- **Subscription tier:** ₹99/month "TrustPe Plus" — gets advanced analytics, multiple concurrent loans (raise the one-active cap), faster KYC re-verification, priority customer support. **Not tied to lending economics.**
- **Borrower-paid origination fee:** flat ₹99 or 1% of loan amount, capped at ₹500. Goes to platform. Lender's gross interest = lender's net.
- **Loan insurance partner** (Phase 2): single-premium ₹50–200 per loan, optional, borrower-paid. Covers principal in case of borrower demise/disability. Platform takes referral fee from insurer (this is RBI-permitted cross-sell).
- **Referral rewards:** ₹100 platform credit per successful referral. Both parties get it.
- **Auto-pay discount for borrowers:** 0.5% rate reduction when UPI Autopay is set up. Improves lender's collection rate, justified pricing.

### 5.3 Phase 2 (500+ users): structural decisions

Three forks:

- **Fork A — Become NBFC-P2P.** ₹2 crore capital + license + full compliance. Drop the friends-and-family matching model (becomes a general marketplace). Reduces serviceable market but legally clear.
- **Fork B — Stay as tech platform; partner with an NBFC.** TrustPe is the front-end + matching + UX layer. A licensed NBFC partner becomes the lender of record and handles compliance. Revenue share. Like many "neobank" models.
- **Fork C — Stay friends-and-family but small.** Cap at 1000 users, premium subscription model only, no public marketing. Lifestyle business.

**Recommendation:** decide which fork in Phase 1.5 based on pilot traction, before crossing 500 users.

### 5.4 Compliant lender-attractiveness improvements to ship in Phase 1.5

Ranked by impact:

1. **Move origination fee to borrower** — biggest perceived yield increase for lender with zero compliance risk. If TrustPe takes a 1% fee, the lender's net is 1% higher than the gross-cut model.
2. **Show net-yield calculator in browse** — alongside each request, show "estimated net yield: 14.2% (after defaults at borrower's tier)". Frames offers in the metric lenders actually care about.
3. **Diversification nudge** — when a lender's portfolio is concentrated in a single borrower, suggest spreading. Lower variance = better retention.
4. **Borrower auto-pay default for new loans** — significantly improves on-time repayment.
5. **TrustScore-banded interest rate visibility** — show lenders the realized default rate per band (e.g., "Fair tier: 4.2% defaulted in last 12 months"). Lets them price risk explicitly.
6. **Public default profile** — already in architecture, ship in Phase 4 — significantly improves repayment behaviour in friends-and-family contexts because shame is a strong motivator within a known social circle.

### 5.5 What NOT to do — items that would trigger regulatory exposure

- ❌ "Earn 15% guaranteed returns" or any similar copy in marketing
- ❌ "Liquidity option" or "early exit before tenure"
- ❌ Platform pool — never pool funds across borrowers
- ❌ Platform-guaranteed first-loss
- ❌ Cashback as percentage of investment
- ❌ Cross-sell mutual funds, FDs, stocks
- ❌ Promote the app as an "investment app" on any channel
- ❌ Take credit risk on TrustPe's own balance sheet

---

## 6. Implementation impact on current codebase

Items to update in `ARCHITECTURE.md` / future build plan based on this research:

1. **Add a state-residence interest-rate warning at loan request creation.** Already have `borrowerCity` in profile. Lookup state → check state moneylending cap → warn if max ROI > cap.
2. **Add borrower-paid origination fee field to the loan and agreement models** (Phase 1.5).
3. **Add subscription model** (Phase 1.5) — separate from lending data model.
4. **Add net-yield computation to loan request browse** — show lenders estimated net yield based on realized default rates per trust band.
5. **Add public default profile flag** (already in architecture, schedule for Phase 4).
6. **Marketing copy review** — wherever we say "lend / invest / returns" in mobile UI, audit and replace with safer language (`personal_lending_pilot.md` content review).

---

## 7. Sources

### Regulatory
- [RBI Master Direction on NBFC-P2P (2017, amended Aug 2024)](https://rbi.org.in/scripts/BS_ViewMasDirections.aspx?id=11137)
- [RBI's Revised Master Directions on Peer-to-Peer Lending: Shift in Regulatory Policy (IndiaCorpLaw, Oct 2024)](https://indiacorplaw.in/2024/10/18/rbis-revised-master-directions-on-peer-to-peer-lending-shift-in-regulatory-policy/)
- [Survival at Stake? The impact of RBI's Norms on P2P Lending Platforms (Vinod Kothari, Aug 2024)](https://vinodkothari.com/2024/08/survival-at-stake-the-impact-of-rbis-norms-on-p2p-lending-platforms/)
- [RBI Tightens Regulations for P2P Lending Platforms (Lexology)](https://www.lexology.com/library/detail.aspx?g=76800afa-9bdf-467d-8f5e-eaaa2697fc3d)
- [Karnataka Prohibition of Charging Exorbitant Interest Act 2004 — coverage in Deccan Herald](https://www.deccanherald.com/india/karnataka/bengaluru/private-lenders-can-levy-interest-up-to-18-yearly-2965830)
- [Bombay Money-Lenders Act commentary (BCAJ)](https://bcajonline.org/journal/bombay-money-lenders-act/)
- [Registration under Money-Lending laws (Vinod Kothari)](https://vinodkothari.com/2021/08/registration-under-money-lending-laws/)

### Enforcement
- [RBI cracks down on NBFC-P2Ps, fines LiquiLoans, LenDen Club (Medianama, Aug 2024)](https://www.medianama.com/2024/08/223-rbi-nbfc-p2p-guidelines-rs-4-crore-fine-liquiloans-lenden-club/)
- [RBI Slaps INR 4 Cr Penalties On LiquiLoans, LenDen (Inc42)](https://inc42.com/buzz/rbi-cracks-down-on-nbfc-p2p-lending-platforms-slaps-inr-4-cr-penalties-on-liquiloans-lenden/)
- [RBI sends show cause notices to 6 P2P lending platforms (Medianama, Oct 2024)](https://www.medianama.com/2024/10/223-report-rbi-send-show-cause-notices-to-6-p2p-lending-platforms/)
- [RBI's Crackdown on P2P Lending: Course Correction or a Death Knell? (IRCCL)](https://www.irccl.in/post/rbi-s-crackdown-on-p2p-lending-course-correction-or-a-death-knell)

### Competitor data
- [Faircent — Interest Rates and Fees](https://www.faircent.in/interest-rates-and-fees)
- [Faircent — Returns and Fees for Investors](https://www.faircent.in/returns-and-fees)
- [Lendbox — Pricing and Fees](https://www.lendbox.in/pricing-and-fees)
- [Lendbox — Portfolio Performance](https://www.lendbox.in/portfolio-performance)
- [LiquiLoans FAQ](https://www.liquiloans.com/faq)
- [IndiaP2P FAQ](https://www.indiap2p.com/faqs-about-p2p-investing)
- [P2P Lending Industry: What Changed After RBI's Tough Guidelines (TheAltInvestor)](https://blog.thealtinvestor.in/p2p-lending-the-state-of-the-industry-after-rbi-guidelines)
- [Processing Fee in P2P Lending (Cambridge Wealth)](https://www.cambridgewealth.in/post/processing-fee-in-p2p-lending-what-you-need-to-know)

### NBFC licensing
- [NBFC P2P Lending License — Capital and process (Compliance Calendar)](https://www.compliancecalendar.in/nbfc-p2p-lending-registration)
- [NBFC Registration in India: RBI Guidelines (IncorpX, 2026)](https://www.incorpx.io/blog/nbfc-registration-rbi-guidelines-india)

---

**Next review:** when traction crosses 100 users or before any public marketing decision, whichever is sooner.

---

## 8. Whose state's ROI cap applies?

When a Karnataka lender lends to a Maharashtra borrower through TrustPe, three states could theoretically have jurisdiction:

- **The borrower's state** — Bombay Moneylenders Act protects lending *in* Maharashtra
- **The lender's state** — Karnataka Prohibition of Charging Exorbitant Interest Act protects residents *of* Karnataka
- **TrustPe's registered office state** — relevant for some compliance filings but not for the rate cap on individual transactions

**Conclusion: the borrower's state governs.** State moneylending acts are protective statutes — they exist to shield the borrower in that state from exorbitant rates, regardless of where the lender or platform sits. Conservative legal interpretation, which any compliance lawyer will advise, is to apply the **borrower's state cap as the binding ceiling** and pick the more restrictive of (state cap, TrustPe's own ROI ceiling).

There is judicial ambiguity here because state moneylending acts predate digital cross-state platforms and weren't drafted with them in mind. The draft BULA Bill 2024, if enacted, would centralise this at the union level — but that's not the world we live in today.

**Indicative state caps** (verify before rollout):

| State | Cap (unsecured personal loans) | Source |
|---|---|---|
| Karnataka | 18% p.a. | Karnataka Prohibition of Charging Exorbitant Interest Act 2004 |
| Maharashtra | ~21% p.a. (unsecured) | Bombay Moneylenders Act 1946 |
| Tamil Nadu | 12% (secured), 15% (unsecured) | TN Moneylenders Act |
| West Bengal | 12% (secured), 15% (unsecured) | Bengal Moneylenders Act |
| Andhra Pradesh / Telangana | ~24% | AP Moneylenders Act |
| Most others (default) | 24% (RBI fair-practices guidance) | RBI |

**Implementation plan:**

1. Add a `STATE_ROI_CAPS_PERCENT` map in `shared/constants/state-roi-caps.ts`.
2. The city dataset already encodes city → state; resolve the borrower's state from `profile.city` on the server when validating a loan request.
3. In `loan-request.service.create`, if `input.roiPercent > stateCap`, reject with a clear error message that names the state and the cap. **[Shipped 2026-06-07.]**
4. On the mobile create-request form, show a soft warning above the ROI field once the borrower selects a state — *"In Karnataka, the moneylending cap is 18% p.a. Setting a higher max may make the loan unenforceable."*
5. Document the cite in the agreement PDF (Sprint 2D) so the legal basis is on the record.

---

## 9. Scaling paths — how to grow beyond friends-and-family

The friends-and-family thesis that makes TrustPe legally workable in Phase 1 is structurally also its growth ceiling. At some point between 500 and 5,000 active users, three forks become real:

| Path | Description | Realistic cap | Capital | Compliance |
|---|---|---|---|---|
| **A. Stay closed-group, subscription business** | Invite-only network capped at ~1k–10k users. Subscription is the only revenue stream. No platform fee on lending. | ~10k users | ₹0 (bootstrapped) | Low — stays below NBFC-P2P threshold |
| **B. NBFC-P2P license** | Drop closed-group thesis. Become a generic marketplace like Faircent. | Millions (theoretically) | ₹2 cr capital + ~₹50 lakh/yr ongoing | High — every Aug-2024 rule applies |
| **C. NBFC partnership / LSP model** | TrustPe = tech + UX + matching. Licensed NBFC partner is the lender of record. | Millions, gated by partner | ₹0–25 lakh | Medium — TrustPe is a "Lending Service Provider" |

### 9.1 Why Path C is the recommended path

Historical pattern globally — Prosper, LendingClub (US), Funding Circle, Zopa (UK) — all started as pure retail P2P and ended up either becoming banks/NBFCs or pivoting to institutional capital. The pure retail-to-retail model hasn't structurally scaled anywhere. India is even harder because the August 2024 RBI tightening removed exactly the features (assured returns, liquidity, closed-group matching) that retail lenders responded to.

In India today, **none of the licensed NBFC-P2Ps has crossed even 1M unique lenders despite eight years**. Faircent / IndiaP2P / Lendbox are in the 100k–500k range. The compliance overhead of NBFC-P2P plus the value-prop-killing rules means Path B is a shrinking pond.

**Path C lets TrustPe keep its actual differentiator — the trust-based social layer — while making the lending economics regulator-friendly.** A licensed NBFC partner (smaller NBFCs like Northern Arc, FedFina, Cashe, or a public-sector bank's BaaS arm) becomes the legal lender. TrustPe is the front-end and matching layer. The user-visible product is identical to today; the legal substrate changes.

Revenue mechanics in the LSP model:
- TrustPe earns a tech-platform fee (typically 1–2% of disbursal value)
- And/or a referral fee per booked loan
- NBFC books interest on the loan; bears credit risk
- Lenders in the friends-network become "first-loss participants" or structured-product subscribers — depending on the deal

### 9.2 Recommended 18-month sequencing

- **Months 1–6 (now):** stay in Phase 1 stealth as documented. Get to 100–300 active users. Build TrustScore data, document default rates by trust band, exercise the public defaulter registry, run the agreement-signing flow. Introduce "TrustPe Plus" subscription to test willingness-to-pay separate from lending economics.
- **Months 6–12:** start NBFC partnership conversations. Smaller NBFCs are more receptive than tier-1 ones. In parallel, formalise compliance — register the private limited company with adequate paid-up capital (not yet ₹2 cr; standard pvt ltd is fine), set up internal grievance redressal per RBI's Fair Practices Code, get a compliance counsel on retainer (~₹25–50k/month).
- **Months 12–18:** announce partnership. NBFC's loan booking system integrates into TrustPe's flow. Money now flows through NBFC's escrow rather than direct UPI. This is the technical pivot — the architecture's `IPaymentVerificationProvider` adapter (already in §6.3.2) is exactly where the NBFC's disbursement and EMI APIs slot in. Most of Sprint 3's code stays.
- **Months 18+:** open up to public marketing. Now you're a regulated entity's distribution partner; you can advertise. Target tier-2/3 cities where trust-based lending is culturally familiar (chit funds, family loans). Scale to 10k → 100k → 1M users in this configuration.

### 9.3 What this means for code being built right now

Nothing thrown away. Specifically:

- The Sprint 2 negotiation flow (offers + chat + agreement) stays exactly the same — the NBFC partner reuses it as the customer-facing front-end.
- The Sprint 3 UPI Intent + payment verification flow stays as the Phase 1 fallback. Phase 3 swaps the adapter to call the NBFC's disbursement API.
- The TrustScore + public defaulter registry + agreement PDF are pure value-add for an NBFC partner — they're TrustPe's moat.
- The KYC capture and review flow can be reused by the NBFC partner directly or extended to meet their additional KYC requirements (Video KYC, etc.).

### 9.4 What to NOT do

- ❌ Spend ₹2 cr on an NBFC-P2P license. That window narrowed sharply post-Aug 2024.
- ❌ Pivot to becoming a balance-sheet NBFC yourself unless you raise ~₹10 cr. Capital-intensive lending businesses are punishing for early-stage teams.
- ❌ Go public-marketing before the partnership lands. State moneylending exposure scales with visibility.
- ❌ Pool funds across borrowers or take any credit risk on TrustPe's own books. That single line crosses you into NBFC territory accidentally.
- ❌ List on Play Store production track without RBI registration / NBFC partnership disclosure. Google's India Personal Loan Apps policy will block it; if it slips through, the listing becomes an exhibit when RBI looks.

---

## 10. Distribution strategy — Play Store the safe way

The decision to put the app in front of friends matters more than the technical hosting question, but the *track* matters too. Google Play has four distribution tracks. Three of them are perfect for the closed-pilot strategy; one is dangerous to enter prematurely.

| Track | Discoverable? | Reviewer scrutiny | Right for TrustPe Phase 1? |
|---|---|---|---|
| **Internal testing** | No — invited testers only by email | Minimal | ✅ Yes — recommended starting point |
| **Closed testing** | No — invited via opt-in link only | Limited | ✅ Yes — when scaling to 100+ testers |
| **Open testing** | Yes — listed publicly as "Early Access" | Moderate | ⚠️ Only when ready for moderate public exposure |
| **Production** | Yes — full Play Store listing | Strict, incl. India Personal Loan Apps policy | ❌ Not until NBFC partnership lands |

**The Personal Loan Apps policy (Google Play, India)** requires production apps that facilitate personal loans to either be RBI-registered OR demonstrate NBFC partnership. Without that, the production track will reject TrustPe. Internal and Closed testing bypass that policy gate because they're not public listings.

See `docs/PLAY_STORE_DISTRIBUTION.md` for the step-by-step runbook.

---

## 11. FAQ — recurring strategy questions

### 11.1 Can the borrower consent to a rate above their state cap?

**No.** This is the single most tempting workaround when an 18% Karnataka cap meets a lender market that won't fund below 22%. It doesn't hold up legally and actively increases your exposure.

**Why it doesn't work:**

- State moneylending acts are **mandatory consumer-protection statutes**, not default rules. They protect borrowers as a class. Borrower consent does not waive the protection of a statute.
- **Indian Contract Act §23** voids agreements whose object "defeats the provisions of any law." A 36% loan made to a Karnataka borrower, with documented consent, is still void to the extent of the excess. Courts cap recovery at the statutory rate or treat the loan as principal-only.
- Case law is consistent — Madras and Karnataka High Courts have repeatedly enforced state caps over party agreement on usurious interest.
- The defense *"we informed them, they consented"* is **paper-thin and counter-productive** — it creates in-app evidence that TrustPe *knew* the cap was lower AND deliberately asked the borrower to bypass it. That's the difference between negligence (didn't know) and a knowing violation (structured the evasion).
- BULA Bill 2024 specifically targets structured evasion, proposing up to 10 years imprisonment.

**Structural analogy:** you can't ask an employee to waive minimum wage, a tenant to waive rent control, or a worker to waive overtime. Interest rate caps fall in the same non-waivable bucket.

**What to do instead** (in priority order):

1. **Borrower-paid origination fee** — the cap applies to INTEREST, not platform service fees. Charging the borrower 1–2% origination keeps the lender at full gross yield. This is the highest-leverage compliant move (also §4.1).
2. **Verify each state cap before enforcing strictly** — `state-roi-caps.ts` defaults are indicative; the actual binding cap for unsecured personal loans is often higher than the "common summary" number, especially in TN/Bengal where older statutes distinguish secured vs unsecured. Get a lawyer's table before going live with strict enforcement.
3. **Frame the cap as a trust signal**, not a constraint. Lender UI: *"18% is the statutory ceiling for Karnataka. Borrower is offering the maximum legally permitted rate."*
4. **Lead with net yield in the lender UI**, not gross rate. A clean 18% Good-tier borrower with 2% expected default rate nets ~16%, which beats every retail alternative.
5. **Accept market clearing.** If a Karnataka borrower at 18% can't find funding, the answer is to grow the trust mechanism (default registry, realised-default-rate disclosures) and the lender pool — not to break the cap.

The TL;DR: writing the consent workaround into the app would convert a regulatory question into a documented willful violation. Don't do it.


