'use client'

import { useState } from 'react'
import { format, isPast, isToday, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { CheckCircle2, Trash2, Mail, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FollowUp } from '@/types/followUp'

interface FollowUpCardProps {
  followUp: FollowUp
  onDelete: (id: string) => void
  onComplete: (id: string) => void
}

// A single scheduled follow-up. Visual state: overdue = red, due today = orange, completed =
// dimmed. isPast() is true for today too, so isToday() is checked to keep the states distinct.
// The "Email" button hits /api/send-followup-email so the Resend key stays server-side.
export default function FollowUpCard({ followUp, onDelete, onComplete }: FollowUpCardProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  const date = parseISO(followUp.scheduled_date)
  // isPast() returns true for today too, so explicitly exclude today to keep the two states separate
  const isOverdue = !followUp.completed && isPast(date) && !isToday(date)
  const isDueToday = !followUp.completed && isToday(date)

  async function handleComplete() {
    setLoading(true)
    const { error } = await supabase
      .from('follow_ups')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', followUp.id)
    setLoading(false)
    if (error) { toast.error('Failed to update'); return }
    toast.success('Marked as complete')
    onComplete(followUp.id)
  }

  async function handleDelete() {
    if (!confirm('Delete this follow-up?')) return
    setLoading(true)
    const { error } = await supabase.from('follow_ups').delete().eq('id', followUp.id)
    setLoading(false)
    if (error) { toast.error('Failed to delete'); return }
    toast.success('Follow-up deleted')
    onDelete(followUp.id)
  }

  // Email goes through an API route rather than calling Resend directly —
  // the API key can't be exposed to the client
  async function handleSendEmail() {
    setSendingEmail(true)
    try {
      const res = await fetch('/api/send-followup-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpId: followUp.id }),
      })
      if (!res.ok) throw new Error()
      toast.success('Reminder email sent')
    } catch {
      toast.error('Failed to send email')
    } finally {
      setSendingEmail(false)
    }
  }

  return (
    <Card className={cn(
      followUp.completed && 'opacity-60',
      isOverdue && 'border-red-200 bg-red-50',
      isDueToday && 'border-orange-200 bg-orange-50'
    )}>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className={cn(
              'w-4 h-4 shrink-0',
              followUp.completed ? 'text-green-500' : isOverdue ? 'text-red-500' : isDueToday ? 'text-orange-500' : 'text-muted-foreground'
            )} />
            <div>
              <p className={cn('text-sm font-medium', followUp.completed && 'line-through text-muted-foreground')}>
                {format(date, 'MMMM d, yyyy')}
              </p>
              {isOverdue && <p className="text-xs text-red-600 font-medium">Overdue</p>}
              {isDueToday && <p className="text-xs text-orange-600 font-medium">Due Today</p>}
              {followUp.completed && followUp.completed_at && (
                <p className="text-xs text-green-600">Completed {format(parseISO(followUp.completed_at), 'MMM d')}</p>
              )}
            </div>
          </div>
        </div>

        {followUp.notes && (
          <p className="text-xs text-muted-foreground bg-white/60 rounded p-2">{followUp.notes}</p>
        )}

        {!followUp.completed && (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleComplete} disabled={loading}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Done
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleSendEmail} disabled={sendingEmail}>
              <Mail className="w-3.5 h-3.5" />
              {sendingEmail ? 'Sending...' : 'Email'}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 ml-auto text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
