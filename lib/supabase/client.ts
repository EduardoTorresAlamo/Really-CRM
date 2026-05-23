import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase client for use in browser (client-side) contexts.
 *
 * Uses the public anon key, so all queries are subject to Row Level Security policies.
 * Call this inside 'use client' components or event handlers where server-side cookies
 * are not available.
 *
 * @returns A Supabase browser client instance.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
