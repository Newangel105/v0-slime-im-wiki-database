"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ChevronDown, Menu, X } from "lucide-react"

const primaryLinks = [
  { href: "/characters", label: "Characters" },
  { href: "/forces", label: "Forces" },
  { href: "/heartprints", label: "Heartprints" },
]

const toolLinks = [
  { href: "/team-builder", label: "Team Builder" },
  { href: "/preset-viewer", label: "Preset Viewer" },
  { href: "/gauge-builder", label: "Trait Chart" },
  { href: "/orb-converter", label: "Orb Converters" },
  { href: "/battle-sim", label: "Battle Sim" },
  { href: "/tier-maker", label: "Tier Maker" },
]

const allLinks = [...primaryLinks, ...toolLinks]

export function SiteNav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const toolsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMobileOpen(false)
    setToolsOpen(false)
  }, [pathname])

  // Close tools dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const isToolActive = toolLinks.some((l) => pathname === l.href || pathname.startsWith(l.href + "/"))

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-700 bg-[#111827]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-wider text-white">
            <img src="/icons/logo.png" alt="SLIME.WIKI logo" className="h-10 w-10 md:h-16 md:w-16 object-contain" />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent text-xl font-extrabold">SLIME-WIKI</span>
          </Link>

          <div className="hidden md:flex items-center gap-4 lg:gap-6">
            {primaryLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm lg:text-base font-semibold whitespace-nowrap transition-colors ${isActive ? "text-white" : "text-gray-400 hover:text-white"}`}
                >
                  {link.label}
                </Link>
              )
            })}

            {/* Tools dropdown */}
            <div ref={toolsRef} className="relative">
              <button
                onClick={() => setToolsOpen((v) => !v)}
                className={`flex items-center gap-1 text-sm lg:text-base font-semibold whitespace-nowrap transition-colors ${isToolActive ? "text-white" : "text-gray-400 hover:text-white"}`}
              >
                Tools
                <ChevronDown className={`h-4 w-4 transition-transform ${toolsOpen ? "rotate-180" : ""}`} />
              </button>
              {toolsOpen && (
                <div className="absolute left-0 top-full mt-2 w-44 rounded-xl border border-gray-700 bg-[#111827] shadow-xl py-1 z-50">
                  {toolLinks.map((link) => {
                    const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`block px-4 py-2 text-sm font-medium transition-colors ${isActive ? "text-white bg-white/10" : "text-gray-300 hover:text-white hover:bg-white/5"}`}
                      >
                        {link.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation"
          className="md:hidden text-gray-300 hover:text-white"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-700 bg-[#111827]/95">
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 space-y-1">
            {allLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block text-base font-semibold py-2 ${isActive ? "text-white" : "text-gray-400 hover:text-white"}`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </nav>
  )
}
