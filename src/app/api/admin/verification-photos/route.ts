import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Authorize from the session before reading the body or touching storage.
    const auth = await requireAdmin()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { idPath, selfiePath } = await req.json()

    const result: { idUrl: string | null; selfieUrl: string | null } = {
      idUrl: null,
      selfieUrl: null,
    }

    // Generate signed URLs valid for 1 hour (3600 seconds)
    if (idPath) {
      const { data } = await supabaseAdmin.storage
        .from('verifications')
        .createSignedUrl(idPath, 3600)
      result.idUrl = data?.signedUrl || null
    }

    if (selfiePath) {
      const { data } = await supabaseAdmin.storage
        .from('verifications')
        .createSignedUrl(selfiePath, 3600)
      result.selfieUrl = data?.signedUrl || null
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('verification-photos error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}