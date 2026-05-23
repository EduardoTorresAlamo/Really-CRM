// In-memory rate limiter. Single-instance only -- replace with Upstash Redis for multi-instance deployments.
const store = new Map<string, { count: number; resetAt: number }>()

/**
 * Checks whether a given key has exceeded its allowed request count within the time window.
 *
 * Uses an in-memory sliding-window counter keyed by an arbitrary string (e.g. "property-match:{userId}").
 * This is intentionally simple and works only in single-process deployments. For multi-instance
 * or serverless environments (multiple Vercel function instances), replace with a shared store
 * such as Upstash Redis.
 *
 * @param key - Unique identifier for the subject being rate-limited (e.g. a user ID + action).
 * @param limit - Maximum number of requests allowed within the window.
 * @param windowMs - Duration of the time window in milliseconds.
 * @returns `true` if the caller should be blocked, `false` if the request is allowed.
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = store.get(key)
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  if (entry.count >= limit) return true
  entry.count++
  return false
}
