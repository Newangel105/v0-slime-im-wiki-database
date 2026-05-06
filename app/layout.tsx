import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SiteNav } from "@/components/site-nav"

const inter = Inter({ subsets: ["latin"], display: "swap" })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "SLIME.WIKI - Character Database",
  description: "Character database for SLIME - Isekai Memories",
  icons: {
    icon: "/icons/logo.webp",
    shortcut: "/icons/logo.webp",
    apple: "/icons/logo.webp",
  },
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <SiteNav />
        {children}
      </body>
    </html>
  )
}
