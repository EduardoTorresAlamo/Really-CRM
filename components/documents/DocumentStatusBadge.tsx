import type { DocStatus } from '@/types/document'

const config: Record<DocStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  received: { label: 'Received', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  verified: { label: 'Verified', className: 'bg-green-100 text-green-800 border-green-200' },
}

/**
 * Renders a color-coded status badge for a document (pending, received, or verified).
 *
 * @param status - The document's current status.
 * @returns A styled inline badge element.
 */
export default function DocumentStatusBadge({ status }: { status: DocStatus }) {
  const { label, className } = config[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${className}`}>
      {label}
    </span>
  )
}
