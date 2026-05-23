import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const spaceGrotesk = Space_Grotesk({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  title: 'Really CRM',
  description: 'Real estate client relationship manager',
}

/**
 * Root HTML layout wrapping the entire application.
 *
 * Applies the Space Grotesk variable font globally and mounts the Sonner
 * toaster with richColors so all toast() calls throughout the app render
 * without needing a per-page toaster setup.
 *
 * @param children - The page or nested layout rendered inside the body.
 * @returns The html + body shell JSX.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster richColors />
      </body>
    </html>
  )
}
