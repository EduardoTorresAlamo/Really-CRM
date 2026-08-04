'use client'

import { useState } from 'react'
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
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Mail } from 'lucide-react'
import ClientStatusBadge from './ClientStatusBadge'
import ClientTypeBadge from './ClientTypeBadge'
import BulkEmailModal from './BulkEmailModal'
import type { Client } from '@/types/client'

/**
 * Props for the SelectableClientList component.
 */
interface SelectableClientListProps {
  /** The array of client rows to render. */
  clients: Client[]
}

/**
 * Formats a budget range as a human-readable string using abbreviated suffixes.
 *
 * @param min - The minimum budget in dollars, or null.
 * @param max - The maximum budget in dollars, or null.
 * @returns A formatted budget string, or a dash placeholder if both are null.
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
 * Client list table with row checkboxes for multi-select bulk email.
 *
 * A sticky action bar appears once 2+ clients are selected and opens the
 * BulkEmailModal. This is the interactive replacement for the static ClientList
 * on the clients page. Selection is held in a Set of client ids.
 *
 * @param props - SelectableClientListProps with the clients array.
 * @returns The selectable client table JSX.
 */
export default function SelectableClientList({ clients }: SelectableClientListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === clients.length ? new Set() : new Set(clients.map((c) => c.id))
    )
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-16 text-[#93939f]">
        <p className="text-base font-medium text-black">No clients found</p>
        <p className="text-sm mt-1">Create your first client to get started.</p>
      </div>
    )
  }

  const selectedClients = clients
    .filter((c) => selected.has(c.id))
    .map((c) => ({ id: c.id, name: c.name }))

  return (
    <div className="space-y-3">
      {selected.size >= 2 && (
        <div className="flex items-center justify-between rounded-[14px] border border-[#1863dc]/30 bg-[#1863dc]/5 px-4 py-2.5">
          <span className="text-sm font-medium text-[#1863dc]">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Mail className="w-4 h-4 mr-2" />
              Email selected
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-[22px] border border-[#d9d9dd] bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#f2f2f2] hover:bg-transparent">
              <TableHead className="w-10 h-11">
                <input
                  type="checkbox"
                  aria-label="Select all clients"
                  checked={selected.size === clients.length}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-[#c4c4cc] accent-[#1863dc] cursor-pointer"
                />
              </TableHead>
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
              <TableRow
                key={client.id}
                data-selected={selected.has(client.id)}
                className="border-b border-[#f2f2f2] hover:bg-[#fafafa] data-[selected=true]:bg-[#1863dc]/5 transition-colors"
              >
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Select ${client.name}`}
                    checked={selected.has(client.id)}
                    onChange={() => toggle(client.id)}
                    className="h-4 w-4 rounded border-[#c4c4cc] accent-[#1863dc] cursor-pointer"
                  />
                </TableCell>
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

      <BulkEmailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        selected={selectedClients}
        onSent={() => setSelected(new Set())}
      />
    </div>
  )
}
