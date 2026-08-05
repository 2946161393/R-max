import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Matching is for signed-in families. This route used to answer anyone, and
  // `select('*')` handed back every caregiver_profiles column — including
  // id_photo_path and selfie_path, the storage paths to their ID documents.
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { services, languages } = await request.json()

  // caregiver_public, not the base table: the base table is own-row + match
  // participants now, and the view already excludes banned / shadow-banned
  // caregivers — so the client-side ban filter below is redundant but kept
  // as a belt-and-braces check.
  let query = supabase
    .from('caregiver_public')
    .select(`
      id, user_id, bio, years_experience, languages, services,
      hourly_rate_min, hourly_rate_max, is_verified, rating, review_count,
      availability_type, overnight_ok, users
    `)
    .limit(5)

  if (services?.length) {
    query = query.overlaps('services', services)
  }

  if (languages?.length) {
    query = query.overlaps('languages', languages)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter out banned and shadow banned users. PostgREST returns the embedded
  // `users` row as an object for this many-to-one relation, but the generated
  // type widens it to an array — normalise rather than cast.
  const embeddedUser = (cg: { users?: unknown }) => {
    const u = cg.users
    return (Array.isArray(u) ? u[0] : u) as
      { is_banned?: boolean; is_shadow_banned?: boolean } | undefined
  }
  const filtered = (data || []).filter(cg => {
    const u = embeddedUser(cg)
    return !u?.is_banned && !u?.is_shadow_banned
  })

  // Honesty layer. When a requested service has no supply, say so instead of
  // leaving an unexplained empty list (or, with no services filter at all,
  // presenting service-blind results as matches). Nothing here changes which
  // caregivers are returned — it only tells the truth about them.
  let supply_by_service: Record<string, number> | null = null
  let no_supply = false
  let reason: string | null = null

  if (services?.length) {
    // Platform-wide supply per requested service, unfiltered by language —
    // this is what distinguishes "nobody offers this" from "people offer it
    // but none matched your other criteria".
    // Also the view — the base table would now return only this caller's own
    // row, turning a platform-wide supply count into "1" or "0".
    const { data: allProfiles } = await supabase
      .from('caregiver_public')
      .select('services')

    const counts: Record<string, number> = {}
    for (const s of services) counts[s] = 0
    for (const row of allProfiles || []) {
      for (const s of row.services || []) {
        if (s in counts) counts[s]++
      }
    }
    supply_by_service = counts

    const unserved = services.filter((s: string) => !counts[s])

    if (filtered.length === 0) {
      if (unserved.length === services.length) {
        no_supply = true
        reason =
          `No caregivers on the platform currently offer ${services.join(' or ')}. ` +
          `Rather than suggest caregivers who do not provide this service, we are not returning any matches.`
      } else {
        reason =
          `Caregivers do offer ${services.filter((s: string) => counts[s]).join(', ')}, ` +
          `but none of them match the other criteria (such as language preference).`
      }
    } else if (unserved.length > 0) {
      reason =
        `Note: no caregivers currently offer ${unserved.join(' or ')}. ` +
        `The matches shown cover the other requested service(s) only.`
    }
  } else if (filtered.length > 0) {
    reason =
      'No service filter was applied (the family has no services on file), ' +
      'so these caregivers are not verified against a specific need.'
  }

  return NextResponse.json({ caregivers: filtered, supply_by_service, no_supply, reason })
}
