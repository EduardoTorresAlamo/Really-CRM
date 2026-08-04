import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ClientStatusBadge from '@/components/clients/ClientStatusBadge'
import ClientTypeBadge from '@/components/clients/ClientTypeBadge'
import InfoTab from '@/components/clients/tabs/InfoTab'
import DocumentsTab from '@/components/clients/tabs/DocumentsTab'
import FollowUpsTab from '@/components/clients/tabs/FollowUpsTab'
import HistoryTab from '@/components/clients/tabs/HistoryTab'
import type { Client } from '@/types/client'
import type { Document } from '@/types/document'
import type { FollowUp } from '@/types/followUp'
import type { ClientHistory } from '@/types/clientHistory'

/**
 * Client detail page showing all information about a single client.
 *
 * Loads the client, their documents, follow-ups, and activity history in parallel
 * to avoid sequential database round-trips. All queries are scoped to the
 * authenticated realtor via the realtor_id column, which mirrors the RLS policy --
 * if a realtor tries to access another realtor's client by guessing the UUID,
 * the query returns no data and the page renders a 404.
 *
 * params is a Promise in Next.js 16 App Router and must be awaited.
 *
 * @param params - Promise resolving to route parameters including the client UUID.
 * @returns The client detail page JSX with tabbed content.
 */
export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // All four queries are independent — run concurrently to avoid round-trip waterfall
  const [clientResult, docsResult, followUpsResult, historyResult] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).eq('realtor_id', user.id).single(),
    supabase.from('documents').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    supabase.from('follow_ups').select('*').eq('client_id', id).order('scheduled_date', { ascending: false }),
    supabase.from('client_history').select('*').eq('client_id', id).order('created_at', { ascending: false }),
  ])

  // No data means either the client doesn't exist or RLS blocked access — either way, 404
  if (!clientResult.data) notFound()

  const client = clientResult.data as Client
  const docs = (docsResult.data ?? []) as Document[]
  const followUps = (followUpsResult.data ?? []) as FollowUp[]
  const history = (historyResult.data ?? []) as ClientHistory[]

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <ClientTypeBadge type={client.client_type} />
            <ClientStatusBadge status={client.status} />
          </div>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="documents">
            Documents {docs.length > 0 && <span className="ml-1 text-xs">({docs.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="followups">
            Follow-ups {followUps.filter((f) => !f.completed).length > 0 && (
              <span className="ml-1 text-xs">({followUps.filter((f) => !f.completed).length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <InfoTab client={client} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsTab initialDocs={docs} clientId={id} realtorId={user.id} />
        </TabsContent>

        <TabsContent value="followups" className="mt-4">
          <FollowUpsTab initialFollowUps={followUps} clientId={id} clientName={client.name} realtorId={user.id} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryTab history={history} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
