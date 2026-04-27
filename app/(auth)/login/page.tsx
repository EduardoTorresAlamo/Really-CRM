'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

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
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #1a0533 0%, #2d1b69 40%, #17171c 100%)' }}>
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-10 text-center">
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#9b60aa]">
              REALLY CRM
            </span>
            <h1 className="text-4xl font-bold text-white mt-3 tracking-tight">
              Welcome back.
            </h1>
            <p className="text-[#93939f] mt-2 text-sm">
              Sign in to manage your real estate clients.
            </p>
          </div>

          <div className="bg-white rounded-[22px] p-8 border border-[#d9d9dd]">
            {sent ? (
              <div className="text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-[#f2f2f2] flex items-center justify-center mx-auto">
                  <span className="text-lg">✉</span>
                </div>
                <p className="text-sm text-black font-medium">Check your email</p>
                <p className="text-xs text-[#93939f]">
                  We sent a magic link to <span className="text-black">{email}</span>
                </p>
                <button
                  onClick={() => setSent(false)}
                  className="text-xs text-[#93939f] hover:text-[#1863dc] transition-colors mt-2 underline"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-mono uppercase tracking-widest text-[#93939f]">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="rounded-full border-[#d9d9dd] focus:border-[#9b60aa] text-sm h-11"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full rounded-full h-11 text-sm font-medium bg-black text-white hover:bg-[#1863dc] transition-colors"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send Magic Link'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
