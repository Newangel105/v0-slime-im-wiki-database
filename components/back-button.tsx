"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

export function BackButton({ fallback = "/characters" }: { fallback?: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back()
        } else {
          router.push(fallback)
        }
      }}
      className="inline-flex items-center gap-2 rounded-full border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-700"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to characters
    </button>
  )
}
