import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import "./archive-lite.css"
import "./night-ink.css"
import "./night-ink-fixes.css"
import "./night-ink-tools.css"
import "./night-ink-toolskin.css"
import { SiteNav } from "@/components/site-nav"
import { ClassicSiteNav } from "@/components/classic/site-nav"
import { NightInkSiteNav } from "@/components/nightink/site-nav"
import { DesignViewportGuard } from "@/components/design-viewport-guard"
import { GlobalDesktopForce } from "@/components/global-desktop-force"
import { getDesign } from "@/lib/design"

// Inter is the typeface for the classic DARK design; exposed as a CSS var that
// only applies under html.dark (see `html.dark body` in globals.css). The
// night-ink design uses Georgia/Trebuchet (declared in night-ink.css).
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

// The site design is "nightink" (html[data-design="nightink"] gates the
// night-ink.css element resets; .board.v2 pages are otherwise self-contained).
// The two old designs stay wired behind the slime-design rollback cookie:
//   ocean   -> <html data-slime-theme="archive"> + archive-lite.css + ocean nav
//   classic -> <html class="dark"> + globals .dark vars + Inter + classic nav
//
// MIGRATION NOTE: while routes are migrated page-by-page, the nightink html
// ALSO keeps data-slime-theme="archive", because un-migrated routes still
// render their ocean components (archive-lite.css is scoped under that
// attribute, and its body background is !important so it wins on those pages;
// migrated night-ink pages paint their own full-viewport .board.v2 canvas on
// top). Remove the attribute for nightink once every route is migrated.
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const design = await getDesign()
  const isClassic = design === "classic"
  const isNightInk = design === "nightink"

  return (
    <html
      lang="en"
      data-design={isNightInk ? "nightink" : undefined}
      data-slime-theme={design === "ocean" ? "archive" : undefined}
      className={isClassic ? `dark ${inter.variable}` : inter.variable}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning: the night-ink home adds body.motion via an
          inline pre-hydration script (prototype-equivalent reduced-motion
          gate) — the class is intentionally not in the server HTML */}
      <body suppressHydrationWarning>
        {/* nightink serves all viewports — the force-classic guard only runs
            for the ocean rollback design */}
        {!isNightInk && <DesignViewportGuard />}
        {isNightInk ? <NightInkSiteNav /> : isClassic ? <ClassicSiteNav /> : <SiteNav />}
        {isNightInk && <GlobalDesktopForce />}
        {children}
      </body>
    </html>
  )
}
