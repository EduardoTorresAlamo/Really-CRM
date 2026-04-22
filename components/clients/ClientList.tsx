import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import ClientStatusBadge from './ClientStatusBadge'
import ClientTypeBadge from './ClientTypeBadge'
import type { Client } from '@/types/client'

interface ClientListProps {
  clients: Client[]
}

function formatBudget(min: number | null, max: number | null): string {
  if (!min && !max) return '—'
  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `From ${fmt(min)}`
  return `Up to ${fmt(max!)}`
}

export default function ClientList({ clients }: ClientListProps) {
  if (clients.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">No clients found</p>
        <p className="text-sm mt-1">Create your first client to get started.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Budget</TableHead>
            <TableHead className="hidden lg:table-cell">Locations</TableHead>
            <TableHead className="hidden sm:table-cell">Added</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/clients/${client.id}`}
                  className="hover:underline text-gray-900"
                >
                  {client.name}
                </Link>
                {client.email && (
                  <p className="text-xs text-muted-foreground">{client.email}</p>
                )}
              </TableCell>
              <TableCell>
                <ClientTypeBadge type={client.client_type} />
              </TableCell>
              <TableCell>
                <ClientStatusBadge status={client.status} />
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                {formatBudget(client.budget_min, client.budget_max)}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="flex flex-wrap gap-1">
                  {client.preferred_locations?.slice(0, 2).map((loc) => (
                    <span
                      key={loc}
                      className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded"
                    >
                      {loc}
                    </span>
                  ))}
                  {(client.preferred_locations?.length ?? 0) > 2 && (
                    <span className="text-xs text-muted-foreground">
                      +{client.preferred_locations!.length - 2} more
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(client.created_at), { addSuffix: true })}
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/clients/${client.id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>View</Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
