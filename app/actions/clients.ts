'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  ClientType,
  ClientStatus,
  SaleType,
  PropertyType,
} from '@/types/client'

/**
 * Fields the client form submits. realtor_id is deliberately absent — the server derives
 * it from the authenticated session so the browser can never write another realtor's rows.
 */
export interface ClientInput {
  name: string
  email: string | null
  phone: string | null
  client_type: ClientType
  status: ClientStatus
  sale_type: SaleType | null
  budget_min: number | null
  budget_max: number | null
  bedrooms_min: number | null
  bedrooms_max: number | null
  bathrooms_min: number | null
  bathrooms_max: number | null
  notes: string | null
  property_types: PropertyType[] | null
  preferred_locations: string[] | null
}

export type ClientActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

/** Inserts a client scoped to the current realtor and logs a "created" history row. */
export async function createClientAction(input: ClientInput): Promise<ClientActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('clients')
    .insert({ ...input, realtor_id: user.id })
    .select()
    .single()
  if (error || !data) return { ok: false, error: 'Failed to create client' }

  await supabase.from('client_history').insert({
    client_id: data.id,
    realtor_id: user.id,
    event_type: 'created',
    description: `Client "${input.name}" was created`,
  })

  revalidatePath('/clients')
  return { ok: true, id: data.id }
}

/** Updates a client the current realtor owns and logs an "edited" history row. */
export async function updateClientAction(
  id: string,
  input: ClientInput
): Promise<ClientActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  // .eq('realtor_id', user.id) + RLS keep the update scoped to the owner
  const { error } = await supabase
    .from('clients')
    .update({ ...input, realtor_id: user.id })
    .eq('id', id)
    .eq('realtor_id', user.id)
  if (error) return { ok: false, error: 'Failed to update client' }

  await supabase.from('client_history').insert({
    client_id: id,
    realtor_id: user.id,
    event_type: 'edited',
    description: 'Client profile was updated',
  })

  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  return { ok: true, id }
}
