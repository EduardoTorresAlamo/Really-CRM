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

/**
 * Props for the ClientList component.
 */
interface ClientListProps {
  /** The array of client rows to render in the table. */
  clients: Client[]
}

/**
 * Formats a budget range as a human-readable string using abbreviated suffixes.
 * Values >= $1M are shown as "$X.XM"; smaller values are shown as "$XXX K".
 *
 * @param min - The minimum budget in dollars, or null if not set.
 * @param max - The maximum budget in dollars, or null if not set.
 * @returns A formatted budget string, or a dash placeholder if both values are null.
 */
function formatBudget(min: number | null, max: number | null): string {
  if (!min && !max) return '--'
  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`
  if (min && max) return `${fmt(min)} - ${fmt(max)}`
  if (min) return `From ${fmt(min)}`
  return `Up to ${fmt(max!)}`
}

/**
 * Renders the client list as a responsive table.
 *
 * Preferred locations are capped at 2 visible tags with a "+N more" overflow label
 * to prevent the table from becoming too wide on smaller viewports.
 *
 * @param props - ClientListProps containing the clients array.
 * @returns A styled table of clients, or an empty-state message.
 */
export default function ClientList({ clients }: ClientListProps) {
  if (clients.length === 0) {
    return (
      <div className="text-center py-16 text-[#93939f]">
        <p className="text-base font-medium text-black">No clients found</p>
        <p className="text-sm mt-1">Create your first client to get started.</p>
      </div>
    )
  }

  return (
    <div className="rounded-[22px] border border-[#d9d9dd] bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-[#f2f2f2] hover:bg-transparent">
            <TableHead className="text-xs font-mono uppercase tracking-widest text-[#93939f] h-11">Name</TableHead>
            <TableHead className="text-xs font-mono uppercase tracking-widest text-[#93939f] h-11">Type</TableHead>
            <TableHead className="text-xs font-mono uppercase tracking-widest text-[#93939f] h-11">Status</TableHead>
            <TableHead className="hidden md:table-cell text-xs font-mono uppercase tracking-widest text-[#93939f] h-11">Budget</TableHead>
            <TableHead className="hidden lg:table-cell text-xs font-mono uppercase tracking-widest text-[#93939f] h-11">Locations</TableHead>
            <TableHead className="hidden sm:table-cell text-xs font-mono uppercase tracking-widest text-[#93939f] h-11">Added</TableHead>
            <TableHead className="text-right text-xs font-mono uppercase tracking-widest text-[#93939f] h-11">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id} className="border-b border-[#f2f2f2] hover:bg-[#fafafa] transition-colors">
              <TableCell className="font-medium">
                <Link
                  href={`/clients/${client.id}`}
                  className="font-medium text-black hover:text-[#1863dc] transition-colors"
                >
                  {client.name}
                </Link>
                {client.email && (
                  <p className="text-xs text-[#93939f] mt-0.5">{client.email}</p>
                )}
              </TableCell>
              <TableCell>
                <ClientTypeBadge type={client.client_type} />
              </TableCell>
              <TableCell>
                <ClientStatusBadge status={client.status} />
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm text-[#93939f]">
                {formatBudget(client.budget_min, client.budget_max)}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="flex flex-wrap gap-1">
                  {client.preferred_locations?.slice(0, 2).map((loc) => (
                    <span
                      key={loc}
                      className="text-xs bg-[#f2f2f2] text-[#93939f] px-2 py-0.5 rounded-full font-mono uppercase tracking-wide"
                    >
                      {loc}
                    </span>
                  ))}
                  {(client.preferred_locations?.length ?? 0) > 2 && (
                    <span className="text-xs text-[#93939f]">
                      +{client.preferred_locations!.length - 2} more
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell text-sm text-[#93939f]">
                {formatDistanceToNow(new Date(client.created_at), { addSuffix: true })}
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/clients/${client.id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'hover:text-[#1863dc]')}>View</Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
