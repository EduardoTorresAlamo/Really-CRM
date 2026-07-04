import { Resend } from 'resend'

/**
 * Escapes HTML special characters so user-entered values (names, notes)
 * cannot inject markup into the email body.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Parameters required to render and send a follow-up reminder email.
 */
interface FollowUpEmailParams {
  /** The realtor's email address to deliver the reminder to. */
  to: string
  /** The realtor's display name used in the email greeting. */
  realtorName: string
  /** The client's name shown in the subject line and body. */
  clientName: string
  /** Human-readable follow-up date string, e.g. "June 5, 2025". */
  followUpDate: string
  /** Optional follow-up notes displayed in the email body. Null means no notes section. */
  notes: string | null
  /** Absolute URL to the client detail page, embedded as the CTA button href. */
  clientUrl: string
}

/**
 * Sends a follow-up reminder email to a realtor via the Resend API.
 *
 * The email is rendered as inline HTML (no external template engine) and includes
 * the client's name, the scheduled follow-up date, optional notes, and a deep link
 * button back to the client profile.
 *
 * RESEND_FROM_EMAIL must be set to a verified sender address or domain in your
 * Resend account, otherwise the API call will fail with a 422 error.
 *
 * @param params - Email recipient, template variables, and deep link URL.
 * @throws If Resend returns an error (e.g. unverified sender, invalid recipient).
 */
// RESEND_FROM_EMAIL must be a verified sender address or domain in your Resend account
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
