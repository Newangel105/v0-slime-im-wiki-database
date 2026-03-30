import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SiteNav } from "@/components/site-nav"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SLIME.WIKI - Character Database",
  description: "Character database for SLIME - Isekai Memories",
  generator: 'v0.dev',
  viewport: 'width=device-width, initial-scale=1'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SiteNav />
        {children}
      </body>
    </html>
  )
}
