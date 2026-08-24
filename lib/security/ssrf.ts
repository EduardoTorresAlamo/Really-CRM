import { lookup } from 'dns/promises'
import net from 'net'

/** Thrown when a URL is rejected by the SSRF guard. Callers map this to a 400. */
export class SsrfError extends Error {}

/** Hostnames that never point anywhere safe to fetch. */
const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal'])

/**
 * True when `ip` is loopback, private (RFC 1918), link-local, CGNAT, or the cloud
 * metadata endpoint. Unknown/malformed addresses are treated as private (fail closed).
 */
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true // link-local incl. 169.254.169.254 metadata
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    return false
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase()
    if (lower === '::1' || lower === '::') return true
    if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/) // IPv4-mapped IPv6
    if (mapped) return isPrivateIp(mapped[1])
    return false
  }
  return true
}

/**
 * Validates that `rawUrl` is a plain http(s) URL whose host does not resolve to a
 * private/loopback/metadata address. Throws SsrfError on any violation. Prevents
 * server-side request forgery from user-supplied listing URLs.
 */
export async function assertUrlAllowed(rawUrl: string): Promise<void> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new SsrfError('Invalid URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SsrfError('Only http and https URLs are allowed')
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (BLOCKED_HOSTNAMES.has(host)) throw new SsrfError('Host is not allowed')

  // Literal IP in the URL — check directly, no DNS needed.
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new SsrfError('URL points to a private address')
    return
  }

  // Resolve the hostname and reject if ANY record is private (defends against
  // DNS rebinding to the first-resolved address).
  const records = await lookup(host, { all: true })
  if (records.length === 0) throw new SsrfError('Host did not resolve')
  for (const { address } of records) {
    if (isPrivateIp(address)) throw new SsrfError('URL resolves to a private address')
  }
}
