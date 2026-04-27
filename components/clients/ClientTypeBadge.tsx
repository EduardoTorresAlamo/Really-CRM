import type { ClientType } from '@/types/client'

export default function ClientTypeBadge({ type }: { type: ClientType }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-mono uppercase tracking-wide ${
      type === 'buyer'
        ? 'bg-[#f2f2f2] text-black'
        : 'border border-[#d9d9dd] text-[#93939f] bg-white'
    }`}>
      {type === 'buyer' ? 'Buyer' : 'Seller'}
    </span>
  )
}
