/**
 * Property-match helpers -- pure, local implementation with NO external AI API.
 *
 * Exports the same two functions the rest of the app already depends on:
 *  1. parsePropertyListing   -- extracts structured data from a listing URL using
 *                               best-effort HTML fetch + regex heuristics (falls back
 *                               to parsing the URL slug when the page can't be read).
 *  2. matchClientsToProperty -- ranks buyer clients against the parsed listing with a
 *                               deterministic weighted-scoring algorithm.
 *
 * No API key required. Replaces the previous Claude/Anthropic-backed version.
 */
import type { ParsedProperty, MatchResult } from '@/types/propertyMatch'
import type { Client, PropertyType, SaleType } from '@/types/client'

/** Maps free-text keywords found in a listing to a canonical PropertyType. */
const PROPERTY_TYPE_KEYWORDS: Record<PropertyType, string[]> = {
  house: ['house', 'casa', 'single family', 'townhouse', 'villa'],
  condo: ['condo', 'condominio', 'condominium'],
  apartment: ['apartment', 'apartamento', 'apto', 'flat', 'walk-up', 'walkup'],
  land: ['land', 'terreno', 'solar', 'lot', 'finca'],
  commercial: ['commercial', 'comercial', 'office', 'oficina', 'retail', 'local comercial'],
}

/** Parses the first plausible money amount out of a text blob (e.g. "$385,000"). */
function extractPrice(text: string): number | null {
  const match = text.match(/\$\s?([0-9][0-9.,]{2,})/)
  if (!match) return null
  // Strip thousands separators; treat "." as a decimal only when it looks like cents.
  const digits = match[1].replace(/,/g, '')
  const value = Number.parseFloat(digits)
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null
}

/** Extracts a bedroom or bathroom count given a set of unit keywords. */
function extractCount(text: string, units: string[]): number | null {
  const re = new RegExp(`(\\d+(?:\\.\\d)?)\\s*(?:${units.join('|')})`, 'i')
  const match = text.match(re)
  if (!match) return null
  const value = Number.parseFloat(match[1])
  return Number.isFinite(value) ? value : null
}

/** Picks a PropertyType by scanning the text for the first matching keyword. */
function extractPropertyType(text: string): PropertyType | null {
  const lower = text.toLowerCase()
  for (const [type, keywords] of Object.entries(PROPERTY_TYPE_KEYWORDS) as [PropertyType, string[]][]) {
    if (keywords.some((kw) => lower.includes(kw))) return type
  }
  return null
}

/** Infers cash vs. loan financing from listing text, or null when not stated. */
function extractSaleType(text: string): SaleType | null {
  const lower = text.toLowerCase()
  if (/\b(cash|contado|efectivo)\b/.test(lower)) return 'cash'
  if (/\b(loan|financ|préstamo|prestamo|mortgage|hipoteca|fha|va loan)\b/.test(lower)) return 'loan'
  return null
}

/**
 * Best-effort location guess: the humanized last meaningful segment of the URL path,
 * or a "in <place>" / "en <lugar>" phrase from the page text.
 */
