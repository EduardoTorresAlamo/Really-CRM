/**
 * Claude AI helpers for the property-match feature.
 *
 * This module exports two functions that each make a separate Claude API call:
 *  1. parsePropertyListing  -- extracts structured data from a listing URL.
 *  2. matchClientsToProperty -- ranks buyer clients against the parsed listing.
 *
 * Both functions use claude-sonnet-4-6 and return validated, typed results via Zod.
 */
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { ParsedProperty, MatchResult } from '@/types/propertyMatch'
import type { Client } from '@/types/client'

// Single shared Anthropic client -- instantiating once avoids repeated SDK initialization overhead
const client = new Anthropic()

// Zod schema used to validate the JSON Claude returns for a single property listing
const ParsedPropertySchema = z.object({
  price: z.number().nullable(),
  location: z.string().nullable(),
  propertyType: z.enum(['house', 'condo', 'apartment', 'land', 'commercial']).nullable(),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  saleType: z.enum(['cash', 'loan']).nullable(),
  rawDescription: z.string(),
})

// Zod schema for a single matched client result returned by the second Claude call
const MatchResultSchema = z.object({
  clientId: z.string(),
  clientName: z.string(),
  matchScore: z.enum(['high', 'medium', 'low']),
  explanation: z.string(),
})

// Array-level schema wrapping MatchResultSchema for batch validation of the ranking response
const MatchResultArraySchema = z.array(MatchResultSchema)

/**
 * Calls Claude to extract structured property data from a listing URL.
 *
 * The URL is sanitized (control characters stripped, length capped) before being
 * injected into the prompt to prevent prompt injection via malicious URLs.
 *
 * Claude is instructed to return raw JSON only -- no markdown fences, no explanation.
 * The response is validated with ParsedPropertySchema; if initial JSON.parse fails,
 * a regex fallback attempts to extract the first JSON object from the response body
 * in case Claude emitted surrounding text despite the instruction.
 *
 * @param url - The property listing URL to analyze.
 * @returns A ParsedProperty object with extracted fields; any field Claude couldn't
 *          determine is null.
 * @throws If Claude's response cannot be parsed into valid JSON or the schema rejects it.
 */
export async function parsePropertyListing(url: string): Promise<ParsedProperty> {
  // Strip control characters and cap length to prevent prompt injection and token overflow
  const safeUrl = url.replace(/[\r\n\t]/g, ' ').slice(0, 2048)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are a real estate data extraction assistant. Given a property listing URL,
extract structured data and return ONLY valid JSON with these keys:
- price: number or null
- location: string or null (city/neighborhood/area)
- propertyType: one of "house"|"condo"|"apartment"|"land"|"commercial" or null
- bedrooms: number or null
- bathrooms: number or null
- saleType: "cash"|"loan"|null (null if not specified)
- rawDescription: string (brief 1-2 sentence summary)

Return ONLY the JSON object, no markdown, no explanation.`,
    messages: [
      {
        role: 'user',
        content: `Extract property data from this listing URL: ${safeUrl}

Note: If you cannot access the URL directly, analyze the URL structure and any information
you can infer from it. Return your best estimate with available information, using null for
fields you truly cannot determine.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const raw = JSON.parse(text.trim())
    return ParsedPropertySchema.parse(raw)
  } catch {
    // Try to extract JSON from the response if initial parsing fails
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const raw = JSON.parse(jsonMatch[0])
      return ParsedPropertySchema.parse(raw)
    }
    throw new Error('Failed to parse property data from Claude response')
  }
}

/**
 * A stripped-down projection of a Client, containing only the fields relevant
 * to property matching. Sent to Claude instead of the full Client row to reduce
 * token usage and avoid leaking sensitive contact details in the prompt.
 */
interface CondensedClient {
  id: string
  name: string
  budgetMin: number | null
  budgetMax: number | null
  preferredLocations: string[] | null
  propertyTypes: string[] | null
  saleType: string | null
  bedroomsMin: number | null
  bedroomsMax: number | null
  bathroomsMin: number | null
}

/**
 * Maps a full Client row to the minimal CondensedClient shape.
 * Excludes email, phone, notes, and other PII that are irrelevant to property matching.
 *
 * @param c - The full Client database row.
 * @returns A condensed representation suitable for inclusion in the Claude prompt.
 */
function condensedView(c: Client): CondensedClient {
  return {
    id: c.id,
    name: c.name,
    budgetMin: c.budget_min,
    budgetMax: c.budget_max,
    preferredLocations: c.preferred_locations,
    propertyTypes: c.property_types,
    saleType: c.sale_type,
    bedroomsMin: c.bedrooms_min,
    bedroomsMax: c.bedrooms_max,
    bathroomsMin: c.bathrooms_min,
  }
}

/**
 * Calls Claude to rank a list of buyer clients by how well they match a given property.
 *
 * Each client is condensed to only the preference fields before being serialized into
 * the prompt, keeping token count low. Claude ranks them and returns a JSON array sorted
 * best-to-worst, omitting clients that are clearly incompatible.
 *
 * The match criteria Claude applies: budget range, preferred locations (flexible/fuzzy),
 * property type, bedroom/bathroom minimums, and sale type.
 *
 * If the response cannot be parsed, an empty array is returned rather than throwing,
 * so callers always receive a valid (possibly empty) result set.
 *
 * @param property - The parsed property to match against.
 * @param clients - The realtor's active buyer clients pulled from the database.
 * @returns An array of MatchResult objects sorted descending by match quality. Returns
 *          an empty array if there are no clients or Claude's response is unparseable.
 */
export async function matchClientsToProperty(
  property: ParsedProperty,
  clients: Client[]
): Promise<MatchResult[]> {
  if (clients.length === 0) return []

  // Reduce each full Client row to only preference fields before sending to Claude
  const condensed = clients.map(condensedView)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a real estate client matching assistant. Given a property listing and a list
of buyer clients with their preferences, rank the clients by how well the property matches
their needs.

Return ONLY a valid JSON array (no markdown, no explanation) sorted by match quality (best first):
[
  {
    "clientId": "uuid",
    "clientName": "name",
    "matchScore": "high"|"medium"|"low",
    "explanation": "2-3 sentence explanation"
  }
]

Only include clients with at least a "low" match. Omit clients who are clearly incompatible
(e.g., wrong property type, price far out of range, wrong location).

Match criteria:
- Budget: property price should fall within or near the client's range
- Location: property location should match preferred locations (flexible matching)
- Property type: should be in the client's preferred types
- Bedrooms/bathrooms: should meet minimums
- Sale type: if specified, should match`,
    messages: [
      {
        role: 'user',
        content: `Property:
${JSON.stringify(property, null, 2)}

Active Buyer Clients:
${JSON.stringify(condensed, null, 2)}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'

  try {
    const raw = JSON.parse(text.trim())
    return MatchResultArraySchema.parse(raw)
  } catch {
    // Try to extract JSON array from the response if initial parsing fails
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const raw = JSON.parse(jsonMatch[0])
      return MatchResultArraySchema.parse(raw)
    }
    return []
  }
}
