"use client"

import type { FormEvent } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { BookOpen, ChevronDown, Flag, Home, Menu, Search, Swords, Parasol, Blocks, Box, Settings2, UserRound, X } from "lucide-react"
import { DesignToggle } from "@/components/design-toggle"

const primaryLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/characters", label: "Characters", icon: UserRound },
  { href: "/summon", label: "Banners", icon: Parasol },
  { href: "/guides", label: "Guides", icon: BookOpen },
  { href: "/team-builder", label: "Team Builder", icon: Blocks },
  { href: "/model-viewer", label: "Model Viewer", icon: Box },
]

const toolLinks = [
  { href: "/skill-viewer", label: "Skill Viewer" },
  { href: "/preset-viewer", label: "Preset Viewer" },
  { href: "/gauge-builder", label: "Trait Chart" },
  { href: "/orb-converter", label: "Orb Converters" },
  { href: "/tier-maker", label: "Tier Maker" },
  { href: "/forces", label: "Forces" },
  { href: "/heartprints", label: "Heartprints" },
  { href: "/loup-loupe", label: "Loup Loupe" },
]

const mobileLinks = [...primaryLinks, ...toolLinks]

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SiteNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const toolsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMobileOpen(false)
    setToolsOpen(false)
  }, [pathname])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) {
        setToolsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = searchQuery.trim()
    router.push(query ? `/characters?tag=${encodeURIComponent(query)}` : "/characters")
  }

  function openCharacterPicker() {
    window.dispatchEvent(new Event("slime:openCharacterPicker"))
  }

  const isHome = pathname === "/"
  const isToolActive = toolLinks.some((link) => isActivePath(pathname, link.href))

  return (
    <nav className="slime-site-nav" aria-label="Primary navigation">
      <div className="slime-site-nav-inner">
        <Link href="/" className="slime-site-brand">
          <span>
            <img src="/brand/battleSlime16.webp" alt="" />
          </span>
          <strong>
            <span>SLIME</span>
            <span>WIKI</span>
          </strong>
        </Link>

        <div className="slime-desktop-links">
          {primaryLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.label}
                href={link.href}
                className={isActivePath(pathname, link.href) ? "is-active" : ""}
                aria-label={link.label}
                title={link.label}
              >
                <Icon className="h-5 w-5" />
                <span className="sr-only">{link.label}</span>
              </Link>
            )
          })}

          <div ref={toolsRef} className="slime-tools-menu">
            <button
              type="button"
              className={isToolActive ? "is-active" : ""}
              aria-expanded={toolsOpen}
              aria-label="Tools"
              title="Tools"
              onClick={() => setToolsOpen((open) => !open)}
            >
              <Swords className="h-5 w-5" />
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {toolsOpen && (
              <div className="slime-tools-popover">
                {toolLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={isActivePath(pathname, link.href) ? "is-active" : ""}>
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>

        <div className="slime-nav-actions">
          <form className="slime-nav-search" onSubmit={handleSearch}>
            <Search className="h-4 w-4" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search characters..."
              aria-label="Search characters"
            />
          </form>
          <DesignToggle />
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation"
          className="slime-mobile-toggle"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {isHome && (
        <button
          type="button"
          className="slime-nav-icon slime-home-picker-button"
          onClick={openCharacterPicker}
          aria-label="Edit carousel favorites"
          title="Edit carousel favorites"
        >
          <Settings2 className="h-5 w-5" />
        </button>
      )}

      {mobileOpen && (
        <div className="slime-mobile-menu">
          <form className="slime-nav-search" onSubmit={handleSearch}>
            <Search className="h-4 w-4" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search characters..."
              aria-label="Search characters"
            />
          </form>
          {isHome && (
            <button type="button" className="slime-mobile-action" onClick={openCharacterPicker}>
              Edit carousel favorites
            </button>
          )}
          <div className="slime-mobile-design-toggle"><DesignToggle /> <span>Toggle design</span></div>
          {mobileLinks.map((link) => (
            <Link key={`${link.label}-${link.href}`} href={link.href} className={isActivePath(pathname, link.href) ? "is-active" : ""}>
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
