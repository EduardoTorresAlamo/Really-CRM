'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PREDEFINED_TEMPLATES } from '@/lib/email/templates'
import type { EmailTemplate, PickableTemplate } from '@/types/emailTemplate'

/**
 * Props for the TemplatePicker component.
 */
interface TemplatePickerProps {
  /** Invoked with the chosen template when the realtor selects one. */
  onSelect: (template: PickableTemplate) => void
  /** Optional class applied to the <select> element. */
  className?: string
}

/**
 * A dropdown that lists predefined templates plus the realtor's custom templates
 * (fetched from Supabase on mount) and reports the selection to the parent.
 *
 * Shared by the follow-up form and the bulk-email modal. Selecting the blank
 * first option is a no-op so the picker can be reset without firing onSelect.
 *
 * @param props - TemplatePickerProps with the onSelect callback.
 * @returns The template picker JSX.
 */
export default function TemplatePicker({ onSelect, className }: TemplatePickerProps) {
  const [custom, setCustom] = useState<PickableTemplate[]>([])
  const [value, setValue] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('email_templates')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (!data) return
        setCustom(
          (data as EmailTemplate[]).map((t) => ({
            id: t.id,
            name: t.name,
            subject: t.subject,
            body: t.body,
            predefined: false,
          }))
        )
      })
  }, [])

  const all: PickableTemplate[] = [...PREDEFINED_TEMPLATES, ...custom]

  function handleChange(id: string) {
    setValue(id)
    const template = all.find((t) => t.id === id)
    if (template) onSelect(template)
  }

  return (
    <select
      aria-label="Choose a template"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className={
        className ??
        'w-full h-9 rounded-md border border-[#e4e4e8] bg-white px-2 text-sm text-[#4b4b55] focus:outline-none focus:ring-2 focus:ring-[#1863dc]/30'
      }
    >
      <option value="">Choose a template…</option>
      <optgroup label="Predefined">
        {PREDEFINED_TEMPLATES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </optgroup>
      {custom.length > 0 && (
        <optgroup label="My templates">
          {custom.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}
