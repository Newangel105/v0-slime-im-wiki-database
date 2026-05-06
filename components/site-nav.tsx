"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ChevronDown, Menu, X } from "lucide-react"

const primaryLinks = [
  { href: "/characters", label: "Characters" },
  { href: "/forces", label: "Forces" },
  { href: "/heartprints", label: "Heartprints" },
  { href: "/guides", label: "Guides" },
]

const toolLinks = [
  { href: "/team-builder", label: "Team Builder" },
  { href: "/preset-viewer", label: "Preset Viewer" },
  { href: "/skill-viewer", label: "Skill Viewer" },
  { href: "/gauge-builder", label: "Trait Chart" },
  { href: "/orb-converter", label: "Orb Converters" },
  { href: "/battle-sim", label: "Battle Sim" },
  { href: "/tier-maker", label: "Tier Maker" },
  { href: "/model-viewer", label: "Model Viewer" },
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
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#222327]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="group flex items-center gap-3 text-lg font-bold tracking-normal text-white">
            <img src="/icons/logo.webp" alt="SLIME.WIKI logo" className="h-10 w-10 object-contain" />
            <span className="text-xl font-black text-white">SLIME.WIKI</span>
          </Link>

          <div className="hidden md:flex items-center gap-5 lg:gap-7">
            {primaryLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative text-sm font-semibold whitespace-nowrap transition-colors lg:text-base ${
                    isActive ? "text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {link.label}
                  {isActive && <span className="absolute -bottom-4 left-0 h-0.5 w-full rounded-full bg-[#ff2f5f]" />}
                </Link>
              )
            })}

            {/* Tools dropdown */}
            <div ref={toolsRef} className="relative">
              <button
                onClick={() => setToolsOpen((v) => !v)}
                className={`relative flex items-center gap-1 text-sm font-semibold whitespace-nowrap transition-colors lg:text-base ${
                  isToolActive ? "text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Tools
                <ChevronDown className={`h-4 w-4 transition-transform ${toolsOpen ? "rotate-180" : ""}`} />
                {isToolActive && <span className="absolute -bottom-4 left-0 h-0.5 w-full rounded-full bg-[#ff2f5f]" />}
              </button>
              {toolsOpen && (
                <div className="absolute left-0 top-full z-50 mt-3 w-52 overflow-hidden rounded-lg border border-white/10 bg-[#101116]/95 py-1 shadow-2xl shadow-black/50 backdrop-blur-xl">
                  {toolLinks.map((link) => {
                    const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`block px-4 py-2.5 text-sm font-medium transition-colors ${
                          isActive ? "bg-[#ff2f5f]/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                        }`}
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
          className="rounded-md border border-white/10 bg-white/[0.055] p-2 text-slate-300 hover:text-white md:hidden"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#222327]/95 md:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6">
            {allLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block rounded-md px-3 py-2 text-base font-semibold ${
                    isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
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
