import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Authorize from the session before reading the body or writing anything.
    const auth = await requireAdmin()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { userId, action } = await req.json()

    if (!userId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    if (action === 'approve') {
      const { error } = await supabaseAdmin
        .from('caregiver_profiles')
        .update({ is_verified: true, verification_status: 'approved' })
        .eq('user_id', userId)
      if (error) throw error

      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        type: 'verification_approved',
        title: "✅ You're verified!",
        body: 'Your identity has been confirmed. Families can now see your verified badge.',
        data: {},
      })
    } else {
      const { error } = await supabaseAdmin
        .from('caregiver_profiles')
        .update({ verification_status: 'rejected' })
        .eq('user_id', userId)
      if (error) throw error

      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        type: 'verification_rejected',
        title: 'Verification needs another look',
        body: "We couldn't verify your documents. Please re-submit clear photos of your ID and a selfie.",
        data: {},
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('verify-caregiver error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}