'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Search } from 'lucide-react'

interface MatchFormProps {
  onSubmit: (url: string) => void
  loading: boolean
}

export default function MatchForm({ onSubmit, loading }: MatchFormProps) {
  const [url, setUrl] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (url.trim()) onSubmit(url.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="property-url">Property Listing URL</Label>
        <div className="flex gap-2">
          <Input
            id="property-url"
            type="url"
            placeholder="https://www.zillow.com/homedetails/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !url.trim()}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                Find Matches
              </span>
            )}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Paste a link from any real estate listing site (Zillow, Realtor.com, MLS, etc.)
      </p>
    </form>
  )
}
