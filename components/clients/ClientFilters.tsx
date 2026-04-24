'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

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
    { value: '', label: 'All Status' },
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
        className="sm:max-w-xs"
      />
      <div className="flex gap-2">
        {statusOptions.map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={status === opt.value ? 'default' : 'outline'}
            onClick={() => updateParams({ status: opt.value })}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        {typeOptions.map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={type === opt.value ? 'default' : 'outline'}
            onClick={() => updateParams({ type: opt.value })}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
