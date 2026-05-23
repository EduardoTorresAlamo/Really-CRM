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
    <div className="flex min-h-screen bg-[#fafafa]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar profile={profile as Profile | null} />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
