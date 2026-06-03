import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import "./archive-lite.css"
import { SiteNav } from "@/components/site-nav"
import { ClassicSiteNav } from "@/components/classic/site-nav"
import { DesignViewportGuard } from "@/components/design-viewport-guard"
import { getDesign } from "@/lib/design"

// Inter is the typeface for the classic DARK design; exposed as a CSS var that
// only applies under html.dark (see `html.dark body` in globals.css). The
// DAY/beach design keeps its Arial + Segoe Script accents.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "SLIME.WIKI - Character Database",
  description: "Character database for SLIME - Isekai Memories",
  icons: {
    icon: "/icons/logo2.webp",
    shortcut: "/icons/logo2.webp",
    apple: "/icons/logo2.webp",
  },
  generator: 'v0.dev',
}

// Two complete designs, chosen by the `slime-design` cookie (read server-side
// so the right markup is rendered without a flash):
//   DAY  = "ocean"   -> <html data-slime-theme="archive"> + archive-lite.css + ocean nav/home
//   DARK = "classic" -> <html class="dark"> + globals .dark vars + Inter + classic nav/home
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const design = await getDesign()
  const isClassic = design === "classic"

  return (
    <html
      lang="en"
      data-slime-theme={isClassic ? undefined : "archive"}
      className={isClassic ? `dark ${inter.variable}` : inter.variable}
      suppressHydrationWarning
    >
      <body>
        <DesignViewportGuard />
        {isClassic ? <ClassicSiteNav /> : <SiteNav />}
        {children}
      </body>
    </html>
  )
}
