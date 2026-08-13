import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatsCards from '@/components/dashboard/StatsCards'
import TodayFollowUps, { type FollowUpItem } from '@/components/dashboard/TodayFollowUps'
import RecentClients from '@/components/dashboard/RecentClients'
import type { Client } from '@/types/client'
import { format } from 'date-fns'

// Dashboard — landing screen after login. Fires six independent Supabase queries concurrently,
// all scoped by realtor_id, feeding StatsCards (counts), TodayFollowUps, and RecentClients.
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
    <div className="space-y-8">
      <header>
        <h1 className="text-[2rem] font-normal leading-tight text-ink">Dashboard</h1>
        <p className="mt-1.5 text-sm text-ink-subtle">
          {format(new Date(), "EEEE, d MMMM")}
        </p>
      </header>

      <StatsCards
        totalClients={totalClients ?? 0}
        activeBuyers={activeBuyers ?? 0}
        activeSellers={activeSellers ?? 0}
        overdueFollowUps={overdueFollowUps ?? 0}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Cast via unknown because the nested join shape `clients(id, name)` isn't typed by the Supabase codegen */}
        <TodayFollowUps followUps={(todayFollowUps ?? []) as unknown as FollowUpItem[]} />
        <RecentClients clients={(recentClients ?? []) as Client[]} />
      </div>
    </div>
  )
}
