import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SelectableClientList from '@/components/clients/SelectableClientList'
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
  /** 1-based page number for pagination. Defaults to 1 when absent or invalid. */
  page?: string
}

/** Number of clients per page. */
const PAGE_SIZE = 25

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

  // Clamp the page to a sane 1-based integer, then compute the inclusive row range
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // Build the query dynamically — filters are only applied when the param is present.
  // count: 'exact' returns the full filtered total so we can render page controls.
  let query = supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .eq('realtor_id', user.id)
    .order('created_at', { ascending: false })

  if (params.search) {
    // Escape LIKE wildcards so a user searching "50%" or "a_b" gets a literal match
    // instead of a pattern (backslash first, then the wildcard metacharacters)
    const escaped = params.search.replace(/[\\%_]/g, (ch) => `\\${ch}`)
    query = query.ilike('name', `%${escaped}%`)
  }
  if (params.status) {
    query = query.eq('status', params.status)
  }
  if (params.type) {
    query = query.eq('client_type', params.type)
  }

  const { data: clients, count } = await query.range(from, to)

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // Preserve active filters when building prev/next links
  const buildPageHref = (p: number) => {
    const sp = new URLSearchParams()
    if (params.search) sp.set('search', params.search)
    if (params.status) sp.set('status', params.status)
    if (params.type) sp.set('type', params.type)
    sp.set('page', String(p))
    return `/clients?${sp.toString()}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">Clients</h1>
          <p className="text-xs text-[#93939f] mt-1 uppercase tracking-widest font-mono">
            {total} total client{total !== 1 ? 's' : ''}
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

      <SelectableClientList clients={(clients ?? []) as Client[]} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-[#93939f] font-mono">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildPageHref(page - 1)}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildPageHref(page + 1)}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
