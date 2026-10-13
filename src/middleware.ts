import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/env'

/**
 * Guards the staff area. Every /admin page needs a signed-in user, and every page
 * except sign-in and the two-factor step needs a second factor (aal2).
 * The database enforces the same rule, so this is about sending people to the right step.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === '/admin/login') return NextResponse.next()
  if (!isSupabaseConfigured) return NextResponse.redirect(new URL('/admin/login', request.url))

  let response = NextResponse.next({ request })
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const login = new URL('/admin/login', request.url)
    if (pathname !== '/admin') login.searchParams.set('next', pathname)
    return NextResponse.redirect(login)
  }

  if (pathname !== '/admin/two-factor') {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (data?.currentLevel !== 'aal2') {
      return NextResponse.redirect(new URL('/admin/two-factor', request.url))
    }
  }

  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export const config = { matcher: ['/admin', '/admin/:path*'] }
