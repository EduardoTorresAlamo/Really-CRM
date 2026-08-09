import { Card, CardContent } from '@/components/ui/card'
import { Bed, Bath, Home, MapPin } from 'lucide-react'
import type { ParsedProperty } from '@/types/propertyMatch'

/**
 * Formats a property price as a USD currency string with no decimal places.
 *
 * @param price - The price in dollars, or null if Claude couldn't determine it.
 * @returns A formatted currency string, or "Not specified" for null.
 */
function formatPrice(price: number | null): string {
  if (!price) return 'Not specified'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price)
}

/**
 * Card displaying the structured property data extracted by Claude from a listing URL.
 *
 * Fields that Claude couldn't determine are shown as "Unknown ..." fallbacks.
 * Optional fields (bedrooms, bathrooms, sale type) are only rendered when non-null.
 * The rawDescription from Claude is shown as a small caption below the grid.
 *
 * @param property - The ParsedProperty object returned from the property-match API.
 * @returns The parsed property summary card JSX.
 */
export default function ParsedPropertyCard({ property }: { property: ParsedProperty }) {
  // Only the specs Claude actually resolved get a slot; empty cells in a spec strip
  // read as a layout bug rather than as missing data.
  const specs = [
    property.bedrooms !== null && {
      icon: Bed,
      label: 'Bedrooms',
      value: String(property.bedrooms),
    },
    property.bathrooms !== null && {
      icon: Bath,
      label: 'Bathrooms',
      value: String(property.bathrooms),
    },
    property.propertyType && {
      icon: Home,
      label: 'Type',
      value: property.propertyType,
    },
  ].filter(Boolean) as { icon: typeof Bed; label: string; value: string }[]

  return (
    <Card className="ring-hairline">
      <CardContent className="px-6 pb-1 pt-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle">
              Listing
            </p>
            {/* Price is the number a realtor reads first, so it carries the display
                scale and the location becomes the supporting line. */}
            <p
              data-numeric
              className="mt-2 text-[2rem] font-normal leading-none tracking-[-0.02em] text-ink"
            >
              {formatPrice(property.price)}
            </p>
            <p className="mt-2.5 flex items-center gap-1.5 text-sm text-ink-soft">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-muted" strokeWidth={1.75} />
              <span className="truncate">{property.location ?? 'Location not listed'}</span>
            </p>
          </div>

          {property.saleType && (
            <span className="shrink-0 rounded-full bg-hairline-soft px-2.5 py-0.5 font-mono text-xs uppercase tracking-wide text-ink">
              {property.saleType === 'loan' ? 'Loan' : 'Cash'}
            </span>
          )}
        </div>

        {specs.length > 0 && (
          /* Column count follows the number of resolved specs, so a listing with only
             bedrooms known does not render two blank cells. */
          <dl
            className="mt-6 grid gap-px overflow-hidden rounded-lg bg-hairline-soft"
            style={{
              gridTemplateColumns: `repeat(${specs.length}, minmax(0, 1fr))`,
            }}
          >
            {specs.map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-surface px-3 py-3">
                <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-subtle">
                  <Icon className="h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden />
                  {label}
                </dt>
                <dd
                  data-numeric
                  className="mt-1.5 text-sm font-medium capitalize text-ink"
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {property.rawDescription && (
          <p className="mt-5 border-t border-hairline-soft pt-4 text-xs leading-relaxed text-ink-subtle">
            {property.rawDescription}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
