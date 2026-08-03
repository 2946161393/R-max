import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from './emails'

export type AdminAuth =
  | { ok: true; user: User }
  | { ok: false; status: 401 | 403; error: string }

/**
 * Authorizes an admin-only request using the caller's session cookie.
 *
 * Identity comes from `auth.getUser()`, which revalidates the access token with
 * Supabase Auth. It must never be taken from the request body or a header the
 * caller controls — those are claims, not proof.
 *
 * Server-only: reads cookies through `next/headers`, so importing this from a
 * client component will fail the build.
 */
export async function requireAdmin(): Promise<AdminAuth> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { ok: false, status: 401, error: 'Not authenticated' }
  }

  if (!isAdminEmail(user.email)) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  return { ok: true, user }
}
