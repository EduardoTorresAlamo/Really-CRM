import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Home, MapPin, DollarSign, Bed, Bath } from 'lucide-react'
import type { ParsedProperty } from '@/types/propertyMatch'

function formatPrice(price: number | null): string {
  if (!price) return 'Not specified'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price)
}

export default function ParsedPropertyCard({ property }: { property: ParsedProperty }) {
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Home className="w-4 h-4" />
          Parsed Property Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-1.5 text-sm">
            <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-medium">{formatPrice(property.price)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{property.location ?? 'Unknown location'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Home className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="capitalize">{property.propertyType ?? 'Unknown type'}</span>
          </div>
          {property.bedrooms !== null && (
            <div className="flex items-center gap-1.5 text-sm">
              <Bed className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{property.bedrooms} bed{property.bedrooms !== 1 ? 's' : ''}</span>
            </div>
          )}
          {property.bathrooms !== null && (
            <div className="flex items-center gap-1.5 text-sm">
              <Bath className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{property.bathrooms} bath{property.bathrooms !== 1 ? 's' : ''}</span>
            </div>
          )}
          {property.saleType && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground text-xs uppercase font-medium">Sale:</span>
              <span className="capitalize">{property.saleType === 'loan' ? 'Loan (Prestamo)' : 'Cash'}</span>
            </div>
          )}
        </div>
        {property.rawDescription && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-blue-200">
            {property.rawDescription}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
