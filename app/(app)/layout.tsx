import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import type { Profile } from '@/types/profile'

// Shared shell (sidebar + topbar) for authenticated (app) routes. Re-checks auth server-side even
// though proxy.ts already does — the recommended Supabase SSR pattern, since middleware can be
// bypassed in edge cases. Fetches the profile here so TopBar renders without a client waterfall.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Secondary auth guard -- redirect to login if the session is missing
  if (!user) redirect('/login')

  // Profile is fetched here so the TopBar (avatar + name) renders without an extra client request
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-[100dvh] bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar profile={profile as Profile | null} />
        {/* The measure is capped so tables and card grids do not stretch to 2560px
            on a wide monitor; px-6 keeps content off the sidebar hairline. */}
        <main className="flex-1 overflow-auto px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-[1360px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
