import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClientForm from '@/components/clients/ClientForm'
import type { Client } from '@/types/client'

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
