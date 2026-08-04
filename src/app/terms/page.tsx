import type { Metadata } from 'next'
import Link from 'next/link'
import { Confirm, Key, LegalDoc, Points, type LegalSection } from '@/components/legal/LegalDoc'
import ContactEmail from '@/components/ContactEmail'

export const metadata: Metadata = {
  title: 'Terms of Service — Ruah',
  description:
    'The rules for using Ruah: what we do, what we do not do, and what each side is responsible for. Draft, under legal review.',
}

const DOES_URL = 'https://does.dc.gov'

const sections: LegalSection[] = [
  {
    id: 'agreement',
    title: 'This agreement',
    body: (
      <>
        <p>
          These terms are the agreement between you and{' '}
          <Confirm>registered legal entity name and business address</Confirm>{' '}
          (&ldquo;Ruah&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) covering your
          use of the Ruah website and service. By making an account or using
          Ruah, you agree to them.
        </p>
        <p>
          Our{' '}
          <Link href="/privacy" className="text-brand-strong hover:underline">
            Privacy Policy
          </Link>{' '}
          explains what we do with your information and is part of this
          agreement.
        </p>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'Who can use Ruah',
    body: (
      <>
        <Points>
          <li>You must be 18 or older.</li>
          <li>
            You must be able to enter into a contract, and not barred from doing
            so under any applicable law.
          </li>
          <li>
            You must give accurate information about yourself and keep it
            current.
          </li>
          <li>
            Ruah currently serves the Washington, DC area. We may decline or
            close accounts outside the areas we serve.
          </li>
          <li>
            If we have previously removed you from Ruah, you may not make a new
            account.
          </li>
        </Points>
      </>
    ),
  },
  {
    id: 'what-ruah-is',
    title: 'What Ruah is — and what it is not',
    body: (
      <>
        <p>
          <Key>Ruah is an introduction service.</Key> We help families and
          caregivers find each other, and our AI coordinator carries the
          messages back and forth so neither side has to chase the other. That
          is the whole of what we do.
        </p>
        <p>Specifically, we want to be clear about what we are not:</p>
        <Points>
          <li>
            <Key>We are not an employment agency, staffing agency, or nanny
            agency.</Key> We do not place workers and we do not hire on your
            behalf.
          </li>
          <li>
            <Key>We do not employ caregivers.</Key> Caregivers you find on Ruah
            are not our employees, contractors, or agents. If you hire someone,
            the working relationship is between you and them.
          </li>
          <li>
            <Key>We do not supervise, direct, or monitor care.</Key> We are not
            present in your home and we do not control how work is performed.
          </li>
          <li>
            <Key>We do not run background checks.</Key> See section 8 for what
            our verification does and does not cover, and{' '}
            <Link href="/trust" className="text-brand-strong hover:underline">
              Trust &amp; Safety
            </Link>{' '}
            for how to arrange your own.
          </li>
          <li>
            <Key>We do not give legal, tax, employment, or immigration
            advice.</Key> Anything we publish about household employment rules
            is general information to point you in the right direction, not
            advice about your situation.
          </li>
          <li>
            <Key>We do not guarantee outcomes.</Key> We cannot promise you will
            find a caregiver, find a job, or that any match will work out.
          </li>
        </Points>
        <p>
          Deciding who to let into your home, and deciding whose home to work
          in, is your decision. We can make the introduction and do the
          legwork; we cannot make that judgment for you.
        </p>
      </>
    ),
  },
  {
    id: 'your-account',
    title: 'Your account',
    body: (
      <>
        <Points>
          <li>Keep your sign-in details to yourself, and tell us if they are compromised.</li>
          <li>One account per person. Do not create an account for someone else or pretend to be someone you are not.</li>
          <li>You are responsible for what happens under your account.</li>
          <li>You can close your account at any time — see section 12.</li>
        </Points>
      </>
    ),
  },
  {
    id: 'families',
    title: 'If you are a family hiring a caregiver',
    body: (
      <>
        <p>
          When you hire someone to work in your home, you are very likely their
          household employer, with the legal obligations that come with it. Ruah
          does not take those on for you. Before and after you hire, these are
          yours:
        </p>
        <Points>
          <li>
            <Key>Do your own due diligence.</Key> Interview, check references,
            and arrange a background check if you want one. Our verification is
            not a substitute — see section 8.
          </li>
          <li>
            <Key>Put it in writing.</Key> The District of Columbia&rsquo;s
            Domestic Worker Employment Rights Act requires household employers
            to give domestic workers a written contract, and requires it in the
            worker&rsquo;s preferred language. The DC Department of Employment
            Services publishes an official template at{' '}
            <a
              href={DOES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-strong hover:underline"
            >
              does.dc.gov
            </a>
            . Our{' '}
            <Link href="/trust" className="text-brand-strong hover:underline">
              Trust &amp; Safety
            </Link>{' '}
            page walks through what the law asks for.
          </li>
          <li>
            <Key>Pay lawfully.</Key> Minimum wage, overtime, paid leave, pay
            records, and household employment taxes are your responsibility.
          </li>
          <li>
            <Key>Check your insurance.</Key> Whether you need workers&rsquo;
            compensation or additional homeowner coverage depends on your
            situation — ask your insurer.
          </li>
          <li>
            <Key>Provide a safe workplace</Key> and treat the person working in
            your home lawfully and decently.
          </li>
        </Points>
        <p>
          <Confirm>
            counsel to confirm this section states the DC Domestic Worker
            Employment Rights Act obligations accurately, including who counts
            as a covered employer, and whether Ruah has any notice duty of its
            own as a platform that introduces the parties.
          </Confirm>
        </p>
      </>
    ),
  },
  {
    id: 'caregivers',
    title: 'If you are a caregiver',
    body: (
      <>
        <Points>
          <li>
            <Key>Tell the truth</Key> about your experience, certifications,
            languages, and availability. Families are relying on it.
          </li>
          <li>
            <Key>You must be legally allowed to work</Key> in the United States,
            and you are responsible for holding any license or certification
            your work requires.
          </li>
          <li>
            <Key>Your work agreement is with the family</Key>, not with Ruah.
            Pay, hours, duties, and time off are between you and them. You are
            entitled to that agreement in writing, in the language you prefer —
            see section 5.
          </li>
          <li>
            <Key>Identity documents you upload</Key> are used only to verify who
            you are. They are never shown to families. See our{' '}
            <Link href="/privacy" className="text-brand-strong hover:underline">
              Privacy Policy
            </Link>
            .
          </li>
          <li>
            <Key>You choose which jobs to take.</Key> Nothing on Ruah obliges you
            to accept a match, and declining one does not count against you.
          </li>
        </Points>
      </>
    ),
  },
  {
    id: 'ai-coordinator',
    title: 'The AI coordinator acts on your behalf',
    body: (
      <>
        <p>
          Ruah&rsquo;s coordinator is software that sends messages for you. By
          using Ruah, you authorize it to contact caregivers or families about
          your matches, follow up when someone goes quiet, record what people
          commit to, and report back to you. What that means in practice:
        </p>
        <Points>
          <li>
            <Key>Its messages are labeled as coming from Ruah</Key>, so nobody
            is misled into thinking a person typed them.
          </li>
          <li>
            <Key>Commitments it records are real commitments.</Key> If it notes
            that you will reply by Thursday, the other side will be told
            Thursday, and it will follow up.
          </li>
          <li>
            <Key>It can be wrong.</Key> It is an AI system and it makes
            mistakes. Read what it tells you before acting on it, and check
            anything that matters — dates, rates, addresses — directly with the
            other person.
          </li>
          <li>
            <Key>You remain responsible</Key> for arrangements you make, whether
            you typed the message yourself or the coordinator sent it for you.
            If it gets something wrong on your behalf, tell us and tell the
            other side.
          </li>
        </Points>
        <p>
          <Confirm>
            whether a user can decline the AI coordinator and still use Ruah. If
            not, counsel should confirm that consent to automated messaging in
            the user&rsquo;s name is adequately obtained at sign-up rather than
            only here.
          </Confirm>
        </p>
      </>
    ),
  },
  {
    id: 'verification',
    title: 'Verification, and what it does not mean',
    body: (
      <>
        <p>
          A verified badge on a caregiver means one thing:{' '}
          <Key>
            a member of our team looked at a government-issued ID and a selfie
            and concluded the person is who they say they are.
          </Key>
        </p>
        <p>It is not:</p>
        <Points>
          <li>a criminal background check;</li>
          <li>a check of driving, child-abuse, or sex-offender registries;</li>
          <li>a verification of references, employment history, or certifications;</li>
          <li>an endorsement, recommendation, or guarantee of anyone&rsquo;s character, skill, or fitness to care for your children.</li>
        </Points>
        <p>
          Please read{' '}
          <Link href="/trust" className="text-brand-strong hover:underline">
            Trust &amp; Safety
          </Link>{' '}
          before you hire. It explains what we check, what we do not, and how to
          arrange a background check yourself.
        </p>
      </>
    ),
  },
  {
    id: 'payment',
    title: 'Payment',
    body: (
      <>
        <p>
          <Key>Ruah does not process payments and charges no fees today.</Key>{' '}
          Families and caregivers agree on pay and settle it directly. We are not
          a party to that arrangement, we do not hold funds, and we cannot
          recover money for you if something goes wrong.
        </p>
        <p>
          <Confirm>
            the fee model at launch. If Ruah will ever charge a fee, take a
            commission, or process payments, this section needs terms for
            pricing, refunds, cancellations, and chargebacks written before that
            launches — not after.
          </Confirm>
        </p>
      </>
    ),
  },
  {
    id: 'your-content',
    title: 'What you post',
    body: (
      <>
        <p>
          Your profile, requests, messages, and photos stay yours. You give us
          permission to store them and show them to the people on the platform
          who need to see them, so the service can work. That permission ends
          when you delete the content or close your account, except for copies
          we must keep for legal or safety reasons.
        </p>
        <p>
          Only post what you have the right to post, and keep it accurate. We may
          remove content that breaks these terms.
        </p>
      </>
    ),
  },
  {
    id: 'prohibited',
    title: 'Things you may not do',
    body: (
      <>
        <Points>
          <li>Lie about who you are, your experience, or your circumstances.</li>
          <li>
            Harass, threaten, or discriminate against anyone. Discriminating on
            the basis of race, color, religion, national origin, sex, gender
            identity, sexual orientation, age, disability, familial status, or
            any other characteristic protected under DC or federal law is not
            allowed here.
          </li>
          <li>Use Ruah to arrange anything unlawful, or to endanger a child or a worker.</li>
          <li>Post someone else&rsquo;s personal information, or share what you learn on Ruah outside it.</li>
          <li>Scrape, copy, or bulk-collect profiles or listings.</li>
          <li>Attempt to break, probe, or work around the security of the service.</li>
          <li>Use the platform to advertise unrelated services or to spam other users.</li>
        </Points>
      </>
    ),
  },
  {
    id: 'termination',
    title: 'Suspending and closing accounts',
    body: (
      <>
        <p>
          You can close your account at any time by emailing <ContactEmail />.{' '}
          <Confirm>
            build self-service account deletion, or state plainly that deletion
            is by email request only.
          </Confirm>
        </p>
        <p>
          We can suspend or close an account that breaks these terms, or where we
          believe someone&rsquo;s safety is at risk. Where it is reasonable and
          safe to do so, we will tell you why and give you a chance to respond.
          The sections that are meant to outlast the account — content
          permissions we still need, disclaimers, liability limits, and disputes
          — survive closure.
        </p>
      </>
    ),
  },
  {
    id: 'disclaimers',
    title: 'No warranties',
    body: (
      <>
        <p>
          Ruah is provided as it is. We do not promise the service will be
          uninterrupted, error-free, or that the AI coordinator will always get
          things right.
        </p>
        <p>
          <Key>
            We do not vouch for any family or caregiver on the platform.
          </Key>{' '}
          We do not verify anything beyond what section 8 describes, and we make
          no promise about anyone&rsquo;s conduct, honesty, skill, or safety.
          Interactions between users are between those users.
        </p>
        <p>
          To the extent the law allows, we disclaim implied warranties of
          merchantability, fitness for a particular purpose, and
          non-infringement. Some places do not allow that, in which case this
          section applies as far as it can.
        </p>
      </>
    ),
  },
  {
    id: 'liability',
    title: 'Limits on our liability',
    body: (
      <>
        <p>
          To the extent the law allows, Ruah is not liable for indirect,
          incidental, special, or consequential damages, or for lost profits or
          lost opportunities, arising from your use of the service or from your
          dealings with another user.
        </p>
        <p>
          <Confirm>
            the liability cap and its carve-outs. This is the section counsel
            should spend the most time on, because it is the one that matters if
            something goes badly wrong in someone&rsquo;s home. It has been left
            unwritten rather than filled with a number we have not thought
            through.
          </Confirm>
        </p>
      </>
    ),
  },
  {
    id: 'indemnity',
    title: 'If someone brings a claim because of you',
    body: (
      <>
        <p>
          If a claim is brought against us because of how you used Ruah, what
          you posted, or your relationship with another user, you agree to cover
          our reasonable costs of dealing with it.
        </p>
        <p>
          <Confirm>
            scope of this indemnity, and whether it should be narrower for
            caregivers than for families given the difference in bargaining
            position.
          </Confirm>
        </p>
      </>
    ),
  },
  {
    id: 'disputes',
    title: 'Disputes and governing law',
    body: (
      <>
        <p>
          <Key>Disputes between users:</Key> if you have a problem with another
          user, it is between the two of you. Tell us anyway — we want to know
          about anything unsafe, and we will act on our side of it.
        </p>
        <p>
          <Key>Disputes with us:</Key> email us first. Most things can be sorted
          out that way.
        </p>
        <p>
          These terms are governed by the laws of the District of Columbia.
        </p>
        <p>
          <Confirm>
            how formal disputes are resolved: courts in the District of Columbia,
            or arbitration. If arbitration, counsel needs to decide on a class
            action waiver and whether to keep a small claims carve-out, and to
            confirm the clause is enforceable against consumers in DC. Nothing
            has been drafted here on purpose.
          </Confirm>
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <>
        <p>
          We will update these terms as the product changes. When a change is
          meaningful, we will update the date at the top and tell you through
          the platform before it takes effect. If you keep using Ruah after
          that, the new terms apply.
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
          Questions about these terms go to <ContactEmail />.
        </p>
        <p>
          <Confirm>
            a business contact address and postal address before publication.
          </Confirm>
        </p>
      </>
    ),
  },
]

export default function TermsOfServicePage() {
  return (
    <LegalDoc
      title="Terms of Service"
      lastUpdated="August 2, 2026"
      summary={
        <>
          <p>
            Ruah introduces families and caregivers and does the coordinating in
            between. We are not an employment agency, we do not employ
            caregivers, and we do not supervise care.
          </p>
          <p>
            Our verification confirms that a caregiver is who they say they are.
            It is not a background check and it is not an endorsement.
          </p>
          <p>
            If you hire someone to work in your home, you are the employer.
            District of Columbia law requires a written contract in the
            worker&rsquo;s preferred language.
          </p>
          <p>
            Our AI coordinator sends messages on your behalf, clearly labeled as
            Ruah. It can make mistakes, and you stay responsible for what you
            agree to.
          </p>
          <p>We do not process payments and charge no fees today.</p>
        </>
      }
      sections={sections}
    />
  )
}
