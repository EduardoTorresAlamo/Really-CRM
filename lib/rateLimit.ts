// In-memory rate limiter. Single-instance only -- replace with Upstash Redis for multi-instance deployments.
const store = new Map<string, { count: number; resetAt: number }>()

// Returns true if `key` has hit `limit` requests within `windowMs`, else records the hit and returns false.
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
