import { createClient } from '@/lib/supabase/client'

/**
 * Uploads a file to a Supabase Storage bucket and returns its public URL.
 *
 * Uses `upsert: true` so re-uploading to the same path overwrites the existing
 * file rather than erroring. Suitable for buckets configured with public access
 * (e.g. the "avatars" bucket). For private buckets, prefer `getSignedUrl`.
 *
 * @param bucket - The name of the Supabase Storage bucket.
 * @param path - The destination path within the bucket (e.g. "userId/avatar.png").
 * @param file - The browser File object to upload.
 * @returns The public URL of the uploaded file.
 * @throws If the upload fails (e.g. storage policy violation, network error).
 */
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

/**
 * Generates a time-limited signed URL for a file in a private Supabase Storage bucket.
 *
 * Signed URLs grant temporary read access without making the bucket public.
 * Use this for sensitive documents (e.g. contracts, ID scans) where permanent
 * public URLs would be a security risk.
 *
 * @param bucket - The name of the Supabase Storage bucket.
 * @param path - The path of the file within the bucket.
 * @param expiresIn - Number of seconds until the URL expires. Defaults to 3600 (1 hour).
 * @returns A signed URL valid for the specified duration.
 * @throws If the bucket or path does not exist, or if signing fails.
 */
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
