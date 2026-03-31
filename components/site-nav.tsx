"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Menu, X } from "lucide-react"

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/characters", label: "Characters" },
  { href: "/forces", label: "Forces" },
  { href: "/team-builder", label: "Team Builder" },
]

export function SiteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-700 bg-[#111827]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-wider text-white">
            <img src="/icons/logo.png" alt="SLIME.WIKI logo" className="h-10 w-10 md:h-16 md:w-16 object-contain" />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent text-xl font-extrabold">SLIME.WIKI</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-lg font-semibold transition-colors ${isActive ? "text-white" : "text-gray-400 hover:text-white"}`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle navigation"
          className="md:hidden text-gray-300 hover:text-white"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-gray-700 bg-[#111827]/95">
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 space-y-2">
            {navLinks.map((link) => {
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
