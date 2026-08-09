'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ArrowRight, MailCheck } from 'lucide-react'

/**
 * Login page implementing passwordless magic-link authentication via Supabase OTP.
 *
 * Flow:
 *   1. Realtor enters their email address and submits the form.
 *   2. signInWithOtp sends a one-time magic link to the email via Supabase Auth.
 *   3. The page transitions to a "check your email" confirmation view.
 *   4. Clicking the link redirects to /auth/callback?code=... which exchanges
 *      the code for a session and redirects to the dashboard.
 *
 * emailRedirectTo must match the Site URL or an allowed redirect URL configured
 * in the Supabase Auth dashboard, otherwise the magic link will be rejected.
 *
 * @returns The login page JSX.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  // `sent` controls whether to show the "check your email" confirmation or the email form
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  /**
   * Submits the email address to Supabase to trigger a magic-link email.
   *
   * @param e - The form submission event.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    // signInWithOtp sends a magic link -- no password involved
    // emailRedirectTo must be an allowed redirect URL in the Supabase project settings
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })

    setLoading(false)

    if (error) {
      toast.error(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-[1.05fr_1fr]">
      {/* Deep purple band. DESIGN.md reserves purple for full-width sections, never
          card surfaces, so it carries the brand here and the form stays on white. */}
      <aside
        className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, #1a0533 0%, #2d1b69 42%, #17171c 100%)',
        }}
      >
        {/* Single soft light source, masked so it never touches the text column. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-24 h-[32rem] w-[32rem] rounded-full opacity-40 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(155,96,170,0.55) 0%, transparent 68%)',
          }}
        />

        <span className="relative font-mono text-[11px] uppercase tracking-[0.22em] text-white/60">
          Really CRM
        </span>

        <div className="relative max-w-md">
          <h2 className="text-4xl xl:text-5xl font-normal text-white leading-[1.08] tracking-[-0.03em]">
            Every client, every follow-up, in one place.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/70">
            Match listings to the buyers who actually want them, and never let a
            follow-up slip past its date.
          </p>
        </div>

        <div className="relative flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">
          <span>Pipeline</span>
          <span aria-hidden className="h-px w-6 bg-white/20" />
          <span>Matching</span>
          <span aria-hidden className="h-px w-6 bg-white/20" />
          <span>Follow-ups</span>
        </div>
      </aside>

      <main className="flex flex-col items-center justify-center bg-surface px-6 py-16 sm:px-10">
        <div className="w-full max-w-sm">
          {/* Wordmark only shows on small screens, where the purple panel is hidden. */}
          <span className="lg:hidden font-mono text-[11px] uppercase tracking-[0.22em] text-ink-subtle">
            Really CRM
          </span>

          {sent ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-6 lg:mt-0 animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-fluid"
            >
              <span
                aria-hidden
                className="flex h-11 w-11 items-center justify-center rounded-full bg-hairline-soft text-ink"
              >
                <MailCheck className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <h1 className="mt-6 text-3xl font-normal text-ink tracking-[-0.025em]">
                Check your email
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-ink-subtle">
                We sent a magic link to{' '}
                <span className="font-medium text-ink">{email}</span>. Open it on
                this device to finish signing in.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-6 text-sm text-ink-subtle underline underline-offset-4 transition-colors duration-150 hover:text-interaction"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <div className="mt-6 lg:mt-0">
                <h1 className="text-3xl font-normal text-ink tracking-[-0.025em]">
                  Welcome back
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-ink-subtle">
                  Sign in with a magic link. No password to remember.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-subtle"
                  >
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    disabled={loading}
                    className="h-11 rounded-lg border-hairline px-3.5 text-sm"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="h-11 w-full rounded-lg bg-ink text-sm font-medium text-white transition-[transform,background-color] duration-150 ease-fluid hover:bg-interaction active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <span
                        aria-hidden
                        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                      />
                      Sending link
                    </>
                  ) : (
                    <>
                      Send magic link
                      <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                    </>
                  )}
                </Button>
              </form>

              <p className="mt-6 text-xs leading-relaxed text-ink-subtle">
                The link expires after a single use. Check spam if it has not
                arrived within a minute.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
