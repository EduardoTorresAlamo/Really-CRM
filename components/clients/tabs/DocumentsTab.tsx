'use client'

import { useState } from 'react'
import DocumentCard from '@/components/documents/DocumentCard'
import DocumentUploadDialog from '@/components/documents/DocumentUploadDialog'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import type { Document, DocStatus } from '@/types/document'

interface DocumentsTabProps {
  initialDocs: Document[]
  clientId: string
  realtorId: string
}

export default function DocumentsTab({ initialDocs, clientId, realtorId }: DocumentsTabProps) {
  const [docs, setDocs] = useState<Document[]>(initialDocs)
  const [uploadOpen, setUploadOpen] = useState(false)

  function handleDelete(id: string) {
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  function handleStatusChange(id: string, status: DocStatus) {
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, doc_status: status } : d))
    )
  }

  async function handleUploadSuccess() {
    // Re-fetch docs (simple: reload)
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
