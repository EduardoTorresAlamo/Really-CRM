import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import type { MatchResult } from '@/types/propertyMatch'

const scoreConfig = {
  high: { label: 'High Match', className: 'bg-green-100 text-green-800 border-green-200' },
  medium: { label: 'Good Match', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  low: { label: 'Possible Match', className: 'bg-gray-100 text-gray-700 border-gray-200' },
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
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-xs font-bold text-muted-foreground w-5 shrink-0 mt-0.5">
              #{rank}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900">{match.clientName}</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${className}`}>
                  {label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                {match.explanation}
              </p>
            </div>
          </div>
          <Link href={`/clients/${match.clientId}`} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'shrink-0')}>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
