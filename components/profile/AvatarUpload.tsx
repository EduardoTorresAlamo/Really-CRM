'use client'

import { useRef, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { uploadFile } from '@/lib/storage/uploadFile'
import { toast } from 'sonner'
import { Camera } from 'lucide-react'

interface AvatarUploadProps {
  userId: string // namespaces the storage path (userId/avatar.ext)
  currentUrl: string | null
  name: string
  onUpload: (url: string) => void
}

// Avatar upload for the profile page. A fixed path per user + upsert overwrites the old avatar
// (no orphans); the 'avatars' bucket is public. Shows an optimistic local-object-URL preview and
// reverts to currentUrl on failure. The file input is hidden and triggered via a ref.
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

    // Enforce the 5MB limit the UI advertises -- otherwise oversized files fail
    // server-side with an unhelpful generic error
    const MAX_SIZE_BYTES = 5 * 1024 * 1024
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('Photo must be 5MB or smaller')
      e.target.value = ''
      return
    }

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
