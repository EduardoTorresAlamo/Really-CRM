import type { ClientStatus } from '@/types/client'

const config: Record<ClientStatus, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'bg-black text-white',
  },
  inactive: {
    label: 'Inactive',
    className: 'bg-[#f2f2f2] text-[#93939f]',
  },
  closed: {
    label: 'Closed',
    className: 'border border-[#d9d9dd] text-[#93939f] bg-white',
  },
}

/**
 * Renders a small pill badge showing a client's status (active, inactive, or closed).
 * Visual styling is driven by the config lookup table above.
 *
 * @param status - The client's current status value.
 * @returns A styled inline badge element.
 */
export default function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const { label, className } = config[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-mono uppercase tracking-wide ${className}`}>
      {label}
    </span>
  )
}
