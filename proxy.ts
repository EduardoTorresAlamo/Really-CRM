import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js middleware proxy that handles Supabase session refresh and route protection.
 *
 * Runs on every request (matched by the `config.matcher` at the bottom). Responsibilities:
 *
 *   1. Session refresh: Creates a Supabase SSR client wired to the request cookies and
 *      calls getUser() which triggers an automatic token refresh if the access token is
 *      about to expire. The refreshed cookies are written to both the outgoing request
 *      and the response -- this two-step pattern is required by @supabase/ssr.
 *
 *   2. Auth redirect: Unauthenticated visitors attempting to access protected routes
 *      (/dashboard, /clients, /profile, /property-match) are redirected to /login.
 *      /auth/callback is deliberately excluded so the magic-link can complete.
 *
 *   3. Reverse redirect: Authenticated users visiting /login are sent to /dashboard
 *      to avoid showing the login form to people already signed in.
 *
 * This is exported as `proxy` rather than a default export so middleware.ts can
 * re-export it alongside the Next.js `config` matcher in a single import line.
 *
 * @param request - The incoming Next.js middleware request.
 * @returns The (possibly mutated) response with refreshed session cookies.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Skip during next build -- env vars are not injected at build time
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        // Must set cookies on both the request and a fresh response — Supabase SSR requirement
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Redirect unauthenticated users away from protected app routes
  // /auth/callback is intentionally absent here — it must stay public for the magic link to land
  if ((!user && pathname.startsWith('/dashboard')) ||
      (!user && pathname.startsWith('/clients')) ||
      (!user && pathname.startsWith('/profile')) ||
      (!user && pathname.startsWith('/property-match'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from login
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
