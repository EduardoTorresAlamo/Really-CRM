import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatsCards from '@/components/dashboard/StatsCards'
import TodayFollowUps from '@/components/dashboard/TodayFollowUps'
import RecentClients from '@/components/dashboard/RecentClients'
import type { Client } from '@/types/client'
import { format } from 'date-fns'

/**
 * Dashboard page -- the landing screen after login.
 *
 * Fires six Supabase count/select queries concurrently via Promise.all to avoid
 * sequential round-trips. The queries are all independent and scoped to the
 * authenticated realtor's data via .eq('realtor_id', user.id).
 *
 * Data passed to child components:
 *   - StatsCards: aggregate counts (total, buyers, sellers, overdue)
 *   - TodayFollowUps: follow-ups scheduled for today that are not yet complete
 *   - RecentClients: the 5 most recently created clients
 *
 * @returns The dashboard page JSX.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = format(new Date(), 'yyyy-MM-dd')

  // All 6 queries are independent — run them concurrently to avoid waterfall latency
  const [
    { count: totalClients },
    { count: activeBuyers },
    { count: activeSellers },
    { count: overdueFollowUps },
    { data: todayFollowUps },
    { data: recentClients },
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('realtor_id', user.id),
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('realtor_id', user.id).eq('client_type', 'buyer').eq('status', 'active'),
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('realtor_id', user.id).eq('client_type', 'seller').eq('status', 'active'),
    supabase.from('follow_ups').select('*', { count: 'exact', head: true }).eq('realtor_id', user.id).eq('completed', false).lt('scheduled_date', today),
    supabase.from('follow_ups').select('id, notes, clients(id, name)').eq('realtor_id', user.id).eq('scheduled_date', today).eq('completed', false).order('created_at', { ascending: true }),
    supabase.from('clients').select('*').eq('realtor_id', user.id).order('created_at', { ascending: false }).limit(5),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black">Dashboard</h1>
        <p className="text-sm text-[#93939f] mt-1 uppercase tracking-widest font-mono text-xs">Welcome back</p>
      </div>

      <StatsCards
        totalClients={totalClients ?? 0}
        activeBuyers={activeBuyers ?? 0}
        activeSellers={activeSellers ?? 0}
        overdueFollowUps={overdueFollowUps ?? 0}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* `as any` because the nested join shape `clients(id, name)` isn't typed by the Supabase codegen */}
        <TodayFollowUps followUps={(todayFollowUps ?? []) as any} />
        <RecentClients clients={(recentClients ?? []) as Client[]} />
      </div>
    </div>
  )
}
