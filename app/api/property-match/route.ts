import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parsePropertyListing, matchClientsToProperty } from '@/lib/claude/propertyMatch'
import { isRateLimited } from '@/lib/rateLimit'
import type { Client } from '@/types/client'

/**
 * POST /api/property-match
 *
 * Accepts a property listing URL and orchestrates two sequential Claude API calls:
 *   1. parsePropertyListing  -- extracts structured fields from the URL.
 *   2. matchClientsToProperty -- ranks the realtor's active buyer clients against that property.
 *
 * Request body: { url: string }
 * Response: { property: ParsedProperty, matches: MatchResult[] }
 *
 * Rate limited to 10 requests per user per minute to cap Claude API spend.
 * Returns 401 if the session cookie is absent or expired (auth via Supabase RLS).
 * Returns 502 if either Claude call fails, so callers can show a generic error.
 *
 * @param request - The incoming Next.js request object.
 * @returns JSON response with the parsed property and ranked client matches.
 */
// POST { url: string } -> { property: ParsedProperty, matches: MatchResult[] }
// Orchestrates two Claude calls: first to parse the listing, then to rank active buyer clients against it
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
      { error: 'Failed to process listing' },
      { status: 502 }
    )
  }
}
