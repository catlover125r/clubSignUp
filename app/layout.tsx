import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import dynamic from 'next/dynamic'
import './globals.css'

const AuthProvider = dynamic(
  () => import('@/components/AuthProvider').then((m) => ({ default: m.AuthProvider })),
  { ssr: false }
)

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Club Fair Sign-Ups',
  description: "Scan a club's QR code to join their sign-up list",
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
