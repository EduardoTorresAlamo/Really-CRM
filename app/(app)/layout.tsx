import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import type { Profile } from '@/types/profile'

/**
 * Shared layout for all authenticated app routes under the (app) route group.
 *
 * Performs a server-side auth check on every render. Although the middleware (proxy.ts)
 * already redirects unauthenticated users, this redundant check is the recommended
 * Supabase SSR pattern -- middleware can be bypassed in some edge cases.
 *
 * Fetches the realtor's profile to pass to TopBar so the avatar and name render
 * on the server without a client-side waterfall. Profile may be null if the realtor
 * has not completed onboarding yet.
 *
 * @param children - The page content rendered inside the main content area.
 * @returns The full app shell (sidebar + topbar + main content).
 */
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
