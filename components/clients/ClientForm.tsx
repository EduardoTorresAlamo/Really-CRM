'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import type { Client, ClientType, ClientStatus, SaleType, PropertyType } from '@/types/client'

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'house', label: 'House' },
  { value: 'condo', label: 'Condo' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'land', label: 'Land' },
  { value: 'commercial', label: 'Commercial' },
]

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.union([z.string().email('Invalid email'), z.literal('')]).optional(),
  phone: z.string().optional(),
  client_type: z.enum(['buyer', 'seller']),
  status: z.enum(['active', 'inactive', 'closed']),
  sale_type: z.enum(['cash', 'loan', '']).optional(),
  budget_min: z.string().optional(),
  budget_max: z.string().optional(),
  bedrooms_min: z.string().optional(),
  bedrooms_max: z.string().optional(),
  bathrooms_min: z.string().optional(),
  bathrooms_max: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface ClientFormProps {
  client?: Client
  userId: string
  mode: 'create' | 'edit'
}

export default function ClientForm({ client, userId, mode }: ClientFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<PropertyType[]>(
    client?.property_types ?? []
  )
  const [locations, setLocations] = useState<string[]>(client?.preferred_locations ?? [])
  const [locationInput, setLocationInput] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: client?.name ?? '',
      email: client?.email ?? '',
      phone: client?.phone ?? '',
      client_type: client?.client_type ?? 'buyer',
      status: client?.status ?? 'active',
      sale_type: client?.sale_type ?? '',
      budget_min: client?.budget_min?.toString() ?? '',
      budget_max: client?.budget_max?.toString() ?? '',
      bedrooms_min: client?.bedrooms_min?.toString() ?? '',
      bedrooms_max: client?.bedrooms_max?.toString() ?? '',
      bathrooms_min: client?.bathrooms_min?.toString() ?? '',
      bathrooms_max: client?.bathrooms_max?.toString() ?? '',
      notes: client?.notes ?? '',
    },
  })

  const clientType = watch('client_type')

  function togglePropertyType(pt: PropertyType) {
    setSelectedPropertyTypes((prev) =>
      prev.includes(pt) ? prev.filter((t) => t !== pt) : [...prev, pt]
    )
  }

  function addLocation(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const val = locationInput.trim()
      if (val && !locations.includes(val)) {
        setLocations((prev) => [...prev, val])
      }
      setLocationInput('')
    }
  }

  function removeLocation(loc: string) {
    setLocations((prev) => prev.filter((l) => l !== loc))
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      realtor_id: userId,
      name: values.name,
      email: values.email || null,
      phone: values.phone || null,
      client_type: values.client_type as ClientType,
      status: values.status as ClientStatus,
      sale_type: (values.sale_type as SaleType) || null,
      budget_min: values.budget_min !== '' ? Number(values.budget_min) : null,
      budget_max: values.budget_max !== '' ? Number(values.budget_max) : null,
      bedrooms_min: values.bedrooms_min !== '' ? Number(values.bedrooms_min) : null,
      bedrooms_max: values.bedrooms_max !== '' ? Number(values.bedrooms_max) : null,
      bathrooms_min: values.bathrooms_min !== '' ? Number(values.bathrooms_min) : null,
      bathrooms_max: values.bathrooms_max !== '' ? Number(values.bathrooms_max) : null,
      notes: values.notes || null,
      property_types: selectedPropertyTypes.length > 0 ? selectedPropertyTypes : null,
      preferred_locations: locations.length > 0 ? locations : null,
    }

    if (mode === 'create') {
      const { data, error } = await supabase.from('clients').insert(payload).select().single()
      if (error) { toast.error('Failed to create client'); return }

      await supabase.from('client_history').insert({
        client_id: data.id,
        realtor_id: userId,
        event_type: 'created',
        description: `Client "${values.name}" was created`,
      })

      toast.success('Client created')
      router.push(`/clients/${data.id}`)
    } else if (client) {
      const { error } = await supabase.from('clients').update(payload).eq('id', client.id)
      if (error) { toast.error('Failed to update client'); return }

      await supabase.from('client_history').insert({
        client_id: client.id,
        realtor_id: userId,
        event_type: 'edited',
        description: `Client profile was updated`,
      })

      toast.success('Client updated')
      router.push(`/clients/${client.id}`)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      {/* Personal Info */}
      <Card>
        <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" {...register('phone')} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Type & Status */}
      <Card>
        <CardHeader><CardTitle>Classification</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client Type *</Label>
              <div className="flex gap-3">
                {(['buyer', 'seller'] as ClientType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setValue('client_type', t)}
                    className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                      clientType === t
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {t === 'buyer' ? 'Buyer' : 'Seller'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                {...register('status')}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Type of Sale</Label>
            <div className="flex gap-3">
              {[
                { value: '', label: 'Not specified' },
                { value: 'cash', label: 'Cash' },
                { value: 'loan', label: 'Loan (Prestamo)' },
              ].map(({ value, label }) => {
                const saleType = watch('sale_type')
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setValue('sale_type', value as SaleType)}
                    className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                      (saleType ?? '') === value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferences (for buyers) */}
      {clientType === 'buyer' && (
        <Card>
          <CardHeader><CardTitle>Property Preferences</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {/* Budget */}
            <div className="space-y-2">
              <Label>Budget Range</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  placeholder="Min"
                  {...register('budget_min')}
                  className="flex-1"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="number"
                  placeholder="Max"
                  {...register('budget_max')}
                  className="flex-1"
                />
              </div>
            </div>

            <Separator />

            {/* Property Types */}
            <div className="space-y-2">
              <Label>Property Types</Label>
              <div className="flex flex-wrap gap-2">
                {PROPERTY_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => togglePropertyType(value)}
                    className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                      selectedPropertyTypes.includes(value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Locations */}
            <div className="space-y-2">
              <Label htmlFor="location-input">Preferred Locations</Label>
              <Input
                id="location-input"
                placeholder="Type a location and press Enter"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={addLocation}
              />
              {locations.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {locations.map((loc) => (
                    <Badge key={loc} variant="secondary" className="gap-1">
                      {loc}
                      <button type="button" onClick={() => removeLocation(loc)}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Bedrooms / Bathrooms */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Bedrooms</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" placeholder="Min" {...register('bedrooms_min')} />
                  <span className="text-muted-foreground text-sm">–</span>
                  <Input type="number" placeholder="Max" {...register('bedrooms_max')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bathrooms</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" step="0.5" placeholder="Min" {...register('bathrooms_min')} />
                  <span className="text-muted-foreground text-sm">–</span>
                  <Input type="number" step="0.5" placeholder="Max" {...register('bathrooms_max')} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            rows={4}
            placeholder="Any additional notes about this client..."
            {...register('notes')}
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Client' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
