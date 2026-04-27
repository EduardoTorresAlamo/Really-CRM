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
