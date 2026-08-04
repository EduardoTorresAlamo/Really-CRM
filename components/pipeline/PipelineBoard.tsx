'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Client, ClientStage } from '@/types/client'

/**
 * The ordered pipeline stages and their display labels. Order defines the
 * left-to-right column layout and the "move left / move right" arrow targets.
 */
const STAGES: { value: ClientStage; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'showing', label: 'Showing' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'closed', label: 'Closed' },
  { value: 'lost', label: 'Lost' },
]

/**
 * Props for the PipelineBoard component.
 */
interface PipelineBoardProps {
  /** All clients for the realtor, loaded server-side. */
  initialClients: Client[]
}

/**
 * Interactive 6-column Kanban board.
 *
 * Each card exposes a stage <select> for a direct jump to any stage plus ◀/▶
 * buttons to nudge between adjacent stages ("click-to-move"). Every move updates
 * local state optimistically and writes `stage` back to Supabase; on failure the
 * change is rolled back and a toast is shown.
 *
 * @param props - PipelineBoardProps with the initial client list.
 * @returns The Kanban board JSX.
 */
export default function PipelineBoard({ initialClients }: PipelineBoardProps) {
  const supabase = createClient()
  const [clients, setClients] = useState<Client[]>(initialClients)

  /**
   * Moves a client to a new stage, optimistically updating the UI and persisting
   * to Supabase. Reverts on error.
   */
  async function moveTo(client: Client, stage: ClientStage) {
    if (stage === client.stage) return
    const previous = client.stage
    setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, stage } : c)))

    const { error } = await supabase
      .from('clients')
      .update({ stage })
      .eq('id', client.id)

    if (error) {
      setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, stage: previous } : c)))
      toast.error('Failed to move client')
      return
    }
    toast.success(`${client.name} → ${STAGES.find((s) => s.value === stage)?.label}`)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STAGES.map((stage, stageIndex) => {
        const columnClients = clients.filter((c) => c.stage === stage.value)
        return (
          <div key={stage.value} className="flex-shrink-0 w-72">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-mono uppercase tracking-widest text-[#93939f]">
                {stage.label}
              </span>
              <span className="text-xs font-mono text-[#93939f]">{columnClients.length}</span>
            </div>

            <div className="space-y-2 min-h-24 rounded-[18px] bg-[#f7f7f8] p-2">
              {columnClients.length === 0 && (
                <p className="text-center text-xs text-[#c4c4cc] py-6">No clients</p>
              )}
              {columnClients.map((client) => (
                <div
                  key={client.id}
                  className="rounded-[14px] border border-[#e4e4e8] bg-white p-3 shadow-sm"
                >
                  <Link
                    href={`/clients/${client.id}`}
                    className="text-sm font-medium text-black hover:text-[#1863dc] transition-colors"
                  >
                    {client.name}
                  </Link>
                  {client.email && (
                    <p className="text-xs text-[#93939f] mt-0.5 truncate">{client.email}</p>
                  )}

                  <div className="flex items-center gap-1 mt-3">
                    <button
                      type="button"
                      aria-label="Move to previous stage"
                      disabled={stageIndex === 0}
                      onClick={() => moveTo(client, STAGES[stageIndex - 1].value)}
                      className="h-7 w-7 rounded-md border border-[#e4e4e8] text-[#93939f] hover:text-black hover:bg-[#f2f2f2] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      ◀
                    </button>
                    <select
                      aria-label="Move client to stage"
                      value={client.stage}
                      onChange={(e) => moveTo(client, e.target.value as ClientStage)}
                      className="flex-1 h-7 rounded-md border border-[#e4e4e8] bg-white px-2 text-xs text-[#4b4b55] focus:outline-none focus:ring-2 focus:ring-[#1863dc]/30"
                    >
                      {STAGES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label="Move to next stage"
                      disabled={stageIndex === STAGES.length - 1}
                      onClick={() => moveTo(client, STAGES[stageIndex + 1].value)}
                      className={cn(
                        'h-7 w-7 rounded-md border border-[#e4e4e8] text-[#93939f] hover:text-black hover:bg-[#f2f2f2] disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
                      )}
                    >
                      ▶
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
