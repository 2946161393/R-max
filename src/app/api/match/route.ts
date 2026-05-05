import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { services, languages, budget, familyUserId } = await request.json()
  const supabase = await createClient()

  let query = supabase
    .from('caregiver_profiles')
    .select(`
      *,
      users (
        id,
        full_name,
        avatar_url,
        city
      )
    `)
    .limit(5)

  // 按服务筛选
  if (services?.length) {
    query = query.overlaps('services', services)
  }

  // 按语言筛选
  if (languages?.length) {
    query = query.overlaps('languages', languages)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ caregivers: data || [] })
}