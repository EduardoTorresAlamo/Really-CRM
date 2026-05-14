'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadFile } from '@/lib/storage/uploadFile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { DocType } from '@/types/document'

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: 'id', label: 'ID / Identification' },
  { value: 'pre_approval_letter', label: 'Pre-Approval Letter' },
  { value: 'contract', label: 'Contract' },
  { value: 'other', label: 'Other' },
]

interface DocumentUploadDialogProps {
  open: boolean
  onClose: () => void
  clientId: string
  realtorId: string
  onSuccess: () => void
}

export default function DocumentUploadDialog({
  open,
  onClose,
  clientId,
  realtorId,
  onSuccess,
}: DocumentUploadDialogProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [docType, setDocType] = useState<DocType>('other')
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
  }

  async function handleUpload() {
    if (!file) { toast.error('Please select a file'); return }

    setUploading(true)
    try {
      // Path convention: {realtorId}/{clientId}/{timestamp}_{filename}
      // Namespaced by realtor first so RLS bucket policies can be scoped per user
      const path = `${realtorId}/${clientId}/${Date.now()}_${file.name}`
      const fileUrl = await uploadFile('documents', path, file)

      const { error } = await supabase.from('documents').insert({
        client_id: clientId,
        realtor_id: realtorId,
        doc_type: docType,
        doc_status: 'received',
        file_url: fileUrl,
        file_name: file.name,
        notes: notes || null,
      })

      if (error) throw new Error(error.message)

      toast.success('Document uploaded')
      onSuccess()
      handleClose()
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Reset all local state on close so the dialog is clean if reopened
  function handleClose() {
    setFile(null)
    setDocType('other')
    setNotes('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Document Type</Label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {DOC_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>File</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
            />
            {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              rows={3}
              placeholder="Any notes about this document..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>Cancel</Button>
          <Button onClick={handleUpload} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
