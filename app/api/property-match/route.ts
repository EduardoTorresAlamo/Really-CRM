import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parsePropertyListing, matchClientsToProperty } from '@/lib/claude/propertyMatch'
import { isRateLimited } from '@/lib/rateLimit'
import { assertUrlAllowed, SsrfError } from '@/lib/security/ssrf'
import type { Client } from '@/types/client'

// POST /api/property-match { url } -> { property: ParsedProperty, matches: MatchResult[] }
// Parses the listing then ranks the realtor's active buyer clients against it (local algorithm,
// no external API). Rate limited to 10/min per user. 401 if unauthenticated, 502 on failure.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit keyed per user so one account can't monopolize Claude API quota
  if (isRateLimited(`property-match:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  // request.json() throws on a malformed body -- return 400 instead of an unhandled 500
  let body: { url?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { url } = body
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  // Validate URL format AND block SSRF (private IPs, non-http protocols, metadata endpoint)
  try {
    await assertUrlAllowed(url)
  } catch (err) {
    if (err instanceof SsrfError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
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
      { error: 'Failed to process listing' },
      { status: 502 }
    )
  }
}
