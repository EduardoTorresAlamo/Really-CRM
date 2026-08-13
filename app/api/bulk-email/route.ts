import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendClientEmail } from '@/lib/resend/sendClientEmail'
import { applyTemplate } from '@/lib/email/templates'
import { isRateLimited } from '@/lib/rateLimit'
import type { Client } from '@/types/client'

/** Maximum recipients accepted in a single bulk-email request. */
const MAX_RECIPIENTS = 100

// POST /api/bulk-email { clientIds, subject, body } — sends one templated email per client via
// Resend and logs a client_history row per success. Clients are re-fetched with
// .eq('realtor_id', user.id) so posted ids are never trusted. Templating: {{clientName}} and
// {{propertyAddress}} (first preferred location). Response: { sent, skipped }.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // One bulk send per 10s per realtor keeps a stray double-click from double-emailing.
  if (isRateLimited(`bulk-email:${user.id}`, 1, 10_000)) {
    return NextResponse.json({ error: 'Please wait a moment before sending again' }, { status: 429 })
  }

  let body: { clientIds?: unknown; subject?: unknown; body?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { clientIds, subject, body: messageBody } = body
  if (!Array.isArray(clientIds) || clientIds.length === 0) {
    return NextResponse.json({ error: 'clientIds required' }, { status: 400 })
  }
  if (clientIds.length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `Too many recipients (max ${MAX_RECIPIENTS})` }, { status: 400 })
  }
  if (!clientIds.every((id): id is string => typeof id === 'string')) {
    return NextResponse.json({ error: 'clientIds must be strings' }, { status: 400 })
  }
  if (typeof subject !== 'string' || !subject.trim()) {
    return NextResponse.json({ error: 'subject required' }, { status: 400 })
  }
  if (typeof messageBody !== 'string' || !messageBody.trim()) {
    return NextResponse.json({ error: 'body required' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  // Scope to the realtor's own clients — posted ids alone are never trusted.
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*')
    .eq('realtor_id', user.id)
    .in('id', clientIds)

  if (clientsError) {
    return NextResponse.json({ error: 'Failed to load clients' }, { status: 500 })
  }

  const realtorName = profile?.name ?? 'Your Realtor'
  let sent = 0
  let skipped = 0

  for (const client of (clients ?? []) as Client[]) {
    if (!client.email) { skipped++; continue }
    const vars = {
      clientName: client.name,
      propertyAddress: client.preferred_locations?.[0] ?? null,
    }
    try {
      await sendClientEmail({
        to: client.email,
        subject: applyTemplate(subject, vars),
        body: applyTemplate(messageBody, vars),
        realtorName,
      })
      await supabase.from('client_history').insert({
        client_id: client.id,
        realtor_id: user.id,
        event_type: 'email',
        description: `Bulk email sent: ${applyTemplate(subject, vars)}`,
        metadata: { channel: 'bulk_email' },
      })
      sent++
    } catch (err) {
      console.error('[bulk-email] send failed for', client.id, err)
      skipped++
    }
  }

  return NextResponse.json({ sent, skipped })
}
