import type { Metadata } from 'next'
import Link from 'next/link'

/* Founder concierge booking.

   Framing rule: this is a premium way to START, not a support channel. It is
   offered to visitors who have not committed yet — the landing hero and the
   Trust & Safety page. It is deliberately absent from the dashboards, where it
   would read as "contact support" to people who already signed up.

   Bilingual readiness: every user-visible string is in the `copy` object as a
   complete sentence. To add Chinese, copy the object, translate the values,
   and select on locale — no JSX below changes. */

export const metadata: Metadata = {
  title: 'Talk to a real person — Ruah',
  description:
    'Book 20 minutes with our founder. We will understand your family’s needs and personally coordinate your first match.',
}

/* ─────────────────────────────────────────────────────────────────────────
   PLACEHOLDER — replace with the real Cal.com booking link.

   Set this to the founder's Cal.com URL, for example:
     const CAL_BOOKING_URL: string | null = 'https://cal.com/zijin/20min'

   While it is null the page renders a clearly-marked placeholder instead of
   an embed, so nothing pretends to be bookable before the account exists.
   The embed is a plain iframe on purpose — no Cal.com npm package, no
   third-party script tag, no new dependency.
   ───────────────────────────────────────────────────────────────────────── */
const CAL_BOOKING_URL: string | null = null

const CONTACT_EMAIL = 'zijinwang168@gmail.com'

const copy = {
  eyebrow: 'Concierge',
  title: 'Prefer to start with a human?',
  lede: 'Book 20 minutes with our founder. We will understand your family’s needs and personally coordinate your first match.',

  whatYouGetTitle: 'What the 20 minutes covers',
  whatYouGet: [
    {
      emoji: '👂',
      title: 'We listen first',
      body: 'Your schedule, your children, the languages spoken at home, and what has not worked before. No form can hold this part.',
    },
    {
      emoji: '🎯',
      title: 'We shape the search with you',
      body: 'Together we decide what actually matters in a caregiver for your family, and what you are willing to trade away.',
    },
    {
      emoji: '🤝',
      title: 'We coordinate your first match personally',
      body: 'The founder reaches out to caregivers on your behalf and stays with it until you have someone to meet.',
    },
  ],

  whoTitle: 'This is not a support line',
  whoBody:
    'It is a slower, more personal way to begin — for families who would rather explain their situation to someone than fill in a form. If you already have an account and need help with something, email us instead and we will get to it.',
  whoEmailLabel: 'Email us instead',

  bookTitle: 'Book your 20 minutes',
  bookNote: 'Free, no obligation, and there is nothing to buy at the end of it.',

  placeholderTitle: 'Booking opens shortly',
  placeholderBody:
    'The scheduling link is being set up. In the meantime, email the founder directly and you will get the same 20 minutes.',
  placeholderCta: 'Email the founder',
  placeholderDevNote:
    'Developer note: set CAL_BOOKING_URL in src/app/concierge/page.tsx to replace this block with the live booking embed.',

  selfServeTitle: 'Or start on your own',
  selfServeBody:
    'Most families never need this call. Posting a request takes a few minutes and Ruah starts reaching out to caregivers straight away.',
  selfServeCta: 'Find care for my family',
}

export default function ConciergePage() {
  return (
    <div className="min-h-screen bg-brand-wash">
      <header className="bg-surface border-b border-line px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <img src="/ruah-logo.png" alt="" className="w-7 h-7" />
            <span className="font-bold text-brand">Ruah！</span>
          </Link>
          <span className="text-ink-faint" aria-hidden="true">
            /
          </span>
          <span className="text-sm font-semibold text-ink">{copy.eyebrow}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-14">
        <div className="inline-flex items-center gap-2 bg-brand-soft text-brand-strong text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          ✨ {copy.eyebrow}
        </div>
        <h1 className="text-4xl font-bold text-ink mb-4 leading-tight">{copy.title}</h1>
        <p className="text-lg text-ink-muted leading-relaxed mb-14 max-w-2xl">{copy.lede}</p>

        {/* What the call covers */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-ink mb-6">{copy.whatYouGetTitle}</h2>
          <div className="space-y-4">
            {copy.whatYouGet.map(item => (
              <div
                key={item.title}
                className="bg-surface rounded-card p-6 border border-line flex gap-4"
              >
                <div className="text-2xl shrink-0" aria-hidden="true">
                  {item.emoji}
                </div>
                <div>
                  <h3 className="font-semibold text-ink mb-1">{item.title}</h3>
                  <p className="text-sm text-ink-muted leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Booking */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-ink mb-2">{copy.bookTitle}</h2>
          <p className="text-sm text-ink-muted mb-6">{copy.bookNote}</p>

          {CAL_BOOKING_URL ? (
            <div className="bg-surface rounded-card border border-line overflow-hidden">
              <iframe
                src={CAL_BOOKING_URL}
                title={copy.bookTitle}
                className="w-full h-[42rem] border-0"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="bg-surface rounded-card border-2 border-dashed border-line-strong p-8 text-center">
              <div className="text-3xl mb-4" aria-hidden="true">
                🗓
              </div>
              <h3 className="font-semibold text-ink mb-2">{copy.placeholderTitle}</h3>
              <p className="text-sm text-ink-muted leading-relaxed max-w-md mx-auto mb-6">
                {copy.placeholderBody}
              </p>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Booking 20 minutes with Ruah')}`}
                className="inline-block bg-brand-gradient text-white px-6 py-3 rounded-control font-semibold"
              >
                {copy.placeholderCta}
              </a>
              <p className="text-xs text-ink-faint mt-6 max-w-md mx-auto">
                {copy.placeholderDevNote}
              </p>
            </div>
          )}
        </section>

        {/* Not support */}
        <section className="mb-16">
          <div className="bg-warm rounded-card p-6">
            <h2 className="font-semibold text-ink mb-2">{copy.whoTitle}</h2>
            <p className="text-sm text-ink-muted leading-relaxed mb-3">{copy.whoBody}</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sm text-brand-strong font-medium hover:underline"
            >
              {copy.whoEmailLabel} →
            </a>
          </div>
        </section>

        {/* Self-serve alternative */}
        <section>
          <div className="border-t border-line pt-8">
            <h2 className="font-semibold text-ink mb-2">{copy.selfServeTitle}</h2>
            <p className="text-sm text-ink-muted leading-relaxed mb-5 max-w-xl">
              {copy.selfServeBody}
            </p>
            <Link
              href="/onboarding/family"
              className="inline-block border-2 border-line-strong text-ink-muted px-6 py-3 rounded-control font-semibold hover:border-brand hover:text-brand transition"
            >
              {copy.selfServeCta} →
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
