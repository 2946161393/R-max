import type { Metadata } from 'next'
import Link from 'next/link'
import CalEmbed from './CalEmbed'
import ContactEmail from '@/components/ContactEmail'

/* Ruah Team concierge booking.

   Voice rule: the call is with "the Ruah Team", never "the founder". It is a
   family talking to a real person on the team, not a meeting with the founder,
   and it matches the Cal.com event ("Talk with the Ruah Team"). Keep the first
   person plural — we listen, we reach out — so no single person is promised.

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
    'Book 30 minutes with the Ruah Team. We will understand your family’s needs and personally coordinate your first match.',
}

/* ─────────────────────────────────────────────────────────────────────────
   Live Cal.com booking link — the "Talk with the Ruah team" 30-minute event.

   Set it back to null to take booking offline; the page then renders the
   clearly-marked placeholder below instead of an embed, so nothing pretends
   to be bookable.

   The embed itself lives in CalEmbed.tsx — see the note there on why Cal.com
   cannot be framed with a plain <iframe>.

   If the event's duration changes on Cal.com, update the copy strings below
   to match — the page states the length in five places.
   ───────────────────────────────────────────────────────────────────────── */
const CAL_BOOKING_URL: string | null = 'https://cal.com/ruah-team/talk-with-the-ruah-team'

/* Cal.com's embed addresses events by `team/event` slug, not by URL. Derived so
   the link above stays the single source of truth. */
const calLink = CAL_BOOKING_URL
  ? new URL(CAL_BOOKING_URL).pathname.replace(/^\/+/, '')
  : null

const copy = {
  eyebrow: 'Concierge',
  title: 'Prefer to start with a human?',
  lede: 'Book 30 minutes with the Ruah Team. A real person will understand your family’s needs and personally coordinate your first match.',

  whatYouGetTitle: 'What the 30 minutes covers',
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
      body: 'We reach out to caregivers on your behalf and stay with it until you have someone to meet.',
    },
  ],

  whoTitle: 'This is not a support line',
  whoBody:
    'It is a slower, more personal way to begin — for families who would rather explain their situation to someone than fill in a form. If you already have an account and need help with something, email us instead and we will get to it.',
  whoEmailLabel: 'Email us instead',

  bookTitle: 'Book your 30 minutes',
  bookNote: 'Free, no obligation, and there is nothing to buy at the end of it.',

  placeholderTitle: 'Booking opens shortly',
  placeholderBody:
    'The scheduling link is being set up. In the meantime, email us directly and you will get the same 30 minutes.',
  placeholderCta: 'Email the Ruah Team',
  placeholderSubject: 'Booking 30 minutes with Ruah',
  emailUsLabel: 'Or email us',
  placeholderDevNote:
    'Developer note: set CAL_BOOKING_URL in src/app/concierge/page.tsx to replace this block with the live booking embed.',

  bookFallback: 'Or open the booking page in a new tab',

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

          {CAL_BOOKING_URL && calLink ? (
            <CalEmbed
              calLink={calLink}
              bookingUrl={CAL_BOOKING_URL}
              fallbackLabel={copy.bookFallback}
            />
          ) : (
            <div className="bg-surface rounded-card border-2 border-dashed border-line-strong p-8 text-center">
              <div className="text-3xl mb-4" aria-hidden="true">
                🗓
              </div>
              <h3 className="font-semibold text-ink mb-2">{copy.placeholderTitle}</h3>
              <p className="text-sm text-ink-muted leading-relaxed max-w-md mx-auto mb-6">
                {copy.placeholderBody}
              </p>
              <ContactEmail
                subject={copy.placeholderSubject}
                cta={copy.placeholderCta}
                label={copy.emailUsLabel}
              />
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
            <p className="text-sm text-ink-muted">
              <ContactEmail label={copy.whoEmailLabel} />
            </p>
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
