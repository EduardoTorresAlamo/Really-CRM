import { Resend } from 'resend'

interface FollowUpEmailParams {
  to: string
  realtorName: string
  clientName: string
  followUpDate: string
  notes: string | null
  clientUrl: string
}

export async function sendFollowUpEmail({
  to,
  realtorName,
  clientName,
  followUpDate,
  notes,
  clientUrl,
}: FollowUpEmailParams) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: `Follow-up reminder: ${clientName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111827;">Follow-up Reminder</h2>
        <p>Hi ${realtorName},</p>
        <p>You have a follow-up scheduled for <strong>${clientName}</strong> on <strong>${followUpDate}</strong>.</p>
        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
        <p>
          <a href="${clientUrl}" style="display: inline-block; background: #111827; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
            View Client
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #6b7280;">Really CRM · Real Estate Client Manager</p>
      </div>
    `,
  })

  if (error) throw new Error(error.message)
}