function extractLocation(text: string, url: string): string | null {
  const phrase = text.match(/\b(?:in|en)\s+([A-ZÁÉÍÓÚÑ][\w áéíóúñ.'-]{2,40})/)
  if (phrase) return phrase[1].trim()

  try {
    const { pathname } = new URL(url)
    const segments = pathname.split('/').filter(Boolean)
    // Prefer a segment that looks like a place name (letters + hyphens, no pure digits).
    const candidate = [...segments].reverse().find((s) => /[a-zA-Z]/.test(s) && !/^\d+$/.test(s))
    if (candidate) {
      return candidate
        .replace(/[-_]+/g, ' ')
        .replace(/\.[a-z]+$/i, '')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim()
    }
  } catch {
    // ignore malformed URLs -- caller already validated, but stay defensive
  }
  return null
}

/** Strips HTML tags and collapses whitespace so regex heuristics run over readable text. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Extracts structured property data from a listing URL — best-effort HTML scrape with a short
// timeout, falling back to the URL slug. Fields that can't be determined are returned as null.
export async function parsePropertyListing(url: string): Promise<ParsedProperty> {
  const safeUrl = url.replace(/[\r\n\t]/g, ' ').slice(0, 2048)

  let pageText = ''
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(safeUrl, {
      signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; ReallyCRM/1.0)' },
    })
    clearTimeout(timeout)
    if (res.ok) {
      const html = (await res.text()).slice(0, 500_000)
      pageText = htmlToText(html)
    }
  } catch {
    // Network failure, timeout, blocked bot, etc. -- fall back to URL-only parsing.
  }

  // Decode the URL itself so slug words ("3-bed-guaynabo") feed the heuristics too.
  let decodedUrl = safeUrl
  try {
    decodedUrl = decodeURIComponent(safeUrl)
  } catch {
    // leave as-is if the URL contains an invalid escape sequence
  }
  const haystack = `${pageText} ${decodedUrl.replace(/[-_/]+/g, ' ')}`

  const rawDescription = pageText ? pageText.slice(0, 500) : `Listado: ${safeUrl}`

  return {
    price: extractPrice(haystack),
    location: extractLocation(pageText, safeUrl),
    propertyType: extractPropertyType(haystack),
    bedrooms: extractCount(haystack, ['bed', 'bd', 'br', 'hab', 'cuartos?', 'recámaras?', 'recamaras?', 'dormitorios?']),
    bathrooms: extractCount(haystack, ['bath', 'ba', 'baños?', 'banos?']),
    saleType: extractSaleType(haystack),
    rawDescription,
  }
}

/** Case-insensitive "does either string contain the other" test for fuzzy location matching. */
function locationMatches(propertyLocation: string, preferred: string[]): boolean {
  const p = propertyLocation.toLowerCase()
  return preferred.some((loc) => {
    const l = loc.toLowerCase().trim()
    return l.length > 0 && (p.includes(l) || l.includes(p))
  })
}

// Ranks buyer clients against a property with a deterministic weighted score. Each criterion is
// scored only when both sides specify it, so missing data never penalizes. Hard mismatches (wrong
// type, price well outside budget) drop the client entirely. Returns MatchResult[] best-to-worst.
export async function matchClientsToProperty(
  property: ParsedProperty,
  clients: Client[]
): Promise<MatchResult[]> {
  if (clients.length === 0) return []

  const results: (MatchResult & { score: number })[] = []

  for (const c of clients) {
    let earned = 0
    let possible = 0
    let disqualified = false
    const reasons: string[] = []

    // --- Budget (weight 3) ---
    if (property.price != null && (c.budget_min != null || c.budget_max != null)) {
      possible += 3
      const min = c.budget_min ?? 0
      const max = c.budget_max ?? Number.POSITIVE_INFINITY
      if (property.price >= min && property.price <= max) {
        earned += 3
        reasons.push('Precio dentro de presupuesto')
      } else if (max !== Number.POSITIVE_INFINITY && property.price <= max * 1.1) {
        earned += 1.5
        reasons.push('Precio algo sobre su tope')
      } else if (property.price < min * 0.9 || (max !== Number.POSITIVE_INFINITY && property.price > max * 1.15)) {
        disqualified = true // price is well outside what they'll consider
      }
    }

    // --- Property type (weight 2) ---
    if (property.propertyType != null && c.property_types && c.property_types.length > 0) {
      possible += 2
      if (c.property_types.includes(property.propertyType)) {
        earned += 2
        reasons.push('Tipo de propiedad correcto')
      } else {
        disqualified = true // client explicitly wants other property types
      }
    }

    // --- Location (weight 2) ---
    if (property.location != null && c.preferred_locations && c.preferred_locations.length > 0) {
      possible += 2
      if (locationMatches(property.location, c.preferred_locations)) {
        earned += 2
        reasons.push('Zona preferida')
      }
    }

    // --- Bedrooms (weight 1) ---
    if (property.bedrooms != null && (c.bedrooms_min != null || c.bedrooms_max != null)) {
      possible += 1
      const okMin = c.bedrooms_min == null || property.bedrooms >= c.bedrooms_min
      const okMax = c.bedrooms_max == null || property.bedrooms <= c.bedrooms_max
      if (okMin && okMax) {
        earned += 1
        reasons.push('Cumple cuartos')
      }
    }

    // --- Bathrooms (weight 1) ---
    if (property.bathrooms != null && c.bathrooms_min != null) {
      possible += 1
      if (property.bathrooms >= c.bathrooms_min) {
        earned += 1
        reasons.push('Cumple baños')
      }
    }

    // --- Sale type (weight 1) ---
    if (property.saleType != null && c.sale_type != null) {
      possible += 1
      if (property.saleType === c.sale_type) {
        earned += 1
        reasons.push('Forma de pago compatible')
      }
    }

    if (disqualified) continue
    if (possible === 0) continue // no comparable fields -- nothing to say about this client

    const score = Math.round((earned / possible) * 100)
    const matchScore: MatchResult['matchScore'] = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'

    results.push({
      clientId: c.id,
      clientName: c.name,
      matchScore,
      explanation: reasons.length > 0 ? `${reasons.join('. ')}.` : 'Coincidencia parcial con sus preferencias.',
      score,
    })
  }

  return results
    .sort((a, b) => b.score - a.score)
    .map(({ score: _score, ...rest }) => rest)
}
