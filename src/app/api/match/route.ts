import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { services, languages, budget, familyUserId } = await request.json()
  const supabase = await createClient()

  let query = supabase
    .from('caregiver_profiles')
    .select(`
      *,
      users!caregiver_profiles_user_id_fkey (
        id,
        full_name,
        avatar_url,
        city,
        is_banned,
        is_shadow_banned
      )
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

  // Filter out banned and shadow banned users
  const filtered = (data || []).filter(cg =>
    !cg.users?.is_banned && !cg.users?.is_shadow_banned
  )

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
    const { data: allProfiles } = await supabase
      .from('caregiver_profiles')
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
