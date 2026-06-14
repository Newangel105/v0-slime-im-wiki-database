"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Settings } from "lucide-react"

// The night-ink masthead (styles: SECTION 3 of app/night-ink.css; the brand
// row and nav chips reuse the prototype-verbatim .v2-brand / .v2-navsq rules
// from SECTION 1). Rendered globally by app/layout.tsx for the nightink
// design; the old ocean/classic navs only render for the rollback cookies.
const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/characters", label: "Characters" },
  { href: "/summon", label: "Banners" },
  { href: "/skill-viewer", label: "Skills" },
  { href: "/team-builder", label: "Team Builder" },
  { href: "/guides", label: "Guides" },
]

// Skills (/skill-viewer) and Team Builder live in the primary nav, so they're
// intentionally NOT repeated here.
const toolLinks = [
  { href: "/model-viewer", label: "Model Viewer" },
  { href: "/preset-viewer", label: "Preset Viewer" },
  { href: "/gauge-builder", label: "Trait Chart" },
  { href: "/orb-converter", label: "Orb Converter" },
  { href: "/tier-maker", label: "Tier Maker" },
  { href: "/forces", label: "Forces" },
  { href: "/heartprints", label: "Heartprints" },
  { href: "/loup-loupe", label: "Loup Loupe" },
]

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function NightInkSiteNav() {
  const pathname = usePathname()
  const [toolsOpen, setToolsOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const toolsRef = useRef<HTMLDivElement>(null)

  // close everything on navigation
  useEffect(() => {
    setToolsOpen(false)
    setMobileOpen(false)
  }, [pathname])

  // close the tools dropdown on outside click
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) {
        setToolsOpen(false)
      }
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  const toolsActive = toolLinks.some((link) => isActivePath(pathname, link.href))
  // on a single character page, surface a back link in the nav's empty left
  // slot so it shares the masthead row instead of stacking a second row
  const characterBack = /^\/characters\/.+/.test(pathname)
  // the home altar's "choose a hero" picker is opened from a masthead gear
  const isHome = pathname === "/"

  return (
    <header className="nk-mast">
      <div className="nk-mast-inner">
        {characterBack ? (
          <Link className="nk-mast-back" href="/characters">
            &larr; Archive
          </Link>
        ) : null}
        <nav className="v2-navsq" aria-label="Wiki sections">
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={isActivePath(pathname, link.href) ? "is-active" : undefined}
            >
              {link.label}
            </Link>
          ))}

          <div
            className="nk-tools"
            ref={toolsRef}
            onMouseEnter={() => setToolsOpen(true)}
          >
            <button
              type="button"
              className={`nk-tools-btn${toolsActive ? " is-active" : ""}`}
              aria-expanded={toolsOpen}
              aria-haspopup="menu"
              onClick={() => setToolsOpen((open) => !open)}
              onFocus={() => setToolsOpen(true)}
            >
              Tools <span className="caret">▼</span>
            </button>
            {toolsOpen && (
              <div className="nk-tools-pop" role="menu" aria-label="Tools">
                {toolLinks.map((link) => (
                  <Link
                    key={link.href}
                    role="menuitem"
                    href={link.href}
                    className={`drop-item${isActivePath(pathname, link.href) ? " is-active" : ""}`}
                  >
                    <span className="drop-label">{link.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        {isHome ? (
          <button
            type="button"
            className="nk-mast-gear"
            aria-label="Choose altar hero"
            title="Choose altar hero"
            onClick={() => window.dispatchEvent(new Event("nk:open-hero-picker"))}
          >
            <Settings aria-hidden="true" />
          </button>
        ) : null}

        <button
          type="button"
          className="nk-mast-toggle"
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </div>

      {mobileOpen && (
        <nav className="nk-mast-drawer" aria-label="Wiki sections">
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={isActivePath(pathname, link.href) ? "is-active" : undefined}
            >
              {link.label}
            </Link>
          ))}
          <span className="cap nk-drawer-cap">Tools</span>
          {toolLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={isActivePath(pathname, link.href) ? "is-active" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
