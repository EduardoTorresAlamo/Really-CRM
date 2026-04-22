import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClientForm from '@/components/clients/ClientForm'

export default async function NewClientPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Client</h1>
        <p className="text-sm text-muted-foreground">Create a new client profile</p>
      </div>
      <ClientForm userId={user.id} mode="create" />
    </div>
  )
}
