import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/admin/emails'

// Caregiver-only private subpages. Everything else under /caregiver/ (e.g. /caregiver/{uuid})
// is a public profile page that families need to view, so it is NOT restricted.
const CAREGIVER_PRIVATE_PAGES = [
  'dashboard', 'profile', 'requests', 'verify',
  'applications', 'activity', 'chat', 'onboarding', 'availability',
]

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Unauthenticated users hitting protected pages
  if (!user && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    // Fetch ban status + role in one query
    const { data: userData } = await supabase
      .from('users')
      .select('is_banned, ban_reason, role')
      .eq('id', user.id)
      .single()

    // Ban check
    if (userData?.is_banned) {
      if (!pathname.startsWith('/banned')) {
        const url = new URL('/banned', request.url)
        url.searchParams.set('reason', userData.ban_reason || 'Violation of terms of service')
        return NextResponse.redirect(url)
      }
      return supabaseResponse
    }

    const role = userData?.role
    const isAdmin = isAdminEmail(user.email)

    // --- Role-based route isolation ---

    // Admin pages: only admin emails
    if (pathname.startsWith('/admin') && !isAdmin) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Family pages: only family role (admins allowed for support)
    if (pathname.startsWith('/family') && role !== 'family' && !isAdmin) {
      return NextResponse.redirect(new URL('/caregiver/dashboard', request.url))
    }

    // Caregiver PRIVATE pages: only caregiver role (admins allowed).
    // Public caregiver profile pages (/caregiver/{uuid}) are NOT restricted.
    const segments = pathname.split('/').filter(Boolean) // e.g. ['caregiver', 'dashboard']
    if (segments[0] === 'caregiver' && CAREGIVER_PRIVATE_PAGES.includes(segments[1])) {
      if (role !== 'caregiver' && !isAdmin) {
        return NextResponse.redirect(new URL('/family/dashboard', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}