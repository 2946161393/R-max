import type { Metadata } from 'next'
import Link from 'next/link'
import ContactEmail from '@/components/ContactEmail'

/* Trust & Safety.
   Framing rule for anyone editing this file: INFORM AND GUIDE. Ruah does not
   provide legal services and does not run background checks. Nothing here may
   imply otherwise, including by omission.

   Bilingual readiness: every user-visible string lives in the `copy` object
   below, as a complete sentence. Never concatenate fragments and never
   interpolate a noun into a sentence — zh word order will not survive it. To
   add Chinese, copy this object, translate the values, and select on locale;
   no JSX below needs to change. Layouts use wrapping text and no fixed
   heights, so longer zh/en strings do not break them. */

export const metadata: Metadata = {
  title: 'Trust & Safety — Ruah',
  description:
    'What Ruah verifies, what we do not check, how to arrange your own background check, and what the law asks of household employers — federally, in your state, and in DC.',
}

/* Every factual claim in the federal and state layers below is taken from one
   of these pages, checked against the source rather than written from memory.
   If you edit that copy, re-read the source first. */
const LINKS = {
  dolPrivateHome: 'https://www.dol.gov/agencies/whd/fact-sheets/79-flsa-private-home-domestic-service',
  dolRecordkeeping:
    'https://www.dol.gov/agencies/whd/fact-sheets/79c-flsa-domestic-service-recordkeeping',
  dolStateMinimumWage: 'https://www.dol.gov/agencies/whd/minimum-wage/state',
  ndwaStateList:
    'https://www.domesticworkers.org/programs-and-campaigns/developing-policy-solutions/domestic-workers-bill-of-rights/#domestic_workers_bill_of_rights_and_protections_in_each_state',
  ndwaFairContracts:
    'https://www.domesticworkers.org/resources/fair-contracts-for-domestic-work-a-guide-for-domestic-workers-and-employers/',
  /* The DC template is a fillable PDF and is also what we base a prepared
     agreement on. The DOES service page, the DOES FAQ and NDWA's DC rights
     page were dropped when DC became a footnote — restore them from git if a
     future DC section wants them again. */
  doesTemplate:
    'https://does.dc.gov/sites/default/files/dc/sites/does/publication/attachments/Domestic%20Worker%20Service%20Contract%20Agreement_template_2023_fill.pdf',
  ftcGuide: 'https://www.ftc.gov/business-guidance/resources/background-checks-what-employers-need-know',
}

