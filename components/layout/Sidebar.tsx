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
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-white border-r border-[#d9d9dd] py-8">
      <div className="px-6 mb-10">
        <span className="text-base font-bold tracking-tight text-black uppercase font-mono letter-spacing-[0.08em]">
          REALLY CRM
        </span>
      </div>
      <nav className="flex-1 px-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-[11px] text-sm transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-[#f2f2f2] text-black font-medium'
                : 'text-[#93939f] hover:bg-[#f2f2f2] hover:text-[#1863dc]'
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
