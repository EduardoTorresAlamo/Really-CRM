'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import DocumentStatusBadge from './DocumentStatusBadge'
import { toast } from 'sonner'
import { FileText, Trash2, Download } from 'lucide-react'
import type { Document, DocStatus } from '@/types/document'

const DOC_TYPE_LABELS: Record<string, string> = {
  id: 'ID / Identification',
  pre_approval_letter: 'Pre-Approval Letter',
  contract: 'Contract',
  other: 'Other',
}

interface DocumentCardProps {
  doc: Document
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: DocStatus) => void
}

export default function DocumentCard({ doc, onDelete, onStatusChange }: DocumentCardProps) {
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('Delete this document?')) return
    setDeleting(true)
    const { error } = await supabase.from('documents').delete().eq('id', doc.id)
    if (error) { toast.error('Failed to delete'); setDeleting(false); return }
    toast.success('Document deleted')
    onDelete(doc.id)
  }

  async function handleStatusChange(status: DocStatus) {
    const { error } = await supabase.from('documents').update({ doc_status: status }).eq('id', doc.id)
    if (error) { toast.error('Failed to update status'); return }
    onStatusChange(doc.id, status)
    toast.success('Status updated')
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{doc.file_name ?? 'Document'}</p>
              <p className="text-xs text-muted-foreground">{DOC_TYPE_LABELS[doc.doc_type]}</p>
            </div>
          </div>
          <DocumentStatusBadge status={doc.doc_status} />
        </div>

        {doc.notes && (
          <p className="text-xs text-muted-foreground bg-gray-50 rounded p-2">{doc.notes}</p>
        )}

        <div className="flex items-center justify-between gap-2">
          <select
            value={doc.doc_status}
            onChange={(e) => handleStatusChange(e.target.value as DocStatus)}
            className="text-xs h-7 rounded border border-input bg-background px-2"
          >
            <option value="pending">Pending</option>
            <option value="received">Received</option>
            <option value="verified">Verified</option>
          </select>
          <div className="flex gap-1">
            {doc.file_url && (
              <a
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            )}
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
