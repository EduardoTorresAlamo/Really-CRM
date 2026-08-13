import { createClient } from '@/lib/supabase/client'

// Uploads a file to a public Supabase Storage bucket and returns its public URL.
// upsert overwrites an existing file at the same path. For private buckets use getSignedUrl.
export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<string> {
  const supabase = createClient()

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

// Time-limited signed URL for a private bucket — temporary read access without making it public.
// Use for sensitive documents (contracts, ID scans). expiresIn is in seconds (default 1 hour).
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600
): Promise<string> {
  const supabase = createClient()

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)

  if (error) throw new Error(error.message)
  return data.signedUrl
}
