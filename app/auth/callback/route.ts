import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /auth/callback — Supabase magic-link callback. Exchanges the one-time `code` for a session
// (PKCE), then redirects to `next`. Must stay public (unguarded) so the link can land before a
// session exists. `next` is restricted to relative paths to prevent open-redirect attacks.
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
