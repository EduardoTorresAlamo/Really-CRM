'use client'

import { useState } from 'react'
import MatchForm from '@/components/property-match/MatchForm'
import ParsedPropertyCard from '@/components/property-match/ParsedPropertyCard'
import MatchedClientCard from '@/components/property-match/MatchedClientCard'
import { toast } from 'sonner'
import type { PropertyMatchResponse } from '@/types/propertyMatch'

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: PropertyMatchResponse }
  | { status: 'error'; message: string }

export default function PropertyMatchPage() {
  const [state, setState] = useState<State>({ status: 'idle' })

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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Property Match</h1>
        <p className="text-sm text-muted-foreground">
          Paste a property listing URL to find which of your clients would be interested
        </p>
      </div>

      <MatchForm onSubmit={handleSubmit} loading={state.status === 'loading'} />

      {state.status === 'loading' && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">Analyzing listing and matching clients...</p>
        </div>
      )}

      {state.status === 'done' && (
        <div className="space-y-4">
          <ParsedPropertyCard property={state.result.property} />

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-gray-900">
              {state.result.matches.length > 0
                ? `${state.result.matches.length} Client Match${state.result.matches.length !== 1 ? 'es' : ''}`
                : 'No Matches Found'}
            </h2>
            {state.result.matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                None of your active buyer clients appear to be a good match for this property.
                Consider reviewing their preferences or adding new clients.
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
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm text-destructive font-medium">Error</p>
          <p className="text-sm text-muted-foreground mt-1">{state.message}</p>
        </div>
      )}
    </div>
  )
}
