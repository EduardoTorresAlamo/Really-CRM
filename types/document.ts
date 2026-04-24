export type DocType = 'id' | 'pre_approval_letter' | 'contract' | 'other'
export type DocStatus = 'pending' | 'received' | 'verified'

/** Mirrors the `documents` table row. file_url points to Supabase Storage (private bucket). */
export interface Document {
  id: string
  client_id: string
  realtor_id: string
  doc_type: DocType
  doc_status: DocStatus
  file_url: string | null
  file_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type DocumentInsert = Omit<Document, 'id' | 'created_at' | 'updated_at'>
export type DocumentUpdate = Partial<Pick<Document, 'doc_status' | 'notes' | 'file_url' | 'file_name'>>
