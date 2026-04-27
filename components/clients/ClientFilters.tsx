'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Input } from '@/components/ui/input'

export default function ClientFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''
  const type = searchParams.get('type') ?? ''

  // Wrapped in startTransition so the navigation doesn't block other UI updates
  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      // Empty string means "remove filter" — keep the URL clean
      Object.entries(updates).forEach(([key, value]) => {
        if (value) params.set(key, value)
        else params.delete(key)
      })
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [router, pathname, searchParams]
  )

  const statusOptions = [
    { value: '', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'closed', label: 'Closed' },
  ]

  const typeOptions = [
    { value: '', label: 'All Types' },
    { value: 'buyer', label: 'Buyers' },
    { value: 'seller', label: 'Sellers' },
  ]

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Input
        placeholder="Search clients..."
        defaultValue={search}
        // Debounce search so we don't push a URL update on every keystroke
        onChange={(e) => {
          const val = e.target.value
          const timeout = setTimeout(() => updateParams({ search: val }), 300)
          return () => clearTimeout(timeout)
        }}
        className="sm:max-w-xs rounded-full border-[#d9d9dd] focus:border-[#9b60aa] text-sm"
      />
      <div className="flex gap-1.5 items-center">
        <span className="text-xs font-mono uppercase tracking-widest text-[#93939f] mr-1">Status</span>
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => updateParams({ status: opt.value })}
            className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wide transition-colors ${
              status === opt.value
                ? 'bg-black text-white'
                : 'border border-[#d9d9dd] text-[#93939f] hover:border-black hover:text-black bg-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 items-center">
        <span className="text-xs font-mono uppercase tracking-widest text-[#93939f] mr-1">Type</span>
        {typeOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => updateParams({ type: opt.value })}
            className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wide transition-colors ${
              type === opt.value
                ? 'bg-black text-white'
                : 'border border-[#d9d9dd] text-[#93939f] hover:border-black hover:text-black bg-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
