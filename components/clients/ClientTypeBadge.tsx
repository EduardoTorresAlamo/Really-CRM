import { Badge } from '@/components/ui/badge'
import type { ClientType } from '@/types/client'

export default function ClientTypeBadge({ type }: { type: ClientType }) {
  return (
    <Badge variant={type === 'buyer' ? 'default' : 'secondary'}>
      {type === 'buyer' ? 'Buyer' : 'Seller'}
    </Badge>
  )
}
