import type { PropertyType, SaleType } from './client'

export interface ParsedProperty {
  price: number | null
  location: string | null
  propertyType: PropertyType | null
  bedrooms: number | null
  bathrooms: number | null
  saleType: SaleType | null
  rawDescription: string
}

export interface MatchResult {
  clientId: string
  clientName: string
  matchScore: 'high' | 'medium' | 'low'
  explanation: string
}

export interface PropertyMatchResponse {
  property: ParsedProperty
  matches: MatchResult[]
}