const copy = {
  pageTitle: 'Trust & Safety',
  pageIntro:
    'Here is what we check, what we do not check, and what we think you should do yourself. We would rather tell you where our checks stop than let you assume they go further than they do.',

  doTitle: 'What we verify today',
  doIntro:
    'Every caregiver who carries a verified badge on Ruah has been through this. A person on our team does it by hand — it is not automated.',
  doItems: [
    {
      emoji: '🪪',
      title: 'Identity verification',
      body: 'A caregiver uploads a government-issued photo ID and a selfie. A member of our team compares the two and either approves the caregiver or asks for clearer photos. Only approved caregivers get the verified badge.',
    },
    {
      emoji: '🔒',
      title: 'Documents stay private',
      body: 'ID photos and selfies are stored in a private location, separate from public profiles. Our reviewers open them through short-lived links that expire within the hour. Families never see them, and neither do other caregivers.',
    },
    {
      emoji: '📝',
      title: 'Profile review',
      body: 'We read caregiver profiles and flag language that suggests working off the books, moving payment off the platform, or other terms that put either side at risk. We can suspend or remove accounts that break our rules.',
    },
    {
      emoji: '💬',
      title: 'Coordination stays on Ruah',
      body: 'Messages, matches, and the commitments people make run through the platform, so there is a record if something later goes wrong.',
    },
  ],

  badgeTitle: 'What the verified badge means — exactly',
  badgeMeans:
    'A verified badge means one thing: we checked a government ID and a selfie, and we believe this person is who they say they are.',
  badgeNotIntro: 'It is not:',
  badgeNot: [
    'a criminal background check',
    'a check of sex offender, child abuse, or driving registries',
    'a check of references, employment history, or certifications',
    "an endorsement, or any judgment about someone's character or fitness to care for your children",
  ],

  dontTitle: 'What we do not do: background checks',
  dontLead: 'Ruah does not run criminal background checks on caregivers.',
  dontBody:
    'No badge, label, or score anywhere on this platform means a caregiver has been background checked, because we have not checked. We would rather say that plainly than let a green checkmark carry a meaning it has not earned.',
  dontRecommend:
    'We recommend that every family arrange a background check before hiring someone to care for their children. It is your decision and your process — here is how to do it properly.',

  howTitle: 'How to arrange your own background check',
  howSteps: [
    {
      title: 'Use a real screening company',
      body: 'Background checks run for hiring purposes are regulated. Use a consumer reporting agency that complies with the federal Fair Credit Reporting Act, not a cheap people-search website. A report from an unregulated site can be wrong, and using it to make a hiring decision can put you on the wrong side of the law.',
    },
    {
      title: 'Get written permission first',
      body: 'Federal law requires you to give the caregiver a clear, standalone written notice that you intend to run a background check, and to get their written authorization before it happens. The notice cannot be buried inside an application form.',
    },
    {
      title: 'Decide what you actually need checked',
      body: 'For in-home childcare, families commonly check criminal records and the sex offender registry, and add a driving record if the caregiver will be driving their children.',
    },
    {
      title: 'Handle a bad result fairly',
      body: 'If you decide not to hire someone because of what the report said, federal law requires you to give them a copy of the report and a summary of their rights before you make that decision final, so they have a chance to correct an error. Reports do contain errors.',
    },
    {
      title: 'Apply the same rule to everyone',
      body: 'It is illegal to check some candidates and not others based on race, national origin, color, sex, religion, disability, genetic information, or age. Pick a policy and apply it to every caregiver you seriously consider.',
    },
  ],
  ftcLinkLabel: 'FTC — Background Checks: What Employers Need to Know',

  caregiverCheckTitle: 'If you are a caregiver and a family asks',
  caregiverCheckBody:
    'A family must ask your permission in writing before running a background check, and you are allowed to say no. Many caregivers agree because it helps them get hired sooner. That is your decision to make, not ours, and declining does not affect your standing on Ruah.',

  /* ── Layer 1: true wherever you live ─────────────────────────────────── */
  federalTitle: 'Hiring someone to work in your home makes you an employer',
  federalLead:
    'This part does not depend on where you live. When you hire a caregiver to work in your home, you are a household employer, and federal wage law treats the person you hired as your employee rather than as a contractor you booked.',
  federalPoints: [
    'The Department of Labor states that people employed in domestic service in private homes are covered by the Fair Labor Standards Act, and it lists nannies and babysitters among them.',
    'Covered workers must be paid at least the federal minimum wage, plus overtime at one and a half times their regular rate for hours worked beyond 40 in a week for the same employer.',
    'A caregiver who lives in your home is exempt from the overtime rule but is still owed the minimum wage for every hour worked.',
    'Babysitting employed on a casual basis is exempt from both. Casual means irregular or intermittent work by someone whose vocation is not babysitting, so an occasional evening sitter may qualify where a regular nanny does not.',
    'You are expected to keep records for any worker owed minimum wage or overtime: their name and address, the hours worked each day and each week, and what you paid. The Department of Labor asks employers to keep these for three years.',
  ],
  federalWageNote:
    'That is the federal floor, not the whole answer. Many states set a higher minimum wage, and where they do, the higher rate is the one you owe.',
  federalContractTitle: 'Put it in writing, wherever you are',
  federalContractBody:
    'Only some places require a written agreement, but a written agreement is worth having everywhere. It settles the things people argue about later: the pay rate and when pay arrives, the hours, the duties, time off, and how either side can end the arrangement. The National Domestic Workers Alliance publishes a plain-language guide for workers and employers.',

  /* ── Layer 2: varies by state ────────────────────────────────────────── */
  stateTitle: 'Your state may ask for more than the federal floor',
  stateLead:
    'A number of places have passed a Domestic Workers Bill of Rights, which extends protections beyond the federal baseline. By the National Domestic Workers Alliance’s count, twelve states, two major cities, and the District of Columbia have one.',
  stateBody:
    'What they require is not uniform. Depending on where you live, the law may cover written agreements, rest and meal breaks, paid time off, notice before a schedule changes, or protection from harassment and retaliation. Look up your own state rather than assuming a neighboring state’s rules carry over.',
  stateLinkLabel: 'Check the rules where you live',

  /* ── The offer. Three rules for anyone editing this block ─────────────
     1. The agreement belongs to the family and the caregiver. Ruah never
        requires one, and nothing here may read as a condition of using Ruah.
     2. The offer is live today. Present tense only — no "coming soon", no
        "we're building", nothing a reader could take as a future promise.
     3. Jurisdiction is a footnote. The two lines at the end are the whole of
        it; the legal layers above carry the detail. */
  agreementTitle: 'A written agreement, if you want one',
  agreementLead:
    'A written agreement is a good idea — and it’s between you and your caregiver. If you’d like one, we’ll prepare it for you: based on the official template, pre-filled with the details you’ve both confirmed, in English and the caregiver’s preferred language. Just ask.',
  agreementRevisit:
    'And it doesn’t have to be one-and-done: some families like to revisit the agreement after a trial period or when schedules change. Whenever you want it updated, same deal — just ask.',
  agreementCta: 'Ask us to prepare an agreement',
  agreementSubject: 'Preparing a written agreement',
  agreementEmailLabel: 'Or email us',

  footnotesTitle: 'Two footnotes on the rules',
  footnoteDc:
    'In the District of Columbia a written services contract is not optional: the Domestic Worker Employment Rights Amendment Act of 2022 requires household employers to provide one, and to make a reasonable effort to provide it in the language the worker prefers. A caregiver in DC is entitled to that contract and can ask for it.',
  footnoteDcLinkLabel: 'The official DC template contract',
  footnoteStates:
    'Some states have additional requirements for domestic work — check yours.',
  footnoteStatesLinkLabel: 'Domestic worker protections by state',

  disclaimerTitle: 'This is information, not legal advice',
  disclaimerBody:
    'Ruah is not a law firm and does not give legal, tax, or employment advice. This page points you toward the official sources so you can read them yourself or take them to someone who can advise you. Where anything here differs from what the Department of Labor, your own state, or the District of Columbia publishes, they are right and we are not.',

  conciergeTitle: 'Would you rather talk this through with someone?',
  conciergeBody:
    'Deciding who to let into your home is a lot to weigh on your own. You can book 30 minutes with the Ruah Team, walk through your family’s situation, and have your first match coordinated personally.',
  conciergeCta: 'Book 30 minutes with the Ruah Team',

  reportTitle: 'Tell us when something is wrong',
  reportBody:
    'If a profile, a message, or an interaction feels wrong, report it. We read everything that comes in, and we act on anything involving safety. You do not need to be certain before you tell us.',
  reportCta: 'Report something to us',
  reportSubject: 'Reporting something to Ruah',
  emailUsLabel: 'Or email us',
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-strong hover:underline font-medium"
    >
      {children} ↗
    </a>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-bold text-ink mb-4">{children}</h2>
}

