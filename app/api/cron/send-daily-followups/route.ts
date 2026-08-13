import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'
import { sendFollowUpEmail } from '@/lib/resend/sendFollowUpEmail'
import { format, parseISO } from 'date-fns'

// GET /api/cron/send-daily-followups — Vercel Cron, daily at 13:00 UTC (vercel.json).
// Emails a reminder for every due/overdue, unsent follow-up across all realtors. Auth is a
// CRON_SECRET Bearer token compared in constant time. Uses the service-role key to bypass RLS.
// One failed email is logged but doesn't abort the rest. Response: { sent: number }.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 })
  }
  const authHeader = request.headers.get('authorization')
  const expected = `Bearer ${cronSecret}`
  // Length check first to avoid passing buffers of different sizes to timingSafeEqual,
  // which throws if byte lengths differ
  if (!authHeader || authHeader.length !== expected.length) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Constant-time comparison prevents an attacker from guessing the secret character by character
  if (!timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Service role key bypasses RLS -- required here because the cron job must read
  // follow-ups across all realtor accounts, not just one authenticated user's rows
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = format(new Date(), 'yyyy-MM-dd')

  // Fetch follow-ups that are not completed, not sent, and scheduled for today or earlier
  const { data: followUps } = await supabase
    .from('follow_ups')
    .select('*, clients(id, name), profiles(name, email)')
    .eq('completed', false)
    .eq('email_sent', false)
    .lte('scheduled_date', today)

  if (!followUps?.length) {
    return NextResponse.json({ sent: 0 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourapp.com'
  let sent = 0

  for (const fu of followUps) {
    const client = fu.clients as { id: string; name: string } | null
    const profile = fu.profiles as { name: string; email: string } | null

    if (!client || !profile?.email) continue

    try {
      // Send the follow-up email with relevant details
      await sendFollowUpEmail({
        to: profile.email,
        realtorName: profile.name,
        clientName: client.name,
        followUpDate: format(parseISO(fu.scheduled_date), 'MMMM d, yyyy'),
        notes: fu.notes,
        clientUrl: `${appUrl}/clients/${client.id}`,
      })

      // Mark the follow-up as sent in the database
      await supabase.from('follow_ups').update({ email_sent: true }).eq('id', fu.id)
      sent++
    } catch (err) {
      // One failed email shouldn't abort the rest — log it so it shows up in Vercel logs
      console.error(`Failed to send follow-up email for follow-up ${fu.id}:`, err)
    }
  }

  return NextResponse.json({ sent })
}