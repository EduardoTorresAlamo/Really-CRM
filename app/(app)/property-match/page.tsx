'use client'

import { useState } from 'react'
import MatchForm from '@/components/property-match/MatchForm'
import ParsedPropertyCard from '@/components/property-match/ParsedPropertyCard'
import MatchedClientCard from '@/components/property-match/MatchedClientCard'
import { toast } from 'sonner'
import type { PropertyMatchResponse } from '@/types/propertyMatch'

/**
 * Discriminated union representing the property-match request lifecycle.
 * Using a status tag rather than separate loading/error/data booleans avoids
 * impossible states (e.g. loading=true and result set at the same time).
 */
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: PropertyMatchResponse }
  | { status: 'error'; message: string }

/**
 * Property Match page -- the AI-powered client-to-listing matching screen.
 *
 * The user pastes a property listing URL, which is sent to /api/property-match.
 * That route orchestrates two Claude calls (parse + rank) and returns the results.
 * This component manages the async state machine and renders the appropriate UI
 * for each phase: idle form, loading spinner, results, or error message.
 *
 * @returns The property match page JSX.
 */
export default function PropertyMatchPage() {
  const [state, setState] = useState<State>({ status: 'idle' })

  /**
   * Submits the listing URL to the property-match API and transitions the state machine.
   *
   * @param url - The property listing URL entered by the realtor.
   */
  async function handleSubmit(url: string) {
    setState({ status: 'loading' })
    try {
      const res = await fetch('/api/property-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to analyze listing')
      }

      setState({ status: 'done', result: data as PropertyMatchResponse })

      if (data.matches.length === 0) {
        toast.info('No matching clients found for this property')
      } else {
        toast.success(`Found ${data.matches.length} potential match${data.matches.length !== 1 ? 'es' : ''}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setState({ status: 'error', message })
      toast.error(message)
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <h1 className="text-[2rem] font-normal leading-tight text-ink">Property Match</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-subtle">
          Paste a listing URL to find which of your buyers would be interested.
        </p>
      </header>

      <MatchForm onSubmit={handleSubmit} loading={state.status === 'loading'} />

      {state.status === 'loading' && (
        /* Skeletons in the shape of the real result, so the layout does not jump when
           the response lands and the wait reads as progress rather than a stall. */
        <div className="space-y-4" role="status" aria-live="polite">
          <span className="sr-only">Analyzing listing and matching clients</span>
          <div className="animate-pulse rounded-xl bg-surface p-6 ring-1 ring-hairline">
            <div className="h-2.5 w-16 rounded-full bg-hairline-soft" />
            <div className="mt-4 h-8 w-40 rounded-lg bg-hairline-soft" />
            <div className="mt-3 h-3 w-56 rounded-full bg-hairline-soft" />
            <div className="mt-6 h-16 rounded-lg bg-hairline-soft" />
          </div>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl bg-surface p-5 ring-1 ring-hairline"
            >
              <div className="h-3 w-32 rounded-full bg-hairline-soft" />
              <div className="mt-3 h-2.5 w-full rounded-full bg-hairline-soft" />
              <div className="mt-2 h-2.5 w-3/5 rounded-full bg-hairline-soft" />
            </div>
          ))}
        </div>
      )}

      {state.status === 'done' && (
        <div className="space-y-5">
          <ParsedPropertyCard property={state.result.property} />

          <div className="space-y-3">
            <h2 className="text-base font-medium text-ink">
              {state.result.matches.length > 0
                ? `${state.result.matches.length} Client Match${state.result.matches.length !== 1 ? 'es' : ''}`
                : 'No Matches Found'}
            </h2>
            {state.result.matches.length === 0 ? (
              <p className="text-sm leading-relaxed text-ink-subtle">
                None of your active buyer clients appear to be a good match for this
                property. Consider reviewing their preferences or adding new clients.
              </p>
            ) : (
              state.result.matches.map((match, idx) => (
                <MatchedClientCard key={match.clientId} match={match} rank={idx + 1} />
              ))
            )}
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/25 bg-destructive/5 p-5"
        >
          <p className="text-sm font-medium text-destructive">
            Could not analyze that listing
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-subtle">
            {state.message}
          </p>
        </div>
      )}
    </div>
  )
}
