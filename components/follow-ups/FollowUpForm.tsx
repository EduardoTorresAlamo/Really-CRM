'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Button, buttonVariants } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface FollowUpFormProps {
  clientId: string
  realtorId: string
  onSuccess: () => void
  onCancel: () => void
}

export default function FollowUpForm({ clientId, realtorId, onSuccess, onCancel }: FollowUpFormProps) {
  const supabase = createClient()
  const [date, setDate] = useState<Date>()
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [calOpen, setCalOpen] = useState(false)

  async function handleSave() {
    if (!date) { toast.error('Please select a date'); return }
    setSaving(true)

    const { error } = await supabase.from('follow_ups').insert({
      client_id: clientId,
      realtor_id: realtorId,
      scheduled_date: format(date, 'yyyy-MM-dd'),
      notes: notes || null,
      completed: false,
      email_sent: false,
    })

    setSaving(false)
    if (error) { toast.error('Failed to save follow-up'); return }
    toast.success('Follow-up scheduled')
    onSuccess()
  }

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
      <div className="space-y-2">
        <Label>Follow-up Date</Label>
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'PPP') : 'Pick a date'}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => { setDate(d); setCalOpen(false) }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-2">
        <Label>Notes (optional)</Label>
        <Textarea
          rows={3}
          placeholder="What to discuss or follow up on..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Schedule'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </div>
  )
}
