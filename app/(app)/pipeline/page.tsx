import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PipelineBoard from '@/components/pipeline/PipelineBoard'
import type { Client } from '@/types/client'

/**
 * Pipeline page — a Kanban board of every client grouped by sales stage.
 *
 * Clients are loaded server-side (RLS scopes them to the realtor); the board is
 * an interactive client component that moves cards between stages and persists
 * each change to Supabase.
 *
 * @returns The pipeline page JSX.
 */
export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('realtor_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black">Pipeline</h1>
        <p className="text-xs text-[#93939f] mt-1 uppercase tracking-widest font-mono">
          {clients?.length ?? 0} client{(clients?.length ?? 0) !== 1 ? 's' : ''} across 6 stages
        </p>
      </div>

      <PipelineBoard initialClients={(clients ?? []) as Client[]} />
    </div>
  )
}
