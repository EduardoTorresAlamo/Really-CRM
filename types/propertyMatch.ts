import type { PropertyType, SaleType } from './client'

/** What Claude extracts from scraping a property listing URL. Nulls mean Claude couldn't determine the value. */
export interface ParsedProperty {
  price: number | null
  location: string | null
  propertyType: PropertyType | null
  bedrooms: number | null
  bathrooms: number | null
  saleType: SaleType | null
  rawDescription: string  // full listing text passed to the second Claude call for client matching
}

/** One buyer client's match result, ranked by how well the property fits their preferences. */
export interface MatchResult {
  clientId: string
  clientName: string
  matchScore: 'high' | 'medium' | 'low'
  explanation: string  // Claude's natural-language reason for the score
}

/** The combined response shape returned by the POST /api/property-match route. */
export interface PropertyMatchResponse {
  /** The structured property data extracted by Claude from the listing URL. */
  property: ParsedProperty
  /** Ranked list of buyer clients that match the property, sorted best-to-worst. */
  matches: MatchResult[]
}
