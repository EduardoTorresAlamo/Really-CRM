import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import ClientTypeBadge from '@/components/clients/ClientTypeBadge'
import ClientStatusBadge from '@/components/clients/ClientStatusBadge'
import { ArrowRight, Users } from 'lucide-react'
import type { Client } from '@/types/client'

export default function RecentClients({ clients }: { clients: Client[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Recent Clients</CardTitle>
        <Users className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No clients yet.{' '}
            <Link href="/clients/new" className="underline">Add your first one.</Link>
          </p>
        ) : (
          <div className="space-y-0">
            {clients.map((client) => (
              <div key={client.id} className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{client.name}</p>
                  </div>
                  <ClientTypeBadge type={client.client_type} />
                  <ClientStatusBadge status={client.status} />
                </div>
                <Link href={`/clients/${client.id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'shrink-0')}>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
