'use client'

import { useRef, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { uploadFile } from '@/lib/storage/uploadFile'
import { toast } from 'sonner'
import { Camera } from 'lucide-react'

interface AvatarUploadProps {
  userId: string
  currentUrl: string | null
  name: string
  onUpload: (url: string) => void
}

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
    const path = `${userId}/avatar.${ext}`

    setPreview(URL.createObjectURL(file))
    setUploading(true)

    try {
      const url = await uploadFile('avatars', path, file)
      onUpload(url)
      toast.success('Photo updated')
    } catch (err) {
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
