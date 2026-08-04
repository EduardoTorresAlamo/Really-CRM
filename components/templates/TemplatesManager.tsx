'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PREDEFINED_TEMPLATES } from '@/lib/email/templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { EmailTemplate } from '@/types/emailTemplate'

/**
 * Props for the TemplatesManager component.
 */
interface TemplatesManagerProps {
  /** Custom templates loaded server-side for this realtor. */
  initialTemplates: EmailTemplate[]
  /** The authenticated realtor's id, stored as realtor_id on inserts. */
  realtorId: string
}

/** Local form state for the create/edit template editor. */
interface Draft {
  id: string | null
  name: string
  subject: string
  body: string
}

const EMPTY_DRAFT: Draft = { id: null, name: '', subject: '', body: '' }

/**
 * Manages email templates: shows the read-only predefined set and full CRUD over
 * the realtor's custom templates (persisted to the `email_templates` table).
 *
 * Placeholders `{{clientName}}` and `{{propertyAddress}}` are documented inline so
 * authors know which tokens the send flow will substitute.
 *
 * @param props - TemplatesManagerProps with initial custom templates and realtor id.
 * @returns The templates management UI.
 */
export default function TemplatesManager({ initialTemplates, realtorId }: TemplatesManagerProps) {
  const supabase = createClient()
  const [templates, setTemplates] = useState<EmailTemplate[]>(initialTemplates)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!draft) return
    if (!draft.name.trim() || !draft.subject.trim() || !draft.body.trim()) {
      toast.error('Name, subject, and body are required')
      return
    }
    setSaving(true)

    if (draft.id) {
      const { data, error } = await supabase
        .from('email_templates')
        .update({ name: draft.name, subject: draft.subject, body: draft.body })
        .eq('id', draft.id)
        .select()
        .single()
      setSaving(false)
      if (error || !data) { toast.error('Failed to update template'); return }
      setTemplates((prev) => prev.map((t) => (t.id === draft.id ? (data as EmailTemplate) : t)))
    } else {
      const { data, error } = await supabase
        .from('email_templates')
        .insert({ realtor_id: realtorId, name: draft.name, subject: draft.subject, body: draft.body })
        .select()
        .single()
      setSaving(false)
      if (error || !data) { toast.error('Failed to create template'); return }
      setTemplates((prev) => [...prev, data as EmailTemplate])
    }
    toast.success('Template saved')
    setDraft(null)
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('email_templates').delete().eq('id', id)
    if (error) { toast.error('Failed to delete template'); return }
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    toast.success('Template deleted')
  }

  return (
    <div className="space-y-8">
      {/* Editor */}
      {draft ? (
        <div className="space-y-4 rounded-[18px] border border-[#d9d9dd] bg-white p-6">
          <h2 className="text-sm font-mono uppercase tracking-widest text-[#93939f]">
            {draft.id ? 'Edit template' : 'New template'}
          </h2>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Weekly Check-in"
            />
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              placeholder="Subject line — {{clientName}} / {{propertyAddress}} allowed"
            />
          </div>
          <div className="space-y-2">
            <Label>Body</Label>
            <Textarea
              rows={8}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder="Use {{clientName}} and {{propertyAddress}} where you want them substituted."
            />
            <p className="text-xs text-[#93939f]">
              Placeholders: <code className="font-mono">{'{{clientName}}'}</code> and{' '}
              <code className="font-mono">{'{{propertyAddress}}'}</code>
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDraft(null)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setDraft(EMPTY_DRAFT)}>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      )}

      {/* Custom templates */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-[#93939f]">My Templates</h2>
        {templates.length === 0 ? (
          <p className="text-sm text-[#93939f]">No custom templates yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((t) => (
              <div key={t.id} className="rounded-[14px] border border-[#d9d9dd] bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-black truncate">{t.name}</p>
                    <p className="text-xs text-[#93939f] truncate mt-0.5">{t.subject}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label="Edit template"
                      onClick={() => setDraft({ id: t.id, name: t.name, subject: t.subject, body: t.body })}
                      className="h-8 w-8 grid place-items-center rounded-md text-[#93939f] hover:text-black hover:bg-[#f2f2f2] transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete template"
                      onClick={() => handleDelete(t.id)}
                      className="h-8 w-8 grid place-items-center rounded-md text-[#93939f] hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[#93939f] mt-2 line-clamp-3 whitespace-pre-line">{t.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Predefined templates (read-only) */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-[#93939f]">Predefined</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PREDEFINED_TEMPLATES.map((t) => (
            <div key={t.id} className="rounded-[14px] border border-[#e4e4e8] bg-[#fafafa] p-4">
              <p className="text-sm font-medium text-black">{t.name}</p>
              <p className="text-xs text-[#93939f] truncate mt-0.5">{t.subject}</p>
              <p className="text-xs text-[#93939f] mt-2 line-clamp-3 whitespace-pre-line">{t.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
