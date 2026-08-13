import { createBrowserClient } from '@supabase/ssr'

// Browser (client-side) Supabase client. Uses the anon key, so queries are gated by RLS.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
