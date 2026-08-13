import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server-side Supabase client (Server Components, Route Handlers, Server Actions), bound to the
// request cookies for auth. cookies() is async in Next.js 16. Cookie writes in Server Components
// are swallowed below — the proxy.ts middleware refreshes/persists the session per request.
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
