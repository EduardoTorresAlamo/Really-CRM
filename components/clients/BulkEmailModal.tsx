'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import TemplatePicker from '@/components/templates/TemplatePicker'
import { toast } from 'sonner'

/**
 * Props for the BulkEmailModal component.
 */
interface BulkEmailModalProps {
  /** Whether the modal is open. */
  open: boolean
  /** Called to change the open state. */
  onOpenChange: (open: boolean) => void
  /** The selected clients to email (id + name for the summary line). */
  selected: { id: string; name: string }[]
  /** Invoked after a successful send so the parent can clear its selection. */
  onSent: () => void
}

/**
 * Modal for composing and sending a bulk email to the selected clients.
 *
 * A template picker prefills the subject/body; `{{clientName}}` and
 * `{{propertyAddress}}` placeholders are left intact and substituted per client
 * server-side by /api/bulk-email. The realtor can also freely edit the message.
 *
 * @param props - BulkEmailModalProps.
 * @returns The bulk-email dialog JSX.
 */
export default function BulkEmailModal({ open, onOpenChange, selected, onSent }: BulkEmailModalProps) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!subject.trim() || !message.trim()) {
      toast.error('Subject and message are required')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/bulk-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientIds: selected.map((c) => c.id),
          subject,
          body: message,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to send emails')
        return
      }
      toast.success(
        `Sent ${data.sent} email${data.sent === 1 ? '' : 's'}` +
          (data.skipped ? ` · ${data.skipped} skipped (no email)` : '')
      )
      setSubject('')
      setMessage('')
      onOpenChange(false)
      onSent()
    } catch {
      toast.error('Failed to send emails')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Email {selected.length} clients</DialogTitle>
          <DialogDescription>
            Pick a template or write your own. {'{{clientName}}'} and {'{{propertyAddress}}'} are
            filled in per client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Template</Label>
            <TemplatePicker
              onSelect={(t) => {
                setSubject(t.subject)
                setMessage(t.body)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject line"
            />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? 'Sending…' : `Send to ${selected.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
