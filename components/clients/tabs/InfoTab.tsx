import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import ClientStatusBadge from '../ClientStatusBadge'
import ClientTypeBadge from '../ClientTypeBadge'
import type { Client } from '@/types/client'

/**
 * A label-value display row used throughout the InfoTab.
 * Renders horizontally on sm+ screens and stacks vertically on mobile.
 *
 * @param label - The field label (e.g. "Email", "Budget").
 * @param value - The field value; null/undefined renders a dash placeholder.
 * @returns A single row JSX element.
 */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
      <span className="text-sm font-medium text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="text-sm text-gray-900">{value ?? '—'}</span>
    </div>
  )
}

/**
 * Formats a budget range as a USD currency string using the browser's Intl API.
 * Produces full dollar amounts (e.g. "$250,000") rather than abbreviated suffixes
 * for precision on the detail view.
 *
 * @param min - Minimum budget in dollars, or null if not set.
 * @param max - Maximum budget in dollars, or null if not set.
 * @returns A formatted budget string, or a dash placeholder if both are null.
 */
function formatBudget(min: number | null, max: number | null): string {
  if (!min && !max) return '--'
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  if (min && max) return `${fmt(min)} - ${fmt(max)}`
  if (min) return `From ${fmt(min)}`
  return `Up to ${fmt(max!)}`
}

/**
 * Info tab within the client detail page.
 *
 * Renders the client's contact details and, for buyers only, their property
 * preference fields. Seller-specific fields (budget, property types, locations,
 * bedrooms, bathrooms) are omitted when the client_type is 'seller'.
 *
 * @param client - The full Client row to display.
 * @returns The info tab JSX.
 */
export default function InfoTab({ client }: { client: Client }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Client Details</CardTitle>
          <Link href={`/clients/${client.id}/edit`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>Edit</Link>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Type" value={<ClientTypeBadge type={client.client_type} />} />
          <Row label="Status" value={<ClientStatusBadge status={client.status} />} />
          <Separator />
          <Row label="Email" value={client.email} />
          <Row label="Phone" value={client.phone} />
          <Separator />
          <Row label="Sale Type" value={client.sale_type ? (client.sale_type === 'cash' ? 'Cash' : 'Loan (Prestamo)') : null} />
          {client.client_type === 'buyer' && (
            <>
              <Row label="Budget" value={formatBudget(client.budget_min, client.budget_max)} />
              <Row
                label="Property Types"
                value={client.property_types?.join(', ') ?? null}
              />
              <Row
                label="Locations"
                value={client.preferred_locations?.join(', ') ?? null}
              />
              <Row
                label="Bedrooms"
                value={
                  client.bedrooms_min || client.bedrooms_max
                    ? `${client.bedrooms_min ?? '?'} – ${client.bedrooms_max ?? '?'}`
                    : null
                }
              />
              <Row
                label="Bathrooms"
                value={
                  client.bathrooms_min || client.bathrooms_max
                    ? `${client.bathrooms_min ?? '?'} – ${client.bathrooms_max ?? '?'}`
                    : null
                }
              />
            </>
          )}
        </CardContent>
      </Card>

      {client.notes && (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{client.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
