// Single source of truth for who counts as an admin.
//
// Safe to import from both client and server code. Client components use this
// only to gate UI; it is never sufficient on its own. Every privileged action
// must re-check the caller's session on the server via `requireAdmin()`.
export const ADMIN_EMAILS = [
  'zwang168@seas.upenn.edu',
  'zijinwang97@gmail.com',
  'zijinwang168@gmail.com',
]

export function isAdminEmail(email: string | null | undefined) {
  return !!email && ADMIN_EMAILS.includes(email)
}