export default function TrustAndSafetyPage() {
  return (
    <div className="min-h-screen bg-brand-wash">
      <header className="bg-surface border-b border-line px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <img src="/ruah-logo.png" alt="" className="w-7 h-7" />
            <span className="font-bold text-brand">Ruah！</span>
          </Link>
          <span className="text-ink-faint" aria-hidden="true">
            /
          </span>
          <span className="text-sm font-semibold text-ink">{copy.pageTitle}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-ink mb-4">{copy.pageTitle}</h1>
        <p className="text-lg text-ink-muted leading-relaxed mb-14">{copy.pageIntro}</p>

        {/* What we verify */}
        <section className="mb-16">
          <SectionHeading>{copy.doTitle}</SectionHeading>
          <p className="text-ink-muted leading-relaxed mb-6">{copy.doIntro}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {copy.doItems.map(item => (
              <div key={item.title} className="bg-surface rounded-card p-6 border border-line">
                <div className="text-2xl mb-3" aria-hidden="true">
                  {item.emoji}
                </div>
                <h3 className="font-semibold text-ink mb-2">{item.title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What the badge means */}
        <section className="mb-16">
          <div className="bg-brand-soft rounded-card p-7">
            <h2 className="text-lg font-semibold text-ink mb-3">{copy.badgeTitle}</h2>
            <p className="text-ink-muted leading-relaxed mb-4">{copy.badgeMeans}</p>
            <p className="text-ink-muted mb-2">{copy.badgeNotIntro}</p>
            <ul className="space-y-1.5 list-disc pl-5 text-ink-muted">
              {copy.badgeNot.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* What we don't do */}
        <section className="mb-16">
          <SectionHeading>{copy.dontTitle}</SectionHeading>
          <div className="bg-surface border-2 border-amber-200 rounded-card p-7 mb-6">
            <p className="text-lg font-semibold text-ink mb-3">{copy.dontLead}</p>
            <p className="text-ink-muted leading-relaxed mb-4">{copy.dontBody}</p>
            <p className="text-ink-muted leading-relaxed">{copy.dontRecommend}</p>
          </div>

          <h3 className="text-lg font-semibold text-ink mb-4">{copy.howTitle}</h3>
          <ol className="space-y-5">
            {copy.howSteps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-brand-soft text-brand-strong text-sm font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <h4 className="font-semibold text-ink mb-1">{step.title}</h4>
                  <p className="text-sm text-ink-muted leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-6 text-sm text-ink-muted">
            <ExternalLink href={LINKS.ftcGuide}>{copy.ftcLinkLabel}</ExternalLink>
          </p>

          <div className="mt-8 bg-warm rounded-card p-6">
            <h3 className="font-semibold text-ink mb-2">{copy.caregiverCheckTitle}</h3>
            <p className="text-sm text-ink-muted leading-relaxed">{copy.caregiverCheckBody}</p>
          </div>
        </section>

        {/* Employer duties, widest scope first: federal, then state, then DC.
            Read top-down it answers "what is true for me?" before "what is
            true here?", which is the right order for a reader who is not in
            the District. */}

        {/* Layer 1 — federal, true everywhere */}
        <section className="mb-16">
          <SectionHeading>{copy.federalTitle}</SectionHeading>
          <p className="text-ink-muted leading-relaxed mb-5">{copy.federalLead}</p>
          <ul className="space-y-3 list-disc pl-5 text-ink-muted leading-relaxed mb-5">
            {copy.federalPoints.map(point => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="text-ink-muted leading-relaxed mb-6">{copy.federalWageNote}</p>

          <div className="flex flex-col gap-2 text-sm mb-8">
            <ExternalLink href={LINKS.dolPrivateHome}>
              US Department of Labor — Private homes and domestic service employment
            </ExternalLink>
            <ExternalLink href={LINKS.dolRecordkeeping}>
              US Department of Labor — Recordkeeping for households who employ domestic workers
            </ExternalLink>
            <ExternalLink href={LINKS.dolStateMinimumWage}>
              US Department of Labor — State minimum wage laws
            </ExternalLink>
          </div>

          <div className="bg-surface rounded-card p-7 border border-line">
            <h3 className="font-semibold text-ink mb-2">{copy.federalContractTitle}</h3>
            <p className="text-sm text-ink-muted leading-relaxed mb-5">
              {copy.federalContractBody}
            </p>
            <p className="text-sm">
              <ExternalLink href={LINKS.ndwaFairContracts}>
                Fair contracts for domestic work — a guide for workers and employers
              </ExternalLink>
            </p>
          </div>
        </section>

        {/* Layer 2 — state and city */}
        <section className="mb-16">
          <SectionHeading>{copy.stateTitle}</SectionHeading>
          <p className="text-ink-muted leading-relaxed mb-5">{copy.stateLead}</p>
          <p className="text-ink-muted leading-relaxed mb-6">{copy.stateBody}</p>
          <p className="text-sm">
            <ExternalLink href={LINKS.ndwaStateList}>{copy.stateLinkLabel}</ExternalLink>
          </p>
        </section>

        {/* The offer. The agreement is the family's and the caregiver's; we
            only draft it when asked. Jurisdiction is deliberately demoted to
            the two footnote lines at the bottom. */}
        <section className="mb-16">
          <SectionHeading>{copy.agreementTitle}</SectionHeading>
          <p className="text-ink-muted leading-relaxed mb-5">{copy.agreementLead}</p>
          <p className="text-ink-muted leading-relaxed mb-8">{copy.agreementRevisit}</p>

          <ContactEmail
            subject={copy.agreementSubject}
            cta={copy.agreementCta}
            label={copy.agreementEmailLabel}
          />

          <div className="mt-10 pt-6 border-t border-line">
            <h3 className="text-sm font-semibold text-ink mb-3">{copy.footnotesTitle}</h3>
            <ol className="space-y-3 list-decimal pl-5 text-sm text-ink-muted leading-relaxed">
              <li>
                {copy.footnoteDc}{' '}
                <ExternalLink href={LINKS.doesTemplate}>
                  {copy.footnoteDcLinkLabel}
                </ExternalLink>
              </li>
              <li>
                {copy.footnoteStates}{' '}
                <ExternalLink href={LINKS.ndwaStateList}>
                  {copy.footnoteStatesLinkLabel}
                </ExternalLink>
              </li>
            </ol>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="mb-16">
          <div className="border border-line-strong rounded-card p-6">
            <h2 className="font-semibold text-ink mb-2">{copy.disclaimerTitle}</h2>
            <p className="text-sm text-ink-muted leading-relaxed">{copy.disclaimerBody}</p>
          </div>
        </section>

        {/* Concierge — offered here because this page is where a family is
            weighing the limits of what we check. Not offered in dashboards. */}
        <section className="mb-16">
          <div className="bg-brand-soft rounded-card p-7">
            <h2 className="text-lg font-semibold text-ink mb-2">{copy.conciergeTitle}</h2>
            <p className="text-ink-muted leading-relaxed mb-5">{copy.conciergeBody}</p>
            <Link
              href="/concierge"
              className="inline-block bg-brand-gradient text-white px-6 py-3 rounded-control font-semibold"
            >
              {copy.conciergeCta} →
            </Link>
          </div>
        </section>

        {/* Report */}
        <section className="mb-12">
          <SectionHeading>{copy.reportTitle}</SectionHeading>
          <p className="text-ink-muted leading-relaxed mb-5">{copy.reportBody}</p>
          <ContactEmail
            subject={copy.reportSubject}
            cta={copy.reportCta}
            label={copy.emailUsLabel}
          />
        </section>

        <div className="pt-6 border-t border-line text-sm">
          <Link href="/" className="text-brand-strong hover:underline">
            ← Back to Ruah
          </Link>
        </div>
      </div>
    </div>
  )
}
