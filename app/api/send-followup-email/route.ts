import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendFollowUpEmail } from '@/lib/resend/sendFollowUpEmail'
import { format, parseISO } from 'date-fns'

/**
 * POST /api/send-followup-email
 *
 * Manually triggers a follow-up reminder email for a specific follow-up record.
 * Called from the "Email" button on a FollowUpCard in the client UI.
 *
 * This route exists as a server-side proxy so the Resend API key and email logic
 * stay server-side and are never exposed to the browser.
 *
 * The follow-up is fetched with .eq('realtor_id', user.id) to ensure a realtor
 * can only email reminders for their own clients (RLS-equivalent enforcement at
 * the query level, since this uses the anon key).
 *
 * On success, sets email_sent = true on the follow-up row so the cron job skips
 * it during the next daily run.
 *
 * Request body: { followUpId: string }
 * Response: { success: true } or { error: string }
 *
 * @param request - The incoming Next.js request object.
 * @returns JSON success or error response.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { followUpId } = await request.json()
  if (!followUpId) return NextResponse.json({ error: 'followUpId required' }, { status: 400 })

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
