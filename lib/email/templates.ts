import type { PickableTemplate } from '@/types/emailTemplate'

/**
 * Supported placeholder tokens. Any `{{token}}` in a template subject or body
 * that matches one of these keys is replaced by applyTemplate(); unknown tokens
 * are left untouched so authors can spot typos.
 */
export interface TemplateVars {
  clientName?: string | null
  propertyAddress?: string | null
}

/**
 * Predefined templates shipped with the app. They are not stored in the database —
 * they are always available in every picker alongside the realtor's custom templates.
 * ids are namespaced with "predefined:" so they never collide with DB uuids.
 */
export const PREDEFINED_TEMPLATES: PickableTemplate[] = [
  {
    id: 'predefined:open-house',
    name: 'Open House',
    predefined: true,
    subject: 'Open House this weekend — {{propertyAddress}}',
    body:
      'Hi {{clientName}},\n\n' +
      "I'm hosting an open house at {{propertyAddress}} this weekend and thought of you. " +
      "It's a great match for what you're looking for.\n\n" +
      "Let me know if you'd like the exact time and address — I'd be happy to walk you through it.\n\n" +
      'Best,',
  },
  {
    id: 'predefined:new-listing',
    name: 'New Listing',
    predefined: true,
    subject: 'New listing you might love — {{propertyAddress}}',
    body:
      'Hi {{clientName}},\n\n' +
      'A new property just hit the market at {{propertyAddress}} and it lines up well with your criteria. ' +
      'These tend to move quickly.\n\n' +
      'Want me to send over the full details or schedule a showing?\n\n' +
      'Best,',
  },
  {
    id: 'predefined:market-update',
    name: 'Market Update',
    predefined: true,
    subject: 'Your local market update',
    body:
      'Hi {{clientName}},\n\n' +
      "Here's a quick update on the market in your area. Inventory and pricing have shifted recently, " +
      'and I wanted to make sure you have the latest picture as you plan your next move.\n\n' +
      'Happy to put together a personalized snapshot whenever you like.\n\n' +
      'Best,',
  },
  {
    id: 'predefined:birthday',
    name: 'Birthday',
    predefined: true,
    subject: 'Happy Birthday, {{clientName}}!',
    body:
      'Hi {{clientName}},\n\n' +
      'Just a quick note to wish you a very happy birthday! I hope your year ahead is a great one.\n\n' +
      "If there's ever anything I can help with on the real estate side, you know where to find me.\n\n" +
      'Warm wishes,',
  },
  {
    id: 'predefined:just-sold',
    name: 'Just Sold',
    predefined: true,
    subject: 'Just sold near you — {{propertyAddress}}',
    body:
      'Hi {{clientName}},\n\n' +
      'I just closed a sale at {{propertyAddress}}. Homes in the area are seeing strong interest, ' +
      "which is great news if you've been thinking about your own plans.\n\n" +
      "If you're curious what your property could sell for today, I'd be glad to run the numbers.\n\n" +
      'Best,',
  },
]

// Replaces {{clientName}}/{{propertyAddress}} tokens (whitespace inside braces tolerated).
// Missing values fall back to a neutral placeholder so a partial email never reads "Hi ,".
export function applyTemplate(text: string, vars: TemplateVars): string {
  const map: Record<string, string> = {
    clientName: vars.clientName?.trim() || 'there',
    propertyAddress: vars.propertyAddress?.trim() || 'the property',
  }
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in map ? map[key] : match
  )
}
