import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parsePropertyListing, matchClientsToProperty } from '@/lib/claude/propertyMatch'
import type { Client } from '@/types/client'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url } = await request.json()
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  // Validate URL format
  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    // Step 1: Parse the property listing
    const property = await parsePropertyListing(url)

    // Step 2: Fetch active buyer clients for this realtor
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('realtor_id', user.id)
      .eq('client_type', 'buyer')
      .eq('status', 'active')

    if (clientsError) {
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
    }

    const buyerClients = (clients ?? []) as Client[]

    // Step 3: Match clients to the property
    const matches = await matchClientsToProperty(property, buyerClients)

    return NextResponse.json({ property, matches })
  } catch (err) {
    console.error('Property match error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process listing' },
      { status: 502 }
    )
  }
}
