'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { LayoutDashboard, Users, Search, User } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/property-match', label: 'Property Match', icon: Search },
  { href: '/profile', label: 'Profile', icon: User },
]

interface MobileNavProps {
  open: boolean
  onClose: () => void
}

export default function MobileNav({ open, onClose }: MobileNavProps) {
  const pathname = usePathname()

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-56 p-0">
        <SheetHeader className="px-6 py-6">
          <SheetTitle className="text-left text-xl font-bold">Really CRM</SheetTitle>
        </SheetHeader>
        <nav className="px-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
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
      </SheetContent>
    </Sheet>
  )
}
