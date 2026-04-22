export interface ClientHistory {
  id: string
  client_id: string
  realtor_id: string
  event_type: string
  description: string
  metadata: Record<string, unknown> | null
  created_at: string
}
