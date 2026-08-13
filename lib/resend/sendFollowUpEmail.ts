import { Resend } from 'resend'

// Escapes HTML so user-entered values (names, notes) can't inject markup into the email body.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface FollowUpEmailParams {
  to: string
  realtorName: string
  clientName: string
  followUpDate: string
  notes: string | null // null = omit the notes section
  clientUrl: string // deep link, used as the CTA button href
}

// Sends a follow-up reminder email via Resend. RESEND_FROM_EMAIL must be a verified
// sender address/domain or the call fails with a 422. Throws on Resend errors.
export async function sendFollowUpEmail({
  to,
  realtorName,
  clientName,
  followUpDate,
  notes,
  clientUrl,
}: FollowUpEmailParams) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  // Escape user-entered values before interpolating into the HTML body
  // (client names and notes are free text -- without this they can inject markup)
  const safeRealtorName = escapeHtml(realtorName)
  const safeClientName = escapeHtml(clientName)
  const safeNotes = notes ? escapeHtml(notes) : null
  const safeClientUrl = escapeHtml(clientUrl)
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: `Follow-up reminder: ${clientName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111827;">Follow-up Reminder</h2>
        <p>Hi ${safeRealtorName},</p>
        <p>You have a follow-up scheduled for <strong>${safeClientName}</strong> on <strong>${followUpDate}</strong>.</p>
        ${safeNotes ? `<p><strong>Notes:</strong> ${safeNotes}</p>` : ''}
        <p>
          <a href="${safeClientUrl}" style="display: inline-block; background: #111827; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
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
