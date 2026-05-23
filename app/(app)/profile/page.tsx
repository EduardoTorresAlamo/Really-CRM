import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileForm from '@/components/profile/ProfileForm'
import type { Profile } from '@/types/profile'

/**
 * Profile page -- allows the realtor to view and update their personal profile.
 *
 * Fetches the profile row keyed by the Supabase auth user ID. Profile may be null
 * if the realtor has never saved their profile (first login). ProfileForm handles
 * both create (upsert) and update via the same submission handler.
 *
 * @returns The profile page JSX.
 */
export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // profiles.id is a foreign key referencing auth.users.id
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your realtor profile</p>
      </div>
      <ProfileForm profile={profile as Profile | null} userId={user.id} />
    </div>
  )
}
