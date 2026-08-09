import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'

/**
 * A minimal projection of a follow-up row joined with its related client.
 * The Supabase nested join (clients(id, name)) produces this shape at runtime.
 */
export interface FollowUpItem {
  id: string
  notes: string | null
  /** Null if the related client row was deleted or the join returned no data. */
  clients: { id: string; name: string } | null
}

/**
 * Props for the TodayFollowUps component.
 */
interface TodayFollowUpsProps {
  /** Follow-up items scheduled for today that are not yet completed. */
  followUps: FollowUpItem[]
}

/**
 * Dashboard widget listing follow-ups due today.
 *
 * Each item links directly to the client detail page for quick access.
 * The count badge in the header shows the total at a glance.
 *
 * @param props - TodayFollowUpsProps with the follow-up list.
 * @returns The today's follow-ups card JSX.
 */
export default function TodayFollowUps({ followUps }: TodayFollowUpsProps) {
  return (
    <Card className="ring-hairline">
      <CardHeader className="flex flex-row items-center justify-between border-b border-hairline-soft pb-3">
        <CardTitle className="text-base font-medium text-ink">
          Today&apos;s Follow-ups
        </CardTitle>
        <span
          data-numeric
          className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle"
        >
          {followUps.length} due
        </span>
      </CardHeader>
      <CardContent className="pt-1">
        {followUps.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-ink-subtle">Nothing due today.</p>
            <p className="mt-1 text-xs text-ink-muted">
              Scheduled follow-ups appear here on their date.
            </p>
          </div>
        ) : (
          <div>
            {followUps.map((fu) => {
              const row = (
                <>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {fu.clients?.name ?? 'Unknown client'}
                    </p>
                    {fu.notes && (
                      <p className="mt-0.5 truncate text-xs text-ink-subtle">
                        {fu.notes}
                      </p>
                    )}
                  </div>
                  {fu.clients?.id && (
                    <span
                      aria-hidden
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                        'shrink-0 bg-transparent text-ink-muted transition-colors duration-150 group-hover:text-interaction'
                      )}
                    >
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </span>
                  )}
                </>
              )

              // A follow-up whose client row was deleted has nowhere to link to, so it
              // renders as a plain row rather than a link that goes to /clients/undefined.
              return fu.clients?.id ? (
                <Link
                  key={fu.id}
                  href={`/clients/${fu.clients.id}`}
                  className="group -mx-2 flex items-center justify-between gap-3 rounded-lg border-b border-hairline-soft px-2 py-3 transition-colors duration-150 last:border-0 hover:bg-hairline-soft/60"
                >
                  {row}
                </Link>
              ) : (
                <div
                  key={fu.id}
                  className="-mx-2 flex items-center justify-between gap-3 border-b border-hairline-soft px-2 py-3 last:border-0"
                >
                  {row}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
