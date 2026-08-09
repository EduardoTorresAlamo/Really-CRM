'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Search } from 'lucide-react'

/**
 * Props for the MatchForm component.
 */
interface MatchFormProps {
  /** Callback invoked with the trimmed URL string when the form is submitted. */
  onSubmit: (url: string) => void
  /** When true, the submit button shows a spinner and is disabled. */
  loading: boolean
}

/**
 * URL input form for the property-match feature.
 *
 * Controlled input with trimming on submit to strip accidental whitespace from
 * pasted URLs. The submit button is disabled while loading or when the input is empty.
 *
 * @param props - MatchFormProps with submit callback and loading flag.
 * @returns The URL input form JSX.
 */
export default function MatchForm({ onSubmit, loading }: MatchFormProps) {
  const [url, setUrl] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (url.trim()) onSubmit(url.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label
          htmlFor="property-url"
          className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle"
        >
          Property Listing URL
        </Label>
        {/* Stacks on mobile so the URL field keeps a usable width instead of being
            squeezed by the button. */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="property-url"
            type="url"
            inputMode="url"
            aria-describedby="property-url-hint"
            placeholder="https://www.zillow.com/homedetails/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={loading}
            className="h-10 flex-1 px-3 text-sm"
          />
          <Button
            type="submit"
            disabled={loading || !url.trim()}
            className="h-10 shrink-0 px-4"
          >
            {loading ? (
              <>
                <span
                  aria-hidden
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                />
                Analyzing
              </>
            ) : (
              <>
                <Search className="h-4 w-4" strokeWidth={1.75} />
                Find Matches
              </>
            )}
          </Button>
        </div>
      </div>
      <p id="property-url-hint" className="text-xs leading-relaxed text-ink-subtle">
        Paste a link from any real estate listing site (Zillow, Realtor.com, MLS).
      </p>
    </form>
  )
}
