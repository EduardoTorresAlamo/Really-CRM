import { redirect } from 'next/navigation'

/**
 * Root page at "/". Immediately redirects to /dashboard.
 * Middleware (proxy.ts) will further redirect to /login if the user is not authenticated.
 *
 * @returns Never -- the redirect call throws a Next.js redirect exception.
 */
export default function HomePage() {
  redirect('/dashboard')
}
