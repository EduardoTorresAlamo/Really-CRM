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
    <Card className="ring-hairline">
      <CardHeader className="flex flex-row items-center justify-between border-b border-hairline-soft pb-3">
        <CardTitle className="text-base font-medium text-ink">Recent Clients</CardTitle>
        <Link
          href="/clients"
          className="rounded-sm font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle transition-colors duration-150 hover:text-interaction"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="pt-1">
        {clients.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-ink-subtle">No clients yet.</p>
            <Link
              href="/clients/new"
              className="mt-1 inline-block rounded-sm text-sm text-ink underline underline-offset-4 transition-colors duration-150 hover:text-interaction"
            >
              Add your first one
            </Link>
          </div>
        ) : (
          <div>
            {clients.map((client) => (
              /* The whole row is the hit target, with the arrow as an affordance
                 rather than the only thing that is clickable. */
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="group -mx-2 flex items-center justify-between gap-3 rounded-lg border-b border-hairline-soft px-2 py-3 transition-colors duration-150 last:border-0 hover:bg-hairline-soft/60"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-medium text-ink">{client.name}</p>
                  <ClientTypeBadge type={client.client_type} />
                  <ClientStatusBadge status={client.status} />
                </div>
                <span
                  aria-hidden
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                    'shrink-0 bg-transparent text-ink-muted transition-colors duration-150 group-hover:text-interaction'
                  )}
                >
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
