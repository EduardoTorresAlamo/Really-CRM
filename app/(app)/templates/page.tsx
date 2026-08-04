import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TemplatesManager from '@/components/templates/TemplatesManager'
import type { EmailTemplate } from '@/types/emailTemplate'

/**
 * Email templates page.
 *
 * Loads the realtor's custom templates server-side (RLS-scoped) and hands them to
 * the interactive manager, which also renders the code-defined predefined set.
 *
 * @returns The templates page JSX.
 */
export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: templates } = await supabase
    .from('email_templates')
    .select('*')
    .eq('realtor_id', user.id)
    .order('name', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black">Email Templates</h1>
        <p className="text-xs text-[#93939f] mt-1 uppercase tracking-widest font-mono">
          Reusable emails with {'{{clientName}}'} and {'{{propertyAddress}}'} placeholders
        </p>
      </div>

      <TemplatesManager
        initialTemplates={(templates ?? []) as EmailTemplate[]}
        realtorId={user.id}
      />
    </div>
  )
}
