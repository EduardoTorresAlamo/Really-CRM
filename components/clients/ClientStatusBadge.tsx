import { Badge } from '@/components/ui/badge'
import type { ClientStatus } from '@/types/client'

const config: Record<ClientStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  inactive: { label: 'Inactive', variant: 'secondary' },
  closed: { label: 'Closed', variant: 'outline' },
}

export default function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const { label, variant } = config[status]
  return <Badge variant={variant}>{label}</Badge>
}
