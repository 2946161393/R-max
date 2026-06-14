'use client'

import { useRouter } from 'next/navigation'

export default function PrivacyPolicyPage() {
  const router = useRouter()
  const lastUpdated = 'June 14, 2026'

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex items-center gap-2">
          <img src="/ruah-logo.png" alt="Ruah" className="w-7 h-7" />
          <span className="font-semibold text-gray-900 text-sm">Privacy Policy</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: {lastUpdated}</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <p className="text-gray-600">
              Ruah ("we", "us", or "our") connects families with caregivers. This Privacy
              Policy explains what information we collect, how we use it, and the choices you
              have. By using Ruah, you agree to the practices described here.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Information we collect</h2>
            <p className="mb-3">We collect the following information to operate the platform:</p>
            <ul className="space-y-2 list-disc pl-5 text-gray-600">
              <li><span className="font-medium text-gray-800">Account information:</span> name, email, ZIP code, and the role you sign up as (family or caregiver).</li>
              <li><span className="font-medium text-gray-800">Profile information:</span> for caregivers, this includes services offered, languages, years of experience, hourly rates, a bio, and availability. For families, this includes care needs and request details.</li>
              <li><span className="font-medium text-gray-800">Identity verification documents:</span> if you choose to get verified, we collect a photo of a government-issued ID and a selfie. Providing these is optional, but verification is required to apply to certain requests.</li>
              <li><span className="font-medium text-gray-800">Messages and activity:</span> messages exchanged through the platform, applications, matches, and notifications.</li>
              <li><span className="font-medium text-gray-800">Technical data:</span> basic usage data such as login activity, used to keep your account secure and improve the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. How we use your information</h2>
            <ul className="space-y-2 list-disc pl-5 text-gray-600">
              <li>To match families with caregivers and facilitate communication between them.</li>
              <li>To verify caregiver identities and help build trust on the platform.</li>
              <li>To provide AI-assisted features such as drafting bios, answering questions, and following up on your behalf.</li>
              <li>To maintain safety, prevent fraud and abuse, and enforce our policies.</li>
              <li>To improve and operate the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Identity verification documents</h2>
            <p className="text-gray-600 mb-3">
              We take special care with ID photos and selfies. These documents:
            </p>
            <ul className="space-y-2 list-disc pl-5 text-gray-600">
              <li>Are stored in a private, access-restricted location.</li>
              <li>Are visible only to authorized members of the Ruah team for the purpose of verifying your identity.</li>
              <li>Are never shared with families, other caregivers, or third parties.</li>
              <li>Are never used for advertising or sold to anyone.</li>
            </ul>
            <p className="text-gray-600 mt-3">
              You may request deletion of your verification documents at any time by contacting us
              (see Section 8).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. How we share information</h2>
            <p className="text-gray-600 mb-3">We share information only as needed to run the service:</p>
            <ul className="space-y-2 list-disc pl-5 text-gray-600">
              <li><span className="font-medium text-gray-800">Between users:</span> when a family and caregiver match, relevant profile details and messages are shared between them. We do not share contact information beyond what you choose to provide in messages.</li>
              <li><span className="font-medium text-gray-800">Service providers:</span> we use trusted infrastructure providers (such as hosting and database services) to operate the platform. They process data on our behalf under confidentiality obligations.</li>
              <li><span className="font-medium text-gray-800">Legal reasons:</span> we may disclose information if required by law or to protect the safety of our users.</li>
            </ul>
            <p className="text-gray-600 mt-3 font-medium">We do not sell your personal information.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Data retention</h2>
            <p className="text-gray-600">
              We keep your information for as long as your account is active or as needed to provide
              the service. If you delete your account, we will delete or anonymize your personal
              information, including verification documents, except where we are required to retain
              it for legal or safety reasons.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Your rights and choices</h2>
            <p className="text-gray-600 mb-3">
              Depending on where you live, you may have rights regarding your personal information,
              including the right to access, correct, or delete it. California residents have
              additional rights under the California Consumer Privacy Act (CCPA), including the right
              to know what personal information we collect and to request its deletion. We do not
              sell personal information, so there is nothing to opt out of in that regard.
            </p>
            <p className="text-gray-600">
              To exercise any of these rights, contact us using the information in Section 8.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Security</h2>
            <p className="text-gray-600">
              We use reasonable technical and organizational measures to protect your information,
              including access controls and restricted storage for sensitive documents. No method of
              transmission or storage is completely secure, but we work to protect your data and
              limit access to it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Contact us</h2>
            <p className="text-gray-600">
              If you have questions about this Privacy Policy or want to exercise your privacy
              rights, contact us at{' '}
              <a href="mailto:zijinwang168@gmail.com" className="text-[#7FB3FF] hover:underline">
                zijinwang168@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Changes to this policy</h2>
            <p className="text-gray-600">
              We may update this Privacy Policy from time to time. If we make material changes, we
              will update the "Last updated" date above and, where appropriate, notify you through
              the platform.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-100">
          <button onClick={() => router.push('/')}
            className="text-sm text-[#7FB3FF] hover:underline">← Back to Ruah</button>
        </div>
      </div>
    </div>
  )
}