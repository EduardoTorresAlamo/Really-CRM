import { Resend } from 'resend'

/**
 * Escapes HTML special characters so realtor-authored subject/body text and
 * client names cannot inject markup into the email. Newlines are converted to
 * <br> after escaping so plain-text templates render with their line breaks.
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
 * Parameters for sending a single client-facing email (used by bulk send).
 */
interface ClientEmailParams {
  /** The client's email address. */
  to: string
  /** Email subject line (already placeholder-substituted, still raw text). */
  subject: string
  /** Email body as plain text with newlines (already placeholder-substituted). */
  body: string
  /** Realtor display name shown in the sign-off footer. */
  realtorName: string
}

/**
 * Sends a plain-text-style email to a client via Resend, wrapping the body in a
 * minimal branded HTML shell. Both subject and body are HTML-escaped; body
 * newlines become <br> so multi-paragraph templates render correctly.
 *
 * RESEND_FROM_EMAIL must be a verified sender in your Resend account.
 *
 * @param params - Recipient, subject, body, and realtor name.
 * @throws If Resend returns an error.
 */
export async function sendClientEmail({ to, subject, body, realtorName }: ClientEmailParams) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const safeBody = escapeHtml(body).replace(/\n/g, '<br />')
  const safeRealtorName = escapeHtml(realtorName)

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111827;">
        <p>${safeBody}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #6b7280;">${safeRealtorName} · Really CRM</p>
      </div>
    `,
  })

  if (error) throw new Error(error.message)
}
