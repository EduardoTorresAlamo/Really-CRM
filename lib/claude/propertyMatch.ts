import Anthropic from '@anthropic-ai/sdk'
import type { ParsedProperty, MatchResult } from '@/types/propertyMatch'
import type { Client } from '@/types/client'

const client = new Anthropic()

// Function to parse property listing data using Claude AI
export async function parsePropertyListing(url: string): Promise<ParsedProperty> {
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
        content: `Extract property data from this listing URL: ${url}

Note: If you cannot access the URL directly, analyze the URL structure and any information
you can infer from it. Return your best estimate with available information, using null for
fields you truly cannot determine.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const parsed = JSON.parse(text.trim())
    return parsed as ParsedProperty
  } catch {
    // Try to extract JSON from the response if initial parsing fails
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ParsedProperty
    }
    throw new Error('Failed to parse property data from Claude response')
  }
}

// Interface for condensed client information
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

// Function to condense client data for matching
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

// Function to match clients to a property using Claude AI
export async function matchClientsToProperty(
  property: ParsedProperty,
  clients: Client[]
): Promise<MatchResult[]> {
  if (clients.length === 0) return []

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
    const parsed = JSON.parse(text.trim())
    return parsed as MatchResult[]
  } catch {
    // Try to extract JSON array from the response if initial parsing fails
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as MatchResult[]
    }
    return []
  }
}