/**
 * Mirrors the `client_history` table row.
 * Rows are append-only and written after each significant client mutation
 * (create, edit, etc.) to provide a human-readable audit trail.
 */
export interface ClientHistory {
  id: string
  client_id: string
  realtor_id: string
  /** Short machine-readable event category, e.g. 'created', 'edited', 'note_added'. */
  event_type: string
  /** Human-readable sentence describing the event, displayed in the History tab. */
  description: string
  /** Optional structured data attached to the event for future use; currently unused. */
  metadata: Record<string, unknown> | null
  created_at: string
}
