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
import { ChevronDown, LogOut, Menu, UserRound } from 'lucide-react'
import Link from 'next/link'
import MobileNav from './MobileNav'
import { useState } from 'react'

interface TopBarProps {
  profile: Profile | null // null until the realtor has set up their profile
}

// Top nav bar for authenticated pages: mobile hamburger, spacer, and the realtor's
// avatar + name dropdown with sign-out. Avatar falls back to name initials.
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
      {/* Sticky and translucent so page content scrolls under the bar rather than
          being clipped by an opaque strip. */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-hairline bg-surface/80 px-4 backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(0))]:bg-surface md:px-8">
        <button
          type="button"
          aria-label="Open navigation"
          className="-ml-1 rounded-md p-1.5 text-ink-subtle transition-colors duration-150 hover:bg-hairline-soft hover:text-ink md:hidden"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger className="group flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 outline-none transition-colors duration-150 hover:bg-hairline-soft">
            <Avatar className="h-7 w-7">
              <AvatarImage src={profile?.photo_url ?? undefined} alt="" />
              <AvatarFallback className="bg-hairline-soft text-[11px] font-medium text-ink">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[12rem] truncate text-sm font-medium text-ink sm:block">
              {profile?.name ?? 'Realtor'}
            </span>
            <ChevronDown
              className="hidden h-3.5 w-3.5 text-ink-muted transition-transform duration-200 ease-fluid group-aria-expanded:rotate-180 sm:block"
              strokeWidth={2}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {/* Identifies the signed-in account before offering account actions --
                the trigger truncates, this does not. */}
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-medium text-ink">
                {profile?.name ?? 'Realtor'}
              </p>
              {profile?.email && (
                <p className="truncate text-xs text-ink-subtle">{profile.email}</p>
              )}
            </div>
            <div className="my-1 h-px bg-hairline-soft" />
            <DropdownMenuItem
              className="gap-2 px-2 py-1.5"
              render={<Link href="/profile" />}
            >
              <UserRound className="h-4 w-4" strokeWidth={1.75} />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 px-2 py-1.5" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  )
}
