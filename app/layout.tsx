import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Interview prep',
  description: 'Personal interview drilling: stories, quiz cards, system design, English under pressure.',
}

const NAV = [
  { href: '/', label: 'Today' },
  { href: '/drill/quiz', label: 'Quiz' },
  { href: '/drill/behavioral', label: 'Stories' },
  { href: '/stats', label: 'Stats' },
]

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    /*
     * suppressHydrationWarning is here for browser extensions (Grammarly, Dark
     * Reader, password managers) that inject attributes into html/body before
     * React hydrates. It only suppresses one level deep on these two elements,
     * so real mismatches inside the app still surface.
     */
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-bg text-fg" suppressHydrationWarning>
        <header className="border-b border-border bg-panel/60 backdrop-blur sticky top-0 z-10">
          <nav className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-3">
            <span className="mr-3 text-sm font-semibold tracking-tight">prep</span>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm text-muted transition hover:bg-panel-2 hover:text-fg"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
