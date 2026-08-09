'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  Search,
  Mail,
  User,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { href: '/property-match', label: 'Property Match', icon: Search },
  { href: '/templates', label: 'Templates', icon: Mail },
  { href: '/profile', label: 'Profile', icon: User },
]

/**
 * Fixed desktop sidebar with the primary navigation links.
 *
 * Hidden on mobile (md:flex) -- MobileNav provides the equivalent on small screens.
 * Active link detection uses startsWith so that sub-routes (e.g. /clients/123)
 * also highlight the parent "Clients" item.
 *
 * @returns The sidebar JSX.
 */
export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 flex-col border-r border-hairline bg-surface py-6 md:flex">
      <div className="px-5 pb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-sm font-mono text-[13px] font-medium uppercase tracking-[0.14em] text-ink"
        >
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-ink"
          />
          Really CRM
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 px-3" aria-label="Primary">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                // Only color transitions: the row itself must not move, or the whole
                // nav shimmers every time the pointer crosses it.
                'group relative flex items-center gap-3 rounded-lg py-2 pl-3 pr-3 text-sm transition-colors duration-150',
                active
                  ? 'bg-hairline-soft font-medium text-ink'
                  : 'text-ink-subtle hover:bg-hairline-soft/70 hover:text-ink'
              )}
            >
              {/* Active marker sits in the gutter so the label baseline never shifts
                  between states. */}
              <span
                aria-hidden
                className={cn(
                  'absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-ink transition-opacity duration-150',
                  active ? 'opacity-100' : 'opacity-0'
                )}
              />
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors duration-150',
                  active ? 'text-ink' : 'text-ink-muted group-hover:text-ink'
                )}
                strokeWidth={1.75}
              />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
