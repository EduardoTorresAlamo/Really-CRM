import { Resend } from 'resend'

// Escapes HTML so realtor-authored subject/body and client names can't inject markup.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Params are already placeholder-substituted but still raw (unescaped) text.
interface ClientEmailParams {
  to: string
  subject: string
  body: string
  realtorName: string
}

// Sends a client email via Resend in a minimal branded HTML shell. Subject/body are escaped and
// body newlines become <br>. RESEND_FROM_EMAIL must be a verified sender. Throws on Resend errors.
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
