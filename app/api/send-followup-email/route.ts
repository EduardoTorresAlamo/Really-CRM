import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendFollowUpEmail } from '@/lib/resend/sendFollowUpEmail'
import { format, parseISO } from 'date-fns'

// POST /api/send-followup-email { followUpId } — manually emails a single follow-up reminder
// (the "Email" button on a FollowUpCard). Server-side so the Resend key stays off the browser.
// Scoped with .eq('realtor_id', user.id) so a realtor can only email their own follow-ups, and
// sets email_sent = true so the daily cron skips it.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // request.json() throws on a malformed body -- return 400 instead of an unhandled 500
  let body: { followUpId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { followUpId } = body
  if (!followUpId || typeof followUpId !== 'string') {
    return NextResponse.json({ error: 'followUpId required' }, { status: 400 })
  }

  // Join clients and profiles in one query to get the realtor email and client name
  // .eq('realtor_id', user.id) scopes the query to the authenticated realtor's data
  const { data: followUp, error: fuError } = await supabase
    .from('follow_ups')
    .select('*, clients(name, id), profiles(name, email)')
    .eq('id', followUpId)
    .eq('realtor_id', user.id)
    .single()

  if (fuError || !followUp) {
    return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 })
  }

  const client = followUp.clients as { name: string; id: string }
  const profile = followUp.profiles as { name: string; email: string }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    await sendFollowUpEmail({
      to: profile.email,
      realtorName: profile.name,
      clientName: client.name,
      followUpDate: format(parseISO(followUp.scheduled_date), 'MMMM d, yyyy'),
      notes: followUp.notes,
      clientUrl: `${appUrl}/clients/${client.id}`,
    })

    await supabase.from('follow_ups').update({ email_sent: true }).eq('id', followUpId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[send-followup-email]', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
