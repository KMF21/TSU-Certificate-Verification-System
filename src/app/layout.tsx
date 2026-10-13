import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/sora'
import '@fontsource-variable/inter'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Verify a certificate | Taraba State University',
    template: '%s | TSU Certificate Verification',
  },
  description:
    'The official service for confirming that a Taraba State University certificate is genuine. Scan the QR code on the certificate or enter its serial and matric numbers.',
  applicationName: 'TSU Certificate Verification',
  icons: { icon: '/brand/tsu-crest.png' },
}

export const viewport: Viewport = {
  themeColor: '#0F1F3D',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  )
}
