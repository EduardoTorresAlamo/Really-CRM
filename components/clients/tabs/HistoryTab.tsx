import { format, parseISO } from 'date-fns'
import type { ClientHistory } from '@/types/clientHistory'

/**
 * Props for the HistoryTab component.
 */
interface HistoryTabProps {
  /** Chronological list of history events for this client, newest first. */
  history: ClientHistory[]
}

/**
 * History tab within the client detail page.
 *
 * Renders an ordered timeline of client_history events (created, edited, etc.)
 * with a vertical connector line between entries to visually indicate sequence.
 *
 * @param props - HistoryTabProps containing the history event array.
 * @returns The history timeline JSX, or an empty-state message.
 */
export default function HistoryTab({ history }: HistoryTabProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No history recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {history.map((event, idx) => (
        <div key={event.id} className="flex gap-4 py-3">
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1 shrink-0" />
            {idx < history.length - 1 && (
              <div className="flex-1 w-px bg-gray-200 mt-1" />
            )}
          </div>
          <div className="pb-3 min-w-0">
            <p className="text-sm font-medium text-gray-900">{event.description}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(parseISO(event.created_at), 'MMM d, yyyy · h:mm a')}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
