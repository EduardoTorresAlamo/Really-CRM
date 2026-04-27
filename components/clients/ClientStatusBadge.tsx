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

export default function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const { label, className } = config[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-mono uppercase tracking-wide ${className}`}>
      {label}
    </span>
  )
}
