export interface Profile {
  id: string
  name: string
  email: string
  phone: string | null
  license_number: string | null
  bio: string | null
  photo_url: string | null
  created_at: string
  updated_at: string
}

export type ProfileUpsert = Omit<Profile, 'created_at' | 'updated_at'>
