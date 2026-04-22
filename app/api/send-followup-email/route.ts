import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendFollowUpEmail } from '@/lib/resend/sendFollowUpEmail'
import { format, parseISO } from 'date-fns'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { followUpId } = await request.json()
  if (!followUpId) return NextResponse.json({ error: 'followUpId required' }, { status: 400 })

  // Fetch follow-up with client and profile
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
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
