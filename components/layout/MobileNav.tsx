'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { LayoutDashboard, Users, KanbanSquare, Search, Mail, User } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { href: '/property-match', label: 'Property Match', icon: Search },
  { href: '/templates', label: 'Templates', icon: Mail },
  { href: '/profile', label: 'Profile', icon: User },
]

/**
 * Props for the MobileNav component.
 */
interface MobileNavProps {
  /** Whether the slide-out sheet is open. */
  open: boolean
  /** Callback to close the sheet (passed to Sheet's onOpenChange and each nav link's onClick). */
  onClose: () => void
}

/**
 * Mobile navigation drawer rendered as a slide-in sheet from the left side.
 *
 * Only visible on small screens -- the desktop Sidebar handles navigation on md+.
 * Each nav link calls onClose on click so the sheet closes automatically after navigation.
 * Active link detection uses the same startsWith logic as the desktop Sidebar.
 *
 * @param props - MobileNavProps with open state and close callback.
 * @returns The mobile navigation sheet JSX.
 */
export default function MobileNav({ open, onClose }: MobileNavProps) {
  const pathname = usePathname()

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-60 bg-surface p-0">
        <SheetHeader className="px-5 py-6">
          <SheetTitle className="text-left font-mono text-[13px] font-medium uppercase tracking-[0.14em] text-ink">
            Really CRM
          </SheetTitle>
        </SheetHeader>
        {/* Mirrors the desktop Sidebar states exactly -- the same route must not look
            like two different things depending on viewport width. */}
        <nav className="space-y-0.5 px-3" aria-label="Primary">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150',
                  active
                    ? 'bg-hairline-soft font-medium text-ink'
                    : 'text-ink-subtle active:bg-hairline-soft/70'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-ink' : 'text-ink-muted'
                  )}
                  strokeWidth={1.75}
                />
                {label}
              </Link>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
