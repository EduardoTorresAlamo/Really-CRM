'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import AvatarUpload from './AvatarUpload'
import { toast } from 'sonner'
import type { Profile } from '@/types/profile'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  license_number: z.string().optional(),
  bio: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

/**
 * Props for the ProfileForm component.
 */
interface ProfileFormProps {
  /** Existing profile data; null if the realtor has never saved a profile. */
  profile: Profile | null
  /** The authenticated realtor's user ID, used as the profiles table primary key. */
  userId: string
}

/**
 * Form for creating or updating the realtor's profile.
 *
 * Uses Supabase's .upsert() so the same handler works for both first-time
 * profile creation and subsequent updates, keyed by the user's auth UUID.
 *
 * Photo state is managed separately from the form fields since the upload
 * is handled by AvatarUpload and the URL is stored outside react-hook-form.
 *
 * @param props - ProfileFormProps with existing profile data and user ID.
 * @returns The profile form JSX.
 */
export default function ProfileForm({ profile, userId }: ProfileFormProps) {
  const [photoUrl, setPhotoUrl] = useState(profile?.photo_url ?? null)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: profile?.name ?? '',
      email: profile?.email ?? '',
      phone: profile?.phone ?? '',
      license_number: profile?.license_number ?? '',
      bio: profile?.bio ?? '',
    },
  })

  async function onSubmit(values: FormValues) {
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      ...values,
      phone: values.phone || null,
      license_number: values.license_number || null,
      bio: values.bio || null,
      photo_url: photoUrl,
    })

    if (error) {
      toast.error('Failed to save profile')
    } else {
      toast.success('Profile saved')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
        </CardHeader>
        <CardContent>
          <AvatarUpload
            userId={userId}
            currentUrl={photoUrl}
            name={profile?.name ?? ''}
            onUpload={setPhotoUrl}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" {...register('phone')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="license_number">License Number</Label>
              <Input id="license_number" {...register('license_number')} />
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              rows={4}
              placeholder="A short bio about you..."
              {...register('bio')}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save Profile'}
      </Button>
    </form>
  )
}
