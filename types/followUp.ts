export interface FollowUp {
  id: string
  client_id: string
  realtor_id: string
  scheduled_date: string  // ISO date string YYYY-MM-DD
  notes: string | null
  completed: boolean
  completed_at: string | null
  email_sent: boolean
  created_at: string
  updated_at: string
}

export type FollowUpInsert = Omit<FollowUp, 'id' | 'created_at' | 'updated_at'>
export type FollowUpUpdate = Partial<Pick<FollowUp, 'scheduled_date' | 'notes' | 'completed' | 'completed_at' | 'email_sent'>>
