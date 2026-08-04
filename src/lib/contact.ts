/* The one public contact address. Four pages used to declare their own copy of
   this, which is how /concierge ended up on a different address from the
   footer. Import it; do not redeclare it.

   This is a CONTACT address, not an identity. The admin allowlist in
   `src/lib/admin/emails.ts` holds login identities and is a separate thing —
   changing this address must never change who can reach admin screens. */
export const CONTACT_EMAIL = 'hello@ruahruah.com'
