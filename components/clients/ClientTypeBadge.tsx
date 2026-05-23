import type { ClientType } from '@/types/client'

/**
 * Renders a small pill badge indicating whether a client is a buyer or a seller.
 * Buyers get a filled background; sellers get an outlined style.
 *
 * @param type - The client's type ('buyer' or 'seller').
 * @returns A styled inline badge element.
 */
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
