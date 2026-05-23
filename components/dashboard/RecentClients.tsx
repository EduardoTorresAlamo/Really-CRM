import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import ClientTypeBadge from '@/components/clients/ClientTypeBadge'
import ClientStatusBadge from '@/components/clients/ClientStatusBadge'
import { ArrowRight } from 'lucide-react'
import type { Client } from '@/types/client'

/**
 * Dashboard widget showing the 5 most recently created clients.
 *
 * Shows client name, type badge, and status badge for quick scanning.
 * Includes an empty state with a "Add your first one" link when no clients exist.
 *
 * @param clients - Array of the 5 most recent Client rows.
 * @returns The recent clients card JSX.
 */
export default function RecentClients({ clients }: { clients: Client[] }) {
  return (
    <Card className="border-[#d9d9dd]">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-[#f2f2f2]">
        <CardTitle className="text-base font-semibold tracking-tight text-black">Recent Clients</CardTitle>
        <Link href="/clients" className="text-xs font-mono uppercase tracking-widest text-[#93939f] hover:text-[#1863dc] transition-colors">
          View all
        </Link>
      </CardHeader>
      <CardContent className="pt-4">
        {clients.length === 0 ? (
          <p className="text-sm text-[#93939f] text-center py-6">
            No clients yet.{' '}
            <Link href="/clients/new" className="underline hover:text-[#1863dc]">Add your first one.</Link>
          </p>
        ) : (
          <div className="space-y-0">
            {clients.map((client) => (
              <div key={client.id} className="flex items-center justify-between gap-3 py-3 border-b border-[#f2f2f2] last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-black truncate">{client.name}</p>
                  </div>
                  <ClientTypeBadge type={client.client_type} />
                  <ClientStatusBadge status={client.status} />
                </div>
                <Link href={`/clients/${client.id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'shrink-0 hover:text-[#1863dc]')}>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
