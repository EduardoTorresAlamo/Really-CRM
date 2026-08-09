import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import type { MatchResult } from '@/types/propertyMatch'

/**
 * Match strength reads as a monochrome fill ladder (solid > tint > outline) rather
 * than a green/amber/grey traffic light. It matches the existing client badges, keeps
 * the palette to the cool neutrals DESIGN.md specifies, and stays legible to anyone
 * who cannot separate those three hues.
 */
const scoreConfig = {
  high: { label: 'High Match', className: 'bg-ink text-white' },
  medium: { label: 'Good Match', className: 'bg-hairline-soft text-ink' },
  low: { label: 'Possible Match', className: 'border border-hairline bg-surface text-ink-subtle' },
}

/**
 * Props for the MatchedClientCard component.
 */
interface MatchedClientCardProps {
  /** The match result from Claude including score, explanation, and client identifiers. */
  match: MatchResult
  /** 1-based position in the ranked results list, shown as a "#N" label. */
  rank: number
}

/**
 * Card component displaying a single matched client from the property-match results.
 *
 * The color-coded badge (green/yellow/gray) reflects Claude's matchScore.
 * The explanation field is Claude's natural-language reasoning for the score.
 * A link navigates directly to the full client detail page.
 *
 * @param props - MatchedClientCardProps with the match data and rank position.
 * @returns The matched client card JSX.
 */
export default function MatchedClientCard({ match, rank }: MatchedClientCardProps) {
  const { label, className } = scoreConfig[match.matchScore]

  return (
    <Card className="ring-hairline transition-shadow duration-200 ease-fluid hover:shadow-hairline">
      <CardContent className="px-5 pb-1 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              data-numeric
              aria-hidden
              className="mt-0.5 w-5 shrink-0 font-mono text-xs text-ink-muted"
            >
              {rank}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink">{match.clientName}</p>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs uppercase tracking-wide',
                    className
                  )}
                >
                  {label}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-subtle">
                {match.explanation}
              </p>
            </div>
          </div>
          <Link
            href={`/clients/${match.clientId}`}
            aria-label={`Open ${match.clientName}`}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
              'shrink-0 text-ink-muted transition-colors duration-150 hover:text-interaction'
            )}
          >
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
