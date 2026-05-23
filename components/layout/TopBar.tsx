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

/**
 * Props for the TopBar component.
 */
interface TopBarProps {
  /** The authenticated realtor's profile; null if the profile has not been set up yet. */
  profile: Profile | null
}

/**
 * Top navigation bar rendered on all authenticated pages.
 *
 * Displays the mobile hamburger button (hidden on md+), a spacer, and the
 * realtor's avatar + name in a dropdown menu. The dropdown contains the sign-out
 * action which calls supabase.auth.signOut() and redirects to /login.
 *
 * Initials are derived from the profile name (first letter of each word, max 2)
 * and shown as an avatar fallback when no photo is uploaded.
 *
 * @param props - TopBarProps with the realtor profile.
 * @returns The top bar header JSX.
 */
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
      <header className="h-14 bg-white border-b border-[#d9d9dd] flex items-center justify-between px-4 md:px-6">
        <button
          className="md:hidden p-1 rounded-[8px] text-[#93939f] hover:bg-[#f2f2f2] hover:text-black transition-colors"
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
              <span className="hidden sm:block text-sm font-medium text-black">
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
