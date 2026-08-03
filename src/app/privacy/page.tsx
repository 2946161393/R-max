import type { Metadata } from 'next'
import Link from 'next/link'
import { Confirm, Key, LegalDoc, Points, type LegalSection } from '@/components/legal/LegalDoc'

export const metadata: Metadata = {
  title: 'Privacy Policy — Ruah',
  description:
    'What Ruah collects, why, who can see it, and what you can ask us to do about it. Draft, under legal review.',
}

const CONTACT_EMAIL = 'zijinwang168@gmail.com'

const sections: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are, and who this covers',
    body: (
      <>
        <p>
          Ruah is a two-sided marketplace based in Washington, DC. Families use
          it to find childcare. Caregivers use it to find work. An AI
          coordinator we call Ruah does the back-and-forth in between.
        </p>
        <p>
          This policy covers everyone who uses Ruah: families, caregivers, and
          visitors who never make an account. It explains what we collect, why
          we collect it, who can see it, and what you can ask us to do about
          it.
        </p>
        <p>
          The company behind Ruah is{' '}
          <Confirm>
            registered legal entity name, entity type, and business address
          </Confirm>
          , and the site is at <Confirm>the launch domain</Confirm>.
        </p>
        <p>
          Ruah accounts are for adults 18 and over. See section 4 for how we
          handle information about children.
        </p>
      </>
    ),
  },
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: (
      <>
        <p>
          <Key>From everyone with an account:</Key> your name, email address,
          the role you signed up as (family or caregiver), your ZIP code, and
          the city and state that ZIP code resolves to. Your password is
          handled by our authentication provider — we never see it.
        </p>
        <p>
          <Key>From families:</Key> the neighborhood or area where care would
          happen (for example, &ldquo;Northwest DC, near Tenleytown&rdquo;), how
          many children you have, and whatever you choose to write in your care
          request — schedule, budget, languages, routines, and any needs a
          caregiver should know about.
        </p>
        <p>
          <Key>From caregivers:</Key> your experience, languages, hourly rate,
          availability, service area, and bio. If you choose to get verified,
          we also collect a photo of a government-issued ID and a selfie. See
          section 6 — those are handled differently from everything else.
        </p>
        <p>
          <Key>From both sides, as you use Ruah:</Key> the messages sent through
          the platform, including the ones our AI coordinator drafts and sends
          on your behalf; your matches and their history — who was contacted,
          who accepted or declined, what was promised and by when; and the
          notes our team adds when we review something.
        </p>
        <p>
          <Key>Automatically:</Key> sign-in activity, browser and device
          information, IP address, and basic usage data, used to keep your
          account secure and the service working.
        </p>
        <p>
          <Key>Cookies:</Key> we use the cookies required to keep you signed in.{' '}
          <Confirm>
            whether any analytics or product-measurement cookies will be in
            place at launch — if yes, this section needs a cookie disclosure and
            possibly a banner
          </Confirm>
        </p>
      </>
    ),
  },
  {
    id: 'where-you-are',
    title: 'Your address and location',
    body: (
      <>
        <p>
          Care happens in your home, so location matters more here than on most
          sites. Here is exactly how much of it we hold.
        </p>
        <Points>
          <li>
            <Key>What your profile stores:</Key> a ZIP code and a free-text
            neighborhood description. We do not ask for, or store, your street
            address as part of your profile.
          </li>
          <li>
            <Key>What caregivers see:</Key> the neighborhood and area
            information on your request — enough to know whether the job is
            reachable.
          </li>
          <li>
            <Key>Your full address:</Key> if you share it, you share it
            yourself, in a message, when you have decided to move forward. It
            then lives in that message thread. Please share it when you are
            ready and not before.
          </li>
          <li>
            <Key>A third party sees your ZIP code:</Key> to turn a ZIP code into
            a city and state, we send it to a public postal-code lookup service
            (zippopotam.us). We send the ZIP code only — no name, no account,
            nothing that identifies you.
          </li>
        </Points>
        <p>
          <Confirm>
            whether the zippopotam.us lookup should be replaced with a local
            lookup table before launch, which would remove this third party
            entirely
          </Confirm>
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Information about children',
    body: (
      <>
        <p>
          Children do not use Ruah. Only adults create accounts, and the service
          is not directed to children. Parents and guardians provide information
          about their children so that a caregiver can understand the job.
        </p>
        <Points>
          <li>
            <Key>You decide how much to share.</Key> The only structured field
            we ask for is how many children you have. Everything else — ages,
            names, allergies, medical needs, school schedules, routines — is
            optional free text that you write into your request or a message.
          </li>
          <li>
            <Key>Share what a caregiver needs to do the job well</Key>, and no
            more. You can always tell a caregiver more once you have decided to
            work with them.
          </li>
          <li>
            <Key>Who can see it:</Key> you, the caregivers matched to your
            request, and authorized members of the Ruah team. Our AI coordinator
            reads your request in order to describe the job to caregivers.
          </li>
          <li>
            <Key>What we never do:</Key> we do not use information about your
            children for advertising, we do not sell it, and we do not share it
            with anyone outside the people listed above.
          </li>
          <li>
            You can ask us to delete it at any time — see section 12.
          </li>
        </Points>
        <p>
          <Confirm>
            counsel to confirm the COPPA position. Our reading: because children
            neither create accounts nor provide information themselves, the
            federal rules on collecting information online from children under
            13 are not triggered — a parent is describing their own household.
            This needs to be checked, not assumed.
          </Confirm>
        </p>
      </>
    ),
  },
  {
    id: 'ai-coordinator',
    title: 'The Ruah AI coordinator',
    body: (
      <>
        <p>
          Ruah is not just a search box. An AI coordinator works your request:
          it reads what you need, contacts caregivers, follows up when they go
          quiet, records what they commit to, and reports back to you. This is
          the part of the product most people have questions about, so here is
          how it handles your information.
        </p>
        <Points>
          <li>
            <Key>It sends messages on your behalf.</Key> Those messages are
            labeled as coming from Ruah, so nobody is misled into thinking a
            person typed them.
          </li>
          <li>
            <Key>What it can read:</Key> your care request, your profile, the
            caregivers matched to you, and the message history on those matches.
          </li>
          <li>
            <Key>It uses a third-party AI provider.</Key> To generate a message,
            we send the relevant parts of your request and the conversation to
            Anthropic&rsquo;s Claude API. Anthropic processes that content on
            our behalf in order to return a response.{' '}
            <Confirm>
              current Anthropic API terms and data-processing addendum, and
              state plainly here whether API content is used to train models —
              do not paraphrase from memory
            </Confirm>
          </li>
          <li>
            <Key>Every action is logged.</Key> Each decision the coordinator
            makes — including the ones our safeguards block — is written to an
            audit record so we can check what it did and why.
          </li>
          <li>
            <Key>People can read it.</Key> Authorized members of our team can
            review AI conversations for safety and quality.
          </li>
          <li>
            <Confirm>
              whether users can turn the AI coordinator off and still use Ruah,
              and if so where that switch lives. Today there is no opt-out, and
              this policy should say so rather than imply one exists.
            </Confirm>
          </li>
        </Points>
      </>
    ),
  },
  {
    id: 'identity-documents',
    title: 'Caregiver identity documents',
    body: (
      <>
        <p>
          If a caregiver chooses to get verified, they upload a government-issued
          ID and a selfie. These are the most sensitive files on the platform
          and they are handled separately from everything else.
        </p>
        <Points>
          <li>
            They are stored in a private, access-restricted location, not
            alongside public profile information.
          </li>
          <li>
            Only authorized members of the Ruah team can open them, and only to
            confirm that the person is who they say they are.
          </li>
          <li>
            <Key>Families never see them.</Key> Neither do other caregivers.
            What a family sees is a verified badge, not a document.
          </li>
          <li>They are never used for advertising and never sold.</li>
          <li>
            You can ask us to delete them at any time. Doing so removes your
            verified status.
          </li>
        </Points>
        <p>
          <Confirm>
            how long verification documents are retained after a decision is
            made. The honest options are to delete on approval and keep only the
            outcome, or to retain for a fixed period for fraud and safety
            review. Pick one and state the period here.
          </Confirm>
        </p>
        <p>
          Separately, <Key>profile photos are public.</Key> If you upload a
          profile photo, it is served from a public web address and can be
          viewed by anyone who has that address. Do not use a photo you would
          not want seen outside Ruah.
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use',
    title: 'How we use your information',
    body: (
      <>
        <Points>
          <li>To match families with caregivers, and to keep those matches moving.</li>
          <li>
            To let the AI coordinator contact caregivers, follow up, and report
            back to you.
          </li>
          <li>To review caregiver identity documents and issue verified status.</li>
          <li>
            To keep the platform safe: investigating reports, preventing fraud
            and abuse, and enforcing our{' '}
            <Link href="/terms" className="text-brand-strong hover:underline">
              Terms of Service
            </Link>
            .
          </li>
          <li>
            To send you service messages — a new match, a reply, an account or
            security notice.
          </li>
          <li>To fix problems and improve how the service works.</li>
          <li>To meet legal obligations.</li>
        </Points>
        <p>
          <Confirm>
            whether marketing email to users is planned. If yes, this section
            needs a separate line and an unsubscribe commitment; if no, say so
            explicitly.
          </Confirm>
        </p>
      </>
    ),
  },
  {
    id: 'how-we-share',
    title: 'Who else sees your information',
    body: (
      <>
        <p>
          <Key>Between users.</Key> This is the point of the service. When a
          caregiver is matched to your request, they see your first name, your
          neighborhood, and the details of the request. When you look at a
          caregiver, you see their profile and whether they are verified.
          Anything beyond that is what you choose to write in a message.
        </p>
        <p>
          <Key>Companies that run parts of the service for us.</Key> They may
          only process your information to provide their service to us, under
          contract:
        </p>
        <Points>
          <li>
            <Key>Supabase</Key> — database, sign-in, and file storage, including
            identity documents.
          </li>
          <li>
            <Key>Vercel</Key> — website hosting.
          </li>
          <li>
            <Key>Anthropic</Key> — the AI model behind the coordinator (see
            section 5).
          </li>
          <li>
            <Key>zippopotam.us</Key> — turning a ZIP code into a city and state
            (see section 3).
          </li>
          <li>
            <Confirm>
              email delivery provider, error monitoring, and analytics, once
              chosen. Every processor with access to personal data belongs on
              this list.
            </Confirm>
          </li>
        </Points>
        <p>
          <Key>For legal or safety reasons.</Key> We may disclose information if
          the law requires it, or if we believe in good faith that it is
          necessary to protect someone from harm.
        </p>
        <p>
          <Key>If the business changes hands.</Key> If Ruah is acquired or
          merged, information may transfer as part of that deal. We would tell
          you before your information became subject to a different policy.
        </p>
        <p>
          <Key>We do not sell your personal information</Key>, and we do not
          share it for cross-context behavioral advertising.
        </p>
      </>
    ),
  },
  {
    id: 'payments',
    title: 'Payments',
    body: (
      <>
        <p>
          <Key>Ruah does not process payments today.</Key> We do not collect card
          numbers, bank details, or tax identification numbers. Families and
          caregivers agree on pay and settle it directly between themselves.
        </p>
        <p>
          If we add payments, this policy will change before that happens, and
          we will tell you.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep things',
    body: (
      <>
        <p>
          While your account is open, we keep your information so the service
          works. When you close your account, we delete or anonymize your
          personal information, except where we need to keep something for legal
          or safety reasons.
        </p>
        <p>
          <Confirm>
            specific retention periods, which counsel will want stated rather
            than implied. At minimum: how long after account closure profile
            data is deleted; how long message threads survive a closed account,
            given that a thread has two participants and one may still need it;
            how long identity documents are kept (section 6); how long AI
            decision logs are kept; and how long backups persist after a
            deletion request.
          </Confirm>
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'How we protect it',
    body: (
      <>
        <p>
          We use access controls, encrypted connections, and restricted storage
          for sensitive files. Identity documents sit behind stricter controls
          than the rest of the platform, and administrative access is limited to
          a named list of people.
        </p>
        <p>
          No system is perfectly secure, and we would rather say that plainly
          than promise otherwise. If a breach affects your information, we will
          notify you as required by law.
        </p>
        <p>
          <Confirm>
            breach-notification obligations that apply to us, including the DC
            statute and any other state where we have users, and the timeline
            each requires.
          </Confirm>
        </p>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your choices and your rights',
    body: (
      <>
        <p>Whoever and wherever you are, you can ask us to:</p>
        <Points>
          <li>show you the information we hold about you;</li>
          <li>correct anything that is wrong;</li>
          <li>delete your information, or close your account entirely;</li>
          <li>delete your identity verification documents specifically.</li>
        </Points>
        <p>
          To do any of these, email us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-strong hover:underline">
            {CONTACT_EMAIL}
          </a>
          . We will respond within a reasonable time and will not charge you for
          it.
        </p>
        <p>
          Some states give residents additional rights — California, Virginia,
          Colorado, Connecticut and others have comprehensive privacy laws.
          Because we do not sell personal information or use it for targeted
          advertising, the opt-outs those laws provide have nothing to switch
          off here.
        </p>
        <p>
          <Confirm>
            which state privacy laws actually apply to us given our size and
            user counts, and whether the District of Columbia has enacted a
            comprehensive consumer privacy statute by the effective date. Where
            a law applies, counsel should add the specific rights language and
            appeal process it requires rather than relying on this general
            paragraph.
          </Confirm>
        </p>
      </>
    ),
  },
  {
    id: 'where-data-lives',
    title: 'Where your information is held',
    body: (
      <>
        <p>
          Ruah is operated from Washington, DC, and your information is stored
          and processed in the United States.
        </p>
        <p>
          <Confirm>
            the hosting regions for our database, file storage, and AI provider,
            and whether we intend to serve users outside the United States. If
            we do, this policy needs a transfers section and counsel needs to
            look at GDPR and UK data protection law. Today the service is
            offered in the DC area only.
          </Confirm>
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <>
        <p>
          We will update this policy as the product changes — adding payments
          and changing what the AI coordinator can do are both likely. When we
          make a meaningful change, we will update the date at the top and tell
          you through the platform before it takes effect.
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: (
      <>
        <p>
          Questions about this policy, or about anything we hold on you, go to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-strong hover:underline">
            {CONTACT_EMAIL}
          </a>
          . A real person reads it.
        </p>
        <p>
          <Confirm>
            a dedicated privacy contact address and a postal address. A personal
            Gmail account is fine for a draft and not fine on a published
            policy. Verify the spelling of this address before launch.
          </Confirm>
        </p>
      </>
    ),
  },
]

export default function PrivacyPolicyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      lastUpdated="August 2, 2026"
      summary={
        <>
          <p>
            We collect what we need to match your family with a caregiver, and
            to let our AI coordinator handle the back-and-forth for you.
          </p>
          <p>
            Caregiver identity documents are stored privately and are never
            shown to families. Your street address is never required — you share
            it yourself, when you are ready.
          </p>
          <p>
            We do not process payments, and we do not sell your information.
          </p>
          <p>
            You can ask us to delete anything we hold, including your whole
            account.
          </p>
        </>
      }
      sections={sections}
    />
  )
}
