import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Clock, ArrowRight } from 'lucide-react'

interface FollowUpItem {
  id: string
  notes: string | null
  clients: { id: string; name: string } | null
}

interface TodayFollowUpsProps {
  followUps: FollowUpItem[]
}

export default function TodayFollowUps({ followUps }: TodayFollowUpsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Today&apos;s Follow-ups</CardTitle>
        <Clock className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {followUps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No follow-ups due today.
          </p>
        ) : (
          <div className="space-y-2">
            {followUps.map((fu) => (
              <div key={fu.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{fu.clients?.name ?? 'Unknown'}</p>
                  {fu.notes && (
                    <p className="text-xs text-muted-foreground truncate">{fu.notes}</p>
                  )}
                </div>
                {fu.clients?.id && (
                  <Link href={`/clients/${fu.clients.id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'shrink-0')}>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
