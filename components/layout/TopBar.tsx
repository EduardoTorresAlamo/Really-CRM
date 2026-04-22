'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Profile } from '@/types/profile'
import { Menu } from 'lucide-react'
import MobileNav from './MobileNav'
import { useState } from 'react'

interface TopBarProps {
  profile: Profile | null
}

export default function TopBar({ profile }: TopBarProps) {
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = profile?.name
    ? profile.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6">
        <button
          className="md:hidden p-1 rounded-md text-gray-600 hover:bg-gray-100"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity outline-none">
              <Avatar className="w-8 h-8">
                <AvatarImage src={profile?.photo_url ?? undefined} alt={profile?.name ?? ''} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden sm:block text-sm font-medium text-gray-700">
                {profile?.name ?? 'Realtor'}
              </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleSignOut}>Sign Out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  )
}
