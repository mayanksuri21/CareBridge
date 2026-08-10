import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { RouteTransition } from '@/components/route-transition'
import { ThemeProvider } from '@/components/theme-provider'
import { LanguageProvider } from '@/components/language-provider'
import { ErrorBoundary } from '@/components/error-boundary'
import { Toaster } from '@/components/ui/toaster'

export const metadata: Metadata = {
  title: 'CareBridge | Secure Digital Healthcare',
  description: 'CareBridge helps patients connect with certified doctors, manage records, and access trusted digital healthcare securely from anywhere.',
  openGraph: {
    title: 'CareBridge | Secure Digital Healthcare',
    description: 'Connect with certified doctors, manage your medical records, and access trusted digital healthcare securely from anywhere.',
    type: 'website',
  },
  generator: 'Next.js',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <ErrorBoundary>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <LanguageProvider>
              <RouteTransition>
                {children}
              </RouteTransition>
              <Toaster />
              <Analytics />
            </LanguageProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
