import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClientForm from '@/components/clients/ClientForm'
import type { Client } from '@/types/client'

/**
 * Edit client page -- pre-populates ClientForm with the existing client data.
 *
 * Fetches the client row scoped to both the client UUID and the authenticated
 * realtor's ID, so a realtor cannot edit another realtor's client even if they
 * know the UUID. Returns 404 if not found (same response for "doesn't exist"
 * and "not yours" to avoid disclosing UUID existence).
 *
 * params is a Promise in Next.js 16 App Router and must be awaited.
 *
 * @param params - Promise resolving to route parameters including the client UUID.
 * @returns The edit client page JSX.
 */
export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // .eq('realtor_id', user.id) ensures the realtor can only edit their own clients
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('realtor_id', user.id)
    .single()

  if (!client) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Client</h1>
        <p className="text-sm text-muted-foreground">{client.name}</p>
      </div>
      <ClientForm client={client as Client} userId={user.id} mode="edit" />
    </div>
  )
}
