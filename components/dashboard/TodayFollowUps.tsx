import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'

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
    <Card className="border-[#d9d9dd]">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-[#f2f2f2]">
        <CardTitle className="text-base font-semibold tracking-tight text-black">Today&apos;s Follow-ups</CardTitle>
        <span className="text-xs font-mono uppercase tracking-widest text-[#93939f]">
          {followUps.length} due
        </span>
      </CardHeader>
      <CardContent className="pt-4">
        {followUps.length === 0 ? (
          <p className="text-sm text-[#93939f] text-center py-6">
            No follow-ups due today.
          </p>
        ) : (
          <div className="space-y-0">
            {followUps.map((fu) => (
              <div key={fu.id} className="flex items-center justify-between gap-3 py-3 border-b border-[#f2f2f2] last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-black truncate">{fu.clients?.name ?? 'Unknown'}</p>
                  {fu.notes && (
                    <p className="text-xs text-[#93939f] truncate mt-0.5">{fu.notes}</p>
                  )}
                </div>
                {fu.clients?.id && (
                  <Link href={`/clients/${fu.clients.id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'shrink-0 hover:text-[#1863dc]')}>
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
