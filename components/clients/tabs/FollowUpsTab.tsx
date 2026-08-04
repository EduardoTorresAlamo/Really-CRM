'use client'

import { useState } from 'react'
import FollowUpCard from '@/components/follow-ups/FollowUpCard'
import FollowUpForm from '@/components/follow-ups/FollowUpForm'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { FollowUp } from '@/types/followUp'

/**
 * Props for the FollowUpsTab component.
 */
interface FollowUpsTabProps {
  /** Follow-up records already loaded server-side for this client. */
  initialFollowUps: FollowUp[]
  /** The UUID of the client these follow-ups belong to. */
  clientId: string
  /** The client's name, forwarded to the form for template placeholder substitution. */
  clientName: string
  /** The authenticated realtor's user ID, used when inserting new follow-up rows. */
  realtorId: string
}

/**
 * Follow-ups tab within the client detail page.
 *
 * Manages local follow-up state optimistically. Pending follow-ups are shown first
 * so actionable items are always at the top regardless of insertion order.
 *
 * @param props - FollowUpsTabProps including initial follow-ups and identifiers.
 * @returns The follow-ups tab JSX with list and inline creation form.
 */
export default function FollowUpsTab({ initialFollowUps, clientId, clientName, realtorId }: FollowUpsTabProps) {
  const [followUps, setFollowUps] = useState<FollowUp[]>(initialFollowUps)
  const [showForm, setShowForm] = useState(false)

  /**
   * Removes a follow-up from local state after it has been deleted from the database.
   *
   * @param id - The UUID of the deleted follow-up.
   */
  function handleDelete(id: string) {
    setFollowUps((prev) => prev.filter((f) => f.id !== id))
  }

  /**
   * Marks a follow-up as completed in local state using the current timestamp,
   * mirroring the update written to the database by FollowUpCard.
   *
   * @param id - The UUID of the completed follow-up.
   */
  function handleComplete(id: string) {
    setFollowUps((prev) =>
      prev.map((f) => f.id === id ? { ...f, completed: true, completed_at: new Date().toISOString() } : f)
    )
  }

  // Re-fetch from DB after a new follow-up is created so we have the server-generated id and timestamps
  // Supabase client is imported dynamically to avoid instantiating it on every render
  async function handleSuccess() {
    setShowForm(false)
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('client_id', clientId)
      .order('scheduled_date', { ascending: false })
    if (data) setFollowUps(data as FollowUp[])
  }

  const pending = followUps.filter((f) => !f.completed)
  const completed = followUps.filter((f) => f.completed)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {pending.length} pending · {completed.length} completed
        </p>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Follow-up
          </Button>
        )}
      </div>

      {showForm && (
        <FollowUpForm
          clientId={clientId}
          realtorId={realtorId}
          clientName={clientName}
          onSuccess={handleSuccess}
          onCancel={() => setShowForm(false)}
        />
      )}

      {followUps.length === 0 && !showForm ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No follow-ups scheduled yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Show pending first so actionable items are always at the top */}
          {[...pending, ...completed].map((fu) => (
            <FollowUpCard
              key={fu.id}
              followUp={fu}
              onDelete={handleDelete}
              onComplete={handleComplete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
