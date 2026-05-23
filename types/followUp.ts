/** Mirrors the `follow_ups` table row. */
export interface FollowUp {
  id: string
  client_id: string
  realtor_id: string
  /** ISO date string (YYYY-MM-DD). Date-only -- no time component -- to avoid timezone drift. */
  scheduled_date: string
  notes: string | null
  /** True once the realtor has marked the follow-up as done. */
  completed: boolean
  /** ISO timestamp of when the follow-up was marked complete; null if still pending. */
  completed_at: string | null
  /** True if a reminder email has been sent (either manually or by the daily cron job). */
  email_sent: boolean
  created_at: string
  updated_at: string
}

/** Shape for inserting a new follow-up row; server-generated fields are omitted. */
export type FollowUpInsert = Omit<FollowUp, 'id' | 'created_at' | 'updated_at'>

/** Shape for updating a follow-up row; only mutable fields are included. */
export type FollowUpUpdate = Partial<Pick<FollowUp, 'scheduled_date' | 'notes' | 'completed' | 'completed_at' | 'email_sent'>>
