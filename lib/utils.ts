import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges Tailwind CSS class names with conflict resolution.
 *
 * Combines clsx (conditional class logic) with tailwind-merge (deduplication
 * of conflicting utility classes such as "p-2 p-4" resolving to "p-4").
 *
 * @param inputs - Any mix of strings, arrays, or objects accepted by clsx.
 * @returns A single merged class string safe to pass to a className prop.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
