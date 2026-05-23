/**
 * Mirrors the `profiles` table row.
 * The id is a foreign key referencing auth.users.id -- one profile per realtor account.
 */
export interface Profile {
  /** Foreign key to auth.users.id -- the Supabase auth user UUID. */
  id: string
  name: string
  /** The realtor's email address, kept in sync with their auth email. */
  email: string
  phone: string | null
  /** State real estate license number for display purposes only. */
  license_number: string | null
  bio: string | null
  /** Public URL in Supabase Storage ('avatars' bucket). Null until a photo is uploaded. */
  photo_url: string | null
  created_at: string
  updated_at: string
}

/** Shape for upserting a profile row; timestamps are managed by the database trigger. */
export type ProfileUpsert = Omit<Profile, 'created_at' | 'updated_at'>
