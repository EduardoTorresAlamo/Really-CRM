import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatsCards from '@/components/dashboard/StatsCards'
import TodayFollowUps, { type FollowUpItem } from '@/components/dashboard/TodayFollowUps'
import RecentClients from '@/components/dashboard/RecentClients'
import type { Client } from '@/types/client'
import { format } from 'date-fns'

// Dashboard — landing screen after login. The four stat counts come from one get_dashboard_stats
// RPC (single round-trip) instead of four separate count queries; the two list queries run
// alongside it. All scoped by realtor_id, feeding StatsCards, TodayFollowUps, and RecentClients.
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = format(new Date(), 'yyyy-MM-dd')

  const [
    { data: stats },
    { data: todayFollowUps },
    { data: recentClients },
  ] = await Promise.all([
    supabase.rpc('get_dashboard_stats', { p_realtor_id: user.id, p_today: today }),
    supabase.from('follow_ups').select('id, notes, clients(id, name)').eq('realtor_id', user.id).eq('scheduled_date', today).eq('completed', false).order('created_at', { ascending: true }),
    supabase.from('clients').select('*').eq('realtor_id', user.id).order('created_at', { ascending: false }).limit(5),
  ])

  const {
    totalClients = 0,
    activeBuyers = 0,
    activeSellers = 0,
    overdueFollowUps = 0,
  } = (stats ?? {}) as {
    totalClients?: number
    activeBuyers?: number
    activeSellers?: number
    overdueFollowUps?: number
  }

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
