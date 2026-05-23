import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /auth/callback
 *
 * Handles the magic-link (OTP) callback from Supabase after the user clicks
 * the login email link. Supabase redirects here with a one-time `code` query
 * parameter, which is exchanged for a session cookie via PKCE.
 *
 * Flow:
 *   1. User submits their email on the login page.
 *   2. Supabase sends a magic link pointing to this URL with `?code=...`.
 *   3. This handler exchanges the code for a session and redirects to the app.
 *   4. If anything fails, the user is redirected to /login?error=auth_failed.
 *
 * The `next` parameter allows deep-linking after login (e.g. returning to a
 * specific client page). Absolute and protocol-relative URLs are rejected to
 * prevent open-redirect attacks -- only relative paths starting with "/" are
 * accepted; everything else falls back to /dashboard.
 *
 * This route must remain public (not guarded by middleware) so the magic-link
 * redirect can land here before a session exists.
 *
 * @param request - The incoming Next.js request carrying the Supabase auth code.
 * @returns A redirect to the intended destination, or /login on failure.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/dashboard'
  // Reject absolute URLs and protocol-relative URLs to prevent open redirects
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  if (code) {
    const supabase = await createClient()
    // exchangeCodeForSession completes the PKCE flow and sets the session cookie
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
