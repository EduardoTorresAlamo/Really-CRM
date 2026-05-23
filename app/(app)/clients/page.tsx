import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClientList from '@/components/clients/ClientList'
import ClientFilters from '@/components/clients/ClientFilters'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import type { Client } from '@/types/client'
import { Suspense } from 'react'

/**
 * URL search parameters accepted by the clients list page.
 */
interface SearchParams {
  /** Free-text name filter applied as an ilike query (case-insensitive substring match). */
  search?: string
  /** Status filter: 'active', 'inactive', or 'closed'. */
  status?: string
  /** Client type filter: 'buyer' or 'seller'. */
  type?: string
}

/**
 * Clients list page with server-side filtering.
 *
 * Reads filter values from the URL search params and builds a Supabase query dynamically.
 * Filters are optional -- when absent the full client list for the realtor is returned.
 *
 * searchParams is a Promise in Next.js 16 App Router and must be awaited before reading
 * individual properties.
 *
 * @param searchParams - Promise resolving to the URL search parameters.
 * @returns The clients list page JSX.
 */
// searchParams is a Promise in Next.js 15+ app router -- must be awaited before use
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Build the query dynamically — filters are only applied when the param is present
  let query = supabase
    .from('clients')
    .select('*')
    .eq('realtor_id', user.id)
    .order('created_at', { ascending: false })

  if (params.search) {
    query = query.ilike('name', `%${params.search}%`)
  }
  if (params.status) {
    query = query.eq('status', params.status)
  }
  if (params.type) {
    query = query.eq('client_type', params.type)
  }

  const { data: clients } = await query

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">Clients</h1>
          <p className="text-xs text-[#93939f] mt-1 uppercase tracking-widest font-mono">
            {clients?.length ?? 0} total client{(clients?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/clients/new" className={cn(buttonVariants())}>
          <Plus className="w-4 h-4 mr-2" />
          New Client
        </Link>
      </div>

      <Suspense>
        <ClientFilters />
      </Suspense>

      <ClientList clients={(clients ?? []) as Client[]} />
    </div>
  )
}
