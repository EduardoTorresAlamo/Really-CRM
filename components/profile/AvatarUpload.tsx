'use client'

import { useRef, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { uploadFile } from '@/lib/storage/uploadFile'
import { toast } from 'sonner'
import { Camera } from 'lucide-react'

/**
 * Props for the AvatarUpload component.
 */
interface AvatarUploadProps {
  /** The realtor's user ID, used to namespace the storage path (userId/avatar.ext). */
  userId: string
  /** The current avatar URL from the profiles table; null if no photo has been uploaded. */
  currentUrl: string | null
  /** The realtor's display name, used for the initials fallback avatar. */
  name: string
  /** Callback invoked with the new public URL after a successful upload. */
  onUpload: (url: string) => void
}

/**
 * Avatar upload control shown on the profile page.
 *
 * Upload strategy:
 *   - A fixed path per user (userId/avatar.ext) combined with upsert:true means each
 *     new upload overwrites the previous avatar without creating orphaned files.
 *   - The 'avatars' bucket is public so the URL is stable and doesn't need signed access.
 *   - A local object URL is set as the preview immediately (optimistic UI) so the
 *     realtor sees their new photo before the upload completes.
 *   - If the upload fails, the preview reverts to currentUrl.
 *
 * The file input is hidden and triggered via a ref so a custom button can be styled freely.
 *
 * @param props - AvatarUploadProps with user ID, current URL, name, and upload callback.
 * @returns The avatar display + upload button JSX.
 */
export default function AvatarUpload({ userId, currentUrl, name, onUpload }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const inputRef = useRef<HTMLInputElement>(null)

  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()
    // Fixed filename per user — uploading a new photo overwrites the old one automatically
    const path = `${userId}/avatar.${ext}`

    // Show the local file immediately so the UI feels instant, even before upload completes
    setPreview(URL.createObjectURL(file))
    setUploading(true)

    try {
      // 'avatars' bucket is public — URLs are stable and don't need signed access
      const url = await uploadFile('avatars', path, file)
      onUpload(url)
      toast.success('Photo updated')
    } catch {
      toast.error('Failed to upload photo')
      setPreview(currentUrl)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar className="w-20 h-20">
          <AvatarImage src={preview ?? undefined} alt={name} />
          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute bottom-0 right-0 bg-white border border-gray-200 rounded-full p-1 shadow-sm hover:bg-gray-50 transition-colors"
          aria-label="Change photo"
        >
          <Camera className="w-3.5 h-3.5 text-gray-600" />
        </button>
      </div>
      <div className="space-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading...' : 'Change Photo'}
        </Button>
        <p className="text-xs text-muted-foreground">JPG, PNG up to 5MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
