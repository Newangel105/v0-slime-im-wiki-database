"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/characters", label: "Characters" },
  { href: "/forces", label: "Forces" },
]

export function SiteNav() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-700 bg-[#111827]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-8 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-wider text-white">
          <img src="/icons/logo.png" alt="SLIME.WIKI logo" className="h-16 w-16 object-contain" />
          <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent text-xl font-extrabold">SLIME.WIKI</span>
        </Link>
        <div className="flex items-center gap-6">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-lg font-semibold transition-colors ${
                  isActive
                    ? "text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
