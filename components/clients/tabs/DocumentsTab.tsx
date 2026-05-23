'use client'

import { useState } from 'react'
import DocumentCard from '@/components/documents/DocumentCard'
import DocumentUploadDialog from '@/components/documents/DocumentUploadDialog'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import type { Document, DocStatus } from '@/types/document'

/**
 * Props for the DocumentsTab component.
 */
interface DocumentsTabProps {
  /** Documents already loaded server-side for this client. */
  initialDocs: Document[]
  /** The UUID of the client these documents belong to. */
  clientId: string
  /** The authenticated realtor's user ID, used for RLS-scoped queries and storage paths. */
  realtorId: string
}

/**
 * Documents tab within the client detail page.
 *
 * Manages local document state optimistically -- deletions and status changes
 * are applied to local state immediately after the Supabase mutation succeeds,
 * without re-fetching the full list. Uploads trigger a full re-fetch to get the
 * server-generated id and timestamps.
 *
 * @param props - DocumentsTabProps including initial documents and identifiers.
 * @returns The documents tab JSX with upload dialog and document grid.
 */
export default function DocumentsTab({ initialDocs, clientId, realtorId }: DocumentsTabProps) {
  const [docs, setDocs] = useState<Document[]>(initialDocs)
  const [uploadOpen, setUploadOpen] = useState(false)

  /**
   * Removes a document from local state after it has been deleted from the database.
   *
   * @param id - The UUID of the deleted document.
   */
  function handleDelete(id: string) {
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  /**
   * Updates a single document's status in local state after the database write succeeds.
   *
   * @param id - The UUID of the document whose status changed.
   * @param status - The new document status.
   */
  function handleStatusChange(id: string, status: DocStatus) {
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, doc_status: status } : d))
    )
  }

  /**
   * Re-fetches the full document list after a successful upload to get server-generated
   * fields (id, created_at) that aren't available optimistically.
   *
   * Supabase client is imported dynamically to avoid instantiating it at module load time.
   */
  async function handleUploadSuccess() {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (data) setDocs(data as Document[])
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {docs.length} document{docs.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No documents yet. Upload the first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {docs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      <DocumentUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        clientId={clientId}
        realtorId={realtorId}
        onSuccess={handleUploadSuccess}
      />
    </div>
  )
}
