import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client for use in server-side contexts (Server Components,
 * Route Handlers, and Server Actions).
 *
 * Reads the session from the incoming request cookies so the user's auth state is
 * available on the server. cookies() is async in Next.js 16 and must be awaited.
 *
 * Cookie writes inside Server Components are intentionally swallowed (see the catch
 * block below) -- the middleware in proxy.ts is responsible for refreshing and
 * persisting the session on every request.
 *
 * Uses the public anon key, so all queries are still gated by RLS policies.
 *
 * @returns A Supabase server client instance bound to the current request's cookies.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components can't set cookies directly — the middleware (proxy.ts) handles it instead
          }
        },
      },
    }
  )
}
