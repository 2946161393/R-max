# Legal review notes — /privacy and /terms

Companion to the two draft policy pages. The point of this file is to make a
lawyer's hour cheap: the product facts are stated here so counsel does not have
to reverse-engineer them, and every open question is listed with the section it
lives in.

Both pages carry a visible **"Draft — under legal review"** banner and no
effective date. Nothing on them claims to be final.

- Draft pages: `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`
- Shared shell: `src/components/legal/LegalDoc.tsx`
- Open questions render inline on the page as amber `TO CONFIRM — …` markers,
  so a reviewer reading the page sees them in context. They are also listed
  below.

---

## Product facts these drafts are built on

Verified against the codebase on 2026-08-02, not assumed.

| Claim in the drafts | Where it comes from |
| --- | --- |
| Two-sided marketplace, families ↔ caregivers, DC area | product |
| Accounts store name, email, role, ZIP code, city, state | `users` table |
| Families give a free-text neighborhood ("Northwest DC, near Tenleytown") and a number of children — **no street address field exists** | `src/app/family/profile/page.tsx`, `src/app/family/onboarding/page.tsx` |
| Everything else about a child (ages, allergies, routines) is optional free text the parent writes into a request or message | `src/app/family/post/page.tsx` |
| Caregiver ID photo + selfie go to a private storage bucket (`verifications`) | `src/app/caregiver/verify/page.tsx` |
| Profile photos go to an `avatars` bucket and are served from **public** URLs | `src/app/{caregiver,family}/profile/page.tsx` |
| ZIP codes are sent to a third party (`api.zippopotam.us`) for city/state lookup | `src/app/family/profile/page.tsx:141` |
| An AI coordinator sends messages on users' behalf, labeled as Ruah | `src/app/api/ai-followup/route.ts` |
| Every AI decision, including blocked ones, is logged | `agent_decisions` table |
| No payment processing, no fees, no card or bank data collected | product |
| Sub-processors today: Supabase, Vercel, Anthropic, zippopotam.us | codebase |

Two of these were not in the original brief and are worth counsel's attention:

1. **Profile photos are public.** `getPublicUrl` means anyone with the URL can
   view them, no sign-in required. Disclosed in Privacy §6.
2. **ZIP codes leave our infrastructure** to a free public API. Disclosed in
   Privacy §3, with a note suggesting a local lookup table would remove the
   third party entirely.

---

## Open questions, by document

### Privacy Policy

| § | Question |
| --- | --- |
| 1 | Registered entity name, type, business address, launch domain |
| 2 | Will analytics or product-measurement cookies exist at launch? If so a cookie disclosure, and possibly a banner, is needed |
| 3 | Keep the zippopotam.us lookup, or replace with a local table and delete the sub-processor? |
| 4 | COPPA position. Our reading is that it is not triggered — children neither create accounts nor submit anything; a parent describes their own household. Needs checking, not assuming |
| 5 | Current Anthropic API terms and DPA, specifically whether API content is used for training. Stated as an open item rather than paraphrased from memory |
| 5 | Can a user decline the AI coordinator and still use Ruah? Today there is no opt-out and the draft says so |
| 6 | Retention period for identity documents: delete on approval and keep only the outcome, or retain for a fixed fraud/safety window? |
| 7 | Is marketing email planned? If yes it needs its own line plus an unsubscribe commitment |
| 8 | Full sub-processor list once email delivery, error monitoring, and analytics are chosen |
| 10 | Concrete retention periods — profile data after closure; message threads (two participants, one may still need the thread); AI decision logs; backup persistence after a deletion request |
| 11 | Breach-notification duties: the DC statute plus any other state where we have users, and each timeline |
| 12 | Which state privacy laws actually apply given our size; whether DC has enacted a comprehensive statute by the effective date |
| 13 | Hosting regions; whether we will serve users outside the US (if so, GDPR/UK work is needed) |
| 15 | A real privacy contact address and postal address. A personal Gmail is fine for a draft, not for a published policy — **and the address currently in the codebase should be spelled-checked against the founder's actual address before launch** |

### Terms of Service

| § | Question |
| --- | --- |
| 1 | Registered entity name and business address |
| 5 | Does the draft state the DC Domestic Worker Employment Rights Act obligations accurately — who is a covered employer, and does Ruah itself have a platform notice duty? |
| 7 | If there is no way to decline the AI coordinator, is consent to automated messaging in the user's name adequately obtained at sign-up rather than only in the terms? |
| 9 | Fee model at launch. Any fee, commission, or payment processing needs pricing, refund, cancellation, and chargeback terms written **before** it ships |
| 12 | Build self-service account deletion, or state plainly that deletion is by email request only |
| 14 | **Liability cap and carve-outs.** Left deliberately unwritten. This is the section that matters if something goes badly wrong in a home, and it should not be filled with a number nobody has thought through |
| 15 | Scope of the indemnity, and whether it should be narrower for caregivers than families given the difference in bargaining position |
| 16 | Dispute resolution: DC courts or arbitration; class waiver; small-claims carve-out; enforceability against consumers in DC. Nothing drafted on purpose |
| 18 | Business contact address and postal address before publication |

---

## What these drafts deliberately do not do

- **No liability cap, no arbitration clause, no class waiver.** Filling these in
  from a template is how a startup ends up with an unenforceable clause it
  believed it had. Flagged instead.
- **No claim that we screen caregivers.** Terms §8 states in list form what
  verification is not: not a criminal background check, not a registry check,
  not reference verification, not an endorsement.
- **No claim to be an employment agency**, to employ caregivers, or to supervise
  care — Terms §3.
- **No legal advice.** DC employment obligations are described as general
  information with a pointer to does.dc.gov, and Terms §3 says explicitly that
  we do not give legal, tax, employment, or immigration advice.

## Related inconsistency to fix separately

The landing page currently advertises **"Background checks — Every caregiver
goes through a thorough background and identity verification process"**
(`src/app/page.tsx`, safety section). That is not true today, and it directly
contradicts Terms §8. It is queued for the Trust & Safety and copy passes; it
should not survive to launch in its current form.
