export type ClientType = 'buyer' | 'seller'
export type ClientStatus = 'active' | 'inactive' | 'closed'
export type SaleType = 'cash' | 'loan'
export type PropertyType = 'house' | 'condo' | 'apartment' | 'land' | 'commercial'

export interface Client {
  id: string
  realtor_id: string
  client_type: ClientType
  status: ClientStatus
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  budget_min: number | null
  budget_max: number | null
  preferred_locations: string[] | null
  property_types: PropertyType[] | null
  sale_type: SaleType | null
  bedrooms_min: number | null
  bedrooms_max: number | null
  bathrooms_min: number | null
  bathrooms_max: number | null
  created_at: string
  updated_at: string
}

export type ClientInsert = Omit<Client, 'id' | 'created_at' | 'updated_at'>
export type ClientUpdate = Partial<Omit<Client, 'id' | 'realtor_id' | 'created_at' | 'updated_at'>>
