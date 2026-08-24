'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { DocStatus } from '@/types/document'

export type DocumentActionResult = { ok: true } | { ok: false; error: string }

/** Deletes a document the current realtor owns. */
export async function deleteDocumentAction(
  id: string,
  clientId: string
): Promise<DocumentActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('realtor_id', user.id)
  if (error) return { ok: false, error: 'Failed to delete' }

  revalidatePath(`/clients/${clientId}`)
  return { ok: true }
}

/** Updates a document's verification status for a document the current realtor owns. */
export async function updateDocumentStatusAction(
  id: string,
  clientId: string,
  status: DocStatus
): Promise<DocumentActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('documents')
    .update({ doc_status: status })
    .eq('id', id)
    .eq('realtor_id', user.id)
  if (error) return { ok: false, error: 'Failed to update status' }

  revalidatePath(`/clients/${clientId}`)
  return { ok: true }
}
